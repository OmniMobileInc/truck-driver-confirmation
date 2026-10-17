import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle.jsx";

export default function Home() {
  return (
    <div style={styles.wrapper}>
      <ThemeToggle className="qc-theme-toggle--home" />
      <div style={styles.steelGlow} />
      <div style={styles.gridOverlay} />

      <div style={styles.container}>
        <div style={styles.logoWrap}>
          <img
            src="/qc-logo.png"
            alt="QueCab AdbS Anti Double Brokering System"
            style={styles.logo}
          />
        </div>

        <div style={styles.kicker}>PRE-LOAD TRUCK-DRIVER VERIFICATION</div>

        <div style={styles.heroTitle}>
          QueCab AdbS<sup style={{ fontSize: "0.35em", verticalAlign: "super" }}>™</sup> is the Broker&apos;s Eyes at the Dock<sup style={{ fontSize: "0.35em", verticalAlign: "super" }}>™</sup>.
        </div>

        <div style={styles.heroSub}>
          Verify the assigned Truck-Driver before freight is loaded to help
          reduce the risk of double brokering, carrier impersonation, deceptive
          pickups, and cargo fraud.
        </div>

        <div style={styles.verdictPanel}>
          <div style={styles.clearBox}>CLEAR TO LOAD</div>
          <div style={styles.verdictDivider}>OR</div>
          <div style={styles.cautionBox}>CAUTION — DO NOT LOAD</div>
        </div>

        <div style={styles.sectionGrid}>
          <div style={styles.card}>
            <div style={styles.cardTitle}>Request Beta Access</div>

            <div style={styles.cardText}>
              Freight broker beta access is reviewed before approval. Submit
              your business details to begin using pre-load Truck-Driver
              verification.
            </div>

            <Link to="/join" style={styles.primaryBtn}>
              Request Access
            </Link>
          </div>

          <div style={styles.card}>
            <div style={styles.cardTitle}>Already Authorized?</div>

            <div style={styles.cardText}>
              Enter with your approved business email and QueCab AdbS access
              code to manage secure load-verification activity.
            </div>

            <Link to="/login" style={styles.primaryBtn}>
              Log In
            </Link>
          </div>

          <div style={styles.card}>
            <div style={styles.cardTitle}>How It Works</div>

            <div style={styles.cardText}>
              See how real-time dock verification compares the assigned
              Truck-Driver with what is physically present before freight is
              loaded.
            </div>

            <Link to="/how-it-works" style={styles.primaryBtn}>
              View Process
            </Link>
          </div>
        </div>

        <div style={styles.pricingWrap}>
          <div style={styles.pricingTitle}>Founding Beta Access</div>
          <div style={styles.betaPrice}>$49/month during beta</div>

          <div style={styles.betaText}>
            Unlimited Truck-Driver verifications during beta
            <br />
            Founding-user pricing
            <br />
            Early feature access
            <br />
            Direct founder support
          </div>

          <div style={styles.futurePricing}>
            Future pricing begins at $149/month.
          </div>

          <div style={styles.tierGrid}>
            {[
              ["Starter", "$149/month", "Up to 100 verifications"],
              ["Growth", "$249/month", "Up to 250 verifications"],
              ["Pro", "$399/month", "Up to 500 verifications"],
              ["Scale", "$599/month", "Up to 1,000 verifications"],
              ["Enterprise", "Custom", "High-volume broker operations"],
            ].map(([name, price, desc]) => (
              <div style={styles.tierCard} key={name}>
                <div style={styles.tierName}>{name}</div>
                <div style={styles.tierPrice}>{price}</div>
                <div style={styles.tierDesc}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.footerText}>
          QueCab AdbS™ — The Broker&apos;s Eyes at the Dock™. Secure Your
          Load™ before freight moves.
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    position: "relative",
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #070b11 0%, #0d1522 48%, #111d2c 100%)",
    overflow: "hidden",
    padding: "28px 18px 80px",
  },
  steelGlow: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at top, rgba(0,85,190,0.24), transparent 38%), radial-gradient(circle at bottom right, rgba(120,160,210,0.10), transparent 34%)",
  },
  gridOverlay: {
    position: "absolute",
    inset: 0,
    opacity: 0.08,
    backgroundImage:
      "linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)",
    backgroundSize: "42px 42px",
  },
  container: {
    position: "relative",
    zIndex: 2,
    maxWidth: 1180,
    margin: "0 auto",
    color: "#ffffff",
  },
  logoWrap: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    margin: "70px auto 18px",
    overflow: "hidden",
  },
  logo: {
    width: "min(950px, 96vw)",
    maxWidth: "96vw",
    height: "auto",
    display: "block",
    objectFit: "contain",
  },
  kicker: {
    textAlign: "center",
    color: "#8fc7ff",
    fontWeight: 900,
    letterSpacing: 2,
    fontSize: 13,
    marginBottom: 14,
  },
  heroTitle: {
    textAlign: "center",
    fontSize: 44,
    fontWeight: 950,
    lineHeight: 1.08,
    maxWidth: 920,
    margin: "0 auto",
  },
  heroSub: {
    textAlign: "center",
    marginTop: 18,
    fontSize: 18,
    lineHeight: 1.55,
    color: "#cbd7e8",
    maxWidth: 820,
    marginLeft: "auto",
    marginRight: "auto",
  },
  verdictPanel: {
    margin: "36px auto 0",
    maxWidth: 820,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.045)",
    boxShadow: "0 18px 42px rgba(0,0,0,0.36)",
  },
  clearBox: {
    padding: "18px 18px",
    borderRadius: 14,
    border: "1px solid rgba(90,220,130,0.46)",
    background:
      "linear-gradient(180deg, rgba(25,110,55,0.45), rgba(8,45,24,0.58))",
    fontWeight: 950,
    fontSize: 19,
    textAlign: "center",
  },
  cautionBox: {
    padding: "18px 18px",
    borderRadius: 14,
    border: "1px solid rgba(255,95,95,0.48)",
    background:
      "linear-gradient(180deg, rgba(130,28,28,0.46), rgba(64,12,12,0.60))",
    fontWeight: 950,
    fontSize: 19,
    textAlign: "center",
  },
  verdictDivider: {
    color: "#94a8c2",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 1,
  },
  sectionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 18,
    marginTop: 44,
  },
  card: {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.065), rgba(255,255,255,0.035))",
    border: "1px solid rgba(255,255,255,0.13)",
    borderRadius: 18,
    padding: 24,
    boxShadow: "0 14px 34px rgba(0,0,0,0.32)",
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 950,
    marginBottom: 10,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 1.6,
    color: "#d6dfeb",
    marginBottom: 18,
  },
  primaryBtn: {
    display: "inline-block",
    padding: "13px 22px",
    borderRadius: 12,
    background:
      "linear-gradient(180deg, rgba(52,120,205,0.72), rgba(26,72,130,0.86))",
    border: "1px solid rgba(140,195,255,0.55)",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    fontSize: 15,
    boxShadow: "0 10px 22px rgba(0,0,0,0.26)",
  },
  pricingWrap: {
    marginTop: 60,
    padding: 28,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.13)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.065), rgba(255,255,255,0.035))",
    boxShadow: "0 18px 44px rgba(0,0,0,0.34)",
  },
  pricingTitle: {
    textAlign: "center",
    fontSize: 34,
    fontWeight: 950,
  },
  betaPrice: {
    textAlign: "center",
    fontSize: 40,
    fontWeight: 950,
    marginTop: 10,
    color: "#8fc7ff",
  },
  betaText: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 1.9,
    color: "#d5e1f0",
  },
  futurePricing: {
    marginTop: 22,
    textAlign: "center",
    fontSize: 18,
    fontWeight: 850,
    color: "#ffffff",
  },
  tierGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 16,
    marginTop: 34,
  },
  tierCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(3,9,18,0.32)",
    padding: 22,
    textAlign: "center",
  },
  tierName: {
    fontSize: 22,
    fontWeight: 950,
  },
  tierPrice: {
    fontSize: 28,
    fontWeight: 950,
    marginTop: 12,
    color: "#8fc7ff",
  },
  tierDesc: {
    marginTop: 12,
    color: "#d2dceb",
    lineHeight: 1.5,
  },
  footerText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
    color: "#b9c7da",
  },
};
