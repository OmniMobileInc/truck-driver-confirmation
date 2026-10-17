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
  return formatPhone(link?.driver_phone) || formatPhone(link?.dispatch_phone) || "";
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

function isSuccessfulClosedStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized === "cleared" || normalized === "completed";
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
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111;">
          <h2>AdbS Alert</h2>
          <p>Three failed Truck-Driver verification attempts were detected.</p>
          <p><strong>Load ID:</strong> ${loadId}</p>
          <p><strong>Verification ID:</strong> ${token}</p>
          <p><strong>Failed Attempts:</strong> ${failedAttempts}</p>
          <hr style="margin:18px 0; border:none; border-top:1px solid #ddd;" />
          <p><strong>Carrier Company:</strong> ${carrierCompany}</p>
          <p><strong>Carrier Contact:</strong> ${carrierContact}</p>
          <p><strong>Carrier Contact Phone:</strong> ${carrierPhone}</p>
          <hr style="margin:18px 0; border:none; border-top:1px solid #ddd;" />
          <p>Open Control Center and search this Verification ID:</p>
          <p style="font-size:18px; font-weight:800;">${token}</p>
        </div>
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
  if (req.method === "GET") {
    try {
      const token = cleanText(req.query?.token);

      if (!token) {
        return res.status(400).json({ error: "Missing token" });
      }

      const { data: link, error } = await supabase
        .from("verify_links")
        .select("token,driver_phone,dispatch_phone,carrier_company,dispatch_contact")
        .eq("token", token)
        .maybeSingle();

      if (error) {
        return res.status(500).json({
          error: "Lookup failed",
          detail: error.message || String(error)
        });
      }

      if (!link) {
        return res.status(404).json({ error: "Verification link not found" });
      }

      return res.status(200).json({
        ok: true,
        ...carrierPayload(link, token, "")
      });
    } catch (err) {
      return res.status(500).json({
        error: "Failed to load verification info",
        detail: err?.message || String(err)
      });
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = cleanText(req.body?.token);
    const enteredDOT = onlyDigits(req.body?.entered_usdot);
    const enteredPlate = upper(req.body?.entered_plate);
    const driverAnswered = !!req.body?.driver_answered;

    if (!token) {
      return res.status(400).json({ error: "Missing token" });
    }

    const { data: link, error } = await supabase
      .from("verify_links")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        error: "Lookup failed",
        detail: error.message || String(error)
      });
    }

    if (!link) {
      return res.status(404).json({ error: "Verification link not found" });
    }

    if (String(link.status || "").trim().toLowerCase() === "revoked") {
      return res.status(410).json({ error: "Verification link revoked" });
    }

    if (isSuccessfulClosedStatus(link.status)) {
      return res.status(200).json({
        result: "CLEAR_TO_LOAD",
        ...carrierPayload(link, token, "")
      });
    }

    const match =
      enteredDOT === onlyDigits(link.usdot_on_record) &&
      enteredPlate === upper(link.plate_on_record) &&
      driverAnswered;

    const result = match ? "CLEAR_TO_LOAD" : "CAUTION_ALERT";
    const nowIso = new Date().toISOString();

    const { error: insertError } = await supabase
      .from("verify_checks")
      .insert({
        token,
        entered_usdot: enteredDOT,
        entered_plate: enteredPlate,
        driver_answered: driverAnswered,
        result,
        checked_at: nowIso
      });

    if (insertError) {
      return res.status(500).json({
        error: "Failed to log verification attempt",
        detail: insertError.message || String(insertError)
      });
    }

    const { data: attempts, error: attemptsError } = await supabase
      .from("verify_checks")
      .select("result")
      .eq("token", token);

    if (attemptsError) {
      return res.status(500).json({
        error: "Failed to read verification attempts",
        detail: attemptsError.message || String(attemptsError)
      });
    }

    const fails = (attempts || []).filter((a) => a.result === "CAUTION_ALERT").length;

    let alertTriggered = false;
    let alertSent = false;
    let alertError = null;

    if (fails === 3) {
      alertTriggered = true;
      const alertResult = await sendAlertEmail(link, token, fails);
      alertSent = !!alertResult.ok;
      alertError = alertResult.ok ? null : alertResult.error || "Alert send failed";
    }

    if (result === "CLEAR_TO_LOAD") {
      const { data: closedLink, error: closeError } = await supabase
        .from("verify_links")
        .update({ status: "cleared" })
        .eq("token", token)
        .select("status")
        .maybeSingle();

      if (closeError || !closedLink || String(closedLink.status || "").toLowerCase() !== "cleared") {
        console.error("verify_driver close link failed", closeError || "No updated row returned");
        return res.status(500).json({
          error: "Verification succeeded, but the link could not be closed safely. Do not reuse this link.",
          detail: closeError?.message || "No updated row returned"
        });
      }
    }

    return res.status(200).json({
      result,
      ...carrierPayload(link, token, nowIso),
      debug: {
        failedAttempts: fails,
        alertTriggered,
        alertSent,
        alertError
      }
    });
  } catch (err) {
    return res.status(500).json({
      error: "verify failed",
      detail: err?.message || String(err)
    });
  }
}
