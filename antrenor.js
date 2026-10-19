// antrenor.js — antrenorul: exerciții din greșelile tale, baza de exerciții (partidele tale + Lichess),
// lecții pe deschidere, mijloc și final, și finaluri jucate contra Stockfish.
import { Chess } from "./chess.js?v=32";
import * as A from "./analiza.js?v=32";
import { S, culoareaMea, rezultat, asiguraGreseli, incarcaExercitii, statEx, inregistreazaEx, evalMotor, numeDeschidere } from "./stare.js?v=32";
import { TablaUI } from "./tablaui.js?v=32";
import { iconSVG, sageata, CULORI, tablaSVG } from "./tabla.js?v=32";
import { LECTII, FINALURI, SECTIUNI, TEME_RO, TEME_LICHESS, TEME_DIN_TIP, FAZA_TEMA } from "./lectii.js?v=32";
import { sunetMutare, sunetCorect, sunetGresit } from "./sunete.js?v=32";
import { $, $$, esc, af, fig, figText, toast, ico, dataRo } from "./util.js?v=32";

let T = null;          // tabla interactivă a ecranului curent
let Q = null;          // sesiunea de exerciții în curs
let F = null;          // antrenamentul de final în curs
const temaRo = t => TEME_RO[t] || t;
const NIVEL = { usor: [0, 850], mediu: [800, 1150], greu: [1100, 9999] };

export function inchideAntrenor() { if (T) { T.distruge(); T = null; } if (F) F.oprit = true; }
const sus = () => scrollTo({ top: 0 });

function ratingInitial() {
  const st = statEx();
  if (!st.init && S.partide.length) {
    const p = [...S.partide].sort((a, b) => b.ts - a.ts)[0];
    if (p) st.rating = (culoareaMea(p) === "w" ? p.alb.rating : p.negru.rating) || st.rating;
    st.init = true;
  }
  return st;
}

// ───────── construirea seturilor de exerciții ─────────
function dinGreseala(p, g) {
  const adv = culoareaMea(p) === "w" ? p.negru : p.alb;
  const teme = [...(TEME_DIN_TIP[g.tip] || []), FAZA_TEMA[g.faza]].filter(Boolean);
  return { id: `g-${p.id}-${g.ply}`, sursa: "greseala", fen: g.ult ? g.fenPrev : g.fenB, ult: g.ult, sol: [g.bu], alt: g.alt || [],
    teme: [...new Set(teme)], r: Math.round(900 + Math.min(600, g.loss * 12)),
    info: { titlu: `Din partida cu ${adv.user}, ${dataRo(p.ts)}: ai jucat ${g.s}.`, pid: p.id, ply: g.ply, tip: g.tip } };
}
async function exercitiiPeTeme(teme, n, exclud = new Set()) {
  const toate = await incarcaExercitii(), st = ratingInitial();
  const vazute = new Set(st.vazute);
  const potr = toate.filter(e => !exclud.has(e.id) && (!teme || !teme.length || e.teme.some(t => teme.includes(t))));
  const scor = e => Math.abs(e.r - st.rating) + (vazute.has(e.id) ? 900 : 0) + Math.random() * 260;
  return potr.sort((a, b) => scor(a) - scor(b)).slice(0, n);
}
export async function sesiuneDinPartida(p) {
  const gr = (await asiguraGreseli(p)).filter(g => g.cl !== "in").slice(0, 6);
  const gr2 = gr.length < 3 ? (await asiguraGreseli(p)).filter(g => g.cl === "in").slice(0, 3 - gr.length) : [];
  const ex = [...gr, ...gr2].map(g => dinGreseala(p, g));
  const teme = [...new Set(ex.flatMap(e => e.teme))];
  const umplere = await exercitiiPeTeme(teme, 10 - ex.length, new Set(ex.map(e => e.id)));
  const lista = [...ex, ...umplere].slice(0, 10);
  if (!lista.length) { toast("Nu am găsit exerciții pentru partida asta."); return; }
  pornesteSesiune(lista, `10 exerciții din partida cu ${culoareaMea(p) === "w" ? p.negru.user : p.alb.user}`);
}
async function sesiuneRecomandata() {
  const an = S.partide.filter(p => p.sumar).sort((a, b) => b.ts - a.ts).slice(0, 12);
  const st = ratingInitial(), vazute = new Set(st.vazute);
  let gr = [];
  for (const p of an) for (const g of await asiguraGreseli(p)) if (g.cl !== "in") gr.push([p, g]);
  gr = gr.filter(([p, g]) => !vazute.has(`g-${p.id}-${g.ply}`)).sort((a, b) => b[1].loss - a[1].loss).slice(0, 4);
  const ex = gr.map(([p, g]) => dinGreseala(p, g));
  const slabe = temeSlabe().slice(0, 3).flatMap(x => TEME_DIN_TIP[x.tip] || []);
  const umplere = await exercitiiPeTeme(slabe.length ? slabe : null, 10 - ex.length, new Set(ex.map(e => e.id)));
  pornesteSesiune([...ex, ...umplere].slice(0, 10), "Antrenamentul recomandat");
}
const NUME_FAZA = { deschidere: "Deschidere", mijloc: "Mijlocul jocului", final: "Final" };
async function greseliRecente(n = 30) {
  const out = [];
  for (const p of S.partide.filter(p => p.sumar).sort((a, b) => b.ts - a.ts).slice(0, n)) for (const g of await asiguraGreseli(p)) out.push([p, g]);
  return out;
}
// 10 exerciții pe o fază a jocului: întâi pozițiile în care ai greșit tu în faza asta, apoi exerciții din aceeași fază
async function sesiuneFaza(faza) {
  const st = ratingInitial(), vazute = new Set(st.vazute);
  const gr = (await greseliRecente()).filter(([p, g]) => g.faza === faza && g.cl !== "in" && !vazute.has(`g-${p.id}-${g.ply}`))
    .sort((a, b) => b[1].loss - a[1].loss).slice(0, 5);
  const ex = gr.map(([p, g]) => dinGreseala(p, g));
  const umplere = await exercitiiPeTeme([FAZA_TEMA[faza]], 10 - ex.length, new Set(ex.map(e => e.id)));
  pornesteSesiune([...ex, ...umplere].slice(0, 10), `${NUME_FAZA[faza]} · 10 exerciții`);
}
function temeSlabe() {
  const c = {};
  for (const p of S.partide) for (const g of p.greseli || []) if (g.tip && g.cl !== "in") c[g.tip] = (c[g.tip] || 0) + 1;
  return Object.entries(c).map(([tip, n]) => ({ tip, n })).sort((a, b) => b.n - a.n);
}
async function lichess(tema, dif, n, progres) {
  const out = [];
  for (let k = 0; k < n; k++) {
    progres && progres(k, n);
    const r = await fetch(`https://lichess.org/api/puzzle/next?angle=${encodeURIComponent(tema || "mix")}&difficulty=${dif}`, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`Lichess a răspuns cu ${r.status}`);
    const d = await r.json();
    const ch = new Chess(), sans = d.game.pgn.trim().split(/\s+/);
    let ult = null, fen = ch.fen();
    sans.forEach((s, i) => { if (i === sans.length - 1) fen = ch.fen(); const m = ch.move(s); if (i === sans.length - 1) ult = m.from + m.to + (m.promotion || ""); });
    if (out.some(e => e.id === "l-" + d.puzzle.id)) { k--; continue; }
    out.push({ id: "l-" + d.puzzle.id, sursa: "lichess", fen, ult, sol: d.puzzle.solution, teme: d.puzzle.themes, r: d.puzzle.rating,
      info: { url: `https://lichess.org/training/${d.puzzle.id}` } });
  }
  return out;
}

// ───────── ecranul Antrenor ─────────
export async function randeazaAntrenor(el) {
  inchideAntrenor();
  const st = ratingInitial();
  const an = S.partide.filter(p => p.sumar).sort((a, b) => b.ts - a.ts);
  const ult = an[0];
  const recente = await greseliRecente();
  const peFaza = { deschidere: 0, mijloc: 0, final: 0 };
  recente.forEach(([, g]) => { if (g.cl !== "in" && peFaza[g.faza] != null) peFaza[g.faza]++; });
  const slabe = temeSlabe();
  const toate = await incarcaExercitii();
  const azi = st.zile[new Date().toISOString().slice(0, 10)] || 0;
  const NUME_TIP = A.TIPURI;
  el.innerHTML = `
    <section class="sumar">
      <div class="stat"><span class="l">Rating exerciții</span><span class="v">${st.rating}</span><span class="x">${st.n ? `${Math.round(st.ok / st.n * 100)}% rezolvate corect` : "începe cu antrenamentul recomandat"}</span></div>
      <div class="stat"><span class="l">Exerciții făcute</span><span class="v">${st.n}</span><span class="x">${azi} azi</span></div>
      <div class="stat"><span class="l">Baza de exerciții</span><span class="v">${toate.length}</span><span class="x">din partide reale, plus Lichess online</span></div>
    </section>
    <div class="carduri2">
      <div class="card-ant erou">
        <span class="eyebrow">Antrenamentul recomandat</span>
        <h2>10 exerciții pe punctele tale slabe</h2>
        <p>${slabe.length ? `Pozițiile în care ai greșit în ultimele partide, plus exerciții pe ${slabe.slice(0, 2).map(x => NUME_TIP[x.tip].toLowerCase()).join(" și ")}.` : "Analizează câteva partide ca antrenorul să-ți vadă greșelile. Până atunci primești exerciții pe nivelul tău."}</p>
        <button class="btn glass verde" id="b-rec">${ico("play")}Începe</button>
      </div>
      <div class="card-ant">
        <span class="eyebrow">Ultima partidă analizată</span>
        ${ult ? `<h3>vs ${esc(culoareaMea(ult) === "w" ? ult.negru.user : ult.alb.user)} · ${dataRo(ult.ts)}</h3>
          <p>${(ult.greseli || []).filter(g => g.cl !== "in").length || "Câteva"} poziții de reluat din partidă, completate cu exerciții pe aceleași teme.</p>
          <button class="btn glass primar" id="b-ult">${ico("play")}10 exerciții</button>` : `<p>Nicio partidă analizată încă. Deschide una din lista de partide.</p>`}
      </div>
    </div>
    <h3 class="zi fara-cap">Învață din greșeli, pe faze</h3>
    <div class="faze">${Object.entries(NUME_FAZA).map(([k, n]) => `<button class="faza" data-faza="${k}"><span class="eyebrow">${n}</span>
      <b>${peFaza[k]}</b><span class="sub">${peFaza[k] === 1 ? "greșeală" : "greșeli"} în ultimele partide analizate</span><span class="btn glass mic">10 exerciții</span></button>`).join("")}</div>
    ${slabe.length ? `<h3 class="zi fara-cap">Ce greșești cel mai des</h3>
      <div class="slabe">${slabe.slice(0, 6).map(x => `<button class="row slab" data-tip="${x.tip}"><span class="mid"><span class="t">${esc(NUME_TIP[x.tip])}</span>
        <span class="s">${x.n} ${x.n === 1 ? "greșeală" : "greșeli"} în partidele analizate · exersezi ${(TEME_DIN_TIP[x.tip] || []).map(temaRo).join(", ").toLowerCase()}</span></span>
        <span class="btn glass mic">10 exerciții</span></button>`).join("")}</div>` : ""}
    <h3 class="zi fara-cap">Lecții</h3>
    ${SECTIUNI.map(([k, n]) => `<div class="sect-l"><h4>${n}</h4><div class="lectii">${LECTII.filter(l => l.sect === k).map(l =>
      `<button class="lectie" data-l="${l.id}"><b>${esc(l.titlu)}</b><span>${l.teme.slice(0, 2).map(temaRo).join(" · ")}</span></button>`).join("")}</div></div>`).join("")}
    <h3 class="zi fara-cap">Finaluri contra Stockfish</h3>
    <div class="lectii">${FINALURI.map(f => `<button class="lectie fin" data-f="${f.id}"><b>${esc(f.titlu)}</b><span>${f.nivel} · ${f.eu === "w" ? "cu albul" : "cu negrul"} · ${f.tinta === "remiza" ? "ține remiza" : f.tinta === "mat" ? "dă mat" : "promovează"}</span>${S.set.finaluri && S.set.finaluri[f.id] ? `<span class="ok">✓ reușit</span>` : ""}</button>`).join("")}</div>
    ${Object.keys(st.teme).length ? `<h3 class="zi fara-cap">Progresul pe teme</h3><div class="tabel prog">${Object.entries(st.teme).filter(([t]) => !["oneMove", "short", "long", "veryLong"].includes(t))
      .sort((a, b) => b[1].n - a[1].n).slice(0, 14).map(([t, v]) => `<div class="pr"><span>${esc(temaRo(t))}</span><span class="trk"><span class="fil" style="width:${Math.round(v.ok / v.n * 100)}%"></span></span><span class="num">${v.ok}/${v.n}</span></div>`).join("")}</div>` : ""}`;
  $("#b-rec").onclick = () => sesiuneRecomandata();
  if (ult) $("#b-ult").onclick = () => sesiuneDinPartida(ult);
  $$("[data-faza]", el).forEach(b => (b.onclick = () => sesiuneFaza(b.dataset.faza)));
  $$(".slab", el).forEach(b => (b.onclick = async () => pornesteSesiune(await exercitiiPeTeme(TEME_DIN_TIP[b.dataset.tip], 10), A.TIPURI[b.dataset.tip])));
  $$("[data-l]", el).forEach(b => (b.onclick = () => { location.hash = "lectie-" + b.dataset.l; }));
  $$("[data-f]", el).forEach(b => (b.onclick = () => { location.hash = "final-" + b.dataset.f; }));
}

// ───────── ecranul Exerciții (baza de date) ─────────
let FX = { sursa: "partide", tema: "", nivel: "mediu", dif: "normal" };
export async function randeazaExercitii(el) {
  inchideAntrenor();
  const toate = await incarcaExercitii();
  const cnt = {};
  toate.forEach(e => e.teme.forEach(t => (cnt[t] = (cnt[t] || 0) + 1)));
  const temeOff = Object.entries(cnt).filter(([t, n]) => n >= 5 && !["oneMove", "short", "long", "veryLong", "advantage"].includes(t)).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const teme = FX.sursa === "lichess" ? TEME_LICHESS : temeOff;
  const [lo, hi] = NIVEL[FX.nivel];
  const disp = toate.filter(e => (!FX.tema || e.teme.includes(FX.tema)) && e.r >= lo && e.r <= hi).length;
  const st = ratingInitial();
  el.innerHTML = `
    <div class="ex-cap"><h2>Exerciții</h2><p class="sub">Rating-ul tău la exerciții: <b>${st.rating}</b></p></div>
    <div class="seg glass" id="ex-sursa"><button data-v="partide" aria-selected="${FX.sursa === "partide"}">Din partide reale · ${toate.length}</button><button data-v="lichess" aria-selected="${FX.sursa === "lichess"}">Lichess online</button></div>
    <p class="sub">${FX.sursa === "partide" ? "Poziții din partidele tale și ale adversarilor tăi, în care exista o singură mutare câștigătoare. Verificate cu Stockfish." : "Milioane de exerciții din baza publică Lichess, aduse pe loc. Ai nevoie de internet."}</p>
    <div class="chips wrap" id="ex-tema"><button class="chip" data-t="" aria-pressed="${!FX.tema}">Toate temele</button>${teme.map(t => `<button class="chip" data-t="${t}" aria-pressed="${FX.tema === t}">${esc(temaRo(t))}${FX.sursa === "partide" ? ` · ${cnt[t]}` : ""}</button>`).join("")}</div>
    ${FX.sursa === "partide" ? `<div class="seg glass" id="ex-nivel">${[["usor", "Ușor"], ["mediu", "Mediu"], ["greu", "Greu"]].map(([k, l]) => `<button data-v="${k}" aria-selected="${FX.nivel === k}">${l}</button>`).join("")}</div>`
      : `<div class="seg glass" id="ex-dif">${[["easiest", "Foarte ușor"], ["easier", "Ușor"], ["normal", "Normal"], ["harder", "Greu"], ["hardest", "Foarte greu"]].map(([k, l]) => `<button data-v="${k}" aria-selected="${FX.dif === k}">${l}</button>`).join("")}</div>`}
    <button class="btn glass verde mare" id="ex-start">${ico("play")}Începe 10 exerciții${FX.sursa === "partide" ? ` · ${disp} disponibile` : ""}</button>`;
  $("#ex-sursa").onclick = e => { const b = e.target.closest("[data-v]"); if (b) { FX.sursa = b.dataset.v; FX.tema = ""; randeazaExercitii(el); } };
  $("#ex-tema").onclick = e => { const b = e.target.closest("[data-t]"); if (b) { FX.tema = b.dataset.t; randeazaExercitii(el); } };
  const niv = $("#ex-nivel"); if (niv) niv.onclick = e => { const b = e.target.closest("[data-v]"); if (b) { FX.nivel = b.dataset.v; randeazaExercitii(el); } };
  const dif = $("#ex-dif"); if (dif) dif.onclick = e => { const b = e.target.closest("[data-v]"); if (b) { FX.dif = b.dataset.v; randeazaExercitii(el); } };
  $("#ex-start").onclick = async () => {
    const b = $("#ex-start");
    if (FX.sursa === "partide") {
      const vazute = new Set(st.vazute);
      const lista = toate.filter(e => (!FX.tema || e.teme.includes(FX.tema)) && e.r >= lo && e.r <= hi)
        .sort((x, y) => (vazute.has(x.id) - vazute.has(y.id)) || Math.random() - .5).slice(0, 10);
      if (!lista.length) return toast("Nu sunt exerciții pentru alegerea asta.");
      pornesteSesiune(lista, FX.tema ? temaRo(FX.tema) : "Exerciții din partide reale");
    } else {
      b.disabled = true;
      try { const lista = await lichess(FX.tema, FX.dif, 10, (k, n) => { b.innerHTML = `Aduc exercițiile de pe Lichess… ${k + 1}/${n}`; }); pornesteSesiune(lista, (FX.tema ? temaRo(FX.tema) : "Mix") + " · Lichess"); }
      catch (e) { toast(navigator.onLine ? "Lichess nu a răspuns. Încearcă din nou." : "Ești offline. Folosește exercițiile din partide reale."); b.disabled = false; randeazaExercitii(el); }
    }
  };
}

// ───────── sesiunea de exerciții ─────────
export function pornesteSesiune(lista, titlu) {
  Q = { lista, titlu, i: 0, rez: [], dRating: 0, ratingStart: ratingInitial().rating };
  if (location.hash === "#sesiune") randeazaSesiune($("#ecran-antrenor")); else location.hash = "sesiune";
}
export function randeazaSesiune(el) {
  inchideAntrenor();
  if (!Q) { location.hash = "antrenor"; return; }
  sus();
  el.innerHTML = `<div class="rv sesiune">
      <div class="rv-st"><div class="tabla-rand singur"><div id="tbx"></div></div></div>
      <aside class="rv-dr">
        <div class="rv-cap"><button class="btn glass icon" id="b-iesi" aria-label="Înapoi">${ico("back", 20)}</button>
          <div class="rv-titlu"><b>${esc(Q.titlu)}</b><span id="ex-prog"></span></div></div>
        <div class="puncte" id="puncte"></div>
        <div class="antrenor mut" id="ex-coach"></div>
      </aside></div>`;
  $("#b-iesi").onclick = () => { location.hash = "antrenor"; };
  T = new TablaUI($("#tbx"), { onMutare: m => mutareEx(m) });
  incarcaEx();
}
function puncte() {
  $("#puncte").innerHTML = Q.lista.map((e, k) => `<span class="pt ${Q.rez[k] === true ? "ok" : Q.rez[k] === false ? "nu" : k === Q.i ? "acum" : ""}"></span>`).join("");
  $("#ex-prog").textContent = Q.i < Q.lista.length ? `Exercițiul ${Q.i + 1} din ${Q.lista.length} · rating ${ratingInitial().rating}` : "Gata";
}
function incarcaEx() {
  if (Q.i >= Q.lista.length) return rezumatSesiune();
  const e = Q.lista[Q.i];
  const ch = new Chess(e.fen);
  const juc = e.ult ? (ch.turn() === "w" ? "b" : "w") : ch.turn();
  Object.assign(Q, { e, pas: 0, pos: e.fen, stare: "arata", erori: 0, hint: 0, ajutor: false, juc });
  T.set({ fen: e.fen, flip: juc === "b", arrows: [], hl: [], badge: null, interactiv: false, cine: juc });
  puncte(); coachEx();
  const start = () => { Q.stare = "muta"; T.set({ interactiv: true }); coachEx(); };
  if (e.ult) setTimeout(() => { if (!Q || Q.e !== e) return; aplica(e.ult, true); start(); }, 650);
  else start();
}
function aplica(u, sunet) {
  const ch = new Chess(Q.pos);
  const m = ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  Q.pos = ch.fen();
  T.set({ fen: Q.pos, hl: [{ sq: m.from, c: "#e8c547", o: .32 }, { sq: m.to, c: "#e8c547", o: .45 }], badge: null, arrows: [] });
  if (sunet && S.set.sunete) sunetMutare(m.san);
  return m;
}
function eCorecta(m) {
  const e = Q.e, asteptat = e.sol[Q.pas];
  if (m.u.slice(0, 4) === asteptat.slice(0, 4)) return true;
  if (Q.pas === 0 && (e.alt || []).some(a => a.slice(0, 4) === m.u.slice(0, 4))) return true;
  if (Q.pas === e.sol.length - 1 && new Chess(m.fen).isCheckmate()) return true; // orice mat e corect
  return false;
}
async function mutareEx(m) {
  if (!Q || Q.stare !== "muta") return;
  if (eCorecta(m)) {
    Q.pos = m.fen; Q.pas++;
    T.set({ fen: m.fen, hl: [{ sq: m.from, c: CULORI.be, o: .3 }, { sq: m.to, c: CULORI.be, o: .45 }], badge: { sq: m.to, cl: "be" }, arrows: [] });
    if (S.set.sunete) sunetMutare(m.san);
    if (Q.pas >= Q.e.sol.length) return rezolvat(true);
    Q.stare = "raspunde"; T.set({ interactiv: false }); coachEx("bine");
    setTimeout(() => { if (!Q || Q.stare !== "raspunde") return; aplica(Q.e.sol[Q.pas], true); Q.pas++; Q.stare = "muta"; T.set({ interactiv: true }); coachEx(); }, 550);
  } else {
    Q.erori++;
    if (Q.rez[Q.i] === undefined) Q.rez[Q.i] = false;
    T.set({ fen: m.fen, hl: [{ sq: m.from, c: CULORI.bl, o: .3 }, { sq: m.to, c: CULORI.bl, o: .45 }], badge: { sq: m.to, cl: "bl" }, interactiv: false });
    if (S.set.sunete) { sunetMutare(m.san); setTimeout(sunetGresit, 120); }
    Q.stare = "gresit"; coachEx("gresit");
    puncte();
    setTimeout(() => { if (!Q || Q.stare !== "gresit") return; T.set({ fen: Q.pos, hl: [], badge: null, interactiv: true }); Q.stare = "muta"; if (Q.erori >= 2 && !Q.hint) arataIndiciu(); coachEx(); }, 900);
  }
}
function arataIndiciu() {
  const u = Q.e.sol[Q.pas]; Q.hint++; Q.ajutor = true;
  if (Q.rez[Q.i] === undefined) Q.rez[Q.i] = false;
  if (Q.hint === 1) T.set({ hl: [{ sq: u.slice(0, 2), c: CULORI.rec, o: .55 }] });
  else T.set({ arrows: [sageata(u, CULORI.be, .8)] });
  coachEx(); puncte();
}
async function arataSolutia() {
  if (Q.rez[Q.i] === undefined) Q.rez[Q.i] = false;
  Q.stare = "solutie"; T.set({ interactiv: false });
  while (Q && Q.stare === "solutie" && Q.pas < Q.e.sol.length) { aplica(Q.e.sol[Q.pas], true); Q.pas++; await new Promise(r => setTimeout(r, 700)); }
  if (Q) rezolvat(false);
}
async function rezolvat(deUnul) {
  const ok = deUnul && Q.erori === 0 && !Q.ajutor;
  if (Q.rez[Q.i] === undefined) Q.rez[Q.i] = ok;
  Q.stare = "gata"; T.set({ interactiv: false });
  if (deUnul && S.set.sunete) setTimeout(sunetCorect, 150);
  const d = await inregistreazaEx(Q.e, Q.rez[Q.i]);
  Q.dRating += d; Q.ultimD = d;
  puncte(); coachEx();
}
function coachEx(moment) {
  const el = $("#ex-coach"); if (!el || !Q || !Q.e) return;
  const e = Q.e, cine = Q.juc === "w" ? "Albul" : "Negrul";
  let cap = "", corp = "", act = [];
  const sursa = e.sursa === "greseala" ? "Din greșelile tale" : e.sursa === "lichess" ? `Lichess · rating ${e.r}` : `Din partide reale · ≈${e.r}`;
  if (Q.stare === "arata") { cap = `<b>Pregătește-te</b>`; corp = `<p>${esc(cine)} va fi la mutare după răspunsul adversarului.</p>`; }
  else if (Q.stare === "gata") {
    const ok = Q.rez[Q.i];
    cap = `${iconSVG(ok ? "be" : "in", 24)}<b>${ok ? "Rezolvat!" : "Soluția"}</b>${Q.ultimD ? `<span class="evs ${Q.ultimD > 0 ? "plus" : "minus"}">${Q.ultimD > 0 ? "+" : ""}${Q.ultimD}</span>` : ""}`;
    corp = `<p>${ok ? "Ai găsit mutarea corectă din prima." : "Data viitoare o găsești. Uită-te la poziție înainte să treci mai departe."}</p>
      <p class="sub">Tema: ${e.teme.filter(t => !["oneMove", "short", "long", "veryLong"].includes(t)).map(temaRo).join(", ") || "tactică"}. ${e.info && e.info.titlu ? esc(e.info.titlu) : ""}</p>`;
    act.push(`<button class="btn glass verde" data-a="urm">${Q.i + 1 < Q.lista.length ? "Următorul" : "Vezi rezultatul"} ${ico("next", 16)}</button>`);
    if (e.sursa === "greseala") act.push(`<button class="btn glass" data-a="partida">Vezi în partidă</button>`);
    else if (e.info && e.info.url) act.push(`<a class="btn glass" href="${esc(e.info.url)}" target="_blank" rel="noopener">Partida originală ↗</a>`);
  } else {
    cap = moment === "gresit" ? `${iconSVG("bl", 24)}<b>Nu e asta</b>` : moment === "bine" ? `${iconSVG("be", 24)}<b>Corect, continuă</b>` : `<span class="lamut ${Q.juc}"></span><b>${cine} la mutare</b>`;
    corp = `<p>${moment === "gresit" ? "Mutarea nu rezolvă poziția. Mai încearcă." : e.sursa === "greseala" ? `Ai greșit aici în partidă. Găsește cea mai bună mutare.` : e.sol.length > 1 ? "Găsește cea mai bună continuare. Exercițiul are mai multe mutări." : "Găsește cea mai bună mutare."}</p>
      <p class="sub">${esc(sursa)}${Q.hint ? " · indiciu folosit" : ""}</p>`;
    act.push(`<button class="btn glass" data-a="indiciu">${Q.hint ? "Arată mutarea" : "Indiciu"}</button>`, `<button class="btn glass" data-a="solutie">Soluția</button>`, `<button class="btn glass" data-a="sari">Sari peste</button>`);
  }
  el.innerHTML = `<div class="ant-cap">${cap}</div>${corp}${act.length ? `<div class="act">${act.join("")}</div>` : ""}`;
  el.onclick = ev => {
    const b = ev.target.closest("[data-a]"); if (!b) return;
    const a = b.dataset.a;
    if (a === "urm") { Q.i++; incarcaEx(); }
    if (a === "indiciu" && Q.stare === "muta") arataIndiciu();
    if (a === "solutie" && Q.stare === "muta") arataSolutia();
    if (a === "sari") { if (Q.rez[Q.i] === undefined) Q.rez[Q.i] = false; Q.i++; incarcaEx(); }
    if (a === "partida") location.hash = "p-" + e.info.pid;
  };
}
function rezumatSesiune() {
  const ok = Q.rez.filter(x => x === true).length, n = Q.lista.length;
  const st = ratingInitial();
  $("#ex-prog").textContent = "Gata";
  puncte();
  T.set({ interactiv: false });
  const teme = {};
  Q.lista.forEach((e, k) => { if (Q.rez[k] === false) e.teme.forEach(t => { if (!["oneMove", "short", "long", "veryLong", "middlegame", "opening", "endgame", "advantage", "crushing"].includes(t)) teme[t] = (teme[t] || 0) + 1; }); });
  const de = Object.entries(teme).sort((a, b) => b[1] - a[1]).slice(0, 3);
  $("#ex-coach").innerHTML = `<div class="ant-cap">${iconSVG(ok >= n * .7 ? "be" : ok >= n * .4 ? "go" : "in", 24)}<b>${ok} din ${n} rezolvate din prima</b></div>
    <p>Rating-ul la exerciții: ${Q.ratingStart} → <b>${st.rating}</b> (${Q.dRating >= 0 ? "+" : ""}${Q.dRating}).</p>
    ${de.length ? `<p class="sub">De lucrat: ${de.map(([t]) => temaRo(t)).join(", ")}.</p>` : `<p class="sub">Fără teme cu probleme în setul ăsta.</p>`}
    <div class="act"><button class="btn glass verde" data-a="iar">${ico("play")}Încă 10${de.length ? " pe temele grele" : ""}</button><button class="btn glass" data-a="ant">Înapoi la antrenor</button></div>`;
  $("#ex-coach").onclick = async ev => {
    const b = ev.target.closest("[data-a]"); if (!b) return;
    if (b.dataset.a === "ant") location.hash = "antrenor";
    if (b.dataset.a === "iar") pornesteSesiune(await exercitiiPeTeme(de.length ? de.map(x => x[0]) : null, 10), de.length ? "Temele grele" : "Încă 10 exerciții");
  };
}

// ───────── lecții ─────────
export async function randeazaLectie(el, id) {
  inchideAntrenor();
  const l = LECTII.find(x => x.id === id); if (!l) { location.hash = "antrenor"; return; }
  sus();
  const ex = (await incarcaExercitii()).filter(e => e.teme.some(t => l.teme.includes(t)) && e.r <= ratingInitial().rating + 300);
  const exemplu = ex.sort((a, b) => a.r - b.r)[Math.min(ex.length - 1, Math.floor(Math.random() * Math.min(12, ex.length)))];
  const fin = l.final && FINALURI.find(f => f.id === l.final);
  let fenEx = null, flip = false;
  if (exemplu) { const ch = new Chess(exemplu.fen); ch.move({ from: exemplu.ult.slice(0, 2), to: exemplu.ult.slice(2, 4), promotion: exemplu.ult[4] }); fenEx = ch.fen(); flip = ch.turn() === "b"; }
  el.innerHTML = `<article class="lectie-p">
    <button class="btn glass" id="b-inapoi-l">${ico("back", 18)}Antrenor</button>
    <span class="eyebrow">${esc(SECTIUNI.find(s => s[0] === l.sect)[1])}</span>
    <h2>${esc(l.titlu)}</h2>
    ${l.text.map(p => `<p>${figText(p)}</p>`).join("")}
    ${fenEx ? `<figure class="diag"><div class="tabla mica">${tablaSVG(fenEx, { flip })}</div><figcaption>Exemplu din partide reale: ${flip ? "negrul" : "albul"} la mutare. Găsești mutarea?</figcaption></figure>` : ""}
    <div class="act">
      ${exemplu ? `<button class="btn glass primar" id="b-ex1">Rezolvă exemplul</button>` : ""}
      <button class="btn glass verde" id="b-ex10">${ico("play")}Exersează tema · 10</button>
      ${fin ? `<button class="btn glass" id="b-fin">Joacă finalul: ${esc(fin.titlu)}</button>` : ""}
    </div></article>`;
  $("#b-inapoi-l").onclick = () => { location.hash = "antrenor"; };
  if (exemplu) $("#b-ex1").onclick = () => pornesteSesiune([exemplu], l.titlu);
  $("#b-ex10").onclick = async () => pornesteSesiune(await exercitiiPeTeme(l.teme, 10), l.titlu);
  if (fin) $("#b-fin").onclick = () => { location.hash = "final-" + fin.id; };
}

// ───────── finaluri contra Stockfish ─────────
export function randeazaFinal(el, id) {
  inchideAntrenor();
  const f = FINALURI.find(x => x.id === id); if (!f) { location.hash = "antrenor"; return; }
  sus();
  el.innerHTML = `<div class="rv sesiune">
      <div class="rv-st"><div class="tabla-rand singur"><div id="tbf"></div></div></div>
      <aside class="rv-dr">
        <div class="rv-cap"><button class="btn glass icon" id="b-iesi" aria-label="Înapoi">${ico("back", 20)}</button>
          <div class="rv-titlu"><b>${esc(f.titlu)}</b><span>${f.nivel} · contra Stockfish</span></div></div>
        <div class="antrenor mut" id="fin-coach"></div>
      </aside></div>`;
  $("#b-iesi").onclick = () => { location.hash = "antrenor"; };
  T = new TablaUI($("#tbf"), { onMutare: m => mutareFinal(m) });
  startFinal(f);
}
function startFinal(f) {
  F = { f, pos: f.fen, mut: 0, stare: "", oprit: false, istoric: [] };
  T.set({ fen: f.fen, flip: f.eu === "b", hl: [], arrows: [], badge: null, cine: f.eu, interactiv: false });
  if (new Chess(f.fen).turn() !== f.eu) raspunsMotor(); else { F.stare = "muta"; T.set({ interactiv: true }); }
  coachFinal();
}
function wEu(ev, eu) { return A.winPct(ev, eu); }
async function mutareFinal(m) {
  if (!F || F.stare !== "muta") return;
  F.pos = m.fen; F.mut++; F.istoric.push(m.san);
  T.set({ fen: m.fen, hl: [{ sq: m.from, c: "#e8c547", o: .32 }, { sq: m.to, c: "#e8c547", o: .45 }], arrows: [], interactiv: false });
  if (S.set.sunete) sunetMutare(m.san);
  const ch = new Chess(m.fen), f = F.f;
  if (ch.isCheckmate()) return gataFinal(true, "Mat! Ai rezolvat antrenamentul.");
  if (ch.isDraw() || ch.isStalemate()) return gataFinal(f.tinta === "remiza", ch.isStalemate() ? "Pat: partida e remiză." : "Remiză.");
  if (f.tinta === "promovare" && m.promotion) {
    const r = await evalMotor(m.fen, 14); if (!F || F.oprit) return;
    if (r.linii.length && wEu(r.linii[0].ev, f.eu) >= 80) return gataFinal(true, "Ai promovat pionul și poziția e câștigată.");
  }
  if (f.tinta === "remiza" && F.mut >= f.maxMut) return gataFinal(true, `Ai ținut ${f.maxMut} de mutări fără să pierzi. Remiză!`);
  if (f.tinta !== "remiza" && F.mut >= f.maxMut) return gataFinal(false, `Ai depășit ${f.maxMut} de mutări. Încearcă un drum mai scurt.`);
  raspunsMotor();
}
async function raspunsMotor() {
  F.stare = "motor"; coachFinal();
  const f = F.f, pos = F.pos;
  const r = await evalMotor(pos, 14);
  if (!F || F.oprit || F.pos !== pos) return;
  const l = r.linii[0];
  if (!l || !l.pv.length) return;
  const ch = new Chess(pos), m = ch.move({ from: l.pv[0].slice(0, 2), to: l.pv[0].slice(2, 4), promotion: l.pv[0][4] });
  F.pos = ch.fen(); F.istoric.push(m.san);
  T.set({ fen: F.pos, hl: [{ sq: m.from, c: "#e8c547", o: .32 }, { sq: m.to, c: "#e8c547", o: .45 }] });
  if (S.set.sunete) sunetMutare(m.san);
  if (ch.isCheckmate()) return gataFinal(false, "Ai primit mat.");
  if (ch.isDraw() || ch.isStalemate()) return gataFinal(f.tinta === "remiza", "Remiză.");
  // verificăm dacă poziția s-a stricat
  const r2 = await evalMotor(F.pos, 12); if (!F || F.oprit) return;
  const w = r2.linii.length ? wEu(r2.linii[0].ev, f.eu) : 50;
  F.ultimW = w; F.best = r2.linii.length ? r2.linii[0].pv[0] : null;
  if (f.tinta !== "remiza" && w < 60) return gataFinal(false, "Avantajul s-a pierdut: poziția nu mai e câștigată. Ia-o de la capăt.");
  if (f.tinta === "remiza" && w < 15) return gataFinal(false, "Poziția a devenit pierdută. Ia-o de la capăt.");
  F.stare = "muta"; T.set({ interactiv: true }); coachFinal();
}
async function gataFinal(ok, text) {
  F.stare = "gata"; F.ok = ok; F.text = text; T.set({ interactiv: false });
  if (S.set.sunete) setTimeout(ok ? sunetCorect : sunetGresit, 120);
  if (ok) { S.set.finaluri = { ...(S.set.finaluri || {}), [F.f.id]: true }; const { salveazaSetari } = await import("./date.js?v=32"); salveazaSetari(S.set); }
  coachFinal();
}
function coachFinal() {
  const el = $("#fin-coach"); if (!el || !F) return;
  const f = F.f;
  let cap, corp = `<p>${esc(f.text)}</p>`, act = [];
  if (F.stare === "gata") { cap = `${iconSVG(F.ok ? "be" : "bl", 24)}<b>${F.ok ? "Reușit!" : "Nereușit"}</b>`; corp += `<p><b>${esc(F.text)}</b></p>`; act.push(`<button class="btn glass verde" data-a="iar">Ia de la capăt</button>`); }
  else if (F.stare === "motor") cap = `<span class="spin mic"></span><b>Stockfish se gândește…</b>`;
  else { cap = `<span class="lamut ${f.eu}"></span><b>Mutarea ta</b>`; act.push(`<button class="btn glass" data-a="indiciu">Indiciu</button>`, `<button class="btn glass" data-a="iar">Ia de la capăt</button>`); }
  const tinta = f.tinta === "mat" ? `Dă mat în cel mult ${f.maxMut} de mutări.` : f.tinta === "promovare" ? "Promovează pionul păstrând câștigul." : `Ține remiza ${f.maxMut} de mutări.`;
  el.innerHTML = `<div class="ant-cap">${cap}</div>${corp}<div class="ctx"><span>${tinta}</span><span>Mutări: ${F.mut}${f.tinta !== "remiza" ? ` / ${f.maxMut}` : ` / ${f.maxMut}`}</span></div>
    ${F.istoric.length ? `<p class="sub linie-fin">${F.istoric.map(fig).join(" ")}</p>` : ""}${act.length ? `<div class="act">${act.join("")}</div>` : ""}`;
  el.onclick = async ev => {
    const b = ev.target.closest("[data-a]"); if (!b) return;
    if (b.dataset.a === "iar") { F.oprit = true; startFinal(f); }
    if (b.dataset.a === "indiciu" && F.stare === "muta") {
      const r = await evalMotor(F.pos, 14); if (!F || F.stare !== "muta") return;
      if (r.linii.length) T.set({ arrows: [sageata(r.linii[0].pv[0], CULORI.be, .8)] });
    }
  };
}

// pentru testele automate
export const _test = () => ({ Q, F });
