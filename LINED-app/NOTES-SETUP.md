# lined.film/notes — setting it up

## 1 · The table (Supabase SQL editor, once)

```sql
create table if not exists lined_notes (
  id         bigserial primary key,
  who        text,
  screen     text,
  verdict    text,
  code       text,
  note       text not null,
  created_at timestamptz not null default now()
);

alter table lined_notes enable row level security;
-- no policies on purpose: only the service key (server-side) can read or write
```

## 2 · Environment variables (Vercel → Settings → Environment Variables)

| Name | Value |
|---|---|
| `NOTES_PASSWORD` | the phrase you give your client |
| `SUPABASE_URL` | your project URL |
| `SUPABASE_SERVICE_KEY` | service role key — **server only** |
| `RESEND_API_KEY` | optional, to get an email per note |
| `NOTES_EMAIL_TO` | optional, where that email goes |

Redeploy after adding them. Env vars don't apply to existing deployments.

## 3 · Reading the notes

Supabase → Table editor → `lined_notes`. Sort by `created_at` descending.

If you set the Resend variables you also get an email per note, which is the
difference between notes you act on and notes that sit in a table.

## 4 · The two domains

Run **one** site. `lined.film` is the product. `linedscript.com` redirects to it —
Vercel → Settings → Domains → add it, then set **Redirect to lined.film (307)**.

Two live sites means two things to keep in sync, split search ranking, and a
client who bookmarks the wrong one.

- `lined.film` → the app
- `lined.film/notes` → this page
- `linedscript.com/*` → redirects

## 5 · Two different passwords

The app door (`you said tuesday`) is a **doorman** — client-side, anyone with
developer tools walks past it. That's fine for a prototype link.

`NOTES_PASSWORD` is checked **on the server**, so it's real. Use a different
phrase from the app door, and send it separately from the link.

## 6 · Feeding the notes into JSTJO

Set two more variables and every note is written into JSTJO's memory as it
arrives, so you can open a JSTJO session and say *"what has she asked for?"*
without pasting anything.

| Name | Value |
|---|---|
| `JSTJO_MEMORY_EMAIL` | the account whose memory should receive them |
| `JSTJO_SUPABASE_URL` | only if JSTJO is in a different Supabase project |
| `JSTJO_SUPABASE_KEY` | same |

Each note goes in as one compact line:

```
[LINED. client note · 2026-08-21 · Ellen · Report · CHANGE · R2]
Six times is wrong. We track second meal too, and it matters for penalties.
```

### The catch, so it doesn't surprise you

JSTJO loads the **20 most recent** memory rows. A heavy review day of fifteen
notes will crowd out everything else you've been talking to it about. That is
why the line is terse and truncated at 600 characters — the full note always
lives in `lined_notes`, which is the source of truth.

If it starts crowding things out, the fix is a digest rather than per-note
writes: one row a day summarising what came in. Say the word and I'll build it.

Leave `JSTJO_MEMORY_EMAIL` unset and nothing is written to memory at all.
