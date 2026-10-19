// date.js — partidele și analizele, salvate local în browser (IndexedDB), plus Chess.com.

const DB_NUME = "sah-local", DB_VERS = 1;
let _db = null;

function deschide() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NUME, DB_VERS);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("partide")) db.createObjectStore("partide", { keyPath: "id" });
      if (!db.objectStoreNames.contains("analize")) db.createObjectStore("analize", { keyPath: "id" });
      if (!db.objectStoreNames.contains("setari")) db.createObjectStore("setari");
    };
    r.onsuccess = () => { _db = r.result; res(_db); };
    r.onerror = () => rej(r.error);
  });
}
function tx(store, mod, f) {
  return deschide().then(db => new Promise((res, rej) => {
    const t = db.transaction(store, mod), s = t.objectStore(store);
    const out = f(s);
    t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
    t.onerror = () => rej(t.error);
  }));
}
export const db = {
  toate: store => tx(store, "readonly", s => s.getAll()),
  ia: (store, k) => tx(store, "readonly", s => s.get(k)),
  pune: (store, v, k) => tx(store, "readwrite", s => (k === undefined ? s.put(v) : s.put(v, k))),
  punMulte: (store, vs) => tx(store, "readwrite", s => { vs.forEach(v => s.put(v)); return null; }),
  sterge: (store, k) => tx(store, "readwrite", s => s.delete(k)),
  goleste: store => tx(store, "readwrite", s => s.clear()),
};

export async function setari() {
  const s = (await db.ia("setari", "setari")) || {};
  return {
    user: "vlevinschi", adancime: 14, motoare: 0, luni: 3,
    // Game Review, ca pe Chess.com
    sageti: "ambele",      // ambele = cea mai bună + recomandată acum; best = doar cea mai bună; nimic
    momente: "ambii",      // momentele cheie pentru: eu / adv / ambii
    clasaTabla: true,      // iconița clasei pe tablă
    autoVariante: true, pauza: 900,
    sunete: true, voce: false, timpMutare: true,
    liveLinii: true, adancimeLive: 18, raspunsAuto: true,
    ...s,
  };
}
export async function salveazaSetari(s) { await db.pune("setari", s, "setari"); }

// ───────── Chess.com (API public, fără cont) ─────────
async function getJson(url) {
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (r.status === 404) throw new Error("Utilizatorul nu există pe Chess.com.");
  if (!r.ok) throw new Error(`Chess.com a răspuns cu ${r.status}. Încearcă din nou peste un minut.`);
  return r.json();
}
export const idDinUrl = url => url.replace(/\/$/, "").split("/").pop();

/** Aduce partidele din ultimele `luni` luni și le salvează. Întoarce numărul de partide noi. */
export async function sincronizeaza(user, luni, progres) {
  const arh = (await getJson(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`)).archives || [];
  const deLuat = arh.slice(-Math.max(1, luni));
  const existente = new Set((await db.toate("partide")).map(p => p.id));
  let noi = 0;
  for (let k = 0; k < deLuat.length; k++) {
    if (progres) progres(k, deLuat.length);
    const jocuri = (await getJson(deLuat[k])).games || [];
    const lot = [];
    for (const g of jocuri) {
      if (!g.pgn || g.rules !== "chess") continue;
      const id = idDinUrl(g.url);
      if (!existente.has(id)) noi++;
      lot.push({
        id, url: g.url, pgn: g.pgn, ts: g.end_time, timeClass: g.time_class, timeControl: g.time_control, rated: g.rated,
        alb: { user: g.white.username, rating: g.white.rating, rez: g.white.result },
        negru: { user: g.black.username, rating: g.black.rating, rez: g.black.result },
        eco: g.eco || "", sursa: "chesscom",
      });
    }
    await db.punMulte("partide", lot);
  }
  if (progres) progres(deLuat.length, deLuat.length);
  return noi;
}

/** Partidă adăugată din PGN lipit de utilizator. */
export function partidaDinPgn(pgn, info) {
  const h = info.headers, id = "pgn-" + Date.now();
  const rez = h.Result || "*";
  const r = (a, b) => (rez === "1-0" ? [a, b] : rez === "0-1" ? [b, a] : ["agreed", "agreed"]);
  const [ra, rn] = r("win", "lose");
  return {
    id, url: h.Link || "", pgn, ts: Math.floor(Date.now() / 1000), timeClass: "importata", timeControl: h.TimeControl || "",
    alb: { user: h.White || "Alb", rating: +h.WhiteElo || null, rez: ra }, negru: { user: h.Black || "Negru", rating: +h.BlackElo || null, rez: rn },
    eco: h.ECOUrl || "", sursa: "pgn",
  };
}
