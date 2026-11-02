const STATUSES = new Set(["pending", "contacted", "enrolled", "closed"]);
function authorized(req) { const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""); return Boolean(process.env.ADMIN_API_KEY && token && token === process.env.ADMIN_API_KEY); }
export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ error: "Admin access required." });
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "Database is not configured." });
  try {
    if (req.method === "GET") {
      const r = await fetch(url.replace(/\/$/, "") + "/rest/v1/tech_army_enquiries?select=*&order=created_at.desc&limit=500", { headers: { apikey: key, Authorization: "Bearer " + key } });
      const rows = await r.json(); if (!r.ok) return res.status(502).json({ error: "Could not load enquiries." }); return res.status(200).json({ enquiries: rows });
    }
    if (req.method === "PATCH") {
      const { id, status, admin_notes } = req.body || {};
      if (!id || !STATUSES.has(status) || (admin_notes != null && (typeof admin_notes !== "string" || admin_notes.length > 2000))) return res.status(400).json({ error: "Invalid enquiry update." });
      const r = await fetch(url.replace(/\/$/, "") + "/rest/v1/tech_army_enquiries?id=eq." + encodeURIComponent(id), { method: "PATCH", headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ status, admin_notes: admin_notes || null, updated_at: new Date().toISOString() }) });
      const rows = await r.json(); if (!r.ok || !rows.length) return res.status(502).json({ error: "Could not update this enquiry." }); return res.status(200).json({ enquiry: rows[0] });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch { return res.status(500).json({ error: "Admin request failed." }); }
}
