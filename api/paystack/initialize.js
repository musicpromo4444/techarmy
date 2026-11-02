const PRICES = {
  "AI & Automation": 500000,
  "Websites & Applications": 1500000,
  "AI Creative Studio": 3000000,
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return res.status(503).json({ error: "Payment gateway is not configured yet." });
  try {
    const { name, phone, email, country, classes } = req.body || {};
    if (!name || !phone || !email || !country || !Array.isArray(classes) || classes.length < 1) {
      return res.status(400).json({ error: "Please complete your details and select at least one class." });
    }
    const unique = [...new Set(classes)];
    if (unique.some((item) => !Object.prototype.hasOwnProperty.call(PRICES, item))) {
      return res.status(400).json({ error: "Invalid class selection." });
    }
    const amount = unique.reduce((sum, item) => sum + PRICES[item], 0);
    const reference = "TA-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9).toUpperCase();
    const origin = process.env.APP_URL || `https://${req.headers.host}`;
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount,
        currency: "NGN",
        reference,
        callback_url: origin + "/?payment=success",
        metadata: {
          custom_fields: [
            { display_name: "Student name", variable_name: "student_name", value: name },
            { display_name: "WhatsApp", variable_name: "whatsapp", value: phone },
            { display_name: "Country", variable_name: "country", value: country },
            { display_name: "Selected classes", variable_name: "classes", value: unique.join(", ") }
          ],
          student_name: name,
          phone,
          country,
          classes: unique,
          amount_naira: amount / 100
        }
      })
    });
    const result = await response.json();
    if (!response.ok || !result.status || !result.data?.authorization_url) {
      return res.status(502).json({ error: result.message || "Paystack could not initialize this payment." });
    }
    return res.status(200).json({ authorization_url: result.data.authorization_url, reference: result.data.reference });
  } catch (error) {
    return res.status(500).json({ error: "Unable to initialize payment. Please try again." });
  }
}
