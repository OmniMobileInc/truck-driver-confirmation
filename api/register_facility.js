import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(res, code, obj) {
  res.status(code).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

function clean(v) {
  return String(v ?? "").trim();
}

function makeFacilityId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return `QC-FAC-${code}`;
}

async function createUniqueFacilityId() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const facilityId = makeFacilityId();

    const { data, error } = await supabase
      .from("adbs_facilities")
      .select("id")
      .eq("facility_id", facilityId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Could not check Facility ID.");
    }

    if (!data) {
      return facilityId;
    }
  }

  throw new Error("Could not generate a unique Facility ID.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, {
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    const body = req.body || {};

    const facility_name = clean(body.facility_name);
    const street_address = clean(body.street_address);
    const city = clean(body.city);
    const state = clean(body.state).toUpperCase();
    const zip_code = clean(body.zip_code);
    const primary_contact = clean(body.primary_contact);
    const contact_email = clean(body.contact_email).toLowerCase();
    const contact_phone = clean(body.contact_phone);

    if (
      !facility_name ||
      !street_address ||
      !city ||
      !state ||
      !zip_code ||
      !primary_contact ||
      !contact_email ||
      !contact_phone
    ) {
      return json(res, 400, {
        ok: false,
        error: "All facility registration fields are required."
      });
    }

    const facility_id = await createUniqueFacilityId();

    const payload = {
      facility_id,
      facility_name,
      street_address,
      city,
      state,
      zip_code,
      primary_contact,
      contact_email,
      contact_phone,
      status: "active"
    };

    const { data, error } = await supabase
      .from("adbs_facilities")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return json(res, 500, {
        ok: false,
        error: error.message || "Could not register facility."
      });
    }

    return json(res, 201, {
      ok: true,
      facility: data
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: String(e?.message || "Server error")
    });
  }
}
