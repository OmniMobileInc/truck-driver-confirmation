import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;

export default function DockResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    // Supabase delivers recovery tokens as URL fragments or a code.
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const recovery = fragment.get("type") === "recovery";
    const code = new URLSearchParams(window.location.search).get("code");
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (alive && event === "PASSWORD_RECOVERY" && session) setVerified(true);
    });
    async function initialize() {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!alive) return;
        if (error) setMessage("This recovery link is invalid or expired. Request a fresh link from Dock Portal.");
        else setVerified(true);
      } else if (recovery) {
        const { data, error } = await supabase.auth.getSession();
        if (!alive) return;
        if (error || !data.session) setMessage("This recovery link is invalid or expired. Request a fresh link from Dock Portal.");
        else setVerified(true);
      } else {
        setMessage("Open the password recovery link from your email to set a password.");
      }
    }
    initialize();
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  async function save(event) {
    event.preventDefault();
    if (password.length < 12) { setMessage("Use at least 12 characters for your password."); return; }
    if (password !== confirm) { setMessage("The passwords do not match."); return; }
    setBusy(true); setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setMessage(error.message || "Password could not be updated."); return; }
    setPassword(""); setConfirm(""); setDone(true);
    await supabase.auth.signOut();
  }

  const input = { width: "100%", boxSizing: "border-box", padding: 14, margin: "8px 0 20px", borderRadius: 8, fontSize: 17 };
  return <main style={{ minHeight: "100vh", padding: "clamp(24px,5vw,60px)", background: "linear-gradient(135deg,#101923,#1c344c)", color: "#f2f6fa", fontFamily: "Arial,sans-serif" }}>
    <div style={{ maxWidth: 510, margin: "30px auto", padding: 28, background: "#172b3e", border: "1px solid #55758f", borderRadius: 16 }}>
      <div style={{ color: "#91caff", letterSpacing: 2, fontWeight: 800 }}>QUECAB ADBS™ · FACILITY ACCESS</div>
      <h1>Set Your Dock Portal Password</h1>
      {done ? <><p>Your password has been saved. You can now sign in to your facility portal.</p><a style={{ color: "#9bc8ff" }} href="/dock">Go to Dock Portal</a></> :
      verified ? <form onSubmit={save}>
        <p>Choose a unique password with at least 12 characters.</p>
        <label htmlFor="new-password">New password</label>
        <input id="new-password" style={input} type="password" autoComplete="new-password" required minLength={12} value={password} onChange={e => setPassword(e.target.value)} />
        <label htmlFor="confirm-password">Confirm password</label>
        <input id="confirm-password" style={input} type="password" autoComplete="new-password" required minLength={12} value={confirm} onChange={e => setConfirm(e.target.value)} />
        <button disabled={busy} style={{ padding: "14px 20px", borderRadius: 8, background: "#21649c", color: "white", border: "1px solid #87b6e0", fontWeight: 700 }}>{busy ? "Saving…" : "Save Password"}</button>
      </form> : <p>Checking your recovery link…</p>}
      {message && <p role="alert" style={{ color: "#ffd7d7" }}>{message}</p>}
      <p><a style={{ color: "#9bc8ff" }} href="/dock">Return to Dock Portal</a></p>
    </div>
  </main>;
}
