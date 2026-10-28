// invata.js — pagina Învață: greșelile tale pe faze și pe tipuri, lecțiile (deschidere, mijloc, final)
// și finalurile jucate contra Stockfish (cu „Înapoi o mutare” și indiciu).
import { Chess } from "./chess.js?v=40";
import * as A from "./analiza.js?v=40";
import { S, asiguraGreseli, incarcaExercitii, statEx, evalMotor, activitate } from "./stare.js?v=40";
import { salveazaSetari } from "./date.js?v=40";
import { TablaUI } from "./tablaui.js?v=40";
import { iconSVG, sageata, CULORI, tablaSVG, ultima } from "./tabla.js?v=40";
import { cadruJoc, bula, capPagina, miniTabla } from "./cadru.js?v=40";
import { LECTII, FINALURI, SECTIUNI, TEME_RO, TEME_DIN_TIP } from "./lectii.js?v=40";
import { sunetMutare, sunetCorect, sunetGresit, deblocheaza } from "./sunete.js?v=40";
import { $, $$, esc, fig, figText, ico, iu, plural } from "./util.js?v=40";
import * as Dz from "./dezlegari.js?v=40";

const temaRo = t => TEME_RO[t] || t;
const NUME_FAZA = { deschidere: "Deschidere", mijloc: "Mijlocul jocului", final: "Final" };
let T = null, F = null;
const curata = () => { if (T) { T.distruge(); T = null; } if (F) F.oprit = true; };

async function greseliRecente(n = 30) {
  const out = [];
  for (const p of S.partide.filter(p => p.sumar).sort((a, b) => b.ts - a.ts).slice(0, n)) for (const g of await asiguraGreseli(p)) if (g.cl !== "in") out.push([p, g]);
  return out;
}

// cardul de pe Acasă: greșelile care se repetă
export async function cardGreseli() {
  const slabe = Dz.temeSlabe().slice(0, 3);
  if (!slabe.length) return "";
  return `<div class="card-h">Greșelile tale frecvente</div><div class="lista-sec">${slabe.map(x => `<button data-tip="${x.tip}"><span><b class="alb-t">${esc(A.TIPURI[x.tip])}</b><span class="sub">${plural(x.n, "dată", "ori")} în partidele analizate</span></span><span class="btn mic">${ico("play", 14)}Exersează</span></button>`).join("")}</div>`;
}
export function legaCardGreseli(el) {
  $$("[data-tip]", el).forEach(b => (b.onclick = () => Dz.sesiunePeTeme(TEME_DIN_TIP[b.dataset.tip], A.TIPURI[b.dataset.tip])));
}

// ───────── ecranul Învață ─────────
export async function hub(el) {
  curata();
  const recente = await greseliRecente();
  const peFaza = { deschidere: 0, mijloc: 0, final: 0 };
  recente.forEach(([, g]) => { if (peFaza[g.faza] != null) peFaza[g.faza]++; });
  const slabe = Dz.temeSlabe();
  const citite = S.set.lectii || {}, fin = S.set.finaluri || {};
  el.innerHTML = `${capPagina("invata", "Învață")}
    <div class="recap" style="margin-bottom:16px">${iu("tinta", 36)}<div><div class="t">Învață din greșelile tale</div><div class="sub" style="color:rgba(255,255,255,.75)">Pozițiile în care ai greșit în partidele analizate, plus exerciții pe aceleași teme. Cele ratate revin până le rezolvi din prima.</div></div><span class="spatiu"></span><button class="btn primar" id="b-gres">Începe</button></div>
    <div class="faze">${Object.entries(NUME_FAZA).map(([k, n]) => `<button class="mod" data-faza="${k}" style="min-height:0"><h3>${iu(k === "deschidere" ? "deschideri" : k === "mijloc" ? "dezlegari" : "rege", 30)}${n}</h3>
      <span class="mare-nr">${peFaza[k]}</span><p>${peFaza[k] === 1 ? "greșeală" : "greșeli"} în ultimele partide analizate</p><span class="btn mic">${ico("play", 14)}10 exerciții</span></button>`).join("")}</div>
    ${slabe.length ? `<h2 class="sect-t">${iu("statistici", 26)}Ce greșești cel mai des</h2><div class="card lista-sec">${slabe.slice(0, 6).map(x => `<button data-tip="${x.tip}"><span><b class="alb-t">${esc(A.TIPURI[x.tip])}</b>
      <span class="sub">${plural(x.n, "greșeală", "greșeli")} · exersezi ${(TEME_DIN_TIP[x.tip] || []).map(temaRo).join(", ").toLowerCase()}</span></span><span class="btn mic">${ico("play", 14)}10 exerciții</span></button>`).join("")}</div>` : ""}
    ${SECTIUNI.map(([k, n]) => `<h2 class="sect-t">${iu(k === "deschidere" ? "deschideri" : k === "mijloc" ? "dezlegari" : "rege", 26)}Lecții · ${n}</h2>
      <div class="lectii">${LECTII.filter(l => l.sect === k).map(l => `<button class="lectie" data-l="${l.id}"><b>${esc(l.titlu)}</b><span>${l.teme.slice(0, 2).map(temaRo).join(" · ")}</span>${citite[l.id] ? `<span class="ok">✓ citită</span>` : ""}</button>`).join("")}</div>`).join("")}
    <h2 class="sect-t">${iu("rege", 26)}Finaluri contra Stockfish</h2>
    <div class="lectii">${FINALURI.map(f => `<button class="lectie" data-f="${f.id}"><b>${esc(f.titlu)}</b><span>${f.nivel} · ${f.eu === "w" ? "cu albul" : "cu negrul"} · ${f.tinta === "remiza" ? "ține remiza" : f.tinta === "mat" ? "dă mat" : "promovează"}</span>${fin[f.id] ? `<span class="ok">✓ reușit</span>` : ""}</button>`).join("")}</div>`;
  $("#b-gres").onclick = () => Dz.sesiuneGreseli();
  $$("[data-faza]", el).forEach(b => (b.onclick = () => Dz.sesiuneFaza(b.dataset.faza)));
  $$("[data-tip]", el).forEach(b => (b.onclick = () => Dz.sesiunePeTeme(TEME_DIN_TIP[b.dataset.tip], A.TIPURI[b.dataset.tip])));
  $$("[data-l]", el).forEach(b => (b.onclick = () => { location.hash = "lectie-" + b.dataset.l; }));
  $$("[data-f]", el).forEach(b => (b.onclick = () => { location.hash = "final-" + b.dataset.f; }));
}

// ───────── o lecție ─────────
export async function lectie(el, id) {
  curata();
  const l = LECTII.find(x => x.id === id); if (!l) { location.hash = "invata"; return; }
  const st = statEx();
  const ex = (await incarcaExercitii()).filter(e => e.teme.some(t => l.teme.includes(t)) && e.r <= st.rating + 300);
  const exemplu = ex.sort((a, b) => a.r - b.r)[Math.min(ex.length - 1, Math.floor(Math.random() * Math.min(12, ex.length)))];
  const fin = l.final && FINALURI.find(f => f.id === l.final);
  let fenEx = null, flip = false;
  if (exemplu) { const ch = new Chess(exemplu.fen); A.incearca(ch, exemplu.ult); fenEx = ch.fen(); flip = ch.turn() === "b"; }
  S.set.lectii = { ...(S.set.lectii || {}), [l.id]: Date.now() }; salveazaSetari(S.set); activitate();
  el.innerHTML = `<article class="lectie-p">
    <a class="lnk alb-t" href="#invata" style="display:inline-flex;gap:6px;align-items:center">${ico("back", 16)}Învață</a>
    <span class="eticheta verde" style="align-self:flex-start">${esc(SECTIUNI.find(s => s[0] === l.sect)[1])}</span>
    <h1>${esc(l.titlu)}</h1>
    ${l.text.map(p => `<p>${figText(p)}</p>`).join("")}
    ${fenEx ? `<figure class="diag"><div class="tabla">${tablaSVG(fenEx, { flip, hl: ultima(exemplu.ult) })}</div><figcaption>Exemplu din partide reale: ${flip ? "negrul" : "albul"} la mutare. Găsești mutarea?</figcaption></figure>` : ""}
    <div class="act">
      ${exemplu ? `<button class="btn primar" id="b-ex1">Rezolvă exemplul</button>` : ""}
      <button class="btn" id="b-ex10">${ico("play")}Exersează tema · 10</button>
      ${fin ? `<a class="btn" href="#final-${fin.id}">Joacă finalul: ${esc(fin.titlu)}</a>` : ""}
    </div></article>`;
  if (exemplu) $("#b-ex1").onclick = () => Dz.pornesteSesiune([exemplu], l.titlu);
  $("#b-ex10").onclick = () => Dz.sesiunePeTeme(l.teme, l.titlu);
}

// ───────── finaluri contra Stockfish ─────────
export function final(el, id) {
  curata();
  const f = FINALURI.find(x => x.id === id); if (!f) { location.hash = "invata"; return; }
  el.innerHTML = cadruJoc({ titlu: esc(f.titlu), sub: `${f.nivel} · contra Stockfish`, icon: `<span class="titlu-ic">${iu("rege", 26)}</span>`, inapoi: "#invata" });
  T = new TablaUI($("#tb"), { onMutare: m => mutareFinal(m) });
  startFinal(f);
  return curata;
}
function startFinal(f) {
  F = { f, pos: f.fen, mut: 0, stare: "", oprit: false, istoric: [], snap: [] };
  T.set({ fen: f.fen, flip: f.eu === "b", hl: [], arrows: [], badge: null, cine: f.eu, interactiv: false });
  if (new Chess(f.fen).turn() !== f.eu) raspunsMotor(); else { F.stare = "muta"; T.set({ interactiv: true }); }
  coachFinal();
}
async function mutareFinal(m) {
  if (!F || F.stare !== "muta") return;
  F.snap.push({ pos: F.pos, mut: F.mut, n: F.istoric.length });
  F.pos = m.fen; F.mut++; F.istoric.push(m.san);
  T.set({ fen: m.fen, hl: ultima(m.u), arrows: [], interactiv: false });
  if (S.set.sunete) sunetMutare(m.san);
  const ch = new Chess(m.fen), f = F.f;
  if (ch.isCheckmate()) return gataFinal(true, "Mat! Ai rezolvat antrenamentul.");
  if (ch.isDraw() || ch.isStalemate()) return gataFinal(f.tinta === "remiza", ch.isStalemate() ? "Pat: partida e remiză." : "Remiză.");
  if (f.tinta === "promovare" && m.promotion) {
    const r = await evalMotor(m.fen, 14); if (!F || F.oprit) return;
    if (r.linii.length && A.winPct(r.linii[0].ev, f.eu) >= 80) return gataFinal(true, "Ai promovat pionul și poziția e câștigată.");
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
  const ch = new Chess(pos), m = A.incearca(ch, l.pv[0]);
  F.pos = ch.fen(); F.istoric.push(m.san);
  T.set({ fen: F.pos, hl: ultima(l.pv[0]) });
  if (S.set.sunete) sunetMutare(m.san);
  if (ch.isCheckmate()) return gataFinal(false, "Ai primit mat.");
  if (ch.isDraw() || ch.isStalemate()) return gataFinal(f.tinta === "remiza", "Remiză.");
  const r2 = await evalMotor(F.pos, 12); if (!F || F.oprit) return;
  const w = r2.linii.length ? A.winPct(r2.linii[0].ev, f.eu) : 50;
  if (f.tinta !== "remiza" && w < 60) return gataFinal(false, "Avantajul s-a pierdut: poziția nu mai e câștigată. Întoarce mutarea și încearcă altceva.");
  if (f.tinta === "remiza" && w < 15) return gataFinal(false, "Poziția a devenit pierdută. Întoarce mutarea și încearcă altceva.");
  F.stare = "muta"; T.set({ interactiv: true }); coachFinal();
}
async function gataFinal(ok, text) {
  F.stare = "gata"; F.ok = ok; F.text = text; T.set({ interactiv: false });
  if (S.set.sunete) setTimeout(ok ? sunetCorect : sunetGresit, 120);
  if (ok) { S.set.finaluri = { ...(S.set.finaluri || {}), [F.f.id]: true }; activitate(false); salveazaSetari(S.set); }
  coachFinal();
}
function coachFinal() {
  const el = $("#pc"); if (!el || !F) return;
  const f = F.f;
  let status, cls = f.eu, act = [];
  const inapoi = F.snap.length ? `<button class="btn" data-a="inapoi">${ico("prev", 16)}Înapoi o mutare</button>` : "";
  if (F.stare === "gata") { cls = F.ok ? "ok" : "nu"; status = `${iconSVG(F.ok ? "be" : "bl", 26)}<span>${F.ok ? "Reușit!" : "Nereușit"}</span>`; act.push(`<button class="btn primar" data-a="iar">Ia de la capăt</button>`, inapoi); }
  else if (F.stare === "motor") status = `<span class="spin"></span><span>Stockfish se gândește…</span>`;
  else { status = `<span class="lamut ${f.eu}"></span><span>Mutarea ta</span>`; act.push(`<button class="btn" data-a="indiciu">${ico("bec", 16)}Indiciu</button>`, inapoi, `<button class="btn" data-a="iar">Ia de la capăt</button>`); }
  const tinta = f.tinta === "mat" ? `Dă mat în cel mult ${f.maxMut} de mutări.` : f.tinta === "promovare" ? "Promovează pionul păstrând câștigul." : `Ține remiza ${f.maxMut} de mutări.`;
  el.innerHTML = `<div class="rezolva-cap ${cls}">${status}</div>
    ${bula({ corp: `<p>${figText(f.text)}</p>${F.stare === "gata" ? `<p><b>${esc(F.text)}</b></p>` : ""}<p class="slab">${tinta} Mutări: ${F.mut} / ${f.maxMut}.</p>`, act: act.join("") })}
    ${F.istoric.length ? `<div class="lista-m"><div class="lm-grid">${F.istoric.map((s, j) => `${j % 2 === 0 ? `<span class="mn">${j / 2 + 1}.</span>` : ""}<span class="mm"><span class="sn">${fig(s)}</span></span>`).join("")}</div></div>` : ""}`;
  el.onclick = async ev => {
    const b = ev.target.closest("[data-a]"); if (!b) return;
    deblocheaza();
    if (b.dataset.a === "iar") { F.oprit = true; startFinal(f); }
    if (b.dataset.a === "inapoi" && F.snap.length && (F.stare === "muta" || F.stare === "gata")) {
      const x = F.snap.pop(); F.pos = x.pos; F.mut = x.mut; F.istoric.length = x.n; F.stare = "muta"; F.ok = undefined;
      T.set({ fen: F.pos, hl: [], arrows: [], badge: null, interactiv: true }); coachFinal();
    }
    if (b.dataset.a === "indiciu" && F.stare === "muta") {
      const r = await evalMotor(F.pos, 14); if (!F || F.stare !== "muta") return;
      if (r.linii.length) T.set({ arrows: [sageata(r.linii[0].pv[0], CULORI.be, .8)] });
    }
  };
}

export const _test = () => F;
