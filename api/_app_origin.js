export function appOrigin() {
  return process.env.ADBS_APP_ORIGIN ||
    (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.VERCEL_ENV === "production" ? "https://quecabadbs.com" : "http://localhost:3000");
}

export function verificationUrl(token) {
  return new URL(`/v.html?t=${encodeURIComponent(token)}`, appOrigin()).href;
}
