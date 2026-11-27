import React, { useEffect, useState } from "react";
import Header from "../components/Header.jsx";
import { getAuthEmail, getAuthCode } from "../utils/auth.js";

function clean(v) {
  return String(v || "").trim();
}

function prettyPlan(v) {
  const raw = clean(v).toLowerCase();

  if (!raw || raw === "none") return "Not selected";
  if (raw === "founding_beta") return "Founding Beta";

  return raw
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function prettyStatus(v) {
  const raw = clean(v).toLowerCase();

  if (!raw || raw === "not_started") return "Not Started";
  if (raw === "active") return "Active";
  if (raw === "paid_active") return "Paid Active";
  if (raw === "beta_active") return "Beta Active";
  if (raw === "trialing") return "Trialing";
  if (raw === "trial_active") return "Trial Active";
  if (raw === "past_due") return "Past Due";
  if (raw === "canceled") return "Canceled";
  if (raw === "suspended") return "Suspended";
  if (raw === "unpaid") return "Unpaid";
  if (raw === "incomplete") return "Incomplete";
  if (raw === "incomplete_expired") return "Incomplete Expired";

  return raw
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fmtDate(v) {
  if (!v) return "";

  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  } catch {
    return "";
  }
}

export default function Account() {
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");

  const [planName, setPlanName] = useState("none");
  const [subscriptionStatus, setSubscriptionStatus] = useState("not_started");
  const [monthlyLimit, setMonthlyLimit] = useState(0);
  const [bonusCredits, setBonusCredits] = useState(0);
  const [bonusReason, setBonusReason] = useState("");
  const [bonusGrantedAt, setBonusGrantedAt] = useState("");
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [usedThisMonth, setUsedThisMonth] = useState(0);
  const [remainingThisMonth, setRemainingThisMonth] = useState(0);

  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(true);

  useEffect(() => {
    const current = getAuthEmail() || "";

    setEmail(current);
    setNewEmail(current);

    if (current) {
      loadAccount(current);
    } else {
      setLoadingAccount(false);
    }
  }, []);

  function onlyDigits(v) {
    return String(v || "").replace(/\D+/g, "");
  }

  function formatPhone(v) {
    const d = onlyDigits(v).slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  }

  async function loadUsage(accountEmail, limitValue, bonusValue) {
    try {
      const res = await fetch(
        `/api/dashboard_totals`,
        { headers: { "x-adbs-broker-email": getAuthEmail(), "x-adbs-broker-code": getAuthCode() } }
      );

      const data = await res.json().catch(() => ({}));
      const limit = Number(limitValue || 0);
      const bonus = Number(bonusValue || 0);
      const available = limit + bonus;

      if (!res.ok || !data?.ok) {
        setUsedThisMonth(0);
        setTotalAvailable(available);
        setRemainingThisMonth(available);
        return;
      }

      const used = Number(data.this_month_verifications || 0);

      setUsedThisMonth(used);
      setTotalAvailable(available);
      setRemainingThisMonth(Math.max(available - used, 0));
    } catch {
      const available = Number(limitValue || 0) + Number(bonusValue || 0);

      setUsedThisMonth(0);
      setTotalAvailable(available);
      setRemainingThisMonth(available);
    }
  }

  async function loadAccount(accountEmail) {
    setLoadingAccount(true);
    setStatus("");

    try {
      const res = await fetch(
        `/api/account_update?email=${encodeURIComponent(accountEmail)}`,
        { headers: { "x-adbs-broker-email": getAuthEmail(), "x-adbs-broker-code": getAuthCode() } }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setStatus(data?.error || "Could not load account status.");
        setLoadingAccount(false);
        return;
      }

      const account = data.account || {};
      const loadedEmail = account.business_email || accountEmail;
      const loadedLimit = Number(account.monthly_verification_limit || 0);
      const loadedBonus = Number(account.bonus_verifications || 0);

      setEmail(loadedEmail);
      setNewEmail(loadedEmail);
      setPhone(account.business_phone || "");
      setContactName(account.contact_name || "");
      setPlanName(account.plan_name || "none");
      setSubscriptionStatus(account.subscription_status || "not_started");
      setMonthlyLimit(loadedLimit);
      setBonusCredits(loadedBonus);
      setBonusReason(account.bonus_reason || "");
      setBonusGrantedAt(account.bonus_granted_at || "");

      await loadUsage(loadedEmail, loadedLimit, loadedBonus);

      setLoadingAccount(false);
    } catch {
      setStatus("Network error loading account.");
      setLoadingAccount(false);
    }
  }

  async function saveAccount() {
    setStatus("");

    if (!newEmail.trim()) {
      setStatus("Enter your business email.");
      return;
    }

    if (!contactName.trim()) {
      setStatus("Enter your contact name.");
      return;
    }

    if (onlyDigits(phone).length !== 10) {
      setStatus("Enter your business phone.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/account_update", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-adbs-broker-email": getAuthEmail(), "x-adbs-broker-code": getAuthCode() },
        body: JSON.stringify({
          current_email: email,
          business_email: newEmail,
          email: newEmail,
          contact_name: contactName,
          business_phone: phone
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setStatus(data.error || "Update failed.");
        setSaving(false);
        return;
      }

      const account = data.account || {};
      const updatedEmail = account.business_email || newEmail.trim().toLowerCase();
      const updatedLimit = Number(
        account.monthly_verification_limit ?? monthlyLimit ?? 0
      );
      const updatedBonus = Number(
        account.bonus_verifications ?? bonusCredits ?? 0
      );

      localStorage.setItem("qc_email", updatedEmail);
      setEmail(updatedEmail);
      setNewEmail(updatedEmail);
      setPhone(account.business_phone || phone);
      setContactName(account.contact_name || contactName);
      setPlanName(account.plan_name || planName);
      setSubscriptionStatus(account.subscription_status || subscriptionStatus);
      setMonthlyLimit(updatedLimit);
      setBonusCredits(updatedBonus);
      setBonusReason(account.bonus_reason || bonusReason);
      setBonusGrantedAt(account.bonus_granted_at || bonusGrantedAt);

      await loadUsage(updatedEmail, updatedLimit, updatedBonus);

      setStatus("Account updated successfully.");
    } catch {
      setStatus("Network error.");
    }

    setSaving(false);
  }

  async function manageBilling() {
    setStatus("");
    setBillingLoading(true);

    try {
      const res = await fetch("/api/create_billing_portal_session", {
        method: "POST",
        headers: { "x-adbs-broker-email": getAuthEmail(), "x-adbs-broker-code": getAuthCode() }
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok || !data.url) {
        setStatus(data.error || "Could not open billing portal.");
        setBillingLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setStatus("Billing portal error.");
      setBillingLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <Header />

      <div style={styles.hero}>
        <img src="/qc-logo.png" alt="QueCab AdbS" style={styles.logo} />

        <div style={styles.heroTitle}>ACCOUNT</div>

        <div style={styles.heroSub}>
          View your broker status, subscription details, and account settings.
        </div>
      </div>

      <div style={styles.wrap}>
        <div style={styles.statusCard}>
          <div style={styles.cardHeader}>Account Status</div>

          {loadingAccount ? (
            <div style={styles.loadingText}>Loading account status...</div>
          ) : (
            <div style={styles.statusGrid}>
              <div style={styles.statusItem}>
                <div style={styles.statusLabel}>Business Email</div>
                <div style={styles.statusValue}>{email || "Not available"}</div>
              </div>

              <div style={styles.statusItem}>
                <div style={styles.statusLabel}>Subscription Status</div>
                <div
                  style={{
                    ...styles.statusValue,
                    ...(subscriptionStatus === "active" ||
                    subscriptionStatus === "paid_active" ||
                    subscriptionStatus === "beta_active" ||
                    subscriptionStatus === "internal"
                      ? styles.goodStatus
                      : styles.warningStatus)
                  }}
                >
                  {prettyStatus(subscriptionStatus)}
                </div>
              </div>

              <div style={styles.statusItem}>
                <div style={styles.statusLabel}>Current Plan</div>
                <div style={styles.statusValue}>{prettyPlan(planName)}</div>
              </div>

              <div style={styles.statusItem}>
                <div style={styles.statusLabel}>Monthly Verification Limit</div>
                <div style={styles.statusValue}>
                  {monthlyLimit > 0 ? monthlyLimit.toLocaleString() : "Not active"}
                </div>
              </div>

              <div style={styles.statusItem}>
                <div style={styles.statusLabel}>Courtesy Credits</div>
                <div style={styles.statusValue}>
                  {bonusCredits.toLocaleString()}
                </div>
              </div>

              <div style={styles.statusItem}>
                <div style={styles.statusLabel}>Total Available</div>
                <div style={{ ...styles.statusValue, ...styles.goodStatus }}>
                  {totalAvailable.toLocaleString()}
                </div>
              </div>

              <div style={styles.statusItem}>
                <div style={styles.statusLabel}>Used This Month</div>
                <div style={styles.statusValue}>
                  {usedThisMonth.toLocaleString()}
                </div>
              </div>

              <div style={styles.statusItem}>
                <div style={styles.statusLabel}>Remaining Verifications</div>
                <div style={{ ...styles.statusValue, ...styles.goodStatus }}>
                  {remainingThisMonth.toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {!loadingAccount && bonusCredits > 0 ? (
            <div style={styles.creditNote}>
              <div style={styles.noteTitle}>Courtesy Credit Note</div>
              <div style={styles.noteText}>
                {bonusReason || "Courtesy credits added to this account."}
                {bonusGrantedAt ? ` Granted: ${fmtDate(bonusGrantedAt)}.` : ""}
              </div>
            </div>
          ) : null}
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>Account Settings</div>

          <div style={styles.sectionTitle}>Contact Name</div>

          <input
            style={styles.input}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Contact Name"
          />

          <div style={styles.sectionTitle}>Business Email</div>

          <input
            style={styles.input}
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Business Email"
          />

          <div style={styles.sectionTitle}>Business Phone</div>

          <input
            style={styles.input}
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="Business Phone"
          />

          <button style={styles.button} onClick={saveAccount} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>

          {status ? <div style={styles.status}>{status}</div> : null}
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>Billing</div>

          <div style={styles.noteText}>
            Manage payment method, invoices, and subscription billing securely through Stripe.
          </div>

          <button
            style={styles.button}
            onClick={manageBilling}
            disabled={billingLoading}
          >
            {billingLoading ? "Opening Billing..." : "Manage Billing"}
          </button>
        </div>

        <div style={styles.noteCard}>
          <div style={styles.noteTitle}>Beta Notice</div>

          <div style={styles.noteText}>
            During beta, certain account changes may still require manual review
            to protect broker access and prevent unauthorized modifications.
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #08111b 0%, #0c1724 45%, #0f1d2c 100%)",
    color: "#e6edf5"
  },

  hero: {
    textAlign: "center",
    padding: "60px 20px 30px"
  },

  logo: {
    width: 220,
    maxWidth: "92%",
    marginBottom: 18,
    filter: "drop-shadow(0 8px 22px rgba(0,0,0,0.45))"
  },

  heroTitle: {
    fontSize: 34,
    fontWeight: 900,
    letterSpacing: 1,
    marginBottom: 10
  },

  heroSub: {
    fontSize: 16,
    opacity: 0.82,
    maxWidth: 700,
    margin: "0 auto",
    lineHeight: 1.6
  },

  wrap: {
    maxWidth: 860,
    margin: "0 auto",
    padding: "0 20px 60px",
    display: "grid",
    gap: 18
  },

  statusCard: {
    background:
      "linear-gradient(180deg, rgba(50,125,210,0.13), rgba(255,255,255,0.045))",
    border: "1px solid rgba(120,180,255,0.24)",
    borderRadius: 22,
    padding: 24,
    backdropFilter: "blur(10px)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.34)"
  },

  card: {
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 22,
    padding: 24,
    backdropFilter: "blur(10px)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.34)"
  },

  cardHeader: {
    fontSize: 22,
    fontWeight: 950,
    marginBottom: 18
  },

  statusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14
  },

  statusItem: {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(3,9,18,0.28)",
    borderRadius: 16,
    padding: 16
  },

  statusLabel: {
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1,
    color: "#8fc7ff",
    textTransform: "uppercase",
    marginBottom: 8
  },

  statusValue: {
    fontSize: 18,
    fontWeight: 900,
    wordBreak: "break-word"
  },

  goodStatus: {
    color: "#9fe3b1"
  },

  warningStatus: {
    color: "#ffd27d"
  },

  loadingText: {
    fontSize: 15,
    opacity: 0.78
  },

  noteCard: {
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 20
  },

  creditNote: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    border: "1px solid rgba(120,180,255,0.20)",
    background: "rgba(120,180,255,0.07)"
  },

  noteTitle: {
    fontSize: 18,
    fontWeight: 900,
    marginBottom: 10
  },

  noteText: {
    fontSize: 14,
    opacity: 0.82,
    lineHeight: 1.6
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: 800,
    marginBottom: 8,
    marginTop: 14
  },

  input: {
    width: "100%",
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box"
  },

  button: {
    width: "100%",
    marginTop: 22,
    padding: 15,
    borderRadius: 14,
    border: "1px solid rgba(120,180,255,0.45)",
    background:
      "linear-gradient(180deg, rgba(34,116,255,0.55) 0%, rgba(20,76,170,0.55) 100%)",
    color: "#fff",
    fontSize: 16,
    fontWeight: 900,
    cursor: "pointer"
  },

  status: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: 700,
    color: "#9fe3b1"
  }
};
