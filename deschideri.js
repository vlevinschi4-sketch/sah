// deschideri.js — cursurile de deschideri: Top 8 cu albul și Top 8 cu negrul, ca lecțiile de pe Chess.com.
// Pagina cursului, „Învață” (ghidat: săgeată + explicația fiecărei mutări), „Exersează” (din memorie, cu repetiție
// spațiată la 1, 3, 7, 14, 30, 60 de zile), recapitularea zilnică, toate deschiderile din teorie și ce joci tu în partide.
import { Chess } from "./chess.js?v=40";
import * as A from "./analiza.js?v=40";
import { S, culoareaMea, rezultat, numeDeschidere, motorLive, evalMotor, incarcaCursuri, activitate } from "./stare.js?v=40";
import { db, salveazaSetari } from "./date.js?v=40";
import { TablaUI } from "./tablaui.js?v=40";
import { sageata, CULORI, iconSVG, ultima, tablaSVG } from "./tabla.js?v=40";
import { cadruJoc, bula, miniTabla, capPagina, stareNav } from "./cadru.js?v=40";
import { sunetMutare, sunetCorect, sunetGresit, deblocheaza } from "./sunete.js?v=40";
import { $, $$, esc, fig, figText, toast, ico, iu, dataRo, nrMut, plural, numeRo } from "./util.js?v=40";

const START = new Chess().fen();
const ZI = 864e5, INTERVALE = [1, 3, 7, 14, 30, 60];
const NIVEL = { 1: "Începător", 2: "Mediu", 3: "Avansat" };
let T = null, L = null, D = null, COADA = null;
let FD = { tab: null, q: "", eco: "", deschis: null, deschisMeu: null };
function curata() { if (T) { T.distruge(); T = null; } if (L) { L.oprit = true; L = null; } if (S.live) S.live.opreste(); removeEventListener("keydown", tasta); }

// ───────── datele cursurilor ─────────
async function cursuri() {
  const cur = await incarcaCursuri();
  if (!cur._gata) {
    for (const c of cur.cursuri) {
      for (const k of c.capitole) {
        const ch = new Chess(); k._fens = [ch.fen()];
        for (const m of k.mutari) { A.incearca(ch, m[1]); k._fens.push(ch.fen()); }
        k._fen = ch.fen(); k._c = c;
      }
      const ref = c.capitole[0].mutari;
      let n = 0;
      while (n < ref.length && c.capitole.every(k => k.mutari[n] && k.mutari[n][1] === ref[n][1])) n++;
      if (n < 4) n = Math.min(6, ref.length);
      c._n = n; c._poz = c.capitole[0]._fens[n];
    }
    cur._gata = true;
  }
  return cur;
}
const norm = t => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’`.,:;()\/-]/g, " ").replace(/\s+/g, " ").trim();
// o partidă aparține cursului dacă numele deschiderii începe cu familia cursului („Caro-Kann Defense”)
// și, când familia are o variantă („: Advance Variation”), conține primul cuvânt al variantei
function partideCurs(c) {
  const fam = c.familii.map(f => { const [baza, v] = f.split(":"); return [norm(baza), v ? norm(v).split(" ")[0] : null]; });
  return S.partide.filter(p => {
    if (culoareaMea(p) !== c.culoare) return false;
    const n = norm(numeDeschidere(p));
    return fam.some(([b, v]) => n.startsWith(b) && (!v || n.slice(b.length).includes(v)));
  });
}
function scor(ps) {
  const s = { castig: 0, remiza: 0, pierdere: 0 };
  ps.forEach(p => s[rezultat(p)[0]]++);
  return { ...s, n: ps.length, pct: ps.length ? Math.round((s.castig + s.remiza / 2) / ps.length * 100) : 0 };
}
const baraWDL = s => `<span class="wdl" title="${s.castig} câștigate, ${s.remiza} remize, ${s.pierdere} pierdute"><i class="w" style="flex:${s.castig}"></i><i class="d" style="flex:${s.remiza}"></i><i class="l" style="flex:${s.pierdere}"></i></span>`;

// ───────── repetiția spațiată ─────────
const sr = () => S.set.sr || (S.set.sr = {});
const cheie = (c, k) => `${c.id}/${k.id}`;
function stare(c, k) {
  const x = sr()[cheie(c, k)];
  if (!x) return "nou";
  if (x.urm <= Date.now()) return "datorat";
  return x.nivel >= 3 ? "stapanit" : "invatat";
}
function datorate(cur) {
  const out = [];
  for (const c of cur.cursuri) for (const k of c.capitole) { const x = sr()[cheie(c, k)]; if (x && x.urm <= Date.now()) out.push([c, k, x.urm]); }
  return out.sort((a, b) => a[2] - b[2]);
}
function dupaRunda(c, k, mod, erori) {
  const s = sr(), id = cheie(c, k), x = s[id] || { nivel: 0, n: 0, ok: 0 };
  const eraDatorat = !x.urm || x.urm <= Date.now();
  x.n++; x.ultim = Date.now();
  if (mod === "invata") { if (!x.urm) x.urm = Date.now() + ZI * INTERVALE[0]; }
  else if (!erori) { x.ok++; if (eraDatorat) x.nivel = Math.min(INTERVALE.length - 1, x.nivel + 1); x.urm = Date.now() + ZI * INTERVALE[x.nivel]; }
  else { x.nivel = 0; x.urm = Date.now() + ZI * INTERVALE[0]; }
  s[id] = x;
  activitate(false);
  salveazaSetari(S.set);
  return x;
}
const peste = ts => { const z = Math.round((ts - Date.now()) / ZI); return z <= 0 ? "azi" : z === 1 ? "mâine" : `peste ${plural(z, "zi", "zile")}`; };
function textStare(c, k) {
  const x = sr()[cheie(c, k)], st = stare(c, k);
  if (st === "nou") return ["", "Nou"];
  if (st === "datorat") return ["dat", "De recapitulat azi"];
  return ["ok", `${st === "stapanit" ? "Stăpânit" : "Învățat"} · recapitulare ${peste(x.urm)}`];
}

/** Pentru cardul de pe pagina Acasă. */
export async function urmatoareaLectie() {
  const cur = await cursuri(), due = datorate(cur);
  if (due.length) { const [c, k] = due[0]; return { fen: k._fen, flip: c.culoare === "b", titlu: `${plural(due.length, "linie", "linii")} de recapitulat`, buton: "Recapitulează", href: "#recap" }; }
  const ord = [...cur.cursuri].sort((a, b) => a.loc - b.loc || (a.culoare === "w" ? -1 : 1));
  for (const c of ord) for (const k of c.capitole) if (stare(c, k) === "nou") return { fen: c._poz, flip: c.culoare === "b", titlu: `${c.nume} — ${k.nume}`, buton: "Lecția următoare", href: `#cap-${c.id}/${k.id}/invata` };
  return { fen: cur.cursuri[0]._poz, flip: false, titlu: "Toate capitolele învățate", buton: "Deschideri", href: "#deschideri" };
}

// ───────── ecranul Deschideri ─────────
export async function hub(el) {
  curata();
  const cur = await cursuri(), due = datorate(cur);
  if (!FD.tab) {
    const albe = S.partide.filter(p => culoareaMea(p) === "w"), negre = S.partide.filter(p => culoareaMea(p) === "b");
    FD.tab = scor(negre).pct < scor(albe).pct ? "b" : "w";
  }
  const nInv = Object.keys(sr()).length, nTot = cur.cursuri.reduce((s, c) => s + c.capitole.length, 0);
  el.innerHTML = `${capPagina("deschideri", "Deschideri", `<span class="sub">${nInv} din ${nTot} capitole învățate</span>`)}
    ${due.length ? `<div class="recap" style="margin-bottom:14px">${iu("flacara", 36)}<div><div class="t">${plural(due.length, "linie de recapitulat", "linii de recapitulat")} azi</div>
      <div class="sub" style="color:rgba(255,255,255,.75)">Le repeți la intervale tot mai mari, ca să nu le mai uiți.</div></div><span class="spatiu"></span><a class="btn primar" href="#recap">Recapitulează</a></div>` : ""}
    <div class="tabs" id="d-tab" role="tablist">${[["w", "Top 8 cu albul"], ["b", "Top 8 cu negrul"], ["toate", "Toate deschiderile"], ["meu", "Ce joci tu"]].map(([k, l]) => `<button role="tab" data-v="${k}" aria-selected="${FD.tab === k}">${l}</button>`).join("")}</div>
    <div id="d-corp" style="margin-top:14px"></div>`;
  $("#d-tab").onclick = e => { const b = e.target.closest("[data-v]"); if (b) { FD.tab = b.dataset.v; hub(el); } };
  const corp = $("#d-corp");
  if (FD.tab === "w" || FD.tab === "b") return gridCursuri(corp, cur, FD.tab);
  if (FD.tab === "toate") return tabToate(corp);
  corp.innerHTML = `<div class="gol"><span class="spin"></span><p>Citesc deschiderile din partidele tale…</p></div>`;
  await deschiderileMele(k => { const p = $("#d-corp p"); if (p) p.textContent = `Citesc deschiderile din partidele tale… ${k}/${S.partide.length}`; });
  if (FD.tab === "meu" && $("#d-corp") === corp) tabMeu(corp, cur);
}
function gridCursuri(corp, cur, cul) {
  const lista = cur.cursuri.filter(c => c.culoare === cul).sort((a, b) => a.loc - b.loc);
  corp.innerHTML = `<p class="sub" style="margin-bottom:12px">${cul === "w" ? "Deschiderile alese pentru tine cu albul: centru, dezvoltare rapidă și atac, plus capcanele în care cad adversarii de nivelul tău." : "Răspunsurile tale cu negrul la 1.e4 și 1.d4: solide, ușor de învățat, cu capcanele de evitat."} Învață un capitol, apoi exersează-l din memorie; aplicația ți-l aduce înapoi exact când e pe cale să-l uiți.</p>
    <div class="cursuri">${lista.map(c => {
      const inv = c.capitole.filter(k => stare(c, k) !== "nou").length, dat = c.capitole.filter(k => stare(c, k) === "datorat").length;
      const ps = partideCurs(c), s = scor(ps);
      return `<button class="curs-card" data-c="${c.id}">
        <div class="tabla-mini">${tablaSVG(c._poz, { flip: cul === "b", coords: false })}<span class="curs-loc">#${c.loc}</span></div>
        <div class="ct">${esc(c.nume)}</div><div class="cs">${esc(c.eng)} · ${esc(c.eco)}</div>
        <div class="cs" style="margin-top:4px">${esc(c.stil)} · ${NIVEL[c.nivel]}</div>
        ${ps.length >= 5 && s.pct < 45 ? `<div class="cs" style="margin-top:6px"><span class="eticheta rosu">Prioritar pentru tine: ${s.pct}% scor</span></div>` : ""}
        <div class="bara"><i style="width:${Math.round(inv / c.capitole.length * 100)}%"></i></div>
        <div class="cm"><span>${inv}/${c.capitole.length} capitole${dat ? ` · <span class="k-in">${dat} de recapitulat</span>` : ""}</span><span>${ps.length ? `${plural(ps.length, "partidă", "partide")} · ${s.pct}%` : ""}</span></div>
      </button>`; }).join("")}</div>`;
  $$("[data-c]", corp).forEach(b => (b.onclick = () => { location.hash = "curs-" + b.dataset.c; }));
}

// ───────── pagina unui curs ─────────
export async function curs(el, id) {
  curata();
  const cur = await cursuri(), c = cur.dupaId[id];
  if (!c) { location.hash = "deschideri"; return; }
  const ps = partideCurs(c).sort((a, b) => b.ts - a.ts), s = scor(ps);
  const urm = c.capitole.find(k => stare(c, k) === "datorat") || c.capitole.find(k => stare(c, k) === "nou");
  const invatate = c.capitole.filter(k => stare(c, k) !== "nou");
  el.innerHTML = `<a class="lnk alb-t" href="#deschideri" style="display:inline-flex;gap:6px;align-items:center;margin-bottom:10px">${ico("back", 16)}Deschideri</a>
    <div class="curs-pag">
      <div>
        <div class="tabla">${tablaSVG(c._poz, { flip: c.culoare === "b" })}</div>
        ${urm ? `<a class="btn primar mare plin" style="margin-top:12px" href="#cap-${c.id}/${urm.id}/${stare(c, urm) === "datorat" ? "exerseaza" : "invata"}">${stare(c, urm) === "datorat" ? "Recapitulează" : invatate.length ? "Continuă" : "Începe cursul"}: ${esc(urm.nume)}</a>` : `<div class="recap" style="margin-top:12px">${iconSVG("br", 28)}<div class="t">Ai învățat tot cursul!</div></div>`}
        ${invatate.length ? `<button class="btn plin" id="b-tot" style="margin-top:8px">${ico("play", 16)}Exersează tot cursul (${invatate.length})</button>` : ""}
      </div>
      <div class="curs-info">
        <span class="eticheta verde">Top #${c.loc} cu ${c.culoare === "w" ? "albul" : "negrul"}</span>
        <h1 style="margin-top:8px">${esc(c.nume)}</h1>
        <p class="sub">${esc(c.eng)} · ${esc(c.eco)} · ${esc(c.stil)} · ${NIVEL[c.nivel]}</p>
        <p class="deCe">${figText(c.deCe)}</p>
        <div class="card" style="margin:12px 0"><div class="card-h" style="font-size:15px">Ideile principale</div><div class="card-b"><ul class="idei">${c.idei.map(x => `<li>${figText(x)}</li>`).join("")}</ul></div></div>
        ${ps.length ? `<div class="card" style="margin:12px 0"><div class="card-h" style="font-size:15px">În partidele tale<span class="spatiu"></span>${baraWDL(s)}</div>
          <div class="card-b"><p class="sub">${plural(ps.length, "partidă", "partide")} · ${s.castig} câștigate, ${s.remiza} remize, ${s.pierdere} pierdute · ${s.pct}% scor</p>
          <div class="mom" style="margin-top:8px">${ps.slice(0, 6).map(p => { const [cls] = rezultat(p); const a = culoareaMea(p) === "w" ? p.negru : p.alb;
            return `<a class="btn mic" href="#p-${esc(p.id)}"><span class="lamut ${cls === "castig" ? "w" : "b"}" style="background:${cls === "castig" ? "var(--green)" : cls === "pierdere" ? "var(--red)" : "#8b8987"}"></span>vs ${esc(a.user)} · ${dataRo(p.ts)}</a>`; }).join("")}</div></div></div>` : ""}
        <h2 class="sect-t" style="margin-top:18px">${iu("carte", 26)}Capitole</h2>
        <div class="capitole">${c.capitole.map((k, j) => {
          const [cls, txt] = textStare(c, k);
          return `<div class="cap-r"><span class="nr ${cls}">${cls === "ok" ? "✓" : j + 1}</span>
            <div><div class="t">${esc(k.nume)} ${k.tip === "capcana" ? `<span class="eticheta rosu">Capcană</span>` : ""}</div><div class="s">${figText(k.sub)} · ${k.mutari.length} mutări</div><div class="s ${cls === "dat" ? "k-in" : ""}">${txt}</div></div>
            <div class="act"><a class="btn mic ${stare(c, k) === "nou" ? "primar" : ""}" href="#cap-${c.id}/${k.id}/invata">Învață</a><a class="btn mic ${stare(c, k) === "datorat" ? "primar" : ""}" href="#cap-${c.id}/${k.id}/exerseaza">Exersează</a></div></div>`;
        }).join("")}</div>
      </div>
    </div>`;
  const bt = $("#b-tot"); if (bt) bt.onclick = () => { COADA = { lista: invatate.map(k => [c, k]), titlu: c.nume, k: 0, rez: [] }; location.hash = "recap"; };
}

// ───────── recapitularea: liniile datorate azi, din memorie ─────────
export async function recap(el) {
  const cur = await cursuri();
  if (!COADA) {
    const due = datorate(cur);
    if (!due.length) {
      curata();
      el.innerHTML = cadruJoc({ titlu: "Recapitulare", sub: "Deschideri", inapoi: "#deschideri", icon: `<span class="titlu-ic">${iu("deschideri", 26)}</span>` });
      $("#tb").innerHTML = tablaSVG(START, {});
      $("#pc").innerHTML = bula({ corp: `<p>Nimic de recapitulat azi. Învață un capitol nou sau revino mâine.</p>`, act: `<a class="btn primar" href="#deschideri">Cursurile</a>` });
      return curata;
    }
    COADA = { lista: due.map(([c, k]) => [c, k]), titlu: "Recapitularea de azi", k: 0, rez: [] };
  }
  const [c, k] = COADA.lista[COADA.k];
  return pornesteCapitol(el, c, k, "exerseaza", COADA);
}
export async function capitol(el, cid, kid, mod) {
  const cur = await cursuri(), c = cur.dupaId[cid], k = c && c.capitole.find(x => x.id === kid);
  if (!k) { location.hash = "deschideri"; return; }
  COADA = null;
  return pornesteCapitol(el, c, k, mod, null);
}

// ───────── jucătorul de capitol (Învață / Exersează) ─────────
function pornesteCapitol(el, c, k, mod, coada) {
  curata();
  const eu = c.culoare;
  el.innerHTML = cadruJoc({
    titlu: esc(k.nume), sub: coada ? `${esc(coada.titlu)} · ${coada.k + 1} din ${coada.lista.length}` : `${esc(c.nume)} · ${mod === "invata" ? "Învață" : "Exersează"}`,
    icon: `<span class="titlu-ic">${iu("deschideri", 26)}</span>`, inapoi: c.id === "db" ? `#d-${c.db}` : coada ? "#deschideri" : `#curs-${c.id}`, nav: ["first", "prev", "next", "last"],
    extra: `<button class="btn ghost icon" id="b-flip" aria-label="Întoarce tabla">${ico("flip", 20)}</button>`,
  });
  $("#pc").innerHTML = `<div class="rezolva-cap" id="cp-st"></div><div id="cp-coach"></div>
    <div><div class="cm sub" style="display:flex;justify-content:space-between;margin-bottom:6px"><span id="cp-prog"></span><span id="cp-err"></span></div><div class="bara"><i id="cp-bara" style="width:0"></i></div></div>
    <div class="lista-m" id="cp-lm"></div>`;
  T = new TablaUI($("#tb"), { onMutare: m => mutareCap(m) });
  L = { c, k, mod, eu, mut: k.mutari, i: 0, fen: START, ist: [{ fen: START, u: null }], vi: null, erori: 0, greseliPas: 0, stare: "", coada, flip: eu === "b", ultimCom: null, alt: null };
  $("#b-flip").onclick = () => { L.flip = !L.flip; deseneaza(); };
  $("#nav").onclick = e => { const b = e.target.closest("[data-n]"); if (b) navCap(b.dataset.n); };
  addEventListener("keydown", tasta);
  pas();
  return curata;
}
function tasta(e) {
  if (!L || e.target.closest("input,textarea")) return;
  const k = { ArrowLeft: "prev", ArrowRight: "next", ArrowUp: "first", ArrowDown: "last" }[e.key];
  if (k) { e.preventDefault(); if (L.studiu) navStudiu(k); else navCap(k); }
}
const ruleaza = (f, ms) => { const l = L; setTimeout(() => { if (L === l && !l.oprit) f(); }, ms); };
function pas() {
  if (!L) return;
  if (L.i >= L.mut.length) return gata();
  const [, u] = L.mut[L.i];
  if (L.fen.split(" ")[1] !== L.eu) {
    L.stare = "adv"; deseneaza();
    ruleaza(() => {
      const [san, u2, com, mk] = L.mut[L.i];
      const ch = new Chess(L.fen); A.incearca(ch, u2); L.fen = ch.fen();
      L.ist.push({ fen: L.fen, u: u2 }); L.i++;
      L.ultimCom = { san, com, mk, eu: false, nr: nrMut(L.i) };
      if (S.set.sunete) sunetMutare(san);
      pas();
    }, L.i === 0 ? 700 : 520);
    return;
  }
  L.stare = "muta"; L.greseliPas = 0; L.alt = null;
  deseneaza();
}
function deseneaza() {
  if (!L) return;
  const live = L.vi == null, k = live ? L.ist.length - 1 : L.vi, poz = L.ist[k];
  const asteptat = L.i < L.mut.length ? L.mut[L.i] : null;
  let arrows = [], hl = ultima(poz.u);
  if (live && L.stare === "muta" && asteptat && (L.mod === "invata" || L.greseliPas >= 2 || L.arata)) arrows = [sageata(asteptat[1], CULORI.be, .8)];
  if (live && L.stare === "pauza") hl = ultima(poz.u, CULORI.be, .5);
  T.set({ fen: poz.fen, flip: L.flip, arrows, hl, badge: live && L.stare === "pauza" ? { sq: poz.u.slice(2, 4), cl: L.ultimCom && L.ultimCom.ok === false ? "go" : "be" } : null,
    interactiv: live && L.stare === "muta", cine: L.eu });
  stareNav({ first: k > 0, prev: k > 0, next: !live, last: !live });
  panou();
}
function navCap(n) {
  if (!L || ["adv", "pauza", "gresit"].includes(L.stare)) return;
  const ultim = L.ist.length - 1;
  let k = L.vi == null ? ultim : L.vi;
  if (n === "first") k = 0; if (n === "prev") k = Math.max(0, k - 1); if (n === "next") k = Math.min(ultim, k + 1); if (n === "last") k = ultim;
  const v = k === ultim ? null : k;
  if (v === L.vi) return;
  L.vi = v; deseneaza();
  if ((n === "next" || n === "last") && S.set.sunete && L.ist[k].u) sunetMutare(A.sanDin(L.ist[k - 1].fen, L.ist[k].u));
}
async function mutareCap(m) {
  if (!L || L.stare !== "muta" || L.vi != null) return;
  const [san, u, com, mk] = L.mut[L.i];
  if (m.u.slice(0, 4) === u.slice(0, 4)) {
    L.fen = m.fen; L.ist.push({ fen: m.fen, u: m.u }); L.i++;
    L.ultimCom = { san, com, mk, eu: true, ok: !L.greseliPas, nr: nrMut(L.i) };
    if (S.set.sunete) sunetMutare(m.san);
    L.stare = "pauza"; L.arata = false; deseneaza();
    ruleaza(pas, L.mod === "invata" ? 650 : 420);
    return;
  }
  L.erori++; L.greseliPas++;
  L.gresit = { san: m.san, fenB: m.fenB, u: m.u, fen: m.fen };
  T.set({ fen: m.fen, hl: ultima(m.u, CULORI.bl, .5), badge: { sq: m.to, cl: "mi" }, interactiv: false, arrows: [] });
  if (S.set.sunete) { sunetMutare(m.san); setTimeout(sunetGresit, 120); }
  L.stare = "gresit"; panou();
  if (L.mod === "invata" || L.studiu) verificaAlternativa(L.gresit, L.i);
  ruleaza(() => { if (L.stare === "gresit") { L.stare = "muta"; deseneaza(); } }, 1000);
}
// în modul „Învață”, Stockfish îți spune dacă mutarea ta era și ea bună (chiar dacă nu e cea din curs)
async function verificaAlternativa(g, i) {
  const l = L;
  L.alt = { san: g.san, cl: null };
  const [rb, ra] = [await evalMotor(g.fenB, 12), await evalMotor(g.fen, 12)];
  if (L !== l || L.i !== i || !rb.linii.length) return;
  const cul = g.fenB.split(" ")[1];
  const eBest = rb.linii[0].pv[0].slice(0, 4) === g.u.slice(0, 4);
  const wb = A.winPct(rb.linii[0].ev, cul), wa = new Chess(g.fen).isCheckmate() ? 100 : ra.linii.length ? A.winPct(ra.linii[0].ev, cul) : wb;
  L.alt = { san: g.san, cl: A.clasaSimpla(wb, eBest ? wb : wa, eBest) };
  if (L.stare !== "adv") panou();
}
function gata() {
  L.stare = "gata";
  if (L.c.id !== "db") L.rezSR = dupaRunda(L.c, L.k, L.mod, L.erori);
  if (L.coada) { L.coada.rez[L.coada.k] = !L.erori; if (L.coada.k + 1 >= L.coada.lista.length) COADA = null; }
  if (S.set.sunete) setTimeout(L.erori ? sunetGresit : sunetCorect, 150);
  deseneaza();
}
const ALT = { be: ["e la fel de bună", "be"], ex: ["e și ea foarte bună", "ex"], go: ["e o mutare bună", "go"], in: ["e o inexactitate", "in"], mi: ["e o greșeală", "mi"], bl: ["e o gafă", "bl"] };
function panou() {
  if (!L) return;
  const st = $("#cp-st"), co = $("#cp-coach"); if (!st || !co) return;
  const cine = L.eu === "w" ? "albul" : "negrul", asteptat = L.i < L.mut.length ? L.mut[L.i] : null;
  const fCom = x => (x && x.com ? figText(x.com) : "");
  const anunt = x => (x ? `<p><b>${x.nr} ${fig(x.san)}${x.mk || ""}</b>${x.com ? ` — ${fCom(x)}` : ""}</p>` : "");
  let status = "", cls = L.eu, corp = "", act = [];
  const urmCap = (() => { const ks = L.c.capitole || []; const j = ks.indexOf(L.k); return j >= 0 && j + 1 < ks.length ? ks[j + 1] : null; })();
  if (L.vi != null) {
    status = `<span class="lamut ${L.eu}"></span><span>Te uiți înapoi</span>`;
    corp = `<p>Mutarea ${L.vi} din ${L.ist.length - 1}. Apasă ⏭ ca să revii la poziția de acum.</p>`;
  } else if (L.stare === "adv") {
    status = `<span class="lamut ${L.eu === "w" ? "b" : "w"}"></span><span>Adversarul mută…</span>`;
    corp = L.ultimCom && L.ultimCom.eu ? anunt(L.ultimCom) : `<p>Joci cu ${cine}.</p>`;
  } else if (L.stare === "muta") {
    status = `<span class="lamut ${L.eu}"></span><span>Mutarea ta, cu ${cine}</span>`;
    const intro = L.i === 0 || (L.i === 1 && L.eu === "b") ? `<p class="slab">${L.mod === "invata" ? "Urmează săgeata verde și citește de ce se joacă fiecare mutare." : "Joacă din memorie. La a doua greșeală îți arăt mutarea."}</p>` : "";
    if (L.mod === "invata" || L.arata || L.greseliPas >= 2) {
      corp = `${L.ultimCom && !L.ultimCom.eu ? anunt(L.ultimCom) : ""}<p>Joacă <b>${fig(asteptat[0])}</b>${asteptat[3] || ""}.</p>${L.mod === "invata" && asteptat[2] ? `<p class="slab">De ce: ${figText(asteptat[2])}</p>` : ""}${intro}`;
    } else corp = `${L.ultimCom && !L.ultimCom.eu ? anunt(L.ultimCom) : ""}<p>Ce joci aici?</p>${intro}`;
    if (L.alt && L.alt.cl) { const [t, c2] = ALT[L.alt.cl] || ["", "go"]; corp += `<p class="${["be", "ex", "go"].includes(c2) ? "bun" : "risc"}">${fig(L.alt.san)} ${t}${["be", "ex", "go"].includes(c2) ? ", dar aici învățăm linia din curs" : ""}.</p>`; }
    else if (L.alt) corp += `<p class="slab"><span class="spin mic"></span> Verific ${fig(L.alt.san)} cu Stockfish…</p>`;
    if (L.mod !== "invata" && !L.arata && L.greseliPas < 2) act.push(`<button class="btn" data-a="arata">${ico("bec", 16)}Arată mutarea</button>`);
  } else if (L.stare === "gresit") {
    cls = "nu"; status = `${iconSVG("mi", 26)}<span>${fig(L.gresit.san)} nu e mutarea din curs</span>`;
    corp = `<p>${L.mod === "invata" ? "Urmează săgeata verde." : L.greseliPas >= 2 ? "Uită-te la săgeata verde." : "Mai încearcă."}</p>`;
  } else if (L.stare === "pauza") {
    cls = "ok"; status = `${iconSVG(L.ultimCom.ok ? "be" : "go", 26)}<span>${L.ultimCom.ok ? "Corect!" : "Bine, mergem mai departe"}</span>`;
    corp = anunt(L.ultimCom);
  } else if (L.stare === "gata") {
    const x = L.rezSR, perfect = !L.erori;
    cls = perfect ? "ok" : "w";
    status = `${iconSVG(perfect ? "br" : "go", 26)}<span>${L.mod === "invata" ? "Capitol parcurs!" : perfect ? "Perfect, fără greșeli!" : `${plural(L.erori, "greșeală", "greșeli")}`}</span>`;
    corp = `${L.ultimCom ? anunt(L.ultimCom) : ""}<p>${L.c.id === "db" ? "Ai jucat toată linia." : L.mod === "invata" ? `Acum exersează-l din memorie. Îl primești înapoi la recapitulare ${peste(x.urm)}.` : perfect ? `Următoarea recapitulare: <b>${peste(x.urm)}</b>.` : `Revine la recapitulare <b>mâine</b>, ca să-l fixezi.`}</p>`;
    if (L.coada) {
      const q = L.coada, ok = q.rez.filter(Boolean).length;
      if (q.k + 1 < q.lista.length) act.push(`<button class="btn primar" data-a="coada">Următoarea linie (${q.k + 2}/${q.lista.length}) ${ico("next", 16)}</button>`);
      else { corp += `<p><b>Recapitulare încheiată:</b> ${ok} din ${q.lista.length} linii fără greșeli.</p>`; act.push(`<a class="btn primar" href="#deschideri">Gata</a>`); }
    } else if (L.c.id === "db") {
      act.push(`<button class="btn primar" data-a="iar">${ico("sync", 16)}Încă o dată</button>`, `<a class="btn" href="#d-${L.c.db}">Înapoi la linie</a>`);
    } else {
      if (L.mod === "invata") act.push(`<a class="btn primar" href="#cap-${L.c.id}/${L.k.id}/exerseaza">${ico("play", 16)}Exersează din memorie</a>`);
      else act.push(`<button class="btn ${perfect ? "" : "primar"}" data-a="iar">${ico("sync", 16)}Încă o dată</button>`);
      if (urmCap) act.push(`<a class="btn ${L.mod === "exerseaza" && perfect ? "primar" : ""}" href="#cap-${L.c.id}/${urmCap.id}/invata">Capitolul următor ${ico("next", 16)}</a>`);
      act.push(`<a class="btn" href="#curs-${L.c.id}">Cursul</a>`);
    }
  }
  st.className = `rezolva-cap ${cls}`; st.innerHTML = status;
  co.innerHTML = bula({ corp, act: act.join("") });
  co.onclick = e => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    deblocheaza();
    if (b.dataset.a === "arata") { L.arata = true; L.erori++; deseneaza(); }
    if (b.dataset.a === "iar") pornesteCapitol($("#ecran"), L.c, L.k, L.mod, null);
    if (b.dataset.a === "coada") { L.coada.k++; const [c2, k2] = L.coada.lista[L.coada.k]; pornesteCapitol($("#ecran"), c2, k2, "exerseaza", L.coada); }
  };
  $("#cp-prog").textContent = `Mutarea ${Math.min(L.i + 1, L.mut.length)} din ${L.mut.length}`;
  $("#cp-err").textContent = L.mod === "invata" ? "" : `Greșeli: ${L.erori}`;
  $("#cp-bara").style.width = Math.round(L.i / L.mut.length * 100) + "%";
  const lm = $("#cp-lm");
  const jucate = L.ist.slice(1);
  lm.innerHTML = `<div class="lm-cap">${iconSVG("bk", 16)}<span>${esc(L.c.nume)}</span></div><div class="lm-grid">${jucate.map((p, j) => {
    const san = L.mut[j] ? L.mut[j][0] + (L.mut[j][3] || "") : A.sanDin(L.ist[j].fen, p.u);
    return `${j % 2 === 0 ? `<span class="mn">${j / 2 + 1}.</span>` : ""}<button class="mm ${(L.vi == null ? jucate.length : L.vi) === j + 1 ? "on" : ""} ${(j % 2 === 0) === (L.eu === "w") ? "eu" : ""}" data-k="${j + 1}"><span class="sn">${fig(san)}</span></button>`;
  }).join("")}${jucate.length % 2 ? "<span></span>" : ""}</div>`;
  lm.onclick = e => { const b = e.target.closest("[data-k]"); if (!b || ["adv", "pauza", "gresit"].includes(L.stare)) return; const k = +b.dataset.k; L.vi = k === L.ist.length - 1 ? null : k; deseneaza(); };
  const on = $(".mm.on", lm); if (on) lm.scrollTop = on.offsetTop - lm.clientHeight / 2;
}

// ───────── TOATE DESCHIDERILE (teoria Lichess) ─────────
async function date() {
  if (!D) {
    const toate = await fetch("deschideri.json?v=40").then(r => r.json());
    const fams = new Map();
    toate.forEach(([eco, nume], i) => { const f = (nume || "").split(":")[0].trim(); if (!fams.has(f)) fams.set(f, []); fams.get(f).push(i); });
    D = { toate, fams };
  }
  return D;
}
const sub = n => ((n || "").includes(":") ? n.split(":").slice(1).join(":").trim() : "Linia principală");
const ECO = [["", "Toate"], ["A", "A · flanc"], ["B", "B · semi-deschise"], ["C", "C · deschise"], ["D", "D · închise"], ["E", "E · indiene"]];
const RO = { siciliana: "sicilian", italiana: "italian", franceza: "french", spaniola: "ruy lopez", scandinava: "scandinavian", engleza: "english",
  olandeza: "dutch", viena: "vienna", rusa: "russian", slava: "slav", catalana: "catalan", londra: "london", nimzoindiana: "nimzo indian",
  indiana: "indian", moderna: "modern", gambitul: "gambit", damei: "queen", regelui: "king", apararea: "defense", deschiderea: "opening",
  varianta: "variation", atacul: "attack", sistemul: "system", scotiana: "scotch", spaniol: "ruy lopez", daneza: "danish", grunfeld: "grunfeld", partida: "game" };
function movTxt(san, max = 99) {
  const s = san.split(" ");
  return s.slice(0, max).map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}.` : "") + fig(m)).join(" ") + (s.length > max ? " …" : "");
}
async function tabToate(c) {
  const d = await date();
  const q = FD.q.trim().toLowerCase();
  if (!d.norm) d.norm = d.toate.map(([eco, nume]) => norm(nume) + " " + eco.toLowerCase());
  const cuv = norm(q).split(" ").filter(Boolean).map(w => RO[w] || w);
  const potr = i => { const [eco, , san] = d.toate[i]; return (!FD.eco || eco[0] === FD.eco) && (!q || cuv.every(w => d.norm[i].includes(w)) || san.toLowerCase().startsWith(q)); };
  const rowLinie = i => { const [eco, nume, san] = d.toate[i]; return `<button class="fam" data-d="${i}"><span class="eco">${eco}</span><span><span class="t">${esc(sub(nume))}</span><span class="s" style="display:block">${esc(movTxt(san, 12))}</span></span><span>${ico("next", 16)}</span></button>`; };
  let corp;
  if (q.length >= 2) {
    const ids = d.toate.map((_, i) => i).filter(potr);
    corp = `<p class="sub" style="margin:8px 0">${plural(ids.length, "linie găsită", "linii găsite")}${ids.length > 120 ? ", primele 120" : ""}.</p><div class="card">${ids.slice(0, 120).map(rowLinie).join("")}</div>`;
  } else {
    const fams = [...d.fams.entries()].map(([f, ids]) => [f, ids.filter(potr)]).filter(([, ids]) => ids.length).sort((a, b) => a[0].localeCompare(b[0]));
    corp = `<div class="card">${fams.map(([f, ids]) => {
      const [eco, , san] = d.toate[ids[0]], deschis = FD.deschis === f;
      return `<button class="fam" data-fam="${esc(f)}" aria-expanded="${deschis}"><span class="eco">${eco}</span><span><span class="t">${esc(numeRo(f))}</span><span class="s" style="display:block">${esc(movTxt(san, 8))}</span></span><span class="sub">${ids.length}</span></button>
        ${deschis ? `<div class="sub-lista">${ids.map(rowLinie).join("")}</div>` : ""}`;
    }).join("")}</div>`;
  }
  c.innerHTML = `<input class="cauta" id="d-q" type="search" placeholder="Caută: Siciliana, Italiana, B20, e4 c5…" value="${esc(FD.q)}" autocomplete="off" spellcheck="false">
    <div class="chips" id="d-eco" style="margin-bottom:10px">${ECO.map(([k, l]) => `<button class="chip" data-e="${k}" aria-pressed="${FD.eco === k}">${l}</button>`).join("")}</div>${corp}`;
  const inp = $("#d-q");
  inp.oninput = () => { FD.q = inp.value; clearTimeout(inp._t); inp._t = setTimeout(() => { tabToate(c).then(() => { const x = $("#d-q"); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }); }, 220); };
  $("#d-eco").onclick = e => { const b = e.target.closest("[data-e]"); if (b) { FD.eco = b.dataset.e; tabToate(c); } };
  $$("[data-fam]", c).forEach(b => (b.onclick = () => { FD.deschis = FD.deschis === b.dataset.fam ? null : b.dataset.fam; tabToate(c); }));
  $$("[data-d]", c).forEach(b => (b.onclick = () => { location.hash = "d-" + b.dataset.d; }));
}

// ───────── CE JOCI TU (din partidele tale) ─────────
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
    p.dl = { v: 1, n: S.teorie.numeDeschidere(fens) || A.numeDinEcoUrl(p.eco) || "Necunoscută", s: sans.join(" ") };
    noi.push(p);
    if (++k % 40 === 0) { progres && progres(k); await new Promise(r => setTimeout(r)); }
  }
  if (noi.length) db.punMulte("partide", noi).catch(() => {});
}
async function tabMeu(c, cur) {
  const d = await date();
  const grup = { w: new Map(), b: new Map() };
  for (const p of S.partide) {
    if (!p.dl) continue;
    const m = grup[culoareaMea(p)], f = p.dl.n.split(":")[0].trim();
    if (!m.has(f)) m.set(f, []);
    m.get(f).push(p);
  }
  const indexNume = new Map(); d.toate.forEach(([, n], i) => { if (!indexNume.has(n)) indexNume.set(n, i); });
  const cursPt = (cul, f) => cur.cursuri.find(x => x.culoare === cul && x.familii.some(ff => norm(f).startsWith(norm(ff).split(" ").slice(0, 2).join(" "))));
  const sect = (cul, titlu) => {
    const fams = [...grup[cul].entries()].sort((a, b) => b[1].length - a[1].length);
    if (!fams.length) return "";
    return `<h2 class="sect-t">${titlu}</h2><div class="card">${fams.map(([f, ps]) => {
      const s = scor(ps), ch = cul + f, deschis = FD.deschisMeu === ch, cu = cursPt(cul, f);
      let det = "";
      if (deschis) {
        const v = new Map(); ps.forEach(p => { if (!v.has(p.dl.n)) v.set(p.dl.n, []); v.get(p.dl.n).push(p); });
        det = `<div class="sub-lista">${cu ? `<a class="fam" href="#curs-${cu.id}"><span class="eco">${iconSVG("bk", 18)}</span><span><span class="t">Cursul recomandat: ${esc(cu.nume)}</span><span class="s" style="display:block">${esc(cu.stil)}</span></span><span>${ico("next", 16)}</span></a>` : ""}
          ${[...v.entries()].sort((a, b) => b[1].length - a[1].length).map(([n, pv]) => {
          const sv = scor(pv), i = indexNume.get(n);
          return `<button class="fam" ${i != null ? `data-d="${i}"` : `data-p="${esc(pv[0].id)}"`}><span class="eco">${pv.length}</span><span><span class="t">${esc(sub(n))}</span><span class="s" style="display:block">${sv.pct}% scor · ultima ${dataRo(pv[0].ts)}</span></span>${baraWDL(sv)}</button>`;
        }).join("")}</div>`;
      }
      return `<button class="fam" data-m="${esc(ch)}" aria-expanded="${deschis}"><span class="eco">${ps.length}</span><span><span class="t">${esc(numeRo(f))}</span>
        <span class="s" style="display:block">${s.castig} câștigate · ${s.remiza} remize · ${s.pierdere} pierdute · ${s.pct}% scor</span></span>${baraWDL(s)}</button>${det}`;
    }).join("")}</div>`;
  };
  c.innerHTML = `<p class="sub">Toate partidele tale, grupate după deschidere. Atinge o familie ca să vezi variantele și cursul potrivit.</p>
    ${sect("w", "Cu albul")}${sect("b", "Cu negrul")}${S.partide.length ? "" : `<div class="gol"><p>Nu ai încă partide. Sincronizează-le din pagina Partide.</p></div>`}`;
  $$("[data-m]", c).forEach(b => (b.onclick = () => { FD.deschisMeu = FD.deschisMeu === b.dataset.m ? null : b.dataset.m; tabMeu(c, cur); }));
  $$("[data-d]", c).forEach(b => (b.onclick = () => { location.hash = "d-" + b.dataset.d; }));
  $$("[data-p]", c).forEach(b => (b.onclick = () => { location.hash = "p-" + b.dataset.p; }));
}

// ───────── studiul unei linii din teorie: pas cu pas, cu Stockfish live și exersare ─────────
export async function linie(el, idx) {
  curata();
  const d = await date(), x = d.toate[+idx];
  if (!x) { location.hash = "deschideri"; return; }
  const [eco, nume, san] = x;
  const ch = new Chess(), mut = [];
  for (const s of san.split(" ")) { const m = ch.move(s); mut.push([m.san, m.from + m.to + (m.promotion || ""), "", ""]); }
  const fam = nume.split(":")[0].trim();
  el.innerHTML = cadruJoc({ titlu: esc(numeRo(fam)), sub: `${eco} · ${esc(sub(nume))}`, icon: `<span class="titlu-ic">${iu("deschideri", 26)}</span>`, inapoi: "#deschideri", nav: ["first", "prev", "next", "last"],
    extra: `<button class="btn ghost icon" id="b-flip" aria-label="Întoarce tabla">${ico("flip", 20)}</button>` });
  T = new TablaUI($("#tb"), {});
  const fens = [START]; { const c2 = new Chess(); for (const m of mut) { A.incearca(c2, m[1]); fens.push(c2.fen()); } }
  L = { studiu: true, mut, fens, i: mut.length, flip: false, nume, eco, ev: null, idx };
  $("#b-flip").onclick = () => { L.flip = !L.flip; desStudiu(); };
  $("#nav").onclick = e => { const b = e.target.closest("[data-n]"); if (b) navStudiu(b.dataset.n); };
  addEventListener("keydown", tasta);
  desStudiu();
  return curata;
}
function navStudiu(n) {
  if (!L || !L.studiu) return;
  const v = L.i;
  if (n === "first") L.i = 0; if (n === "prev") L.i = Math.max(0, L.i - 1); if (n === "next") L.i = Math.min(L.mut.length, L.i + 1); if (n === "last") L.i = L.mut.length;
  if (v !== L.i) { if (n === "next" && S.set.sunete) sunetMutare(L.mut[L.i - 1][0]); desStudiu(); }
}
function desStudiu() {
  const fen = L.fens[L.i], ult = L.i ? L.mut[L.i - 1][1] : null;
  const arrows = [];
  if (L.i < L.mut.length) arrows.push(sageata(L.mut[L.i][1], CULORI.be, .7));
  if (L.ev && L.ev.fen === fen && L.ev.linii[0] && (!arrows.length || arrows[0].from + arrows[0].to !== L.ev.linii[0].pv[0].slice(0, 4))) arrows.push(sageata(L.ev.linii[0].pv[0], CULORI.rec, .6));
  T.set({ fen, flip: L.flip, hl: ultima(ult), arrows, interactiv: false });
  stareNav({ first: L.i > 0, prev: L.i > 0, next: L.i < L.mut.length, last: L.i < L.mut.length });
  let n = null; for (const f of L.fens.slice(0, L.i + 1)) { const k = S.teorie.nume[A.Teorie.cheie(f)]; if (k) n = k; }
  $("#pc").innerHTML = `${bula({ cap: `<span>${n ? esc(numeRo(n[1])) : "Poziția de start"}</span>${n ? `<span class="ev alb">${n[0]}</span>` : ""}`,
      corp: `<p>${L.i < L.mut.length ? `Următoarea mutare din teorie: <b>${fig(L.mut[L.i][0])}</b> (săgeata verde). Săgeata albastră e recomandarea lui Stockfish.` : "Sfârșitul liniei din teorie. De aici partida iese din cărți."}</p>`,
      act: `<button class="btn primar" data-ex="w">${ico("play", 16)}Exersează cu albul</button><button class="btn" data-ex="b">${ico("play", 16)}Exersează cu negrul</button>` })}
    <div class="linii" id="d-motor"><div class="ln-cap"><span class="spin mic"></span> <b>Stockfish</b> analizează…</div></div>
    <div class="lista-m"><div class="lm-grid">${L.mut.map((m, j) => `${j % 2 === 0 ? `<span class="mn">${j / 2 + 1}.</span>` : ""}<button class="mm ${L.i === j + 1 ? "on" : ""}" data-k="${j + 1}"><span class="sn">${fig(m[0])}</span></button>`).join("")}</div></div>`;
  $("#pc").onclick = e => {
    const b = e.target.closest("[data-k],[data-ex]"); if (!b) return;
    if (b.dataset.k) { L.i = +b.dataset.k; desStudiu(); return; }
    const cul = b.dataset.ex, nume = L.nume, idx = L.idx;
    const c = { id: "db", db: idx, nume: numeRo(nume.split(":")[0].trim()), culoare: cul, capitole: [] };
    const k = { id: "linie", nume: sub(nume), mutari: L.mut };
    pornesteCapitol($("#ecran"), c, k, "exerseaza", null);
  };
  motorStudiu(fen);
}
function motorStudiu(fen) {
  const l = L;
  if (new Chess(fen).isGameOver()) { const m = $("#d-motor"); if (m) m.innerHTML = `<div class="ln-cap"><b>Stockfish</b> · partida s-a terminat</div>`; return; }
  motorLive().analizeaza(fen, S.set.adancimeLive || 18, r => {
    if (L !== l || !L.studiu || L.fens[L.i] !== r.fen) return;
    const prim = !L.ev || L.ev.fen !== r.fen;
    L.ev = r;
    const el = $("#d-motor"); if (!el) return;
    el.innerHTML = `<div class="ln-cap"><b>Stockfish 19</b> · adâncime ${r.adancime}${r.final ? "" : ` <span class="spin mic"></span>`}</div>${r.linii.slice(0, 3).map(li => {
      const ch = new Chess(fen), sans = [];
      for (const u of li.pv.slice(0, 8)) { const m = A.incearca(ch, u); if (!m) break; sans.push(m.san); }
      return `<div class="ln"><span class="lev ${A.winPct(li.ev, "w") >= 50 ? "alb" : "negru"}">${A.evText(li.ev).replace(".", ",")}</span><span class="lmv">${sans.map(s => `<span class="lm">${fig(s)}</span>`).join("")}</span></div>`;
    }).join("")}`;
    if (prim) { const arrows = []; if (L.i < L.mut.length) arrows.push(sageata(L.mut[L.i][1], CULORI.be, .7)); if (r.linii[0] && (!arrows.length || arrows[0].from + arrows[0].to !== r.linii[0].pv[0].slice(0, 4))) arrows.push(sageata(r.linii[0].pv[0], CULORI.rec, .6)); T.set({ arrows }); }
  });
}

// pentru testele automate
export const _test = () => L;
