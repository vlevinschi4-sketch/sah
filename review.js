// review.js — Analiza partidei, după modelul Game Review de pe Chess.com: raportul partidei cu mentorul,
// apoi analiza mutare cu mutare (clasificare, explicație, cea mai bună mutare, urmarea, „Încearcă din nou”),
// „Învață din greșeli” (reiei pe rând pozițiile în care ai greșit) și explorare liberă cu Stockfish live.
import { Chess } from "./chess.js?v=40";
import * as A from "./analiza.js?v=40";
import * as M from "./mentor.js?v=40";
import { S, culoareaMea, rezultat, motorLive, analizeaza, inSerie, incarcaCursuri, activitate, numeDeschidere, greseliDin } from "./stare.js?v=40";
import { db, salveazaSetari } from "./date.js?v=40";
import { tablaSVG, iconSVG, baraEval, sageata, patratLa, CULORI, idPiesa, ultima } from "./tabla.js?v=40";
import { cadruJoc, bula, barJucator, stareNav } from "./cadru.js?v=40";
import { sunetMutare, sunetGresit, sunetCorect, deblocheaza } from "./sunete.js?v=40";
import { $, $$, esc, af, fig, figText, nrMut, evFmt, reducedMotion, dataRo, toast, tip, timp, evScurt, ico, iu, numeRo } from "./util.js?v=40";
import { sesiuneDinPartida, sesiunePeTeme } from "./dezlegari.js?v=40";

const ERR = ["in", "mi", "ms", "bl"], CHEIE = ["br", "gr", "mi", "ms", "bl"];
const FAZE = [["opening", "Deschidere", "deschidere"], ["strategy", "Mijlocul jocului", "mijloc"], ["endgame", "Final", "final"]];
let R = null;

// ───────── deschidere și închidere ─────────
export async function deschide(el, id) {
  const p = S.partide.find(x => x.id === id);
  if (!p) { location.hash = "partide"; return; }
  const info = A.citestePgn(p.pgn), eu = culoareaMea(p);
  const adv = eu === "w" ? p.negru : p.alb;
  R = { p, info, eu, rez: null, poz: null, idx: 0, flip: eu === "b", mod: "rezumat", exp: null, retry: null, sel: null, drag: null,
    live: new Map(), fenIdx: new Map(info.fens.map((f, i) => [f, i])), auto: null, arataAm: false, ultimVorbit: "", cache: new Map(), invata: null };
  el.innerHTML = cadruJoc({
    titlu: "Analiza partidei", sub: `vs ${esc(adv.user)} · ${dataRo(p.ts)} · ${esc(timp(p))}`, icon: `<span class="titlu-ic">${iconSVG("be", 26)}</span>`,
    inapoi: "#" + (S.inapoi || ""), bara: true, jucatori: true, nav: ["first", "prev", "auto", "next", "last"],
    extra: `<button class="btn ghost icon" id="b-flip" aria-label="Întoarce tabla">${ico("flip", 20)}</button>
      <button class="btn ghost icon" id="b-voce" aria-label="Mentorul citește cu voce" aria-pressed="${!!S.set.voce}">${ico(S.set.voce ? "sunet" : "mut", 20)}</button>`,
  }) + `<div id="fantoma" class="fantoma" hidden></div>`;
  $("#b-flip").onclick = () => { R.flip = !R.flip; deseneazaTabla(); };
  $("#b-voce").onclick = () => {
    S.set.voce = !S.set.voce; salveazaSetari(S.set);
    $("#b-voce").setAttribute("aria-pressed", S.set.voce); $("#b-voce").innerHTML = ico(S.set.voce ? "sunet" : "mut", 20);
    if (!S.set.voce && window.speechSynthesis) speechSynthesis.cancel(); else { R.ultimVorbit = ""; randeazaCoach(); }
  };
  $("#nav").onclick = e => { const b = e.target.closest("[data-n]"); if (b) { deblocheaza(); comanda(b.dataset.n); } };
  legaTabla();
  deseneazaTabla();
  addEventListener("keydown", taste);
  const r = R;
  incarcaCursuri().then(c => M.indexCursuri(c)).catch(() => {});
  const a = await db.ia("analize", p.id);
  if (R !== r) return inchide;
  if (a && a.pozitii && a.pozitii.length === info.fens.length) {
    R.poz = a.pozitii; R.adancime = a.adancime;
    R.rez = A.clasificaPartida(info, a.pozitii, S.teorie, p.eco);
    await gata();
  } else {
    if (S.lot) S.lot.semnal.oprit = true;
    const semnal = { oprit: false }; r.semnal = semnal;
    randeazaAsteptare(0);
    try {
      const rez = await inSerie(() => analizeaza(p, (g, n) => { if (R === r) randeazaAsteptare(Math.round(g / n * 100)); }, semnal));
      if (R !== r) return inchide;
      R.rez = rez.rez; R.poz = rez.pozitii; R.adancime = rez.adancime;
      await gata();
    } catch (e) {
      if (R === r && e.message !== "oprit") $("#pc").innerHTML = `<div class="gol"><p>Analiza nu a mers: ${esc(e.message)}</p></div>`;
    }
  }
  return inchide;
}
async function gata() {
  try { M.indexCursuri(await incarcaCursuri()); } catch (e) {}
  // analiza exista deja (de exemplu adusă dintr-o versiune mai veche): completăm rezumatul partidei
  if (!R.p.sumar) {
    R.p.sumar = { adancime: R.adancime, alb: R.rez.alb, negru: R.rez.negru, deschidere: R.rez.deschidere, ts: Date.now() };
    R.p.greseli = greseliDin(R.p, R.rez, R.info);
    db.pune("partide", R.p).catch(() => {});
  }
  R.raport = M.raport(R.rez, { eu: R.eu, poz: R.poz, rezultat: rezultat(R.p), deschidere: R.rez.deschidere });
  pregatesteChei();
  activitate();
  actualizeaza();
}
export function inchide() {
  if (!R) return;
  if (R.semnal && !R.rez) R.semnal.oprit = true;
  opresteAuto(); if (S.live) S.live.opreste();
  if (window.speechSynthesis) speechSynthesis.cancel();
  removeEventListener("keydown", taste);
  R = null;
}
export function reimprospateaza() { if (R && R.rez) { pregatesteChei(); actualizeaza(); } }

function pregatesteChei() {
  const pl = R.rez.plies, cine = S.set.momente;
  const ok = q => cine === "ambii" || (cine === "eu" ? q.cul === R.eu : q.cul !== R.eu);
  let ultimaTeorie = -1;
  pl.forEach((q, i) => { if (q.cl === "bk") ultimaTeorie = i; });
  R.ultimaTeorie = ultimaTeorie >= 0 ? ultimaTeorie + 1 : 0;
  R.chei = [...new Set([...(R.ultimaTeorie ? [R.ultimaTeorie] : []), ...pl.map((q, i) => (CHEIE.includes(q.cl) && ok(q) ? i + 1 : null)).filter(Boolean)])].sort((a, b) => a - b);
  R.greseli = pl.map((q, i) => (q.cul === R.eu && ["mi", "ms", "bl"].includes(q.cl) && q.bu && q.bu !== q.u ? i + 1 : null)).filter(Boolean);
}
function randeazaAsteptare(pct) {
  const el = $("#pc"); if (!el) return;
  el.innerHTML = `<div class="asteapta"><div class="inel" style="--p:${pct}"><span>${pct}%</span></div>
    <h3>Analizez partida</h3><p class="sub">Stockfish 19 rulează pe dispozitivul tău, la adâncimea ${S.set.adancime}. Durează de obicei sub un minut.</p>
    <button class="btn" id="b-anuleaza">Anulează</button></div>`;
  $("#b-anuleaza").onclick = () => { if (R && R.semnal) R.semnal.oprit = true; location.hash = S.inapoi || ""; };
}

// ───────── poziția afișată ─────────
const N = () => R.rez.plies.length;
const fenMain = i => R.info.fens[i];
function pozCurenta() {
  if (R.retry) return R.retry.fenArata || R.retry.fen;
  if (R.exp) return R.exp.i ? R.exp.moves[R.exp.i - 1].fen : R.exp.startFen;
  return fenMain(R.idx);
}
// evaluarea unei poziții: din analiza live dacă e destul de adâncă, altfel din analiza partidei
function evalPoz(fen) {
  const ch = new Chess(fen);
  if (ch.isCheckmate()) return { ev: { cp: null, mat: 0, castiga_alb: ch.turn() === "b" }, best: null, ad: 99, linii: [] };
  if (ch.isGameOver()) return { ev: { cp: 0, mat: null }, best: null, ad: 99, linii: [] };
  const l = R.live.get(fen), k = R.fenIdx.get(fen);
  const stocat = k != null && R.poz ? { ev: R.poz[k].ev, best: R.poz[k].pv[0] || null, ad: R.adancime, pv: R.poz[k].pv,
    linii: [{ ev: R.poz[k].ev, pv: R.poz[k].pv, ad: R.adancime }, ...(R.poz[k].ev2 ? [{ ev: R.poz[k].ev2, pv: R.poz[k].pv2, ad: R.adancime }] : [])] } : null;
  if (l && l.linii.length && (!stocat || l.adancime >= stocat.ad || l.final)) return { ev: l.linii[0].ev, best: l.linii[0].pv[0], pv: l.linii[0].pv, ad: l.adancime, linii: l.linii, final: l.final };
  if (stocat) return stocat;
  if (l && l.linii.length && l.adancime >= 8) return { ev: l.linii[0].ev, best: l.linii[0].pv[0], pv: l.linii[0].pv, ad: l.adancime, linii: l.linii };
  return null;
}
function liniePv(fen, pv, n = 12) {
  const ch = new Chess(fen), out = [];
  for (const u of (pv || []).slice(0, n)) {
    try { const m = ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); out.push({ u, s: m.san, fenB: m.before, fen: ch.fen() }); }
    catch (e) { break; }
  }
  return out;
}
function feedback(m) {
  const b = evalPoz(m.fenB), a = evalPoz(m.fen);
  if (!b || !a) return null;
  const cul = m.fenB.split(" ")[1];
  const eBest = !!b.best && b.best.slice(0, 4) === m.u.slice(0, 4);
  const wb = A.winPct(b.ev, cul), wa = eBest ? wb : A.winPct(a.ev, cul);
  return { cl: A.clasaSimpla(wb, wa, eBest), bestS: b.best ? A.sanDin(m.fenB, b.best) : null, eBest, ev: a.ev, evB: b.ev, pvB: b.pv, pvA: a.pv, cul };
}
function explicatie(i) {
  if (!R.cache.has(i)) R.cache.set(i, M.explica(i, { plies: R.rez.plies, poz: R.poz, eu: R.eu, deschidere: R.rez.deschidere }));
  return R.cache.get(i);
}

// ───────── actualizare ─────────
function actualizeaza(o = {}) {
  if (!R || !R.rez) return;
  if (R.mod === "rezumat") randeazaRezumat(); else randeazaAnaliza();
  deseneazaTabla();
  if (o.sunet && S.set.sunete) sunetMutare(o.sunet);
  cereLive();
}
function cereLive() {
  if (!R || !R.rez) return;
  const fen = pozCurenta();
  const vrea = R.exp || (R.retry && R.retry.fenArata) || (S.set.liveLinii && R.mod === "mutari");
  if (!vrea) return;
  const l = R.live.get(fen), tinta = S.set.adancimeLive || 18;
  if (l && (l.final || l.adancime >= tinta)) return;
  motorLive().analizeaza(fen, tinta, res => {
    if (!R) return;
    const v = R.live.get(res.fen);
    if (!v || res.adancime >= v.adancime || res.final) R.live.set(res.fen, res);
    extindeVarianta(res);
    incearcaRaspuns(res);
    if (res.fen === pozCurenta()) {
      randeazaLinii(); randeazaBara();
      if (R.exp || R.retry) { randeazaCoach(); if (!R.drag) deseneazaTabla(); }
    }
  });
}
// variantele arătate de mentor se prelungesc cu motorul live, ca să vezi urmarea până la capăt
function extindeVarianta(res) {
  const e = R.exp;
  if (!e || e.kind === "liber" || e.extinsa || !res.linii.length || res.adancime < 12) return;
  const ultim = e.moves.length ? e.moves[e.moves.length - 1].fen : e.startFen;
  if (res.fen !== ultim || e.moves.length >= 10) return;
  const plus = liniePv(ultim, res.linii[0].pv, 10 - e.moves.length);
  if (!plus.length) return;
  e.extinsa = true;
  e.moves.push(...plus);
  randeazaVarianta();
}

// ───────── navigare ─────────
function taste(e) {
  if (!R || !R.rez || /input|textarea/i.test(e.target.tagName)) return;
  const k = { ArrowLeft: "prev", ArrowRight: "next", ArrowUp: "first", ArrowDown: "last", " ": "auto" }[e.key];
  if (k) { e.preventDefault(); comanda(k); }
  if (e.key === "Escape") { if (R.exp) iesiExp(); else if (R.retry) { R.retry = null; actualizeaza(); } }
}
function comanda(n) {
  if (!R || !R.rez) return;
  if (n !== "auto") opresteAuto();
  R.asteaptaRaspuns = null;
  if (n === "auto") { R.auto ? opresteAuto() : pornesteAuto(); return; }
  if (R.retry) { if (n === "prev" || n === "first") { R.retry = null; actualizeaza(); } return; }
  if (R.exp) {
    const e = R.exp, L = e.moves.length;
    if (n === "next" && e.i < L) { e.i++; actualizeaza({ sunet: e.moves[e.i - 1].s }); return; }
    if (n === "prev") { if (e.i > 0) { e.i--; actualizeaza(); } else iesiExp(); return; }
    if (n === "first") { e.i = 0; actualizeaza(); return; }
    if (n === "last") { e.i = L; actualizeaza(); return; }
    if (n === "next") return;
  }
  const tinta = n === "first" ? 0 : n === "last" ? N() : n === "prev" ? R.idx - 1 : R.idx + 1;
  mergiLa(tinta, n === "next");
}
// pe Mac panoul are derulare proprie: la fiecare mutare îl ducem sus, ca explicația mentorului să fie la vedere
function panouSus() { const pc = $("#pc"); if (pc && pc.scrollHeight > pc.clientHeight + 4 && getComputedStyle(pc).overflowY !== "visible") pc.scrollTop = 0; }
function mergiLa(i, cuSunet) {
  const vechi = R.idx;
  panouSus();
  R.idx = Math.max(0, Math.min(N(), i)); R.exp = null; R.retry = null; R.sel = null; R.arataAm = false;
  if (R.mod !== "mutari") { R.mod = "mutari"; scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" }); }
  actualizeaza({ sunet: cuSunet && R.idx === vechi + 1 ? R.rez.plies[R.idx - 1].s : null });
}
function urmatoareaCheie() {
  const k = R.chei.find(i => i > R.idx);
  mergiLa(k != null ? k : N(), false);
}
function iesiExp() { const b = R.exp ? R.exp.baseIdx : R.idx; R.exp = null; R.idx = b; R.asteaptaRaspuns = null; opresteAuto(); actualizeaza(); }
function pornesteExp(baseIdx, startFen, moves, kind, titlu) {
  opresteAuto(); panouSus();
  R.exp = { baseIdx, startFen, moves, i: Math.min(1, moves.length), kind, titlu };
  R.retry = null; R.sel = null;
  actualizeaza({ sunet: R.exp.i ? moves[0].s : null });
}
function pornesteAuto() {
  opresteAuto();
  const b = $("#nav [data-n=auto]"); if (b) b.innerHTML = ico("pause", 26);
  R.auto = setInterval(() => {
    if (!R) return opresteAuto();
    if (R.exp) { if (R.exp.i < R.exp.moves.length) { R.exp.i++; actualizeaza({ sunet: R.exp.moves[R.exp.i - 1].s }); } else opresteAuto(); }
    else if (R.idx < N()) mergiLa(R.idx + 1, true);
    else opresteAuto();
  }, Math.max(350, S.set.pauza || 900));
}
function opresteAuto() {
  if (R && R.auto) { clearInterval(R.auto); R.auto = null; }
  const b = $("#nav [data-n=auto]"); if (b) b.innerHTML = ico("play", 26);
}

// ───────── tabla ─────────
function deseneazaTabla() {
  if (!R) return;
  const fen = pozCurenta();
  let arrows = [], hl = [], badge = null, tinte = [];
  const best = (S.set.sageti || "ambele") !== "nimic", rec = (S.set.sageti || "ambele") === "ambele";
  if (R.rez) {
    if (R.retry) {
      const r = R.retry;
      if (r.hint === 1) hl.push({ sq: r.p.bu.slice(0, 2), c: CULORI.rec, o: .55 });
      if (r.hint >= 2) arrows.push(sageata(r.p.bu, CULORI.be, .75));
      if (r.stare === "gresit" && r.m) { hl = ultima(r.m.u, CULORI.mi, .5); const f = r.fb; if (f && S.set.clasaTabla) badge = { sq: r.m.to, cl: f.cl }; }
      if (r.stare === "corect" && r.m) { hl = ultima(r.m.u, CULORI.be, .5); if (S.set.clasaTabla) badge = { sq: r.m.to, cl: "be" }; }
    } else if (R.exp) {
      const m = R.exp.i ? R.exp.moves[R.exp.i - 1] : null;
      if (m) {
        hl = ultima(m.u);
        const tu = m.auto && R.exp.i >= 2 ? R.exp.moves[R.exp.i - 2] : m;
        const f = R.exp.kind === "liber" ? feedback(tu) : null;
        if (f && S.set.clasaTabla && !(m.auto && tu.u.slice(2, 4) === m.u.slice(2, 4))) badge = { sq: tu.u.slice(2, 4), cl: f.cl };
      }
      const ev = evalPoz(fen);
      if (best && ev && ev.best) arrows.push(sageata(ev.best, CULORI.be, .75));
    } else if (R.idx > 0) {
      const p = R.rez.plies[R.idx - 1], c = CULORI[p.cl] || CULORI.hl;
      hl = ultima(p.u, c, .5);
      if (S.set.clasaTabla && p.cl) badge = { sq: p.to, cl: p.cl };
      if (R.arataAm && p.am) arrows.push(sageata(p.am, CULORI.am, .8));
      else {
        if (best && p.bu && p.bu !== p.u && p.cl !== "bk" && p.cl !== "fo") arrows.push(sageata(p.bu, CULORI.be, .8));
        const urm = R.rez.plies[R.idx];
        if (rec && urm && urm.bu && R.mod === "mutari") arrows.push(sageata(urm.bu, CULORI.rec, .55));
      }
    }
  }
  if (R.sel) tinte = new Chess(fen).moves({ square: R.sel, verbose: true }).map(m => ({ sq: m.to, cap: !!m.captured }));
  $("#tb").innerHTML = tablaSVG(fen, { flip: R.flip, arrows, hl, badge, sel: R.sel, tinte, ascunde: R.drag && R.drag.mutat ? R.drag.from : null });
  randeazaBara();
  deseneazaJucatori(fen);
  const L = R.rez ? (R.exp ? R.exp.moves.length : N()) : 0, i = R.exp ? R.exp.i : R.idx;
  stareNav({ first: !!R.rez && (i > 0 || !!R.exp), prev: !!R.rez && (i > 0 || !!R.exp || !!R.retry), next: !!R.rez && !R.retry && i < L, last: !!R.rez && !R.retry && i < L, auto: !!R.rez && !R.retry });
}
function randeazaBara() {
  if (!R) return;
  const fen = pozCurenta();
  let ev = null;
  if (R.rez) {
    if (!R.exp && !R.retry) { const p = R.idx ? R.rez.plies[R.idx - 1] : null; if (p) { $("#evb").innerHTML = baraEval(p.wAlb, p.v, R.flip); return; } }
    const e = evalPoz(fen); if (e) ev = e.ev;
  }
  if (!ev && R.poz) ev = R.poz[0].ev;
  const w = ev ? A.winPct(ev, "w") : 50;
  $("#evb").innerHTML = baraEval(w, ev ? evScurt(ev) : "0.0", R.flip);
}
function deseneazaJucatori(fen) {
  const p = R.p, plies = R.rez ? R.rez.plies : [];
  const idxCeas = R.exp ? R.exp.baseIdx : R.retry ? R.idx - 1 : R.idx;
  const ceas = cul => { for (let i = Math.min(idxCeas, plies.length) - 1; i >= 0; i--) if (plies[i].cul === cul && plies[i].k != null) return plies[i].k; const t = parseInt(p.timeControl, 10); return isNaN(t) ? null : t; };
  const jos = R.flip ? "b" : "w", sus = jos === "w" ? "b" : "w";
  $("#j-jos").innerHTML = barJucator(fen, jos, jos === "w" ? p.alb : p.negru, ceas(jos));
  $("#j-sus").innerHTML = barJucator(fen, sus, sus === "w" ? p.alb : p.negru, ceas(sus));
}

function legaTabla() {
  const tb = $("#tb"), fant = $("#fantoma");
  tb.addEventListener("pointerdown", e => {
    if (!R || !R.rez || (R.retry && R.retry.stare !== "cauta")) return;
    deblocheaza(); opresteAuto();
    const sq = patratLa(e, tb, R.flip); if (!sq) return;
    let fen = pozCurenta(), ch = new Chess(fen);
    if (R.sel && R.sel !== sq && ch.moves({ square: R.sel, verbose: true }).some(m => m.to === sq)) { const f = R.sel; R.sel = null; executa(f, sq); return; }
    let piesa = ch.get(sq);
    // pe linia partidei, dacă iei o piesă a celui care tocmai a mutat, tabla revine la poziția dinainte:
    // așa poți juca tu, cu mâna, mutarea mai bună (săgeata verde) în locul celei din partidă
    if ((!piesa || piesa.color !== ch.turn()) && !R.exp && !R.retry && R.idx > 0) {
      const q = R.rez.plies[R.idx - 1], chB = new Chess(q.fenB), pB = chB.get(sq);
      if (pB && pB.color === chB.turn() && chB.moves({ square: sq }).length) {
        R.exp = { baseIdx: R.idx - 1, startFen: q.fenB, moves: [], i: 0, kind: "liber", titlu: `În loc de ${fig(q.s)}`, inLoc: true };
        fen = q.fenB; ch = chB; piesa = pB;
        if (R.mod !== "mutari") { R.mod = "mutari"; randeazaAnaliza(); }
        randeazaCoach(); randeazaVarianta(); randeazaLista();
      }
    }
    if (!piesa || piesa.color !== ch.turn()) { R.sel = null; deseneazaTabla(); return; }
    e.preventDefault();
    tb.setPointerCapture(e.pointerId);
    const lat = tb.getBoundingClientRect().width / 8;
    R.sel = sq; R.drag = { from: sq, x0: e.clientX, y0: e.clientY, mutat: false, lat };
    fant.innerHTML = `<svg viewBox="0 0 45 45" width="${lat * 1.1}" height="${lat * 1.1}"><use href="#p-${idPiesa(fen, sq)}" width="45" height="45"/></svg>`;
    deseneazaTabla();
  });
  tb.addEventListener("pointermove", e => {
    if (!R || !R.drag) return;
    const d = R.drag;
    if (!d.mutat && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6) { d.mutat = true; fant.hidden = false; deseneazaTabla(); }
    if (d.mutat) { fant.style.left = e.clientX - d.lat * .55 + "px"; fant.style.top = e.clientY - d.lat * .55 + "px"; }
  });
  const termina = e => {
    if (!R || !R.drag) return;
    const d = R.drag; R.drag = null; fant.hidden = true;
    const sq = patratLa(e, tb, R.flip);
    if (d.mutat && sq && sq !== d.from) { R.sel = null; executa(d.from, sq); return; }
    deseneazaTabla();
  };
  tb.addEventListener("pointerup", termina);
  tb.addEventListener("pointercancel", () => { if (R && R.drag) { R.drag = null; fant.hidden = true; deseneazaTabla(); } });
}
function executa(from, to) {
  const fen = pozCurenta(), ch = new Chess(fen);
  const cand = ch.moves({ square: from, verbose: true }).filter(m => m.to === to);
  if (!cand.length) { R.sel = null; deseneazaTabla(); return; }
  const mv = cand.find(m => !m.promotion || m.promotion === "q") || cand[0];
  const u = from + to + (mv.promotion ? "q" : "");
  if (R.retry) return verificaRetry(mv, u);
  if (R.mod !== "mutari") R.mod = "mutari";
  if (!R.exp && R.idx < N() && R.rez.plies[R.idx].u.slice(0, 4) === u.slice(0, 4)) { mergiLa(R.idx + 1, true); return; }
  if (R.exp && R.exp.inLoc && !R.exp.moves.length && R.rez.plies[R.exp.baseIdx] && R.rez.plies[R.exp.baseIdx].u.slice(0, 4) === u.slice(0, 4)) { mergiLa(R.exp.baseIdx + 1, true); return; }
  if (R.exp && R.exp.i < R.exp.moves.length && R.exp.moves[R.exp.i].u.slice(0, 4) === u.slice(0, 4)) {
    R.exp.i++; actualizeaza({ sunet: mv.san });
    if (S.set.raspunsAuto !== false && R.exp.i < R.exp.moves.length && laMutareJos(fen)) {
      const e = R.exp, i = e.i;
      setTimeout(() => { if (R && R.exp === e && e.i === i && !R.auto) { e.i++; actualizeaza({ sunet: e.moves[i].s }); } }, 550);
    }
    return;
  }
  if (!R.exp) R.exp = { baseIdx: R.idx, startFen: fen, moves: [], i: 0, kind: "liber", titlu: "Explorare" };
  else if (R.exp.i < R.exp.moves.length || R.exp.kind !== "liber") { R.exp.moves = R.exp.moves.slice(0, R.exp.i); R.exp.kind = "liber"; R.exp.titlu = "Explorare"; }
  ch.move({ from, to, promotion: mv.promotion ? "q" : undefined });
  R.exp.moves.push({ u, s: mv.san, fenB: fen, fen: ch.fen() });
  R.exp.i = R.exp.moves.length;
  opresteAuto();
  programeazaRaspuns(fen);
  actualizeaza({ sunet: mv.san });
}

// ───────── răspunsul automat al adversarului în explorare ─────────
const laMutareJos = fenB => fenB.split(" ")[1] === (R.flip ? "b" : "w");
function programeazaRaspuns(fenB) {
  R.asteaptaRaspuns = null;
  if (S.set.raspunsAuto === false || !R.exp || R.exp.kind !== "liber" || !laMutareJos(fenB)) return;
  const fen = pozCurenta();
  if (new Chess(fen).isGameOver()) return;
  R.asteaptaRaspuns = { fen, t0: performance.now() };
  const l = R.live.get(fen);
  if (l && l.linii.length && (l.final || l.adancime >= 12)) return incearcaRaspuns(l);
  const k = R.fenIdx.get(fen);
  if (k != null && R.poz && R.poz[k].pv.length) incearcaRaspuns({ fen, linii: [{ pv: R.poz[k].pv }], adancime: 99, final: true });
}
function incearcaRaspuns(res) {
  const a = R && R.asteaptaRaspuns;
  if (!a || res.fen !== a.fen || pozCurenta() !== a.fen || !res.linii.length || (res.adancime < 12 && !res.final)) return;
  R.asteaptaRaspuns = null;
  const u = res.linii[0].pv[0];
  setTimeout(() => {
    if (!R || !R.exp || R.exp.kind !== "liber" || pozCurenta() !== a.fen || R.retry) return;
    const m = liniePv(a.fen, [u], 1)[0]; if (!m) return;
    R.exp.moves = R.exp.moves.slice(0, R.exp.i);
    R.exp.moves.push({ ...m, auto: true }); R.exp.i = R.exp.moves.length;
    actualizeaza({ sunet: m.s });
  }, Math.max(150, 650 - (performance.now() - a.t0)));
}

// ───────── „Încearcă din nou” și „Învață din greșeli” ─────────
function pornesteRetry(idx = R.idx) {
  const p = R.rez.plies[idx - 1];
  opresteAuto(); panouSus();
  R.idx = idx; R.mod = "mutari";
  R.retry = { p, fen: p.fenB, stare: "cauta", incercari: 0, hint: 0, m: null, fenArata: null };
  R.exp = null; R.sel = null;
  actualizeaza();
}
function verificaRetry(mv, u) {
  const r = R.retry, p = r.p;
  const aDoua = p.bu2 && u.slice(0, 4) === p.bu2.slice(0, 4) && p.wbx - p.w2 <= 2;
  r.m = { from: mv.from, to: mv.to, s: mv.san, u };
  const ch = new Chess(r.fen); ch.move({ from: mv.from, to: mv.to, promotion: mv.promotion ? "q" : undefined });
  r.fenArata = ch.fen();
  if (u.slice(0, 4) === (p.bu || "").slice(0, 4) || aDoua) {
    r.stare = "corect"; if (S.set.sunete) { sunetMutare(mv.san); setTimeout(sunetCorect, 120); }
    if (R.invata && !R.invata.rez[R.invata.k] && R.invata.rez[R.invata.k] !== false) R.invata.rez[R.invata.k] = r.incercari === 0 && !r.hint;
  } else {
    r.stare = "gresit"; r.incercari++;
    r.fb = null;
    if (S.set.sunete) { sunetMutare(mv.san); setTimeout(sunetGresit, 150); }
    if (R.invata && R.invata.rez[R.invata.k] === undefined) R.invata.rez[R.invata.k] = false;
  }
  actualizeaza();
}
function pornesteInvata() {
  if (!R.greseli.length) return toast("Nu ai greșeli mari în partida asta. Bravo!");
  R.invata = { lista: [...R.greseli], k: 0, rez: [] };
  pornesteRetry(R.invata.lista[0]);
}
function urmatoareaInvata() {
  const v = R.invata;
  if (v.rez[v.k] === undefined) v.rez[v.k] = false;
  v.k++;
  if (v.k >= v.lista.length) { R.retry = null; v.gata = true; R.idx = v.lista[v.lista.length - 1]; actualizeaza(); return; }
  pornesteRetry(v.lista[v.k]);
}

// ───────── panoul „Analiză” (mentorul, liniile motorului, lista de mutări) ─────────
function tabsHtml() {
  return `<div class="tabs" role="tablist" id="mod"><button role="tab" data-m="rezumat" aria-selected="${R.mod === "rezumat"}">Raport</button><button role="tab" data-m="mutari" aria-selected="${R.mod === "mutari"}">Analiză</button></div>`;
}
function legaTabs() {
  $("#mod").onclick = e => { const b = e.target.closest("[data-m]"); if (b && R.rez && b.dataset.m !== R.mod) { R.mod = b.dataset.m; R.retry = null; R.exp = null; actualizeaza(); } };
}
function randeazaAnaliza() {
  // structura se construiește o singură dată; la fiecare mutare se actualizează doar conținutul (pagina nu mai sare)
  const pc = $("#pc");
  if (pc.dataset.mod === "mutari" && $("#coach-w", pc)) {
    randeazaCoach(); randeazaVarianta(); randeazaLinii(); randeazaGrafic(true); randeazaLista();
    return;
  }
  pc.dataset.mod = "mutari";
  pc.innerHTML = `${tabsHtml()}<div id="coach-w"></div><div id="varianta"></div><div class="linii" id="linii" ${S.set.liveLinii ? "" : "hidden"}></div><div id="graf-w"></div><div class="lista-m" id="lm"></div>`;
  legaTabs();
  randeazaCoach(); randeazaVarianta(); randeazaLinii(); randeazaGrafic(true); randeazaLista();
}
const btn = (a, txt, cls = "", ic = "") => `<button class="btn ${cls}" data-a="${a}">${ic}${txt}</button>`;
function randeazaCoach() {
  const el = $("#coach-w"); if (!el || !R || !R.rez) return;
  const pl = R.rez.plies, desch = R.rez.deschidere;
  let cap = "", corp = "", act = [], vorbit = "";
  const urm = btn("urm", `Următorul moment ${ico("next", 16)}`, "primar");
  if (R.retry) {
    const r = R.retry, p = r.p, cine = p.cul === "w" ? "albul" : "negrul";
    const progres = R.invata ? `<span class="ev alb">${R.invata.k + 1}/${R.invata.lista.length}</span>` : "";
    if (r.stare === "cauta") {
      cap = `${iu("tinta", 24)}<span>${R.invata ? "Învață din greșeli" : "Încearcă din nou"}</span>${progres}`;
      corp = `<p>Aici ai jucat ${fig(p.s)}${p.cl === "bl" ? ", o gafă" : p.cl === "ms" ? " și ai ratat o ocazie" : ", o greșeală"}. Găsește o mutare mai bună pentru ${cine}: mută o piesă pe tablă.</p>
        ${r.hint === 1 ? `<p class="slab">Indiciu: mută piesa marcată cu albastru.</p>` : r.hint >= 2 ? `<p class="slab">Săgeata verde îți arată mutarea.</p>` : ""}`;
      act = [btn("indiciu", r.hint ? "Arată mutarea" : "Indiciu", "", ico("bec", 16)), btn("solutie", "Soluția", "", ico("ochi", 16)), btn(R.invata ? "sari" : "renunta", R.invata ? "Sari peste" : "Renunță")];
      vorbit = `Găsește o mutare mai bună pentru ${cine}.`;
    } else if (r.stare === "corect") {
      cap = `${iconSVG("be", 26)}<span>${fig(r.m.s)} <span class="k-be">e corectă!</span></span>${progres}`;
      const e = M.explicaIncercare({ fenB: r.fen, u: r.m.u, cul: p.cul, faza: p.faza, cl: "be" });
      corp = `${e.map(x => `<p>${x}</p>`).join("")}<p>${r.m.s === p.b ? "E cea mai bună mutare." : `E la fel de bună ca mutarea motorului, ${fig(p.b)}.`}</p>`;
      act = [btn("arata-best", "Arată continuarea"), R.invata ? btn("urm-inv", R.invata.k + 1 < R.invata.lista.length ? `Următoarea greșeală ${ico("next", 16)}` : "Vezi rezultatul", "primar") : btn("renunta", "Continuă", "primar")];
      vorbit = `Corect! ${sanVorbit(r.m.s)}.`;
    } else {
      if (!r.fb) { const f = feedback({ u: r.m.u, fenB: r.fen, fen: r.fenArata }); if (f) r.fb = f; }
      const f = r.fb;
      cap = f ? `${iconSVG(f.cl, 26)}<span>${fig(r.m.s)} <span class="k-${f.cl}">nu e cea mai bună</span></span>${progres}` : `<span>${fig(r.m.s)}</span><span class="spin mic"></span>`;
      const e = f ? M.explicaIncercare({ fenB: r.fen, u: r.m.u, cul: p.cul, faza: p.faza, cl: f.cl, evB: f.evB, evA: f.ev, pvA: f.pvA }) : [];
      corp = `${e.map(x => `<p>${x}</p>`).join("")}<p>${f && (f.cl === "ex" || f.cl === "go") ? "E aproape, dar există ceva mai bun." : "Mai încearcă."}</p>`;
      act = [btn("iar", "Mai încearcă", "primar"), btn("solutie", "Soluția", "", ico("ochi", 16)), btn(R.invata ? "sari" : "renunta", R.invata ? "Sari peste" : "Renunță")];
      vorbit = f ? `${sanVorbit(r.m.s)} nu e cea mai bună. Mai încearcă.` : "";
    }
  } else if (R.invata && R.invata.gata) {
    const v = R.invata, ok = v.rez.filter(x => x === true).length;
    cap = `${iconSVG(ok === v.lista.length ? "br" : ok ? "be" : "in", 26)}<span>Ai găsit ${ok} din ${v.lista.length}</span>`;
    corp = `<p>${ok === v.lista.length ? "Excelent! Ai găsit din prima toate mutările bune." : "Pozițiile ratate se întorc la Dezlegări → Din partidele tale, ca să le fixezi."}</p>`;
    act = [btn("inv-iar", "Încă o dată", "primar"), btn("ex10", "10 exerciții pe aceste teme", "", ico("play", 16)), btn("inchide-inv", "Închide")];
  } else if (R.exp) {
    const e = R.exp, m = e.i ? e.moves[e.i - 1] : null;
    const ev = evalPoz(pozCurenta());
    const evChip = ev ? `<span class="ev ${A.winPct(ev.ev, "w") >= 50 ? "alb" : ""}">${evFmt(evScurt(ev.ev))}</span>` : `<span class="spin mic"></span>`;
    if (!m) {
      cap = `<span>${esc(e.titlu)}</span>${evChip}`;
      corp = e.inLoc ? `<p>Poziția dinainte de ${fig(R.rez.plies[e.baseIdx].s)}. Mută tu altă piesă${R.rez.plies[e.baseIdx].bu && R.rez.plies[e.baseIdx].bu !== R.rez.plies[e.baseIdx].u ? " (săgeata verde e cea mai bună mutare)" : ""} și vezi ce ar fi urmat.</p>`
        : `<p>Poziția de plecare a variantei. Apasă › ca s-o urmărești sau mută tu o piesă.</p>`;
    } else if (e.kind === "liber") {
      const tu = m.auto && e.i >= 2 ? e.moves[e.i - 2] : m, f = feedback(tu), nr = nrDin(tu.fenB);
      cap = f ? `${iconSVG(f.cl, 26)}<span>${nr} ${fig(tu.s)} <span class="k-${f.cl}">${numeArt(f.cl)}</span></span>${evChip}` : `<span>${nr} ${fig(tu.s)}</span>${evChip}`;
      const exp = f ? M.explicaIncercare({ fenB: tu.fenB, u: tu.u, cul: f.cul, cl: f.cl, evB: f.evB, evA: f.ev, pvB: f.pvB, pvA: f.pvA, faza: R.rez.plies[Math.min(e.baseIdx, N() - 1)]?.faza }) : [];
      corp = `${exp.map(x => `<p>${x}</p>`).join("")}${!f ? `<p>Stockfish evaluează mutarea…</p>` : ""}${m.auto ? `<p class="slab">Adversarul răspunde ${fig(m.s)}. E rândul tău: mută pe tablă.</p>` : R.asteaptaRaspuns ? `<p class="slab">Adversarul se gândește…</p>` : ""}`;
      vorbit = f ? `${sanVorbit(tu.s)}: ${numeArt(f.cl)}.` : "";
    } else {
      const nr = nrDin(m.fenB), cul = m.fenB.split(" ")[1];
      const ce = M.fraza(M.scop(m.fenB, m.u, {}), "el");
      cap = `<span>${esc(e.titlu)}</span>${evChip}`;
      corp = `<p><b>${nr} ${fig(m.s)}</b>${ce ? ` — ${cul === "w" ? "albul" : "negrul"} ${ce}` : ""}.</p><p class="slab">Pasul ${e.i} din ${e.moves.length}. ${e.kind === "best" ? "Așa continua cea mai bună variantă." : e.kind === "urmare" ? "Așa continua jocul, cu cele mai bune mutări." : "Ideea din spatele mutării."}</p>`;
    }
    const top = ev && ev.best ? A.sanDin(pozCurenta(), ev.best) : null;
    if (e.dupaInvata && R.invata && !R.invata.gata) act.push(btn("urm-inv", R.invata.k + 1 < R.invata.lista.length ? `Următoarea greșeală ${ico("next", 16)}` : "Vezi rezultatul", "primar"));
    if (top) act.push(btn("raspuns", `Joacă ${fig(top)}`));
    act.push(btn("iesi", "Înapoi la partidă", e.dupaInvata ? "" : "primar"));
  } else if (R.idx === 0) {
    cap = `${iconSVG("bk", 26)}<span>Să începem!</span>`;
    corp = `<p>${desch ? `Deschiderea: <b>${esc(numeRo(desch))}</b>. ` : ""}Merg cu tine prin partidă și îți explic fiecare mutare. Apasă <b>›</b> ca să mergi mutare cu mutare, sau <b>Următorul moment</b> ca să sari la momentele importante.</p><p class="slab">Poți muta oricând o piesă pe tablă ca să vezi ce ar fi urmat.</p>`;
    act = [urm];
    vorbit = desch ? `Deschiderea: ${numeRo(desch)}.` : "";
  } else {
    const p = pl[R.idx - 1], eMea = p.cul === R.eu, e = explicatie(R.idx - 1);
    const albBine = p.wAlb >= 50;
    cap = `${iconSVG(p.cl, 26)}<span>${nrMut(R.idx)} ${M.titluClasa(p.cl, p.s)}</span><span class="ev ${albBine ? "alb" : ""}" title="Evaluarea, din perspectiva albului">${evFmt(p.v)}</span>`;
    corp = e.para.map(x => `<p>${x}</p>`).join("") + (e.sfat ? `<p class="sfat">${esc(e.sfat)}</p>` : "");
    vorbit = e.para.map(x => x.replace(/<[^>]+>/g, "")).join(" ");
    if (["mi", "bl", "in"].includes(p.cl) && R.poz[R.idx] && R.poz[R.idx].pv.length) act.push(btn("urmare", eMea ? "Ce urma" : "Cum pedepsești"));
    if (p.bu && p.bu !== p.u && !["bk", "fo"].includes(p.cl)) act.push(btn("best", p.cl === "ms" ? "Arată ce ratai" : "Cea mai bună", "", ico("stea", 16)));
    if (["br", "gr"].includes(p.cl)) act.push(btn("idee", "Arată ideea"));
    if (ERR.includes(p.cl) && p.bu && p.bu !== p.u && eMea) act.push(btn("retry", "Încearcă din nou", "", ico("sync", 16)));
    if (p.am && !ERR.includes(p.cl) && p.cl !== "bk") act.push(`<button class="btn" data-a="am" aria-pressed="${!!R.arataAm}">Amenințarea</button>`);
    if (R.idx === N()) act.push(R.greseli.length ? btn("invata", `Învață din greșeli (${R.greseli.length})`, "primar") : btn("rap", "Vezi raportul", "primar"));
    else act.push(urm);
  }
  el.innerHTML = bula({ cap, corp, act: act.join("") });
  el.onclick = e => {
    const b = e.target.closest("[data-a],[data-i]"); if (!b) return;
    deblocheaza();
    if (b.dataset.i) return mergiLa(+b.dataset.i, false);
    actiune(b.dataset.a);
  };
  if (S.set.voce && vorbit && vorbit !== R.ultimVorbit) { R.ultimVorbit = vorbit; vorbeste(vorbit); }
}
function actiune(a) {
  const pl = R.rez.plies, p = R.idx ? pl[R.idx - 1] : null;
  if (a === "urm") return urmatoareaCheie();
  if (a === "rap") { R.mod = "rezumat"; return actualizeaza(); }
  if (a === "ex10") return sesiuneDinPartida(R.p);
  if (a === "iesi") return iesiExp();
  if (a === "renunta") { R.retry = null; return actualizeaza(); }
  if (a === "iar") { Object.assign(R.retry, { stare: "cauta", m: null, fenArata: null, fb: null }); return actualizeaza(); }
  if (a === "indiciu") { R.retry.hint = Math.min(2, R.retry.hint + 1); if (R.invata && R.invata.rez[R.invata.k] === undefined) R.invata.rez[R.invata.k] = false; return actualizeaza(); }
  if (a === "solutie") {
    const q = R.retry.p; if (R.invata && R.invata.rez[R.invata.k] === undefined) R.invata.rez[R.invata.k] = false;
    const inv = R.invata; R.retry = null;
    pornesteExp(R.idx - 1, q.fenB, liniePv(q.fenB, R.poz[R.idx - 1].pv), "best", "Soluția");
    if (inv && !inv.gata) { R.exp.dupaInvata = true; randeazaCoach(); }
    return;
  }
  if (a === "retry") return pornesteRetry();
  if (a === "invata") return pornesteInvata();
  if (a === "urm-inv" || a === "sari") { R.exp = null; return urmatoareaInvata(); }
  if (a === "inv-iar") return pornesteInvata();
  if (a === "inchide-inv") { R.invata = null; return actualizeaza(); }
  if (a === "am") { R.arataAm = !R.arataAm; return actualizeaza(); }
  if (a === "arata-best") { const q = R.retry.p; R.retry = null; return pornesteExp(R.idx - 1, q.fenB, liniePv(q.fenB, R.poz[R.idx - 1].pv), "best", "Cea mai bună continuare"); }
  if (a === "best") return pornesteExp(R.idx - 1, p.fenB, liniePv(p.fenB, R.poz[R.idx - 1].pv), "best", p.cl === "ms" ? "Ce puteai câștiga" : "Cea mai bună continuare");
  if (a === "idee") return pornesteExp(R.idx - 1, p.fenB, liniePv(p.fenB, R.poz[R.idx - 1].pv), "idee", "Ideea mutării");
  if (a === "urmare") return pornesteExp(R.idx, p.fen, liniePv(p.fen, R.poz[R.idx].pv), "urmare", p.cul === R.eu ? `Ce urma după ${fig(p.s)}` : "Cum pedepseai greșeala");
  if (a === "raspuns") {
    const fen = pozCurenta(), ev = evalPoz(fen); if (!ev || !ev.best) return;
    const m = liniePv(fen, [ev.best], 1)[0]; if (!m) return;
    if (!R.exp) R.exp = { baseIdx: R.idx, startFen: fen, moves: [], i: 0, kind: "liber", titlu: "Explorare" };
    R.exp.moves = R.exp.moves.slice(0, R.exp.i); R.exp.kind = "liber"; R.exp.titlu = "Explorare";
    R.exp.moves.push(m); R.exp.i = R.exp.moves.length;
    programeazaRaspuns(fen);
    return actualizeaza({ sunet: m.s });
  }
}
function numeArt(cl) { return { be: "e cea mai bună", ex: "e excelentă", go: "e bună", in: "e o inexactitate", mi: "e o greșeală", bl: "e o gafă" }[cl] || A.NUME_CLASA[cl]; }
function nrDin(fen) { const [, t, , , , n] = fen.split(" "); return t === "w" ? `${n}.` : `${n}…`; }
function randeazaVarianta() {
  const el = $("#varianta"); if (!el) return;
  if (!R.exp || !R.exp.moves.length) { el.innerHTML = ""; return; }
  const e = R.exp;
  el.innerHTML = `<div class="var"><span class="var-t">${esc(e.titlu)}</span><span class="var-m">${e.moves.map((m, k) => {
    const nr = m.fenB.split(" ")[1] === "w" ? nrDin(m.fenB) + " " : k === 0 ? nrDin(m.fenB) + " " : "";
    return `<button class="lm ${k === e.i - 1 ? "on" : ""}" data-v="${k + 1}">${nr}${fig(m.s)}</button>`; }).join("")}</span>
    <button class="btn mic" data-v="x">Închide</button></div>`;
  el.onclick = ev => { const b = ev.target.closest("[data-v]"); if (!b) return; if (b.dataset.v === "x") return iesiExp(); opresteAuto(); R.exp.i = +b.dataset.v; actualizeaza(); };
}
function randeazaLinii() {
  const el = $("#linii"); if (!el || !R || !R.rez || el.hidden) return;
  const fen = pozCurenta(), ev = evalPoz(fen), ch = new Chess(fen);
  if (R.retry && R.retry.stare !== "corect") { el.innerHTML = `<div class="ln-cap">${ico("motor", 14)} Liniile lui Stockfish sunt ascunse cât cauți mutarea.</div>`; el.onclick = null; return; }
  if (ch.isGameOver()) { el.innerHTML = `<div class="ln-cap">Partida s-a încheiat în această poziție.</div>`; return; }
  if (!ev || !ev.linii || !ev.linii.length) { el.innerHTML = `<div class="ln-cap"><span class="spin mic"></span> Stockfish calculează…</div>`; return; }
  const live = R.live.get(fen);
  const calc = live && !live.final;
  el.innerHTML = `<div class="ln-cap"><b>Stockfish 19</b> · adâncime ${ev.ad}${calc ? ` <span class="spin mic"></span>` : ""}</div>` +
    ev.linii.slice(0, 3).map((l, k) => {
      const mv = liniePv(fen, l.pv, 10), pos = A.winPct(l.ev, "w") >= 50;
      return `<div class="ln"><span class="lev ${pos ? "alb" : "negru"}">${evFmt(evScurt(l.ev))}</span><span class="lmv">${mv.map((m, j) => {
        const nr = m.fenB.split(" ")[1] === "w" ? nrDin(m.fenB) + " " : j === 0 ? nrDin(m.fenB) + " " : "";
        return `<button class="lm" data-l="${k}" data-j="${j}">${nr}${fig(m.s)}</button>`; }).join("")}</span></div>`;
    }).join("");
  el.onclick = e => {
    const b = e.target.closest("[data-l]"); if (!b) return;
    const l = ev.linii[+b.dataset.l], mv = liniePv(fen, l.pv, 10).slice(0, +b.dataset.j + 1);
    if (!R.exp) R.exp = { baseIdx: R.idx, startFen: fen, moves: [], i: 0, kind: "liber", titlu: "Explorare" };
    else R.exp.moves = R.exp.moves.slice(0, R.exp.i);
    R.exp.kind = "best"; R.exp.titlu = "Linia motorului";
    R.exp.moves.push(...mv); R.exp.i = R.exp.moves.length; R.retry = null;
    opresteAuto(); actualizeaza({ sunet: mv[mv.length - 1].s });
  };
}
function randeazaLista() {
  const el = $("#lm"); if (!el) return;
  const pl = R.rez.plies, lista = [];
  for (let i = 0; i < pl.length; i += 2) {
    const a = pl[i], b = pl[i + 1];
    const cel = (q, k) => (q ? `<button class="mm ${R.idx === k && !R.exp ? "on" : ""} ${R.exp && R.exp.baseIdx === k ? "baza" : ""} ${q.cul === R.eu ? "eu" : ""}" data-i="${k}">
      <span class="ic">${["bk", "be", "ex", "go"].includes(q.cl) ? "" : iconSVG(q.cl, 15)}</span><span class="sn">${fig(q.s)}</span>${S.set.timpMutare && q.t != null ? `<span class="tm">${Math.round(q.t)}s</span>` : ""}</button>` : `<span></span>`);
    lista.push(`<span class="mn">${i / 2 + 1}.</span>${cel(a, i + 1)}${cel(b, i + 2)}`);
  }
  el.innerHTML = `${R.rez.deschidere ? `<div class="lm-cap">${iconSVG("bk", 16)}<span>${esc(numeRo(R.rez.deschidere))}</span></div>` : ""}<div class="lm-grid">${lista.join("")}</div>`;
  el.onclick = e => { const b = e.target.closest("[data-i]"); if (b) { opresteAuto(); mergiLa(+b.dataset.i, false); } };
  const on = $(".mm.on", el) || $(".mm.baza", el);
  if (on) el.scrollTop = on.offsetTop - el.clientHeight / 2;
}

// ───────── graficul evaluării ─────────
function randeazaGrafic(mic) {
  const w = $("#graf-w"); if (!w) return;
  const pl = R.rez.plies, n = pl.length || 1, W = 640, H = mic ? 80 : 120;
  const x = i => (W * i) / n, y = v => H * (1 - v / 100);
  const pts = [[0, A.winPct(R.poz[0].ev, "w")], ...pl.map((p, i) => [i + 1, p.wAlb])];
  const d = `M0,${H} ` + pts.map(([i, v]) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ") + ` L${W},${H} Z`;
  const cur = R.exp ? R.exp.baseIdx : R.retry ? R.idx - 1 : R.idx;
  let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="graf-svg" aria-label="Evaluarea pe parcursul partidei">
    <rect width="${W}" height="${H}" fill="#403d39"/><path d="${d}" fill="#fff"/>
    <line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="#8b8987" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>`;
  pl.forEach((p, i) => { if (CHEIE.includes(p.cl)) s += `<circle cx="${x(i + 1)}" cy="${y(p.wAlb)}" r="${mic ? 3.6 : 4.4}" fill="${CULORI[p.cl]}" stroke="#262522" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`; });
  if (R.mod === "mutari") s += `<line x1="${x(cur)}" x2="${x(cur)}" y1="0" y2="${H}" stroke="#81b64c" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
  s += `</svg>`;
  w.innerHTML = `<div class="graf ${mic ? "mic" : ""}" id="graf">${s}</div>`;
  const g = $("#graf");
  const at = e => { const r = g.getBoundingClientRect(); return Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * n); };
  g.onclick = e => { opresteAuto(); mergiLa(at(e), false); };
  g.onmousemove = e => { const i = at(e), p = pl[i - 1], r = g.getBoundingClientRect(); tip(i ? `${nrMut(i)} ${fig(p.s)} · ${A.NUME_CLASA[p.cl] || ""} · ${evFmt(p.v)}` : "Poziția de start", e.clientX, r.top); };
  g.onmouseleave = () => tip(null);
}

// ───────── RAPORTUL (rezumatul de tip Game Review) ─────────
function iconFaza(r, ref) {
  if (r == null) return "";
  const d = r - (ref || r);
  return iconSVG(d >= 400 ? "be" : d >= 150 ? "ex" : d >= -150 ? "go" : d >= -400 ? "in" : d >= -700 ? "mi" : "bl", 24);
}
function randeazaRezumat() {
  const rz = R.rez, p = R.p, rap = R.raport;
  const pc = $("#pc"); pc.dataset.mod = "rezumat";
  const W = A.cuRatinguri(rz.alb), B = A.cuRatinguri(rz.negru);
  const rand = (k, n) => `<div class="kr">
      <span class="kl k-${k}">${n}</span>
      <button class="kn k-${k} ${W.cnt[k] ? "" : "zero"}" data-cl="${k}" data-c="w" ${W.cnt[k] ? "" : "disabled"}>${W.cnt[k]}</button>
      <span class="ki">${iconSVG(k, 24)}</span>
      <button class="kn k-${k} ${B.cnt[k] ? "" : "zero"}" data-cl="${k}" data-c="b" ${B.cnt[k] ? "" : "disabled"}>${B.cnt[k]}</button></div>`;
  const lectii = rap.lectii.map((l, k) => `<div class="lectie-r"><span class="nr" style="background:${CULORI[l.icon] || CULORI.be}">${k + 1}</span><div>
      <p><b>${l.titlu}</b></p><p>${l.text}</p><div class="act">${l.teme ? `<button class="btn mic" data-teme="${l.teme.join(",")}" data-titlu="${esc(l.titlu.replace(/<[^>]+>/g, ""))}">${ico("play", 14)}Exersează tema</button>` : ""}
      ${l.ply ? `<button class="btn mic" data-retry="${l.ply}">${ico("sync", 14)}Reia poziția</button>` : ""}
      ${l.curs ? `<a class="btn mic primar" href="#cap-${l.curs}/exerseaza">Repetă capitolul</a>` : ""}
      ${l.cursuri ? `<a class="btn mic" href="#deschideri">Cursurile de deschideri</a>` : ""}
      ${l.faza ? `<button class="btn mic" data-faza="${l.faza}">${ico("play", 14)}Exersează faza</button>` : ""}</div></div></div>`).join("");
  pc.innerHTML = `${tabsHtml()}
    ${bula({ cap: `<span>${rezultat(p)[0] === "castig" ? "Felicitări!" : "Raportul partidei"}</span>`, corp: `<p>${rap.rezumat}</p>` })}
    <div id="graf-w"></div>
    <div class="tabel">
      <div class="kr cap-j"><span></span><span class="kp">${esc(p.alb.user)}</span><span></span><span class="kp">${esc(p.negru.user)}</span></div>
      <div class="kr"><span class="kl">Precizie</span><span class="box alb">${af(W.acc)}</span><span></span><span class="box negru">${af(B.acc)}</span></div>
      <div class="sepl"></div>
      ${A.CLASE.map(([k, n]) => rand(k, n)).join("")}
      <div class="sepl"></div>
      <div class="kr"><span class="kl">Evaluarea jocului</span><span class="box alb">${W.gRating ?? "—"}</span><span></span><span class="box negru">${B.gRating ?? "—"}</span></div>
      ${FAZE.map(([k, n]) => { const a = W.avansat[k === "strategy" ? "strategy" : k], b = B.avansat[k];
        const cel = (v, r) => (v ? `<span class="avc" title="Precizie ${af(v.acc)}% în ${v.n} mutări">${iconFaza(v.r, r)}</span>` : `<span class="avc gol">—</span>`);
        return `<div class="kr adv"><span class="kl">${n}</span>${cel(a, p.alb.rating || W.gRating)}<span></span>${cel(b, p.negru.rating || B.gRating)}</div>`; }).join("")}
    </div>
    <button class="btn primar mare plin" id="b-start">Pornește analiza</button>
    ${rap.lectii.length ? `<div class="raport"><h3>${iu("invata", 24)}Lecțiile partidei</h3>${lectii}</div>` : ""}
    <div class="act">
      ${R.greseli.length ? `<button class="btn plin" id="b-invata">${iu("tinta", 22)}Învață din greșeli · ${R.greseli.length}</button>` : ""}
      <button class="btn plin" id="b-ex10">${iu("dezlegari", 22)}10 exerciții din greșelile partidei</button>
    </div>
    <p class="nota centru">Stockfish 19, adâncime ${R.adancime || S.set.adancime}, calculat pe dispozitivul tău. ${p.url ? `<a class="lnk" href="${esc(p.url)}" target="_blank" rel="noopener">Partida pe Chess.com ↗</a>` : ""}</p>`;
  legaTabs();
  randeazaGrafic(false);
  $("#b-start").onclick = () => { deblocheaza(); mergiLa(R.ultimaTeorie || R.chei[0] || 1, false); };
  $("#b-ex10").onclick = () => { deblocheaza(); sesiuneDinPartida(R.p); };
  const bi = $("#b-invata"); if (bi) bi.onclick = () => { deblocheaza(); pornesteInvata(); };
  $$(".kn[data-cl]", pc).forEach(b => (b.onclick = () => { const i = rz.plies.findIndex(x => x.cl === b.dataset.cl && x.cul === b.dataset.c); if (i >= 0) mergiLa(i + 1, false); }));
  pc.querySelector(".raport")?.addEventListener("click", e => {
    const b = e.target.closest("[data-i],[data-retry],[data-teme],[data-faza]"); if (!b) return;
    if (b.dataset.i) mergiLa(+b.dataset.i, false);
    else if (b.dataset.retry) pornesteRetry(+b.dataset.retry);
    else if (b.dataset.teme) sesiunePeTeme(b.dataset.teme.split(","), b.dataset.titlu);
    else if (b.dataset.faza) import("./dezlegari.js?v=40").then(m => m.sesiuneFaza(b.dataset.faza));
  });
  pc.querySelector(".coach")?.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) mergiLa(+b.dataset.i, false); });
}

// ───────── vocea mentorului ─────────
function sanVorbit(san) {
  if (!san) return "";
  if (/^O-O-O/.test(san)) return "rocadă mare";
  if (/^O-O/.test(san)) return "rocadă mică";
  const P = { K: "rege ", Q: "damă ", R: "turn ", B: "nebun ", N: "cal " };
  return san.replace(/^([KQRBN])/, (m, k) => P[k]).replace("x", " ia ").replace(/=([QRBN])/, (m, k) => " promovează în " + P[k]).replace("#", " mat").replace("+", " șah");
}
function vorbeste(text) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const FIG = { "♔": "K", "♕": "Q", "♖": "R", "♗": "B", "♘": "N" };
  const t = text.replace(/[♔♕♖♗♘]/g, c => FIG[c]).replace(/\b([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[+#]?|O-O(-O)?)\b/g, m => sanVorbit(m));
  const u = new SpeechSynthesisUtterance(t);
  u.lang = "ro-RO";
  const v = speechSynthesis.getVoices().find(x => x.lang && x.lang.toLowerCase().startsWith("ro"));
  if (v) u.voice = v;
  u.rate = 1.02;
  speechSynthesis.speak(u);
}

// pentru testele automate
export const _test = () => R;
