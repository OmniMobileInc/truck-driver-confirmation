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

function onlyDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

function formatPhoneHyphen(v) {
  const d = onlyDigits(v).slice(0, 10);
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 10);
  if (!d) return "";
  if (d.length <= 3) return a;
  if (d.length <= 6) return `${a}-${b}`;
  return `${a}-${b}-${c}`;
}

function tokenFromAny(raw) {
  const s = safeStr(raw);
  if (!s) return "";

  try {
    if (s.includes("http://") || s.includes("https://")) {
      const u = new URL(s);
      const t = u.searchParams.get("t");
      if (t) return t.trim();
    }
  } catch {}

  const m = s.match(/[?&]t=([A-Za-z0-9\-_]+)/);
  if (m?.[1]) return m[1].trim();

  return s;
}

function buildVerifyUrl(req, token) {
  const origin =
    (req.headers["x-forwarded-proto"] ? `${req.headers["x-forwarded-proto"]}://` : "https://") +
    (req.headers["x-forwarded-host"] || req.headers.host || "localhost");

  return `${origin}/v.html?t=${token}&cv=4`;
}

async function fetchAttemptsForToken(token) {
  const { data, error } = await supabase
    .from("verify_checks")
    .select("*")
    .eq("token", token)
    .order("checked_at", { ascending: false });

  if (error) throw new Error(error.message || "Could not load attempts.");
  return Array.isArray(data) ? data : [];
}

function summarizeResult(attempts, status) {
  if (Array.isArray(attempts) && attempts.length > 0) {
    const latest = attempts[0];
    return safeStr(latest.result || status || "active");
  }
  return safeStr(status || "active");
}

function compactRow(req, link, attempts = []) {
  return {
    token: link.token,
    verification_id: link.token,
    verify_url: buildVerifyUrl(req, link.token),
    load_id: safeStr(link.load_id),
    status: safeStr(link.status || "active"),
    result_summary: summarizeResult(attempts, link.status),
    attempts_count: Array.isArray(attempts) ? attempts.length : 0,
    dock_email: safeStr(link.dock_email),
    driver_phone: safeStr(link.driver_phone),
    usdot_on_record: safeStr(link.usdot_on_record),
    plate_on_record: safeStr(link.plate_on_record),
    carrier_company: safeStr(link.carrier_company),
    carrier_contact_name: safeStr(link.dispatch_contact),
    carrier_contact_phone: safeStr(link.dispatch_phone),
    created_at: link.created_at || "",
    expires_at: link.expires_at || null
  };
}

async function fetchLinkByToken(token, brokerEmail) {
  const { data, error } = await supabase
    .from("verify_links")
    .select("*")
    .eq("token", token)
    .ilike("issued_by_email", brokerEmail)
    .maybeSingle();

  if (error) throw new Error(error.message || "Token lookup failed.");
  return data || null;
}

async function fetchManyByField(field, value, brokerEmail, mode = "eq") {
  let query = supabase
    .from("verify_links")
    .select("*")
    .ilike("issued_by_email", brokerEmail)
    .order("created_at", { ascending: false })
    .limit(25);

  if (mode === "ilike") {
    query = query.ilike(field, value);
  } else {
    query = query.eq(field, value);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message || `${field} lookup failed.`);
  return Array.isArray(data) ? data : [];
}

async function broadLookupMany(raw, brokerEmail) {
  const q = safeStr(raw);
  if (!q) return [];

  const directToken = tokenFromAny(q);

  {
    const link = await fetchLinkByToken(directToken, brokerEmail);
    if (link) return [link];
  }

  {
    const rows = await fetchManyByField("load_id", q, brokerEmail, "eq");
    if (rows.length) return rows;
  }

  if (q.includes("@")) {
    const rows = await fetchManyByField("dock_email", q.toLowerCase(), brokerEmail, "eq");
    if (rows.length) return rows;
  }

  if (onlyDigits(q).length >= 7) {
    const rows = await fetchManyByField("driver_phone", formatPhoneHyphen(q), brokerEmail, "eq");
    if (rows.length) return rows;
  }

  if (onlyDigits(q).length >= 4) {
    const rows = await fetchManyByField("usdot_on_record", onlyDigits(q), brokerEmail, "eq");
    if (rows.length) return rows;
  }

  {
    const rows = await fetchManyByField("plate_on_record", q.toUpperCase(), brokerEmail, "eq");
    if (rows.length) return rows;
  }

  {
    const rows = await fetchManyByField("carrier_company", `%${q}%`, brokerEmail, "ilike");
    if (rows.length) return rows;
  }

  return [];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const brokerEmail = await requireBroker(req, supabase);
    if (!brokerEmail) return json(res, 401, { ok: false, error: "Broker sign-in required." });
    const action = safeStr(body.action).toLowerCase();

    if (action === "lookup") {
      const raw = safeStr(body.token || body.query || body.search || "");
      if (!raw) {
        return json(res, 400, {
          ok: false,
          error: "Enter Verification ID, AdbS Verify Link, Load ID, email, phone, DOT, plate, or carrier"
        });
      }

      const rows = await broadLookupMany(raw, brokerEmail);

      if (!rows.length) {
        return json(res, 404, { ok: false, error: "Verification not found." });
      }

      const compactRows = [];
      for (const row of rows) {
        const attempts = await fetchAttemptsForToken(row.token);
        compactRows.push(compactRow(req, row, attempts));
      }

      return json(res, 200, {
        ok: true,
        mode: compactRows.length > 1 ? "multi" : "single",
        rows: compactRows
      });
    }

    if (action === "detail") {
      const token = safeStr(body.token);
      if (!token) {
        return json(res, 400, { ok: false, error: "Missing token." });
      }

      const link = await fetchLinkByToken(token, brokerEmail);
      if (!link) {
        return json(res, 404, { ok: false, error: "Verification not found." });
      }

      const attempts = await fetchAttemptsForToken(token);

      return json(res, 200, {
        ok: true,
        token: link.token,
        verify_url: buildVerifyUrl(req, link.token),
        status: link.status || "active",
        expires_at: link.expires_at || null,
        load_id: link.load_id || "",
        dock_email: link.dock_email || "",
        driver_phone: link.driver_phone || "",
        usdot_on_record: link.usdot_on_record || "",
        plate_on_record: link.plate_on_record || "",
        carrier_company: link.carrier_company || "",
        carrier_contact_name: link.dispatch_contact || "",
        carrier_contact_phone: link.dispatch_phone || "",
        created_at: link.created_at || "",
        attempts
      });
    }

    if (action === "set_status") {
      const token = safeStr(body.token);
      const status = safeStr(body.status).toLowerCase();

      if (!token || !status) {
        return json(res, 400, { ok: false, error: "Missing token or status." });
      }

      // Brokers may revoke an active link or reactivate a revoked, never-attempted link.
      // Verification outcomes are exclusively set by the server-side verification process.
      if (!["active", "revoked"].includes(status)) {
        return json(res, 403, { ok: false, error: "Verification results cannot be manually assigned." });
      }

      const owned = await fetchLinkByToken(token, brokerEmail);
      if (!owned) return json(res, 404, { ok: false, error: "Verification not found." });
      const current = String(owned.status || "").toLowerCase();
      if (status === "revoked" && current !== "active") {
        return json(res, 409, { ok: false, error: "Only active verifications may be revoked." });
      }
      if (status === "active") {
        if (current !== "revoked") {
          return json(res, 409, { ok: false, error: "Only revoked verifications may be reactivated." });
        }
        const attempts = await fetchAttemptsForToken(token);
        if (attempts.length) {
          return json(res, 409, { ok: false, error: "A verification with recorded attempts cannot be reactivated." });
        }
        if (owned.expires_at && new Date(owned.expires_at).getTime() <= Date.now()) {
          return json(res, 409, { ok: false, error: "Expired verifications cannot be reactivated." });
        }
      }
      const { data, error } = await supabase
        .from("verify_links")
        .update({ status })
        .eq("token", token)
        .eq("status", current)
        .ilike("issued_by_email", brokerEmail)
        .select("*")
        .maybeSingle();

      if (error) {
        return json(res, 500, { ok: false, error: error.message || "Could not update status." });
      }

      return json(res, 200, {
        ok: true,
        token,
        status: data?.status || status
      });
    }

    return json(res, 400, { ok: false, error: "Unknown action." });
  } catch (e) {
    return json(res, 500, { ok: false, error: String(e?.message || "Server error") });
  }
}
