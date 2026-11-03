export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const reference = String(req.query?.reference || "");
  if (!reference.startsWith("TA-")) return res.status(400).json({ error: "Invalid registration reference." });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "Payment service is not configured." });
  const base = url.replace(/\/$/, ""), headers = { apikey: key, Authorization: "Bearer " + key };
  try {
    const [pr, sr] = await Promise.all([
      fetch(base + "/rest/v1/tech_army_manual_payments?reference=eq." + encodeURIComponent(reference) + "&select=*", { headers }),
      fetch(base + "/rest/v1/tech_army_payment_settings?id=eq.default&select=*", { headers })
    ]);
    const [rows, ss] = await Promise.all([pr.json(), sr.json()]);
    if (!pr.ok || !rows?.[0]) return res.status(404).json({ error: "Registration not found." });
    const p = rows[0], s = ss?.[0] || {}, groupLinks = [];
    const map = { "Starter": s.starter_group_url, "Professional": s.professional_group_url, "Master Class": s.master_group_url };
    if (p.status === "approved") for (const name of p.classes || []) if (map[name]) groupLinks.push({ name, url: map[name] });
    return res.status(200).json({ payment: { ...p, bank_account: { bank_name: s.bank_name, account_name: s.account_name, account_number: s.account_number }, admin_whatsapp: s.admin_whatsapp || "2347017036508", group_links: groupLinks } });
  } catch { return res.status(500).json({ error: "Could not retrieve your registration." }); }
}