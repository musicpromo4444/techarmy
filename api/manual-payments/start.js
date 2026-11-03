export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { reference } = req.body || {};
  if (typeof reference !== "string" || !reference.startsWith("TA-")) return res.status(400).json({ error: "Invalid registration reference." });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "Payment service is not configured." });
  const base = url.replace(/\/$/, ""), headers = { apikey: key, Authorization: "Bearer " + key };
  try {
    const get = await fetch(base + "/rest/v1/tech_army_manual_payments?reference=eq." + encodeURIComponent(reference) + "&select=*", { headers });
    const rows = await get.json();
    if (!get.ok || !rows?.[0]) return res.status(404).json({ error: "Registration not found." });
    let payment = rows[0];
    if (payment.status !== "pending") return res.status(409).json({ error: "This registration is no longer awaiting payment." });
    if (!payment.started_at) {
      const started = new Date(), expires = new Date(started.getTime() + 30 * 60 * 1000);
      const update = await fetch(base + "/rest/v1/tech_army_manual_payments?id=eq." + encodeURIComponent(payment.id) + "&started_at=is.null&status=eq.pending", { method: "PATCH", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ started_at: started.toISOString(), expires_at: expires.toISOString(), updated_at: started.toISOString() }) });
      const updated = await update.json();
      if (!update.ok) return res.status(502).json({ error: "Could not start the countdown." });
      if (updated?.[0]) payment = updated[0];
      else {
        const latest = await fetch(base + "/rest/v1/tech_army_manual_payments?id=eq." + encodeURIComponent(payment.id) + "&select=*", { headers });
        const latestRows = await latest.json();
        if (!latest.ok || !latestRows?.[0]) return res.status(502).json({ error: "Could not read the payment countdown." });
        payment = latestRows[0];
      }
    }
    const sr = await fetch(base + "/rest/v1/tech_army_payment_settings?id=eq.default&select=*", { headers });
    const ss = await sr.json(), settings = ss?.[0] || {};
    return res.status(200).json({ payment: { ...payment, bank_account: { bank_name: settings.bank_name, account_name: settings.account_name, account_number: settings.account_number }, admin_whatsapp: settings.admin_whatsapp || "2347017036508", general_group_url: settings.general_group_url || null } });
  } catch { return res.status(500).json({ error: "Could not start the payment countdown." }); }
}