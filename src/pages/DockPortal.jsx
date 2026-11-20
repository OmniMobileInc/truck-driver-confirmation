import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && anon ? createClient(url, anon) : null;

export default function DockPortal() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const manifest = document.createElement("link");
    manifest.rel = "manifest";
    manifest.href = "/dock.webmanifest";
    document.head.appendChild(manifest);
    const onInstall = (event) => { event.preventDefault(); setInstallPrompt(event); };
    window.addEventListener("beforeinstallprompt", onInstall);
    if (!supabase) { setReady(true); return () => { manifest.remove(); window.removeEventListener("beforeinstallprompt", onInstall); }; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); }).catch(() => setReady(true));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => { subscription.unsubscribe(); manifest.remove(); window.removeEventListener("beforeinstallprompt", onInstall); };
  }, []);

  useEffect(() => {
    if (!session) { setData(null); return; }
    let active = true;
    setBusy(true);
    fetch("/api/facility_queue", { headers: { Authorization: "Bearer " + session.access_token } })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw Error(result.error || "Queue unavailable");
        return result;
      })
      .then(result => { if (active) { setData(result); setError(""); } })
      .catch(err => { if (active) { setData(null); setError(err.message); } })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [session]);

  const style = { minHeight: "100vh", padding: "clamp(22px,5vw,55px)", color: "#f2f6fa", background: "linear-gradient(140deg,#101923,#1c344c)", fontFamily: "Arial,sans-serif" };
  const input = { display: "block", width: "100%", boxSizing: "border-box", padding: 14, margin: "8px 0 18px", borderRadius: 8, border: "1px solid #6385a3", background: "#f7fafd", color: "#15283d", fontSize: 17 };
  const button = { padding: "13px 22px", border: "1px solid #87b6e0", borderRadius: 8, background: "#21649c", color: "white", fontSize: 16, fontWeight: 700, cursor: "pointer" };

  async function signIn(event) {
    event.preventDefault();
    setBusy(true); setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) setError("Sign-in unsuccessful. Check your email and password, or contact your facility administrator.");
    setPassword("");
    setBusy(false);
  }

  async function sendRecovery(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + "/dock/reset"
    });
    if (resetError) setError("Unable to send recovery email. Please try again or contact your facility administrator.");
    else setNotice("If this email has a facility account, a password recovery link will arrive shortly.");
    setBusy(false);
  }

  if (!supabase) return <main style={style}><h1>QueCab AdbS™ — Dock Portal</h1><p>Setup pending: configure Supabase public URL and anon key.</p></main>;

  return <main style={style}>
    <div style={{ maxWidth: 1050, margin: "0 auto" }}>
      <header style={{ borderBottom: "1px solid #486782", paddingBottom: 20, marginBottom: 32 }}>
        <div style={{ fontSize: 14, letterSpacing: 3, color: "#91caff", fontWeight: 800 }}>SECURE FACILITY ACCESS</div>
        <h1 style={{ fontSize: "clamp(28px,4vw,44px)", marginBottom: 8 }}>QueCab AdbS™ — Dock Portal</h1>
        <p style={{ color: "#c3d4e5" }}>The Broker's Eyes at the Dock™</p>
      </header>
      {!ready ? <p>Loading secure sign-in…</p> : !session ?
        <section style={{ maxWidth: 500, padding: "28px", border: "1px solid #55758f", borderRadius: 16, background: "#172b3e", boxShadow: "0 14px 35px #080e1699" }}>
          <h2 style={{ marginTop: 0 }}>{recoveryMode ? "Set or Reset Your Password" : "Facility Sign In"}</h2>
          <p style={{ color: "#c3d4e5" }}>{recoveryMode ? "Enter your facility email to receive a secure password recovery link." : "Authorized facility personnel only. Use your assigned email and password."}</p>
          <form onSubmit={recoveryMode ? sendRecovery : signIn}>
            <label htmlFor="dock-email">Work email</label>
            <input id="dock-email" style={input} type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@facility.com" />
            {!recoveryMode && <><label htmlFor="dock-password">Password</label>
            <input id="dock-password" style={input} type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Your password" />
            </>}
            <button style={button} disabled={busy}>{busy ? "Please wait…" : recoveryMode ? "Send Password Recovery Email" : "Sign In to Dock Portal"}</button>
          </form>
          <button type="button" style={{ marginTop: 18, background: "transparent", border: 0, color: "#9bc8ff", textDecoration: "underline", cursor: "pointer" }} onClick={() => { setRecoveryMode(!recoveryMode); setError(""); setNotice(""); }}>{recoveryMode ? "Back to sign in" : "Set or forgot your password?"}</button>
          {notice && <p role="status">{notice}</p>}
        </section> :
        <section>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <h2>Assigned Verification Queue</h2>
            <button style={button} onClick={() => supabase.auth.signOut()}>Sign Out</button>
          </div>
          {busy && <p>Loading your facility's assigned loads…</p>}
          {data && <><p>Facility: <strong>{data.facility_id}</strong></p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderSpacing: "0 12px", width: "100%", textAlign: "left" }}>
                <thead><tr><th>Load ID</th><th>Carrier</th><th>Status</th><th>Verification</th></tr></thead>
                <tbody>{data.loads.map(load => <tr key={load.token}><td>{load.load_id || "—"}</td><td>{load.carrier_company || "—"}</td><td>{load.status}</td><td><a style={{ color: "#9bc8ff" }} href={"/v.html?t=" + encodeURIComponent(load.token)}>Open verification</a></td></tr>)}</tbody>
              </table>
            </div>
            {!data.loads.length && <p>No assigned loads yet.</p>}
          </>}
        </section>}
      {error && <p role="alert" style={{ padding: 14, border: "1px solid #d99898", borderRadius: 8, color: "#ffd7d7" }}>{error}</p>}
      <div style={{ marginTop: 36, color: "#c3d4e5" }}>
        {installPrompt && <button style={button} onClick={async () => { await installPrompt.prompt(); setInstallPrompt(null); }}>Install Dock Portal on This Computer</button>}
        <p>For desktop access, use your browser's <strong>Install app</strong> option when available. Facility membership is required to view assigned loads.</p>
      </div>
    </div>
  </main>;
}
