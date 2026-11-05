// Pladsen service worker (scope /daasetjek/plads/). Rører ikke Dåsetjek 1/2's caches.
// App-filer: netværk først, cache som reserve. Tegninger + PDF.js (fra ../v2/): cache først.
// Supabase og ntfy (andre domæner) går altid direkte på nettet.
const APP = "pladsen-app-v2";
const TG = "pladsen-tegninger-v1";          // samme navn som TGC i index.html
const OWN = [APP, TG];
const CORE = ["./", "./index.html", "./manifest.json", "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png"];
const LIB = ["../v2/pdfjs/pdf.min.mjs", "../v2/pdfjs/pdf.worker.min.mjs"];
self.addEventListener("install", e => {
  e.waitUntil(Promise.all([
    caches.open(APP).then(c => c.addAll(CORE)),
    caches.open(TG).then(c => c.addAll(LIB)).catch(() => {})
  ]).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("pladsen-") && !OWN.includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request;
  const u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || r.headers.has("range")) return;
  const base = new URL("../v2/", self.registration.scope).pathname;   // /daasetjek/v2/
  if (u.pathname.startsWith(base + "tegninger/") || u.pathname.startsWith(base + "pdfjs/")) {
    e.respondWith(caches.open(TG).then(c => c.match(r, { ignoreSearch: true }).then(m => m || fetch(r).then(res => {
      if (res.ok && res.status === 200) c.put(r, res.clone());
      return res;
    }))));
    return;
  }
  if (!r.url.startsWith(self.registration.scope)) return;
  e.respondWith(
    fetch(r).then(res => { if (res.ok && res.status === 200) { const cp = res.clone(); caches.open(APP).then(c => c.put(r, cp)); } return res; })
      .catch(() => caches.open(APP).then(c => c.match(r, { ignoreSearch: true })).then(m => m || (r.mode === "navigate" ? caches.open(APP).then(c => c.match("./index.html")) : Response.error())))
  );
});
