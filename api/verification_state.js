import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const token = String(req.query?.token || "").trim();
  if (!token) return res.status(400).json({ error: "Missing token" });
  try {
    const { data, error } = await admin.from("verify_links")
      .select("status,starts_at,expires_at").eq("token", token).maybeSingle();
    if (error) return res.status(503).json({ error: "Verification unavailable" });
    if (!data) return res.status(404).json({ error: "Verification not found" });
    const now = Date.now();
    const expired = data.expires_at && new Date(data.expires_at).getTime() <= now;
    const notStarted = data.starts_at && new Date(data.starts_at).getTime() > now;
    return res.status(200).json({
      ok: true,
      status: expired ? "expired" : notStarted ? "pending" : String(data.status || "active").toLowerCase()
    });
  } catch {
    return res.status(503).json({ error: "Verification unavailable" });
  }
}
