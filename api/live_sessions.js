import { verificationUrl } from "./_app_origin.js";
import { requireBroker } from "./_broker_auth.js";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(res, code, obj) {
  res.status(code).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

function safeStr(v) {
  return String(v ?? "").trim();
}


function effectiveStatus(row) {
  const status = String(row.status || "active").toLowerCase();
  if (status !== "active") return status;
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return "expired";
  if (row.starts_at && Date.parse(row.starts_at) > Date.now()) return "pending";
  return status;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const brokerEmail = await requireBroker(req, supabase);
    if (!brokerEmail) return json(res, 401, { ok: false, error: "Broker sign-in required." });
    const status = safeStr(req.query?.status || "active").toLowerCase();
    const limit = Math.max(1, Math.min(100, Math.floor(Number(req.query?.limit) || 50)));

    let query = supabase
      .from("verify_links")
      .select("*")
      .eq("issued_by_email", brokerEmail)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status === "active") {
      query = query.eq("status", "active");
    } else if (status === "revoked") {
      query = query.eq("status", "revoked");
    } else if (status === "all") {
      // no filter
    } else {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      return json(res, 500, { ok: false, error: error.message || "Could not load live sessions." });
    }

    const rows = (Array.isArray(data) ? data : []).map((row) => ({
      token: row.token || "",
      verification_id: row.token || "",
      verify_url: verificationUrl(row.token || ""),
      load_id: row.load_id || "",
      status: effectiveStatus(row),
      created_at: row.created_at || "",
      expires_at: row.expires_at || null,
      dock_email: row.dock_email || "",
      driver_phone: row.driver_phone || "",
      usdot_on_record: row.usdot_on_record || "",
      plate_on_record: row.plate_on_record || "",
      carrier_company: row.carrier_company || "",
      carrier_contact_name: row.dispatch_contact || "",
      carrier_contact_phone: row.dispatch_phone || ""
    }));

    return json(res, 200, {
      ok: true,
      rows
    });
  } catch (e) {
    return json(res, 500, { ok: false, error: String(e?.message || "Server error") });
  }
}
