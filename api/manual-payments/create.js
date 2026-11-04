import { normalizeWhatsApp } from "../_lib/phone.js";
import { randomUUID } from "node:crypto";
const COURSES = { web: "WEB & APP DEVELOPMENT", automation: "AI AUTOMATION & INTELLIGENCE", creative: "AI CREATIVE PRODUCTION" };
const PRICES = { Starter: 500000, Professional: 1500000, "Master Class": 3000000 };
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "Direct bank transfer is not configured yet." });
  const { name, phone, country_code, email, country, course_id, level } = req.body || {};
  const normalizedPhone = normalizeWhatsApp(phone, country_code);
  if (typeof name !== "string" || !name.trim() || name.length > 120 || !normalizedPhone ||
      (email != null && (typeof email !== "string" || email.length > 180)) ||
      typeof country !== "string" || !country.trim() || country.length > 80 ||
      !Object.prototype.hasOwnProperty.call(COURSES, course_id) || !Object.prototype.hasOwnProperty.call(PRICES, level)) {
    return res.status(400).json({ error: "Enter valid details and choose one course and one level." });
  }
  const base = url.replace(/\/$/, ""), headers = { apikey: key, Authorization: "Bearer " + key };
  try {
    const sr = await fetch(base + "/rest/v1/tech_army_payment_settings?id=eq.default&select=*", { headers });
    const settingsRows = await sr.json(), settings = settingsRows?.[0];
    if (!sr.ok) return res.status(502).json({ error: "Could not load bank-transfer settings." });
    if (!settings?.bank_name || !settings?.account_name || !settings?.account_number) return res.status(409).json({ error: "Admin bank details are not configured yet. Please contact the admin." });
    const courseTitle = COURSES[course_id], amount = PRICES[level];
    const selection = course_id + " :: " + courseTitle + " :: " + level;
    const reference = "TA-" + randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase();
    const payload = { reference, student_name: name.trim(), whatsapp: normalizedPhone, email: email?.trim().toLowerCase() || null, country: country.trim(), classes: [selection], course_id, course_title: courseTitle, level, amount_kobo: amount, status: "pending" };
    const created = await fetch(base + "/rest/v1/tech_army_manual_payments", { method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(payload) });
    const rows = await created.json();
    if (!created.ok || !rows?.[0]) return res.status(502).json({ error: "We could not save your registration. Please try again." });
    return res.status(201).json({ payment: { ...rows[0], bank_account: { bank_name: settings.bank_name, account_name: settings.account_name, account_number: settings.account_number }, admin_whatsapp: settings.admin_whatsapp || "2347017036508" } });
  } catch { return res.status(500).json({ error: "Unable to prepare your bank transfer right now." }); }
}
