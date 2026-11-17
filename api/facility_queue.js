import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const reply=(res,code,data)=>{res.setHeader("Cache-Control","no-store");return res.status(code).json(data)};
export default async function handler(req,res){
  if(req.method!=="GET")return reply(res,405,{error:"Method not allowed"});
  const bearer=String(req.headers.authorization||"");
  if(!bearer.startsWith("Bearer "))return reply(res,401,{error:"Sign in required"});
  const token=bearer.slice(7);
  const {data:{user}={},error:authError}=await admin.auth.getUser(token);
  if(authError||!user)return reply(res,401,{error:"Session expired"});
  const {data:memberships,error:memberError}=await admin.from("adbs_facility_members").select("facility_id").eq("user_id",user.id);
  if(memberError)return reply(res,503,{error:"Facility access is not configured"});
  const ids=(memberships||[]).map(m=>m.facility_id);
  if(!ids.length)return reply(res,403,{error:"No facility access assigned. Contact your facility administrator."});
  const facility=String(req.query.facility_id||ids[0]);
  if(!ids.includes(facility))return reply(res,403,{error:"Not authorized for this facility"});
  const {data:loads,error:loadError}=await admin.from("verify_links")
    .select("token,load_id,carrier_company,status,starts_at,expires_at,created_at")
    .eq("facility_id",facility).order("created_at",{ascending:false}).limit(100);
  if(loadError)return reply(res,503,{error:"Unable to load facility queue"});
  // Do not expose driver phone, expected DOT/plate, PIN, or other brokers' records.
  return reply(res,200,{facility_id:facility,facilities:ids,loads:loads||[]});
}
