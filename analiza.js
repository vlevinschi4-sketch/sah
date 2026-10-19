// analiza.js — clasificarea mutărilor (ca în Game Review de pe Chess.com), acuratețe,
// rating estimat și statistici avansate. Primește evaluările brute ale motorului
// pentru fiecare poziție și întoarce tot ce afișează aplicația.
import { Chess } from "./chess.js";

export const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const NUME = { p: "pionul", n: "calul", b: "nebunul", r: "turnul", q: "dama", k: "regele" };

// Clasele, cu numele din versiunea în română a Chess.com
export const CLASE = [
  ["br", "Genial"], ["gr", "Grozav"], ["be", "Cel mai bun"], ["ex", "Excelent"], ["go", "Bun"],
  ["bk", "Teorie"], ["in", "Inexactitate"], ["mi", "Greșeală"], ["ms", "Ratare"], ["bl", "Gafă"],
];
export const NUME_CLASA = Object.fromEntries([...CLASE, ["fo", "Forțată"]]);
export const ERORI = ["mi", "ms", "bl"];

export const TIPURI = {
  mat_permis: "Mat permis", pat: "Pat în loc de mat", piesa_in_priza: "Piesă mutată în priză",
  piesa_neaparata: "Piesă lăsată neapărată", furculita: "Furculiță permisă", tactica_permisa: "Combinație permisă",
  pion_pierdut: "Pion pierdut", atac_rege: "Rege expus", mat_ratat: "Mat ratat",
  material_ratat: "Material ratat", tehnica_final: "Tehnică de final", pozitional: "Plan / poziție",
};
const TACTICE = new Set(["mat_permis", "pat", "piesa_in_priza", "piesa_neaparata", "furculita",
  "tactica_permisa", "pion_pierdut", "atac_rege", "mat_ratat", "material_ratat"]);

// Curba acuratețe -> rating și deplasările calibrate pe partidele lui vlevinschi și ale adversarilor.
// Aplicația le recalibrează singură după 30 de partide analizate (vezi calibreaza).
const CURBA = [[0, 100], [30, 250], [40, 400], [50, 600], [60, 850], [70, 1150], [75, 1350],
  [80, 1550], [85, 1800], [90, 2100], [95, 2500], [98, 2800], [100, 3100]];
export const DEPLASARI_IMPLICITE = { joc: -305, opening: -565, tactics: 335, strategy: -780, endgame: -605 };
let DEPLASARI = { ...DEPLASARI_IMPLICITE };
export function setDeplasari(d) { DEPLASARI = { ...DEPLASARI_IMPLICITE, ...(d || {}) }; }

// ───────── utilitare de bază ─────────
export function winPctCp(cp) { return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1); }
export function winPct(ev, cul) {
  let p;
  if (ev.mat != null) {
    let albCastiga = ev.mat > 0;
    if (ev.mat === 0) albCastiga = !!ev.castiga_alb;
    p = albCastiga ? 100 : 0;
  } else p = winPctCp(ev.cp);
  return cul === "w" ? p : 100 - p;
}
export function evText(ev) {
  if (ev.mat != null) {
    if (ev.mat === 0) return ev.castiga_alb ? "1-0" : "0-1";
    return ev.mat > 0 ? "M" + ev.mat : "-M" + (-ev.mat);
  }
  const v = (ev.cp / 100).toFixed(1);
  return v === "-0.0" || v === "0.0" ? "0.0" : (ev.cp > 0 ? "+" : "") + v;
}
const opus = c => (c === "w" ? "b" : "w");
const parsUci = u => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.length > 4 ? u[4] : undefined });
const eCaptura = m => m.flags.includes("c") || m.flags.includes("e");
const valoareCapturata = m => (m.flags.includes("e") ? 1 : m.captured ? VAL[m.captured] : 0);

function incearca(ch, u) { try { return ch.move(parsUci(u)); } catch (e) { return null; } }
function sanDin(fen, u) { const ch = new Chess(fen); const m = incearca(ch, u); return m ? m.san : null; }

function material(ch, cul) {
  let s = 0;
  for (const rand of ch.board()) for (const x of rand) if (x && x.color === cul) s += VAL[x.type];
  return s;
}
const balanta = (ch, cul) => material(ch, cul) - material(ch, opus(cul));

function piese(ch) {
  const out = [];
  for (const rand of ch.board()) for (const x of rand) if (x) out.push(x);
  return out;
}

// ───────── schimburi (SEE) ─────────
function capturaMinima(ch, sq) {
  const c = ch.moves({ verbose: true }).filter(m => m.to === sq && eCaptura(m));
  if (!c.length) return null;
  c.sort((a, b) => (VAL[a.piece] - VAL[b.piece]) || ((a.promotion && a.promotion !== "q" ? 1 : 0) - (b.promotion && b.promotion !== "q" ? 1 : 0)));
  return c[0];
}
export function see(ch, sq, adancime = 0) {
  if (adancime > 12) return 0;
  const m = capturaMinima(ch, sq);
  if (!m) return 0;
  let luat = valoareCapturata(m);
  if (m.promotion) luat += VAL[m.promotion] - 1;
  ch.move({ from: m.from, to: m.to, promotion: m.promotion });
  const v = luat - see(ch, sq, adancime + 1);
  ch.undo();
  return Math.max(0, v);
}
function pieseInPericol(ch, cul, minVal = 1) {
  const out = [];
  for (const x of piese(ch)) {
    if (x.color !== cul || x.type === "k" || VAL[x.type] < minVal) continue;
    if (!ch.isAttacked(x.square, opus(cul))) continue;
    const g = see(ch, x.square);
    if (g > 0) out.push([x.square, x, g]);
  }
  out.sort((a, b) => b[2] - a[2]);
  return out;
}
function deltaMaterialPv(fen, pv, cul, maxPlies = 10) {
  const ch = new Chess(fen);
  const puncte = [balanta(ch, cul)], jucate = [];
  for (const u of pv.slice(0, maxPlies)) {
    const m = incearca(ch, u);
    if (!m) break;
    jucate.push(eCaptura(m));
    puncte.push(balanta(ch, cul));
  }
  for (let i = puncte.length - 1; i >= 0; i--) {
    const urm = i < jucate.length ? jucate[i] : false;
    if (!urm) return puncte[i];
  }
  return puncte[puncte.length - 1];
}
function rasturnat(fen) {
  const p = fen.split(" ");
  p[1] = p[1] === "w" ? "b" : "w"; p[3] = "-";
  try { return new Chess(p.join(" "), { skipValidation: true }); } catch (e) { return null; }
}

// ───────── teorie ─────────
export class Teorie {
  constructor(date) { this.pozitii = new Set(date.pozitii); this.nume = date.nume || {}; }
  static cheie(fen) { return fen.split(" ").slice(0, 4).join(" "); }
  eTeorie(fen) { return this.pozitii.has(Teorie.cheie(fen)); }
  numeDeschidere(fens) { // cea mai adâncă poziție cu nume
    let n = null;
    for (const f of fens) { const k = this.nume[Teorie.cheie(f)]; if (k) n = k; }
    return n ? n[1] : null;
  }
}

export function plyTeorieEcoUrl(url) {
  if (!url || !url.includes("/openings/")) return 0;
  const nume = url.split("/openings/").pop().replace(/O-O-O/g, "OOO").replace(/O-O/g, "OO").replace(/-/g, " ");
  let ply = 0, inMutari = false;
  for (const tok of nume.split(/\s+/)) {
    const m = tok.match(/^(\d+)(\.\.\.|\.)(.*)$/);
    if (m) {
      const nr = +m[1]; inMutari = true;
      ply = m[2] === "..." ? 2 * nr : 2 * nr - 1;
      if (!m[3]) ply -= 1;
    } else if (inMutari && /^(OOO|OO|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8].*)$/.test(tok)) ply += 1;
  }
  return Math.max(0, ply);
}
export function numeDinEcoUrl(url) {
  if (!url || !url.includes("/openings/")) return "";
  return decodeURIComponent(url.split("/openings/").pop()).replace(/-/g, " ").trim();
}

// ───────── faze ─────────
function numaraPiese(ch) { return piese(ch).filter(x => "nbrq".includes(x.type)).length; }
function randRar(ch) {
  const b = ch.board();
  const alb = b[7].filter(x => x && x.color === "w").length, neg = b[0].filter(x => x && x.color === "b").length;
  return alb < 4 || neg < 4;
}
function calculeazaFaze(fens) {
  const faze = []; let stare = "deschidere";
  fens.forEach((f, i) => {
    const ch = new Chess(f), mm = numaraPiese(ch);
    if (mm <= 6) stare = "final";
    else if (stare === "deschidere" && (mm <= 10 || i >= 24 || (i >= 8 && randRar(ch)))) stare = "mijloc";
    faze.push(stare);
  });
  return faze;
}

// ───────── PGN ─────────
export function citestePgn(pgn) {
  const ch = new Chess();
  ch.loadPgn(pgn);
  const istoric = ch.history({ verbose: true });
  const headers = ch.getHeaders ? ch.getHeaders() : ch.header();
  const ceasuri = [];
  const re = /\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/g;
  let m;
  while ((m = re.exec(pgn))) ceasuri.push(+m[1] * 3600 + +m[2] * 60 + parseFloat(m[3]));
  const start = headers.FEN || new Chess().fen();
  const fens = [start];
  const mutari = istoric.map(x => { fens.push(x.after); return { u: x.from + x.to + (x.promotion || ""), san: x.san, from: x.from, to: x.to, flags: x.flags, piece: x.piece, captured: x.captured, promotion: x.promotion }; });
  return { headers, mutari, fens, ceasuri: ceasuri.length === mutari.length ? ceasuri : mutari.map(() => null) };
}

// ───────── clasificare ─────────
function linie(fen, ucis, n = 6) {
  const ch = new Chess(fen), out = [];
  for (const u of (ucis || []).slice(0, n)) {
    const m = incearca(ch, u);
    if (!m) break;
    out.push({ f: ch.fen(), s: m.san, u });
  }
  return out;
}
function eSacrificiu(fenB, m, fenA, cul) {
  const before = new Chess(fenB);
  if (m.promotion || before.inCheck()) return false;
  const luat = valoareCapturata(m);
  const pericol = pieseInPericol(new Chess(fenA), cul, 3);
  if (!pericol.length) return false;
  const dupa = pericol[0][2];
  if (dupa - luat < 2) return false;
  const b = rasturnat(fenB);
  let inainte = 0, salvata = false;
  if (b && !b.inCheck()) {
    const per0 = pieseInPericol(b, cul, 1);
    const mari = per0.filter(x => VAL[x[1].type] >= 3);
    inainte = mari.length ? mari[0][2] : 0;
    salvata = per0.some(x => x[0] === m.from);
  }
  if (dupa > inainte) return true;
  return dupa === inainte && !salvata;
}
function seePentruAdversar(fen, sq) {
  if (new Chess(fen).inCheck()) return 0;
  const b = rasturnat(fen);
  if (!b || b.inCheck()) return 0;
  return see(b, sq);
}
function mutareEvidenta(fenB, m, prev) {
  const before = new Chess(fenB);
  if (prev && eCaptura(m) && m.to === prev.to) return true;
  if (eCaptura(m)) {
    const luat = valoareCapturata(m);
    const b2 = new Chess(fenB); b2.move({ from: m.from, to: m.to, promotion: m.promotion });
    const piesa = VAL[m.piece];
    if (!b2.isAttacked(m.to, b2.turn()) || luat >= piesa) return true;
  }
  if (before.inCheck() && before.moves().length <= 3) return true;
  if (m.piece !== "p" && before.isAttacked(m.from, opus(before.turn()))) {
    if (seePentruAdversar(fenB, m.from) > 0) return true;
  }
  return false;
}

function motivEroare(fenB, m, fenA, cul, evInainte, evDupa, pvBest, pvDupa, faza, wb) {
  const adv = opus(cul);
  const before = new Chess(fenB), after = new Chess(fenA);
  const bal0 = balanta(before, cul);
  const gainBest = pvBest.length ? deltaMaterialPv(fenB, pvBest, cul) - bal0 : 0;
  const gainJucat = pvDupa.length ? deltaMaterialPv(fenA, pvDupa, cul) - bal0 : balanta(after, cul) - bal0;
  const pierdereDupa = balanta(after, cul) - (pvDupa.length ? deltaMaterialPv(fenA, pvDupa, cul) : balanta(after, cul));
  const r1 = pvDupa.length ? parsUci(pvDupa[0]) : null;

  if (evDupa.mat != null && evDupa.mat !== 0) {
    const matAdv = cul === "w" ? evDupa.mat < 0 : evDupa.mat > 0;
    const eraDeja = evInainte.mat != null && (cul === "w" ? evInainte.mat < 0 : evInainte.mat > 0);
    if (matAdv && !eraDeja) return ["mat_permis", `adversarul avea mat în ${Math.abs(evDupa.mat)}`, true];
  }
  if (after.isStalemate() && wb >= 70) return ["pat", "regele adversarului nu mai avea mutări — remiză", true];
  const dest = m.to, piesa = after.get(dest), luat = valoareCapturata(m);
  if (piesa && piesa.type !== "k" && after.isAttacked(dest, adv)) {
    const g = see(new Chess(fenA), dest);
    if (g - luat >= 2 || (g >= 1 && r1 && r1.to === dest && pierdereDupa >= 1)) {
      const cap = capturaMinima(new Chess(fenA), dest);
      if (cap && g - luat >= 1) return ["piesa_in_priza", `${NUME[piesa.type]} mutat pe ${dest} putea fi luat (${cap.san})`, true];
    }
  }
  if (r1) {
    const t = new Chess(fenA); const mr = incearca(t, pvDupa[0]);
    if (mr && eCaptura(mr)) {
      const tinta = mr.to, p2 = after.get(tinta);
      if (p2 && p2.color === cul && tinta !== dest) {
        const g = see(new Chess(fenA), tinta);
        if (g >= 1 && pierdereDupa >= 1) return ["piesa_neaparata", `${NUME[p2.type]} de pe ${tinta} a rămas descoperit (${mr.san})`, true];
      }
    }
  }
  if (r1 && pierdereDupa >= 2) {
    const b2 = new Chess(fenA); const mr = incearca(b2, pvDupa[0]);
    if (mr) {
      const atacate = piese(b2).filter(x => x.color === cul && (x.type === "k" || VAL[x.type] >= 3) && b2.attackers(x.square, adv).includes(mr.to));
      if (atacate.length >= 2) return ["furculita", `după ${mr.san}, ${NUME[b2.get(mr.to).type]} adversarului atacă două piese`, true];
    }
  }
  if (pvDupa.length >= 3) {
    const b3 = new Chess(fenA); let sahuri = 0;
    for (let k = 0; k < Math.min(5, pvDupa.length); k++) {
      const mr = incearca(b3, pvDupa[k]);
      if (!mr) break;
      if (k % 2 === 0 && /[+#]/.test(mr.san)) sahuri++;
    }
    if (sahuri >= 2 && pierdereDupa >= 3) return ["atac_rege", "regele tău a rămas expus — adversarul vine cu șahuri", true];
  }
  if (pierdereDupa >= 2) return ["tactica_permisa", `${m.san} și adversarul câștigă material (≈${Math.round(pierdereDupa)} pioni)`, true];
  if (pierdereDupa >= 1 && r1) {
    const s = sanDin(fenA, pvDupa[0]);
    if (s) return ["pion_pierdut", `${s} câștigă un pion`, true];
  }
  if (evInainte.mat != null && evInainte.mat !== 0) {
    const matMeu = cul === "w" ? evInainte.mat > 0 : evInainte.mat < 0;
    if (matMeu && pvBest.length && pvBest[0] !== m.u) return ["mat_ratat", `aveai mat în ${Math.abs(evInainte.mat)} începând cu ${sanDin(fenB, pvBest[0])}`, false];
  }
  const ratat = gainBest - gainJucat;
  if (ratat >= 1 && pvBest.length && pvBest[0] !== m.u) {
    const n = Math.round(ratat);
    return ["material_ratat", `${sanDin(fenB, pvBest[0])} câștiga material (≈${n} ${n === 1 ? "pion" : "pioni"})`, false];
  }
  if (faza === "final") return ["tehnica_final", "", false];
  return ["pozitional", "", false];
}

function descriereReusita(cl, fenB, m, fenA, cul) {
  if (cl === "br") {
    const per = pieseInPericol(new Chess(fenA), cul, 3);
    if (per.length) return `${m.san} sacrifică ${NUME[per[0][1].type]} de pe ${per[0][0]}, iar motorul confirmă că e cea mai bună continuare`;
    return `${m.san} e un sacrificiu corect`;
  }
  return `${m.san} era singura mutare care păstra poziția; orice altceva pierdea mult`;
}

// ───────── acuratețe și rating ─────────
export function acurateteMutare(wb, wa) {
  if (wa >= wb) return 100;
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * (wb - wa)) - 3.166924740191411 + 1;
  return Math.max(0, Math.min(100, raw));
}
function mediaArmonica(xs) { xs = xs.map(x => Math.max(x, 1)); return xs.length ? xs.length / xs.reduce((s, x) => s + 1 / x, 0) : null; }
function acurateteAgregata(perechi) {
  if (!perechi.length) return null;
  const sw = perechi.reduce((s, [, w]) => s + w, 0);
  const wm = sw ? perechi.reduce((s, [a, w]) => s + a * w, 0) / sw : perechi.reduce((s, [a]) => s + a, 0) / perechi.length;
  const hm = mediaArmonica(perechi.map(([a]) => a));
  return Math.round(((wm + hm) / 2) * 10) / 10;
}
function pstdev(xs) { const m = xs.reduce((s, x) => s + x, 0) / xs.length; return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length); }
function ponderiVolatilitate(pozitii) {
  const w = pozitii.map(p => winPct(p.ev, "w")), n = w.length - 1;
  if (n <= 0) return [];
  const ws = Math.max(2, Math.min(8, Math.floor(n / 10)));
  const ferestre = [];
  for (let k = 0; k < Math.max(0, Math.min(ws, w.length) - 2); k++) ferestre.push(w.slice(0, ws));
  for (let i = 0; i + ws <= w.length; i++) ferestre.push(w.slice(i, i + ws));
  const p = ferestre.map(f => Math.max(0.5, Math.min(12, f.length > 1 ? pstdev(f) : 0.5)));
  while (p.length < n) p.push(p.length ? p[p.length - 1] : 1);
  return p.slice(0, n);
}
export function ratingBrut(acc) {
  if (acc == null) return null;
  for (let i = 0; i < CURBA.length - 1; i++) {
    const [a0, r0] = CURBA[i], [a1, r1] = CURBA[i + 1];
    if (acc >= a0 && acc <= a1) return r0 + (r1 - r0) * (acc - a0) / (a1 - a0);
  }
  return null;
}
export function ratingDinAcuratete(acc, cat = "joc") {
  const r = ratingBrut(acc);
  if (r == null) return null;
  return Math.max(100, Math.min(3200, Math.round((r + (DEPLASARI[cat] || 0)) / 5) * 5));
}
function statisticiJucator(rezultate, cul, pozitii) {
  const pond = ponderiVolatilitate(pozitii);
  const ale = rezultate.filter(r => r.cul === cul);
  const pw = r => (r.ply - 1 < pond.length ? pond[r.ply - 1] : 1);
  const acc = acurateteAgregata(ale.map(r => [r.acc, pw(r)]));
  const cnt = {}; [...CLASE.map(c => c[0]), "fo"].forEach(c => cnt[c] = 0);
  ale.forEach(r => cnt[r.cl]++);
  const grup = (f, minN = 3) => {
    const sel = ale.filter(f);
    if (sel.length < minN) return null;
    return { acc: acurateteAgregata(sel.map(r => [r.acc, pw(r)])), n: sel.length };
  };
  const opening = grup(r => r.faza === "deschidere" && r.cl !== "fo");
  const tactics = grup(r => r.tactic && r.cl !== "bk" && r.cl !== "fo", 2);
  if (tactics) {
    const mom = ale.filter(r => r.tactic && r.cl !== "bk" && r.cl !== "fo");
    tactics.gasite = mom.filter(r => r.loss <= 2).length; tactics.total = mom.length;
  }
  let strategy = grup(r => r.faza === "mijloc" && !r.tactic && r.cl !== "bk" && r.cl !== "fo");
  if (!strategy) strategy = grup(r => r.faza !== "final" && !r.tactic && r.cl !== "bk" && r.cl !== "fo");
  const endgame = grup(r => r.faza === "final" && r.cl !== "fo");
  return { acc, cnt, avansat: { opening, tactics, strategy, endgame } };
}
// ratingurile se calculează la afișare, ca să folosească mereu calibrarea curentă
export function cuRatinguri(st) {
  if (!st) return st;
  const av = {};
  for (const [k, v] of Object.entries(st.avansat)) av[k] = v ? { ...v, r: ratingDinAcuratete(v.acc, k) } : null;
  return { ...st, gRating: ratingDinAcuratete(st.acc, "joc"), avansat: av };
}
export function calibreaza(esantioane) {
  // esantioane = [[categorie, acuratete, rating real]]
  const g = {};
  for (const [cat, acc, r] of esantioane) {
    const b = ratingBrut(acc);
    if (b == null || acc == null || acc < 20 || acc > 99.9 || !r) continue;
    (g[cat] = g[cat] || [[], []])[0].push(b); g[cat][1].push(r);
  }
  const out = { ...DEPLASARI_IMPLICITE };
  for (const [cat, [est, real]] of Object.entries(g)) {
    if (est.length >= 30) {
      const m = a => a.reduce((s, x) => s + x, 0) / a.length;
      out[cat] = Math.round((m(real) - m(est)) / 5) * 5;
    }
  }
  return out;
}

/**
 * Clasifică o partidă.
 * @param pgnInfo rezultatul citestePgn
 * @param pozitii evaluările motorului pentru fiecare poziție (N+1): {ev, pv, ev2, pv2}
 */
export function clasificaPartida(pgnInfo, pozitii, teorie, ecoUrl) {
  const { mutari, fens, ceasuri, headers } = pgnInfo;
  const N = mutari.length;
  if (pozitii.length !== N + 1) throw new Error("analiza nu se potrivește cu partida");
  const faze = calculeazaFaze(fens.slice(0, N));
  const tc = parseInt((headers.TimeControl || "600").split("+")[0], 10) || 600;
  const inc = parseInt((headers.TimeControl || "").split("+")[1] || "0", 10) || 0;
  const timpi = [], ultim = { w: tc, b: tc };
  ceasuri.forEach((c, i) => {
    const cul = i % 2 === 0 ? "w" : "b";
    if (c == null) timpi.push(null);
    else { timpi.push(Math.round(Math.max(0, ultim[cul] - c + (i > 1 ? inc : 0)) * 10) / 10); ultim[cul] = c; }
  });
  const plyEco = plyTeorieEcoUrl(ecoUrl);
  const plies = [], rezultate = [];
  let numeCurent = null;
  let inTeorie = true, lossPrev = null, clPrev = null;
  for (let i = 0; i < N; i++) {
    const fenB = fens[i], fenA = fens[i + 1], m = mutari[i];
    const before = new Chess(fenB), cul = before.turn();
    const pz = pozitii[i], pzD = pozitii[i + 1];
    const bestU = pz.pv && pz.pv.length ? pz.pv[0] : null;
    const jucatBest = bestU === m.u;
    const wb = winPct(pz.ev, cul);
    const wa = jucatBest ? wb : winPct(pzD.ev, cul);
    const loss = Math.max(0, wb - wa);
    const w2 = pz.ev2 ? winPct(pz.ev2, cul) : null;
    const legale = before.moves().length;
    let cl;
    if (inTeorie && (teorie.eTeorie(fenA) || i + 1 <= plyEco)) cl = "bk";
    else {
      inTeorie = false;
      if (legale === 1) cl = "fo";
      else if (loss <= 2) {
        const prev = i > 0 ? mutari[i - 1] : null;
        if (eSacrificiu(fenB, m, fenA, cul) && wa >= 45 && wb < 95) cl = "br";
        else if (jucatBest && w2 != null && wb <= 97 && ((wb - w2 >= 15) || (lossPrev != null && lossPrev >= 10 && wb - w2 >= 8))
          && !mutareEvidenta(fenB, m, prev)) cl = "gr";
        else cl = jucatBest ? "be" : "ex";
      } else if (loss <= 5) cl = "go";
      else if (loss <= 10) cl = "in";
      else cl = loss <= 20 ? "mi" : "bl";
    }
    let tip = null, det = null, aPierdut = false;
    if (cl === "mi" || cl === "bl") {
      [tip, det, aPierdut] = motivEroare(fenB, m, fenA, cul, pz.ev, pzD.ev, pz.pv || [], pzD.pv || [], faze[i], wb);
      if (!aPierdut && (tip === "material_ratat" || tip === "mat_ratat") && wa >= 30) cl = "ms";
    }
    const tactic = (w2 != null && wb - w2 >= 10 && wb <= 97) || (lossPrev != null && lossPrev >= 10) || (ERORI.includes(cl) && TACTICE.has(tip));
    const acc = acurateteMutare(wb, wa);
    const evDupa = jucatBest ? pz.ev : pzD.ev;
    const nm = teorie.nume[Teorie.cheie(fenA)]; if (nm) numeCurent = nm[1];
    const p = {
      s: m.san, u: m.u, from: m.from, to: m.to, fen: fenA, fenB, cul, cl, a: Math.round(acc),
      wb: Math.round(wb), wa: Math.round(wa), loss: Math.round(loss * 10) / 10,
      wAlb: Math.round(winPct(evDupa, "w") * 10) / 10, v: evText(evDupa), faza: faze[i],
      k: ceasuri[i] != null ? Math.round(ceasuri[i]) : null, t: timpi[i],
    };
    if (cl === "bk") p.desch = numeCurent;
    if (bestU) { p.bu = bestU; p.b = sanDin(fenB, bestU); }
    if (pz.pv2 && pz.pv2.length && w2 != null) { p.bu2 = pz.pv2[0]; p.w2 = Math.round(w2 * 10) / 10; p.wbx = Math.round(wb * 10) / 10; }
    if (lossPrev != null && lossPrev >= 10 && ["br", "gr", "be", "ex"].includes(cl)) p.pd = 1;
    if (tip) { p.tip = tip; p.tipRo = TIPURI[tip]; p.det = det; }
    if (["in", "mi", "ms", "bl", "go"].includes(cl)) p.mea = linie(fenB, pz.pv, 6);
    if (["mi", "ms", "bl"].includes(cl)) {
      p.adv = linie(fenA, pzD.pv, 6);
      const ctx = [];
      if (ERORI.includes(clPrev) || (lossPrev != null && lossPrev >= 10)) ctx.push("ocazie_nepedepsita");
      if (p.k != null && p.k < 60) ctx.push("criza_timp");
      if (p.t != null && p.t < 3 && i >= 10) ctx.push("graba");
      if (p.t != null && p.t > 30) ctx.push("gandit_mult");
      p.ctx = ctx;
    }
    if (cl === "br" || cl === "gr") { p.mea = linie(fenB, pz.pv, 7); p.det = descriereReusita(cl, fenB, m, fenA, cul); }
    // amenințarea adversarului după mutare (ce vrea să joace)
    if (pzD.pv && pzD.pv.length) { p.am = pzD.pv[0]; p.amS = sanDin(fenA, pzD.pv[0]); }
    plies.push(p);
    rezultate.push({ cul, wb, wa, cl, faza: faze[i], tactic, loss, acc, ply: i + 1 });
    lossPrev = loss; clPrev = cl;
  }
  return {
    plies,
    alb: statisticiJucator(rezultate, "w", pozitii),
    negru: statisticiJucator(rezultate, "b", pozitii),
    deschidere: numeDinEcoUrl(ecoUrl) || teorie.numeDeschidere(fens.slice(0, 30)) || "",
    evStart: winPct(pozitii[0].ev, "w"),
  };
}

/** Clasa unei mutări încercate de tine în explorare (fără Genial/Grozav/Ratare). */
export function clasaSimpla(wb, wa, eBest) {
  const loss = Math.max(0, wb - wa);
  if (eBest || loss <= 0.3) return "be";
  if (loss <= 2) return "ex";
  if (loss <= 5) return "go";
  if (loss <= 10) return "in";
  return loss <= 20 ? "mi" : "bl";
}

// ───────── comentariile antrenorului ─────────
const CTX_RO = { ocazie_nepedepsita: "Adversarul greșise chiar înainte.", criza_timp: "Aveai sub un minut pe ceas.",
  graba: "Ai mutat în mai puțin de 3 secunde.", gandit_mult: "Te-ai gândit peste 30 de secunde." };
export function comentariu(p, eMea, deschidere) {
  const cine = eMea ? "" : "Adversarul: ";
  const best = p.b && p.bu !== p.u ? ` Cea mai bună era ${p.b}.` : "";
  switch (p.cl) {
    case "bk": return `${p.s} e o mutare de teorie${p.desch || deschidere ? `: ${p.desch || deschidere}` : ""}.`;
    case "fo": return `${p.s} era singura mutare legală.`;
    case "br": return `${cine}${p.s} e o mutare genială! ${cap(p.det || "")}.`;
    case "gr": return `${cine}${p.s} e o mutare grozavă. Era singura care păstra poziția.`;
    case "be": return `${cine}${p.s} e cea mai bună mutare.${p.pd ? " Ai pedepsit greșeala adversarului." : ""}`;
    case "ex": return `${cine}${p.s} e o mutare excelentă.${best}`;
    case "go": return `${cine}${p.s} e o mutare bună.${best}`;
    case "in": return `${cine}${p.s} e o inexactitate.${best}`;
    case "mi": return `${cine}${p.s} e o greșeală. ${p.det ? cap(p.det) + "." : ""}${best}${ctxTxt(p, eMea)}`;
    case "ms": return `${cine}${p.s} ratează o ocazie. ${p.det ? cap(p.det) + "." : ""}${ctxTxt(p, eMea)}`;
    case "bl": return `${cine}${p.s} e o gafă. ${p.det ? cap(p.det) + "." : ""}${best}${ctxTxt(p, eMea)}`;
    default: return p.s;
  }
}
function ctxTxt(p, eMea) { return eMea && p.ctx && p.ctx.length ? " " + p.ctx.map(c => CTX_RO[c]).filter(Boolean).join(" ") : ""; }
const cap = t => (t ? t[0].toUpperCase() + t.slice(1) : t);
