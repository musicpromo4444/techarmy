const COURSES = { web: "WEB & APP DEVELOPMENT", automation: "AI AUTOMATION & INTELLIGENCE", creative: "AI CREATIVE PRODUCTION" };
const PRICES = { Starter: 500000, Professional: 1500000, "Master Class": 3000000 };
const GROUP_COLUMNS = {
  web: { Starter: "web_starter_group_url", Professional: "web_professional_group_url", "Master Class": "web_master_group_url" },
  automation: { Starter: "automation_starter_group_url", Professional: "automation_professional_group_url", "Master Class": "automation_master_group_url" },
  creative: { Starter: "creative_starter_group_url", Professional: "creative_professional_group_url", "Master Class": "creative_master_group_url" }
};
async function saveVerifiedPayment(payment) {
  const metadata = payment.metadata || {};
  const chosen = Array.isArray(metadata.selections) && metadata.selections.length ? metadata.selections : [{ course_id: metadata.course_id, level: metadata.level }];
  const seen = new Set();
  if (chosen.length < 1 || chosen.length > 3 || chosen.some(s => { if (!s || !Object.prototype.hasOwnProperty.call(COURSES, s.course_id) || !Object.prototype.hasOwnProperty.call(PRICES, s.level) || seen.has(s.course_id)) return true; seen.add(s.course_id); return false; })) {
    return { ok: false, status: 400, body: { verified: false, error: "Payment does not match valid course selections. Contact support." } };
  }
  const expected = chosen.reduce((sum, s) => sum + PRICES[s.level], 0);
  if (payment.currency !== "NGN" || Number(payment.amount) !== expected) {
    return { ok: false, status: 400, body: { verified: false, error: "Payment amount does not match the selected courses. Contact support." } };
  }
  const first = chosen[0], courseId = first.course_id, level = first.level, courseTitle = COURSES[courseId];
  const classes = chosen.map(s => s.course_id + " :: " + COURSES[s.course_id] + " :: " + s.level);
  const reference = String(payment.reference || "");
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const base = url?.replace(/\/$/, ""), headers = key ? { apikey: key, Authorization: "Bearer " + key } : null;
  const baseBody = { verified: true, reference, amount_naira: Number(payment.amount) / 100, course_id: courseId, course_title: courseTitle, level, classes, course_selections: chosen, student_name: String(metadata.student_name || ""), whatsapp: String(metadata.phone || ""), email: String(payment.customer?.email || "") };
  if (!url || !key) return { ok: false, status: 503, body: { ...baseBody, warning: "Payment is confirmed but enrolment storage is not configured. Contact the academy administrator." } };
  const settingsResponse = await fetch(base + "/rest/v1/tech_army_payment_settings?id=eq.default&select=*", { headers });
  const settingsRows = await settingsResponse.json();
  if (!settingsResponse.ok) return { ok: false, status: 502, body: { ...baseBody, warning: "Payment confirmed, but course invitation settings could not be loaded." } };
  const groupLinks = chosen.map(s => {
    const title = COURSES[s.course_id], column = GROUP_COLUMNS[s.course_id]?.[s.level], groupUrl = column ? settingsRows?.[0]?.[column] || "" : "";
    return groupUrl ? { name: title + " — " + s.level, url: groupUrl } : null;
  }).filter(Boolean);
  const missing = groupLinks.length !== chosen.length;
  const row = {
    payment_reference: reference, student_name: baseBody.student_name.slice(0, 120),
    whatsapp: baseBody.whatsapp.slice(0, 40), email: baseBody.email.slice(0, 180),
    country: String(metadata.country || "").slice(0, 80), classes,
    course_selections: chosen, course_id: courseId, course_title: courseTitle, level,
    amount_kobo: Number(payment.amount), currency: payment.currency, payment_status: "success",
    batch_month: process.env.NEXT_BATCH_MONTH || (() => { const now = new Date(), next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)); return next.toISOString().slice(0, 7); })()
  };
  const saved = await fetch(base + "/rest/v1/tech_army_registrations?on_conflict=payment_reference", {
    method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(row)
  });
  if (!saved.ok) return { ok: false, status: 502, body: { ...baseBody, warning: "Payment confirmed, but saving the enrolment failed. Contact support with your payment reference." } };
  return { ok: true, status: 200, body: { ...baseBody, group_links: groupLinks, warning: missing ? "One or more course invitations are not configured. The admin will send the missing link." : "" } };
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
