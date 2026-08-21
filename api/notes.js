// LINED. — note intake
// The password is checked HERE, not in the browser, so it is real. Notes land
// in Supabase and optionally arrive by email.
//
// Env vars needed in Vercel:
//   NOTES_PASSWORD        the phrase you give your client
//   SUPABASE_URL          project url
//   SUPABASE_SERVICE_KEY  service role key (server only — never ship to the browser)
//   RESEND_API_KEY        optional, to get an email per note
//   NOTES_EMAIL_TO        optional, where that email goes
//   JSTJO_MEMORY_EMAIL    optional — the account whose JSTJO memory gets the note
//   JSTJO_SUPABASE_URL    optional — only if JSTJO lives in a different project
//   JSTJO_SUPABASE_KEY    optional — same

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { pass, who, screen, verdict, code, note } = req.body || {};

  const expected = process.env.NOTES_PASSWORD || "";
  if (!expected) return res.status(500).json({ error: "Not configured yet." });
  if (String(pass || "").trim().toLowerCase() !== expected.trim().toLowerCase())
    return res.status(401).json({ error: "That isn't the line." });

  const text = String(note || "").trim();
  if (!text) return res.status(400).json({ error: "The note is empty." });
  if (text.length > 4000) return res.status(400).json({ error: "That note is very long — split it up?" });

  const row = {
    who: String(who || "").slice(0, 80),
    screen: String(screen || "").slice(0, 40),
    verdict: String(verdict || "").slice(0, 20),
    code: String(code || "").slice(0, 20),
    note: text,
    created_at: new Date().toISOString()
  };

  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    try {
      const r = await fetch(`${url}/rest/v1/lined_notes`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`,
                   "content-type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(row)
      });
      if (!r.ok) return res.status(500).json({ error: "Couldn't save that — try again in a moment." });
    } catch (e) {
      return res.status(500).json({ error: "Couldn't save that — try again in a moment." });
    }
  }

  // ── into JSTJO's memory ──
  // One compact line per note, written as a "user" turn against your own
  // account, so JSTJO carries the client's feedback into your next session
  // without you pasting anything. JSTJO reads the most recent 20 memory rows,
  // so this stays deliberately terse — the full note lives in lined_notes.
  const memEmail = process.env.JSTJO_MEMORY_EMAIL;
  if (memEmail) {
    const mUrl = process.env.JSTJO_SUPABASE_URL || url;
    const mKey = process.env.JSTJO_SUPABASE_KEY || key;
    if (mUrl && mKey) {
      const day = row.created_at.slice(0, 10);
      const head = [row.who || "client", row.screen, row.verdict, row.code]
        .filter(Boolean).join(" · ");
      const body = text.length > 600 ? text.slice(0, 597) + "…" : text;
      try {
        await fetch(`${mUrl}/rest/v1/jstjo_memory`, {
          method: "POST",
          headers: { apikey: mKey, Authorization: `Bearer ${mKey}`,
                     "content-type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({
            user_email: memEmail,
            role: "user",
            content: `[LINED. client note · ${day} · ${head}]\n${body}`
          })
        });
      } catch (e) { /* the note is saved; memory is a convenience */ }
    }
  }

  // optional: a copy by email, so notes don't sit unread in a table
  if (process.env.RESEND_API_KEY && process.env.NOTES_EMAIL_TO) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: "LINED. <notes@lined.film>",
          to: [process.env.NOTES_EMAIL_TO],
          subject: `LINED. note — ${row.screen || "general"}${row.code ? " · " + row.code : ""}`,
          text: `${row.who || "anon"} · ${row.screen || "—"} · ${row.verdict || "—"}${row.code ? " · " + row.code : ""}\n\n${row.note}`
        })
      });
    } catch (e) { /* the note is already saved; email is a bonus */ }
  }

  return res.status(200).json({ ok: true });
}
