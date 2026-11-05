import { normalizeWhatsApp } from "../_lib/phone.js";
import { randomUUID } from "node:crypto";
const COURSES = { web: "WEB & APP DEVELOPMENT", automation: "AI AUTOMATION & INTELLIGENCE", creative: "AI CREATIVE PRODUCTION" };
const PRICES = { Starter: 500000, Professional: 1500000, "Master Class": 3000000 };
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "Direct bank transfer is not configured yet." });
  const { name, phone, country_code, email, country, selections, course_id, level } = req.body || {};
  const normalizedPhone = normalizeWhatsApp(phone, country_code);
  const chosen = Array.isArray(selections) && selections.length ? selections : [{ course_id, level }];
  const seen = new Set();
  if (typeof name !== "string" || !name.trim() || name.length > 120 || !normalizedPhone ||
      (email != null && (typeof email !== "string" || email.length > 180)) ||
      typeof country !== "string" || !country.trim() || country.length > 80 ||
      chosen.length < 1 || chosen.length > 3 ||
      chosen.some(s => { if (!s || !Object.prototype.hasOwnProperty.call(COURSES, s.course_id) || !Object.prototype.hasOwnProperty.call(PRICES, s.level) || seen.has(s.course_id)) return true; seen.add(s.course_id); return false; })) {
    return res.status(400).json({ error: "Enter valid details and choose one level for each course." });
  }
  const base = url.replace(/\/$/, ""), headers = { apikey: key, Authorization: "Bearer " + key };
  try {
    const sr = await fetch(base + "/rest/v1/tech_army_payment_settings?id=eq.default&select=*", { headers });
    const settingsRows = await sr.json(), settings = settingsRows?.[0];
    if (!sr.ok) return res.status(502).json({ error: "Could not load bank-transfer settings." });
    if (!settings?.bank_name || !settings?.account_name || !settings?.account_number) return res.status(409).json({ error: "Admin bank details are not configured yet. Please contact the admin." });
    const first = chosen[0], courseTitle = COURSES[first.course_id], amount = chosen.reduce((sum, s) => sum + PRICES[s.level], 0);
    const classes = chosen.map(s => s.course_id + " :: " + COURSES[s.course_id] + " :: " + s.level);
    const reference = "TA-" + randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase();
    const payload = { reference, student_name: name.trim(), whatsapp: normalizedPhone, email: email?.trim().toLowerCase() || null, country: country.trim(), classes, course_selections: chosen, course_id: first.course_id, course_title: courseTitle, level: first.level, amount_kobo: amount, status: "pending" };
    const created = await fetch(base + "/rest/v1/tech_army_manual_payments", { method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(payload) });
    const rows = await created.json();
    if (!created.ok || !rows?.[0]) return res.status(502).json({ error: "We could not save your registration. Please try again." });
    return res.status(201).json({ payment: { ...rows[0], bank_account: { bank_name: settings.bank_name, account_name: settings.account_name, account_number: settings.account_number }, admin_whatsapp: settings.admin_whatsapp || "2347017036508" } });
  } catch { return res.status(500).json({ error: "Unable to prepare your bank transfer right now." }); }
}
