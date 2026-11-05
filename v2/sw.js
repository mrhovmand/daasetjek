// Dåsetjek 2 service worker (scope /daasetjek/v2/). Rører ikke Dåsetjek 1's cache.
// App-filer: netværk først, cache som reserve (opdaterer automatisk, virker offline).
// Tegninger + PDF.js: cache først (store filer, hentes kun én gang). Ved nye tegninger: skift TG-navnet.
const APP = "daasetjek2-app-v3";
const TG = "daasetjek2-tegninger-v1";
const OWN = [APP, TG];
const CORE = ["./", "./index.html", "./manifest.json", "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png"];
const LIB = ["./pdfjs/pdf.min.mjs", "./pdfjs/pdf.worker.min.mjs"];
self.addEventListener("install", e => {
  e.waitUntil(Promise.all([
    caches.open(APP).then(c => c.addAll(CORE)),
    caches.open(TG).then(c => c.addAll(LIB)).catch(() => {})
  ]).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  // Ryd kun op i Dåsetjek 2's egne gamle caches (præfiks "daasetjek2-")
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("daasetjek2-") && !OWN.includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request;
  const u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || !r.url.startsWith(self.registration.scope)) return;
  if (r.headers.has("range")) return;
  if (/\/(tegninger|pdfjs)\//.test(u.pathname)) {
    e.respondWith(caches.open(TG).then(c => c.match(r, { ignoreSearch: true }).then(m => m || fetch(r).then(res => {
      if (res.ok && res.status === 200) c.put(r, res.clone());
      return res;
    }))));
    return;
  }
  e.respondWith(
    fetch(r).then(res => { if (res.ok && res.status === 200) { const cp = res.clone(); caches.open(APP).then(c => c.put(r, cp)); } return res; })
      .catch(() => caches.open(APP).then(c => c.match(r, { ignoreSearch: true })).then(m => m || (r.mode === "navigate" ? caches.open(APP).then(c => c.match("./index.html")) : Response.error())))
  );
});
