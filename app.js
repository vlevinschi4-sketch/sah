// app.js — pornirea aplicației, rutarea, pagina Acasă, istoria partidelor, sincronizarea, analiza în lot,
// importul PGN și setările. Paginile mari (analiza, dezlegări, deschideri, învață, statistici) sunt în module separate.
import * as A from "./analiza.js?v=40";
import { Chess } from "./chess.js?v=40";
import { S, motoare, culoareaMea, rezultat, analizeaza, inSerie, numeDeschidere, partideSortate, mele, statEx, serie, zileActive,
  incarcaExercitii, incarcaCursuri, vazute } from "./stare.js?v=40";
import { db, setari, salveazaSetari, sincronizeaza, partidaDinPgn } from "./date.js?v=40";
import { iconSVG } from "./tabla.js?v=40";
import { cadruJoc, bula, miniTabla, capPagina, avatar, foaie, inchideFoaie } from "./cadru.js?v=40";
import { $, $$, esc, af, dataLunga, toast, timp, ico, iu, plural, ziKey, alege } from "./util.js?v=40";
import * as Review from "./review.js?v=40";
import * as Dz from "./dezlegari.js?v=40";
import * as Ds from "./deschideri.js?v=40";
import * as Inv from "./invata.js?v=40";
import * as St from "./statistici.js?v=40";

export const VERSIUNE = "4.0";

// ───────── rutare ─────────
// fiecare rută: [expresie, fila din meniu, ecran plin (tablă + panou), funcția care desenează]; funcția poate întoarce o funcție de curățenie
const RUTE = [
  [/^$/, "acasa", false, el => randeazaAcasa(el)],
  [/^partide$/, "partide", false, el => randeazaPartide(el)],
  [/^p-(.+)$/, "partide", true, (el, m) => Review.deschide(el, m[1])],
  [/^dezlegari$/, "dezlegari", false, el => Dz.hub(el)],
  [/^sesiune$/, "dezlegari", true, el => Dz.sesiune(el)],
  [/^rush$/, "dezlegari", true, el => Dz.rush(el)],
  [/^deschideri$/, "deschideri", false, el => Ds.hub(el)],
  [/^curs-([\w-]+)$/, "deschideri", false, (el, m) => Ds.curs(el, m[1])],
  [/^cap-([\w-]+)\/([\w-]+)\/(invata|exerseaza)$/, "deschideri", true, (el, m) => Ds.capitol(el, m[1], m[2], m[3])],
  [/^recap$/, "deschideri", true, el => Ds.recap(el)],
  [/^d-(\d+)$/, "deschideri", true, (el, m) => Ds.linie(el, m[1])],
  [/^invata$/, "invata", false, el => Inv.hub(el)],
  [/^lectie-([\w-]+)$/, "invata", false, (el, m) => Inv.lectie(el, m[1])],
  [/^final-([\w-]+)$/, "invata", true, (el, m) => Inv.final(el, m[1])],
  [/^statistici$/, "statistici", false, el => St.randeaza(el)],
];
let curatenie = null;
async function ruta() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (curatenie) { try { curatenie(); } catch (e) { console.warn(e); } curatenie = null; }
  const r = RUTE.find(([re]) => re.test(h));
  if (!r) { location.hash = ""; return; }
  const [re, tab, plin, f] = r;
  $$("[data-t]").forEach(a => a.setAttribute("aria-current", a.dataset.t === tab ? "page" : "false"));
  document.body.classList.toggle("plin", plin);
  S.precedenta = S.curenta; S.curenta = h;
  if (!plin) S.inapoi = h;
  const el = $("#ecran");
  el.className = plin ? "" : "pagina";
  const TITLU = { acasa: "", partide: "Partide", dezlegari: "Dezlegări", deschideri: "Deschideri", invata: "Învață", statistici: "Statistici" };
  document.title = h.startsWith("p-") ? "Analiza partidei · Șah local" : TITLU[tab] ? `${TITLU[tab]} · Șah local` : "Șah local";
  if (S.set) $("#top-serie").innerHTML = `${iu("flacara", 22)}<span>${serie()}</span>`;
  scrollTo(0, 0);
  arataPastila();
  try {
    const c = await f(el, h.match(re));
    if (typeof c === "function") curatenie = c;
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="gol"><h3>Ceva n-a mers</h3><p>${esc(e.message)}</p><a class="btn" href="#">Acasă</a></div>`;
  }
}
addEventListener("hashchange", ruta);
export const inapoi = () => "#" + (S.inapoi || "");

// ───────── ACASĂ ─────────
const NT = { rapid: "Rapid", blitz: "Blitz", bullet: "Bullet", daily: "Zilnic", importata: "Importate" };
const ICON_TC = { rapid: "rapid", blitz: "blitz", bullet: "bullet", daily: "zilnic" };
function nrMutari(p) {
  if (p.nm == null) {
    const k = (p.pgn.match(/\[%clk/g) || []).length;
    p.nm = Math.ceil((k || A.citestePgn(p.pgn).mutari.length) / 2);
  }
  return p.nm;
}
function fenFinal(p) {
  if (!p.ff) { try { const info = A.citestePgn(p.pgn); p.ff = info.fens[info.fens.length - 1]; } catch (e) { p.ff = new Chess().fen(); } }
  return p.ff;
}
function randIstorie(p) {
  const c = culoareaMea(p), [cls] = rezultat(p);
  const W = p.alb, B = p.negru, rw = W.rez === "win" ? "1" : B.rez === "win" ? "0" : "½", rb = B.rez === "win" ? "1" : W.rez === "win" ? "0" : "½";
  const st = p.sumar ? { w: A.cuRatinguri(p.sumar.alb), b: A.cuRatinguri(p.sumar.negru) } : null;
  const lotAici = S.lot && S.lot.curent === p.id;
  const tc = ICON_TC[p.timeClass];
  const jucator = (j, cul) => `<div><i class="${cul === "w" ? "alb" : "negru"} ${j.rez === "win" ? "castig" : ""}"></i><b>${esc(j.user)}</b><span class="rt">${j.rating ? `(${j.rating})` : ""}</span></div>`;
  return `<div class="ist-r" data-id="${esc(p.id)}" role="button" tabindex="0">
    <span class="ist-tc">${tc ? iu(tc, 24) : iu("import", 24)}<span>${esc(timp(p))}</span></span>
    <span class="ist-j">${jucator(W, "w")}${jucator(B, "b")}</span>
    <span class="ist-rez"><span class="sc"><span>${rw}</span><span>${rb}</span></span><span class="ic ${cls}" aria-label="${rezultat(p)[2]}">${cls === "castig" ? "+" : cls === "pierdere" ? "−" : "="}</span></span>
    <span class="ist-acc">${st ? `<span>${af(st.w.acc)}</span><span>${af(st.b.acc)}</span>` : lotAici ? `<span class="sub" id="pr-${esc(p.id)}"><span class="spin mic"></span> ${S.lot.pct || 0}%</span>` : `<span class="btn mic" data-an="${esc(p.id)}"><span class="lung">Raportul partidei</span><span class="scurt">Raport</span></span>`}</span>
    <span class="ist-n">${nrMutari(p)}</span>
    <span class="ist-d">${dataLunga(p.ts)}</span>
  </div>`;
}
function tabelIstorie(lista, jos = "") {
  return `<div class="card ist"><div class="card-h">Istoria jocului<span class="spatiu"></span>${jos}</div>
    <div class="ist-cap"><span></span><span>Jucători</span><span>Rezultat</span><span>Precizie</span><span>Mutări</span><span>Dată</span></div>
    <div class="ist-corp">${lista.map(randIstorie).join("")}</div>
    ${lista.length ? "" : `<div class="gol"><p>Nicio partidă încă. Apasă Sincronizează ca să aduci partidele lui ${esc(S.set.user)} de pe Chess.com.</p></div>`}</div>`;
}
function legaIstorie(el) {
  $$(".ist-r", el).forEach(r => {
    r.onclick = () => { location.hash = "p-" + r.dataset.id; };
    r.onkeydown = e => { if (e.key === "Enter") r.onclick(); };
  });
}
async function randeazaAcasa(el) {
  const ps = partideSortate(), ult = ps[0], st = statEx(), n = serie();
  const ratingRapid = (() => { const p = ps.find(q => q.timeClass === "rapid"); return p ? (culoareaMea(p) === "w" ? p.alb : p.negru).rating : null; })();
  const ratingBlitz = (() => { const p = ps.find(q => q.timeClass === "blitz"); return p ? (culoareaMea(p) === "w" ? p.alb : p.negru).rating : null; })();
  const an = ps.filter(p => p.sumar).slice(0, 20).map(mele);
  const accMed = an.length ? an.reduce((s, x) => s + (x.acc || 0), 0) / an.length : null;
  const azi = st.zile[ziKey()] || 0;
  const zile = zileActive();
  const sapt = []; for (let k = 6; k >= 0; k--) { const d = new Date(); d.setDate(d.getDate() - k); sapt.push(d); }
  const LIT = ["D", "L", "M", "M", "J", "V", "S"];
  const ultDesch = ult ? `vs ${esc((culoareaMea(ult) === "w" ? ult.negru : ult.alb).user)}` : "Nicio partidă";
  el.innerHTML = `
    <div class="acasa-cap">${avatar(S.set.user)}<h1>${esc(S.set.user)}</h1><span class="spatiu"></span>
      <a class="serie" href="#statistici" title="Zile consecutive cu partide sau antrenament">${iu("flacara", 30)}<span>${plural(n, "Zi", "Zile")}</span></a></div>
    <section class="acasa-top">
      <div class="acasa-act">
        <h3>Antrenament</h3>
        ${ult ? `<a class="btn primar mare" href="#p-${esc(ult.id)}">${ult.sumar ? "Analiza ultimei partide" : "Analizează ultima partidă"}</a>`
              : `<button class="btn primar mare" id="a-sync">${ico("sync", 20)}Adu partidele</button>`}
        <a class="btn" href="#dezlegari">${iu("dezlegari", 26)}Dezlegări</a>
        <a class="btn" href="#rush">${iu("rush", 26)}Puzzle Rush</a>
        <a class="btn" href="#deschideri">${iu("deschideri", 26)}Deschiderile mele</a>
        <button class="btn" id="a-greseli">${iu("tinta", 26)}Învață din greșeli</button>
      </div>
      <div class="bcard" id="c-ex">${miniTabla(new Chess().fen())}<div class="bcard-t">${iu("dezlegari", 28)}<span><b>${st.rating}</b> <span class="sub">· ${plural(azi, "rezolvat", "rezolvate")} azi</span></span></div>
        <div class="bara"><i style="width:${Math.min(100, azi * 10)}%"></i></div><a class="btn" href="#dezlegari">Rezolvă puzzle-uri</a></div>
      <div class="bcard" id="c-ds">${miniTabla(new Chess().fen())}<div class="bcard-t">${iu("deschideri", 28)}<span id="c-ds-t">Deschideri</span></div><a class="btn" href="#deschideri" id="c-ds-b">Lecția următoare</a></div>
      <div class="bcard" id="c-ult">${miniTabla(ult ? fenFinal(ult) : new Chess().fen(), { flip: ult && culoareaMea(ult) === "b" })}
        <div class="bcard-t">${avatar(ult ? (culoareaMea(ult) === "w" ? ult.negru : ult.alb).user : "?", "mic")}<span>${ultDesch}</span></div>
        ${ult ? `<a class="btn" href="#p-${esc(ult.id)}">Analizați partida</a>` : `<a class="btn" href="#partide">Partide</a>`}</div>
    </section>
    <div class="acasa-grid">
      <div class="acasa-st">${tabelIstorie(ps.slice(0, 10), "")}
        ${ps.length > 10 ? `<div class="ist-jos card" style="margin-top:-8px;border-radius:0 0 8px 8px"><a class="lnk alb-t" href="#partide">Vezi toate jocurile ›</a></div>` : ""}</div>
      <div class="acasa-dr">
        <div class="card" id="c-zilei"><div class="card-h">Puzzle-ul zilei<span class="spatiu"></span><span class="sub" id="c-zilei-r"></span></div>
          <div class="card-b"><div id="c-zilei-tb">${miniTabla(new Chess().fen())}</div><p class="sub" id="c-zilei-t" style="margin:10px 0">Se încarcă…</p>
          <a class="btn primar plin" href="#dezlegari" id="c-zilei-b">Rezolvă Exercițiul zilnic</a></div></div>
        <div class="card"><div class="card-b" style="padding-top:14px">
          <div style="display:flex;align-items:center;gap:10px">${iu("flacara", 34)}<div><b class="alb-t" style="font-size:17px">${plural(n, "zi consecutivă", "zile consecutive")}</b><div class="sub">partide jucate sau antrenament</div></div></div>
          <div class="zile">${sapt.map((d, k) => `<span><i class="${zile.has(ziKey(d)) ? "ok" : ""} ${k === 6 ? "azi" : ""}">${zile.has(ziKey(d)) ? "✓" : ""}</i>${LIT[d.getDay()]}</span>`).join("")}</div></div></div>
        <div class="card" id="c-gres"></div>
        <div class="card"><div class="card-h">Statistici</div>
          <div class="st-grid" style="padding:0 12px 12px;grid-template-columns:1fr 1fr">
            <a class="st-tile" href="#statistici" style="text-decoration:none;background:var(--panel-3)">${iu("rapid", 26)}<span class="v">${ratingRapid ?? "—"}</span><span class="l">Rapid</span></a>
            <a class="st-tile" href="#statistici" style="text-decoration:none;background:var(--panel-3)">${iu("blitz", 26)}<span class="v">${ratingBlitz ?? "—"}</span><span class="l">Blitz</span></a>
            <a class="st-tile" href="#dezlegari" style="text-decoration:none;background:var(--panel-3)">${iu("dezlegari", 26)}<span class="v">${st.rating}</span><span class="l">Dezlegări</span></a>
            <a class="st-tile" href="#statistici" style="text-decoration:none;background:var(--panel-3)">${iconSVG("be", 26)}<span class="v">${accMed != null ? af(accMed) : "—"}</span><span class="l">Precizie medie</span></a>
          </div>
          <div class="ist-jos"><a class="lnk alb-t" href="#statistici">Vizualizează tot ›</a></div></div>
      </div>
    </div>`;
  legaIstorie(el);
  const bs = $("#a-sync"); if (bs) bs.onclick = () => sincronizare(true);
  $("#a-greseli").onclick = () => Dz.sesiuneGreseli();
  // cardurile care au nevoie de date încărcate separat
  Dz.exercitiulZilei().then(z => {
    if (!z || !$("#c-zilei")) return;
    $("#c-zilei-tb").innerHTML = miniTabla(z.fenArata, { flip: z.flip, hl: z.hl });
    $("#c-zilei-t").innerHTML = `${esc(z.titlu)}${z.rezolvat ? ` · <span class="k-be">rezolvat azi ✓</span>` : ""}`;
    $("#c-zilei-r").textContent = `≈${z.ex.r}`;
    $("#c-zilei-b").onclick = e => { e.preventDefault(); Dz.pornesteZilnic(); };
    const ex = $("#c-ex .tabla-mini"); if (ex && z.urm) ex.outerHTML = miniTabla(z.urm.fenArata, { flip: z.urm.flip, hl: z.urm.hl });
  }).catch(() => {});
  Ds.urmatoareaLectie().then(u => {
    if (!u || !$("#c-ds")) return;
    $("#c-ds .tabla-mini").outerHTML = miniTabla(u.fen, { flip: u.flip });
    $("#c-ds-t").innerHTML = `<span>${esc(u.titlu)}</span>`;
    const b = $("#c-ds-b"); b.textContent = u.buton; b.href = u.href;
  }).catch(() => {});
  Inv.cardGreseli().then(h => { const c = $("#c-gres"); if (c) { if (h) c.innerHTML = h; else c.remove(); Inv.legaCardGreseli(c); } }).catch(() => {});
}

// ───────── PARTIDE (toată istoria) ─────────
let pagini = 1;
function filtreaza(lista) {
  const f = S.filtru;
  return lista.filter(p => f === "toate" || (f === "analizate" ? !!p.sumar : f === "neanalizate" ? !p.sumar : p.timeClass === f));
}
function randeazaPartide(el) {
  const lista = partideSortate(), an = lista.filter(p => p.sumar);
  const m = an.map(mele);
  const med = xs => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const accMed = med(m.map(s => s.acc).filter(x => x != null)), grMed = med(m.map(s => s.gRating).filter(x => x != null));
  const tipuri = [...new Set(lista.map(p => p.timeClass))].filter(Boolean);
  const filtrate = filtreaza(lista), neanal = filtrate.filter(p => !p.sumar).length;
  el.innerHTML = `${capPagina("partide", "Partide", `<span class="sub">${esc(S.set.user)} · Chess.com</span>`)}
    <div class="st-grid" style="margin-bottom:14px">
      <div class="st-tile"><span class="l">Partide</span><span class="v">${lista.length}</span><span class="x">${an.length} analizate</span></div>
      <div class="st-tile"><span class="l">Precizie medie</span><span class="v">${accMed != null ? af(accMed) + "%" : "—"}</span><span class="x">în partidele analizate</span></div>
      <div class="st-tile"><span class="l">Evaluarea jocului</span><span class="v">${grMed != null ? Math.round(grMed / 5) * 5 : "—"}</span><span class="x">rating estimat din joc</span></div>
    </div>
    <div class="act" style="margin-bottom:12px">
      <button class="btn primar" id="b-sync2">${ico("sync")}Sincronizează</button>
      <button class="btn" id="b-lot" ${neanal || S.lot ? "" : "disabled"}>${ico(S.lot ? "pause" : "play")}${S.lot ? "Oprește analiza" : `Analizează ${neanal ? plural(neanal, "partidă", "partide") : "tot"}`}</button>
      <button class="btn" id="b-pgn">${ico("plus")}Importă PGN</button>
    </div>
    <div class="chips" id="filtre" style="margin-bottom:12px">${[["toate", "Toate"], ...tipuri.map(t => [t, NT[t] || t]), ["analizate", "Analizate"], ["neanalizate", "Neanalizate"]]
      .map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${S.filtru === k}">${l}</button>`).join("")}</div>
    ${tabelIstorie(filtrate.slice(0, pagini * 30))}
    ${filtrate.length > pagini * 30 ? `<div class="act" style="justify-content:center;margin-top:12px"><button class="btn" id="b-mai">Arată mai multe (${filtrate.length - pagini * 30})</button></div>` : ""}`;
  legaIstorie(el);
  $("#b-sync2").onclick = () => sincronizare(true);
  $("#b-lot").onclick = () => (S.lot ? (S.lot.semnal.oprit = true) : pornesteLot(filtrate.filter(p => !p.sumar)));
  $("#b-pgn").onclick = deschideImport;
  $("#filtre").onclick = e => { const b = e.target.closest("[data-f]"); if (b) { S.filtru = b.dataset.f; pagini = 1; randeazaPartide(el); } };
  const mai = $("#b-mai"); if (mai) mai.onclick = () => { pagini++; randeazaPartide(el); };
}
const rerandeazaLista = () => { const h = location.hash.slice(1); if (h === "" || h === "partide") ruta(); };

async function sincronizare(manual) {
  const b = $("#b-sync"); if (b) b.disabled = true;
  if (manual) toast("Aduc partidele de pe Chess.com…", 1500);
  try {
    const noi = await sincronizeaza(S.set.user, S.set.luni || 3);
    S.set.ultimaSync = Date.now(); await salveazaSetari(S.set);
    S.partide = await db.toate("partide");
    if (manual || noi) toast(noi ? `Am adus ${plural(noi, "partidă nouă", "partide noi")}.` : "Nu sunt partide noi.");
    if (noi || manual) rerandeazaLista();
  } catch (e) {
    toast(navigator.onLine ? e.message : "Ești offline. Partidele salvate rămân disponibile.");
  }
  if (b) b.disabled = false;
}

// ───────── analiza în lot ─────────
function pornesteLot(lista) {
  if (!lista.length || S.lot) return;
  const lot = S.lot = { lista: [...lista], gata: 0, total: lista.length, semnal: { oprit: false }, curent: null, pct: 0 };
  arataPastila();
  inSerie(async () => {
    for (const p of lot.lista) {
      if (lot.semnal.oprit) break;
      if (p.sumar) { lot.gata++; continue; }
      lot.curent = p.id; lot.pct = 0;
      rerandeazaLista();
      try {
        await analizeaza(p, (g, n) => { lot.pct = Math.round(g / n * 100); arataPastila(); const e = document.getElementById("pr-" + p.id); if (e) e.innerHTML = `<span class="spin mic"></span> ${lot.pct}%`; }, lot.semnal);
      } catch (e) { if (e.message !== "oprit") toast("O partidă nu s-a putut analiza: " + e.message); }
      lot.gata++;
      arataPastila();
    }
  }).finally(() => {
    const opr = lot.semnal.oprit;
    S.lot = null; arataPastila(); rerandeazaLista();
    toast(opr ? "Analiza a fost oprită." : `Gata: ${plural(lot.gata, "partidă analizată", "partide analizate")}.`);
  });
  rerandeazaLista();
}
function arataPastila() {
  const el = $("#pastila");
  if (!S.lot || document.body.classList.contains("plin")) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<span class="spin" aria-hidden="true"></span><span>Analizez partida ${Math.min(S.lot.gata + 1, S.lot.total)} din ${S.lot.total} · ${S.lot.pct}%</span><button class="btn mic" id="b-stop">Oprește</button>`;
  $("#b-stop").onclick = () => { if (S.lot) S.lot.semnal.oprit = true; };
}

// ───────── IMPORT PGN ─────────
function deschideImport() {
  foaie(`<h2>Importă o partidă</h2><p class="sub">Lipește PGN-ul unei partide (de pe Chess.com, Lichess sau de oriunde).</p>
    <textarea id="pgn-in" rows="9" placeholder='[White "…"]&#10;1. e4 e5 2. Nf3 …'></textarea>
    <div class="act"><button class="btn primar" id="pgn-ok">Adaugă și analizează</button><button class="btn" data-inchide>Renunță</button></div>`);
  $("#pgn-ok").onclick = async () => {
    const t = $("#pgn-in").value.trim();
    try {
      const info = A.citestePgn(t);
      if (!info.mutari.length) throw new Error("gol");
      const p = partidaDinPgn(t, info);
      await db.pune("partide", p); S.partide.push(p);
      inchideFoaie(); location.hash = "p-" + p.id;
    } catch (e) { toast("PGN-ul nu a putut fi citit. Verifică dacă e complet."); }
  };
}

// ───────── SETĂRI ─────────
function deschideSetari() {
  const s = S.set;
  const seg = (nume, val, opt) => `<div class="seg" data-set="${nume}">${opt.map(([v, l]) => `<button type="button" aria-selected="${String(val) === String(v)}" data-v="${v}">${l}</button>`).join("")}</div>`;
  const da = (nume, val) => seg(nume, val ? 1 : 0, [[1, "Da"], [0, "Nu"]]);
  foaie(`<h2>Setări</h2>
    <label class="camp"><span>Utilizator Chess.com</span><input id="set-user" value="${esc(s.user)}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
    <div class="camp"><span>Tabla</span>${seg("tabla", s.tabla || "verde", [["verde", "Verde"], ["maro", "Lemn"], ["albastru", "Albastru"], ["gri", "Gri"]])}</div>
    <h3 class="titlu-set">Analiza partidelor</h3>
    <div class="camp"><span>Profunzimea analizei</span>${seg("adancime", s.adancime, [[12, "Rapidă · 12"], [14, "Normală · 14"], [16, "Profundă · 16"]])}
      <small>Mai profund înseamnă mai precis, dar mai lent, mai ales pe iPhone. Se aplică partidelor analizate de acum încolo.</small></div>
    <div class="camp"><span>Motoare în paralel</span>${seg("motoare", s.motoare || 0, [[0, "Automat"], [1, "1"], [2, "2"], [4, "4"]])}
      <small>Automat folosește nucleele libere (acum ${motoare().n}).</small></div>
    <div class="camp"><span>Analiza live când explorezi</span>${seg("adancimeLive", s.adancimeLive || 18, [[14, "14"], [18, "18"], [22, "22"]])}</div>
    <div class="camp"><span>Câte luni sincronizez</span>${seg("luni", s.luni || 3, [[1, "1"], [3, "3"], [6, "6"], [12, "12"]])}</div>
    <h3 class="titlu-set">Analiza cu mentor</h3>
    <div class="camp"><span>Săgeți pe tablă</span>${seg("sageti", s.sageti || "ambele", [["ambele", "Cea mai bună + recomandată"], ["best", "Doar cea mai bună"], ["nimic", "Fără"]])}
      <small>Verde: ce trebuia jucat în locul mutării. Albastru: mutarea recomandată în poziția de acum.</small></div>
    <div class="camp"><span>Momente cheie pentru</span>${seg("momente", s.momente || "ambii", [["eu", "Tine"], ["adv", "Adversar"], ["ambii", "Amândoi"]])}</div>
    <div class="camp"><span>Clasificarea pe tablă</span>${da("clasaTabla", s.clasaTabla)}</div>
    <div class="camp"><span>Linii Stockfish în analiză</span>${da("liveLinii", s.liveLinii)}</div>
    <div class="camp"><span>Adversarul răspunde singur când muți tu</span>${da("raspunsAuto", s.raspunsAuto !== false)}
      <small>Când joci o mutare pe tablă, Stockfish răspunde automat pentru adversar.</small></div>
    <div class="camp"><span>Pauza între mutări</span>${seg("pauza", s.pauza || 900, [[600, "0,6 s"], [900, "0,9 s"], [1500, "1,5 s"]])}</div>
    <div class="camp"><span>Timpul pe mutare</span>${da("timpMutare", s.timpMutare)}</div>
    <div class="camp"><span>Sunete</span>${da("sunete", s.sunete)}</div>
    <div class="camp"><span>Mentorul citește cu voce</span>${da("voce", s.voce)}</div>
    <div class="act"><button class="btn primar" id="set-ok">Salvează</button><button class="btn" data-inchide>Închide</button></div>
    <div class="pericol"><button class="btn rosu" id="set-sterge">Șterge toate datele locale</button><span id="set-conf"></span></div>
    <p class="nota"><b>Versiunea ${VERSIUNE}.</b> Totul rulează pe dispozitivul tău: Stockfish 19 (GPLv3), chess.js (BSD), deschiderile din setul public Lichess (CC0), piesele cburnett (CC BY-SA). Partidele vin din API-ul public Chess.com. Aspectul e inspirat de Chess.com; aplicația nu e afiliată Chess.com și nu folosește resursele lor.</p>`);
  $$(".foaie [data-set]").forEach(g => (g.onclick = e => { const b = e.target.closest("button"); if (!b) return; $$("button", g).forEach(x => x.setAttribute("aria-selected", x === b)); }));
  $("#set-ok").onclick = async () => {
    const val = n => $(`.foaie [data-set="${n}"] [aria-selected="true"]`).dataset.v;
    const num = n => +val(n), bool = n => val(n) === "1";
    const schimbatMotoare = num("motoare") !== (s.motoare || 0);
    const userNou = $("#set-user").value.trim() || s.user, schimbatUser = userNou.toLowerCase() !== (s.user || "").toLowerCase();
    Object.assign(s, {
      user: userNou, tabla: val("tabla"), adancime: num("adancime"), motoare: num("motoare"), luni: num("luni"), adancimeLive: num("adancimeLive"),
      sageti: val("sageti"), momente: val("momente"), clasaTabla: bool("clasaTabla"), liveLinii: bool("liveLinii"),
      raspunsAuto: bool("raspunsAuto"), pauza: num("pauza"), timpMutare: bool("timpMutare"), sunete: bool("sunete"), voce: bool("voce"),
    });
    await salveazaSetari(s);
    if (schimbatMotoare && S.motoare) { S.motoare.opreste(); S.motoare = null; }
    aplicaAspect();
    inchideFoaie();
    toast("Setările au fost salvate.");
    if (schimbatUser) sincronizare(true);
    if (!document.body.classList.contains("plin")) ruta(); else Review.reimprospateaza();
  };
  $("#set-sterge").onclick = () => {
    const c = $("#set-conf");
    if (c.dataset.armat) return;
    c.dataset.armat = "1";
    c.innerHTML = `Sigur? Se șterg partidele și analizele de pe acest dispozitiv. <button class="btn rosu mic" id="set-da">Da, șterge</button>`;
    $("#set-da").onclick = async () => { await db.goleste("partide"); await db.goleste("analize"); S.partide = []; inchideFoaie(); location.hash = ""; ruta(); toast("Datele locale au fost șterse."); };
  };
}
addEventListener("deschide-setari", deschideSetari);

function aplicaAspect() {
  document.body.dataset.tabla = S.set.tabla || "verde";
  $("#side-user").textContent = S.set.user;
  $("#side-av").textContent = (S.set.user || "?")[0].toUpperCase();
  const n = serie();
  $("#top-serie").innerHTML = `${iu("flacara", 22)}<span>${n}</span>`;
}

// ───────── pornire ─────────
(async function porneste() {
  S.set = await setari();
  A.setDeplasari(S.set.deplasari);
  $("#b-setari").onclick = deschideSetari;
  $("#b-setari-m").onclick = deschideSetari;
  $("#b-sync").onclick = () => sincronizare(true);
  try { S.teorie = new A.Teorie(await (await fetch("teorie.json?v=40")).json()); }
  catch (e) { S.teorie = new A.Teorie({ pozitii: [], nume: {} }); }
  S.partide = await db.toate("partide");
  aplicaAspect();
  ruta();
  const vechi = !S.set.ultimaSync || Date.now() - S.set.ultimaSync > 30 * 60 * 1000;
  if (navigator.onLine && (vechi || !S.partide.length)) sincronizare(false);
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").then(reg => {
      reg.addEventListener("updatefound", () => { const w = reg.installing; w && w.addEventListener("statechange", () => {
        if (w.state === "installed" && navigator.serviceWorker.controller) toast("Versiune nouă instalată. Redeschide aplicația ca s-o folosești.", 6000); }); });
    }).catch(() => {});
  }
})();

// pentru testele automate
export const _test = () => ({ S, ruta });
