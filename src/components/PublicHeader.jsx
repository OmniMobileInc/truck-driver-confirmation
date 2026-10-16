// /src/components/PublicHeader.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAuthEmail, isBrokerOrShipper, clearAuth } from "../utils/auth.js";

export default function PublicHeader() {
  const nav = useNavigate();
  const loc = useLocation();

  const [email, setEmail] = useState(() => getAuthEmail());

  // Keep in sync in the SAME tab + other tabs
  useEffect(() => {
    let alive = true;

    const tick = () => {
      if (!alive) return;
      const current = getAuthEmail();
      setEmail((prev) => (prev === current ? prev : current));
    };

    tick();
    const id = setInterval(tick, 500);

    const onStorage = () => tick();
    window.addEventListener("storage", onStorage);

    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loc.pathname]);

  const authorized = useMemo(() => {
    const e = String(email || "").trim();
    return !!e && isBrokerOrShipper(e);
  }, [email]);

  function logout() {
    clearAuth();
    setEmail("");
    nav("/login", { replace: true });
  }

  const bar = {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "rgba(8, 12, 18, 0.82)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid rgba(140,190,255,0.12)",
  };

  const inner = {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  };

  const brand = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
    userSelect: "none",
  };

  const title = { fontSize: 15, fontWeight: 950, letterSpacing: 0.2, margin: 0 };
  const sub = { fontSize: 12, opacity: 0.72, marginTop: 2 };

  const row = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" };

  const btn = (primary) => ({
    padding: "10px 12px",
    borderRadius: 12,
    border: primary
      ? "1px solid rgba(140,190,255,0.42)"
      : "1px solid rgba(140,190,255,0.20)",
    background: primary
      ? "linear-gradient(180deg, rgba(40,110,200,0.85), rgba(20,70,140,0.75))"
      : "rgba(0,0,0,0.18)",
    color: "#e6edf5",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
  });

  return (
    <div style={bar}>
      <div style={inner}>
        <div
          style={brand}
          onClick={() => nav(authorized ? "/dashboard" : "/")}
          title="QueCab AdbS"
        >
          <img
            src="/qc-logo.png"
            alt="QueCab AdbS"
            style={{ width: 34, height: 34, objectFit: "contain" }}
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <div>
            <div style={title}>QueCab AdbS</div>
            <div style={sub}>{authorized ? "Authorized" : "Public"} • Truck-Driver verification</div>
          </div>
        </div>

        <div style={row}>
          {authorized ? (
            <>
              <button style={btn(true)} onClick={() => nav("/dashboard")}>
                Control Center
              </button>
              <button style={btn(false)} onClick={() => nav("/how-it-works")}>
                How It Works
              </button>
              <button style={btn(false)} onClick={logout}>
                Log Out
              </button>
            </>
          ) : (
            <>
              <button style={btn(true)} onClick={() => nav("/")}>
                Home
              </button>
              <button style={btn(false)} onClick={() => nav("/how-it-works")}>
                How It Works
              </button>
              <button style={btn(false)} onClick={() => nav("/login")}>
                Log In
              </button>
              <button style={btn(false)} onClick={() => nav("/join")}>
                Request Access
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
