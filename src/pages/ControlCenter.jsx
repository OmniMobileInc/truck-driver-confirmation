import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import Header from "../components/Header.jsx";
import { getAuthEmail, isBrokerOrShipper } from "../utils/auth.js";

function onlyDigits(s) {
  return String(s || "").replace(/\D/g, "");
}

function upper(s) {
  return String(s || "").trim().toUpperCase();
}

function formatPhone(v) {
  const d = onlyDigits(v).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

function buildQrUrl(text) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    text || ""
  )}`;
}

function localNowInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function plus24hInput() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

async function safeCopy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function num(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

export default function ControlCenter() {
  const nav = useNavigate();
  const email = getAuthEmail();
  const authorized = !!email && isBrokerOrShipper(email);

  const loadRef = useRef(null);
  const startAtRef = useRef(null);
  const expireAtRef = useRef(null);

  const [loadId, setLoadId] = useState("");
  const [dockEmail, setDockEmail] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [carrierCompany, setCarrierCompany] = useState("");
  const [carrierContact, setCarrierContact] = useState("");
  const [carrierPhone, setCarrierPhone] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [usdot, setUsdot] = useState("");
  const [plate, setPlate] = useState("");
  const [dockPin, setDockPin] = useState("");

  const [mode, setMode] = useState("auto");
  const [startAt, setStartAt] = useState(localNowInput());
  const [expireAt, setExpireAt] = useState(plus24hInput());

  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState("");

  const [selected, setSelected] = useState(null);
  const [qrUrl, setQrUrl] = useState("");

  const [totals, setTotals] = useState(null);
  const [totalsError, setTotalsError] = useState("");

  useEffect(() => {
    if (!authorized) {
      nav("/login", { replace: true });
      return;
    }

    loadDashboardTotals();

    setTimeout(() => {
      loadRef.current?.focus();
    }, 0);
  }, [authorized, nav]);

  if (!authorized) return null;

  function openDatePicker(ref) {
    try {
      ref.current?.showPicker?.();
    } catch {
      ref.current?.focus();
    }
  }

  async function safeJson(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  async function loadDashboardTotals() {
    setTotalsError("");

    try {
      const res = await fetch("/api/dashboard_totals");
      const data = await safeJson(res);

      if (!res.ok || data?.ok === false) {
        setTotalsError(data?.error || "Could not load dashboard totals.");
        return;
      }

      setTotals(data);
    } catch {
      setTotalsError("Could not load dashboard totals.");
    }
  }

  function handleIssueEnter(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!loading) issueVerification();
  }

  function makeSelected(row) {
    const token = row?.token || row?.verification_id || "";
    const verifyUrl =
      row?.verify_url ||
      `https://quecabadbs.com/v.html?t=${encodeURIComponent(token)}&cv=4`;

    return {
      verification_id: token,
      verify_url: verifyUrl,
      status: row?.status || "active",
      load_id: row?.load_id || "",
      expires_at: row?.expires_at || null,
      dock_email: row?.dock_email || "",
      driver_phone: row?.driver_phone || "",
      usdot_on_record: row?.usdot_on_record || "",
      plate_on_record: row?.plate_on_record || "",
      carrier_company: row?.carrier_company || "",
      carrier_contact_name: row?.dispatch_contact || row?.carrier_contact_name || "",
      carrier_contact_phone: row?.dispatch_phone || row?.carrier_contact_phone || "",
      email_status: row?.email_status || "",
      email_error: row?.email_error || ""
    };
  }

  async function loadVerificationByToken(token) {
    setStatusMsg("");
    setErrorMsg("");

    const res = await fetch("/api/manage_verify_link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "detail", token })
    });

    const data = await safeJson(res);

    if (!res.ok) {
      setErrorMsg(data?.error || "Verification not found.");
      return;
    }

    const next = makeSelected(data);
    setSelected(next);
    setQrUrl(buildQrUrl(next.verify_url));
    setStatusMsg("Verification loaded.");
  }

  async function searchVerification() {
    const q = String(search || "").trim();

    setStatusMsg("");
    setErrorMsg("");
    setMatches([]);

    if (!q) {
      setErrorMsg("Enter a Verification ID, AdbS Verify Link, Load ID, email, phone, DOT, plate, or carrier.");
      return;
    }

    try {
      const res = await fetch("/api/manage_verify_link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lookup", token: q })
      });

      const data = await safeJson(res);

      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.error || "Verification not found.");
        return;
      }

      const rows = Array.isArray(data.rows) ? data.rows : [];

      if (rows.length === 1) {
        await loadVerificationByToken(rows[0].token || rows[0].verification_id);
        return;
      }

      if (rows.length > 1) {
        setMatches(rows);
        setSelected(null);
        setQrUrl("");
        setStatusMsg(`${rows.length} matching records found.`);
        return;
      }

      setErrorMsg("Verification not found.");
    } catch {
      setErrorMsg("Search failed.");
    }
  }

  async function issueVerification() {
    setStatusMsg("");
    setErrorMsg("");
    setMatches([]);

    const payload = {
      issued_by_email: email,
      load_id: loadId.trim(),
      dock_email: dockEmail.trim().toLowerCase(),
      facility_id: facilityId.trim(),
      carrier_company: carrierCompany.trim(),
      dispatch_contact: carrierContact.trim(),
      dispatch_phone: formatPhone(carrierPhone),
      driver_phone: formatPhone(driverPhone),
      usdot_on_record: onlyDigits(usdot),
      plate_on_record: upper(plate),
      dock_pin: onlyDigits(dockPin),
      starts_at: mode === "pick" ? new Date(startAt).toISOString() : new Date().toISOString(),
      expires_at:
        mode === "none"
          ? null
          : mode === "pick"
          ? new Date(expireAt).toISOString()
          : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    if (!payload.usdot_on_record) {
      setErrorMsg("Enter USDOT#");
      return;
    }

    if (!payload.plate_on_record) {
      setErrorMsg("Enter Plate");
      return;
    }

    if (onlyDigits(driverPhone).length !== 10) {
      setErrorMsg("Enter Driver Phone");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/issue_verify_link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await safeJson(res);

      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.error || "Issue failed.");
        setLoading(false);
        return;
      }

      const next = makeSelected({
        token: data.token,
        verify_url: data.verify_url,
        status: data.status,
        load_id: payload.load_id,
        expires_at: data.expires_at,
        dock_email: payload.dock_email,
        driver_phone: payload.driver_phone,
        usdot_on_record: payload.usdot_on_record,
        plate_on_record: payload.plate_on_record,
        carrier_company: payload.carrier_company,
        dispatch_contact: payload.dispatch_contact,
        dispatch_phone: payload.dispatch_phone,
        email_status: data.email_status,
        email_error: data.email_error
      });

      setSelected(next);
      setQrUrl(buildQrUrl(next.verify_url));
      setStatusMsg("AdbS Verification issued");

      setLoadId("");
      setDockEmail("");
      setFacilityId("");
      setCarrierCompany("");
      setCarrierContact("");
      setCarrierPhone("");
      setDriverPhone("");
      setUsdot("");
      setPlate("");
      setDockPin("");

      loadDashboardTotals();
      loadRef.current?.focus();
    } catch {
      setErrorMsg("Network error.");
    }

    setLoading(false);
  }

  async function setVerificationStatus(nextStatus) {
    if (!selected?.verification_id) return;

    setStatusMsg("");
    setErrorMsg("");
    setStatusLoading(nextStatus);

    try {
      const res = await fetch("/api/manage_verify_link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_status",
          token: selected.verification_id,
          status: nextStatus
        })
      });

      const data = await safeJson(res);

      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.error || "Status update failed.");
        setStatusLoading("");
        return;
      }

      setSelected((prev) => ({
        ...prev,
        status: data.status || nextStatus
      }));

      setStatusMsg(nextStatus === "revoked" ? "Verification revoked." : "Verification reactivated.");
      loadDashboardTotals();
    } catch {
      setErrorMsg("Status update failed.");
    }

    setStatusLoading("");
  }

  const styles = {
    page: { minHeight: "100vh", background: "#0c121c", color: "#e6edf5" },
    wrap: { maxWidth: 1120, margin: "0 auto", padding: "18px 16px 48px" },
    logoWrap: { display: "flex", justifyContent: "center", marginTop: 90, marginBottom: 10 },
    logo: { width: 220, maxWidth: "90%" },
    title: { fontSize: 30, fontWeight: 900, marginBottom: 18 },
    card: {
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: 18,
      padding: 18,
      boxShadow: "0 12px 28px rgba(0,0,0,0.28)"
    },
    sectionTitle: { fontSize: 20, fontWeight: 900, marginBottom: 12 },
    metricGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: 12
    },
    metricCard: {
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.045)",
      borderRadius: 16,
      padding: 14
    },
    metricNumber: {
      fontSize: 26,
      fontWeight: 900,
      color: "#ffffff"
    },
    metricLabel: {
      marginTop: 6,
      fontSize: 13,
      lineHeight: 1.35,
      color: "#cdd8e8",
      fontWeight: 800
    },
    input: {
      width: "100%",
      padding: 13,
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.24)",
      background: "rgba(255,255,255,0.06)",
      color: "#fff",
      fontSize: 16,
      boxSizing: "border-box",
      outline: "none"
    },
    dateInput: {
      width: "100%",
      padding: 13,
      borderRadius: 12,
      border: "1px solid rgba(120,180,255,0.40)",
      background: "rgba(255,255,255,0.06)",
      color: "#fff",
      fontSize: 16,
      boxSizing: "border-box",
      outline: "none",
      cursor: "pointer"
    },
    linkBox: {
      display: "block",
      width: "100%",
      padding: 13,
      borderRadius: 12,
      border: "1px solid rgba(120,180,255,0.45)",
      background: "rgba(40,110,190,0.16)",
      color: "#8fc7ff",
      fontSize: 15,
      fontWeight: 900,
      boxSizing: "border-box",
      textDecoration: "none",
      wordBreak: "break-all"
    },
    primaryBtn: {
      width: "100%",
      padding: 13,
      borderRadius: 12,
      border: "1px solid rgba(120,180,255,0.55)",
      background: "rgba(40,110,190,0.35)",
      color: "#fff",
      fontSize: 16,
      fontWeight: 900,
      cursor: "pointer"
    },
    softBtn: {
      width: "100%",
      padding: 12,
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(255,255,255,0.06)",
      color: "#fff",
      fontSize: 15,
      fontWeight: 900,
      cursor: "pointer"
    },
    dangerBtn: {
      width: "100%",
      padding: 12,
      borderRadius: 12,
      border: "1px solid rgba(255,80,80,0.50)",
      background: "rgba(120,20,20,0.32)",
      color: "#fff",
      fontSize: 15,
      fontWeight: 900,
      cursor: "pointer"
    },
    successBtn: {
      width: "100%",
      padding: 12,
      borderRadius: 12,
      border: "1px solid rgba(80,200,120,0.50)",
      background: "rgba(20,120,60,0.32)",
      color: "#fff",
      fontSize: 15,
      fontWeight: 900,
      cursor: "pointer"
    },
    modeChip: (active) => ({
      padding: "10px 12px",
      borderRadius: 12,
      border: active ? "1px solid rgba(120,180,255,0.55)" : "1px solid rgba(255,255,255,0.18)",
      background: active ? "rgba(40,110,190,0.35)" : "rgba(255,255,255,0.06)",
      textAlign: "center",
      fontWeight: 900,
      cursor: "pointer"
    })
  };

  return (
    <div style={styles.page}>
      <Header />

      <div style={styles.logoWrap}>
        <img src="/qc-logo.png" alt="QueCab AdbS" style={styles.logo} />
      </div>

      <div style={styles.wrap}>
        <div style={styles.title}>Control Center</div>

        <div style={{ ...styles.card, marginBottom: 16 }}>
          <div style={styles.sectionTitle}>AdbS Protection Summary</div>

          <div style={styles.metricGrid}>
            <div style={styles.metricCard}>
              <div style={styles.metricNumber}>{num(totals?.this_month_verifications)}</div>
              <div style={styles.metricLabel}>This Month’s Truck-Driver Verifications</div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricNumber}>{num(totals?.this_month_clear_to_load)}</div>
              <div style={styles.metricLabel}>CLEAR TO LOAD This Month</div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricNumber}>{num(totals?.this_month_caution_alerts)}</div>
              <div style={styles.metricLabel}>CAUTION ALERTS This Month</div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricNumber}>{num(totals?.active_links)}</div>
              <div style={styles.metricLabel}>Active Verification Links</div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricNumber}>{num(totals?.revoked_links)}</div>
              <div style={styles.metricLabel}>Revoked Links</div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricNumber}>{num(totals?.failed_attempts)}</div>
              <div style={styles.metricLabel}>Total Failed / Caution Attempts</div>
            </div>
          </div>

          {totalsError ? (
            <div style={{ marginTop: 12, color: "#ff9c9c", fontWeight: 700 }}>
              {totalsError}
            </div>
          ) : null}
        </div>

        <div style={{ ...styles.card, marginBottom: 16 }}>
          <div style={styles.sectionTitle}>Find Verification</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 10 }}>
            <input
              style={styles.input}
              placeholder="Verification ID, AdbS Verify Link, Load ID, email, phone, DOT, plate, or carrier"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  searchVerification();
                }
              }}
            />

            <button style={styles.primaryBtn} onClick={searchVerification}>
              Search
            </button>
          </div>

          {matches.length > 1 ? (
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {matches.map((m) => (
                <button
                  key={m.token || m.verification_id}
                  type="button"
                  style={styles.softBtn}
                  onClick={() => loadVerificationByToken(m.token || m.verification_id)}
                >
                  {(m.load_id || "No Load ID") + " — " + (m.carrier_company || "Unknown Carrier")}
                </button>
              ))}
            </div>
          ) : null}

          {errorMsg ? (
            <div style={{ marginTop: 12, color: "#ff9c9c", fontWeight: 700 }}>
              {errorMsg}
            </div>
          ) : null}

          {statusMsg ? <div style={{ marginTop: 12 }}>{statusMsg}</div> : null}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.12fr 0.88fr", gap: 16 }}>
          <div style={styles.card}>
            <div style={styles.sectionTitle}>Issue AdbS Verification</div>

            <div style={{ display: "grid", gap: 10 }}>
              <input ref={loadRef} style={styles.input} placeholder="Load ID" value={loadId} onChange={(e) => setLoadId(e.target.value)} onKeyDown={handleIssueEnter} />
              <input style={styles.input} placeholder="Shipper Email" value={dockEmail} onChange={(e) => setDockEmail(e.target.value)} onKeyDown={handleIssueEnter} />
              <input style={styles.input} placeholder="Facility ID (optional)" value={facilityId} onChange={(e) => setFacilityId(e.target.value)} onKeyDown={handleIssueEnter} />
              <input style={styles.input} placeholder="Carrier Company" value={carrierCompany} onChange={(e) => setCarrierCompany(e.target.value)} onKeyDown={handleIssueEnter} />
              <input style={styles.input} placeholder="Carrier Contact Name" value={carrierContact} onChange={(e) => setCarrierContact(e.target.value)} onKeyDown={handleIssueEnter} />
              <input style={styles.input} placeholder="Carrier Contact Phone" value={carrierPhone} onChange={(e) => setCarrierPhone(formatPhone(e.target.value))} onKeyDown={handleIssueEnter} />
              <input style={styles.input} placeholder="Driver Phone" value={driverPhone} onChange={(e) => setDriverPhone(formatPhone(e.target.value))} onKeyDown={handleIssueEnter} />
              <input style={styles.input} placeholder="USDOT#" value={usdot} onChange={(e) => setUsdot(onlyDigits(e.target.value))} onKeyDown={handleIssueEnter} />
              <input style={styles.input} placeholder="Plate" value={plate} onChange={(e) => setPlate(upper(e.target.value))} onKeyDown={handleIssueEnter} />
              <input style={styles.input} placeholder="Dock PIN (optional)" value={dockPin} onChange={(e) => setDockPin(onlyDigits(e.target.value))} onKeyDown={handleIssueEnter} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div style={styles.modeChip(mode === "auto")} onClick={() => setMode("auto")}>Auto 24h</div>
                <div style={styles.modeChip(mode === "pick")} onClick={() => setMode("pick")}>Pick</div>
                <div style={styles.modeChip(mode === "none")} onClick={() => setMode("none")}>No Expire</div>
              </div>

              {mode === "pick" ? (
                <>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#8fc7ff" }}>
                      Start Date / Time
                    </div>
                    <input
                      ref={startAtRef}
                      style={styles.dateInput}
                      type="datetime-local"
                      value={startAt}
                      onClick={() => openDatePicker(startAtRef)}
                      onChange={(e) => setStartAt(e.target.value)}
                      onKeyDown={handleIssueEnter}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#8fc7ff" }}>
                      Expire Date / Time
                    </div>
                    <input
                      ref={expireAtRef}
                      style={styles.dateInput}
                      type="datetime-local"
                      value={expireAt}
                      onClick={() => openDatePicker(expireAtRef)}
                      onChange={(e) => setExpireAt(e.target.value)}
                      onKeyDown={handleIssueEnter}
                    />
                  </div>
                </>
              ) : null}

              <button style={styles.primaryBtn} onClick={issueVerification} disabled={loading}>
                {loading ? "Issuing..." : "Issue AdbS Verification"}
              </button>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.sectionTitle}>Selected Verification</div>

            {!selected ? (
              <div style={{ opacity: 0.72 }}>No verification selected yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Verification ID</div>
                  <input style={styles.input} value={selected.verification_id || ""} readOnly />
                </div>

                <div>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>AdbS Verify Link</div>
                  <a href={selected.verify_url || "#"} target="_blank" rel="noreferrer" style={styles.linkBox}>
                    {selected.verify_url || ""}
                  </a>
                </div>

                <div>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Status</div>
                  <input style={styles.input} value={selected.status || ""} readOnly />
                </div>

                <div>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Load ID</div>
                  <input style={styles.input} value={selected.load_id || ""} readOnly />
                </div>

                <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 12, background: "rgba(255,255,255,0.04)" }}>
                  <div>Shipper Email: <b>{selected.dock_email || "(not provided)"}</b></div>
                  <div>Driver Phone: <b>{selected.driver_phone || "(not provided)"}</b></div>
                  <div>USDOT#: <b>{selected.usdot_on_record || "(not provided)"}</b></div>
                  <div>Plate: <b>{selected.plate_on_record || "(not provided)"}</b></div>
                  <div>Carrier Company: <b>{selected.carrier_company || "(not provided)"}</b></div>
                </div>

                {selected.email_status ? (
                  <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 12, background: "rgba(255,255,255,0.04)" }}>
                    Email Status: <b>{selected.email_status}</b>
                    {selected.email_error ? (
                      <div style={{ marginTop: 6, color: "#ff9c9c" }}>
                        Email Error: <b>{selected.email_error}</b>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {qrUrl ? (
                  <div style={{ textAlign: "center" }}>
                    <img src={qrUrl} alt="QR" style={{ width: 240, background: "#fff", padding: 10, borderRadius: 12 }} />
                  </div>
                ) : null}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button style={styles.softBtn} onClick={async () => setStatusMsg((await safeCopy(selected.verify_url || "")) ? "AdbS Verify Link copied." : "Copy failed.")}>
                    Copy AdbS Verify Link
                  </button>

                  <button style={styles.softBtn} onClick={async () => setStatusMsg((await safeCopy(selected.verification_id || "")) ? "Verification ID copied." : "Copy failed.")}>
                    Copy Verification ID
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button
                    style={{ ...styles.dangerBtn, opacity: statusLoading ? 0.7 : 1, cursor: statusLoading ? "not-allowed" : "pointer" }}
                    onClick={() => setVerificationStatus("revoked")}
                    disabled={!!statusLoading}
                  >
                    {statusLoading === "revoked" ? "Revoking..." : "Revoke Verification"}
                  </button>

                  <button
                    style={{ ...styles.successBtn, opacity: statusLoading ? 0.7 : 1, cursor: statusLoading ? "not-allowed" : "pointer" }}
                    onClick={() => setVerificationStatus("active")}
                    disabled={!!statusLoading}
                  >
                    {statusLoading === "active" ? "Reactivating..." : "Reactivate Verification"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
