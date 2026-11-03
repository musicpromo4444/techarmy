import { createHmac, timingSafeEqual } from "node:crypto";
export const config = { api: { bodyParser: false } };
const PRICES = { "Starter": 500000, "Professional": 1500000, "Master Class": 3000000 };
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return res.status(503).json({ error: "Webhook is not configured" });
  try {
    const raw = await readRawBody(req);
    const supplied = String(req.headers["x-paystack-signature"] || "");
    const expected = createHmac("sha512", secret).update(raw).digest("hex");
    const a = Buffer.from(supplied, "hex"), b = Buffer.from(expected, "hex");
    if (!supplied || a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ error: "Invalid webhook signature" });
    const event = JSON.parse(raw.toString("utf8"));
    if (event.event !== "charge.success" || !event.data?.reference) return res.status(200).json({ received: true });
    const reference = String(event.data.reference);
    const verifiedResponse = await fetch("https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference), {
      headers: { Authorization: "Bearer " + secret }
    });
    const verified = await verifiedResponse.json();
    const payment = verified.data;
    if (!verifiedResponse.ok || !verified.status || payment?.status !== "success" || payment.reference !== reference || payment.currency !== "NGN") {
      return res.status(400).json({ error: "Paystack transaction could not be verified" });
    }
    const metadata = payment.metadata || {};
    const classes = [...new Set(Array.isArray(metadata.classes) ? metadata.classes : String(metadata.classes || "").split(",").map(x => x.trim()).filter(Boolean))];
    if (classes.length < 1 || classes.length > 2) return res.status(400).json({ error: "Invalid package selection" });
    const expectedAmount = classes.reduce((sum, name) => sum + (PRICES[name] || 0), 0);
    if (!expectedAmount || Number(payment.amount) !== expectedAmount) return res.status(400).json({ error: "Payment amount does not match package selection" });
    const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return res.status(503).json({ error: "Enrolment database is not configured" });
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const row = {
      payment_reference: reference,
      student_name: String(metadata.student_name || "").slice(0, 120),
      whatsapp: String(metadata.phone || "").slice(0, 40),
      email: String(payment.customer?.email || "").slice(0, 180),
      country: String(metadata.country || "").slice(0, 80),
      classes,
      amount_kobo: Number(payment.amount),
      currency: payment.currency,
      payment_status: "success",
      batch_month: process.env.NEXT_BATCH_MONTH || next.toISOString().slice(0, 7)
    };
    const saved = await fetch(url.replace(/\/$/, "") + "/rest/v1/tech_army_registrations?on_conflict=payment_reference", {
      method: "POST",
      headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(row)
    });
    if (!saved.ok) return res.status(502).json({ error: "Payment verified but enrolment could not be saved" });
    return res.status(200).json({ received: true, saved: true });
  } catch {
    return res.status(400).json({ error: "Invalid webhook request" });
  }
}