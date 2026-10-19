// sw.js — păstrează aplicația și motorul pe dispozitiv, ca să meargă și fără internet.
// Cu internet ia mereu fișierele proaspete; fără internet folosește copia salvată.
const VERSIUNE = "sah-local-v3";
const FISIERE = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/app.js", "js/review.js", "js/stare.js", "js/util.js", "js/sunete.js", "js/analiza.js", "js/motor.js", "js/date.js", "js/tabla.js", "js/chess.js",
  "js/tablaui.js", "js/antrenor.js", "js/deschideri.js", "js/lectii.js",
  "engine/stockfish-19-lite-single.js", "engine/stockfish-19-lite-single.wasm",
  "data/teorie.json", "data/exercitii.json", "data/deschideri.json", "data/repertoriu.json", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSIUNE).then(c => c.addAll(FISIERE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSIUNE).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // Chess.com merge direct la rețea
  const motor = url.pathname.includes("/engine/");
  if (motor) { // motorul e mare și nu se schimbă: întâi din copie
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
    return;
  }
  e.respondWith(fetch(e.request).then(resp => {
    if (resp.ok) { const copie = resp.clone(); caches.open(VERSIUNE).then(c => c.put(e.request, copie)); }
    return resp;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
});
