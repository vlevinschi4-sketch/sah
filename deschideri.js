// deschideri.js — baza de deschideri: toate liniile din teorie (Lichess, 3865), repertoriul tău cu idei și capcane,
// ce joci tu în partide, plus ecranul de studiu: pas cu pas, Stockfish live, variante proprii și exersarea liniei.
import { Chess } from "./chess.js";
import * as A from "./analiza.js";
import { S, culoareaMea, rezultat, numeDeschidere, motorLive, evalMotor } from "./stare.js";
import { db, salveazaSetari } from "./date.js";
import { TablaUI } from "./tablaui.js";
import { sageata, CULORI, iconSVG } from "./tabla.js";
import { sunetMutare, sunetCorect, sunetGresit } from "./sunete.js";
import { $, $$, esc, fig, figText, toast, ico, dataRo, nrMut } from "./util.js";

const START = new Chess().fen();
let D = null, T = null, L = null;
let FD = { tab: "rep", cul: "alb", q: "", eco: "", deschis: null, deschisMeu: null };
const fam = n => (n || "").split(":")[0].trim();
const sub = n => (n || "").includes(":") ? n.split(":").slice(1).join(":").trim() : "Linia principală";
const ECO = [["", "Toate"], ["A", "A · flanc"], ["B", "B · semi-deschise"], ["C", "C · deschise"], ["D", "D · închise"], ["E", "E · indiene"]];

async function date() {
  if (!D) {
    const [toate, rep] = await Promise.all([fetch("data/deschideri.json").then(r => r.json()), fetch("data/repertoriu.json").then(r => r.json())]);
    const fams = new Map();
    toate.forEach(([eco, nume, san], i) => { const f = fam(nume); if (!fams.has(f)) fams.set(f, []); fams.get(f).push(i); });
    D = { toate, rep, fams };
  }
  return D;
}
export function inchideDeschideri() {
  if (T) { T.distruge(); T = null; }
  if (L) { L.oprit = true; L = null; motorLive().opreste(); }
  removeEventListener("keydown", tasta);
}

// ───────── deschiderile din partidele tale (nume Lichess + primele mutări), calculate o singură dată ─────────
function sanDinPgn(pgn, n = 20) {
  const corp = pgn.replace(/\[[^\]]*\]/g, " ").replace(/\{[^}]*\}/g, " ").replace(/\([^)]*\)/g, " ").replace(/\$\d+/g, " ").replace(/\d+\.(\.\.)?/g, " ");
  return corp.split(/\s+/).filter(t => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t)).slice(0, n);
}
async function deschiderileMele(progres) {
  const noi = [];
  let k = 0;
  for (const p of S.partide) {
    if (p.dl && p.dl.v === 1) continue;
    const ch = new Chess(), fens = [], sans = [];
    for (const t of sanDinPgn(p.pgn)) { try { const m = ch.move(t); fens.push(ch.fen()); sans.push(m.san); } catch (e) { break; } }
    p.dl = { v: 1, n: S.teorie.numeDeschidere(fens) || numeDeschidere(p) || "Necunoscută", s: sans.join(" ") };
    noi.push(p);
    if (++k % 40 === 0) { progres && progres(k); await new Promise(r => setTimeout(r)); }
  }
  if (noi.length) db.punMulte("partide", noi).catch(() => {});
}
function partideCuLinia(sans) {
  const n = Math.min(sans.length, 6), pref = sans.slice(0, n).join(" ");
  return S.partide.filter(p => p.dl && (p.dl.s + " ").startsWith(pref + " ")).sort((a, b) => b.ts - a.ts);
}
function scor(ps) {
  const c = { castig: 0, remiza: 0, pierdere: 0 };
  ps.forEach(p => c[rezultat(p)[0]]++);
  const n = ps.length || 1;
  return { ...c, n: ps.length, pct: Math.round((c.castig + c.remiza / 2) / n * 100) };
}
const baraWDL = s => `<span class="wdl" title="${s.castig} câștigate, ${s.remiza} remize, ${s.pierdere} pierdute"><i class="w" style="flex:${s.castig}"></i><i class="d" style="flex:${s.remiza}"></i><i class="l" style="flex:${s.pierdere}"></i></span>`;

// ───────── ecranul Deschideri ─────────
export async function randeazaDeschideri(el) {
  inchideDeschideri();
  const d = await date();
  const nRep = { alb: d.rep.filter(r => r.culoare === "alb").length, negru: d.rep.filter(r => r.culoare === "negru").length };
  el.innerHTML = `
    <div class="ex-cap"><h2>Deschideri</h2><p class="sub">${d.toate.length} de linii din teorie, ${d.fams.size} de familii, plus repertoriul tău construit din partidele tale.</p></div>
    <div class="seg glass" id="d-tab"><button data-v="rep" aria-selected="${FD.tab === "rep"}">Repertoriul meu</button><button data-v="toate" aria-selected="${FD.tab === "toate"}">Toate deschiderile</button><button data-v="meu" aria-selected="${FD.tab === "meu"}">Ce joci tu</button></div>
    <div id="d-corp"></div>`;
  $("#d-tab").onclick = e => { const b = e.target.closest("[data-v]"); if (b) { FD.tab = b.dataset.v; randeazaDeschideri(el); } };
  const c = $("#d-corp");
  if (FD.tab === "rep") return tabRep(c, d, nRep);
  if (FD.tab === "toate") return tabToate(c, d);
  c.innerHTML = `<div class="gol"><span class="spin"></span><p>Citesc deschiderile din partidele tale…</p></div>`;
  await deschiderileMele(k => { const p = $("#d-corp p"); if (p) p.textContent = `Citesc deschiderile din partidele tale… ${k}/${S.partide.length}`; });
  if (FD.tab === "meu" && $("#d-corp") === c) tabMeu(c, d);
}

function tabRep(c, d, nRep) {
  const rep = S.set.rep || {};
  const lista = d.rep.filter(r => r.culoare === FD.cul).sort((a, b) => a.ordine - b.ordine);
  const grupe = [...new Set(lista.map(r => r.grup))];
  const TIP = { capcana: "Capcană", lovitura: "Lovitură" };
  c.innerHTML = `<div class="seg glass mic-seg" id="d-cul"><button data-v="alb" aria-selected="${FD.cul === "alb"}">Cu albul · ${nRep.alb}</button><button data-v="negru" aria-selected="${FD.cul === "negru"}">Cu negrul · ${nRep.negru}</button></div>
    <p class="sub">Liniile alese după ce joci de obicei și după rezultatele tale. Deschide una ca s-o studiezi pas cu pas, apoi exerseaz-o: tu muți partea ta, aplicația răspunde.</p>
    ${grupe.map(g => `<h3 class="zi fara-cap">${figText(g)}</h3><div class="rep-grid">${lista.filter(r => r.grup === g).map(r => {
      const st = rep[r.id];
      return `<button class="rep-card" data-r="${r.id}"><span class="rc-t"><b>${figText(r.nume)}</b>${r.tip !== "linie" ? `<span class="eticheta ${r.tip}">${TIP[r.tip]}</span>` : ""}${st && st.ok ? `<span class="eticheta ok">✓ învățată</span>` : ""}</span>
        <span class="rc-i">${figText(r.idee || "")}</span><span class="rc-m">${r.plies.length} mutări${st ? ` · exersată de ${st.n} ${st.n === 1 ? "dată" : "ori"}` : ""}</span></button>`;
    }).join("")}</div>`).join("")}`;
  $("#d-cul").onclick = e => { const b = e.target.closest("[data-v]"); if (b) { FD.cul = b.dataset.v; tabRep(c, d, nRep); } };
  $$("[data-r]", c).forEach(b => (b.onclick = () => { location.hash = "r-" + b.dataset.r; }));
}

// căutarea acceptă și nume românești: „siciliana najdorf”, „gambitul damei”, „italiana”
const norm = t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['’`.,:;()\/-]/g, " ").replace(/\s+/g, " ").trim();
const RO = { siciliana: "sicilian", italiana: "italian", franceza: "french", spaniola: "ruy lopez", scandinava: "scandinavian", engleza: "english",
  olandeza: "dutch", viena: "vienna", rusa: "russian", slava: "slav", catalana: "catalan", londra: "london", nimzoindiana: "nimzo indian",
  indiana: "indian", moderna: "modern", gambitul: "gambit", damei: "queen", regelui: "king", apararea: "defense", deschiderea: "opening",
  varianta: "variation", atacul: "attack", sistemul: "system", scotiana: "scotch", spaniol: "ruy lopez", daneza: "danish", grunfeld: "grunfeld" };
function tabToate(c, d) {
  const q = FD.q.trim().toLowerCase();
  if (!d.norm) d.norm = d.toate.map(([eco, nume]) => norm(nume) + " " + eco.toLowerCase());
  const cuv = norm(q).split(" ").filter(Boolean).map(w => RO[w] || w);
  const potr = (i) => { const [eco, , san] = d.toate[i]; return (!FD.eco || eco[0] === FD.eco) && (!q || cuv.every(w => d.norm[i].includes(w)) || san.toLowerCase().startsWith(q)); };
  let corp;
  if (q.length >= 2) {
    const ids = d.toate.map((_, i) => i).filter(potr);
    corp = `<p class="sub">${ids.length} ${ids.length === 1 ? "linie găsită" : "linii găsite"}${ids.length > 120 ? ", primele 120" : ""}.</p><div class="lista">${ids.slice(0, 120).map(rowLinie).join("")}</div>`;
  } else {
    const fams = [...d.fams.entries()].map(([f, ids]) => [f, ids.filter(potr)]).filter(([, ids]) => ids.length).sort((a, b) => a[0].localeCompare(b[0]));
    corp = `<div class="lista">${fams.map(([f, ids]) => {
      const [eco, , san] = d.toate[ids[0]];
      const deschis = FD.deschis === f;
      return `<button class="row fam" data-fam="${esc(f)}" aria-expanded="${deschis}"><span class="eco">${eco}</span><span class="mid"><span class="t">${esc(f)}</span><span class="s">${esc(movTxt(san, 8))}</span></span><span class="stare">${ids.length}</span></button>
        ${deschis ? `<div class="sub-lista">${ids.map(rowLinie).join("")}</div>` : ""}`;
    }).join("")}</div>`;
  }
  c.innerHTML = `<input class="cauta" id="d-q" type="search" placeholder="Caută: Sicilian, Italian, B20, e4 c5…" value="${esc(FD.q)}" autocomplete="off" spellcheck="false">
    <div class="chips" id="d-eco">${ECO.map(([k, l]) => `<button class="chip" data-e="${k}" aria-pressed="${FD.eco === k}">${l}</button>`).join("")}</div>${corp}`;
  const inp = $("#d-q");
  inp.oninput = () => { FD.q = inp.value; clearTimeout(inp._t); inp._t = setTimeout(() => { tabToate(c, d); const x = $("#d-q"); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 220); };
  $("#d-eco").onclick = e => { const b = e.target.closest("[data-e]"); if (b) { FD.eco = b.dataset.e; tabToate(c, d); } };
  $$("[data-fam]", c).forEach(b => (b.onclick = () => { FD.deschis = FD.deschis === b.dataset.fam ? null : b.dataset.fam; tabToate(c, d); }));
  $$("[data-d]", c).forEach(b => (b.onclick = () => { location.hash = "d-" + b.dataset.d; }));
}
function movTxt(san, max = 99) {
  const s = san.split(" ");
  return s.slice(0, max).map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}.` : "") + fig(m)).join(" ") + (s.length > max ? " …" : "");
}
function rowLinie(i) {
  const [eco, nume, san] = D.toate[i];
  return `<button class="row linie-r" data-d="${i}"><span class="eco">${eco}</span><span class="mid"><span class="t">${esc(sub(nume))}</span><span class="s">${esc(movTxt(san, 12))}</span></span></button>`;
}

function tabMeu(c, d) {
  const grup = { w: new Map(), b: new Map() };
  for (const p of S.partide) {
    if (!p.dl) continue;
    const m = grup[culoareaMea(p)], f = fam(p.dl.n);
    if (!m.has(f)) m.set(f, []);
    m.get(f).push(p);
  }
  const indexNume = new Map(); d.toate.forEach(([, n], i) => { if (!indexNume.has(n)) indexNume.set(n, i); });
  const sect = (cul, titlu) => {
    const fams = [...grup[cul].entries()].sort((a, b) => b[1].length - a[1].length);
    if (!fams.length) return "";
    return `<h3 class="zi fara-cap">${titlu}</h3><div class="lista">${fams.map(([f, ps]) => {
      const s = scor(ps), cheie = cul + f, deschis = FD.deschisMeu === cheie;
      let det = "";
      if (deschis) {
        const v = new Map(); ps.forEach(p => { if (!v.has(p.dl.n)) v.set(p.dl.n, []); v.get(p.dl.n).push(p); });
        det = `<div class="sub-lista">${[...v.entries()].sort((a, b) => b[1].length - a[1].length).map(([n, pv]) => {
          const sv = scor(pv), i = indexNume.get(n);
          return `<button class="row linie-r" ${i != null ? `data-d="${i}"` : `data-p="${esc(pv[0].id)}"`}><span class="mid"><span class="t">${esc(sub(n))}</span><span class="s">${pv.length} ${pv.length === 1 ? "partidă" : "partide"} · ${sv.pct}% scor · ultima ${dataRo(pv[0].ts)}</span></span>${baraWDL(sv)}</button>`;
        }).join("")}</div>`;
      }
      return `<button class="row fam" data-m="${esc(cheie)}" aria-expanded="${deschis}"><span class="nr-p">${ps.length}</span><span class="mid"><span class="t">${esc(f)}</span>
        <span class="s">${s.castig} câștigate · ${s.remiza} remize · ${s.pierdere} pierdute · ${s.pct}% scor</span></span>${baraWDL(s)}</button>${det}`;
    }).join("")}</div>`;
  };
  c.innerHTML = `<p class="sub">Toate partidele tale, grupate după deschidere. Atinge o familie ca să vezi variantele și rezultatele; atinge o variantă ca s-o studiezi.</p>
    ${sect("w", "Cu albul")}${sect("b", "Cu negrul")}${S.partide.length ? "" : `<div class="gol"><p>Nu ai încă partide. Sincronizează-le din ecranul Partide.</p></div>`}`;
  $$("[data-m]", c).forEach(b => (b.onclick = () => { FD.deschisMeu = FD.deschisMeu === b.dataset.m ? null : b.dataset.m; tabMeu(c, d); }));
  $$("[data-d]", c).forEach(b => (b.onclick = () => { location.hash = "d-" + b.dataset.d; }));
  $$("[data-p]", c).forEach(b => (b.onclick = () => { location.hash = "p-" + b.dataset.p; }));
}

// ───────── ecranul de studiu al unei linii ─────────
function construiestePlies(sans) {
  const ch = new Chess(), out = [];
  for (const s of sans) { const fenB = ch.fen(); const m = ch.move(s); out.push({ s: m.san, u: m.from + m.to + (m.promotion || ""), fenB, f: ch.fen(), cul: m.color }); }
  return out;
}
export async function randeazaLinie(el, tip, id) {
  inchideDeschideri();
  const d = await date();
  await deschiderileMele();
  let cfg;
  if (tip === "r") {
    const r = d.rep.find(x => x.id === id); if (!r) { location.hash = "deschideri"; return; }
    const pl = construiestePlies(r.plies.map(p => p.s)).map((p, k) => ({ ...p, com: r.plies[k].com, st: r.plies[k].st, e: r.plies[k].e }));
    cfg = { cheie: "r-" + r.id, titlu: r.nume, sub: r.grup, plies: pl, eu: r.culoare === "alb" ? "w" : "b", rep: r };
  } else {
    const x = d.toate[+id]; if (!x) { location.hash = "deschideri"; return; }
    const pl = construiestePlies(x[2].split(" "));
    const ps = partideCuLinia(pl.map(p => p.s));
    const eu = ps.length ? (ps.filter(p => culoareaMea(p) === "b").length > ps.length / 2 ? "b" : "w") : (pl.length % 2 === 0 ? "b" : "w");
    cfg = { cheie: "d-" + x[1], titlu: x[1], sub: `${x[0]} · ${pl.length} ${pl.length === 1 ? "mutare" : "mutări"} în teorie`, plies: pl, eu, eco: x[0] };
  }
  L = { ...cfg, i: 0, var: null, mod: "studiu", flip: cfg.eu === "b", live: S.set.liveDeschideri !== false, ev: null, oprit: false, ex: null };
  L.partide = partideCuLinia(L.plies.map(p => p.s));
  scrollTo({ top: 0 });
  el.innerHTML = `<div class="rv sesiune linie-p">
      <div class="rv-st"><div class="tabla-rand singur"><div id="tbd"></div></div>
        <div class="nav glass">
          <button class="btn icon" data-n="first" aria-label="La început">${ico("first", 20)}</button>
          <button class="btn icon" data-n="prev" aria-label="Înapoi">${ico("prev", 20)}</button>
          <button class="btn icon" data-n="next" aria-label="Înainte">${ico("next", 20)}</button>
          <button class="btn icon" data-n="last" aria-label="La final">${ico("last", 20)}</button>
          <span class="sep"></span>
          <button class="btn icon" data-n="flip" aria-label="Întoarce tabla">${ico("flip", 20)}</button>
        </div></div>
      <aside class="rv-dr"><div class="rv-cap"><button class="btn glass icon" id="b-iesi" aria-label="Înapoi">${ico("back", 20)}</button>
          <div class="rv-titlu"><b>${figText(L.titlu)}</b><span>${figText(L.sub)}</span></div></div>
        <div id="panou" class="panou-d"></div></aside></div>`;
  $("#b-iesi").onclick = () => { location.hash = "deschideri"; };
  $(".linie-p .nav").onclick = e => { const b = e.target.closest("[data-n]"); if (b) nav(b.dataset.n); };
  addEventListener("keydown", tasta);
  T = new TablaUI($("#tbd"), { onMutare: m => mutareLinie(m) });
  actualizeazaLinie();
}
function tasta(e) {
  if (!L || e.target.closest("input,textarea")) return;
  const k = { ArrowLeft: "prev", ArrowRight: "next", Home: "first", End: "last" }[e.key];
  if (k) { e.preventDefault(); nav(k); }
}
const fenCurent = () => (L.var ? (L.var.j ? L.var.mv[L.var.j - 1].f : L.plies[L.var.base - 1]?.f || START) : (L.i ? L.plies[L.i - 1].f : START));
function nav(n) {
  if (!L || L.mod === "ex") return;
  if (n === "flip") { L.flip = !L.flip; return actualizeazaLinie(); }
  if (L.var) {
    const v = L.var;
    if (n === "prev") { if (v.j > 0) v.j--; else { L.i = v.base; L.var = null; } }
    if (n === "next" && v.j < v.mv.length) v.j++;
    if (n === "first") { L.var = null; L.i = 0; }
    if (n === "last") v.j = v.mv.length;
  } else {
    if (n === "prev" && L.i > 0) L.i--;
    if (n === "next" && L.i < L.plies.length) L.i++;
    if (n === "first") L.i = 0;
    if (n === "last") L.i = L.plies.length;
  }
  actualizeazaLinie(n === "next" ? ultimaMutare() : null);
}
function ultimaMutare() {
  if (L.var) return L.var.j ? L.var.mv[L.var.j - 1].s : null;
  return L.i ? L.plies[L.i - 1].s : null;
}
function numeLaPozitie() {
  const fens = [START, ...L.plies.slice(0, L.var ? L.var.base : L.i).map(p => p.f), ...(L.var ? L.var.mv.slice(0, L.var.j).map(m => m.f) : [])];
  let n = null;
  for (const f of fens) { const k = S.teorie.nume[A.Teorie.cheie(f)]; if (k) n = k; }
  return n;
}
function actualizeazaLinie(sunet) {
  if (!L) return;
  const fen = fenCurent();
  const ultim = L.var ? (L.var.j ? L.var.mv[L.var.j - 1] : null) : (L.i ? L.plies[L.i - 1] : null);
  const hl = ultim ? [{ sq: ultim.u.slice(0, 2), c: "#e8c547", o: .32 }, { sq: ultim.u.slice(2, 4), c: "#e8c547", o: .45 }] : [];
  const arrows = [];
  if (L.mod === "studiu" && !L.var && L.i < L.plies.length) arrows.push(sageata(L.plies[L.i].u, CULORI.be, .75));
  if (L.mod === "studiu" && L.live && L.ev && L.ev.fen === fen && L.ev.linii[0]) {
    const b = L.ev.linii[0].pv[0];
    if (!arrows.length || arrows[0].from + arrows[0].to !== b.slice(0, 4)) arrows.push(sageata(b, CULORI.rec, .7));
  }
  const ch = new Chess(fen);
  T.set({ fen, flip: L.flip, hl, arrows: arrows.filter(Boolean), badge: null, interactiv: L.mod === "studiu" ? !ch.isGameOver() : L.ex && L.ex.stare === "muta", cine: L.mod === "ex" ? L.eu : null });
  if (sunet && S.set.sunete) sunetMutare(sunet);
  panouLinie();
  if (L.mod === "studiu" && L.live && !(L.ev && L.ev.fen === fen && L.ev.final)) pornesteLive(fen);
}
function pornesteLive(fen) {
  const l = L;
  motorLive().analizeaza(fen, S.set.adancimeLive || 18, r => {
    if (L !== l || fenCurent() !== r.fen || L.mod !== "studiu") return;
    const prim = !L.ev || L.ev.fen !== r.fen || (r.final && !L.ev.final) || (L.ev.linii[0] && r.linii[0] && L.ev.linii[0].pv[0] !== r.linii[0].pv[0]);
    L.ev = r;
    if (prim) actualizeazaSageti();
    motorPanou();
  });
}
function actualizeazaSageti() {
  const fen = fenCurent();
  const arrows = [];
  if (!L.var && L.i < L.plies.length) arrows.push(sageata(L.plies[L.i].u, CULORI.be, .75));
  if (L.live && L.ev && L.ev.fen === fen && L.ev.linii[0]) { const b = L.ev.linii[0].pv[0]; if (!arrows.length || arrows[0].from + arrows[0].to !== b.slice(0, 4)) arrows.push(sageata(b, CULORI.rec, .7)); }
  T.set({ arrows: arrows.filter(Boolean) });
}
function motorPanou() {
  const el = $("#d-motor"); if (!el) return;
  if (!L.live) { el.innerHTML = `<div class="ln-cap"><b>Stockfish</b> oprit</div>`; return; }
  const fen = fenCurent(), r = L.ev && L.ev.fen === fen ? L.ev : null;
  if (new Chess(fen).isGameOver()) { el.innerHTML = `<div class="ln-cap"><b>Stockfish</b> · partida s-a terminat</div>`; return; }
  if (!r) { el.innerHTML = `<div class="ln-cap"><span class="spin mic"></span> <b>Stockfish</b> analizează…</div>`; return; }
  el.innerHTML = `<div class="ln-cap"><b>Stockfish</b> · adâncime ${r.adancime}${r.final ? "" : " …"}</div>${r.linii.slice(0, 3).map(l => {
    const ch = new Chess(fen), sans = [];
    for (const u of l.pv.slice(0, 8)) { try { sans.push(ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san); } catch (e) { break; } }
    const albBine = A.winPct(l.ev, "w") >= 50;
    return `<div class="ln"><span class="lev ${albBine ? "alb" : "negru"}">${A.evText(l.ev)}</span><span class="lmv">${sans.map(s => `<span class="lm">${fig(s)}</span>`).join("")}</span></div>`;
  }).join("")}`;
}
function panouLinie() {
  const el = $("#panou"); if (!el) return;
  if (L.mod === "ex") return panouExersare(el);
  const n = numeLaPozitie(), r = L.rep, fen = fenCurent();
  const urm = !L.var && L.i < L.plies.length ? L.plies[L.i] : null;
  const curent = !L.var && L.i ? L.plies[L.i - 1] : null;
  let text = "";
  if (L.var) {
    const inTeorie = S.teorie.eTeorie(fen);
    text = `<div class="ant-cap">${iconSVG("fo", 22)}<b>Varianta ta</b></div><p>Ai ieșit din linie după ${L.var.base ? `${nrMut(L.var.base)} ${fig(L.plies[L.var.base - 1].s)}` : "poziția de start"}. ${inTeorie ? "Poziția e tot în teorie." : "Poziția nu mai e în teorie: urmărește evaluarea lui Stockfish."} ${S.set.raspunsAuto !== false ? "Stockfish răspunde automat pentru adversar." : ""}</p>`;
  } else if (L.i === 0) {
    text = `<div class="ant-cap"><span class="lamut ${L.eu}"></span><b>${r ? "Ideea liniei" : "Începutul liniei"}</b></div><p>${r ? figText(r.idee || "") : `Joci mutările de pe tablă sau apeși Înainte. Săgeata verde arată mutarea din teorie, cea albastră ce recomandă Stockfish.`}</p>`;
  } else if (curent && curent.com) {
    text = `<div class="ant-cap">${iconSVG(curent.e ? "bk" : "fo", 22)}<b>${nrMut(L.i)} ${fig(curent.s)}</b></div><p>${figText(curent.com)}</p>`;
  } else if (!urm) {
    text = `<div class="ant-cap">${iconSVG("bk", 22)}<b>Sfârșitul liniei</b></div>${r && r.plan ? `<p><b>Planul:</b> ${figText(r.plan)}</p>` : `<p>De aici partida iese din teorie. Mută mai departe pe tablă ca să vezi ce recomandă Stockfish.</p>`}${r && r.nota ? `<p class="sub">${figText(r.nota)}</p>` : ""}`;
  } else {
    text = `<div class="ant-cap"><span class="lamut ${new Chess(fen).turn()}"></span><b>${nrMut(L.i + 1)} ${fig(urm.s)}?</b></div><p>Mută pe tablă mutarea din linie (săgeata verde) sau orice altă mutare ca să vezi ce se întâmplă.</p>`;
  }
  if (urm && urm.st && urm.st.m && urm.st.m.length) {
    text += `<div class="statm"><span class="sub">Ce ai jucat tu aici, în ${urm.st.n} ${urm.st.n === 1 ? "partidă" : "partide"}:</span>${urm.st.m.map(m => `<span class="ctx-m ${m.s === urm.s ? "on" : ""}"><b>${fig(m.s)}</b> ${m.n} · ${m.pct}%</span>`).join("")}</div>`;
  }
  const lista = L.plies.map((p, k) => `${k % 2 === 0 ? `<span class="mn">${k / 2 + 1}.</span>` : ""}<button class="mm ${p.e ? "eu" : ""} ${!L.var && L.i === k + 1 ? "on" : ""} ${L.var && L.var.base === k + 1 ? "baza" : ""}" data-i="${k + 1}">${fig(p.s)}</button>`).join("");
  const varH = L.var ? `<div class="var"><span class="var-t">Varianta</span><span class="var-m">${L.var.mv.map((m, k) => `<button class="lm ${L.var.j === k + 1 ? "on" : ""}" data-v="${k + 1}">${fig(m.s)}</button>`).join("")}</span><button class="btn glass mic" data-a="linie">Înapoi la linie</button></div>` : "";
  const st = (S.set.rep || {})[L.cheie];
  const sc = scor(L.partide);
  el.innerHTML = `
    <div class="nume-poz"><span class="eco">${n ? n[0] : L.eco || "—"}</span><span>${esc(n ? n[1] : "Poziția de start")}</span></div>
    <div class="antrenor mut">${text}</div>
    ${varH}
    <div class="act"><button class="btn glass verde" data-a="ex">${ico("play")}Exersează linia</button>
      <button class="btn glass" data-a="live" aria-pressed="${L.live}">Stockfish</button>
      ${st ? `<span class="sub">exersată de ${st.n} ${st.n === 1 ? "dată" : "ori"}${st.ok ? ", fără greșeli de " + st.ok : ""}</span>` : ""}</div>
    <div class="linii" id="d-motor"></div>
    <div class="lista-m">${lista}</div>
    ${L.partide.length ? `<div class="tabel partide-l"><div class="lm-cap"><span>Partidele tale cu linia asta: ${sc.n} · ${sc.pct}% scor</span>${baraWDL(sc)}</div>
      ${L.partide.slice(0, 8).map(p => { const eu = culoareaMea(p), adv = eu === "w" ? p.negru : p.alb, [cls, lit] = rezultat(p);
        return `<button class="row mic-r" data-p="${esc(p.id)}"><span class="res ${cls}">${lit}</span><span class="mid"><span class="t">vs ${esc(adv.user)} <span class="sub">(${adv.rating || "?"})</span></span><span class="s">${dataRo(p.ts)} · ${eu === "w" ? "albele" : "negrele"}</span></span></button>`; }).join("")}</div>` : ""}`;
  motorPanou();
  el.onclick = e => {
    const b = e.target.closest("[data-i],[data-v],[data-a],[data-p]"); if (!b) return;
    if (b.dataset.i) { L.var = null; L.i = +b.dataset.i; actualizeazaLinie(); }
    else if (b.dataset.v) { L.var.j = +b.dataset.v; actualizeazaLinie(); }
    else if (b.dataset.p) location.hash = "p-" + b.dataset.p;
    else if (b.dataset.a === "linie") { L.i = L.var.base; L.var = null; actualizeazaLinie(); }
    else if (b.dataset.a === "live") { L.live = !L.live; S.set.liveDeschideri = L.live; salveazaSetari(S.set); if (!L.live) motorLive().opreste(); actualizeazaLinie(); }
    else if (b.dataset.a === "ex") pornesteExersare();
  };
  const on = $(".lista-m .on", el); if (on) on.scrollIntoView({ block: "nearest" });
}

// mutare pe tablă în modul studiu: mutarea din linie avansează (și adversarul răspunde singur), altfel începe o variantă
async function mutareLinie(m) {
  if (!L) return;
  if (L.mod === "ex") return mutareExersare(m);
  const eu = L.flip ? "b" : "w";
  if (!L.var && L.i < L.plies.length && m.u === L.plies[L.i].u) {
    L.i++; actualizeazaLinie(m.san);
    const urm = L.plies[L.i];
    if (urm && m.fenB.split(" ")[1] === eu && urm.cul !== eu) {
      const l = L, i = L.i;
      setTimeout(() => { if (L === l && !L.var && L.i === i && L.mod === "studiu") { L.i++; actualizeazaLinie(urm.s); } }, 520);
    }
    return;
  }
  if (!L.var) L.var = { base: L.i, mv: [], j: 0 };
  L.var.mv = L.var.mv.slice(0, L.var.j);
  L.var.mv.push({ s: m.san, u: m.u, f: m.fen });
  L.var.j = L.var.mv.length;
  actualizeazaLinie(m.san);
  // adversarul (partea de sus a tablei) răspunde cu mutarea lui Stockfish
  if (S.set.raspunsAuto !== false && m.fenB.split(" ")[1] === eu && !new Chess(m.fen).isGameOver()) {
    const l = L, fen = m.fen;
    const r = await evalMotor(fen, 12);
    await new Promise(res => setTimeout(res, 250));
    if (L !== l || !L.var || fenCurent() !== fen || !r.linii.length) { if (L === l && L.live) pornesteLive(fenCurent()); return; }
    const u = r.linii[0].pv[0], ch = new Chess(fen), mv = ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    L.var.mv.push({ s: mv.san, u, f: ch.fen() }); L.var.j = L.var.mv.length;
    actualizeazaLinie(mv.san);
  }
}

// ───────── exersarea liniei: tu muți partea ta, aplicația pe a adversarului ─────────
function pornesteExersare() {
  L.mod = "ex"; L.var = null; L.i = 0; L.flip = L.eu === "b";
  L.ex = { stare: "muta", erori: 0, greseliPas: 0, total: 0 };
  motorLive().opreste();
  pasExersare();
}
function pasExersare() {
  const ex = L.ex;
  if (L.i >= L.plies.length) return gataExersare();
  const p = L.plies[L.i];
  if (p.cul !== L.eu) {
    ex.stare = "adv"; actualizeazaLinie();
    const l = L, i = L.i;
    setTimeout(() => { if (L !== l || L.mod !== "ex" || L.i !== i) return; L.i++; ex.stare = "muta"; actualizeazaLinie(p.s); pasExersare(); }, L.i === 0 ? 500 : 480);
    return;
  }
  ex.stare = "muta"; ex.greseliPas = 0; actualizeazaLinie();
}
function mutareExersare(m) {
  const ex = L.ex; if (ex.stare !== "muta") return;
  const p = L.plies[L.i];
  if (m.u === p.u) {
    L.i++;
    T.set({ fen: m.fen, badge: { sq: m.to, cl: ex.greseliPas ? "go" : "be" }, hl: [{ sq: m.from, c: CULORI.be, o: .3 }, { sq: m.to, c: CULORI.be, o: .45 }], arrows: [], interactiv: false });
    if (S.set.sunete) sunetMutare(m.san);
    ex.stare = "pauza"; panouLinie();
    setTimeout(() => { if (L && L.mod === "ex" && L.ex === ex) pasExersare(); }, 380);
  } else {
    ex.erori++; ex.greseliPas++;
    T.set({ fen: m.fen, badge: { sq: m.to, cl: "bl" }, interactiv: false, arrows: [] });
    if (S.set.sunete) { sunetMutare(m.san); setTimeout(sunetGresit, 120); }
    ex.stare = "gresit"; ex.ultimGresit = m.san; panouLinie();
    setTimeout(() => {
      if (!L || L.ex !== ex) return;
      ex.stare = "muta"; actualizeazaLinie();
      if (ex.greseliPas >= 2) T.set({ arrows: [sageata(p.u, CULORI.be, .8)] });
    }, 850);
  }
}
async function gataExersare() {
  const ex = L.ex; ex.stare = "gata";
  const rep = S.set.rep || (S.set.rep = {});
  const st = rep[L.cheie] || { n: 0, ok: 0 };
  st.n++; if (!ex.erori) st.ok++; st.ts = Date.now();
  rep[L.cheie] = st; salveazaSetari(S.set);
  if (S.set.sunete) setTimeout(ex.erori ? sunetGresit : sunetCorect, 150);
  actualizeazaLinie();
}
function panouExersare(el) {
  const ex = L.ex, p = L.plies[L.i];
  const cine = L.eu === "w" ? "albul" : "negrul";
  let cap, corp, act = [];
  if (ex.stare === "gata") {
    cap = `${iconSVG(ex.erori ? "go" : "be", 24)}<b>${ex.erori ? "Linie terminată" : "Linie învățată!"}</b>`;
    corp = `<p>${ex.erori ? `Ai greșit de ${ex.erori} ${ex.erori === 1 ? "dată" : "ori"}. Mai treci o dată prin ea ca s-o fixezi.` : "Ai jucat toată linia fără nicio greșeală."}</p>${L.rep && L.rep.plan ? `<p><b>Planul de aici:</b> ${figText(L.rep.plan)}</p>` : ""}`;
    act.push(`<button class="btn glass verde" data-a="iar">${ico("play")}Încă o dată</button>`, `<button class="btn glass" data-a="studiu">Înapoi la studiu</button>`);
  } else if (ex.stare === "gresit") {
    cap = `${iconSVG("bl", 24)}<b>${fig(ex.ultimGresit)} nu e mutarea din linie</b>`;
    corp = `<p>Mai încearcă.${ex.greseliPas >= 1 ? " La a doua greșeală îți arăt mutarea." : ""}</p>`;
  } else if (ex.stare === "adv") {
    cap = `<span class="lamut ${L.eu === "w" ? "b" : "w"}"></span><b>Adversarul mută…</b>`; corp = `<p>Joci cu ${cine}.</p>`;
  } else {
    const com = L.i > 0 && L.plies[L.i - 1].com && L.plies[L.i - 1].cul !== L.eu ? `<p class="sub">${figText(L.plies[L.i - 1].com)}</p>` : "";
    cap = `<span class="lamut ${L.eu}"></span><b>${p ? `${nrMut(L.i + 1)} Mutarea ta` : "Gata"}</b>`;
    corp = `<p>Joacă mutarea din linie cu ${cine}.${ex.greseliPas >= 2 ? " Săgeata verde îți arată mutarea." : ""}</p>${com}`;
    act.push(`<button class="btn glass" data-a="arata">Arată mutarea</button>`, `<button class="btn glass" data-a="studiu">Oprește</button>`);
  }
  const facute = L.plies.slice(0, L.i).map((q, k) => `${k % 2 === 0 ? `${k / 2 + 1}.` : ""}${fig(q.s)}`).join(" ");
  el.innerHTML = `<div class="antrenor mut"><div class="ant-cap">${cap}</div>${corp}
      <div class="ctx"><span>Mutarea ${Math.min(L.i + 1, L.plies.length)} din ${L.plies.length}</span><span>Greșeli: ${ex.erori}</span></div>
      ${act.length ? `<div class="act">${act.join("")}</div>` : ""}</div>
    <div class="linii"><div class="ln-cap"><b>Linia până acum</b></div><p class="sub linie-fin">${facute || "—"}</p></div>`;
  el.onclick = e => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    if (b.dataset.a === "iar") pornesteExersare();
    if (b.dataset.a === "studiu") { L.mod = "studiu"; L.ex = null; actualizeazaLinie(); }
    if (b.dataset.a === "arata" && p) { ex.greseliPas = Math.max(ex.greseliPas, 2); ex.erori++; T.set({ arrows: [sageata(p.u, CULORI.be, .8)] }); panouLinie(); }
  };
}

// pentru testele automate
export const _test = () => L;
