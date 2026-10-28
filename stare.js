// stare.js — starea comună a aplicației, analiza unei partide, baza de exerciții și progresul tău.
import * as A from "./analiza.js?v=40";
import { GrupMotoare, MotorLive } from "./motor.js?v=40";
import { db, salveazaSetari } from "./date.js?v=40";
import { MOTIV, ziKey } from "./util.js?v=40";

export const S = { set: null, partide: [], teorie: null, filtru: "toate", lot: null, motoare: null, live: null, ruleaza: Promise.resolve(), inapoi: "" };

export function motoare() {
  if (!S.motoare) S.motoare = new GrupMotoare(S.set.motoare || 0);
  return S.motoare;
}
export function motorLive() {
  if (!S.live) S.live = new MotorLive();
  return S.live;
}
export function culoareaMea(p) {
  const u = (S.set.user || "").toLowerCase();
  if (p.negru.user && p.negru.user.toLowerCase() === u) return "b";
  return "w";
}
export const eu = p => (culoareaMea(p) === "w" ? p.alb : p.negru);
export const adversar = p => (culoareaMea(p) === "w" ? p.negru : p.alb);
export function rezultat(p) {
  const c = culoareaMea(p), j = c === "w" ? p.alb : p.negru, a = c === "w" ? p.negru : p.alb;
  if (j.rez === "win") return ["castig", "V", "câștigată", MOTIV[a.rez] ?? a.rez];
  if (a.rez === "win") return ["pierdere", "Î", "pierdută", MOTIV[j.rez] ?? j.rez];
  return ["remiza", "R", "remiză", MOTIV[j.rez] ?? j.rez];
}
export const numeDeschidere = p => (p.sumar && p.sumar.deschidere) || (p.dl && p.dl.n) || A.numeDinEcoUrl(p.eco);
export const familie = n => (n || "").split(/[:\s]\s*\d|:/)[0].trim();
export const partideSortate = () => [...S.partide].sort((a, b) => b.ts - a.ts);
export const mele = p => (p.sumar ? A.cuRatinguri(culoareaMea(p) === "w" ? p.sumar.alb : p.sumar.negru) : null);

// ratingul estimat se recalibrează pe ratingurile reale ale jucătorilor din partidele analizate
export async function recalibreaza() {
  const es = [];
  for (const p of S.partide) {
    if (!p.sumar) continue;
    for (const [st, r] of [[p.sumar.alb, p.alb.rating], [p.sumar.negru, p.negru.rating]]) {
      if (!r || !st) continue;
      es.push(["joc", st.acc, r]);
      for (const [k, v] of Object.entries(st.avansat)) if (v) es.push([k, v.acc, r]);
    }
  }
  const d = A.calibreaza(es);
  A.setDeplasari(d);
  S.set.deplasari = d;
  await salveazaSetari(S.set);
}

export async function analizeaza(p, progres, semnal) {
  const info = A.citestePgn(p.pgn);
  const adancime = S.set.adancime || 14;
  const pozitii = await motoare().analizeazaPozitii(info.fens, adancime, progres, semnal);
  await db.pune("analize", { id: p.id, adancime, pozitii, data: Date.now(), v: 1 });
  const rez = A.clasificaPartida(info, pozitii, S.teorie, p.eco);
  p.sumar = { adancime, alb: rez.alb, negru: rez.negru, deschidere: rez.deschidere, ts: Date.now() };
  p.greseli = greseliDin(p, rez, info);
  await db.pune("partide", p);
  await recalibreaza();
  return { info, rez, pozitii, adancime };
}

// greșelile tale dintr-o partidă, păstrate ca exerciții („găsește mutarea bună”)
export function greseliDin(p, rez, info) {
  const c = culoareaMea(p), out = [];
  rez.plies.forEach((q, i) => {
    if (q.cul !== c || !["mi", "ms", "bl", "in"].includes(q.cl) || !q.bu || q.bu === q.u) return;
    const alt = q.bu2 && q.wbx - q.w2 <= 2 ? [q.bu2] : [];
    out.push({ ply: i + 1, fenB: q.fenB, fenPrev: i > 0 ? info.fens[i - 1] : null, ult: i > 0 ? rez.plies[i - 1].u : null,
      bu: q.bu, alt, cl: q.cl, tip: q.tip || null, faza: q.faza, s: q.s, b: q.b, loss: q.loss });
  });
  return out.sort((a, b) => b.loss - a.loss);
}
// pentru partidele analizate înainte de versiunea cu antrenor
export async function asiguraGreseli(p) {
  if (p.greseli || !p.sumar) return p.greseli || [];
  const a = await db.ia("analize", p.id);
  if (!a || !a.pozitii) return [];
  const info = A.citestePgn(p.pgn);
  if (a.pozitii.length !== info.fens.length) return [];
  const rez = A.clasificaPartida(info, a.pozitii, S.teorie, p.eco);
  p.greseli = greseliDin(p, rez, info);
  await db.pune("partide", p);
  return p.greseli;
}

// evaluare completă a unei poziții cu motorul live (pentru antrenamente)
export function evalMotor(fen, adancime) {
  return new Promise(res => motorLive().analizeaza(fen, adancime, r => { if (r.final && r.fen === fen) res(r); }));
}

// ───────── baza de exerciții generate din partidele reale ─────────
let _ex = null;
export async function incarcaExercitii() {
  if (_ex) return _ex;
  try {
    const d = await (await fetch("exercitii.json?v=40")).json();
    _ex = d.map(x => ({ id: "p-" + x[0], sursa: "partide", fen: x[1], ult: x[2], sol: x[3].split(" "), r: x[4], teme: x[5].split(" "),
      info: { url: x[6] || (/^\d+-\d+$/.test(x[0]) ? "https://www.chess.com/game/live/" + x[0].split("-")[0] : "") } }));
  } catch (e) { _ex = []; }
  return _ex;
}
export function statEx() {
  const st = S.set.ex || (S.set.ex = {});
  st.rating ??= 1200; st.n ??= 0; st.ok ??= 0; st.teme ??= {}; st.vazute ??= []; st.zile ??= {}; st.gresite ??= {};
  st.rush ??= { best: 0, n: 0 }; st.zilnic ??= {};
  return st;
}
let _vazute = null;
export function vazute() {
  const st = statEx();
  if (!_vazute || _vazute.n !== st.vazute.length) { _vazute = new Set(st.vazute); _vazute.n = st.vazute.length; }
  return _vazute;
}
// repetiție spațiată pentru exercițiile greșite: revin după 1, 3 și 7 zile, până le rezolvi din prima
const INTERVALE_EX = [1, 3, 7, 14];
export async function inregistreazaEx(ex, ok, { faraRating = false } = {}) {
  const st = statEx();
  const vechi = st.rating;
  if (!faraRating) {
    const rp = ex.r || st.rating;
    const K = st.n < 30 ? 32 : 20;
    const astept = 1 / (1 + Math.pow(10, (rp - st.rating) / 400));
    st.rating = Math.round(st.rating + K * ((ok ? 1 : 0) - astept));
    st.n++; if (ok) st.ok++;
    for (const t of ex.teme || []) { const x = st.teme[t] || (st.teme[t] = { n: 0, ok: 0 }); x.n++; if (ok) x.ok++; }
  }
  if (!st.vazute.includes(ex.id)) st.vazute.push(ex.id);
  const g = st.gresite[ex.id];
  if (!ok) st.gresite[ex.id] = { n: (g ? g.n : 0) + 1, pas: 0, urm: Date.now() + 864e5 * INTERVALE_EX[0], r: ex.r };
  else if (g) {
    g.pas++;
    if (g.pas >= INTERVALE_EX.length) delete st.gresite[ex.id];
    else g.urm = Date.now() + 864e5 * INTERVALE_EX[g.pas];
  }
  const zi = ziKey();
  st.zile[zi] = (st.zile[zi] || 0) + 1;
  activitate(false);
  await salveazaSetari(S.set);
  return st.rating - vechi;
}
export const exercitiiDeRecapitulat = () => Object.entries(statEx().gresite).filter(([, g]) => g.urm <= Date.now()).map(([id]) => id);

// ───────── activitate și seria de zile ─────────
export function activitate(salveaza = true) {
  const a = S.set.activ || (S.set.activ = {});
  const z = ziKey(); a[z] = (a[z] || 0) + 1;
  if (salveaza) salveazaSetari(S.set);
}
// o zi contează dacă ai jucat o partidă sau te-ai antrenat în aplicație
export function zileActive() {
  const z = new Set(Object.keys(S.set.activ || {}));
  for (const p of S.partide) z.add(ziKey(new Date(p.ts * 1000)));
  return z;
}
export function serie() {
  const z = zileActive(), d = new Date();
  let n = 0;
  if (!z.has(ziKey(d))) d.setDate(d.getDate() - 1);
  while (z.has(ziKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ───────── cursurile de deschideri ─────────
let _c = null;
export async function incarcaCursuri() {
  if (_c) return _c;
  try { _c = await (await fetch("cursuri.json?v=40")).json(); }
  catch (e) { _c = { cursuri: [], harta: {} }; }
  _c.dupaId = Object.fromEntries(_c.cursuri.map(c => [c.id, c]));
  return _c;
}
export const cursuriIncarcate = () => _c;

export function inSerie(f) { const r = S.ruleaza.then(f, f); S.ruleaza = r.catch(() => {}); return r; }
