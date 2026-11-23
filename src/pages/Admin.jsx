import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Header from "../components/Header.jsx";
import { getAuthEmail, isBrokerOrShipper } from "../utils/auth.js";

function safeStr(v) {
  return String(v ?? "").trim();
}

function fmtDate(v) {
  if (!v) return "";

  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  } catch {
    return String(v);
  }
}

function maskKey(k) {
  const s = safeStr(k);
  if (!s) return "";
  if (s.length <= 6) return "••••••";
  return `${s.slice(0, 3)}••••••${s.slice(-3)}`;
}

function onlyDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

function prettyPlan(v) {
  const raw = safeStr(v).toLowerCase();
  if (!raw || raw === "none") return "Not Selected";
  if (raw === "founding_beta") return "Founding Beta";
  return raw
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function prettyStatus(v) {
  const raw = safeStr(v).toLowerCase();
  if (!raw) return "Unknown";
  if (raw === "paid_active") return "Paid Active";
  if (raw === "beta_active") return "Beta Active";
  if (raw === "trial_active") return "Trial Active";
  return raw
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

async function safeCopy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function Admin() {
  const nav = useNavigate();

  const email = useMemo(() => safeStr(getAuthEmail()).toLowerCase(), []);
  const authorized = useMemo(
    () => !!email && isBrokerOrShipper(email),
    [email]
  );

  useEffect(() => {
    if (!authorized) nav("/login", { replace: true });
  }, [authorized, nav]);

  const [adminKey, setAdminKey] = useState(() => {
    try {
      return safeStr(sessionStorage.getItem("qc_admin_key"));
    } catch {
      return "";
    }
  });

  const [showAdminKey, setShowAdminKey] = useState(false);
  const [mode, setMode] = useState("pending");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(null);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [manageEmail, setManageEmail] = useState("");
  const [bonusCredits, setBonusCredits] = useState("");
  const [bonusReason, setBonusReason] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const offset = page * pageSize;
  const canLoad = !!safeStr(adminKey);

  function saveAdminKey(next) {
    setAdminKey(next);

    try {
      sessionStorage.setItem("qc_admin_key", next);
    } catch {}
  }

  async function loadList() {
    setErrorMsg("");
    setStatusMsg("");
    setLoading(true);

    try {
      const qs = new URLSearchParams();
      qs.set("status", mode);
      qs.set("limit", String(pageSize));
      qs.set("offset", String(offset));

      const res = await fetch(`/api/admin_beta_requests?${qs.toString()}`, {
        headers: {
          "x-adbs-admin-key": adminKey || ""
        }
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setRows([]);
        setTotal(null);
        setErrorMsg(
          data?.error ||
            data?.message ||
            `Admin list failed (${res.status}).`
        );
        setLoading(false);
        return;
      }

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(Number.isFinite(data?.total) ? data.total : null);
      setLoading(false);
    } catch {
      setRows([]);
      setTotal(null);
      setLoading(false);
      setErrorMsg("Network error loading beta requests.");
    }
  }

  useEffect(() => {
    if (!safeStr(adminKey)) return;
    loadList();
  }, [mode, pageSize, page]);

  async function approveRow(rowId) {
    if (!rowId) return;

    setErrorMsg("");
    setStatusMsg("");
    setBusyId(rowId);

    try {
      const res = await fetch("/api/admin_beta_approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-adbs-admin-key": adminKey || ""
        },
        body: JSON.stringify({ id: rowId })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setBusyId("");
        setErrorMsg(
          data?.detail ||
            data?.error ||
            data?.message ||
            `Approve failed (${res.status}).`
        );
        return;
      }

      setStatusMsg(
        `Approved. Access code: ${data.access_code || "(none returned)"}${
          data.email_status ? ` | Approval Email: ${data.email_status}` : ""
        }${data.email_error ? ` | Email Error: ${data.email_error}` : ""}`
      );

      setBusyId("");
      loadList();
    } catch {
      setBusyId("");
      setErrorMsg("Network error approving request.");
    }
  }

  async function resetAccessCode() {
    const e = safeStr(resetEmail).toLowerCase();

    if (!e) {
      setErrorMsg("Enter an email to reset.");
      return;
    }

    setErrorMsg("");
    setStatusMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin_reset_access_code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-adbs-admin-key": adminKey || ""
        },
        body: JSON.stringify({ email: e })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setLoading(false);
        setErrorMsg(
          data?.error || data?.message || `Reset failed (${res.status}).`
        );
        return;
      }

      setLoading(false);
      setStatusMsg(
        `Reset OK. Access code: ${data.access_code || "(none returned)"}`
      );

      setResetEmail("");
      loadList();
    } catch {
      setLoading(false);
      setErrorMsg("Network error resetting access code.");
    }
  }

  async function loadAccountSnapshot() {
    const e = safeStr(manageEmail).toLowerCase();

    if (!e) {
      setErrorMsg("Enter broker email.");
      return;
    }

    setErrorMsg("");
    setStatusMsg("");
    setSnapshot(null);
    setSnapshotLoading(true);

    try {
      const accountRes = await fetch(
        `/api/account_update?email=${encodeURIComponent(e)}`
      );

      const accountData = await accountRes.json().catch(() => ({}));

      if (!accountRes.ok || !accountData?.ok) {
        setSnapshotLoading(false);
        setErrorMsg(accountData?.error || "Could not load broker account.");
        return;
      }

      const account = accountData.account || {};
      const limit = Number(account.monthly_verification_limit || 0);
      const bonus = Number(account.bonus_verifications || 0);

      let used = 0;

      try {
        const totalsRes = await fetch(
          `/api/dashboard_totals?email=${encodeURIComponent(e)}`,
          { headers: { "x-adbs-admin-key": adminKey || "" } }
        );

        const totalsData = await totalsRes.json().catch(() => ({}));

        if (totalsRes.ok && totalsData?.ok) {
          used = Number(totalsData.this_month_verifications || 0);
        }
      } catch {}

      const totalAvailable = limit + bonus;
      const remaining = Math.max(totalAvailable - used, 0);

      setSnapshot({
        ...account,
        monthly_verification_limit: limit,
        bonus_verifications: bonus,
        used_this_month: used,
        total_available: totalAvailable,
        remaining_verifications: remaining
      });

      setSnapshotLoading(false);
      setStatusMsg(`Account snapshot loaded for ${e}.`);
    } catch {
      setSnapshotLoading(false);
      setErrorMsg("Network error loading account snapshot.");
    }
  }

  async function manageBrokerAccount(action) {
    const e = safeStr(manageEmail).toLowerCase();

    if (!e) {
      setErrorMsg("Enter broker email.");
      return;
    }

    setErrorMsg("");
    setStatusMsg("");
    setLoading(true);

    try {
      const body = {
        email: e,
        action
      };

      if (action === "grant_bonus_verifications") {
        const credits = Number(onlyDigits(bonusCredits));

        if (!credits || credits <= 0) {
          setLoading(false);
          setErrorMsg("Enter courtesy credits greater than 0.");
          return;
        }

        body.bonus_verifications = credits;
        body.bonus_reason = safeStr(bonusReason) || "Courtesy credit";
      }

      const res = await fetch("/api/admin_manage_broker_account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-adbs-admin-key": adminKey || ""
        },
        body: JSON.stringify(body)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setLoading(false);
        setErrorMsg(
          data?.error ||
            data?.message ||
            `Broker account update failed (${res.status}).`
        );
        return;
      }

      setLoading(false);

      if (action === "grant_bonus_verifications") {
        setStatusMsg(
          `Courtesy credits granted: ${
            data?.account?.bonus_verifications ?? bonusCredits
          } for ${data?.account?.business_email || e}`
        );
      } else if (action === "clear_bonus_verifications") {
        setStatusMsg(`Courtesy credits cleared for ${e}.`);
      } else {
        setStatusMsg(
          `Broker account updated: ${
            data?.account?.subscription_status || action
          }`
        );
      }

      if (
        action === "grant_bonus_verifications" ||
        action === "clear_bonus_verifications"
      ) {
        setBonusCredits("");
        setBonusReason("");
      }

      await loadAccountSnapshot();
      loadList();
    } catch {
      setLoading(false);
      setErrorMsg("Network error updating broker account.");
    }
  }

  const styles = {
    page: {
      minHeight: "100vh",
      background:
        "linear-gradient(180deg, #070b11 0%, #0d1522 48%, #111d2c 100%)",
      color: "#e6edf5"
    },
    wrap: {
      maxWidth: 1200,
      margin: "0 auto",
      padding: "18px 16px 48px"
    },
    card: {
      border: "1px solid rgba(255,255,255,0.12)",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.065), rgba(255,255,255,0.035))",
      borderRadius: 20,
      padding: 20,
      boxShadow: "0 18px 44px rgba(0,0,0,0.36)"
    },
    title: {
      fontSize: 30,
      fontWeight: 950,
      margin: 0
    },
    sub: {
      opacity: 0.82,
      marginTop: 6,
      fontSize: 14,
      lineHeight: 1.5
    },
    input: {
      width: "100%",
      padding: 13,
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.18)",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.045))",
      color: "#fff",
      fontSize: 15,
      outline: "none",
      boxSizing: "border-box"
    },
    button: (primary) => ({
      padding: "11px 14px",
      borderRadius: 14,
      border: primary
        ? "1px solid rgba(120,180,255,0.55)"
        : "1px solid rgba(255,255,255,0.14)",
      background: primary
        ? "linear-gradient(180deg, rgba(52,120,205,0.72), rgba(26,72,130,0.86))"
        : "rgba(255,255,255,0.06)",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }),
    dangerButton: {
      padding: "11px 14px",
      borderRadius: 14,
      border: "1px solid rgba(255,120,120,0.35)",
      background: "rgba(150,40,40,0.22)",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
      whiteSpace: "nowrap"
    },
    pill: (active) => ({
      padding: "10px 14px",
      borderRadius: 999,
      border: active
        ? "1px solid rgba(120,180,255,0.55)"
        : "1px solid rgba(255,255,255,0.14)",
      background: active ? "rgba(40,110,190,0.25)" : "rgba(255,255,255,0.05)",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer"
    }),
    tableWrap: {
      marginTop: 16,
      overflowX: "auto",
      WebkitOverflowScrolling: "touch",
      borderRadius: 16
    },
    table: {
      width: "100%",
      minWidth: 980,
      borderCollapse: "separate",
      borderSpacing: 0,
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 16,
      overflow: "hidden"
    },
    th: {
      textAlign: "left",
      fontSize: 12,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      padding: "13px 12px",
      background: "rgba(0,0,0,0.24)",
      borderBottom: "1px solid rgba(255,255,255,0.10)",
      whiteSpace: "nowrap"
    },
    td: {
      padding: "13px 12px",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      verticalAlign: "top",
      fontSize: 14,
      lineHeight: 1.45,
      whiteSpace: "nowrap"
    },
    muted: {
      opacity: 0.72,
      fontSize: 12
    },
    miniTitle: {
      marginBottom: 8,
      fontSize: 13,
      fontWeight: 900,
      color: "#8fc7ff",
      letterSpacing: 0.4
    },
    divider: {
      height: 1,
      background: "rgba(255,255,255,0.10)",
      margin: "16px 0"
    },
    snapshotBox: {
      marginTop: 14,
      padding: 14,
      borderRadius: 16,
      border: "1px solid rgba(120,180,255,0.24)",
      background: "rgba(120,180,255,0.07)"
    },
    snapshotGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))",
      gap: 10,
      marginTop: 10
    },
    snapshotItem: {
      padding: 12,
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(3,9,18,0.28)"
    },
    snapshotLabel: {
      fontSize: 11,
      fontWeight: 900,
      color: "#8fc7ff",
      textTransform: "uppercase",
      marginBottom: 6
    },
    snapshotValue: {
      fontSize: 15,
      fontWeight: 900,
      wordBreak: "break-word"
    }
  };

  return (
    <div style={styles.page}>
      <Header />

      <div style={styles.wrap}>
        <div style={styles.card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap"
            }}
          >
            <div>
              <div style={styles.title}>Admin</div>
              <div style={styles.sub}>
                Beta approvals + access codes.
                <br />
                Signed in as <b>{email}</b>.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button style={styles.button(false)} onClick={() => nav("/dashboard")}>
                Control Center
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
              gap: 16,
              marginTop: 18
            }}
          >
            <div>
              <div style={styles.miniTitle}>Admin Key</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                <input
                  style={styles.input}
                  value={adminKey}
                  onChange={(e) => saveAdminKey(e.target.value)}
                  placeholder="Enter ADBS_ADMIN_KEY"
                  type={showAdminKey ? "text" : "password"}
                  autoComplete="off"
                />

                <button type="button" style={styles.button(false)} onClick={() => setShowAdminKey((v) => !v)}>
                  {showAdminKey ? "Hide" : "Show"}
                </button>
              </div>

              <div style={styles.muted}>
                Saved in this tab only. Current: {adminKey ? maskKey(adminKey) : "(none)"}.
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <button
                  style={styles.button(true)}
                  onClick={() => {
                    setPage(0);
                    loadList();
                  }}
                  disabled={!canLoad || loading}
                >
                  {loading ? "Loading..." : "Load / Refresh"}
                </button>

                <button
                  style={styles.button(false)}
                  onClick={() => {
                    saveAdminKey("");
                    setRows([]);
                    setTotal(null);
                    setStatusMsg("Admin key cleared.");
                    setErrorMsg("");
                  }}
                >
                  Clear Key
                </button>
              </div>
            </div>

            <div>
              <div style={styles.miniTitle}>Reset Access Code</div>

              <input
                style={styles.input}
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="email@company.com"
                inputMode="email"
                autoComplete="off"
              />

              <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <button style={styles.button(true)} onClick={resetAccessCode} disabled={!canLoad || loading}>
                  Reset Code
                </button>

                <button
                  style={styles.button(false)}
                  onClick={async () => {
                    const ok = await safeCopy(safeStr(resetEmail));
                    setStatusMsg(ok ? "Email copied." : "Copy failed.");
                  }}
                >
                  Copy Email
                </button>
              </div>
            </div>

            <div>
              <div style={styles.miniTitle}>Manage Broker Account</div>

              <input
                style={styles.input}
                value={manageEmail}
                onChange={(e) => setManageEmail(e.target.value)}
                placeholder="broker@company.com"
                inputMode="email"
                autoComplete="off"
              />

              <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <button style={styles.button(true)} onClick={loadAccountSnapshot} disabled={!canLoad || snapshotLoading}>
                  {snapshotLoading ? "Loading..." : "View Account"}
                </button>

                <button style={styles.button(true)} onClick={() => manageBrokerAccount("set_internal")} disabled={!canLoad || loading}>
                  Set Internal
                </button>

                <button style={styles.button(false)} onClick={() => manageBrokerAccount("set_beta_active")} disabled={!canLoad || loading}>
                  Reactivate Beta
                </button>

                <button style={styles.button(false)} onClick={() => manageBrokerAccount("set_suspended")} disabled={!canLoad || loading}>
                  Suspend
                </button>

                <button style={styles.button(false)} onClick={() => manageBrokerAccount("set_canceled")} disabled={!canLoad || loading}>
                  Cancel
                </button>
              </div>

              {snapshot ? (
                <div style={styles.snapshotBox}>
                  <div style={styles.miniTitle}>Broker Account Snapshot</div>

                  <div style={styles.snapshotGrid}>
                    <div style={styles.snapshotItem}>
                      <div style={styles.snapshotLabel}>Company</div>
                      <div style={styles.snapshotValue}>{snapshot.company_name || "—"}</div>
                    </div>

                    <div style={styles.snapshotItem}>
                      <div style={styles.snapshotLabel}>Status</div>
                      <div style={styles.snapshotValue}>{prettyStatus(snapshot.subscription_status)}</div>
                    </div>

                    <div style={styles.snapshotItem}>
                      <div style={styles.snapshotLabel}>Plan</div>
                      <div style={styles.snapshotValue}>{prettyPlan(snapshot.plan_name)}</div>
                    </div>

                    <div style={styles.snapshotItem}>
                      <div style={styles.snapshotLabel}>Monthly Limit</div>
                      <div style={styles.snapshotValue}>{Number(snapshot.monthly_verification_limit || 0).toLocaleString()}</div>
                    </div>

                    <div style={styles.snapshotItem}>
                      <div style={styles.snapshotLabel}>Courtesy Credits</div>
                      <div style={styles.snapshotValue}>{Number(snapshot.bonus_verifications || 0).toLocaleString()}</div>
                    </div>

                    <div style={styles.snapshotItem}>
                      <div style={styles.snapshotLabel}>Total Available</div>
                      <div style={styles.snapshotValue}>{Number(snapshot.total_available || 0).toLocaleString()}</div>
                    </div>

                    <div style={styles.snapshotItem}>
                      <div style={styles.snapshotLabel}>Used This Month</div>
                      <div style={styles.snapshotValue}>{Number(snapshot.used_this_month || 0).toLocaleString()}</div>
                    </div>

                    <div style={styles.snapshotItem}>
                      <div style={styles.snapshotLabel}>Remaining</div>
                      <div style={styles.snapshotValue}>{Number(snapshot.remaining_verifications || 0).toLocaleString()}</div>
                    </div>

                    <div style={styles.snapshotItem}>
                      <div style={styles.snapshotLabel}>Stripe Customer</div>
                      <div style={styles.snapshotValue}>{snapshot.stripe_customer_id || "—"}</div>
                    </div>

                    <div style={styles.snapshotItem}>
                      <div style={styles.snapshotLabel}>Subscription</div>
                      <div style={styles.snapshotValue}>{snapshot.stripe_subscription_id || "—"}</div>
                    </div>
                  </div>

                  {snapshot.bonus_reason ? (
                    <div style={{ marginTop: 10, ...styles.muted }}>
                      Credit note: {snapshot.bonus_reason}
                      {snapshot.bonus_granted_at ? ` | Granted: ${fmtDate(snapshot.bonus_granted_at)}` : ""}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div style={styles.divider} />

              <div style={styles.miniTitle}>Courtesy Credits</div>

              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
                <input
                  style={styles.input}
                  value={bonusCredits}
                  onChange={(e) => setBonusCredits(onlyDigits(e.target.value))}
                  placeholder="25"
                  inputMode="numeric"
                />

                <input
                  style={styles.input}
                  value={bonusReason}
                  onChange={(e) => setBonusReason(e.target.value)}
                  placeholder="Reason, example: Service recovery"
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <button
                  style={styles.button(true)}
                  onClick={() => manageBrokerAccount("grant_bonus_verifications")}
                  disabled={!canLoad || loading}
                >
                  Grant Credits
                </button>

                <button
                  style={styles.dangerButton}
                  onClick={() => manageBrokerAccount("clear_bonus_verifications")}
                  disabled={!canLoad || loading}
                >
                  Clear Credits
                </button>
              </div>

              <div style={{ ...styles.muted, marginTop: 8 }}>
                Courtesy credits add extra verifications without changing Stripe billing.
              </div>
            </div>
          </div>

          {errorMsg ? (
            <div
              style={{
                marginTop: 14,
                border: "1px solid rgba(255,80,80,0.35)",
                background: "rgba(255,80,80,0.08)",
                padding: 12,
                borderRadius: 14,
                fontSize: 14
              }}
            >
              <b>Error:</b> {errorMsg}
            </div>
          ) : null}

          {statusMsg ? (
            <div
              style={{
                marginTop: 14,
                border: "1px solid rgba(120,180,255,0.30)",
                background: "rgba(120,180,255,0.08)",
                padding: 12,
                borderRadius: 14,
                fontSize: 14
              }}
            >
              {statusMsg}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18, alignItems: "center" }}>
            <button
              style={styles.pill(mode === "pending")}
              onClick={() => {
                setMode("pending");
                setPage(0);
              }}
            >
              Pending
            </button>

            <button
              style={styles.pill(mode === "approved")}
              onClick={() => {
                setMode("approved");
                setPage(0);
              }}
            >
              Approved
            </button>

            <button
              style={styles.pill(mode === "all")}
              onClick={() => {
                setMode("all");
                setPage(0);
              }}
            >
              All
            </button>

            <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={styles.muted}>{total === null ? "Total: —" : `Total: ${total}`}</div>

              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value) || 25);
                  setPage(0);
                }}
                style={{ ...styles.input, width: 120, padding: "10px 10px", fontSize: 13 }}
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>

              <button style={styles.button(false)} onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                Prev
              </button>

              <button
                style={styles.button(false)}
                onClick={() => setPage((p) => p + 1)}
                disabled={total !== null ? offset + pageSize >= total : false}
              >
                Next
              </button>
            </div>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Created</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Name / Business</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>MC# / DOT</th>
                  <th style={styles.th}>Phone</th>
                  <th style={styles.th}>Access Code</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td style={{ ...styles.td, opacity: 0.75 }} colSpan={8}>
                      {canLoad ? "No rows found for this filter." : "Enter Admin Key and click Load / Refresh."}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const id = safeStr(r.id);
                    const created = fmtDate(r.created_at);
                    const rEmail = safeStr(r.email || r.business_email || r.contact_email);
                    const name = safeStr(r.legal_business_name || r.legal_name || r.name || r.business_name);
                    const role = safeStr(r.role);
                    const mc = safeStr(r.mc_number || r.mc || r.mc_num);
                    const dot = safeStr(r.usdot || r.usdot_number || r.usdot_on_record);
                    const phone = safeStr(r.business_phone || r.phone);
                    const code = safeStr(r.access_code);

                    const approved =
                      r.approved === true ||
                      safeStr(r.status).toLowerCase() === "approved";

                    return (
                      <tr key={id || created}>
                        <td style={styles.td}>
                          <div>{created}</div>
                          <div style={styles.muted}>id: {id || "(none)"}</div>
                        </td>

                        <td style={styles.td}>
                          <div style={{ fontWeight: 900 }}>{rEmail || "(missing)"}</div>
                        </td>

                        <td style={styles.td}>
                          <div style={{ fontWeight: 900 }}>{name || "(missing)"}</div>
                          {r.contact_name ? <div style={styles.muted}>Contact: {safeStr(r.contact_name)}</div> : null}
                        </td>

                        <td style={styles.td}>{role || "—"}</td>

                        <td style={styles.td}>
                          <div>{mc ? `MC#: ${mc}` : "MC#: —"}</div>
                          <div>{dot ? `USDOT: ${dot}` : "USDOT: —"}</div>
                        </td>

                        <td style={styles.td}>{phone || "—"}</td>

                        <td style={styles.td}>
                          <div style={{ fontWeight: 900 }}>{code || "—"}</div>
                          <div style={styles.muted}>{approved ? "approved" : "pending"}</div>
                        </td>

                        <td style={styles.td}>
                          <div style={{ display: "grid", gap: 8 }}>
                            {!approved ? (
                              <button
                                style={styles.button(true)}
                                onClick={() => approveRow(id)}
                                disabled={!canLoad || busyId === id}
                              >
                                {busyId === id ? "Approving..." : "Approve"}
                              </button>
                            ) : (
                              <button
                                style={styles.button(false)}
                                onClick={async () => {
                                  const ok = await safeCopy(code || "");
                                  setStatusMsg(ok ? "Access code copied." : "Copy failed.");
                                }}
                                disabled={!code}
                              >
                                Copy Code
                              </button>
                            )}

                            <button
                              style={styles.button(false)}
                              onClick={async () => {
                                const ok = await safeCopy(rEmail || "");
                                setStatusMsg(ok ? "Email copied." : "Copy failed.");
                              }}
                              disabled={!rEmail}
                            >
                              Copy Email
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <div style={{ marginTop: 10, ...styles.muted }}>
              Tip: Swipe horizontally on smaller screens.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
