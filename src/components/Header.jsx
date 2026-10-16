import React from "react";
import { Link } from "react-router-dom";
import { clearAuth, getAuthEmail } from "../utils/auth.js";

function logout() {
  clearAuth();
  window.location.href = "/login";
}

export default function Header() {
  const signedIn = !!getAuthEmail();

  return (
    <div style={styles.header}>
      <div style={styles.left}>
        <Link to="/" style={styles.brand}>
          QueCab AdbS
        </Link>
      </div>

      <div style={styles.right}>
        {signedIn ? (
          <>
            <Link to="/dashboard" style={styles.link}>
              Control Center
            </Link>

            <Link to="/live" style={styles.link}>
              Live Sessions
            </Link>

            <Link to="/activity" style={styles.link}>
              Live Activity
            </Link>

            <Link to="/pricing" style={styles.link}>
              Pricing
            </Link>

            <Link to="/how-it-works" style={styles.link}>
              How It Works
            </Link>

            <Link to="/feedback" style={styles.link}>
              Feedback
            </Link>

            <Link to="/account" style={styles.link}>
              Account
            </Link>

            <Link to="/admin" style={styles.link}>
              Admin
            </Link>

            <button onClick={logout} style={styles.logoutBtn}>
              Log Out
            </button>
          </>
        ) : (
          <>
            <Link to="/how-it-works" style={styles.link}>
              How It Works
            </Link>

            <Link to="/pricing" style={styles.link}>
              Pricing
            </Link>

            <Link to="/join" style={styles.link}>
              Request Access
            </Link>

            <Link to="/login" style={styles.link}>
              Log In
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    background: "rgba(12,18,28,0.94)",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    backdropFilter: "blur(8px)"
  },

  left: {
    display: "flex",
    alignItems: "center"
  },

  brand: {
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 18,
    fontWeight: 900
  },

  right: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    justifyContent: "flex-end"
  },

  link: {
    color: "#e6edf5",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 800
  },

  logoutBtn: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer"
  }
};
