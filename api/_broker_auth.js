import { timingSafeEqual } from "node:crypto";

export async function requireBroker(req, supabase, { requireSubscription = true } = {}) {
  const email = String(req.headers["x-adbs-broker-email"] || "").trim().toLowerCase();
  const code = String(req.headers["x-adbs-broker-code"] || "").trim().toUpperCase();
  if (!email || !code) return null;
  const { data, error } = await supabase.from("broker_accounts")
    .select("business_email,access_code,role,status,account_type,subscription_status")
    .eq("business_email", email).limit(1);
  if (error) throw new Error("Broker authorization unavailable");
  const account = data?.[0];
  if (!account) return null;
  const expected = Buffer.from(String(account.access_code || "").trim().toUpperCase());
  const supplied = Buffer.from(code);
  if (!expected.length || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  const role = String(account.role || "broker").toLowerCase();
  if (!["broker","shipper"].includes(role)) return null;
  const type = String(account.account_type || "").toLowerCase();
  const sub = String(account.subscription_status || "").toLowerCase();
  const status = String(account.status || "active").toLowerCase();
  if (status !== "active") return null;
  if (requireSubscription && type !== "internal" && sub !== "internal" &&
    !["beta_active","trial_active","paid_active","active","trialing"].includes(sub)) return null;
  return String(account.business_email).trim().toLowerCase();
}
