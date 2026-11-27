// Retired legacy endpoint. All verification attempts must use the atomic verification API.
export default function handler(req,res) {
  res.setHeader("Cache-Control","no-store");
  return res.status(410).json({ok:false,error:"Legacy verification retired. Reopen the current AdbS verification page."});
}
