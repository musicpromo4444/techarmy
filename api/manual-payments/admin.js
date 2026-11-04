const STATUSES = new Set(["approved", "rejected"]);
const GROUP_KEYS = ["starter_group_url","professional_group_url","master_group_url"];
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
      const lookup = await fetch(base + "/rest/v1/tech_army_manual_payments?id=eq." + encodeURIComponent(id) + "&select=*", { headers });
      const existingRows = await lookup.json(), existing = existingRows?.[0];
      if (!lookup.ok || !existing) return res.status(404).json({ error: "Manual payment registration not found." });
      if (status === "approved") {
        const enrolment = {
          payment_reference: "MANUAL-" + existing.reference,
          student_name: existing.student_name, whatsapp: existing.whatsapp,
          email: existing.email || "", country: existing.country, classes: existing.classes,
          course_id: existing.course_id, course_title: existing.course_title, level: existing.level,
          amount_kobo: existing.amount_kobo, currency: "NGN", payment_status: "success",
          batch_month: process.env.NEXT_BATCH_MONTH || (() => { const now = new Date(), next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)); return next.toISOString().slice(0, 7); })()
        };
        const saved = await fetch(base + "/rest/v1/tech_army_registrations?on_conflict=payment_reference", { method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(enrolment) });
        if (!saved.ok) return res.status(502).json({ error: "Could not save the verified student enrolment. Payment status was not changed." });
      }
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
