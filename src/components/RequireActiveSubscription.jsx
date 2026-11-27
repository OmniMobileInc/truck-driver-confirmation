import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getAuthCode, getAuthEmail } from "../utils/auth.js";

function clean(v) {
  return String(v || "").trim().toLowerCase();
}

export default function RequireActiveSubscription({ children }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    checkSubscription();
  }, []);

  async function checkSubscription() {
    try {
      const email = clean(getAuthEmail());

      if (!email) {
        setAllowed(false);
        setLoading(false);
        return;
      }

      const res = await fetch("/api/check_subscription", {
        method: "POST",
        headers: { "x-adbs-broker-email": email, "x-adbs-broker-code": getAuthCode() }
      });

      const data = await res.json();
      setAllowed(res.ok && data?.allowed === true);
    } catch (err) {
      console.log("Subscription gate error:", err);
      setAllowed(false);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        Verifying account access...
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/pricing" replace />;
  }

  return children;
}

const styles = {
  loadingPage: {
    minHeight: "100vh",
    background: "#0c121c",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 800
  }
};
