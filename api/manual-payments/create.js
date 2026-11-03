import { normalizeWhatsApp } from "../_lib/phone.js";
import { randomUUID } from "node:crypto";
const ALLOWED = new Set(["Starter", "Professional", "Master Class"]);
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "Manual payment service is not configured yet." });
  const { name, phone, country_code, email, country, classes } = req.body || {};
  const normalizedPhone = normalizeWhatsApp(phone, country_code);
  if (!normalizedPhone) return res.status(400).json({ error: "Enter a valid WhatsApp number for the selected country code." });
  if (![name, phone, country].every(v => typeof v === "string" && v.trim()) || !Array.isArray(classes) || !classes.length || classes.length > 2 || classes.some(c => !ALLOWED.has(c))) return res.status(400).json({ error: "Enter your name and WhatsApp number and select at least one valid class." });
  if (name.length > 120 || phone.length > 40 || (email && email.length > 180) || country.length > 80) return res.status(400).json({ error: "One or more fields are too long." });
  const base = url.replace(/\/$/, ""), headers = { apikey: key, Authorization: "Bearer " + key };
  try {
    const sr = await fetch(base + "/rest/v1/tech_army_payment_settings?id=eq.default&select=*", { headers });
    const settingsRows = await sr.json();
    if (!sr.ok) return res.status(502).json({ error: "Could not load bank-transfer settings." });
    const settings = settingsRows?.[0];
    if (!settings?.bank_name || !settings?.account_name || !settings?.account_number) return res.status(409).json({ error: "Bank-transfer details are not available yet. Please use Paystack or contact the admin." });
    const prices = { "Starter": 500000, "Professional": 1500000, "Master Class": 3000000 };
    const amount = classes.reduce((sum, c) => sum + prices[c], 0);
    const reference = "TA-" + randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase();
    const payload = { reference, student_name: name.trim(), whatsapp: normalizedPhone, email: email?.trim().toLowerCase() || null, country: country.trim(), classes: [...new Set(classes)], amount_kobo: amount, status: "pending" };
    const created = await fetch(base + "/rest/v1/tech_army_manual_payments", { method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(payload) });
    const rows = await created.json();
    if (!created.ok || !rows?.[0]) return res.status(502).json({ error: "We could not save your registration. Please try again." });
    return res.status(201).json({ payment: { ...rows[0], bank_account: { bank_name: settings.bank_name, account_name: settings.account_name, account_number: settings.account_number }, admin_whatsapp: settings.admin_whatsapp || "2347017036508", general_group_url: settings.general_group_url || null } });
  } catch { return res.status(500).json({ error: "Unable to prepare your bank transfer right now." }); }
}