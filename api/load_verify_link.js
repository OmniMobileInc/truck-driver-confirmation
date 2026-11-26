// /api/load_verify_link.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const token = String(req.query?.token || "").trim();
  if (!token) return json(res, 400, { error: "token required" });

  const { data, error } = await supabase
    .from("verify_links")
    .select("token, load_id, driver_phone, status, starts_at, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error) return json(res, 500, { error: "Lookup unavailable" });
  if (!data) return json(res, 404, { error: "Not found" });

  return json(res, 200, { ok: true, link: data });
}
