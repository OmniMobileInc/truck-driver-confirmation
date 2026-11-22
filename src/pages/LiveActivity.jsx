import { getAuthEmail, getAuthCode } from "../utils/auth.js";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Header from "../components/Header.jsx";
import { LS_EMAIL, isBrokerOrShipper } from "../utils/auth.js";

function safeStr(v) {
  return String(v ?? "").trim();
}

function fmt(v) {
  if (!v) return "(not provided)";
  return String(v);
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

function shortResult(v) {
  const s = String(v || "").toUpperCase();
  if (s.includes("CLEAR")) return "CLEAR";
  if (s.includes("CAUTION")) return "CAUTION";
  return s || "ACTIVE";
}

export default function LiveActivity() {
  const nav = useNavigate();

  const email = (localStorage.getItem(LS_EMAIL) || "").trim();
  const authorized = !!email && isBrokerOrShipper(email);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [record, setRecord] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    if (!authorized) {
      nav("/login", { replace: true });
    }
  }, [authorized, nav]);

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

    setLoading(true);
    setErrorMsg("");
    setStatusMsg("");

    try {
      const res = await fetch("/api/manage_verify_link", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-adbs-broker-email": getAuthEmail(), "x-adbs-broker-code": getAuthCode() },
        body: JSON.stringify({
          action: "detail",
          token
        })
      });

      const data = await safeJson(res);

      if (!res.ok || !data?.ok) {
        setLoading(false);
        setErrorMsg(data?.error || "Verification detail not found.");
        return;
      }

      setRecord(data);
      setAttempts(Array.isArray(data.attempts) ? data.attempts : []);
      setStatusMsg("Verification loaded.");
      setLoading(false);
    } catch {
      setLoading(false);
      setErrorMsg("Network error loading verification.");
    }
  }

  async function runSearch() {
    const q = safeStr(query);
    if (!q) {
      setErrorMsg("Enter Verification ID, AdbS Verify Link, Load ID, email, phone, DOT, plate, or carrier");
      setStatusMsg("");
      setRecord(null);
      setAttempts([]);
      setMatches([]);
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setStatusMsg("");
    setRecord(null);
    setAttempts([]);
    setMatches([]);

    try {
      const res = await fetch("/api/manage_verify_link", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-adbs-broker-email": getAuthEmail(), "x-adbs-broker-code": getAuthCode() },
        body: JSON.stringify({
          action: "lookup",
          token: q
        })
      });

      const data = await safeJson(res);

      if (!res.ok || !data?.ok) {
        setLoading(false);
        setErrorMsg(data?.error || "Verification not found.");
        return;
      }

      const rows = Array.isArray(data.rows) ? data.rows : [];
      setMatches(rows);

      if (rows.length === 1) {
        await loadDetailByToken(rows[0].token);
        return;
      }

      setStatusMsg(`${rows.length} matching records found.`);
      setLoading(false);
    } catch {
      setLoading(false);
      setErrorMsg("Network error loading verification.");
    }
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
    width: "100%",
    padding: 13,
    borderRadius: 12,
    border: "1px solid rgba(120,180,255,0.55)",
    background: "rgba(40,110,190,0.35)",
    color: "#ffffff",
    fontSize: 16,
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
        <div style={title}>Live Activity</div>

        <div style={{ ...card, marginBottom: 16 }}>
          <div style={sectionTitle}>Universal Verification Lookup</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 10 }}>
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
            <button style={buttonPrimary} onClick={runSearch} disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
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

          {errorMsg ? <div style={{ marginTop: 12, color: "#ff9c9c", fontWeight: 700 }}>{errorMsg}</div> : null}
          {statusMsg ? <div style={{ marginTop: 12, color: "#ffffff" }}>{statusMsg}</div> : null}
        </div>

        {record ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={card}>
                <div style={sectionTitle}>What Was Assigned?</div>
                <div style={{ lineHeight: 1.7, fontSize: 15 }}>
                  Verification ID: <b>{fmt(record.token)}</b><br />
                  Load ID: <b>{fmt(record.load_id)}</b><br />
                  Status: <b>{fmt(record.status)}</b><br />
                  Created: <b>{fmtDate(pickTime(record))}</b><br />
                  Expires: <b>{record.expires_at ? fmtDate(record.expires_at) : "No Expire"}</b><br />
                  Dock Email: <b>{fmt(record.dock_email)}</b><br />
                  Driver Phone: <b>{fmt(record.driver_phone)}</b><br />
                  Assigned USDOT#: <b>{fmt(record.usdot_on_record)}</b><br />
                  Assigned Plate: <b>{fmt(record.plate_on_record)}</b><br />
                  Carrier Company: <b>{fmt(record.carrier_company)}</b><br />
                  Carrier Contact: <b>{fmt(record.carrier_contact_name)}</b><br />
                  Carrier Contact Phone: <b>{fmt(record.carrier_contact_phone)}</b><br />
                  AdbS Verify Link: <b style={{ wordBreak: "break-all" }}>{fmt(record.verify_url)}</b>
                </div>
              </div>

              <div style={card}>
                <div style={sectionTitle}>What Actually Happened?</div>

                {attempts.length === 0 ? (
                  <div style={{ opacity: 0.8 }}>No attempts logged yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {attempts.map((a, i) => (
                      <div
                        key={i}
                        style={{
                          border: "1px solid rgba(255,255,255,0.10)",
                          borderRadius: 12,
                          padding: 12,
                          background: "rgba(255,255,255,0.04)"
                        }}
                      >
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>
                          {String(a.result || "").toLowerCase().includes("clear") ? "CLEAR" : "ATTEMPT"}
                        </div>

                        <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                          Verification Timestamp: <b>{fmtDate(pickTime(a))}</b><br />
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

            <div style={{ ...card, marginTop: 16 }}>
              <div style={sectionTitle}>Why This Matters</div>
              <div style={{ lineHeight: 1.7, fontSize: 15 }}>
                This page gives a broker a defensible record of:
                <br />• what was assigned
                <br />• what the dock actually entered
                <br />• whether the driver-answer check passed
                <br />• what the system concluded
                <br />• when each attempt happened
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
