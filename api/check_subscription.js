import { requireBroker } from "./_broker_auth.js";
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

function normalizeStatus(v) {
  return String(v || "").trim().toLowerCase();
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });
    const email = await requireBroker(req, supabase, { requireSubscription: false });
    if (!email) return json(res, 401, { ok: false, error: "Broker sign-in required." });

    const { data, error } = await supabase
      .from("broker_accounts")
      .select(
        "business_email, account_type, subscription_status, status, plan_name, monthly_verification_limit, stripe_subscription_id, billing_started_at"
      )
      .eq("business_email", email)
      .maybeSingle();

    if (error) {
      return json(res, 500, {
        ok: false,
        error: error.message || "Subscription lookup failed."
      });
    }

    if (!data) {
      return json(res, 404, {
        ok: false,
        error: "Broker account not found.",
        searched_email: email
      });
    }

    const accountType = normalizeStatus(data.account_type);
    const subscriptionStatus = normalizeStatus(data.subscription_status);
    const accountStatus = normalizeStatus(data.status);

    const isActiveAccount = accountStatus === "active";
    const isInternal =
      accountType === "internal" || subscriptionStatus === "internal";

    const isPaid =
      ["paid_active", "active", "trialing", "beta_active", "trial_active"].includes(subscriptionStatus);

    const allowed = isActiveAccount && (isInternal || isPaid);

    return json(res, 200, {
      ok: true,
      allowed,
      business_email: data.business_email,
      account_type: accountType,
      subscription_status: subscriptionStatus,
      status: accountStatus,
      plan_name: data.plan_name || "",
      monthly_verification_limit: data.monthly_verification_limit || null,
      stripe_subscription_id: data.stripe_subscription_id || "",
      billing_started_at: data.billing_started_at || "",
      debug: {
        is_active_account: isActiveAccount,
        is_internal: isInternal,
        is_paid: isPaid
      }
    });
  } catch (err) {
    return json(res, 500, {
      ok: false,
      error: err?.message || "Server error."
    });
  }
}
