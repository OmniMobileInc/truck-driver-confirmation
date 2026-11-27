import { getAssignedDockLink, getDockUser } from "./_dock_auth.js";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const token = String(req.query?.token || "").trim();
  if (!token) return res.status(400).json({ error: "Missing token" });
  try {
    const user = await getDockUser(req, admin);
    if (!user) return res.status(401).json({ error: "Sign in to the Dock Portal." });
    const data = await getAssignedDockLink(admin, token, user);
    if (!data) return res.status(404).json({ error: "Verification not assigned to your facility. Contact the issuing broker." });
    const now = Date.now();
    const expired = data.expires_at && new Date(data.expires_at).getTime() <= now;
    const notStarted = data.starts_at && new Date(data.starts_at).getTime() > now;
    const storedStatus = String(data.status || "").toLowerCase();
    const status = storedStatus !== "active" ? storedStatus || "unavailable"
      : expired ? "expired" : notStarted ? "pending"
      : data.broker_acknowledged_at ? "active" : "unacknowledged";
    if (status !== "active") return res.status(200).json({ ok: true, status });
    return res.status(200).json({
      ok: true,
      status,
      token: data.token,
      driver_phone: data.driver_phone || ""
    });
  } catch {
    return res.status(503).json({ error: "Verification unavailable" });
  }
}
