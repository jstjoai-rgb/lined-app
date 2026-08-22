# lined.film/notes — setting it up

## 1 · The table (Supabase SQL editor, once)

Paste **only this**, not the whole file:

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
```

No policies on purpose — only the service key, server-side, can read or write.

## 2 · Environment variables

Vercel → your project → Settings → Environment Variables. Tick all three
environments for each one.

| Name | Value | Where it comes from |
|---|---|---|
| `NOTES_PASSWORD` | a phrase you invent | you make it up |
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | long string starting `eyJ` | same page → **service_role**, not anon |
| `RESEND_API_KEY` | optional | an email per note |
| `NOTES_EMAIL_TO` | optional | where that email goes |

**Redeploy after adding them.** Environment variables do not reach a deployment
that already exists.

## 3 · Check it worked

Go to **lined.film/test**. It probes both functions and tells you what is
missing. Then use the end-to-end test at the bottom of that page: type the
password, and it writes a real note and reads it back.

If that comes back green, the whole chain works.

## 4 · Reading the notes — three ways

1. **Supabase** → Table editor → `lined_notes`
2. **Your inbox**, if you set the two Resend variables
3. **The CTRL+GO Console** → open the project → Notes tab → **Pull from site**.
   It asks once for the address and the passphrase, then it is one tap.

The third one is the reason `api/notes-list.js` exists. It uses the same
`NOTES_PASSWORD`, sent in a header rather than a URL.

## 5 · The domains — already done

`lined.film` points at Vercel with an A record. `linedscript.com` forwards to it
from **Dynadot → DNS Settings → Dynadot Forwarding**, permanent 301. Nothing to
do in Vercel for the second domain.

One live site. Two would mean two things to keep in sync and a client who
bookmarks the wrong one.

- `lined.film` → the app
- `lined.film/deck` → the case
- `lined.film/notes` → the note form
- `lined.film/test` → is it working?

## 6 · Two different passwords

The app door — `you said tuesday` — is a **doorman**. Client-side, and anyone
with developer tools walks past it. Fine for a prototype link.

`NOTES_PASSWORD` is checked **on the server**, so it is real. Use a different
phrase, and send it in a separate message from the link.

## 7 · Feeding the notes into JSTJO

Two more variables and every note is written into JSTJO's memory as it arrives,
so you can ask *"what has she asked for?"* without pasting anything.

| Name | Value |
|---|---|
| `JSTJO_MEMORY_EMAIL` | the account whose memory receives them |
| `JSTJO_SUPABASE_URL` | only if JSTJO is in a different Supabase project |
| `JSTJO_SUPABASE_KEY` | same |

Each note lands as one line:

```
[LINED. client note · 2026-08-21 · Ellen · Report · CHANGE · R2]
Six times is wrong. We track second meal too.
```

**The catch:** JSTJO loads the 20 most recent memory rows. Fifteen notes in a day
will crowd out everything else you have been discussing with it. That is why the
line is terse and cut at 600 characters — the full note always lives in
`lined_notes`.

Leave `JSTJO_MEMORY_EMAIL` unset and nothing touches memory.
