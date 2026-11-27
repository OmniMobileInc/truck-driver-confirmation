import { getAssignedDockLink, getDockUser } from "./_dock_auth.js";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}

function upper(v) {
  return String(v || "").toUpperCase().trim();
}

function cleanText(v) {
  return String(v || "").trim();
}

function formatPhone(v) {
  const d = onlyDigits(v).slice(0, 10);
  if (!d) return "";
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

function bestPhone(link) {
  return formatPhone(link?.driver_phone) || "";
}

function carrierPayload(link, token, verifiedAt = "") {
  return {
    verification_id: token,
    verified_at: verifiedAt || "",
    driver_phone: bestPhone(link),
    carrier_company: cleanText(link?.carrier_company) || "",
    carrier_contact_name: cleanText(link?.dispatch_contact) || "",
    carrier_contact_phone: formatPhone(link?.dispatch_phone || "")
  };
}

async function sendAlertEmail(link, token, failedAttempts) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return { ok: false, error: "Missing RESEND_API_KEY" };
    }

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const toEmail = cleanText(link?.issued_by_email);

    if (!toEmail) {
      return { ok: false, error: "Missing issuing broker email" };
    }

    const fromEmail =
      cleanText(process.env.ADBS_EMAIL_FROM) ||
      "onboarding@resend.dev";

    const loadId = cleanText(link?.load_id) || "(none)";
    const carrierCompany = cleanText(link?.carrier_company) || "(not provided)";
    const carrierContact = cleanText(link?.dispatch_contact) || "(not provided)";
    const carrierPhone = formatPhone(link?.dispatch_phone || "") || "(not provided)";

    const sendResult = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject: `AdbS ALERT — 3 Failed Verification Attempts [${token}]`,
      text: `
Three failed Truck-Driver verification attempts were detected.

Load ID: ${loadId}
Verification ID: ${token}
Failed attempts: ${failedAttempts}
Carrier: ${carrierCompany}
Carrier contact: ${carrierContact}
Carrier phone: ${carrierPhone}

Open Control Center and search for the verification ID above.
      `
    });

    if (sendResult?.error) {
      return {
        ok: false,
        error: sendResult.error.message || JSON.stringify(sendResult.error)
      };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = cleanText(req.body?.token);
    const enteredDOT = onlyDigits(req.body?.entered_usdot);
    const enteredPlate = upper(req.body?.entered_plate);
    if (typeof req.body?.driver_answered !== "boolean") {
      return res.status(400).json({ error: "Driver answer must be explicitly confirmed." });
    }
    const driverAnswered = req.body.driver_answered;

    if (!token || !enteredDOT || !enteredPlate || enteredDOT.length > 12 || enteredPlate.length > 32) {
      return res.status(400).json({ error: "Enter the USDOT number and plate as displayed on the truck." });
    }
    const user = await getDockUser(req, supabase);
    if (!user) return res.status(401).json({ error: "Sign in to the Dock Portal." });
    if (req.body?.dock_certified !== true) {
      return res.status(400).json({ error: "Certify your dock observations before submitting." });
    }
    const link = await getAssignedDockLink(supabase, token, user);
    if (!link) return res.status(404).json({ error: "Verification not assigned to your facility." });

    // All attempt checks, inserts and status changes happen under a single
    // database row lock. The browser cannot bypass the three-strike limit.
    const { data: attempt, error: attemptError } = await supabase.rpc(
      "adbs_record_driver_attempt",
      {
        p_token: token,
        p_entered_usdot: enteredDOT,
        p_entered_plate: enteredPlate,
        p_driver_answered: driverAnswered,
        p_dock_user_id: user.id,
        p_dock_certified: true
      }
    );

    if (attemptError) {
      console.error("atomic verification failed", attemptError);
      return res.status(500).json({ error: "Verification unavailable. Do not release the load." });
    }

    const state = String(attempt?.state || "").toLowerCase();
    if (state === "forbidden") return res.status(404).json({ error: "Verification not assigned to your facility." });
    if (state === "uncertified") return res.status(400).json({ error: "Dock certification required." });
    if (state === "unacknowledged") return res.status(409).json({ error: "Broker acknowledgment required. Ask the broker to issue a new verification." });
    if (state === "not_found") return res.status(404).json({ error: "Verification link not found" });
    if (state === "expired") return res.status(410).json({ error: "Verification expired. Do not release the load." });
    if (state === "pending") return res.status(409).json({ error: "Verification window has not opened." });
    if (state === "unavailable") return res.status(409).json({ error: "Verification unavailable. Do not release the load." });
    if (state === "revoked") return res.status(410).json({ error: "Verification link revoked" });
    if (state === "locked" && !attempt?.result) {
      return res.status(423).json({ error: "Verification locked after three failed attempts.", locked: true });
    }
    if ((state === "cleared" || state === "completed") && !attempt?.result) {
      return res.status(410).json({ error: "Verification already completed", completed: true });
    }
    if (!attempt?.result) {
      return res.status(500).json({ error: "Verification unavailable. Do not release the load." });
    }

    const result = attempt.result;
    const nowIso = attempt.verified_at;
    const fails = Number(attempt.failed_attempts || 0);
    const alertTriggered = attempt.alert_triggered === true;
    let alertSent = false;
    let alertError = null;
    if (alertTriggered) {
      const alertResult = await sendAlertEmail(link, token, fails);
      alertSent = !!alertResult.ok;
      alertError = alertResult.ok ? null : alertResult.error || "Alert send failed";
      if (!alertSent) console.error("Three-strike alert delivery failed", alertError);
    }

    return res.status(200).json({
      result,
      locked: state === "locked",
      ...carrierPayload(link, token, nowIso),
      debug: {
        failedAttempts: fails,
        alertTriggered,
        alertSent,
        alertError: alertError ? "Alert delivery failed" : null
      }
    });
  } catch (err) {
    return res.status(500).json({
      error: "Verification unavailable. Do not release the load."
    });
  }
}
