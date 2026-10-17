// /src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ThemeProvider } from "./theme/ThemeProvider.jsx";
import "./theme/theme.css";

function showFatal(message) {
  try {
    const root = document.getElementById("root");
    if (!root) return;

    root.innerHTML = `
      <div style="
        min-height:100vh;
        background:#0f1722;
        color:#e6edf5;
        padding:18px 16px;
        font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
        <div style="
          max-width:980px;
          margin:0 auto;
          border:1px solid rgba(255,90,90,0.35);
          background:rgba(0,0,0,0.25);
          border-radius:14px;
          padding:16px;
          box-shadow:0 16px 34px rgba(0,0,0,0.30);">
          <div style="font-size:18px;font-weight:950;margin:0 0 6px;">
            QueCab AdbS — Startup Error
          </div>
          <div style="font-size:13px;opacity:0.75;margin:0 0 12px;">
            Copy the message below and send it to me.
          </div>
          <pre style="
            margin:0;
            white-space:pre-wrap;
            font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
            font-size:13px;
            line-height:1.35;
            opacity:0.92;">${String(message || "Unknown error")}</pre>
          <div style="margin-top:12px; font-size:12px; opacity:0.7;">
            Tip: If this screen shows up, the app is crashing before it can render.
          </div>
        </div>
      </div>
    `;
  } catch {}
}

window.addEventListener("error", (e) => {
  const msg = e?.error?.message || e?.message || "Script error.";
  showFatal(msg);
});

window.addEventListener("unhandledrejection", (e) => {
  const msg = e?.reason?.message || String(e?.reason || "Unhandled rejection.");
  showFatal(msg);
});

try {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <ThemeProvider>
        <div className="qc-app-shell">
          <App />
        </div>
      </ThemeProvider>
    </React.StrictMode>
  );
} catch (e) {
  showFatal(e?.message || String(e));
}
