# LINED. — installing it as an app

## What this folder is

A complete, deployable web app. No build step, no dependencies to install.

- `index.html` — the whole app
- `manifest.webmanifest` — makes it installable
- `sw.js` — offline support
- `icons/` — home screen icons
- `vercel.json` — deploy config

## The gate

The app opens on a prompt: **What's my line again?**

The answer is `you said tuesday` — the line Nora says twice in the sample
scene. Tell your client verbally, not in the same email as the link.

It unlocks once per device and remembers. Wrong answers get progressively
more helpful hints, the way a script supervisor feeds a line.

**To change the answer**, run this in any browser console:

```js
crypto.subtle.digest("SHA-256", new TextEncoder().encode("your new answer"))
  .then(b => console.log([...new Uint8Array(b)]
    .map(x => x.toString(16).padStart(2,"0")).join("")))
```

Paste the result over `ANSWER` near the top of `index.html`. Matching ignores
case, punctuation and extra spaces, so "You said Tuesday!" still works.

**This is a doorman, not a lock.** Anyone who opens devtools can remove the
overlay. For real protection use Vercel → Settings → Deployment Protection →
Password Protection, which stops the request before the page is ever served.

## What's at each address

| Address | What it is |
|---|---|
| `lined.film` | the app |
| `lined.film/deck` | the live presentation — nine slides, tap to choose, vote at the end |
| `lined.film/notes` | the note form |
| `linedscript.com/*` | 307 redirect to lined.film |

The deck and the app are both behind the door. The notes form has its own
server-checked passphrase — see NOTES-SETUP.md.

The last slide of the deck posts straight to `/api/notes`, so her layout,
palette, door and name choices arrive as one note without her writing anything.

## Deploy it (5 minutes)

1. Push this folder to a GitHub repo
2. In Vercel: **Add New → Project → import the repo**
3. Framework preset: **Other**. No build command. Output directory: leave blank
4. Deploy, then **Settings → Domains → add `lined.film`**

That's it. HTTPS is automatic, and HTTPS is required for install to work.

## Install it on the iPad

1. Open the site in **Safari** (not Chrome — Chrome on iOS can't install PWAs)
2. Tap the **Share** button
3. **Add to Home Screen**
4. Name it, tap Add

It now has its own icon, opens fullscreen with no browser chrome, and works
with no signal.

## When you ship an update

Change the version at the top of `sw.js`:

```js
const CACHE = "lined-v2";   // was v1
```

Bump it every single deploy. If you don't, people keep the old version.

## If you want it in the App Store later

The PWA is not in the App Store. To get there:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init LINED com.lined.app --web-dir=.
npx cap add ios
npx cap open ios
```

Then build and submit from Xcode. Needs a Mac and a $99/yr Apple Developer
account. Worth doing only once people are actually paying — the PWA is a
better first move because there's no review queue between you and a fix.

## If you want a Mac/Windows desktop app

Use Tauri (small, fast) or Electron (heavier, easier). Same `index.html`
either way. Only worth it if a client asks.
