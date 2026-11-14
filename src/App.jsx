import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Join from "./pages/Join.jsx";
import HowItWorks from "./pages/HowItWorks.jsx";
import ControlCenter from "./pages/ControlCenter.jsx";
import Admin from "./pages/Admin.jsx";
import Feedback from "./pages/Feedback.jsx";
import LiveActivity from "./pages/LiveActivity.jsx";
import LiveSessions from "./pages/LiveSessions.jsx";
import Account from "./pages/Account.jsx";
import BetaNotice from "./pages/BetaNotice.jsx";
import Pricing from "./pages/Pricing.jsx";
import DockPortal from "./pages/DockPortal.jsx";

import Footer from "./components/Footer.jsx";
import RequireActiveSubscription from "./components/RequireActiveSubscription.jsx";

function Protected({ children }) {
  return (
    <RequireActiveSubscription>
      {children}
    </RequireActiveSubscription>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Home />} />

            <Route
              path="/dashboard"
              element={
                <Protected>
                  <ControlCenter />
                </Protected>
              }
            />

            <Route
              path="/control-center"
              element={
                <Protected>
                  <ControlCenter />
                </Protected>
              }
            />

            <Route path="/dock" element={<DockPortal />} />
            <Route path="/login" element={<Login />} />
            <Route path="/join" element={<Join />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/how-it-works" element={<HowItWorks />} />

            <Route path="/admin" element={<Admin />} />
            <Route path="/feedback" element={<Feedback />} />

            <Route
              path="/activity"
              element={
                <Protected>
                  <LiveActivity />
                </Protected>
              }
            />

            <Route
              path="/live"
              element={
                <Protected>
                  <LiveSessions />
                </Protected>
              }
            />

            <Route
              path="/account"
              element={
                <Protected>
                  <Account />
                </Protected>
              }
            />

            <Route path="/beta-notice" element={<BetaNotice />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </div>

        <Footer />
      </div>
    </BrowserRouter>
  );
}
