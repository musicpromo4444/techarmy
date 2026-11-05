const GROUP_COLUMNS = {
  web: { Starter: "web_starter_group_url", Professional: "web_professional_group_url", "Master Class": "web_master_group_url" },
  automation: { Starter: "automation_starter_group_url", Professional: "automation_professional_group_url", "Master Class": "automation_master_group_url" },
  creative: { Starter: "creative_starter_group_url", Professional: "creative_professional_group_url", "Master Class": "creative_master_group_url" }
};
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const reference = String(req.query?.reference || "");
  if (!/^TA-[A-Z0-9-]{10,40}$/.test(reference)) return res.status(400).json({ error: "Invalid registration reference." });
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
    const p = rows[0], settings = ss?.[0] || {};
    const column = GROUP_COLUMNS[p.course_id]?.[p.level], groupUrl = p.status === "approved" && column ? settings[column] : "";
    const groupLinks = groupUrl ? [{ name: (p.course_title || p.course_id) + " — " + p.level + " WhatsApp Group", url: groupUrl }] : [];
    return res.status(200).json({ payment: { ...p, bank_account: { bank_name: settings.bank_name, account_name: settings.account_name, account_number: settings.account_number }, admin_whatsapp: settings.admin_whatsapp || "2347017036508", group_links: groupLinks } });
  } catch { return res.status(500).json({ error: "Could not retrieve your registration." }); }
}
