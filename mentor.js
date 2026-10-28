// mentor.js — mentorul de analiză: explică pe înțeles fiecare mutare (ce face, ce problemă creează,
// de ce altă mutare era mai bună), legătura cu cursurile tale de deschideri și lecțiile întregii partide.
// Totul se calculează din pozițiile partidei și din liniile lui Stockfish, pe dispozitiv.
import { Chess } from "./chess.js?v=40";
import * as A from "./analiza.js?v=40";
import { fig, figText, esc, alege, plural, numeRo } from "./util.js?v=40";

const VAL = A.VAL;
const DEF = { p: "pionul", n: "calul", b: "nebunul", r: "turnul", q: "dama", k: "regele" };
const UN = { p: "un pion", n: "un cal", b: "un nebun", r: "un turn", q: "o damă", k: "regele" };
const PL = { p: "pioni", n: "cai", b: "nebuni", r: "turnuri", q: "dame" };
const IN = { q: "damă", r: "turn", b: "nebun", n: "cal", p: "pion", k: "rege" };
const GEN = { p: "pionului", n: "calului", b: "nebunului", r: "turnului", q: "damei", k: "regelui" };
const DEFPL = { p: "pionii", n: "caii", b: "nebunii", r: "turnurile", q: "damele" };
const FEM = { r: true, q: true };
const cap = t => (t ? t[0].toUpperCase() + t.slice(1) : t);
const pe = (t, sq) => `${DEF[t]} de pe ${sq}`;
const F = (k, w, tu, el, x = {}) => ({ k, w, tu, el, ...x });
const s = t => `<b>${fig(t)}</b>`;

function regeLa(ch, cul) {
  for (const r of ch.board()) for (const x of r) if (x && x.type === "k" && x.color === cul) return x.square;
  return null;
}
function catePiese(lista) {
  const c = {};
  for (const t of lista) c[t] = (c[t] || 0) + 1;
  return Object.entries(c).sort((a, b) => VAL[b[0]] - VAL[a[0]]).map(([t, n]) => (n === 1 ? UN[t] : `${n === 2 ? (FEM[t] ? "două" : "doi") : n} ${PL[t]}`));
}
const enumera = xs => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " și " + xs[xs.length - 1]);


// ───────── schimburi rapide (SEE pe un tablou simplu, fără generarea tuturor mutărilor) ─────────
// tabla: 64 de câmpuri (0 = a1 … 63 = h8), fiecare „wP”, „bN” … sau null
function tabla64(fen) {
  const t = new Array(64).fill(null), rows = fen.split(" ")[0].split("/");
  rows.forEach((r, i) => { let f = 0; for (const c of r) { if (/\d/.test(c)) f += +c; else { t[(7 - i) * 8 + f] = (c === c.toUpperCase() ? "w" : "b") + c.toUpperCase(); f++; } } });
  return t;
}
const idx = sq => (sq.charCodeAt(0) - 97) + 8 * (+sq[1] - 1);
const nume = i => String.fromCharCode(97 + (i % 8)) + (Math.floor(i / 8) + 1);
const VT = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
function atacatori(t, i, cul) {
  const out = [], f = i % 8, r = Math.floor(i / 8);
  const la = (ff, rr) => (ff >= 0 && ff < 8 && rr >= 0 && rr < 8 ? rr * 8 + ff : -1);
  const pr = cul === "w" ? -1 : 1; // pionii albi atacă în sus: vin de pe rândul de dedesubt
  for (const df of [-1, 1]) { const j = la(f + df, r + pr); if (j >= 0 && t[j] === cul + "P") out.push(j); }
  for (const [df, dr] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) { const j = la(f + df, r + dr); if (j >= 0 && t[j] === cul + "N") out.push(j); }
  for (const [df, dr, tipuri] of [[1, 0, "RQ"], [-1, 0, "RQ"], [0, 1, "RQ"], [0, -1, "RQ"], [1, 1, "BQ"], [1, -1, "BQ"], [-1, 1, "BQ"], [-1, -1, "BQ"]]) {
    let ff = f + df, rr = r + dr;
    while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) {
      const x = t[rr * 8 + ff];
      if (x) { if (x[0] === cul && tipuri.includes(x[1])) out.push(rr * 8 + ff); break; }
      ff += df; rr += dr;
    }
  }
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) { if (!df && !dr) continue; const j = la(f + df, r + dr); if (j >= 0 && t[j] === cul + "K") out.push(j); }
  return out;
}
// câștigul (≥ 0) pentru `cul`, care începe schimburile pe câmpul i
function seeT(t, i, cul, ad = 0) {
  if (ad > 14 || !t[i]) return 0;
  const op = cul === "w" ? "b" : "w";
  const at = atacatori(t, i, cul).sort((a, b) => VT[t[a][1]] - VT[t[b][1]] || (t[a][1] === "K") - (t[b][1] === "K"));
  for (const a of at) {
    const t2 = t.slice(), luat = VT[t2[i][1]] + (t2[i][1] === "K" ? 100 : 0);
    let piesa = t2[a];
    const prom = piesa[1] === "P" && (Math.floor(i / 8) === 7 || Math.floor(i / 8) === 0);
    if (prom) piesa = cul + "Q";
    t2[i] = piesa; t2[a] = null;
    if (piesa[1] === "K" && atacatori(t2, i, op).length) continue; // regele nu poate lua pe un câmp apărat
    return Math.max(0, luat + (prom ? 8 : 0) - seeT(t2, i, op, ad + 1));
  }
  return 0;
}
const seeFen = (fen, sq, cul) => seeT(tabla64(fen), idx(sq), cul);
// piesele culorii `cul` pe care `atac` le poate câștiga (ca pieseInPericol din analiza.js, dar rapid)
function pericol(fen, cul, atac) {
  const t = tabla64(fen), out = [];
  for (let i = 0; i < 64; i++) {
    const x = t[i];
    if (!x || x[0] !== cul || x[1] === "K") continue;
    if (!atacatori(t, i, atac).length) continue;
    const g = seeT(t, i, atac);
    if (g > 0) out.push([nume(i), { type: x[1].toLowerCase(), color: cul, square: nume(i) }, g]);
  }
  return out.sort((a, b) => b[2] - a[2]);
}

// ───────── legături (pin) și frigări create de o piesă lungă ─────────
const DIR = { b: [[1, 1], [1, -1], [-1, 1], [-1, -1]], r: [[1, 0], [-1, 0], [0, 1], [0, -1]] };
DIR.q = [...DIR.b, ...DIR.r];
function raza(ch, sq, d) {
  const out = [];
  let f = sq.charCodeAt(0) - 97 + d[0], r = +sq[1] + d[1];
  while (f >= 0 && f < 8 && r >= 1 && r <= 8) {
    const q = String.fromCharCode(97 + f) + r, x = ch.get(q);
    if (x) { out.push({ sq: q, ...x }); if (out.length === 2) break; }
    f += d[0]; r += d[1];
  }
  return out;
}
function legaturi(ch, sq, cul) {
  const x = ch.get(sq); if (!x || !DIR[x.type]) return [];
  const out = [];
  for (const d of DIR[x.type]) {
    const [a, b] = raza(ch, sq, d);
    if (!a || !b || a.color === cul || b.color === cul) continue;
    if (a.type !== "k" && (a.type !== "p" || b.type === "k") && (b.type === "k" || (VAL[b.type] > VAL[a.type] && "qr".includes(b.type)))) out.push({ tip: "legare", x: a, y: b });
    else if ((a.type === "k" || (VAL[a.type] >= 5 && VAL[a.type] > VAL[b.type])) && b.type !== "p" && b.type !== "k") out.push({ tip: "frigare", x: a, y: b });
  }
  return out;
}
// câmpul c e strict între a și b, pe aceeași linie, coloană sau diagonală
function intre(a, b, c) {
  const [fa, ra, fb, rb, fc, rc] = [a.charCodeAt(0), +a[1], b.charCodeAt(0), +b[1], c.charCodeAt(0), +c[1]];
  const df = Math.sign(fb - fa), dr = Math.sign(rb - ra);
  if (!(fa === fb || ra === rb || Math.abs(fb - fa) === Math.abs(rb - ra))) return false;
  for (let f = fa + df, r = ra + dr; f !== fb || r !== rb; f += df, r += dr) if (f === fc && r === rc) return true;
  return false;
}
function pionLiber(ch, sq, cul) {
  const f = sq.charCodeAt(0) - 97, r = +sq[1];
  for (let ff = Math.max(0, f - 1); ff <= Math.min(7, f + 1); ff++) {
    for (let rr = 1; rr <= 8; rr++) {
      if (cul === "w" ? rr <= r : rr >= r) continue;
      const x = ch.get(String.fromCharCode(97 + ff) + rr);
      if (x && x.type === "p" && x.color !== cul) return false;
    }
  }
  return true;
}
// rocada e posibilă acum? (doar mutările regelui, nu toate mutările)
function poateRoca(fen, cul) {
  const ch = new Chess(fen.replace(/ [wb] /, ` ${cul} `).replace(/ ([KQkq-]+) [a-h36-]+ /, " $1 - "));
  const k = regeLa(ch, cul); if (!k) return false;
  try { return ch.moves({ square: k, verbose: true }).some(m => m.flags.includes("k") || m.flags.includes("q")); } catch (e) { return false; }
}
const distCentru = sq => Math.max(Math.abs(sq.charCodeAt(0) - 100.5), Math.abs(+sq[1] - 4.5));

/**
 * Ce face o mutare: lista de „fapte”, fiecare cu forma la persoana a II-a (tu) și a III-a (el).
 * o: {ply (1 = prima mutare), faza, prev (mutarea anterioară, verbose), mutateDeja (Set de câmpuri unde au ajuns piesele mutătorului)}
 */
export function scop(fenB, u, o = {}) {
  const inainte = new Chess(fenB), cul = inainte.turn(), adv = A.opus(cul);
  const dupa = new Chess(fenB), m = A.incearca(dupa, u);
  if (!m) return [];
  const out = [], t = m.piece, P = DEF[t], ply = o.ply ?? 99, faza = o.faza || "mijloc";
  if (dupa.isCheckmate()) return [F("mat", 100, "dai mat", "dă mat")];
  if (dupa.isStalemate()) return [F("pat", 50, "faci pat: partida se termină remiză", "face pat: partida se termină remiză", { neg: true })];
  if (m.promotion) out.push(F("prom", 9, `promovezi pionul în ${IN[m.promotion]}`, `promovează pionul în ${IN[m.promotion]}`));
  if (m.flags.includes("k") || m.flags.includes("q")) out.push(F("rocada", 6, "faci rocada și îți pui regele la adăpost", "face rocada și își pune regele la adăpost"));
  const capt = m.flags.includes("e") ? "p" : m.captured;
  if (capt) {
    const reluat = seeFen(dupa.fen(), m.to, adv);
    const net = VAL[capt] - reluat;
    const recaptura = o.prev && o.prev.to === m.to && o.prev.captured && VAL[o.prev.captured] === VAL[capt];
    if (recaptura && net > -1) out.push(F("reia", 5, `reiei ${DEF[capt]}`, `reia ${DEF[capt]}`));
    else if (net >= 1) out.push(F("castiga", 8 + VAL[capt] / 3, `câștigi ${pe(capt, m.to)}`, `câștigă ${pe(capt, m.to)}`, { val: net }));
    else if (VAL[capt] === VAL[t] && reluat >= VAL[t] - .5) {
      const x = capt === t ? DEFPL[t] : `${P} pe ${IN[capt] || "pion"}`;
      out.push(F("schimb", 4, `schimbi ${x}`, `schimbă ${x}`));
    }
    else out.push(F("ia", 4, `iei ${pe(capt, m.to)}`, `ia ${pe(capt, m.to)}`));
  }
  let sahDirect = false;
  if (dupa.inCheck()) {
    const k = regeLa(dupa, adv), sahuri = k ? dupa.attackers(k, cul) : [];
    sahDirect = sahuri.includes(m.to);
    const dublu = sahuri.length >= 2, desc = !sahDirect;
    out.push(F("sah", 5, dublu ? "dai șah dublu" : desc ? "dai șah descoperit" : "dai șah", dublu ? "dă șah dublu" : desc ? "dă șah descoperit" : "dă șah"));
  }
  // atacuri noi: piese ale adversarului pe care le-ai putea câștiga la mutarea următoare
  const fenD = dupa.fen();
  const amen = pericol(fenD, adv, cul);
  const vechi = new Set(pericol(fenB, adv, cul).map(x => x[0]));
  const noi = amen.filter(x => !vechi.has(x[0]) && x[0] !== m.to);
  const directe = noi.filter(x => dupa.attackers(x[0], cul).includes(m.to));
  // atac descoperit: o piesă lungă atacă ținta pe o linie care trecea prin câmpul de plecare
  const descoperite = noi.filter(x => !directe.includes(x) && dupa.attackers(x[0], cul).some(a => a !== m.to && "brq".includes(dupa.get(a)?.type) && intre(a, x[0], m.from)));
  const tinte = [...(sahDirect ? ["regele"] : []), ...directe.sort((a, b) => VAL[b[1].type] - VAL[a[1].type]).map(x => pe(x[1].type, x[0]))];
  if (tinte.length >= 2) out.push(F("furculita", 9, `faci o furculiță (${P} atacă ${enumera(tinte.slice(0, 3))})`, `face o furculiță (${P} atacă ${enumera(tinte.slice(0, 3))})`));
  else if (directe.length === 1 && !capt) out.push(F("ataca", 5 + VAL[directe[0][1].type] / 3, `ataci ${tinte[0]}`, `atacă ${tinte[0]}`));
  if (descoperite.length) {
    const d = descoperite[0];
    out.push(F("descoperit", 7, `descoperi un atac asupra ${GEN[d[1].type]} de pe ${d[0]}`, `descoperă un atac asupra ${GEN[d[1].type]} de pe ${d[0]}`));
  }
  if (DIR[t]) for (const l of legaturi(dupa, m.to, cul)) {
    if (l.tip === "legare") out.push(F("legare", 6, `legi ${pe(l.x.type, l.x.sq)} de ${IN[l.y.type]}`, `leagă ${pe(l.x.type, l.x.sq)} de ${IN[l.y.type]}`));
    else out.push(F("frigare", 6, `faci o frigare: ataci ${DEF[l.x.type]}, iar în spatele ${l.x.type === "q" ? "ei" : "lui"} stă ${DEF[l.y.type]}`, `face o frigare: atacă ${DEF[l.x.type]}, iar în spate stă ${DEF[l.y.type]}`));
  }
  // apărare: piese care erau în priză înainte și acum nu mai sunt
  const perB = pericol(fenB, cul, adv);
  const perA = pericol(fenD, cul, adv);
  const peA = new Set(perA.map(x => x[0]));
  if (perB.some(x => x[0] === m.from) && !peA.has(m.to) && !capt) out.push(F("scapa", 5, `îți pui ${P} la adăpost`, `își pune ${P} la adăpost`));
  const aparate = perB.filter(x => x[0] !== m.from && !peA.has(x[0]));
  if (aparate.length) out.push(F("apara", 5, `aperi ${pe(aparate[0][1].type, aparate[0][0])}`, `apără ${pe(aparate[0][1].type, aparate[0][0])}`));
  if (inainte.inCheck() && !out.some(x => ["castiga", "ia", "reia", "schimb"].includes(x.k))) out.push(F("aparasah", 3, t === "k" ? "îți muți regele din șah" : "pui o piesă în calea șahului", t === "k" ? "își mută regele din șah" : "blochează șahul"));
  // probleme create de mutare (pentru greșeli)
  const lasate = perA.filter(x => x[0] !== m.to && !perB.some(y => y[0] === x[0]));
  if (perA.some(x => x[0] === m.to) && !(capt && VAL[capt] >= VAL[t])) {
    const x = perA.find(y => y[0] === m.to);
    if (x[2] >= 1) out.push(F("inpriza", 7, `${P} de pe ${m.to} poate fi luat${FEM[t] ? "ă" : ""}`, `${P} de pe ${m.to} poate fi luat${FEM[t] ? "ă" : ""}`, { neg: true, sfat: "verifica", sq: m.to }));
  }
  if (lasate.length) out.push(F("lasa", 7, `lași ${pe(lasate[0][1].type, lasate[0][0])} fără apărare`, `lasă ${pe(lasate[0][1].type, lasate[0][0])} fără apărare`, { neg: true, sfat: "verifica", sq: lasate[0][0] }));
  // principii (deschidere, structură, final)
  const rand0 = cul === "w" ? "1" : "8";
  if ("nb".includes(t) && m.from[1] === rand0 && ply <= 30 && !capt) out.push(F("dezv", 4, `dezvolți ${P}`, `dezvoltă ${P}`));
  if (t === "q" && ply <= 14 && !capt && !dupa.inCheck() && m.from === (cul === "w" ? "d1" : "d8")) out.push(F("dama", 1, "scoți dama devreme", "scoate dama devreme", { neg: true, sfat: "dama" }));
  if ("nbq".includes(t) && ply <= 18 && !capt && o.mutateDeja && o.mutateDeja.has(m.from) && !perB.some(x => x[0] === m.from) && !dupa.inCheck())
    out.push(F("tempo", 1, `muți ${P} a doua oară în deschidere`, `mută ${P} a doua oară în deschidere`, { neg: true, sfat: "tempo" }));
  if (t === "p" && !capt && ["d4", "e4", "d5", "e5"].includes(m.to) && ply <= 20) out.push(F("centru", 3, "ocupi centrul", "ocupă centrul"));
  else if (t === "p" && ["c4", "c5", "f4", "f5"].includes(m.to) && ply <= 16 && !capt) out.push(F("centru", 2, "lupți pentru centru", "luptă pentru centru"));
  if (t === "r" && !capt && m.from[0] !== m.to[0]) {
    let proprii = 0, straini = 0;
    for (let r = 1; r <= 8; r++) { const x = dupa.get(m.to[0] + r); if (x && x.type === "p") (x.color === cul ? proprii++ : straini++); }
    if (!proprii) out.push(F("coloana", 3, `ocupi coloana ${straini ? "semideschisă" : "deschisă"} ${m.to[0]}`, `ocupă coloana ${straini ? "semideschisă" : "deschisă"} ${m.to[0]}`));
  }
  if (t === "p" && !capt && pionLiber(dupa, m.to, cul)) {
    const avans = cul === "w" ? +m.to[1] : 9 - +m.to[1];
    out.push(F("liber", 3 + avans / 2, "împingi pionul liber", "împinge pionul liber"));
  }
  if (t === "k" && faza === "final" && distCentru(m.to) < distCentru(m.from)) out.push(F("rege", 3, "îți activezi regele", "își activează regele"));
  if (t === "k" && !m.flags.includes("k") && !m.flags.includes("q") && faza !== "final" && /[KQkq]/.test(fenB.split(" ")[2].replace(cul === "w" ? /[kq]/g : /[KQ]/g, "")))
    out.push(F("fararocada", 2, "pierzi dreptul la rocadă", "pierde dreptul la rocadă", { neg: true, sfat: "rocada" }));
  const rege = regeLa(inainte, cul);
  if (t === "p" && "fgh".includes(m.from[0]) && rege && "gh".includes(rege[0]) && rege[1] === rand0 && m.from[1] === (cul === "w" ? "2" : "7") && faza !== "final" && !capt)
    out.push(F("slabeste", 2, "slăbești adăpostul regelui", "își slăbește adăpostul regelui", { neg: true, sfat: "pioni-rege" }));
  if (!out.some(x => x.k === "rocada") && faza === "deschidere" && /[KQkq]/.test(fenD.split(" ")[2]) && poateRoca(fenD, cul) && !poateRoca(fenB, cul)) out.push(F("pregroc", 2, "pregătești rocada", "pregătește rocada"));
  // idei cu pionii: ferestruica regelui, fianchetto, diagonala deschisă, câmpurile controlate, presiunea pe pionii adverși
  if (t === "p" && !capt) {
    const fl = m.to[0], rFin = +m.to[1], inainteSus = cul === "w" ? 1 : -1;
    const regeAici = rege && Math.abs(rege.charCodeAt(0) - m.to.charCodeAt(0)) <= 1 && rege[1] === rand0;
    if ("ah".includes(fl) && m.from[1] === (cul === "w" ? "2" : "7") && Math.abs(+m.to[1] - +m.from[1]) === 1) {
      const sqc = String.fromCharCode(fl === "h" ? 103 : 98) + (rFin + inainteSus);
      if (regeAici && faza !== "deschidere") out.push(F("luft", 3, "faci loc regelui (o „ferestruică” contra matului pe ultima linie)", "face loc regelui contra matului pe ultima linie"));
      else { const ale = adv === "w" ? "albe" : "negre"; out.push(F("profilaxie", 2, `nu lași piesele ${ale} să vină pe ${sqc}`, `nu lasă piesele ${ale} să vină pe ${sqc}`)); }
    }
    const fian = { g: "f", b: "c" }[fl];
    if (fian && m.from[1] === (cul === "w" ? "2" : "7") && +m.to[1] === (cul === "w" ? 3 : 6)) {
      const nb = inainte.get(fian + rand0);
      if (nb && nb.type === "b" && nb.color === cul) out.push(F("fianchetto", 3, "pregătești ieșirea nebunului pe diagonala lungă", "pregătește ieșirea nebunului pe diagonala lungă"));
    }
    for (const nbSq of ["c" + rand0, "f" + rand0]) {
      const nb = inainte.get(nbSq);
      if (!nb || nb.type !== "b" || nb.color !== cul || out.some(x => x.k === "fianchetto")) continue;
      const fl = nbSq.charCodeAt(0), rr = cul === "w" ? 2 : 7;
      const vecini = [fl - 1, fl + 1].filter(x => x >= 97 && x <= 104).map(x => String.fromCharCode(x) + rr);
      const blocat = vecini.every(q => inainte.get(q)), liber = vecini.some(q => !dupa.get(q));
      if (blocat && liber) { out.push(F("diagonala", 3, "deschizi drumul nebunului", "deschide drumul nebunului")); break; }
    }
    const loviti = [];
    for (const df of [-1, 1]) {
      const f2 = m.to.charCodeAt(0) + df; if (f2 < 97 || f2 > 104) continue;
      const sq2 = String.fromCharCode(f2) + (rFin + inainteSus), x = dupa.get(sq2);
      if (x && x.type === "p" && x.color === adv) loviti.push(sq2);
    }
    if (loviti.length && !out.some(x => ["ataca", "furculita"].includes(x.k))) out.push(F("tensiune", 3, `lovești în pionul de pe ${loviti[0]}`, `lovește în pionul de pe ${loviti[0]}`));
    if ((cul === "w" ? rFin >= 5 : rFin <= 4) && faza !== "final" && !out.some(x => x.k === "liber")) out.push(F("spatiu", 2, "câștigi spațiu", "câștigă spațiu"));
    if (!out.some(x => !x.neg && x.w >= 2)) {
      const ctrl = [];
      for (const df of [-1, 1]) { const f2 = m.to.charCodeAt(0) + df; if (f2 >= 97 && f2 <= 104 && rFin + inainteSus >= 1 && rFin + inainteSus <= 8) ctrl.push(String.fromCharCode(f2) + (rFin + inainteSus)); }
      if (ctrl.length) out.push(F("control", 1.5, `controlezi ${ctrl.length > 1 ? "câmpurile" : "câmpul"} ${enumera(ctrl)}`, `controlează ${ctrl.length > 1 ? "câmpurile" : "câmpul"} ${enumera(ctrl)}`));
    }
  }
  const sah = out.find(x => x.k === "sah"), capt2 = out.find(x => ["castiga", "ia", "reia", "schimb"].includes(x.k));
  if (sah && capt2 && sah.tu === "dai șah") { capt2.tu += " cu șah"; capt2.el += " cu șah"; capt2.w = Math.max(capt2.w, 6); out.splice(out.indexOf(sah), 1); }
  if (!out.some(x => !x.neg)) {
    if (t === "p") out.push(F("pion", 1, "împingi pionul", "împinge pionul"));
    else if (t === "k") out.push(F("muta", 1, "muți regele", "mută regele"));
    else out.push(F("muta", 1, `îți repoziționezi ${P}`, `își repoziționează ${P}`));
  }
  return out.sort((a, b) => b.w - a.w);
}

/** Propoziția „ce face mutarea”, din cele mai importante fapte pozitive. pers: "tu" | "el" */
export function fraza(fapte, pers = "tu", max = 2) {
  const poz = fapte.filter(f => !f.neg);
  const alese = [];
  if (poz.length && poz[0].w >= 8) max = 1;
  for (const f of poz) {
    if (alese.length >= max) break;
    if (alese.some(a => a.k === f.k)) continue;
    if (f.k === "sah" && alese.some(a => a.k === "furculita")) continue;
    if (f.k === "dezv" && alese.some(a => ["castiga", "furculita"].includes(a.k))) continue;
    alese.push(f);
  }
  if (!alese.length) return "";
  return alese.map(f => f[pers]).join(alese.length === 2 ? " și " : ", ");
}
const negative = fapte => fapte.filter(f => f.neg);

// ───────── rezultatul material al unei linii ─────────
export function rezultatLinie(fen, pv, cul, max = 10) {
  const ch = new Chess(fen), pasi = [];
  let mat = null;
  for (const u of (pv || []).slice(0, max)) {
    const m = A.incearca(ch, u); if (!m) break;
    pasi.push({ m, c: m.flags.includes("e") ? "p" : m.captured || null });
    if (ch.isCheckmate()) { mat = m.color; break; }
  }
  // sfârșitul secvenței forțate: primul moment (după cel puțin o mutare a fiecăruia) în care urmează o mutare liniștită
  let k = pasi.length;
  if (!mat) for (let i = 2; i < pasi.length; i++) { const x = pasi[i]; if (!x.c && !/[+#]/.test(x.m.san) && !x.m.promotion) { k = i; break; } }
  const castig = [], pierd = []; let prom = null;
  for (const p of pasi.slice(0, k)) {
    if (p.c) (p.m.color === cul ? castig : pierd).push(p.c);
    if (p.m.promotion) prom = p.m.color;
  }
  // schimburile egale se anulează
  for (const t of ["q", "r", "b", "n", "p"]) {
    for (let i = castig.length - 1; i >= 0; i--) {
      if (VAL[castig[i]] !== VAL[t]) continue;
      const j = pierd.findIndex(x => VAL[x] === VAL[castig[i]]);
      if (j >= 0) { castig.splice(i, 1); pierd.splice(j, 1); }
    }
  }
  const d = castig.reduce((s, x) => s + VAL[x], 0) - pierd.reduce((s, x) => s + VAL[x], 0) + (prom === cul ? 8 : prom ? -8 : 0);
  let ultimaCapt = -1;
  pasi.slice(0, k).forEach((p, j) => { if (p.c || p.m.promotion || /#/.test(p.m.san)) ultimaCapt = j; });
  const lung = mat ? pasi.length : Math.max(2, Math.min(k, ultimaCapt + 2));
  return { castig, pierd, d, mat, prom, k: Math.max(k, 1), linie: pasi.slice(0, lung).map(p => p.m.san) };
}
/** „câștigi un cal”, „pierzi calitatea”… pers = "tu" | "el" pentru partea cul din rezultatLinie */
export function textMaterial(r, pers = "tu") {
  const tu = pers === "tu", { castig, pierd } = r;
  const V = { castig: tu ? "câștigi" : "câștigă", pierd: tu ? "pierzi" : "pierde", dai: tu ? "dai" : "dă" };
  if (r.prom && !castig.length && !pierd.length) return null;
  if (castig.length === 1 && pierd.length === 1 && castig[0] === "r" && "nb".includes(pierd[0])) return `${V.castig} calitatea`;
  if (castig.length === 1 && pierd.length === 1 && pierd[0] === "r" && "nb".includes(castig[0])) return `${V.pierd} calitatea`;
  const lc = enumera(catePiese(castig)), lp = enumera(catePiese(pierd));
  if (castig.length && !pierd.length) return `${V.castig} ${lc}`;
  if (!castig.length && pierd.length) return `${V.pierd} ${lp}`;
  if (!castig.length && !pierd.length) return null;
  if (r.d > 0) return `${V.castig} ${lc} pentru ${lp}`;
  if (r.d < 0) return `${V.pierd} ${lp} pentru ${lc}`;
  return `${V.dai} ${lp} pe ${lc}`;
}
const liniaTxt = (sans, n = 5) => sans.slice(0, n).map(x => fig(x)).join(" ");

// ───────── indexul cursurilor: ce se joacă în cursurile tale din fiecare poziție ─────────
let IDX = null;
export function indexCursuri(cursuri) {
  if (IDX && IDX.sursa === cursuri) return IDX;
  IDX = { sursa: cursuri, w: new Map(), b: new Map() };
  for (const c of cursuri.cursuri) {
    for (const k of c.capitole) {
      const ch = new Chess();
      k.mutari.forEach(([san, u, com], j) => {
        const cheie = A.Teorie.cheie(ch.fen());
        const harta = IDX[c.culoare];
        if (!harta.has(cheie)) harta.set(cheie, []);
        harta.get(cheie).push({ c, k, j, san, u, com });
        A.incearca(ch, u);
      });
    }
  }
  return IDX;
}
/** Ce recomandă cursurile tale (de culoarea ta) în poziția fen; preferă intrarea care se potrivește cu mutarea jucată. */
export function dinCurs(fen, cul, uJucat) {
  if (!IDX) return null;
  const l = IDX[cul].get(A.Teorie.cheie(fen));
  if (!l || !l.length) return null;
  return l.find(x => x.u === uJucat) || l[0];
}

// ───────── sfaturi practice, după tipul greșelii ─────────
const SFAT = {
  verifica: ["Înainte de fiecare mutare, verifică: ce piese rămân neapărate și ce poate lua adversarul?", "Regula de aur: după ce alegi mutarea, mai privește o dată tabla cu ochii adversarului."],
  mat_permis: ["Când regele are puțini apărători, fiecare șah al adversarului e periculos. Ține piese lângă rege și fă-i o „ferestruică” (un pion împins lângă rege)."],
  atac_rege: ["Dacă adversarul are multe piese lângă regele tău, apără-te înainte să ataci în altă parte."],
  furculita: ["Când regele, dama și turnurile tale stau la o săritură de cal una de alta, caută furculițele adversarului."],
  tactica_permisa: ["Caută întâi mutările forțate ale adversarului: șahuri, capturi și amenințări."],
  pion_pierdut: ["Numără atacatorii și apărătorii fiecărui pion înainte să muți."],
  mat_ratat: ["Caută întâi șahurile: un mat ratat e cea mai scumpă ratare."],
  material_ratat: ["La fiecare mutare, verifică întâi șahurile, capturile și atacurile tale."],
  pozitional: ["Când nu există tactică, îmbunătățește piesa cea mai slabă.", "Întreabă-te la fiecare mutare: ce vrea adversarul? Apoi alege mutarea care îi strică planul.",
    "Compară mutarea ta cu cea mai bună: de multe ori diferența e o piesă care stă pasiv.", "Înainte să muți, uită-te la toate piesele: care e cea mai prost așezată?"],
  tehnica_final: ["În final, regele e o piesă de atac: adu-l spre centru și spre pioni."],
  dama: ["Nu scoate dama prea devreme: adversarul o atacă și își dezvoltă piesele cu tempo."],
  tempo: ["În deschidere, fiecare mutare ar trebui să aducă o piesă nouă în joc."],
  rocada: ["Fă rocada devreme: regele din centru e ținta preferată a atacurilor."],
  "pioni-rege": ["Pionii din fața regelui sunt scutul lui: mută-i doar cu un motiv clar."],
  criza_timp: ["Sub un minut pe ceas: joacă simplu și sigur, fără complicații."],
  graba: ["Ai mutat în mai puțin de 3 secunde. Într-o poziție cu tensiune, 10 secunde de verificare fac diferența."],
  gandit_mult: ["Te-ai gândit mult aici: uneori merită să alegi o mutare sigură și să păstrezi timp pentru final."],
};
export const sfat = (k, cheie) => (SFAT[k] ? alege(SFAT[k], cheie) : null);

const TITLU = {
  br: "e genială", gr: "e o mutare grozavă", be: "e cea mai bună mutare", ex: "e o mutare excelentă", go: "e o mutare bună",
  bk: "e o mutare de teorie", in: "e o inexactitate", mi: "e o greșeală", ms: "e o ratare", bl: "e o gafă", fo: "e forțată",
};
export const titluClasa = (cl, san) => `${s(san)} <span class="k-${cl}">${TITLU[cl] || ""}</span>`;

/**
 * Explicația completă pentru mutarea de la indexul i (0 = prima mutare a partidei).
 * ctx: {plies, poz (evaluările motorului pentru fiecare poziție), eu ("w"|"b"), deschidere}
 * Întoarce {para: [html], sfat: html|null, curs: {…}|null}
 */
export function explica(i, ctx) {
  const pl = ctx.plies, p = pl[i], eMea = p.cul === ctx.eu;
  const pz = ctx.poz[i] || {}, pzD = ctx.poz[i + 1] || {};
  let prev = null;
  if (i > 0) { const mm = A.incearca(new Chess(pl[i - 1].fenB), pl[i - 1].u); if (mm) prev = { to: mm.to, captured: mm.flags.includes("e") ? "p" : mm.captured }; }
  const mutateDeja = new Set(pl.slice(0, i).filter(q => q.cul === p.cul).map(q => q.to));
  const o = { ply: i + 1, faza: p.faza, prev, mutateDeja };
  const fapte = scop(p.fenB, p.u, o);
  const para = [];
  let tipSfat = null, curs = null;
  const pers = eMea ? "tu" : "el";
  const ceFace = fraza(fapte, pers);
  const ceFaceTxt = ceFace ? (eMea ? cap(ceFace) : "Adversarul " + ceFace) + "." : "";
  const ctxM = { faza: p.faza, ply: i + 1, evB: pz.ev };

  // cursurile tale de deschideri
  if (IDX && p.faza === "deschidere") {
    const c = dinCurs(p.fenB, ctx.eu, p.u);
    if (c && c.k) {
      if (c.u === p.u) {
        curs = { ...c, potrivit: true };
        if (c.com) para.push(`<span class="slab">Din cursul tău „${esc(c.c.nume)}”:</span> ${esc(c.com)}`);
      } else if (eMea && c.j >= 2) {
        curs = { ...c, potrivit: false };
        para.push(`<span class="risc">Ai ieșit din cursul „${esc(c.c.nume)}”.</span> Acolo se joacă ${s(c.san)}${c.com ? `: ${esc(c.com)}` : "."}`);
      }
    }
  }

  switch (p.cl) {
    case "bk": {
      if (!para.length) para.push(`${ceFaceTxt} Mutarea face parte din teoria ${p.desch || ctx.deschidere ? `deschiderii <b>${esc(numeRo(p.desch || ctx.deschidere))}</b>` : "deschiderilor"}.`);
      break;
    }
    case "fo": para.push(`Era singura mutare legală.`); break;
    case "br": case "gr": {
      if (ceFaceTxt) para.push(ceFaceTxt);
      const r = pz.pv && pz.pv.length ? rezultatLinie(p.fenB, pz.pv, p.cul) : null;
      if (p.cl === "br") {
        const per = pericol(p.fen, p.cul, A.opus(p.cul))[0];
        const ce2 = per ? `${eMea ? "Lași" : "Adversarul lasă"} ${pe(per[1].type, per[0])} în priză` : `${eMea ? "Sacrifici" : "Adversarul sacrifică"} material`;
        const castig = r && r.d > 0 ? textMaterial(r, pers) : null;
        para.push(`${ce2}, dar calculul arată că e corect${castig ? `: la capătul liniei ${castig} (${liniaTxt(r.linie, 6)})` : ` — evaluarea rămâne ${evTxt(pzD.ev)}`}.`);
      }
      else {
        const d2 = p.w2 != null && p.wbx != null ? Math.round(p.wbx - p.w2) : null;
        const s2 = p.bu2 ? A.sanDin(p.fenB, p.bu2) : null;
        para.push(`Era singura mutare bună${d2 != null && d2 >= 8 && s2 ? `: orice altceva pierdea mult (a doua variantă, ${s(s2)}, scădea șansele cu ${d2}%)` : ""}.`);
      }
      if (p.pd) para.push(eMea ? "Ai pedepsit imediat greșeala adversarului." : "Adversarul ți-a pedepsit greșeala.");
      break;
    }
    case "be": case "ex": case "go": {
      if (ceFaceTxt) para.push(ceFaceTxt);
      if (p.pd) {
        const r = pz.pv && pz.pv.length ? rezultatLinie(p.fenB, pz.pv, p.cul) : null;
        const tm = r && r.d >= 1 ? textMaterial(r, pers) : null;
        para.push(eMea ? `<span class="bun">Ai pedepsit greșeala adversarului${tm ? ` și ${tm}` : ""}.</span>` : `<span class="risc">Adversarul ți-a pedepsit greșeala${tm ? ` și ${tm}` : ""}.</span>`);
      }
      if (p.cl !== "be" && p.b && p.bu !== p.u && p.loss >= 1.5) para.push(`${eMea ? "Puțin mai precis era" : "Mai precis era"} ${maiBun(p, pz, ctxM)}`);
      break;
    }
    case "in": case "mi": case "bl": {
      if (ceFaceTxt) para.push(ceFaceTxt);
      const c = consecinta(p, pzD, eMea, ctxM);
      if (c) para.push(c);
      else if (p.cl !== "in") para.push(eMea ? `Mutarea îți strică poziția: evaluarea trece de la ${evTxt(pz.ev)} la ${evTxt(pzD.ev)}.` : `Mutarea îi strică poziția: evaluarea trece de la ${evTxt(pz.ev)} la ${evTxt(pzD.ev)}.`);
      if (p.b && p.bu !== p.u) para.push(`Mai bine era ${maiBun(p, pz, ctxM)}`);
      tipSfat = p.tip || (negative(fapte)[0] || {}).sfat || (p.cl === "in" ? null : "tactica_permisa");
      if (p.cl === "in" && negative(fapte).length) tipSfat = negative(fapte)[0].sfat;
      break;
    }
    case "ms": {
      if (ceFaceTxt) para.push(ceFaceTxt);
      const mb = maiBun(p, pz, ctxM);
      para.push(`${eMea ? "Dar ai ratat" : "Dar adversarul a ratat"} ${mb}`);
      if (p.det && !/câștig|mat/.test(mb)) para.push(`<span class="slab">${figText(cap(p.det))}.</span>`);
      tipSfat = p.tip || "material_ratat";
      break;
    }
  }
  if (eMea && p.ctx && p.ctx.length && ["mi", "bl", "ms"].includes(p.cl)) {
    const CTX = { criza_timp: "Aveai sub un minut pe ceas.", graba: `Ai mutat în ${String(p.t).replace(".", ",")} secunde.`, gandit_mult: `Te-ai gândit ${Math.round(p.t)} de secunde.`, ocazie_nepedepsita: "Adversarul greșise chiar înainte." };
    const t = p.ctx.map(k => CTX[k]).filter(Boolean).join(" ");
    if (t) para.push(`<span class="slab">${t}</span>`);
    if (!tipSfat || p.ctx.includes("criza_timp")) tipSfat = p.ctx.find(k => SFAT[k]) || tipSfat;
  }
  return { para, sfat: eMea && tipSfat ? sfat(tipSfat, p.fenB) : null, curs, fapte };
}
function evTxt(ev) {
  if (!ev) return "?";
  const t = A.evText(ev);
  return `<b>${t.replace(".", ",").replace(/^-/, "−")}</b>`;
}
// „♘f3, care dezvoltă calul și câștigă un pion după …”
function maiBun(p, pz, o = {}) {
  const fapte = scop(p.fenB, p.bu, o);
  const ce = fraza(fapte, "el");
  let out = `${s(p.b)}${ce ? `, care ${ce}` : ""}`;
  if (pz.ev && pz.ev.mat != null && pz.ev.mat !== 0 && ((p.cul === "w") === (pz.ev.mat > 0))) {
    const n = Math.abs(pz.ev.mat);
    return `${s(p.b)}: dădea mat în ${n} (${liniaTxt(A.linie(p.fenB, pz.pv, 2 * n - 1).map(x => x.s), 2 * n - 1)}).`;
  }
  const r = pz.pv && pz.pv.length ? rezultatLinie(p.fenB, pz.pv, p.cul) : null;
  if (r && r.d >= 1 && !fapte.some(f => f.k === "castiga" && f.val >= r.d)) {
    const tm = textMaterial(r, "el");
    if (tm) out += `${ce ? " și" : ","} ${tm} (${liniaTxt(r.linie, 6)})`;
  }
  return out + ".";
}
// ce se întâmplă după o mutare proastă: răspunsul celuilalt și ce se pierde (socotit de dinaintea mutării)
function consecinta(p, pzD, eMea, o = {}) {
  const pv = pzD.pv || [];
  if (!pv.length) return null;
  const ev = pzD.ev;
  if (ev && ev.mat != null && ev.mat !== 0 && ((p.cul === "w") === (ev.mat < 0))) {
    const n = Math.abs(ev.mat), lin = A.linie(p.fen, pv, 2 * n - 1).map(x => x.s);
    return eMea ? `<span class="risc">Permiți mat în ${n}:</span> ${liniaTxt(lin, 2 * n - 1)}.` : `<span class="bun">Acum ai mat în ${n}:</span> ${liniaTxt(lin, 2 * n - 1)}!`;
  }
  const r1 = A.sanDin(p.fen, pv[0]);
  const mm = A.incearca(new Chess(p.fenB), p.u);
  const f1 = scop(p.fen, pv[0], { ...o, prev: mm ? { to: mm.to, captured: mm.flags.includes("e") ? "p" : mm.captured } : null });
  const ce = fraza(f1, eMea ? "el" : "tu");
  const r = rezultatLinie(p.fenB, [p.u, ...pv], eMea ? p.cul : A.opus(p.cul));
  const negs = negative(scop(p.fenB, p.u, o)).filter(f => f.k === "lasa" || f.k === "inpriza");
  const intro = negs.length ? `${eMea ? cap(negs[0].tu) : "Adversarul " + negs[0].el}. ` : "";
  const castigaDeja = f1.some(f => f.k === "castiga" && f.val >= Math.abs(r.d));
  const slab = !f1.length || f1[0].w < 3;
  const mmR = A.incearca(new Chess(p.fen), pv[0]);
  if (eMea) {
    const tm = r.d <= -1 ? textMaterial(r, "tu") : null;
    const lin = tm && r.linie.length > 2 ? ` (${liniaTxt(r.linie.slice(1), 6)})` : "";
    if (negs.length && mmR && mmR.to === negs[0].sq) return `<span class="risc">${cap(negs[0].tu)}</span>: adversarul răspunde ${s(r1)}${tm ? ` și ${tm}${lin}` : ""}.`;
    if (slab && !tm) return `${intro}Nu pierzi material imediat, dar evaluarea scade de la ${evTxt(o.evB)} la ${evTxt(pzD.ev)}: adversarul continuă cu ${s(r1)} și are un joc mai bun.`;
    return `${intro}<span class="risc">Adversarul răspunde ${s(r1)}</span>${ce && !slab ? `: ${ce}` : ""}.${tm && !castigaDeja ? ` În final ${tm}${lin}.` : ""}`;
  }
  const tm = r.d >= 1 ? textMaterial(r, "tu") : null;
  if (slab && !tm) return `${intro}Evaluarea trece de la ${evTxt(o.evB)} la ${evTxt(pzD.ev)}: acum ${s(r1)} îți dă un joc mai bun.`;
  return `${intro}<span class="bun">Acum poți juca ${s(r1)}</span>${ce && !slab ? `: ${ce}` : ""}${tm && !castigaDeja ? ` și ${tm}` : ""}.`;
}

/** Explicația pentru o mutare încercată de tine (explorare sau „Încearcă din nou”), cu evaluările live. */
export function explicaIncercare({ fenB, u, cul, evB, evA, pvB, pvA, faza = "mijloc", cl }) {
  const para = [];
  const fapte = scop(fenB, u, { faza });
  const ce = fraza(fapte, "tu");
  if (ce) para.push(cap(ce) + ".");
  if (["in", "mi", "bl"].includes(cl)) {
    const fen = (() => { const ch = new Chess(fenB); A.incearca(ch, u); return ch.fen(); })();
    const c = consecinta({ fenB, fen, u, cul, faza }, { pv: pvA || [], ev: evA }, true, { faza });
    if (c) para.push(c);
    const neg = negative(fapte)[0];
    if (!c && neg) para.push(cap(neg.tu) + ".");
  }
  if (pvB && pvB.length && pvB[0].slice(0, 4) !== u.slice(0, 4) && cl && cl !== "be") {
    const b = A.sanDin(fenB, pvB[0]);
    if (b) para.push(`Cea mai bună era ${maiBun({ fenB, bu: pvB[0], b, cul, faza }, { pv: pvB, ev: evB }, { faza })}`);
  }
  return para;
}

// ───────── RAPORTUL PARTIDEI ─────────
const NUME_TIP = {
  mat_permis: ["Ai permis mat", "de mat permis"], pat: ["Ai făcut pat", "pat"], piesa_in_priza: ["Ai mutat piese în priză", "piese mutate în priză"],
  piesa_neaparata: ["Ai lăsat piese neapărate", "piese lăsate neapărate"], furculita: ["Ai permis furculițe", "furculițe permise"],
  tactica_permisa: ["Ai permis combinații", "combinații permise"], pion_pierdut: ["Ai pierdut pioni", "pioni pierduți"],
  atac_rege: ["Regele tău a rămas expus", "rege expus"], mat_ratat: ["Ai ratat matul", "maturi ratate"],
  material_ratat: ["Ai ratat câștiguri de material", "câștiguri ratate"], tehnica_final: ["Greșeli în final", "greșeli în final"], pozitional: ["Greșeli de plan", "greșeli de plan"],
};
// temele de exerciții potrivite pentru fiecare tip de greșeală (aceleași ca la Dezlegări)
export const TEME_TIP = {
  mat_permis: ["mateIn1", "mateIn2", "backRankMate"], pat: ["endgame"], piesa_in_priza: ["hangingPiece"], piesa_neaparata: ["hangingPiece"],
  furculita: ["fork"], tactica_permisa: ["fork", "pin", "skewer", "discoveredAttack"], pion_pierdut: ["hangingPiece"], atac_rege: ["mateIn2", "kingsideAttack"],
  mat_ratat: ["mateIn1", "mateIn2", "mateIn3"], material_ratat: ["hangingPiece", "fork", "pin"], tehnica_final: ["endgame", "pawnEndgame", "rookEndgame"], pozitional: ["advantage", "middlegame"],
};
const nrM = i => (i % 2 === 0 ? `${i / 2 + 1}.` : `${(i + 1) / 2}…`);

/** rez = clasificaPartida(...); ctx: {eu, poz, rezultat: ["castig"|..., lit, text, motiv], adv (numele), deschidere} */
export function raport(rez, ctx) {
  const pl = rez.plies, eu = ctx.eu;
  const meu = A.cuRatinguri(eu === "w" ? rez.alb : rez.negru), al = A.cuRatinguri(eu === "w" ? rez.negru : rez.alb);
  const mele = pl.map((q, i) => ({ q, i })).filter(x => x.q.cul === eu);
  const erori = mele.filter(x => ["mi", "bl", "ms"].includes(x.q.cl));
  const [cls, , rezT, motiv] = ctx.rezultat;
  // momentul decisiv: cea mai mare scădere de șanse care a schimbat câștigătorul probabil
  let decisiv = null;
  pl.forEach((q, i) => {
    if (q.cl === "bk" || q.loss < 12) return;
    const schimba = q.wb >= 40 && q.wa < 40;
    const scor = q.loss + (schimba ? 30 : 0);
    if (!decisiv || scor > decisiv.scor) decisiv = { q, i, scor };
  });
  const lectii = [];
  // 1) tipul de greșeală care se repetă
  const peTip = {};
  erori.forEach(x => { const t = x.q.tip || "pozitional"; (peTip[t] = peTip[t] || []).push(x); });
  const tipuri = Object.entries(peTip).sort((a, b) => b[1].length - a[1].length || b[1][0].q.loss - a[1][0].q.loss);
  for (const [t, xs] of tipuri.slice(0, 2)) {
    lectii.push({ cheie: "tip-" + t, icon: xs.some(x => x.q.cl === "bl") ? "bl" : "mi",
      titlu: `${NUME_TIP[t] ? NUME_TIP[t][0] : "Greșeli"}${xs.length > 1 ? ` (de ${xs.length} ori)` : ""}`,
      text: `${xs.slice(0, 3).map(x => `<button class="lnk" data-i="${x.i + 1}">${nrM(x.i)} ${fig(x.q.s)}</button>`).join(", ")}. ${sfat(t === "piesa_in_priza" || t === "piesa_neaparata" ? "verifica" : t, rez.plies.length + t) || ""}`,
      teme: TEME_TIP[t] || null, ply: xs[0].i + 1 });
  }
  // 2) deschiderea
  const ultimaTeorie = pl.reduce((k, q, i) => (q.cl === "bk" ? i : k), -1);
  const primaMea = mele.find(x => x.i > ultimaTeorie);
  const dinDeschidere = mele.filter(x => x.q.faza === "deschidere" && x.q.cl !== "bk");
  const pierdutDeschidere = dinDeschidere.reduce((s, x) => s + x.q.loss, 0);
  let deviere = null;
  if (IDX) for (const x of mele) {
    if (x.q.faza !== "deschidere") break;
    const c = dinCurs(x.q.fenB, eu, x.q.u);
    if (c && c.u !== x.q.u && c.j >= 2) { deviere = { ...c, i: x.i, s: x.q.s }; break; }
  }
  if (deviere) {
    lectii.push({ cheie: "curs", icon: "bk", titlu: `Deschiderea: ai ieșit din cursul „${esc(deviere.c.nume)}”`,
      text: `La <button class="lnk" data-i="${deviere.i + 1}">${nrM(deviere.i)} ${fig(deviere.s)}</button> cursul joacă ${s(deviere.san)}. Repetă capitolul „${esc(deviere.k.nume)}”.`,
      curs: `${deviere.c.id}/${deviere.k.id}` });
  } else if (primaMea && pierdutDeschidere >= 12) {
    lectii.push({ cheie: "desch", icon: "in", titlu: "Deschiderea a costat",
      text: `După teorie (din ${nrM(primaMea.i)} ${fig(primaMea.q.s)}) ai pierdut ≈${Math.round(pierdutDeschidere)}% din șanse în primele mutări. Un curs de deschidere te ajută să ajungi la mijlocul jocului cu o poziție bună.`,
      cursuri: eu });
  }
  // 3) faza cea mai slabă
  const fz = [["opening", "Deschiderea"], ["strategy", "Mijlocul jocului"], ["endgame", "Finalul"]].map(([k, n]) => [k, n, meu.avansat[k]]).filter(x => x[2] && x[2].n >= 4);
  if (fz.length >= 2) {
    const slab = [...fz].sort((a, b) => a[2].acc - b[2].acc)[0];
    if (slab[2].acc < (meu.acc || 0) - 6) lectii.push({ cheie: "faza", icon: "in", titlu: `${slab[1]} a fost partea cea mai slabă`,
      text: `Precizie ${String(slab[2].acc).replace(".", ",")}% față de ${String(meu.acc).replace(".", ",")}% în toată partida.`, faza: { opening: "deschidere", strategy: "mijloc", endgame: "final" }[slab[0]] });
  }
  // 4) ceasul
  const timp = erori.filter(x => x.q.ctx && (x.q.ctx.includes("criza_timp") || x.q.ctx.includes("graba")));
  if (timp.length >= 2) lectii.push({ cheie: "timp", icon: "mi", titlu: "Ceasul ți-a dat bătăi de cap", text: `${timp.length} din greșeli au venit în grabă sau sub presiunea timpului. ${SFAT.graba[0]}` });
  // 5) ce a mers bine
  const frumoasa = mele.find(x => x.q.cl === "br") || mele.find(x => x.q.cl === "gr") || mele.filter(x => x.q.pd).sort((a, b) => b.q.wa - a.q.wa)[0];
  if (frumoasa) lectii.push({ cheie: "bine", icon: frumoasa.q.cl === "br" || frumoasa.q.cl === "gr" ? frumoasa.q.cl : "be", titlu: "Ce ai făcut bine",
    text: `<button class="lnk" data-i="${frumoasa.i + 1}">${nrM(frumoasa.i)} ${fig(frumoasa.q.s)}</button> — ${frumoasa.q.cl === "br" ? "un sacrificiu corect" : frumoasa.q.cl === "gr" ? "singura mutare bună din poziție" : "ai pedepsit greșeala adversarului"}.` });

  // rezumatul de sus (bula mentorului)
  const acc = v => (v == null ? "—" : String(v).replace(".", ","));
  const PRIN = { mat: "prin mat", abandon: "prin abandon", "timp expirat": "pe timp", "partidă părăsită": "prin abandon", "timp, material insuficient": "pe timp" };
  const prin = PRIN[motiv] || "";
  let t = cls === "castig" ? `${alege(["Bravo", "Felicitări", "Foarte bine"], rez.plies.length)}, ai câștigat${prin ? " " + prin : ""}!`
    : cls === "pierdere" ? `Ai pierdut${prin ? " " + prin : ""}. Hai să vedem ce s-a întâmplat și ce înveți din partida asta.`
    : `Remiză${motiv ? ` (${motiv})` : ""}.`;
  t += ` Ai jucat cu o precizie de <b>${acc(meu.acc)}%</b>${meu.gRating ? ` (evaluarea jocului: <b>${meu.gRating}</b>)` : ""}; adversarul ${acc(al.acc)}%.`;
  if (decisiv) {
    const q = decisiv.q, alMeu = q.cul === eu;
    t += ` Momentul decisiv: <button class="lnk" data-i="${decisiv.i + 1}">${nrM(decisiv.i)} ${fig(q.s)}</button>${alMeu ? ", greșeala ta" : ", greșeala adversarului"}${q.tipRo ? ` (${q.tipRo.toLowerCase()})` : ""}.`;
  }
  if (!erori.length) t += " Nu ai făcut nicio greșeală mare.";
  return { rezumat: t, lectii, decisiv, erori: erori.length };
}
