import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Header from "../components/Header.jsx";
import { LS_EMAIL, getAuthCode, getAuthEmail, isBrokerOrShipper } from "../utils/auth.js";

function fmtDate(v) {
  if (!v) return "(unknown)";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  } catch {
    return String(v);
  }
}

function safeStr(v) {
  return String(v ?? "").trim();
}

function fmt(v) {
  return v ? String(v) : "(not provided)";
}

function pickTime(row) {
  return (
    row?.checked_at ||
    row?.created_at ||
    row?.timestamp ||
    row?.inserted_at ||
    row?.verification_timestamp ||
    ""
  );
}

function shortResult(v) {
  const s = String(v || "").toUpperCase();
  if (s.includes("CLEAR")) return "CLEAR";
  if (s.includes("CAUTION")) return "CAUTION";
  return s || "ACTIVE";
}

async function copyText(text, setStatusMsg) {
  const value = String(text || "").trim();

  if (!value) {
    setStatusMsg("Nothing to copy.");
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    setStatusMsg(`Copied: ${value}`);
  } catch {
    setStatusMsg("Copy failed.");
  }
}

function statusChip(status) {
  const s = String(status || "").toLowerCase();

  if (s === "active") {
    return {
      text: "ACTIVE",
      style: {
        border: "1px solid rgba(80,200,120,0.55)",
        background: "rgba(30,120,60,0.22)",
        color: "#dfffe8"
      }
    };
  }

  if (s === "revoked") {
    return {
      text: "REVOKED",
      style: {
        border: "1px solid rgba(255,80,80,0.55)",
        background: "rgba(150,30,30,0.22)",
        color: "#ffdede"
      }
    };
  }

  return {
    text: String(status || "UNKNOWN").toUpperCase(),
    style: {
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(255,255,255,0.06)",
      color: "#ffffff"
    }
  };
}

export default function LiveSessions() {
  const nav = useNavigate();

  const email = (localStorage.getItem(LS_EMAIL) || "").trim();
  const authorized = !!email && isBrokerOrShipper(email);
  const brokerHeaders = () => ({ "x-adbs-broker-email": getAuthEmail(), "x-adbs-broker-code": getAuthCode() });

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");
  const [query, setQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [record, setRecord] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    if (!authorized) {
      nav("/login", { replace: true });
    }
  }, [authorized, nav]);

  useEffect(() => {
    if (!authorized) return;

    let timer = null;

    async function loadRows() {
      setLoading(true);
      setErrorMsg("");

      try {
        const res = await fetch("/api/live_sessions?status=all&limit=50", { headers: brokerHeaders() });
        const data = await res.json();

        if (!res.ok || !data?.ok) {
          setLoading(false);
          setErrorMsg(data?.error || "Could not load live sessions.");
          return;
        }

        setRows(Array.isArray(data.rows) ? data.rows : []);
        setLastRefresh(new Date().toLocaleTimeString());
        setStatusMsg("Live sessions updated.");
        setLoading(false);
      } catch {
        setLoading(false);
        setErrorMsg("Network error loading live sessions.");
      }
    }

    loadRows();
    timer = setInterval(loadRows, 5000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [authorized]);

  if (!authorized) return null;

  async function safeJson(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  async function loadDetailByToken(token) {
    if (!token) return;

    setSearchLoading(true);
    setSearchError("");
    setSearchStatus("");

    try {
      const res = await fetch("/api/manage_verify_link", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...brokerHeaders() },
        body: JSON.stringify({ action: "detail", token })
      });
      const data = await safeJson(res);

      if (!res.ok || !data?.ok) {
        setSearchLoading(false);
        setSearchError(data?.error || "Verification detail not found.");
        return;
      }

      setRecord(data);
      setAttempts(Array.isArray(data.attempts) ? data.attempts : []);
      setSearchStatus("Verification loaded.");
      setSearchLoading(false);
    } catch {
      setSearchLoading(false);
      setSearchError("Network error loading verification.");
    }
  }

  async function runSearch() {
    const q = safeStr(query);

    if (!q) {
      setSearchError("Enter Verification ID, AdbS Verify Link, Load ID, email, phone, DOT, plate, or carrier.");
      setSearchStatus("");
      setRecord(null);
      setAttempts([]);
      setMatches([]);
      return;
    }

    setSearchLoading(true);
    setSearchError("");
    setSearchStatus("");
    setRecord(null);
    setAttempts([]);
    setMatches([]);

    try {
      const res = await fetch("/api/manage_verify_link", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...brokerHeaders() },
        body: JSON.stringify({ action: "lookup", token: q })
      });
      const data = await safeJson(res);

      if (!res.ok || !data?.ok) {
        setSearchLoading(false);
        setSearchError(data?.error || "Verification not found.");
        return;
      }

      const found = Array.isArray(data.rows) ? data.rows : [];
      setMatches(found);

      if (found.length === 1) {
        await loadDetailByToken(found[0].token);
        return;
      }

      setSearchStatus(`${found.length} matching records found.`);
      setSearchLoading(false);
    } catch {
      setSearchLoading(false);
      setSearchError("Network error loading verification.");
    }
  }

  function clearSearch() {
    setQuery("");
    setSearchError("");
    setSearchStatus("");
    setRecord(null);
    setAttempts([]);
    setMatches([]);
  }

  const pageWrap = {
    minHeight: "100vh",
    background: "transparent"
  };

  const outer = {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "18px 16px 48px"
  };

  const heroLogoWrap = {
    display: "flex",
    justifyContent: "center",
    marginTop: 90,
    marginBottom: 10
  };

  const heroLogo = {
    width: 220,
    maxWidth: "90%"
  };

  const card = {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(12,18,28,0.72)",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 12px 28px rgba(0,0,0,0.28)"
  };

  const title = {
    fontSize: 26,
    fontWeight: 800,
    marginBottom: 14,
    color: "#fff"
  };

  const sectionTitle = {
    fontWeight: 900,
    fontSize: 18,
    marginBottom: 12,
    color: "#fff"
  };

  const input = {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.32)",
    boxSizing: "border-box",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    fontSize: 16,
    outline: "none"
  };

  const buttonPrimary = {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(120,180,255,0.55)",
    background: "rgba(40,110,190,0.35)",
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 900,
    cursor: "pointer"
  };

  const copyBtn = {
    padding: "9px 10px",
    borderRadius: 10,
    border: "1px solid rgba(120,180,255,0.45)",
    background: "rgba(40,110,190,0.22)",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer"
  };

  return (
    <div style={pageWrap}>
      <Header />

      <div style={heroLogoWrap}>
        <img src="/qc-logo.png" alt="QueCab AdbS" style={heroLogo} />
      </div>

      <div style={outer}>
        <div style={title}>Live Session Mode</div>

        <div style={{ ...card, marginBottom: 16 }}>
          <div style={sectionTitle}>Universal Verification Lookup</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <input
              style={input}
              placeholder="Search by Verification ID, AdbS Verify Link, Load ID, email, phone, DOT, plate, or carrier"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSearch();
                }
              }}
            />
            <div style={{ display: "grid", gridTemplateColumns: record || matches.length || searchError || searchStatus ? "1fr 1fr" : "1fr", gap: 10 }}>
              <button type="button" style={buttonPrimary} onClick={runSearch} disabled={searchLoading}>
                {searchLoading ? "Searching..." : "Search"}
              </button>
              {record || matches.length || searchError || searchStatus ? (
                <button type="button" style={buttonPrimary} onClick={clearSearch}>
                  Clear Search
                </button>
              ) : null}
            </div>
          </div>

          {matches.length > 1 ? (
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              {matches.map((m) => (
                <button
                  key={m.token}
                  type="button"
                  onClick={() => loadDetailByToken(m.token)}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.04)",
                    color: "#fff",
                    cursor: "pointer"
                  }}
                >
                  <div style={{ fontWeight: 900 }}>
                    {m.load_id || "(no load id)"} | {shortResult(m.result_summary)} | {m.status || "active"}
                  </div>
                  <div style={{ opacity: 0.86, fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>
                    {m.carrier_company || "(no carrier)"} | DOT {m.usdot_on_record || "—"} | Plate {m.plate_on_record || "—"} | Phone {m.driver_phone || "—"} | {fmtDate(pickTime(m))}
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {searchError ? <div style={{ marginTop: 12, color: "#ff9c9c", fontWeight: 700 }}>{searchError}</div> : null}
          {searchStatus ? <div style={{ marginTop: 12, color: "#ffffff" }}>{searchStatus}</div> : null}
        </div>

        {record ? (
          <div id="verification-detail" style={{ ...card, marginBottom: 16 }}>
            <div style={sectionTitle}>Lookup Result</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              <div style={{ lineHeight: 1.7, fontSize: 15 }}>
                Verification ID: <b>{fmt(record.token)}</b><br />
                Load ID: <b>{fmt(record.load_id)}</b><br />
                Status: <b>{fmt(record.status)}</b><br />
                Created: <b>{fmtDate(pickTime(record))}</b><br />
                Expires: <b>{record.expires_at ? fmtDate(record.expires_at) : "No Expire"}</b><br />
                Dock Email: <b>{fmt(record.dock_email)}</b><br />
                Driver Phone: <b>{fmt(record.driver_phone)}</b><br />
                Broker Acknowledgment: <b>{record.broker_acknowledged_at ? fmtDate(record.broker_acknowledged_at) : "Not recorded"}</b><br />
                Assigned USDOT#: <b>{fmt(record.usdot_on_record)}</b><br />
                Assigned Plate: <b>{fmt(record.plate_on_record)}</b><br />
                Carrier Company: <b>{fmt(record.carrier_company)}</b><br />
                Carrier Contact: <b>{fmt(record.carrier_contact_name)}</b><br />
                Carrier Contact Phone: <b>{fmt(record.carrier_contact_phone)}</b>
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>Verification Attempts</div>
                {attempts.length === 0 ? (
                  <div style={{ opacity: 0.8 }}>No attempts logged yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {attempts.map((a, i) => (
                      <div key={i} style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: 12, background: "rgba(255,255,255,0.04)" }}>
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>{shortResult(a.result)}</div>
                        <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                          Time: <b>{fmtDate(pickTime(a))}</b><br />
                          Dock Employee: <b>{fmt(a.dock_employee_email || a.dock_employee_id)}</b><br />
                          Dock Certified: <b>{a.dock_certified_at ? fmtDate(a.dock_certified_at) : "Not recorded"}</b><br />
                          Entered DOT: <b>{fmt(a.entered_usdot)}</b><br />
                          Entered Plate: <b>{fmt(a.entered_plate)}</b><br />
                          Driver Answered: <b>{String(a.driver_answered)}</b><br />
                          Result: <b>{fmt(a.result)}</b>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div style={{ ...card, marginBottom: 16 }}>
          <div style={sectionTitle}>Recent Verifications</div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: 12
            }}
          >
            <div style={{ opacity: 0.85 }}>
              These update automatically every few seconds.
              {lastRefresh ? ` Last refresh: ${lastRefresh}` : ""}
            </div>

            <button style={buttonPrimary} onClick={() => window.location.reload()}>
              Refresh Now
            </button>
          </div>

          <div style={{ opacity: 0.78, fontSize: 14, marginBottom: 12 }}>
            Select a load to review its verification history and details.
          </div>

          {errorMsg ? (
            <div style={{ color: "#ff9c9c", fontWeight: 700, marginBottom: 12 }}>
              {errorMsg}
            </div>
          ) : null}

          {statusMsg ? (
            <div style={{ color: "#ffffff", marginBottom: 12 }}>
              {statusMsg}
            </div>
          ) : null}

          {loading && rows.length === 0 ? (
            <div style={{ opacity: 0.8 }}>Loading live sessions...</div>
          ) : null}

          {!loading && rows.length === 0 ? (
            <div style={{ opacity: 0.8 }}>No verifications right now.</div>
          ) : null}

          {rows.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              {rows.map((row) => {
                const chip = statusChip(row.status);
                const verificationId = row.token || row.verification_id || "";

                return (
                  <div
                    key={verificationId || row.load_id}
                    style={{
                      textAlign: "left",
                      padding: "14px 16px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.04)",
                      color: "#fff"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        alignItems: "center"
                      }}
                    >
                      <div style={{ fontWeight: 900, fontSize: 16 }}>
                        {row.load_id || "(no load id)"}
                        {row.carrier_company ? ` | ${row.carrier_company}` : ""}
                      </div>

                      <div
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 900,
                          ...chip.style
                        }}
                      >
                        {chip.text}
                      </div>
                    </div>

                    <div
                      style={{
                        opacity: 0.88,
                        fontSize: 14,
                        marginTop: 6,
                        lineHeight: 1.55
                      }}
                    >
                      Verification ID: {verificationId || "—"}
                      <br />
                      DOT {row.usdot_on_record || "—"} | Plate{" "}
                      {row.plate_on_record || "—"} | Driver{" "}
                      {row.driver_phone || "—"}
                      <br />
                      Dock Email: {row.dock_email || "—"} | Created:{" "}
                      {fmtDate(row.created_at)}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: 8,
                        marginTop: 12
                      }}
                    >
                      <button type="button" style={copyBtn} onClick={async () => { await loadDetailByToken(verificationId); document.getElementById("verification-detail")?.scrollIntoView({ behavior: "smooth" }); }}>View Load Details &amp; Activity</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
