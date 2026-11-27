import { verificationUrl } from "./_app_origin.js";
import { requireBroker } from "./_broker_auth.js";
import crypto from "crypto";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);



function json(res, code, obj) {
  res.status(code);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

function safe(v) {
  return String(v ?? "").trim();
}

function digits(v) {
  return String(v || "").replace(/\D+/g, "");
}

function upper(v) {
  return String(v || "").trim().toUpperCase();
}

function formatPhone(v) {
  const d = digits(v).slice(0, 10);

  if (!d) return "";
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;

  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

function makeToken() {
  return crypto.randomBytes(18).toString("base64url");
}


function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function enforceMonthlyLimit(brokerEmail) {
  const business_email = safe(brokerEmail).toLowerCase();

  if (!business_email) {
    return {
      ok: false,
      error: "Missing broker email."
    };
  }

  const { data: broker, error: brokerError } = await supabase
    .from("broker_accounts")
    .select(`
      business_email,
      account_type,
      subscription_status,
      monthly_verification_limit
    `)
    .eq("business_email", business_email)
    .maybeSingle();

  if (brokerError) {
    return {
      ok: false,
      error: brokerError.message
    };
  }

  if (!broker) {
    return {
      ok: false,
      error: "Broker account not found."
    };
  }

  const isInternal = safe(broker.account_type).toLowerCase() === "internal";

  if (isInternal || safe(broker.subscription_status).toLowerCase() === "internal") {
    return {
      ok: true,
      unlimited: true
    };
  }

  const status = safe(broker.subscription_status).toLowerCase();

  const paid = ["paid_active", "beta_active", "trial_active", "active", "trialing"].includes(status);

  if (!paid) {
    return {
      ok: false,
      error: "Subscription is inactive."
    };
  }

  const limit = Number(broker.monthly_verification_limit || 0);

  if (!limit || limit <= 0) {
    return {
      ok: false,
      error: "No verification limit assigned."
    };
  }

  const { count, error: countError } = await supabase
    .from("verify_links")
    .select("*", {
      count: "exact",
      head: true
    })
    .eq("issued_by_email", business_email)
    .gte("created_at", monthStartIso());

  if (countError) {
    return {
      ok: false,
      error: countError.message
    };
  }

  const used = Number(count || 0);

  if (used >= limit) {
    return {
      ok: false,
      error: `Monthly verification limit reached (${limit}).`
    };
  }

  return {
    ok: true,
    used,
    limit,
    remaining: limit - used
  };
}

function escapeHtml(value) {
  return safe(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildEmailHtml({
  loadId,
  verifyUrl,
  driverPhone,
  expiresAt
}) {
  const cleanPhone = formatPhone(driverPhone);
  const telPhone = digits(driverPhone);


  return `
    <div style="font-family:Arial,sans-serif;background:#0b0f14;color:#fff;padding:20px;">
      <h2 style="margin-top:0;">AdbS TRUCK-DRIVER VERIFICATION</h2>

      <p>
        A QueCab AdbS Truck-Driver verification has been issued.
      </p>

      <div style="margin:18px 0;padding:16px;background:#121923;border-radius:12px;">
        <div style="margin-bottom:8px;">
          <strong>Load ID:</strong> ${escapeHtml(loadId) || "(not provided)"}
        </div>

        <div style="margin-bottom:8px;">
          <strong>Driver Phone:</strong>
          ${
            telPhone
              ? `<a href="tel:${telPhone}" style="color:#8fc7ff;text-decoration:none;font-weight:700;">${cleanPhone}</a>`
              : "(not provided)"
          }
        </div>

        <div style="margin-bottom:8px;color:#cbd7e8;">
          Read the USDOT number and license plate directly from the truck.
          Do not copy these values from paperwork or carrier communications.
        </div>

        <div>
          <strong>Expires:</strong> ${
            expiresAt ? new Date(expiresAt).toLocaleString() : "No Expire"
          }
        </div>
      </div>

      <div style="margin:24px 0;text-align:center;">
        <div style="font-size:15px;font-weight:700;margin-bottom:10px;color:#cbd7e8;">
          Scan AdbS QR Code
        </div>

        <a href="${escapeHtml(verifyUrl)}" style="display:inline-block;">
          <img
            src="cid:adbs-verify-qr"
            alt="AdbS QR Code"
            width="260"
            height="260"
            style="display:block;background:#ffffff;padding:10px;border-radius:12px;border:0;"
          />
        </a>
      </div>

      <div style="margin:24px 0;text-align:center;">
        <a
          href="${escapeHtml(verifyUrl)}"
          style="
            display:inline-block;
            padding:14px 18px;
            background:#1f6feb;
            color:#fff;
            text-decoration:none;
            border-radius:10px;
            font-weight:700;
          "
        >
          OPEN AdbS VERIFY LINK
        </a>
      </div>

      <div style="word-break:break-all;font-size:13px;color:#9fb3c8;">
        ${escapeHtml(verifyUrl)}
      </div>

      <p style="margin-top:28px;color:#8b98a8;">
        QueCab AdbS™ — Verification happens before freight moves.
      </p>
    </div>
  `;
}

async function sendDockEmail({
  to,
  loadId,
  verifyUrl,
  driverPhone,
  expiresAt
}) {
  const from = process.env.ADBS_EMAIL_FROM;

  if (!process.env.RESEND_API_KEY) {
    return {
      ok: false,
      error: "Missing RESEND_API_KEY"
    };
  }

  if (!from) {
    return {
      ok: false,
      error: "Missing ADBS_EMAIL_FROM"
    };
  }

  if (!safe(to)) {
    return {
      ok: false,
      error: "Missing dock email"
    };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from,
      to: [safe(to)],
      subject: `Truck-Driver Verification Required — ${loadId || "Load"}`,
      attachments: [{
        filename: "adbs-verification.png",
        content: await QRCode.toBuffer(verifyUrl, { width: 260 }),
        inlineContentId: "adbs-verify-qr"
      }],
      html: buildEmailHtml({
        loadId,
        verifyUrl,
        driverPhone,
        expiresAt
      })
    });

    if (result?.error || !result?.data?.id) {
      return { ok: false, error: "Email delivery request failed" };
    }
    return { ok: true, resend_id: result.data.id };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || "Email send failed"
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, {
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    const issued_by_email = await requireBroker(req, supabase);
    if (!issued_by_email) return json(res, 401, { ok: false, error: "Broker sign-in required." });

    if (body.broker_acknowledged !== true) {
      return json(res, 400, { ok: false, error: "Broker integrity acknowledgment is required." });
    }

    const limitCheck = await enforceMonthlyLimit(issued_by_email);

    if (!limitCheck.ok) {
      return json(res, 403, {
        ok: false,
        error: limitCheck.error
      });
    }

    const token = makeToken();

    const load_id = safe(body.load_id);
    const dock_email = safe(body.dock_email).toLowerCase();
    const facility_id = safe(body.facility_id);

    if (!facility_id) {
      return json(res, 400, { ok: false, error: "Enter the assigned Facility ID." });
    }
    const { data: facility, error: facilityError } = await supabase.from("adbs_facilities")
      .select("facility_id").eq("facility_id", facility_id).eq("status", "active").maybeSingle();
    if (facilityError) return json(res, 503, { ok: false, error: "Facility lookup unavailable." });
    if (!facility) return json(res, 400, { ok: false, error: "Enter an active Facility ID." });

    const carrier_company = safe(body.carrier_company);
    const dispatch_contact = safe(body.dispatch_contact);
    const dispatch_phone = formatPhone(body.dispatch_phone);

    const driver_phone = formatPhone(body.driver_phone);

    const usdot_on_record = digits(body.usdot_on_record);
    const plate_on_record = upper(body.plate_on_record);

    const starts_at = body.starts_at || new Date().toISOString();

    const expires_at =
      body.expires_at === null || body.expires_at === ""
        ? null
        : body.expires_at;

    if (!Number.isFinite(Date.parse(starts_at)) ||
        (expires_at != null && (!Number.isFinite(Date.parse(expires_at)) ||
          Date.parse(expires_at) <= Math.max(Date.parse(starts_at), Date.now())))) {
      return json(res, 400, { ok: false, error: "Expiration must be after the start time and in the future." });
    }

    if (!usdot_on_record || usdot_on_record.length > 12) {
      return json(res, 400, {
        ok: false,
        error: "USDOT# is required"
      });
    }

    if (!plate_on_record || plate_on_record.length > 32) {
      return json(res, 400, {
        ok: false,
        error: "Plate is required"
      });
    }

    if (digits(body.driver_phone).length !== 10) {
      return json(res, 400, {
        ok: false,
        error: "Driver phone is required"
      });
    }

    const verify_url = verificationUrl(token);

    const payload = {
      token,
      issued_by_email,
      broker_acknowledged_at: new Date().toISOString(),
      load_id,
      dock_email,
      facility_id,

      carrier_company,
      dispatch_contact,
      dispatch_phone,

      driver_phone,

      usdot_on_record,
      plate_on_record,

      status: "active",

      starts_at,
      expires_at
    };

    const { error } = await supabase.from("verify_links").insert(payload);

    if (error) {
      return json(res, 500, {
        ok: false,
        error: "Could not create verification"
      });
    }

    let email_status = "not_requested";
    let email_error = "";
    let resend_id = "";

    if (dock_email) {
      const emailResult = await sendDockEmail({
        to: dock_email,
        loadId: load_id,
        verifyUrl: verify_url,
        driverPhone: driver_phone,
        expiresAt: expires_at
      });

      if (emailResult.ok) {
        email_status = "sent";
        resend_id = emailResult.resend_id || "";
      } else {
        email_status = "failed";
        email_error = emailResult.error || "Unknown email error";
      }
    }

    return json(res, 200, {
      ok: true,

      token,
      verify_url,

      status: "active",

      load_id,
      expires_at,

      usage: limitCheck,

      email_status,
      email_error,
      resend_id
    });
  } catch (err) {
    return json(res, 500, {
      ok: false,
      error: "Server error"
    });
  }
}
