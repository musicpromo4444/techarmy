import { createHmac, timingSafeEqual } from "node:crypto";
export const config = { api: { bodyParser: false } };
async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return res.status(503).send("Webhook is not configured");
  try {
    const raw = await readRaw(req), supplied = String(req.headers["x-paystack-signature"] || "");
    const expected = createHmac("sha512", secret).update(raw).digest("hex");
    const a = Buffer.from(supplied), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).send("Invalid signature");
    const event = JSON.parse(raw.toString("utf8"));
    if (event.event !== "charge.success" || !event.data?.reference) return res.status(200).send("Event ignored");
    const origin = (process.env.APP_URL || "https://" + req.headers.host).replace(/\/$/, "");
    const verify = await fetch(origin + "/api/paystack/verify?reference=" + encodeURIComponent(event.data.reference));
    const result = await verify.json();
    if (!verify.ok || !result.verified) return res.status(502).send("Payment verification or enrolment persistence failed");
    return res.status(200).send("Payment verified and enrolment saved");
  } catch {
    return res.status(400).send("Invalid webhook payload");
  }
}
