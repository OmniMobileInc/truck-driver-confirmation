import { requireBroker } from "./_broker_auth.js";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function lower(v) {
  return String(v || "").toLowerCase();
}

function clean(v) {
  return String(v || "").trim();
}

function normalizeEmail(v) {
  return clean(v).toLowerCase();
}

function isThisMonth(dateValue) {
  if (!dateValue) return false;

  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();

  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    const email = await requireBroker(req, supabase);
    if (!email) return res.status(401).json({ ok: false, error: "Broker sign-in required." });

    let linksQuery = supabase
      .from("verify_links")
      .select("token, status, created_at, issued_by_email");

    linksQuery = linksQuery.ilike("issued_by_email", email);

    const { data: links, error: linksError } = await linksQuery;

    if (linksError) {
      return res.status(500).json({
        ok: false,
        error: linksError.message || "Failed to load verify_links"
      });
    }

    const linkRows = Array.isArray(links) ? links : [];

    const thisMonthLinks = linkRows.filter((x) => isThisMonth(x.created_at));

    const totalVerifications = linkRows.length;
    const thisMonthVerifications = thisMonthLinks.length;

    const revokedLinks = linkRows.filter((x) =>
      lower(x.status).includes("revoked")
    ).length;

    const activeLinks = linkRows.filter((x) =>
      lower(x.status).includes("active")
    ).length;

    const ownedTokens = linkRows.map((x) => x.token).filter(Boolean);
    const { data: checks, error: checksError } = ownedTokens.length
      ? await supabase.from("verify_checks").select("result, created_at, checked_at").in("token", ownedTokens)
      : { data: [], error: null };

    if (checksError) {
      return res.status(500).json({
        ok: false,
        error: checksError.message || "Failed to load verify_checks"
      });
    }

    const checkRows = Array.isArray(checks) ? checks : [];

    const thisMonthChecks = checkRows.filter((x) =>
      isThisMonth(x.checked_at || x.created_at)
    );

    const clearToLoad = checkRows.filter((x) =>
      lower(x.result).includes("clear")
    ).length;

    const cautionAlerts = checkRows.filter((x) =>
      lower(x.result).includes("caution")
    ).length;

    const thisMonthClearToLoad = thisMonthChecks.filter((x) =>
      lower(x.result).includes("clear")
    ).length;

    const thisMonthCautionAlerts = thisMonthChecks.filter((x) =>
      lower(x.result).includes("caution")
    ).length;

    const failedAttempts = cautionAlerts;

    return res.status(200).json({
      ok: true,
      scoped_to_email: email || "",

      total_verifications: totalVerifications,
      this_month_verifications: thisMonthVerifications,

      clear_to_load: clearToLoad,
      caution_alerts: cautionAlerts,

      this_month_clear_to_load: thisMonthClearToLoad,
      this_month_caution_alerts: thisMonthCautionAlerts,

      revoked_links: revokedLinks,
      active_links: activeLinks,
      failed_attempts: failedAttempts
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Server error"
    });
  }
}
