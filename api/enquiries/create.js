import { normalizeWhatsApp } from "../_lib/phone.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "Enquiry service is not configured yet. Please contact the academy on WhatsApp." });
  const { name, phone, country_code, email, country, classes } = req.body || {};
  const normalizedPhone = normalizeWhatsApp(phone, country_code);
  if (!normalizedPhone) return res.status(400).json({ error: "Enter a valid WhatsApp number for the selected country code." });
  if (![name, phone, email, country].every(v => typeof v === "string" && v.trim()) || !Array.isArray(classes) || classes.length !== 1 || classes.some(c => typeof c !== "string" || c.length > 180)) return res.status(400).json({ error: "Please complete your details and choose at least one valid class." });
  if (name.length > 120 || phone.length > 40 || email.length > 180 || country.length > 80) return res.status(400).json({ error: "One or more fields are too long." });
  try {
    const response = await fetch(url.replace(/\/$/, "") + "/rest/v1/tech_army_enquiries", { method: "POST", headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ student_name: name.trim(), whatsapp: normalizedPhone, email: email.trim().toLowerCase(), country: country.trim(), classes: [...new Set(classes)], status: "pending" }) });
    if (!response.ok) return res.status(502).json({ error: "We could not save your enquiry. Please contact the admin directly." });
    const rows = await response.json();
    return res.status(201).json({ saved: true, enquiry_id: rows?.[0]?.id || null });
  } catch { return res.status(500).json({ error: "Unable to save your enquiry right now." }); }
}
