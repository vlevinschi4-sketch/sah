// review.js — Game Review, după modelul Chess.com: rezumat, antrenor mutare cu mutare,
// cea mai bună mutare, continuarea, „Încearcă din nou”, momente cheie și explorare liberă
// cu Stockfish live (muți tu orice piesă și vezi evaluarea și continuarea).
import { Chess } from "./chess.js";
import * as A from "./analiza.js";
import { S, culoareaMea, rezultat, motorLive, analizeaza, inSerie, numeDeschidere, familie } from "./stare.js";
import { db, salveazaSetari } from "./date.js";
import { tablaSVG, iconSVG, baraEval, sageata, patratLa, CULORI, idPiesa } from "./tabla.js";
import { sunetMutare, sunetGresit, sunetCorect, deblocheaza } from "./sunete.js";
import { $, $$, esc, af, fig, figText, nrMut, evFmt, mmss, reducedMotion, dataRo, toast, tip, timp, evScurt, ico } from "./util.js";
import { sesiuneDinPartida } from "./antrenor.js";

const ERR = ["in", "mi", "ms", "bl"], CHEIE = ["br", "gr", "mi", "ms", "bl"];
const ADV = [["opening", "Deschidere"], ["tactics", "Combinații tactice"], ["strategy", "Strategie"], ["endgame", "Finaluri"]];
const ARATA = {
  piesa_in_priza: "Arată piesa pierdută", piesa_neaparata: "Arată piesa pierdută", furculita: "Arată furculița",
  mat_permis: "Arată matul", tactica_permisa: "Arată combinația", pion_pierdut: "Arată pionul pierdut", atac_rege: "Arată atacul",
  pat: "Arată patul", mat_ratat: "Arată matul ratat", material_ratat: "Arată ce câștigai", tehnica_final: "Arată continuarea", pozitional: "Arată continuarea",
};
let R = null;
export const reviewDeschis = () => !!R;

// ───────── deschidere și închidere ─────────
export async function deschideReview(p) {
  const info = A.citestePgn(p.pgn), eu = culoareaMea(p);
  R = { p, info, eu, rez: null, poz: null, idx: 0, flip: eu === "b", mod: "rezumat", exp: null, retry: null, sel: null, drag: null,
    live: new Map(), fenIdx: new Map(info.fens.map((f, i) => [f, i])), auto: null, arataAm: false, ultimVorbit: "" };
  document.body.classList.add("in-partida");
  randeazaCadru();
  const a = await db.ia("analize", p.id);
  if (a && a.pozitii && a.pozitii.length === info.fens.length) {
    R.poz = a.pozitii; R.adancime = a.adancime;
    R.rez = A.clasificaPartida(info, a.pozitii, S.teorie, p.eco);
    pregatesteChei(); actualizeaza();
  } else {
    if (S.lot) S.lot.semnal.oprit = true;
    const r = R, semnal = { oprit: false }; r.semnal = semnal;
    randeazaAsteptare(0);
    try {
      const rez = await inSerie(() => analizeaza(p, (g, n) => { if (R === r) randeazaAsteptare(Math.round(g / n * 100)); }, semnal));
      if (R !== r) return;
      R.rez = rez.rez; R.poz = rez.pozitii; R.adancime = rez.adancime;
      pregatesteChei(); actualizeaza();
    } catch (e) {
      if (R === r && e.message !== "oprit") $("#panou").innerHTML = `<div class="gol"><p>Analiza nu a mers: ${esc(e.message)}</p></div>`;
    }
  }
}
export function inchideReview() {
  if (!R) return;
  if (R.semnal && !R.rez) R.semnal.oprit = true;
  opresteAuto(); if (S.live) S.live.opreste();
  if (window.speechSynthesis) speechSynthesis.cancel();
  R = null;
  document.body.classList.remove("in-partida");
}
export function reimprospateaza() { if (R && R.rez) { pregatesteChei(); actualizeaza(); } }

function pregatesteChei() {
  const pl = R.rez.plies, cine = S.set.momente;
  const ok = q => cine === "ambii" || (cine === "eu" ? q.cul === R.eu : q.cul !== R.eu);
  let ultimaTeorie = -1;
  pl.forEach((q, i) => { if (q.cl === "bk") ultimaTeorie = i; });
  R.ultimaTeorie = ultimaTeorie >= 0 ? ultimaTeorie + 1 : 0;
  R.chei = [...new Set([...(R.ultimaTeorie ? [R.ultimaTeorie] : []), ...pl.map((q, i) => (CHEIE.includes(q.cl) && ok(q) ? i + 1 : null)).filter(Boolean)])].sort((a, b) => a - b);
}

// ───────── cadrul paginii ─────────
function randeazaCadru() {
  const p = R.p;
  $("#ecran-partida").innerHTML = `
    <div class="rv">
      <div class="rv-st">
        <div class="jucator" id="j-sus"></div>
        <div class="tabla-rand"><div id="evb"></div><div class="tabla" id="tb"></div></div>
        <div class="jucator" id="j-jos"></div>
        <div class="nav glass" id="nav">
          <button class="btn glass icon" data-n="first" aria-label="Început">${ico("first", 20)}</button>
          <button class="btn glass icon" data-n="prev" aria-label="Mutarea anterioară">${ico("prev", 20)}</button>
          <button class="btn glass icon" data-n="auto" id="b-auto" aria-label="Redare automată">${ico("play", 20)}</button>
          <button class="btn glass icon" data-n="next" aria-label="Mutarea următoare">${ico("next", 20)}</button>
          <button class="btn glass icon" data-n="last" aria-label="Sfârșit">${ico("last", 20)}</button>
          <span class="sep"></span>
          <button class="btn glass icon" data-n="flip" aria-label="Întoarce tabla">${ico("flip", 20)}</button>
        </div>
      </div>
      <aside class="rv-dr">
        <div class="rv-cap">
          <button class="btn glass icon" id="b-inapoi" aria-label="Înapoi la partide">${ico("back", 20)}</button>
          <div class="rv-titlu"><b>Analiza partidei</b><span>${esc(p.alb.user)} – ${esc(p.negru.user)} · ${dataRo(p.ts)} · ${timp(p)}</span></div>
          <button class="btn glass icon" id="b-voce" aria-label="Antrenorul citește cu voce" aria-pressed="${!!S.set.voce}">${ico(S.set.voce ? "sunet" : "mut", 19)}</button>
          <button class="btn glass icon" id="b-set" aria-label="Setări">${ico("gear", 19)}</button>
        </div>
        <div class="seg glass" role="tablist" id="mod">
          <button role="tab" data-m="rezumat" aria-selected="true">Rezumat</button>
          <button role="tab" data-m="mutari" aria-selected="false">Analiză</button>
        </div>
        <div id="panou"></div>
      </aside>
    </div>
    <div id="fantoma" class="fantoma" hidden></div>`;
  $("#b-inapoi").onclick = () => { location.hash = ""; };
  $("#b-set").onclick = () => dispatchEvent(new CustomEvent("deschide-setari"));
  $("#b-voce").onclick = async () => {
    S.set.voce = !S.set.voce; salveazaSetari(S.set);
    $("#b-voce").setAttribute("aria-pressed", S.set.voce); $("#b-voce").innerHTML = ico(S.set.voce ? "sunet" : "mut", 19);
    if (!S.set.voce && window.speechSynthesis) speechSynthesis.cancel(); else { R.ultimVorbit = ""; randeazaCoach(); }
  };
  $("#mod").onclick = e => { const b = e.target.closest("[data-m]"); if (b && R.rez) { R.mod = b.dataset.m; R.retry = null; actualizeaza(); } };
  $("#nav").onclick = e => { const b = e.target.closest("[data-n]"); if (b) { deblocheaza(); comanda(b.dataset.n); } };
  legaTabla();
  deseneazaTabla();
}
function randeazaAsteptare(pct) {
  const el = $("#panou"); if (!el) return;
  el.innerHTML = `<div class="asteapta"><div class="inel" style="--p:${pct}"><span>${pct}%</span></div>
    <h3>Analizez partida</h3><p>Stockfish 19 rulează pe dispozitivul tău, la adâncimea ${S.set.adancime}. Durează de obicei sub un minut.</p>
    <button class="btn glass" id="b-anuleaza">Anulează</button></div>`;
  $("#b-anuleaza").onclick = () => { if (R && R.semnal) R.semnal.oprit = true; location.hash = ""; };
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
  const stocat = k != null && R.poz ? { ev: R.poz[k].ev, best: R.poz[k].pv[0] || null, ad: R.adancime,
    linii: [{ ev: R.poz[k].ev, pv: R.poz[k].pv, ad: R.adancime }, ...(R.poz[k].ev2 ? [{ ev: R.poz[k].ev2, pv: R.poz[k].pv2, ad: R.adancime }] : [])] } : null;
  if (l && l.linii.length && (!stocat || l.adancime >= stocat.ad || l.final)) return { ev: l.linii[0].ev, best: l.linii[0].pv[0], ad: l.adancime, linii: l.linii, final: l.final };
  if (stocat) return stocat;
  if (l && l.linii.length && l.adancime >= 8) return { ev: l.linii[0].ev, best: l.linii[0].pv[0], ad: l.adancime, linii: l.linii };
  return null;
}
function sanDin(fen, u) { try { const ch = new Chess(fen); const m = ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); return m.san; } catch (e) { return null; } }
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
  return { cl: A.clasaSimpla(wb, wa, eBest), bestS: b.best ? sanDin(m.fenB, b.best) : null, eBest, ev: a.ev };
}

// ───────── actualizare ─────────
function actualizeaza(o = {}) {
  if (!R || !R.rez) return;
  $$("#mod button").forEach(b => b.setAttribute("aria-selected", b.dataset.m === R.mod));
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

// variantele arătate de antrenor se prelungesc cu motorul live, ca să vezi urmarea până la capăt
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
  if (S.set.autoVariante && !R.auto && e.i === e.moves.length - plus.length) pornesteAuto();
}

// ───────── comenzi de navigare ─────────
function comanda(n) {
  if (!R || !R.rez) { if (n === "flip" && R) { R.flip = !R.flip; deseneazaTabla(); } return; }
  if (n !== "auto") opresteAuto();
  if (n === "flip") { R.flip = !R.flip; deseneazaTabla(); return; }
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
  if (R.mod !== "mutari") { R.mod = "mutari"; scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" }); }
  const tinta = n === "first" ? 0 : n === "last" ? N() : n === "prev" ? R.idx - 1 : R.idx + 1;
  mergiLa(tinta, n === "next");
}
function mergiLa(i, cuSunet) {
  const vechi = R.idx;
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
  opresteAuto();
  R.exp = { baseIdx, startFen, moves, i: 0, kind, titlu };
  R.retry = null; R.sel = null;
  if (S.set.autoVariante && moves.length) { R.exp.i = 0; pornesteAuto(); }
  else { R.exp.i = Math.min(1, moves.length); }
  actualizeaza({ sunet: R.exp.i ? moves[0].s : null });
}
function pornesteAuto() {
  opresteAuto();
  const btn = $("#b-auto"); if (btn) btn.innerHTML = ico("pause", 20);
  R.auto = setInterval(() => {
    if (!R) return opresteAuto();
    if (R.exp) { if (R.exp.i < R.exp.moves.length) { R.exp.i++; actualizeaza({ sunet: R.exp.moves[R.exp.i - 1].s }); } else opresteAuto(); }
    else if (R.idx < N()) mergiLa(R.idx + 1, true);
    else opresteAuto();
  }, Math.max(350, S.set.pauza || 900));
}
function opresteAuto() {
  if (R && R.auto) { clearInterval(R.auto); R.auto = null; }
  const btn = $("#b-auto"); if (btn) btn.innerHTML = ico("play", 20);
}
addEventListener("keydown", e => {
  if (!R || !R.rez || /input|textarea/i.test(e.target.tagName)) return;
  if (e.key === "ArrowLeft") { e.preventDefault(); comanda("prev"); }
  if (e.key === "ArrowRight") { e.preventDefault(); comanda("next"); }
  if (e.key === "ArrowUp") { e.preventDefault(); comanda("first"); }
  if (e.key === "ArrowDown") { e.preventDefault(); comanda("last"); }
  if (e.key === " ") { e.preventDefault(); comanda("auto"); }
  if (e.key === "Escape") { if (R.exp) iesiExp(); else if (R.retry) { R.retry = null; actualizeaza(); } else location.hash = ""; }
});

// ───────── tabla: desen, mutări cu atingere sau trăgând piesa ─────────
function deseneazaTabla() {
  if (!R) return;
  const fen = pozCurenta();
  let arrows = [], hl = [], badge = null, tinte = [];
  const best = (S.set.sageti || "ambele") !== "nimic", rec = (S.set.sageti || "ambele") === "ambele";
  if (R.rez) {
    if (R.retry) {
      const r = R.retry;
      if (r.hint) arrows.push(sageata(r.p.bu, CULORI.be, .6));
      if (r.stare === "gresit" && r.m) {
        hl = [{ sq: r.m.from, c: "#e8c547", o: .3 }, { sq: r.m.to, c: "#e8c547", o: .45 }];
        const f = r.fb; if (f && S.set.clasaTabla) badge = { sq: r.m.to, cl: f.cl };
      }
      if (r.stare === "corect" && r.m) { hl = [{ sq: r.m.from, c: CULORI.be, o: .3 }, { sq: r.m.to, c: CULORI.be, o: .45 }]; if (S.set.clasaTabla) badge = { sq: r.m.to, cl: "be" }; }
    } else if (R.exp) {
      const m = R.exp.i ? R.exp.moves[R.exp.i - 1] : null;
      if (m) {
        hl = [{ sq: m.u.slice(0, 2), c: "#e8c547", o: .32 }, { sq: m.u.slice(2, 4), c: "#e8c547", o: .45 }];
        const tu = m.auto && R.exp.i >= 2 ? R.exp.moves[R.exp.i - 2] : m;
        const f = R.exp.kind === "liber" ? feedback(tu) : null;
        if (f && S.set.clasaTabla && !(m.auto && tu.u.slice(2, 4) === m.u.slice(2, 4))) badge = { sq: tu.u.slice(2, 4), cl: f.cl };
      }
      const ev = evalPoz(fen);
      if (best && ev && ev.best) arrows.push(sageata(ev.best, CULORI.be, .8));
    } else if (R.idx > 0) {
      const p = R.rez.plies[R.idx - 1], c = CULORI[p.cl] || "#e8c547";
      hl = [{ sq: p.from, c, o: .3 }, { sq: p.to, c, o: .45 }];
      if (S.set.clasaTabla && p.cl) badge = { sq: p.to, cl: p.cl };
      if (R.arataAm && p.am) arrows.push(sageata(p.am, CULORI.am, .85));
      else {
        if (best && p.bu && p.bu !== p.u && p.cl !== "bk" && p.cl !== "fo") arrows.push(sageata(p.bu, CULORI.be, .85));
        const urm = R.rez.plies[R.idx];
        if (rec && urm && urm.bu) arrows.push(sageata(urm.bu, CULORI.rec, .6));
      }
    } else if (rec && R.rez.plies[0] && R.rez.plies[0].bu) arrows.push(sageata(R.rez.plies[0].bu, CULORI.rec, .6));
  }
  if (R.sel) tinte = new Chess(fen).moves({ square: R.sel, verbose: true }).map(m => ({ sq: m.to, cap: !!m.captured }));
  $("#tb").innerHTML = tablaSVG(fen, { flip: R.flip, arrows, hl, badge, sel: R.sel, tinte, ascunde: R.drag && R.drag.mutat ? R.drag.from : null });
  randeazaBara();
  deseneazaJucatori(fen);
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
  const mat = { w: {}, b: {} }, start = { p: 8, n: 2, b: 2, r: 2, q: 1 }, V = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  for (const ch of fen.split(" ")[0]) if (/[pnbrq]/i.test(ch)) { const c = ch === ch.toUpperCase() ? "w" : "b"; mat[c][ch.toLowerCase()] = (mat[c][ch.toLowerCase()] || 0) + 1; }
  const pct = c => Object.entries(mat[c]).reduce((s, [k, n]) => s + V[k] * n, 0);
  const capturate = c => { const o = c === "w" ? "b" : "w"; let s = "";
    for (const k of ["q", "r", "b", "n", "p"]) for (let i = 0; i < Math.max(0, start[k] - (mat[o][k] || 0)); i++) s += `<svg viewBox="0 0 45 45" width="16" height="16"><use href="#p-${o}${k.toUpperCase()}" width="45" height="45"/></svg>`;
    return s; };
  const bloc = c => {
    const j = c === "w" ? p.alb : p.negru, dif = pct(c) - pct(c === "w" ? "b" : "w"), k = ceas(c), laMutare = fen.split(" ")[1] === c;
    return `<span class="av ${c}">${esc((j.user || "?")[0].toUpperCase())}</span>
      <span class="jn"><b>${esc(j.user)}</b>${j.rating ? ` <span class="sub">(${j.rating})</span>` : ""}<span class="cap">${capturate(c)}${dif > 0 ? `<span class="dif">+${dif}</span>` : ""}</span></span>
      ${k != null ? `<span class="ceas ${laMutare ? "activ" : ""}">${mmss(k)}</span>` : ""}`;
  };
  const jos = R.flip ? "b" : "w";
  $("#j-jos").innerHTML = bloc(jos); $("#j-sus").innerHTML = bloc(jos === "w" ? "b" : "w");
}

function legaTabla() {
  const tb = $("#tb"), fant = $("#fantoma");
  tb.addEventListener("pointerdown", e => {
    if (!R || !R.rez || (R.retry && R.retry.stare === "corect")) return;
    if (R.retry && R.retry.stare === "gresit") return;
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
        randeazaCoach(); randeazaVarianta(); randeazaLista();
      }
    }
    if (!piesa || piesa.color !== ch.turn()) { R.sel = null; deseneazaTabla(); return; }
    e.preventDefault();
    tb.setPointerCapture(e.pointerId);
    const r = tb.getBoundingClientRect(), lat = r.width / 8;
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
  // mutarea din partidă: doar avansăm
  if (!R.exp && R.idx < N() && R.rez.plies[R.idx].u.slice(0, 4) === u.slice(0, 4)) { mergiLa(R.idx + 1, true); return; }
  // ai jucat cu mâna chiar mutarea din partidă, de pe poziția dinainte: revii pe linia partidei
  if (R.exp && R.exp.inLoc && !R.exp.moves.length && R.rez.plies[R.exp.baseIdx] && R.rez.plies[R.exp.baseIdx].u.slice(0, 4) === u.slice(0, 4)) { mergiLa(R.exp.baseIdx + 1, true); return; }
  // ai jucat cu mâna mutarea din variantă: mergem mai departe, iar răspunsul adversarului vine singur
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
// tu muți partea de jos a tablei; Stockfish răspunde singur pentru partea de sus, fără să mai apeși ›
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

// ───────── „Încearcă din nou” ─────────
function pornesteRetry() {
  const p = R.rez.plies[R.idx - 1];
  opresteAuto();
  R.retry = { p, fen: p.fenB, stare: "cauta", incercari: 0, hint: false, m: null, fenArata: null };
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
  } else {
    r.stare = "gresit"; r.incercari++; if (r.incercari >= 2) r.hint = true;
    r.fb = null;
    if (S.set.sunete) { sunetMutare(mv.san); setTimeout(sunetGresit, 150); }
  }
  actualizeaza();
}

// ───────── panoul „Analiză” (antrenorul, liniile motorului, lista de mutări) ─────────
function randeazaAnaliza() {
  $("#panou").className = "analiza";
  $("#panou").innerHTML = `
    <div class="antrenor mut" id="coach"></div>
    <div id="varianta"></div>
    <div class="linii" id="linii"></div>
    <div id="graf-w"></div>
    <div class="lista-m" id="lm"></div>`;
  randeazaCoach(); randeazaVarianta(); randeazaLinii(); randeazaGrafic(true); randeazaLista();
}
function butoane(lista) { return lista.length ? `<div class="act">${lista.join("")}</div>` : ""; }
function randeazaCoach() {
  const el = $("#coach"); if (!el || !R || !R.rez) return;
  const pl = R.rez.plies, desch = R.rez.deschidere;
  let cap = "", corp = "", act = [], vorbit = "";
  const urm = `<button class="btn glass verde urm" data-a="urm">Următoarea ${ico("next", 16)}</button>`;
  if (R.retry) {
    const r = R.retry, p = r.p, cine = p.cul === "w" ? "albul" : "negrul";
    if (r.stare === "cauta") {
      cap = `<b>Încearcă din nou</b>`;
      corp = `<p>Găsește o mutare mai bună pentru ${cine}. Mută o piesă pe tablă.${r.hint ? " Săgeata verde e indiciul." : ""}</p>`;
      act = [`<button class="btn glass" data-a="indiciu">Indiciu</button>`, `<button class="btn glass" data-a="best">Cea mai bună</button>`, `<button class="btn glass" data-a="renunta">Renunță</button>`];
      vorbit = `Găsește o mutare mai bună pentru ${cine}.`;
    } else if (r.stare === "corect") {
      cap = `${iconSVG("be", 24)}<b>Corect!</b>`;
      corp = `<p>${fig(r.m.s)} ${r.m.s === p.b ? "e cea mai bună mutare." : "e la fel de bună ca mutarea motorului, " + fig(p.b) + "."}</p>`;
      act = [`<button class="btn glass" data-a="arata-best">Arată continuarea</button>`, `<button class="btn glass verde" data-a="renunta">Continuă</button>`];
      vorbit = `Corect! ${sanVorbit(r.m.s)} e cea mai bună mutare.`;
    } else {
      if (!r.fb) { const f = feedback({ u: r.m.u, fenB: r.fen, fen: r.fenArata }); if (f) r.fb = f; }
      const f = r.fb;
      cap = f ? `${iconSVG(f.cl, 24)}<b>${fig(r.m.s)}</b><span class="kname k-${f.cl}">${A.NUME_CLASA[f.cl]}</span>` : `<b>${fig(r.m.s)}</b><span class="spin mic"></span>`;
      corp = `<p>${f ? `${fig(r.m.s)} nu e cea mai bună${f.cl === "be" || f.cl === "ex" ? ", dar e aproape" : ""}.` : "Verific mutarea…"} Mai încearcă.</p>`;
      act = [`<button class="btn glass primar" data-a="iar">Mai încearcă</button>`, `<button class="btn glass" data-a="best">Cea mai bună</button>`, `<button class="btn glass" data-a="renunta">Renunță</button>`];
      vorbit = f ? `${sanVorbit(r.m.s)} nu e cea mai bună. Mai încearcă.` : "";
    }
  } else if (R.exp) {
    const e = R.exp, m = e.i ? e.moves[e.i - 1] : null;
    const ev = evalPoz(pozCurenta());
    const evChip = ev ? `<span class="evs">${evFmt(evScurt(ev.ev))}</span>` : `<span class="spin mic"></span>`;
    if (!m) {
      cap = `<b>${esc(e.titlu)}</b>${evChip}`;
      corp = e.inLoc ? `<p>Poziția dinainte de ${fig(R.rez.plies[e.baseIdx].s)}. Mută tu altă piesă${R.rez.plies[e.baseIdx].bu && R.rez.plies[e.baseIdx].bu !== R.rez.plies[e.baseIdx].u ? " (săgeata verde e mutarea cea mai bună)" : ""} și vezi ce ar fi urmat.</p>`
        : `<p>Poziția de plecare a variantei. Apasă › ca s-o urmărești sau mută tu o piesă.</p>`;
    } else if (e.kind === "liber" && m.auto && e.i >= 2) {
      const tu = e.moves[e.i - 2], f = feedback(tu), nr = nrDin(tu.fenB);
      cap = f ? `${iconSVG(f.cl, 24)}<b>${nr} ${fig(tu.s)}</b><span class="kname k-${f.cl}">${A.NUME_CLASA[f.cl]}</span>${evChip}` : `<b>${nr} ${fig(tu.s)}</b>${evChip}`;
      corp = `<p>${f ? `${fig(tu.s)} ar fi ${numeArt(f.cl)}.${!f.eBest && f.bestS ? ` Cea mai bună era ${fig(f.bestS)}.` : ""} ` : ""}Adversarul răspunde ${fig(m.s)}. E rândul tău: mută pe tablă.</p>`;
      vorbit = f ? `${sanVorbit(tu.s)} ar fi ${numeArt(f.cl)}. Adversarul răspunde ${sanVorbit(m.s)}.` : "";
    } else if (e.kind === "liber") {
      const f = feedback(m), nr = nrDin(m.fenB);
      cap = f ? `${iconSVG(f.cl, 24)}<b>${nr} ${fig(m.s)}</b><span class="kname k-${f.cl}">${A.NUME_CLASA[f.cl]}</span>${evChip}` : `<b>${nr} ${fig(m.s)}</b>${evChip}`;
      corp = f ? `<p>${fig(m.s)} ar fi ${numeArt(f.cl)}.${!f.eBest && f.bestS ? ` Cea mai bună era ${fig(f.bestS)}.` : ""}${R.asteaptaRaspuns ? " Adversarul se gândește…" : ""}</p>` : `<p>Stockfish evaluează mutarea…${R.asteaptaRaspuns ? " Adversarul răspunde imediat." : ""}</p>`;
      vorbit = f ? `${sanVorbit(m.s)} ar fi ${numeArt(f.cl)}.` : "";
    } else {
      const nr = nrDin(m.fenB);
      cap = `<b>${esc(e.titlu)}</b>${evChip}`;
      corp = `<p>${nr} ${fig(m.s)} · pasul ${e.i} din ${e.moves.length}. ${e.kind === "best" ? "Așa continua cea mai bună variantă." : e.kind === "urmare" ? "Așa răspundea adversarul, cu cea mai bună continuare." : "Ideea din spatele mutării, după motor."}</p>`;
    }
    const top = ev && ev.best ? sanDin(pozCurenta(), ev.best) : null;
    if (top) act.push(`<button class="btn glass" data-a="raspuns">Joacă ${fig(top)}</button>`);
    act.push(`<button class="btn glass" data-a="iesi">Înapoi la partidă</button>`);
  } else if (R.idx === 0) {
    cap = `<span class="ant-av">${iconSVG("bk", 24)}</span><b>Începutul partidei</b>`;
    corp = `<p>${desch ? `Deschiderea: ${esc(desch)}. ` : ""}Apasă Următoarea ca să sari la momentele cheie, sau ›  ca să mergi mutare cu mutare. Poți muta oricând o piesă ca să vezi ce ar fi urmat.</p>`;
    act = [urm];
    vorbit = desch ? `Deschiderea: ${desch}.` : "";
  } else {
    const p = pl[R.idx - 1], eMea = p.cul === R.eu;
    cap = `${iconSVG(p.cl, 24)}<b>${nrMut(R.idx)} ${fig(p.s)}</b><span class="kname k-${p.cl}">${A.NUME_CLASA[p.cl] || ""}</span><span class="evs" title="Evaluarea motorului, din perspectiva albului">${evFmt(p.v)}</span>`;
    let text = A.comentariu(p, eMea, desch);
    corp = `<p>${figText(text)}</p>`;
    vorbit = text;
    if (R.idx === R.ultimaTeorie) {
      const st = statDeschidere(p.desch || desch);
      if (st) corp += `<p class="sub">Ai jucat ${esc(st.fam)} de ${st.n} ${st.n === 1 ? "dată" : "ori"}: ${st.v} victorii, ${st.r} remize, ${st.i} înfrângeri.</p>`;
    }
    if (p.amS && /[x+#]/.test(p.amS) && !ERR.includes(p.cl)) corp += `<p class="risc">Atenție: ${p.cul === R.eu ? "adversarul" : "tu"} poate juca ${fig(p.amS)}.</p>`;
    const cx = [];
    if (p.a != null && p.cl !== "bk") cx.push(`Precizie ${p.a}%`);
    if (S.set.timpMutare && p.t != null) cx.push(`Gândit ${String(p.t).replace(".", ",")} s`);
    if (p.k != null) cx.push(`Ceas ${mmss(p.k)}`);
    if (cx.length) corp += `<div class="ctx">${cx.map(c => `<span>${c}</span>`).join("")}</div>`;
    if (["mi", "bl"].includes(p.cl)) act.push(`<button class="btn glass" data-a="urmare">${ARATA[p.tip] || "Arată continuarea"}</button>`);
    if (p.cl === "ms") act.push(`<button class="btn glass" data-a="best">${ARATA[p.tip] || "Arată ideea"}</button>`);
    if (["br", "gr"].includes(p.cl)) act.push(`<button class="btn glass" data-a="idee">Arată ideea</button>`);
    if (p.bu && p.bu !== p.u && p.cl !== "bk" && p.cl !== "fo" && p.cl !== "ms") act.push(`<button class="btn glass" data-a="best">Cea mai bună</button>`);
    if (["in", "go", "ex"].includes(p.cl) && R.poz[R.idx] && R.poz[R.idx].pv.length) act.push(`<button class="btn glass" data-a="urmare">Arată continuarea</button>`);
    if (ERR.includes(p.cl) && p.bu && p.bu !== p.u) act.push(`<button class="btn glass primar" data-a="retry">Încearcă din nou</button>`);
    if (p.am && !ERR.includes(p.cl)) act.push(`<button class="btn glass" data-a="am" aria-pressed="${!!R.arataAm}">Amenințarea</button>`);
    if (R.idx === N()) act.push(`<button class="btn glass verde" data-a="ex10">${ico("play", 16)}10 exerciții din greșeli</button>`);
    else act.push(urm);
  }
  el.innerHTML = `<div class="ant-cap">${cap}</div>${corp}${butoane(act)}`;
  el.onclick = e => { const b = e.target.closest("[data-a]"); if (b) { deblocheaza(); actiune(b.dataset.a); } };
  if (S.set.voce && vorbit && vorbit !== R.ultimVorbit) { R.ultimVorbit = vorbit; vorbeste(vorbit); }
}
function actiune(a) {
  const pl = R.rez.plies, p = R.idx ? pl[R.idx - 1] : null;
  if (a === "urm") return urmatoareaCheie();
  if (a === "ex10") return sesiuneDinPartida(R.p);
  if (a === "iesi") return iesiExp();
  if (a === "renunta") { R.retry = null; return actualizeaza(); }
  if (a === "iar") { Object.assign(R.retry, { stare: "cauta", m: null, fenArata: null, fb: null }); return actualizeaza(); }
  if (a === "indiciu") { R.retry.hint = true; return actualizeaza(); }
  if (a === "retry") return pornesteRetry();
  if (a === "am") { R.arataAm = !R.arataAm; return actualizeaza(); }
  if (a === "arata-best") { const q = R.retry.p; R.retry = null; return pornesteExp(R.idx - 1, q.fenB, liniePv(q.fenB, R.poz[R.idx - 1].pv), "best", "Cea mai bună continuare"); }
  if (a === "best") {
    const q = R.retry ? R.retry.p : p; R.retry = null;
    return pornesteExp(R.idx - 1, q.fenB, liniePv(q.fenB, R.poz[R.idx - 1].pv), "best", q.cl === "ms" ? "Ce puteai câștiga" : "Cea mai bună continuare");
  }
  if (a === "idee") return pornesteExp(R.idx - 1, p.fenB, liniePv(p.fenB, R.poz[R.idx - 1].pv), "idee", "Ideea mutării");
  if (a === "urmare") return pornesteExp(R.idx, p.fen, liniePv(p.fen, R.poz[R.idx].pv), "urmare", `Ce urma după ${fig(p.s)}`);
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
function numeArt(cl) { return { be: "cea mai bună mutare", ex: "o mutare excelentă", go: "o mutare bună", in: "o inexactitate", mi: "o greșeală", bl: "o gafă" }[cl] || A.NUME_CLASA[cl]; }
function nrDin(fen) { const [, t, , , , n] = fen.split(" "); return t === "w" ? `${n}.` : `${n}…`; }
function statDeschidere(nume) {
  const fam = familie(nume); if (!fam) return null;
  const g = S.partide.filter(q => familie(numeDeschidere(q)) === fam);
  if (!g.length) return null;
  const st = { fam, n: g.length, v: 0, r: 0, i: 0 };
  g.forEach(q => { const c = rezultat(q)[0]; if (c === "castig") st.v++; else if (c === "pierdere") st.i++; else st.r++; });
  return st;
}
function randeazaVarianta() {
  const el = $("#varianta"); if (!el) return;
  if (!R.exp || !R.exp.moves.length) { el.innerHTML = ""; return; }
  const e = R.exp;
  el.innerHTML = `<div class="var glass-light"><span class="var-t">${esc(e.titlu)}</span><span class="var-m">${e.moves.map((m, k) => {
    const nr = m.fenB.split(" ")[1] === "w" ? nrDin(m.fenB) + " " : k === 0 ? nrDin(m.fenB) + " " : "";
    return `<button class="lm ${k === e.i - 1 ? "on" : ""}" data-v="${k + 1}">${nr}${fig(m.s)}</button>`; }).join("")}</span>
    <button class="btn glass mic" data-v="x">Închide</button></div>`;
  el.onclick = ev => { const b = ev.target.closest("[data-v]"); if (!b) return; if (b.dataset.v === "x") return iesiExp(); opresteAuto(); R.exp.i = +b.dataset.v; actualizeaza(); };
}
function randeazaLinii() {
  const el = $("#linii"); if (!el || !R || !R.rez) return;
  const fen = pozCurenta(), ev = evalPoz(fen), ch = new Chess(fen);
  if (ch.isGameOver()) { el.innerHTML = `<div class="ln-cap">Partida s-a încheiat în această poziție.</div>`; return; }
  if (!ev || !ev.linii || !ev.linii.length) { el.innerHTML = `<div class="ln-cap"><span class="spin mic"></span> Stockfish calculează…</div>`; return; }
  const live = R.live.get(fen);
  const calc = live && !live.final && (S.set.liveLinii || R.exp || R.retry);
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
      <span class="ic">${iconSVG(q.cl, 15)}</span><span class="sn">${fig(q.s)}</span>${S.set.timpMutare && q.t != null ? `<span class="tm">${Math.round(q.t)}s</span>` : ""}</button>` : `<span></span>`);
    lista.push(`<span class="mn">${i / 2 + 1}.</span>${cel(a, i + 1)}${cel(b, i + 2)}`);
  }
  el.innerHTML = `${R.rez.deschidere ? `<div class="lm-cap">${iconSVG("bk", 16)}<span>${esc(R.rez.deschidere)}</span></div>` : ""}<div class="lm-grid">${lista.join("")}</div>`;
  el.onclick = e => { const b = e.target.closest("[data-i]"); if (b) { opresteAuto(); mergiLa(+b.dataset.i, false); } };
  const on = $(".mm.on", el) || $(".mm.baza", el);
  if (on) el.scrollTop = on.offsetTop - el.clientHeight / 2;
}

// ───────── graficul evaluării ─────────
function randeazaGrafic(mic) {
  const w = $("#graf-w"); if (!w) return;
  const pl = R.rez.plies, n = pl.length || 1, W = 640, H = mic ? 90 : 120;
  const x = i => (W * i) / n, y = v => H * (1 - v / 100);
  const pts = [[0, A.winPct(R.poz[0].ev, "w")], ...pl.map((p, i) => [i + 1, p.wAlb])];
  const d = `M0,${H} ` + pts.map(([i, v]) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ") + ` L${W},${H} Z`;
  const cur = R.exp ? R.exp.baseIdx : R.retry ? R.idx - 1 : R.idx;
  let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="graf-svg" aria-label="Evaluarea pe parcursul partidei">
    <rect width="${W}" height="${H}" fill="var(--g-negru)"/><path d="${d}" fill="var(--g-alb)"/>
    <line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="var(--g-mij)" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  pl.forEach((p, i) => { if (CHEIE.includes(p.cl)) s += `<circle cx="${x(i + 1)}" cy="${y(p.wAlb)}" r="${mic ? 3.4 : 4.2}" fill="${CULORI[p.cl]}" stroke="var(--surface)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`; });
  s += `<line x1="${x(cur)}" x2="${x(cur)}" y1="0" y2="${H}" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  w.innerHTML = `<div class="graf ${mic ? "mic" : ""}" id="graf">${s}</div>`;
  const g = $("#graf");
  const at = e => { const r = g.getBoundingClientRect(); return Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * n); };
  g.onclick = e => { opresteAuto(); mergiLa(at(e), false); };
  g.onmousemove = e => { const i = at(e), p = pl[i - 1], r = g.getBoundingClientRect(); tip(i ? `${nrMut(i)} ${fig(p.s)} · ${A.NUME_CLASA[p.cl] || ""} · ${evFmt(p.v)}` : "Poziția de start", e.clientX, r.top); };
  g.onmouseleave = () => tip(null);
}

// ───────── REZUMAT ─────────
function iconFaza(r, ref) {
  if (r == null) return "";
  const d = r - (ref || r);
  return iconSVG(d >= 400 ? "be" : d >= 150 ? "ex" : d >= -150 ? "go" : d >= -400 ? "in" : d >= -700 ? "mi" : "bl", 22);
}
function randeazaRezumat() {
  const rz = R.rez, p = R.p;
  $("#panou").className = "";
  const W = A.cuRatinguri(rz.alb), B = A.cuRatinguri(rz.negru);
  const [cls, , rezT, motiv] = rezultat(p);
  const mele = rz.plies.filter(x => x.cul === R.eu), meu = R.eu === "w" ? W : B, al = R.eu === "w" ? B : W;
  const reusita = mele.find(x => x.cl === "br") || mele.find(x => x.cl === "gr");
  const gafa = [...mele].filter(x => ["bl", "mi", "ms"].includes(x.cl)).sort((a, b) => b.loss - a.loss)[0];
  const idx = q => rz.plies.indexOf(q) + 1;
  let txt = `Partidă ${rezT}${motiv ? ` (${motiv})` : ""}. Acuratețea ta: ${af(meu.acc)}%, a adversarului ${af(al.acc)}%.`;
  if (reusita) txt += ` Cea mai frumoasă mutare: ${nrMut(idx(reusita))} ${reusita.s}, ${A.NUME_CLASA[reusita.cl]}.`;
  if (gafa) txt += ` Momentul greu: ${nrMut(idx(gafa))} ${gafa.s}, unde mai bine era ${gafa.b}.`;
  const rand = (k, n) => `<div class="kr">
      <span class="kl">${n}</span>
      <button class="kn ${W.cnt[k] ? "" : "zero"}" data-cl="${k}" data-c="w" ${W.cnt[k] ? "" : "disabled"}>${W.cnt[k]}</button>
      <span class="ki">${iconSVG(k, 22)}</span>
      <button class="kn ${B.cnt[k] ? "" : "zero"}" data-cl="${k}" data-c="b" ${B.cnt[k] ? "" : "disabled"}>${B.cnt[k]}</button></div>`;
  $("#panou").innerHTML = `
    <div class="antrenor"><span class="ant-av" aria-hidden="true">${iconSVG(cls === "castig" ? "be" : cls === "pierdere" ? "in" : "go", 30)}</span><p>${figText(txt)}</p></div>
    <div id="graf-w"></div>
    <div class="tabel">
      <div class="kr cap"><span></span><span class="kp">${esc(p.alb.user)}</span><span></span><span class="kp">${esc(p.negru.user)}</span></div>
      <div class="kr acc"><span class="kl">Acuratețe</span><span class="box alb">${af(W.acc)}</span><span></span><span class="box negru">${af(B.acc)}</span></div>
      <div class="sepl"></div>
      ${A.CLASE.map(([k, n]) => rand(k, n)).join("")}
      <div class="sepl"></div>
      <div class="kr acc"><span class="kl">Evaluarea partidei</span><span class="box alb">${W.gRating ?? "—"}</span><span></span><span class="box negru">${B.gRating ?? "—"}</span></div>
    </div>
    <h3 class="sect">Statistici avansate</h3>
    <div class="tabel">
      ${ADV.map(([k, n]) => { const a = W.avansat[k], b = B.avansat[k];
        const cel = (v, r) => (v ? `<span class="avc" title="Acuratețe ${af(v.acc)}% în ${v.n} mutări">${iconFaza(v.r, r)}<b>${v.r}</b></span>` : `<span class="avc gol">—</span>`);
        return `<div class="kr adv"><span class="kl">${n}</span>${cel(a, p.alb.rating || W.gRating)}<span></span>${cel(b, p.negru.rating || B.gRating)}</div>`; }).join("")}
      <p class="nota">Cifra e ratingul estimat pentru partea respectivă a jocului. Iconița o compară cu ratingul jucătorului: verde peste, galben sau portocaliu sub.</p>
    </div>
    <button class="btn glass verde mare" id="b-start">Începe analiza</button>
    <button class="btn glass mare" id="b-ex10">${ico("play")}Exersează: 10 exerciții din greșelile partidei</button>
    <p class="nota centru">Stockfish 19, adâncime ${R.adancime || S.set.adancime}, calculat pe dispozitivul tău.</p>`;
  randeazaGrafic(false);
  $("#b-start").onclick = () => { deblocheaza(); mergiLa(R.ultimaTeorie || R.chei[0] || 1, false); };
  $("#b-ex10").onclick = () => { deblocheaza(); sesiuneDinPartida(R.p); };
  $$(".kn[data-cl]").forEach(b => (b.onclick = () => { const i = rz.plies.findIndex(x => x.cl === b.dataset.cl && x.cul === b.dataset.c); if (i >= 0) mergiLa(i + 1, false); }));
}

// ───────── vocea antrenorului ─────────
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
  const t = text.replace(/\b([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[+#]?|O-O(-O)?)\b/g, m => sanVorbit(m));
  const u = new SpeechSynthesisUtterance(t);
  u.lang = "ro-RO";
  const v = speechSynthesis.getVoices().find(x => x.lang && x.lang.toLowerCase().startsWith("ro"));
  if (v) u.voice = v;
  u.rate = 1.02;
  speechSynthesis.speak(u);
}
