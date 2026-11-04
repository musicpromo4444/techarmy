const COURSES = { web: "WEB & APP DEVELOPMENT", automation: "AI AUTOMATION & INTELLIGENCE", creative: "AI CREATIVE PRODUCTION" };
const PRICES = { Starter: 500000, Professional: 1500000, "Master Class": 3000000 };
const GROUP_COLUMNS = {
  web: { Starter: "web_starter_group_url", Professional: "web_professional_group_url", "Master Class": "web_master_group_url" },
  automation: { Starter: "automation_starter_group_url", Professional: "automation_professional_group_url", "Master Class": "automation_master_group_url" },
  creative: { Starter: "creative_starter_group_url", Professional: "creative_professional_group_url", "Master Class": "creative_master_group_url" }
};
async function saveVerifiedPayment(payment, res) {
  const metadata = payment.metadata || {};
  const courseId = String(metadata.course_id || ""), level = String(metadata.level || "");
  const courseTitle = COURSES[courseId];
  const expected = PRICES[level];
  if (!courseTitle || !expected || payment.currency !== "NGN" || Number(payment.amount) !== expected) {
    return { ok: false, status: 400, body: { verified: false, error: "Payment details do not match a valid Tech Army course and level. Contact support." } };
  }
  const reference = String(payment.reference || "");
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, status: 503, body: { verified: true, reference, amount_naira: Number(payment.amount) / 100, course_id: courseId, course_title: courseTitle, level, student_name: String(metadata.student_name || ""), whatsapp: String(metadata.phone || ""), email: String(payment.customer?.email || ""), warning: "Payment is confirmed but enrolment storage is not configured. Contact the academy administrator." } };
  const base = url.replace(/\/$/, ""), headers = { apikey: key, Authorization: "Bearer " + key };
  const settingsResponse = await fetch(base + "/rest/v1/tech_army_payment_settings?id=eq.default&select=*", { headers });
  const settingsRows = await settingsResponse.json();
  if (!settingsResponse.ok) return { ok: false, status: 502, body: { verified: true, reference, amount_naira: Number(payment.amount) / 100, course_id: courseId, course_title: courseTitle, level, student_name: String(metadata.student_name || ""), whatsapp: String(metadata.phone || ""), email: String(payment.customer?.email || ""), warning: "Payment confirmed, but course invitation settings could not be loaded." } };
  const column = GROUP_COLUMNS[courseId][level], groupUrl = settingsRows?.[0]?.[column] || "";
  const row = {
    payment_reference: reference,
    student_name: String(metadata.student_name || "").slice(0, 120),
    whatsapp: String(metadata.phone || "").slice(0, 40),
    email: String(payment.customer?.email || "").slice(0, 180),
    country: String(metadata.country || "").slice(0, 80),
    classes: [courseId + " :: " + courseTitle + " :: " + level],
    course_id: courseId, course_title: courseTitle, level,
    amount_kobo: Number(payment.amount), currency: payment.currency, payment_status: "success",
    batch_month: process.env.NEXT_BATCH_MONTH || (() => { const now = new Date(), next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)); return next.toISOString().slice(0, 7); })()
  };
  const saved = await fetch(base + "/rest/v1/tech_army_registrations?on_conflict=payment_reference", {
    method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(row)
  });
  if (!saved.ok) return { ok: false, status: 502, body: { verified: true, reference, amount_naira: Number(payment.amount) / 100, course_id: courseId, course_title: courseTitle, level, student_name: row.student_name, whatsapp: row.whatsapp, email: row.email, warning: "Payment confirmed, but saving the enrolment failed. Contact support with your payment reference." } };
  return { ok: true, status: 200, body: { verified: true, reference, amount_naira: Number(payment.amount) / 100, course_id: courseId, course_title: courseTitle, level, student_name: row.student_name, whatsapp: row.whatsapp, email: row.email, classes: row.classes, group_links: groupUrl ? [{ name: courseTitle + " — " + level, url: groupUrl }] : [], warning: groupUrl ? "" : "Your payment is confirmed. The admin will send your course group invitation shortly." } };
}
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const reference = String(req.query.reference || "");
  if (!reference || reference.length > 100) return res.status(400).json({ error: "A valid payment reference is required." });
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return res.status(503).json({ error: "Payment verification is not configured." });
  try {
    const response = await fetch("https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference), { headers: { Authorization: "Bearer " + secret } });
    const result = await response.json();
    if (!response.ok || !result.status || result.data?.status !== "success" || result.data?.reference !== reference) return res.status(402).json({ verified: false, error: "Payment has not been confirmed by Paystack." });
    const saved = await saveVerifiedPayment(result.data);
    return res.status(saved.status).json(saved.body);
  } catch { return res.status(500).json({ verified: false, error: "Could not verify this payment right now." }); }
}
