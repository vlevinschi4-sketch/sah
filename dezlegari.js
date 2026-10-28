// dezlegari.js — exercițiile (puzzle-uri), ca pe Chess.com: sesiuni pe nivelul tău care nu se repetă,
// Puzzle Rush (3 minute, 3 greșeli), puzzle-ul zilei, teme, exercițiile din partidele tale cu repetiție spațiată
// și exerciții Lichess online. Mentorul explică soluția după fiecare exercițiu.
import { Chess } from "./chess.js?v=40";
import * as A from "./analiza.js?v=40";
import * as M from "./mentor.js?v=40";
import { S, culoareaMea, asiguraGreseli, incarcaExercitii, statEx, inregistreazaEx, vazute, exercitiiDeRecapitulat, adversar, activitate } from "./stare.js?v=40";
import { salveazaSetari } from "./date.js?v=40";
import { TablaUI } from "./tablaui.js?v=40";
import { iconSVG, sageata, CULORI, ultima } from "./tabla.js?v=40";
import { cadruJoc, bula, miniTabla, capPagina, stareNav } from "./cadru.js?v=40";
import { TEME_RO, TEME_LICHESS, TEME_DIN_TIP, FAZA_TEMA } from "./lectii.js?v=40";
import { sunetMutare, sunetCorect, sunetGresit, deblocheaza } from "./sunete.js?v=40";
import { $, $$, esc, fig, toast, ico, iu, dataRo, ziKey, hash, plural, mmss } from "./util.js?v=40";

const temaRo = t => TEME_RO[t] || t;
const ASCUNSE = new Set(["oneMove", "short", "long", "veryLong", "advantage", "crushing", "middlegame", "opening", "endgame", "master", "masterVsMaster", "superGM"]);
let T = null, Q = null, RU = null;
const curata = () => { if (T) { T.distruge(); T = null; } removeEventListener("keydown", tastaEx); if (RU && RU.timer) clearInterval(RU.timer); };

// ───────── alegerea exercițiilor: întâi cele nevăzute, cât mai aproape de ratingul tău ─────────
function amesteca(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export async function alege(n, { teme = null, tinta = null, exclud = new Set(), latime = 150 } = {}) {
  const toate = await incarcaExercitii(), st = statEx(), vz = vazute();
  const t0 = tinta ?? st.rating;
  const potr = toate.filter(e => !exclud.has(e.id) && (!teme || !teme.length || e.teme.some(t => teme.includes(t))));
  const noi = potr.filter(e => !vz.has(e.id));
  let ales = [];
  for (const w of [latime, latime * 2, 450, 800, 99999]) {
    ales = noi.filter(e => Math.abs(e.r - t0) <= w);
    if (ales.length >= n) break;
  }
  ales = amesteca(ales).slice(0, n).sort((a, b) => a.r - b.r);
  if (ales.length < n) { // toate exercițiile din categorie au fost văzute: reluăm din cele mai vechi
    const idx = new Map(st.vazute.map((id, i) => [id, i]));
    const vechi = potr.filter(e => vz.has(e.id) && !ales.includes(e)).sort((a, b) => (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0));
    ales.push(...vechi.slice(0, n - ales.length).map(e => ({ ...e, repetat: true })));
  }
  return ales;
}
export async function disponibile(teme) {
  const toate = await incarcaExercitii(), vz = vazute();
  const p = toate.filter(e => !teme || e.teme.some(t => teme.includes(t)));
  return { total: p.length, noi: p.filter(e => !vz.has(e.id)).length };
}
function dinGreseala(p, g) {
  const adv = adversar(p);
  const teme = [...(TEME_DIN_TIP[g.tip] || []), FAZA_TEMA[g.faza]].filter(Boolean);
  return { id: `g-${p.id}-${g.ply}`, sursa: "greseala", fen: g.ult ? g.fenPrev : g.fenB, ult: g.ult, sol: [g.bu], alt: g.alt || [],
    teme: [...new Set(teme)], r: Math.round(900 + Math.min(600, g.loss * 12)),
    info: { titlu: `Din partida cu ${adv.user}, ${dataRo(p.ts)}: ai jucat ${g.s}.`, pid: p.id, ply: g.ply, tip: g.tip } };
}
async function greseliRecente(n = 40) {
  const out = [];
  for (const p of S.partide.filter(p => p.sumar).sort((a, b) => b.ts - a.ts).slice(0, n)) for (const g of await asiguraGreseli(p)) if (g.cl !== "in") out.push([p, g]);
  return out;
}
export async function sesiuneDinPartida(p) {
  const toate = await asiguraGreseli(p);
  const gr = toate.filter(g => g.cl !== "in").slice(0, 6);
  const gr2 = gr.length < 3 ? toate.filter(g => g.cl === "in").slice(0, 3 - gr.length) : [];
  const ex = [...gr, ...gr2].map(g => dinGreseala(p, g));
  const teme = [...new Set(ex.flatMap(e => e.teme))].filter(t => !ASCUNSE.has(t));
  const umplere = await alege(10 - ex.length, { teme: teme.length ? teme : null, exclud: new Set(ex.map(e => e.id)) });
  const lista = [...ex, ...umplere].slice(0, 10);
  if (!lista.length) { toast("Nu am găsit exerciții pentru partida asta."); return; }
  pornesteSesiune(lista, `Din partida cu ${adversar(p).user}`);
}
export async function sesiunePeTeme(teme, titlu) {
  const lista = await alege(10, { teme });
  if (!lista.length) return toast("Nu sunt exerciții pe tema asta.");
  pornesteSesiune(lista, titlu || teme.map(temaRo).join(", "));
}
const NUME_FAZA = { deschidere: "Deschidere", mijloc: "Mijlocul jocului", final: "Final" };
export async function sesiuneFaza(faza) {
  const vz = vazute();
  const gr = (await greseliRecente()).filter(([p, g]) => g.faza === faza && !vz.has(`g-${p.id}-${g.ply}`)).sort((a, b) => b[1].loss - a[1].loss).slice(0, 5);
  const ex = gr.map(([p, g]) => dinGreseala(p, g));
  const umplere = await alege(10 - ex.length, { teme: [FAZA_TEMA[faza]], exclud: new Set(ex.map(e => e.id)) });
  pornesteSesiune([...ex, ...umplere].slice(0, 10), `${NUME_FAZA[faza]} · 10 exerciții`);
}
// „Învață din greșeli”: întâi exercițiile greșite care trebuie repetate azi, apoi greșelile noi din partide, apoi teme slabe
export async function sesiuneGreseli() {
  const toate = await incarcaExercitii(), dupaId = new Map(toate.map(e => [e.id, e]));
  const vz = vazute(), due = exercitiiDeRecapitulat();
  const rec = [];
  const recente = await greseliRecente();
  const dinPartide = new Map(recente.map(([p, g]) => [`g-${p.id}-${g.ply}`, [p, g]]));
  for (const id of due) { if (dupaId.has(id)) rec.push({ ...dupaId.get(id), repetare: true }); else if (dinPartide.has(id)) rec.push({ ...dinGreseala(...dinPartide.get(id)), repetare: true }); }
  const noi = recente.filter(([p, g]) => !vz.has(`g-${p.id}-${g.ply}`)).sort((a, b) => b[1].loss - a[1].loss).slice(0, Math.max(0, 6 - rec.length)).map(([p, g]) => dinGreseala(p, g));
  const lista = [...rec.slice(0, 6), ...noi];
  const slabe = temeSlabe().slice(0, 3).flatMap(x => TEME_DIN_TIP[x.tip] || []);
  const umplere = await alege(10 - lista.length, { teme: slabe.length ? slabe : null, exclud: new Set(lista.map(e => e.id)) });
  const tot = [...lista, ...umplere].slice(0, 10);
  if (!tot.length) return toast("Analizează câteva partide ca să găsesc greșelile tale.");
  pornesteSesiune(tot, "Învață din greșeli");
}
export function temeSlabe() {
  const c = {};
  for (const p of S.partide) for (const g of p.greseli || []) if (g.tip && g.cl !== "in") c[g.tip] = (c[g.tip] || 0) + 1;
  return Object.entries(c).map(([tip, n]) => ({ tip, n })).sort((a, b) => b.n - a.n);
}
async function lichess(tema, dif, n, progres) {
  const out = [], vz = vazute();
  let incercari = 0;
  while (out.length < n && incercari < n * 3) {
    incercari++;
    progres && progres(out.length, n);
    const r = await fetch(`https://lichess.org/api/puzzle/next?angle=${encodeURIComponent(tema || "mix")}&difficulty=${dif}`, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`Lichess a răspuns cu ${r.status}`);
    const d = await r.json();
    const id = "l-" + d.puzzle.id;
    if (out.some(e => e.id === id) || vz.has(id)) continue; // fără repetări
    const ch = new Chess(), sans = d.game.pgn.trim().split(/\s+/);
    let ult = null, fen = ch.fen();
    sans.forEach((s, i) => { if (i === sans.length - 1) fen = ch.fen(); const m = ch.move(s); if (i === sans.length - 1) ult = m.from + m.to + (m.promotion || ""); });
    out.push({ id, sursa: "lichess", fen, ult, sol: d.puzzle.solution, teme: d.puzzle.themes, r: d.puzzle.rating, info: { url: `https://lichess.org/training/${d.puzzle.id}` } });
  }
  return out;
}

// pozițiile de afișat pe carduri: după mutarea adversarului, cu tabla întoarsă spre cine mută
function previzualizare(e) {
  const ch = new Chess(e.fen);
  if (e.ult) A.incearca(ch, e.ult);
  return { fenArata: ch.fen(), flip: ch.turn() === "b", hl: e.ult ? ultima(e.ult) : [] };
}
// ───────── puzzle-ul zilei: același toată ziua, aproape de ratingul tău ─────────
export async function exercitiulZilei() {
  const toate = await incarcaExercitii(); if (!toate.length) return null;
  const st = statEx(), zi = ziKey();
  let id = st.zilnic[zi] && st.zilnic[zi].id;
  let ex = id && toate.find(e => e.id === id);
  if (!ex) {
    const vz = vazute(), r = st.rating;
    const c = toate.filter(e => !vz.has(e.id) && e.sol.length >= 3 && Math.abs(e.r - (r + 100)) <= 200);
    const pool = c.length ? c : toate.filter(e => !vz.has(e.id));
    ex = pool[hash(zi + S.set.user) % pool.length];
    st.zilnic[zi] = { id: ex.id, ok: null };
    salveazaSetari(S.set);
  }
  const urm = (await alege(1, { exclud: new Set([ex.id]) }))[0];
  const titlu = ex.teme.filter(t => !ASCUNSE.has(t)).slice(0, 2).map(temaRo).join(" · ") || "Tactică";
  return { ex, ...previzualizare(ex), titlu, rezolvat: st.zilnic[zi].ok != null, urm: urm ? { ...previzualizare(urm) } : null };
}
export async function pornesteZilnic() {
  const z = await exercitiulZilei(); if (!z) return;
  pornesteSesiune([z.ex], "Puzzle-ul zilei", { zilnic: true });
}

// ───────── ecranul Dezlegări ─────────
let FX = { tema: "", nivel: "eu", dif: "normal", sursa: "partide" };
export async function hub(el) {
  const st = statEx(), toate = await incarcaExercitii(), vz = vazute();
  const azi = st.zile[ziKey()] || 0, due = exercitiiDeRecapitulat().length;
  const recente = (await greseliRecente(15)).filter(([p, g]) => !vz.has(`g-${p.id}-${g.ply}`)).length;
  const cnt = {};
  toate.forEach(e => e.teme.forEach(t => { if (!ASCUNSE.has(t)) (cnt[t] = cnt[t] || [0, 0])[0]++; if (!vz.has(e.id) && !ASCUNSE.has(t)) cnt[t][1]++; }));
  const teme = Object.entries(cnt).filter(([, [n]]) => n >= 8).sort((a, b) => b[1][0] - a[1][0]).map(([t]) => t);
  const z = await exercitiulZilei().catch(() => null);
  const noiTot = toate.filter(e => !vz.has(e.id)).length;
  const temeProg = Object.entries(st.teme).filter(([t, v]) => !ASCUNSE.has(t) && v.n >= 3).sort((a, b) => b[1].n - a[1].n).slice(0, 10);
  el.innerHTML = `${capPagina("dezlegari", "Dezlegări", `<span class="eticheta auriu" style="font-size:14px;padding:5px 10px">Rating ${st.rating}</span>`)}
    <div class="st-grid" style="margin-bottom:16px">
      <div class="st-tile"><span class="l">Rating dezlegări</span><span class="v">${st.rating}</span><span class="x">${st.n ? `${Math.round(st.ok / st.n * 100)}% din prima` : "începe acum"}</span></div>
      <div class="st-tile"><span class="l">Rezolvate</span><span class="v">${st.n}</span><span class="x">${azi} azi</span></div>
      <div class="st-tile"><span class="l">Exerciții noi</span><span class="v">${noiTot}</span><span class="x">din ${toate.length} din partide reale</span></div>
      <div class="st-tile"><span class="l">Puzzle Rush</span><span class="v">${st.rush.best}</span><span class="x">cel mai bun scor</span></div>
    </div>
    <div class="dz-grid">
      <button class="mod" id="m-rating"><h3>${iu("dezlegari", 34)}Dezlegări</h3><p>10 exerciții noi pe nivelul tău, din partide reale. Nu primești de două ori același exercițiu.</p><span class="btn primar">Rezolvă</span></button>
      <button class="mod" id="m-rush"><h3>${iu("rush", 34)}Puzzle Rush</h3><p>3 minute, 3 greșeli. Exercițiile devin tot mai grele.</p><span class="mare-nr">${st.rush.best}<span class="sub" style="font-size:13px"> record</span></span><span class="btn">Joacă</span></button>
      <button class="mod" id="m-gres"><h3>${iu("tinta", 34)}Din partidele tale</h3><p>${due ? `<b class="alb-t">${plural(due, "exercițiu greșit revine", "exerciții greșite revin")} azi.</b> ` : ""}${recente ? `${plural(recente, "greșeală nouă", "greșeli noi")} din partidele analizate.` : "Pozițiile în care ai greșit, până le rezolvi din prima."}</p><span class="btn ${due || recente ? "primar" : ""}">Începe</span></button>
      <button class="mod" id="m-zi"><h3>${iu("zilnic", 34)}Puzzle-ul zilei</h3>${z ? `<div style="display:grid;grid-template-columns:96px 1fr;gap:12px;align-items:center">${miniTabla(z.fenArata, { flip: z.flip, hl: z.hl })}<p>${esc(z.titlu)}${z.rezolvat ? `<br><span class="k-be">rezolvat azi ✓</span>` : ""}</p></div>` : "<p>—</p>"}<span class="btn">Rezolvă</span></button>
    </div>
    <h2 class="sect-t">${iu("carte", 26)}Pe teme</h2>
    <div class="card"><div class="card-b" style="padding-top:14px">
      <div class="seg" id="ex-sursa" style="margin-bottom:12px"><button data-v="partide" aria-selected="${FX.sursa === "partide"}">Din partide reale</button><button data-v="lichess" aria-selected="${FX.sursa === "lichess"}">Lichess online</button></div>
      <div class="chips" id="ex-tema" style="margin-bottom:12px"><button class="chip" data-t="" aria-pressed="${!FX.tema}">Toate temele</button>${(FX.sursa === "lichess" ? TEME_LICHESS : teme).map(t => `<button class="chip" data-t="${t}" aria-pressed="${FX.tema === t}">${esc(temaRo(t))}${FX.sursa === "partide" && cnt[t] ? ` · ${cnt[t][1]}` : ""}</button>`).join("")}</div>
      ${FX.sursa === "partide" ? `<div class="seg" id="ex-nivel" style="margin-bottom:12px">${[["eu", "Pe nivelul meu"], ["usor", "Mai ușor"], ["greu", "Mai greu"]].map(([k, l]) => `<button data-v="${k}" aria-selected="${FX.nivel === k}">${l}</button>`).join("")}</div>`
        : `<div class="seg" id="ex-dif" style="margin-bottom:12px">${[["easier", "Ușor"], ["normal", "Normal"], ["harder", "Greu"]].map(([k, l]) => `<button data-v="${k}" aria-selected="${FX.dif === k}">${l}</button>`).join("")}</div>`}
      <button class="btn primar" id="ex-start">${ico("play")}Începe 10 exerciții${FX.sursa === "partide" ? ` · ${FX.tema ? (cnt[FX.tema] || [0, 0])[1] : noiTot} noi` : ""}</button>
    </div></div>
    ${temeProg.length ? `<h2 class="sect-t">${iu("statistici", 26)}Progresul pe teme</h2><div class="card">${temeProg.map(([t, v]) => {
      const pct = Math.round(v.ok / v.n * 100);
      return `<div class="bar-r"><span>${esc(temaRo(t))}</span><span class="bara"><i style="width:${pct}%;background:${pct >= 70 ? "var(--green)" : pct >= 45 ? "var(--gold)" : "var(--red)"}"></i></span><span class="n">${v.ok}/${v.n}</span></div>`; }).join("")}</div>` : ""}`;
  $("#m-rating").onclick = async () => pornesteSesiune(await alege(10), "Dezlegări");
  $("#m-rush").onclick = () => { location.hash = "rush"; };
  $("#m-gres").onclick = () => sesiuneGreseli();
  $("#m-zi").onclick = () => pornesteZilnic();
  $("#ex-sursa").onclick = e => { const b = e.target.closest("[data-v]"); if (b) { FX.sursa = b.dataset.v; FX.tema = ""; hub(el); } };
  $("#ex-tema").onclick = e => { const b = e.target.closest("[data-t]"); if (b) { FX.tema = b.dataset.t; hub(el); } };
  const niv = $("#ex-nivel"); if (niv) niv.onclick = e => { const b = e.target.closest("[data-v]"); if (b) { FX.nivel = b.dataset.v; hub(el); } };
  const dif = $("#ex-dif"); if (dif) dif.onclick = e => { const b = e.target.closest("[data-v]"); if (b) { FX.dif = b.dataset.v; hub(el); } };
  $("#ex-start").onclick = async () => {
    const b = $("#ex-start");
    if (FX.sursa === "partide") {
      const tinta = st.rating + (FX.nivel === "usor" ? -250 : FX.nivel === "greu" ? 250 : 0);
      const lista = await alege(10, { teme: FX.tema ? [FX.tema] : null, tinta });
      if (!lista.length) return toast("Nu sunt exerciții pentru alegerea asta.");
      pornesteSesiune(lista, FX.tema ? temaRo(FX.tema) : "Exerciții din partide reale");
    } else {
      b.disabled = true;
      try { const lista = await lichess(FX.tema, FX.dif, 10, (k, n) => { b.textContent = `Aduc exercițiile de pe Lichess… ${k + 1}/${n}`; }); pornesteSesiune(lista, (FX.tema ? temaRo(FX.tema) : "Mix") + " · Lichess"); }
      catch (e) { toast(navigator.onLine ? "Lichess nu a răspuns. Încearcă din nou." : "Ești offline. Folosește exercițiile din partide reale."); b.disabled = false; }
    }
  };
}

// ───────── sesiunea de exerciții ─────────
// Q.ist = pozițiile exercițiului curent; Q.vi = poziția la care te uiți cu ‹ › (null = poziția de acum).
// Ratingul se schimbă doar la prima încercare; reluările nu mai contează.
export function pornesteSesiune(lista, titlu, opt = {}) {
  Q = { lista, titlu, i: 0, rez: [], inreg: [], dRating: 0, ratingStart: statEx().rating, exersare: !!opt.exersare, zilnic: !!opt.zilnic };
  if (location.hash === "#sesiune") sesiune($("#ecran")); else location.hash = "sesiune";
}
export function sesiune(el) {
  curata();
  if (!Q) { location.hash = "dezlegari"; return; }
  el.innerHTML = cadruJoc({ titlu: esc(Q.titlu), sub: "", icon: `<span class="titlu-ic">${iu("dezlegari", 26)}</span>`, inapoi: "#" + (S.precedenta && S.precedenta.startsWith("p-") ? S.precedenta : S.inapoi || "dezlegari"), nav: ["first", "prev", "reia", "next", "last"] });
  $("#nav").onclick = e => { const b = e.target.closest("[data-n]"); if (b) navEx(b.dataset.n); };
  $("#pc").innerHTML = `<div class="rezolva-cap" id="ex-st"></div><div class="puncte" id="puncte"></div><div id="ex-coach"></div><div id="ex-info"></div>`;
  T = new TablaUI($("#tb"), { onMutare: m => mutareEx(m) });
  addEventListener("keydown", tastaEx);
  incarcaEx();
  return curata;
}
function tastaEx(e) {
  if (!Q || !$("#nav")) return;
  const n = { ArrowLeft: "prev", ArrowRight: "next", ArrowUp: "first", ArrowDown: "last" }[e.key];
  if (n) { e.preventDefault(); navEx(n); }
}
function puncte() {
  const el = $("#puncte"); if (!el) return;
  el.hidden = Q.lista.length <= 1;
  el.innerHTML = Q.lista.map((e, k) => `<button class="pt ${Q.rez[k] === true ? "ok" : Q.rez[k] === false ? "nu" : ""} ${k === Q.i && Q.e ? "acum" : ""}" data-k="${k}" aria-label="Exercițiul ${k + 1}" ${Q.rez[k] === undefined && k !== Q.i ? "disabled" : ""}></button>`).join("");
  el.onclick = ev => { const b = ev.target.closest("[data-k]"); if (b && !b.disabled && +b.dataset.k !== Q.i) { Q.i = +b.dataset.k; incarcaEx(); } };
  $("#pc-sub").textContent = Q.e ? `${Q.lista.length > 1 ? `${Q.i + 1} din ${Q.lista.length} · ` : ""}${Q.reluare ? "reluare, fără rating" : `rating ${statEx().rating}`}` : "Gata";
}
function incarcaEx() {
  if (Q.i >= Q.lista.length) return rezumatSesiune();
  const e = Q.lista[Q.i];
  const ch = new Chess(e.fen);
  const juc = e.ult ? (ch.turn() === "w" ? "b" : "w") : ch.turn();
  Object.assign(Q, { e, pas: 0, pos: e.fen, stare: "arata", erori: 0, hint: 0, ajutor: false, juc, ist: [{ fen: e.fen, u: null }], vi: null, ultimD: 0,
    reluare: !!(Q.inreg[Q.i] || Q.exersare), solutie: false });
  T.set({ fen: e.fen, flip: juc === "b", arrows: [], hl: [], badge: null, interactiv: false, cine: juc });
  puncte(); coachEx();
  const start = () => { Q.stare = "muta"; arataPoz(); coachEx(); };
  if (e.ult) setTimeout(() => { if (!Q || Q.e !== e) return; aplica(e.ult, true); start(); }, 600);
  else start();
}
function arataPoz(o = {}) {
  const live = Q.vi == null;
  const k = live ? Q.ist.length - 1 : Q.vi, p = Q.ist[k];
  const hl = ultima(p.u);
  let arrows = [];
  if (live && Q.stare === "muta" && Q.hint) {
    const u = Q.e.sol[Q.pas];
    if (Q.hint === 1) hl.push({ sq: u.slice(0, 2), c: CULORI.rec, o: .55 }); else arrows = [sageata(u, CULORI.be, .8)];
  }
  T.set({ fen: p.fen, hl, arrows, badge: o.badge || null, interactiv: live && Q.stare === "muta" });
  stareNav({ first: k > 0, prev: k > 0, next: !live, last: !live, reia: true });
}
function navEx(n) {
  if (!Q || !Q.e) return;
  if (n === "reia") return reiaEx();
  if (["arata", "raspunde", "solutie", "gresit"].includes(Q.stare)) return;
  const ultim = Q.ist.length - 1;
  let k = Q.vi == null ? ultim : Q.vi;
  if (n === "first") k = 0;
  if (n === "prev") k = Math.max(0, k - 1);
  if (n === "next") k = Math.min(ultim, k + 1);
  if (n === "last") k = ultim;
  const vechi = Q.vi;
  Q.vi = k === ultim ? null : k;
  if (vechi === Q.vi) return;
  arataPoz();
  if ((n === "next" || n === "last") && S.set.sunete) { const p = Q.ist[k]; if (p.u) sunetMutare(A.sanDin(Q.ist[k - 1].fen, p.u)); }
  coachEx();
}
async function reiaEx() {
  if (!Q || !Q.e || Q.stare === "solutie") return;
  if (Q.rez[Q.i] !== undefined && !Q.inreg[Q.i] && !Q.exersare) {
    const d = await inregistreazaEx(Q.e, Q.rez[Q.i]); Q.dRating += d; Q.inreg[Q.i] = true;
  }
  if (Q.rez[Q.i] !== undefined) Q.inreg[Q.i] = true;
  incarcaEx();
}
function aplica(u, sunet) {
  const ch = new Chess(Q.pos);
  const m = ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  Q.pos = ch.fen(); Q.ist.push({ fen: Q.pos, u: m.from + m.to + (m.promotion || "") }); Q.vi = null;
  arataPoz();
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
function mutareEx(m) {
  if (!Q || Q.stare !== "muta" || Q.vi != null) return;
  if (eCorecta(m)) {
    Q.pos = m.fen; Q.pas++; Q.ist.push({ fen: m.fen, u: m.u });
    T.set({ fen: m.fen, hl: ultima(m.u, CULORI.be, .5), badge: { sq: m.to, cl: "be" }, arrows: [] });
    if (S.set.sunete) sunetMutare(m.san);
    if (Q.pas >= Q.e.sol.length) return rezolvat(true);
    Q.stare = "raspunde"; T.set({ interactiv: false }); coachEx("bine");
    setTimeout(() => { if (!Q || Q.stare !== "raspunde") return; Q.stare = "muta"; aplica(Q.e.sol[Q.pas], true); Q.pas++; arataPoz(); coachEx(); }, 500);
  } else {
    Q.erori++;
    if (Q.rez[Q.i] === undefined) Q.rez[Q.i] = false;
    Q.ultimGresit = { ...m };
    T.set({ fen: m.fen, hl: ultima(m.u, CULORI.bl, .5), badge: { sq: m.to, cl: "bl" }, interactiv: false, arrows: [] });
    if (S.set.sunete) { sunetMutare(m.san); setTimeout(sunetGresit, 120); }
    Q.stare = "gresit"; coachEx("gresit"); puncte();
    setTimeout(() => { if (!Q || Q.stare !== "gresit") return; Q.stare = "muta"; if (Q.erori >= 2 && !Q.hint) { Q.hint = 1; Q.ajutor = true; } arataPoz(); coachEx(); }, 900);
  }
}
function arataIndiciu() {
  Q.hint = Math.min(2, Q.hint + 1); Q.ajutor = true;
  if (Q.rez[Q.i] === undefined) Q.rez[Q.i] = false;
  Q.vi = null; arataPoz(); coachEx(); puncte();
}
async function arataSolutia() {
  if (Q.rez[Q.i] === undefined) Q.rez[Q.i] = false;
  Q.vi = null; Q.stare = "solutie"; Q.solutie = true; T.set({ interactiv: false });
  while (Q && Q.stare === "solutie" && Q.pas < Q.e.sol.length) { aplica(Q.e.sol[Q.pas], true); Q.pas++; await new Promise(r => setTimeout(r, 700)); }
  if (Q) rezolvat(false);
}
async function rezolvat(deUnul) {
  const ok = deUnul && Q.erori === 0 && !Q.ajutor;
  const reluare = Q.reluare || Q.inreg[Q.i];
  if (Q.rez[Q.i] === undefined) Q.rez[Q.i] = ok;
  Q.stare = "gata"; Q.okAcum = ok; Q.vi = null; arataPoz({ badge: deUnul ? T.st.badge : null });
  if (deUnul && S.set.sunete) setTimeout(sunetCorect, 150);
  Q.ultimD = 0;
  if (!reluare) {
    const d = await inregistreazaEx(Q.e, Q.rez[Q.i]);
    Q.dRating += d; Q.ultimD = d; Q.inreg[Q.i] = true;
    if (Q.zilnic) { const st = statEx(), z = st.zilnic[ziKey()]; if (z) { z.ok = Q.rez[Q.i]; salveazaSetari(S.set); } }
  }
  puncte(); coachEx();
}
function urmatorul() {
  const k = Q.lista.findIndex((_, j) => j > Q.i && Q.rez[j] === undefined);
  const k2 = k >= 0 ? k : Q.lista.findIndex((_, j) => Q.rez[j] === undefined);
  Q.i = k2 >= 0 ? k2 : Q.lista.length;
  incarcaEx();
}
// mentorul explică prima mutare a soluției (ce face și ce câștigă)
function explicaSolutia(e) {
  const ch = new Chess(e.fen); if (e.ult) A.incearca(ch, e.ult);
  const fen0 = ch.fen(), u = e.sol[0], san = A.sanDin(fen0, u);
  const ce = M.fraza(M.scop(fen0, u, {}), "tu");
  const r = M.rezultatLinie(fen0, e.sol, ch.turn());
  const tm = r.mat === ch.turn() ? "dai mat" : r.d >= 1 ? M.textMaterial(r, "tu") : null;
  const lin = e.sol.length > 1 ? (() => { const c2 = new Chess(fen0); return e.sol.map(x => A.incearca(c2, x)?.san).filter(Boolean).map(fig).join(" "); })() : null;
  return `<p><b>${fig(san)}</b>${ce ? `: ${ce}` : ""}${tm && !/câștigi .* de pe/.test(ce) ? `${ce ? ", iar în final " : " — "}${tm}` : ""}.</p>${lin ? `<p class="slab">Soluția: ${lin}</p>` : ""}`;
}
function coachEx(moment) {
  const el = $("#ex-coach"), stEl = $("#ex-st"); if (!el || !Q || !Q.e) return;
  const e = Q.e, cine = Q.juc === "w" ? "albul" : "negrul";
  let cap = "", corp = "", act = [], status = "", cls = Q.juc;
  const sursa = e.sursa === "greseala" ? "Din greșelile tale" : e.sursa === "lichess" ? `Lichess · ${e.r}` : `Partidă reală · ≈${e.r}`;
  const reia = `<button class="btn" data-a="reia">${ico("sync", 16)}Fă-l din nou</button>`;
  if (Q.vi != null) {
    const k = Q.vi, tot = Q.ist.length - 1;
    status = `<span class="lamut ${Q.juc}"></span><span>Te uiți înapoi</span>`;
    corp = `<p>${k === 0 ? (e.ult ? "Poziția dinaintea mutării adversarului." : "Poziția de început.") : k === 1 && e.ult ? "După mutarea adversarului: de aici începe exercițiul." : `Pasul ${k} din ${tot}.`} Apasă › sau ⏭ ca să revii${Q.stare === "muta" ? " și să muți" : ""}.</p>`;
    act.push(`<button class="btn primar" data-a="acum">Înapoi la poziția de acum ${ico("last", 16)}</button>`, reia);
  } else if (Q.stare === "arata") { status = `<span class="lamut ${Q.juc}"></span><span>Pregătește-te…</span>`; corp = `<p>Adversarul mută. Apoi e rândul tău, cu ${cine}.</p>`; }
  else if (Q.stare === "gata") {
    const ok = Q.reluare ? Q.okAcum : Q.rez[Q.i];
    cls = ok ? "ok" : "nu";
    status = `${iconSVG(ok ? "be" : "bl", 26)}<span>${ok ? (Q.reluare ? "Rezolvat la reluare!" : "Corect!") : Q.solutie ? "Soluția" : "Rezolvat cu ajutor"}</span><span class="spatiu"></span>${Q.ultimD ? `<span class="dr">${Q.ultimD > 0 ? "+" : ""}${Q.ultimD}</span>` : ""}`;
    corp = explicaSolutia(e) + `<p class="slab">Tema: ${e.teme.filter(t => !ASCUNSE.has(t)).map(temaRo).join(", ") || "tactică"}.${e.info && e.info.titlu ? " " + esc(e.info.titlu) : ""}</p>`;
    const maiSunt = Q.lista.some((_, j) => Q.rez[j] === undefined);
    act.push(`<button class="btn primar" data-a="urm">${maiSunt ? "Următorul" : Q.lista.length > 1 ? "Vezi rezultatul" : "Gata"} ${ico("next", 16)}</button>`, reia);
    if (e.sursa === "greseala") act.push(`<a class="btn" href="#p-${esc(e.info.pid)}">Vezi în partidă</a>`);
    else if (e.info && e.info.url) act.push(`<a class="btn" href="${esc(e.info.url)}" target="_blank" rel="noopener">Partida ↗</a>`);
  } else {
    if (moment === "gresit") {
      cls = "nu"; status = `${iconSVG("bl", 26)}<span>Incorect</span>`;
      corp = `<p>${Q.ultimGresit ? `${fig(Q.ultimGresit.san)} nu rezolvă poziția. ` : ""}Mai încearcă.${Q.erori >= 1 ? " La a doua greșeală îți arăt piesa cu care trebuie să muți." : ""}</p>`;
    } else if (moment === "bine") {
      cls = "ok"; status = `${iconSVG("be", 26)}<span>Corect, continuă!</span>`; corp = `<p>Bine! Adversarul răspunde…</p>`;
    } else {
      status = `<span class="lamut ${Q.juc}"></span><span>Mută ${cine}</span>`;
      corp = `<p>${e.sursa === "greseala" ? "Aici ai greșit în partidă. Găsește mutarea cea mai bună." : e.sol.length > 1 ? "Găsește cea mai bună continuare. Exercițiul are mai multe mutări." : "Găsește cea mai bună mutare."}</p>
        ${Q.hint === 1 ? `<p class="slab">Indiciu: mută piesa marcată cu albastru.</p>` : Q.hint >= 2 ? `<p class="slab">Săgeata verde îți arată mutarea.</p>` : ""}`;
    }
    act.push(`<button class="btn" data-a="indiciu">${ico("bec", 16)}${Q.hint ? "Arată mutarea" : "Indiciu"}</button>`, `<button class="btn" data-a="solutie">${ico("ochi", 16)}Soluția</button>`, reia, `<button class="btn ghost" data-a="sari">Sari peste</button>`);
  }
  stEl.className = `rezolva-cap ${cls}`; stEl.innerHTML = status;
  el.innerHTML = bula({ corp, act: act.join("") });
  $("#ex-info").innerHTML = `<p class="nota">${esc(sursa)}${Q.reluare ? " · reluare, fără rating" : ""}${e.repetare ? " · revine pentru repetare" : ""}${e.repetat ? " · l-ai mai văzut" : ""} · cu ‹ vezi ultima mutare a adversarului</p>`;
  el.onclick = ev => {
    const b = ev.target.closest("[data-a]"); if (!b) return;
    deblocheaza();
    const a = b.dataset.a;
    if (a === "urm") urmatorul();
    if (a === "acum") navEx("last");
    if (a === "reia") reiaEx();
    if (a === "indiciu" && Q.stare === "muta") arataIndiciu();
    if (a === "solutie" && Q.stare === "muta") arataSolutia();
    if (a === "sari") { if (Q.rez[Q.i] === undefined) Q.rez[Q.i] = false; urmatorul(); }
  };
}
function rezumatSesiune() {
  const ok = Q.rez.filter(x => x === true).length, n = Q.lista.length, st = statEx();
  Q.e = null;
  puncte();
  T.set({ interactiv: false, arrows: [], hl: [], badge: null });
  stareNav({ first: false, prev: false, reia: false, next: false, last: false });
  const teme = {};
  Q.lista.forEach((e, k) => { if (Q.rez[k] === false) e.teme.forEach(t => { if (!ASCUNSE.has(t)) teme[t] = (teme[t] || 0) + 1; }); });
  const de = Object.entries(teme).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const gresite = Q.lista.filter((_, k) => Q.rez[k] === false);
  const cls = ok >= n * .7 ? "ok" : ok >= n * .4 ? "w" : "nu";
  $("#ex-st").className = `rezolva-cap ${cls}`;
  $("#ex-st").innerHTML = `${iconSVG(ok >= n * .7 ? "be" : ok >= n * .4 ? "go" : "in", 26)}<span>${ok} din ${n} din prima</span>`;
  $("#ex-coach").innerHTML = bula({
    corp: `${Q.exersare ? `<p>Reluare, fără rating.</p>` : `<p>Ratingul la dezlegări: ${Q.ratingStart} → <b>${st.rating}</b> (${Q.dRating >= 0 ? "+" : ""}${Q.dRating}).</p>`}
      ${de.length ? `<p>De lucrat: <b>${de.map(([t]) => temaRo(t)).join(", ")}</b>.</p>` : `<p>Nicio temă cu probleme în setul ăsta.</p>`}
      ${gresite.length ? `<p class="slab">Exercițiile greșite revin automat peste o zi, apoi peste 3 și 7 zile, până le rezolvi din prima.</p>` : ""}`,
    act: `${gresite.length ? `<button class="btn primar" data-a="greseli">${ico("sync", 16)}Reia cele ${gresite.length} greșite</button>` : ""}
      <button class="btn ${gresite.length ? "" : "primar"}" data-a="iar">${ico("play", 16)}Încă 10${de.length ? " pe temele grele" : ""}</button><a class="btn" href="#dezlegari">Dezlegări</a>`,
  });
  $("#ex-info").innerHTML = `<p class="nota">Atinge un punct de sus ca să revezi sau să refaci oricare exercițiu.</p>`;
  $("#ex-coach").onclick = async ev => {
    const b = ev.target.closest("[data-a]"); if (!b) return;
    if (b.dataset.a === "greseli") pornesteSesiune(gresite, "Reluare: exercițiile greșite", { exersare: true });
    if (b.dataset.a === "iar") pornesteSesiune(await alege(10, { teme: de.length ? de.map(x => x[0]) : null }), de.length ? "Temele grele" : "Dezlegări");
  };
}

// ───────── PUZZLE RUSH: 3 minute, 3 greșeli, exerciții tot mai grele ─────────
export async function rush(el) {
  curata();
  const st = statEx();
  el.innerHTML = cadruJoc({ titlu: "Puzzle Rush", sub: `Record: ${st.rush.best}`, icon: `<span class="titlu-ic">${iu("rush", 26)}</span>`, inapoi: "#dezlegari" });
  T = new TablaUI($("#tb"), { onMutare: m => mutareRush(m) });
  T.set({ interactiv: false });
  RU = { stare: "start", scor: 0, gresite: 0, timp: 180, lista: [], folosite: new Set(), tinta: Math.max(500, Math.min(st.rating - 500, 900)) };
  panouRush();
  return curata;
}
function panouRush() {
  const el = $("#pc"); if (!el || !RU) return;
  const st = statEx();
  if (RU.stare === "start") {
    el.innerHTML = `${bula({ cap: `<span>Puzzle Rush</span>`, corp: `<p>Ai <b>3 minute</b>. Rezolvă cât mai multe exerciții; la a <b>3-a greșeală</b> jocul se termină.</p><p class="slab">Începe ușor și devine tot mai greu. Recordul tău: <b>${st.rush.best}</b>.</p>` })}
      <button class="btn primar mare plin" id="r-start">${ico("play", 20)}Start</button>`;
    $("#r-start").onclick = () => { deblocheaza(); startRush(); };
    return;
  }
  if (RU.stare === "gata") {
    const nou = RU.scor > (RU.recordVechi || 0);
    el.innerHTML = `<div class="rezolva-cap ${nou ? "ok" : "b"}">${iu("rush", 26)}<span>Scor: ${RU.scor}</span><span class="spatiu"></span><span class="dr">${nou ? "Record nou!" : `Record: ${st.rush.best}`}</span></div>
      ${bula({ corp: `<p>${RU.scor >= 20 ? "Excelent!" : RU.scor >= 10 ? "Bine!" : "Mai încearcă: viteza vine din exercițiu."} Ai rezolvat ${plural(RU.scor, "exercițiu", "exerciții")}${RU.gresite >= 3 ? " înainte de a 3-a greșeală" : " în 3 minute"}.</p>` })}
      <div class="puncte" style="justify-content:flex-start">${RU.lista.map(x => `<span class="pt ${x.ok ? "ok" : "nu"}" title="${x.e.r}"></span>`).join("")}</div>
      <div class="act"><button class="btn primar" id="r-iar">${ico("play", 16)}Încă o dată</button><a class="btn" href="#dezlegari">Dezlegări</a></div>
      ${RU.lista.some(x => !x.ok) ? `<button class="btn plin" id="r-gres">${ico("sync", 16)}Reia exercițiile greșite</button>` : ""}`;
    $("#r-iar").onclick = () => { RU = { stare: "start", scor: 0, gresite: 0, timp: 180, lista: [], folosite: new Set(), tinta: Math.max(500, Math.min(st.rating - 500, 900)) }; startRush(); };
    const g = $("#r-gres"); if (g) g.onclick = () => pornesteSesiune(RU.lista.filter(x => !x.ok).map(x => x.e), "Reluare: Puzzle Rush", { exersare: true });
    return;
  }
  el.innerHTML = `<div class="rush-cap"><span class="tmp" id="r-timp">${mmss(RU.timp)}</span><span class="vieti">${[0, 1, 2].map(k => `<i class="${k < RU.gresite ? "x" : ""}">${k < RU.gresite ? "✕" : ""}</i>`).join("")}</span><span class="scor">${RU.scor}</span></div>
    <div class="rezolva-cap ${RU.juc}" id="r-st"><span class="lamut ${RU.juc}"></span><span>Mută ${RU.juc === "w" ? "albul" : "negrul"}</span></div>
    <div class="puncte" style="justify-content:flex-start">${RU.lista.map(x => `<span class="pt ${x.ok ? "ok" : "nu"}"></span>`).join("")}</div>`;
}
async function startRush() {
  const st = statEx();
  RU.recordVechi = st.rush.best;
  RU.stare = "joc"; RU.timp = 180;
  RU.timer = setInterval(() => {
    if (!RU) return;
    RU.timp--; const t = $("#r-timp"); if (t) t.textContent = mmss(RU.timp);
    if (RU.timp <= 0) gataRush();
  }, 1000);
  await urmRush();
}
async function urmRush() {
  if (!RU || RU.stare !== "joc") return;
  const [e] = await alege(1, { tinta: RU.tinta, exclud: RU.folosite, latime: 120 });
  if (!e) return gataRush();
  RU.folosite.add(e.id);
  const ch = new Chess(e.fen);
  RU.e = e; RU.pas = 0; RU.pos = e.fen; RU.juc = e.ult ? (ch.turn() === "w" ? "b" : "w") : ch.turn();
  T.set({ fen: e.fen, flip: RU.juc === "b", hl: [], arrows: [], badge: null, interactiv: false, cine: RU.juc });
  panouRush();
  setTimeout(() => {
    if (!RU || RU.e !== e) return;
    if (e.ult) { const c = new Chess(RU.pos); const m = A.incearca(c, e.ult); RU.pos = c.fen(); T.set({ fen: RU.pos, hl: ultima(e.ult) }); if (S.set.sunete && m) sunetMutare(m.san); }
    T.set({ interactiv: true });
  }, 350);
}
function mutareRush(m) {
  if (!RU || RU.stare !== "joc" || !RU.e) return;
  const e = RU.e, ok = m.u.slice(0, 4) === e.sol[RU.pas].slice(0, 4) || (RU.pas === e.sol.length - 1 && new Chess(m.fen).isCheckmate()) || (RU.pas === 0 && (e.alt || []).some(a => a.slice(0, 4) === m.u.slice(0, 4)));
  if (S.set.sunete) sunetMutare(m.san);
  if (!ok) {
    RU.gresite++; RU.lista.push({ e, ok: false });
    T.set({ fen: m.fen, hl: ultima(m.u, CULORI.bl, .5), badge: { sq: m.to, cl: "bl" }, interactiv: false });
    if (S.set.sunete) setTimeout(sunetGresit, 100);
    inregistreazaEx(e, false, { faraRating: true });
    RU.tinta = Math.max(400, RU.tinta - 40);
    if (RU.gresite >= 3) return setTimeout(gataRush, 600);
    panouRush();
    return setTimeout(urmRush, 650);
  }
  RU.pas++; RU.pos = m.fen;
  T.set({ fen: m.fen, hl: ultima(m.u, CULORI.be, .5), badge: null, interactiv: false });
  if (RU.pas >= e.sol.length) {
    RU.scor++; RU.lista.push({ e, ok: true }); RU.tinta += 55;
    if (S.set.sunete) setTimeout(sunetCorect, 80);
    inregistreazaEx(e, true, { faraRating: true });
    panouRush();
    return setTimeout(urmRush, 350);
  }
  setTimeout(() => {
    if (!RU || RU.e !== e) return;
    const c = new Chess(RU.pos); const r = A.incearca(c, e.sol[RU.pas]); RU.pos = c.fen(); RU.pas++;
    T.set({ fen: RU.pos, hl: ultima(e.sol[RU.pas - 1]), interactiv: true });
    if (S.set.sunete && r) sunetMutare(r.san);
  }, 300);
}
function gataRush() {
  if (!RU || RU.stare !== "joc") return;
  clearInterval(RU.timer); RU.stare = "gata";
  T.set({ interactiv: false });
  const st = statEx();
  st.rush.n++; if (RU.scor > st.rush.best) st.rush.best = RU.scor;
  activitate(false);
  salveazaSetari(S.set);
  $("#pc-sub").textContent = `Record: ${st.rush.best}`;
  panouRush();
}

// pentru testele automate
export const _test = () => ({ Q, RU });
