/* LINED. service worker
   Bump CACHE on every deploy. Network-first for the app shell so a new
   version is never stuck behind a stale cache; cache-first for everything
   else so the app opens instantly and works with no signal on a stage. */
const CACHE = "lined-v18";
const SHELL = [
  "./",
  "./index.html",
  "./deck.html",
  "./notes.html",
  "./ctrl-markup.js",
  "./ctrlgo.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const isShell = req.mode === "navigate" || req.url.endsWith("index.html");
  if (isShell) {
    e.respondWith(
      fetch(req)
        .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })
        .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
  } else {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        if (r.ok && (req.url.startsWith(self.location.origin) || req.url.includes("cdnjs"))) {
          const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy));
        }
        return r;
      }).catch(() => hit))
    );
  }
});
