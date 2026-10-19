// stare.js — starea comună a aplicației și analiza unei partide.
import * as A from "./analiza.js?v=31";
import { GrupMotoare, MotorLive } from "./motor.js?v=31";
import { db, salveazaSetari } from "./date.js?v=31";
import { MOTIV } from "./util.js?v=31";

export const S = { set: null, partide: [], teorie: null, filtru: "toate", lot: null, motoare: null, live: null, ruleaza: Promise.resolve() };

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
export function rezultat(p) {
  const eu = culoareaMea(p), j = eu === "w" ? p.alb : p.negru, a = eu === "w" ? p.negru : p.alb;
  if (j.rez === "win") return ["castig", "V", "câștigată", MOTIV[a.rez] ?? a.rez];
  if (a.rez === "win") return ["pierdere", "Î", "pierdută", MOTIV[j.rez] ?? j.rez];
  return ["remiza", "R", "remiză", MOTIV[j.rez] ?? j.rez];
}
export const numeDeschidere = p => (p.sumar && p.sumar.deschidere) || A.numeDinEcoUrl(p.eco);
export const familie = n => (n || "").split(/\s\d/)[0].trim();

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
  const eu = culoareaMea(p), out = [];
  rez.plies.forEach((q, i) => {
    if (q.cul !== eu || !["mi", "ms", "bl", "in"].includes(q.cl) || !q.bu || q.bu === q.u) return;
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

// baza de exerciții generate din partidele reale
let _ex = null;
export async function incarcaExercitii() {
  if (_ex) return _ex;
  try {
    const d = await (await fetch("exercitii.json?v=31")).json();
    _ex = d.map(x => ({ id: "p-" + x[0], sursa: "partide", fen: x[1], ult: x[2], sol: x[3].split(" "), r: x[4], teme: x[5].split(" "), info: { url: x[6] } }));
  } catch (e) { _ex = []; }
  return _ex;
}
export function statEx() {
  if (!S.set.ex) S.set.ex = { rating: 1200, n: 0, ok: 0, teme: {}, vazute: [], zile: {} };
  return S.set.ex;
}
export async function inregistreazaEx(ex, ok) {
  const st = statEx();
  const rp = ex.r || st.rating;
  const K = st.n < 30 ? 32 : 20;
  const astept = 1 / (1 + Math.pow(10, (rp - st.rating) / 400));
  const vechi = st.rating;
  st.rating = Math.round(st.rating + K * ((ok ? 1 : 0) - astept));
  st.n++; if (ok) st.ok++;
  for (const t of ex.teme || []) { const x = st.teme[t] || (st.teme[t] = { n: 0, ok: 0 }); x.n++; if (ok) x.ok++; }
  st.vazute = [...st.vazute.filter(i => i !== ex.id), ex.id].slice(-600);
  const zi = new Date().toISOString().slice(0, 10);
  st.zile[zi] = (st.zile[zi] || 0) + 1;
  await salveazaSetari(S.set);
  return st.rating - vechi;
}
export function inSerie(f) { const r = S.ruleaza.then(f, f); S.ruleaza = r.catch(() => {}); return r; }
