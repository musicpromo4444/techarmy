const STATUSES = new Set(["approved", "rejected"]);
const GROUP_KEYS = ["web_starter_group_url","web_professional_group_url","web_master_group_url","automation_starter_group_url","automation_professional_group_url","automation_master_group_url","creative_starter_group_url","creative_professional_group_url","creative_master_group_url"];
function authorized(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return Boolean(process.env.ADMIN_API_KEY && token && token === process.env.ADMIN_API_KEY);
}
export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ error: "Admin access required." });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "Database is not configured." });
  const base = url.replace(/\/$/, ""), headers = { apikey: key, Authorization: "Bearer " + key };
  try {
    if (req.method === "GET") {
      const paths = [
        "/rest/v1/tech_army_manual_payments?select=*&order=created_at.desc&limit=500",
        "/rest/v1/tech_army_payment_settings?id=eq.default&select=*",
        "/rest/v1/tech_army_registrations?select=*&order=created_at.desc&limit=500"
      ];
      const responses = await Promise.all(paths.map(p => fetch(base + p, { headers })));
      const data = await Promise.all(responses.map(r => r.json()));
      if (responses.some(r => !r.ok)) return res.status(502).json({ error: "Could not load all dashboard records." });
      return res.status(200).json({ payments: data[0], settings: data[1]?.[0] || {}, registrations: data[2] });
    }
    if (req.method === "PATCH") {
      const { id, status, admin_notes } = req.body || {};
      if (!id || !STATUSES.has(status) || (admin_notes != null && (typeof admin_notes !== "string" || admin_notes.length > 2000))) return res.status(400).json({ error: "Invalid payment update." });
      const patch = { status, admin_notes: admin_notes || null, updated_at: new Date().toISOString() };
      if (status === "approved") patch.verified_at = new Date().toISOString();
      const r = await fetch(base + "/rest/v1/tech_army_manual_payments?id=eq." + encodeURIComponent(id), { method: "PATCH", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(patch) });
      const rows = await r.json();
      if (!r.ok || !rows?.length) return res.status(502).json({ error: "Could not update payment status." });
      return res.status(200).json({ payment: rows[0] });
    }
    if (req.method === "PUT") {
      const b = req.body || {}, required = ["bank_name","account_name","account_number","admin_whatsapp"];
      if (required.some(k => typeof b[k] !== "string" || !b[k].trim())) return res.status(400).json({ error: "Bank name, account name, account number and admin WhatsApp are required." });
      if (!/^\d{10}$/.test(b.account_number.replace(/\s/g, ""))) return res.status(400).json({ error: "Enter a valid 10-digit bank account number." });
      for (const k of GROUP_KEYS) if (b[k] && (typeof b[k] !== "string" || !/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]+/i.test(b[k]))) return res.status(400).json({ error: "Enter valid WhatsApp group invite links." });
      const payload = { id: "default", bank_name: b.bank_name.trim(), account_name: b.account_name.trim(), account_number: b.account_number.replace(/\s/g, ""), admin_whatsapp: b.admin_whatsapp.replace(/\D/g, ""), updated_at: new Date().toISOString() };
      for (const k of GROUP_KEYS) payload[k] = b[k] || null;
      const r = await fetch(base + "/rest/v1/tech_army_payment_settings?on_conflict=id", { method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(payload) });
      const rows = await r.json();
      if (!r.ok) return res.status(502).json({ error: "Could not save payment settings." });
      return res.status(200).json({ settings: rows?.[0] || payload });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch { return res.status(500).json({ error: "Admin dashboard request failed." }); }
}
