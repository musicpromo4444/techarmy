import { normalizeWhatsApp } from "../_lib/phone.js";

const COURSES = {
  web: "WEB & APP DEVELOPMENT",
  automation: "AI AUTOMATION & INTELLIGENCE",
  creative: "AI CREATIVE PRODUCTION"
};
const LEVELS = new Set(["Starter", "Professional", "Master Class"]);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(503).json({ error: "Enquiry service is not configured. Please contact the academy on WhatsApp." });
  }

  const {
    name, phone, country_code, email, country,
    selections, course_id, level
  } = req.body || {};
  const normalizedPhone = normalizeWhatsApp(phone, country_code);
  const chosen = Array.isArray(selections) && selections.length
    ? selections
    : [{ course_id, level }];
  const seen = new Set();

  const invalidSelection = chosen.length < 1 || chosen.length > 3 || chosen.some(selection => {
    if (!selection ||
        !Object.prototype.hasOwnProperty.call(COURSES, selection.course_id) ||
        !LEVELS.has(selection.level) ||
        seen.has(selection.course_id)) return true;
    seen.add(selection.course_id);
    return false;
  });

  if (typeof name !== "string" || !name.trim() || name.length > 120 ||
      !normalizedPhone ||
      (email != null && (typeof email !== "string" || email.length > 180)) ||
      typeof country !== "string" || !country.trim() || country.length > 80 ||
      invalidSelection) {
    return res.status(400).json({ error: "Please complete your details and choose a valid level for each course." });
  }

  const classes = chosen.map(selection =>
    selection.course_id + " :: " + COURSES[selection.course_id] + " :: " + selection.level
  );
  const first = chosen[0];

  try {
    const response = await fetch(url.replace(/\/$/, "") + "/rest/v1/tech_army_enquiries", {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        student_name: name.trim(),
        whatsapp: normalizedPhone,
        email: email?.trim().toLowerCase() || null,
        country: country.trim(),
        classes,
        course_id: first.course_id,
        course_title: COURSES[first.course_id],
        level: first.level,
        status: "pending"
      })
    });

    if (!response.ok) {
      return res.status(502).json({ error: "We could not save your enquiry. Please contact the admin directly." });
    }
    const rows = await response.json();
    return res.status(201).json({
      saved: true,
      enquiry_id: rows?.[0]?.id || null,
      classes
    });
  } catch {
    return res.status(500).json({ error: "Unable to save your enquiry right now." });
  }
}
