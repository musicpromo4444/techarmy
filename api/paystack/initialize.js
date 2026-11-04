import { normalizeWhatsApp } from "../_lib/phone.js";
const COURSES = {
  web: "WEB & APP DEVELOPMENT",
  automation: "AI AUTOMATION & INTELLIGENCE",
  creative: "AI CREATIVE PRODUCTION",
};
const PRICES = { Starter: 500000, Professional: 1500000, "Master Class": 3000000 };
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return res.status(503).json({ error: "Online payment is not configured. Please contact the admin." });
  try {
    const { name, phone, country_code, email, country, course_id, level } = req.body || {};
    const normalizedPhone = normalizeWhatsApp(phone, country_code);
    if (typeof name !== "string" || !name.trim() || name.length > 120 || !normalizedPhone ||
        typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180 ||
        typeof country !== "string" || !country.trim() || country.length > 80 ||
        !Object.prototype.hasOwnProperty.call(COURSES, course_id) ||
        !Object.prototype.hasOwnProperty.call(PRICES, level)) {
      return res.status(400).json({ error: "Please check your name, WhatsApp number, email, country, course and level." });
    }
    const courseTitle = COURSES[course_id], amount = PRICES[level];
    const selection = course_id + " :: " + courseTitle + " :: " + level;
    const reference = "TA-" + Date.now() + "-" + cryptoRandom();
    const origin = (process.env.APP_URL || "https://" + req.headers.host).replace(/\/$/, "");
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: "Bearer " + secret, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim().toLowerCase(), amount, currency: "NGN", reference,
        callback_url: origin + "/?payment=success",
        metadata: {
          student_name: name.trim(), phone: normalizedPhone, country: country.trim(),
          course_id, course_title: courseTitle, level, classes: [selection],
          custom_fields: [
            { display_name: "Student name", variable_name: "student_name", value: name.trim() },
            { display_name: "WhatsApp", variable_name: "whatsapp", value: normalizedPhone },
            { display_name: "Course", variable_name: "course", value: courseTitle },
            { display_name: "Training level", variable_name: "level", value: level }
          ]
        }
      })
    });
    const result = await response.json();
    if (!response.ok || !result.status || !result.data?.authorization_url) return res.status(502).json({ error: result.message || "Paystack could not initialize this payment." });
    return res.status(200).json({ authorization_url: result.data.authorization_url, reference: result.data.reference });
  } catch {
    return res.status(500).json({ error: "Unable to initialize payment. Please try again." });
  }
}
function cryptoRandom() {
  return Array.from({ length: 8 }, () => "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 36)]).join("");
}
