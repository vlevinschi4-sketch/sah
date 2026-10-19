// sw.js — păstrează aplicația și motorul pe dispozitiv, ca să meargă și fără internet.
// Cu internet ia mereu fișierele proaspete (fără cache vechi); fără internet folosește copia salvată.
const VERSIUNE = "sah-local-v31";
const FISIERE = ["./", "index.html", "manifest.webmanifest", "analiza.js", "antrenor.js", "app.css", "app.js", "apple-touch-icon.png", "chess.js", "date.js", "deschideri.js", "deschideri.json", "exercitii.json", "icon-192.png", "icon-512-maskable.png", "icon-512.png", "lectii.js", "motor.js", "repertoriu.json", "review.js", "stare.js", "stockfish-19-lite-single.js", "stockfish-19-lite-single.wasm", "sunete.js", "tabla.js", "tablaui.js", "teorie.json", "util.js"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSIUNE).then(c => c.addAll(FISIERE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSIUNE).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // Chess.com și Lichess merg direct la rețea
  if (url.pathname.includes("stockfish-19")) { // motorul e mare și nu se schimbă: întâi din copie
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
    return;
  }
  const cerere = e.request.mode === "navigate" ? fetch(e.request) : fetch(e.request.url, { cache: "no-cache", credentials: "same-origin" });
  e.respondWith(cerere.then(resp => {
    if (resp.ok) { const copie = resp.clone(); caches.open(VERSIUNE).then(c => c.put(e.request, copie)); }
    return resp;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
});
