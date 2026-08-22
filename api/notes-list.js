// Reads the notes back out, for the console. Key goes in a header, never a URL.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-notes-key");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const expected = (process.env.NOTES_PASSWORD || "").trim();
  const got = String(req.headers["x-notes-key"] || "").trim();
  if (!expected) return res.status(500).json({ error: "Not configured." });
  if (got.toLowerCase() !== expected.toLowerCase())
    return res.status(401).json({ error: "Wrong key." });

  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return res.status(500).json({ error: "Supabase not configured." });

  try {
    const r = await fetch(`${url}/rest/v1/lined_notes?select=*&order=created_at.desc&limit=300`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) return res.status(500).json({ error: "Couldn't read the table." });
    return res.status(200).json(await r.json());
  } catch (e) {
    return res.status(500).json({ error: "Couldn't reach the database." });
  }
}
