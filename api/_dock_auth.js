export async function getDockUser(req, admin) {
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const { data, error } = await admin.auth.getUser(authorization.slice(7));
  return error ? null : data?.user || null;
}

export async function getAssignedDockLink(admin, token, user) {
  const { data: link, error } = await admin.from("verify_links")
    .select("token,facility_id,status,starts_at,expires_at,driver_phone,carrier_company,dispatch_contact,dispatch_phone,issued_by_email,load_id,broker_acknowledged_at")
    .eq("token", token).maybeSingle();
  if (error) throw error;
  if (!link?.facility_id) return null;
  const { data: membership, error: memberError } = await admin.from("adbs_facility_members")
    .select("facility_id").eq("facility_id", link.facility_id).eq("user_id", user.id).maybeSingle();
  if (memberError) throw memberError;
  return membership ? link : null;
}
