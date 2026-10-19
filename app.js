// app.js — pornirea aplicației, lista partidelor, sincronizarea, analiza în lot, importul și setările.
import * as A from "./analiza.js?v=32";
import { S, motoare, culoareaMea, rezultat, analizeaza, inSerie, numeDeschidere } from "./stare.js?v=32";
import { db, setari, salveazaSetari, sincronizeaza, partidaDinPgn } from "./date.js?v=32";
import { iconSVG } from "./tabla.js?v=32";
import { deschideReview, inchideReview, reviewDeschis, reimprospateaza } from "./review.js?v=32";
import { randeazaAntrenor, randeazaExercitii, randeazaSesiune, randeazaLectie, randeazaFinal, inchideAntrenor } from "./antrenor.js?v=32";
import { randeazaDeschideri, randeazaLinie, inchideDeschideri } from "./deschideri.js?v=32";
import { $, $$, esc, af, dataRo, toast, timp, ico } from "./util.js?v=32";

// ───────── LISTA PARTIDELOR ─────────
function ziRo(ts) {
  const d = new Date(ts * 1000), azi = new Date(); azi.setHours(0, 0, 0, 0);
  const z = new Date(d); z.setHours(0, 0, 0, 0);
  const dif = Math.round((azi - z) / 86400000);
  if (dif === 0) return "Azi";
  if (dif === 1) return "Ieri";
  return d.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
}
function filtreaza(lista) {
  const f = S.filtru;
  return lista.filter(p => f === "toate" || (f === "analizate" ? !!p.sumar : f === "neanalizate" ? !p.sumar : p.timeClass === f));
}
function randeazaLista() {
  const el = $("#ecran-lista");
  const lista = [...S.partide].sort((a, b) => b.ts - a.ts);
  const an = lista.filter(p => p.sumar);
  const mele = an.map(p => A.cuRatinguri(culoareaMea(p) === "w" ? p.sumar.alb : p.sumar.negru));
  const med = xs => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const accMed = med(mele.map(s => s.acc).filter(x => x != null));
  const grMed = med(mele.map(s => s.gRating).filter(x => x != null));
  const tipuri = [...new Set(lista.map(p => p.timeClass))].filter(Boolean);
  const NT = { rapid: "Rapid", blitz: "Blitz", bullet: "Bullet", daily: "Zilnic", importata: "Importate" };
  const filtrate = filtreaza(lista);
  const grupe = [];
  filtrate.forEach(p => { const z = ziRo(p.ts); let g = grupe.find(x => x.z === z); if (!g) grupe.push(g = { z, items: [] }); g.items.push(p); });
  const neanal = filtrate.filter(p => !p.sumar).length;
  el.innerHTML = `
    <section class="sumar">
      <div class="stat"><span class="l">Partide</span><span class="v">${lista.length}</span><span class="x">${an.length} analizate</span></div>
      <div class="stat"><span class="l">Acuratețe medie</span><span class="v">${accMed != null ? af(accMed) + "%" : "—"}</span><span class="x">în partidele analizate</span></div>
      <div class="stat"><span class="l">Evaluare medie</span><span class="v">${grMed != null ? Math.round(grMed / 5) * 5 : "—"}</span><span class="x">rating estimat din joc</span></div>
    </section>
    <div class="unelte">
      <button class="btn glass primar" id="b-sync">${ico("sync")}Sincronizează</button>
      <button class="btn glass" id="b-lot" ${neanal || S.lot ? "" : "disabled"}>${ico(S.lot ? "pause" : "play")}${S.lot ? "Oprește analiza" : `Analizează ${neanal ? `${neanal} ${neanal === 1 ? "partidă" : "partide"}` : "tot"}`}</button>
      <button class="btn glass" id="b-pgn">${ico("plus")}Importă PGN</button>
    </div>
    <div class="chips" id="filtre">${[["toate", "Toate"], ...tipuri.map(t => [t, NT[t] || t]), ["analizate", "Analizate"], ["neanalizate", "Neanalizate"]]
      .map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${S.filtru === k}">${l}</button>`).join("")}</div>
    ${lista.length ? "" : `<div class="gol"><h3>Încă nu ai partide aici</h3><p>Apasă Sincronizează ca să aduci partidele lui ${esc(S.set.user)} de pe Chess.com, sau importă un PGN.</p></div>`}
    ${grupe.map(g => `<h3 class="zi">${esc(g.z)}</h3><div class="lista">${g.items.map(randPartida).join("")}</div>`).join("")}
    ${lista.length && !filtrate.length ? `<div class="gol"><p>Nicio partidă în filtrul ăsta.</p></div>` : ""}`;
  $("#b-sync").onclick = () => sincronizare(true);
  $("#b-lot").onclick = () => (S.lot ? (S.lot.semnal.oprit = true) : pornesteLot(filtrate.filter(p => !p.sumar)));
  $("#b-pgn").onclick = deschideImport;
  $("#filtre").onclick = e => { const b = e.target.closest("[data-f]"); if (b) { S.filtru = b.dataset.f; randeazaLista(); } };
  $$(".row[data-id]", el).forEach(b => (b.onclick = () => { location.hash = "p-" + b.dataset.id; }));
}
function randPartida(p) {
  const eu = culoareaMea(p), adv = eu === "w" ? p.negru : p.alb, [cls, lit, rezT] = rezultat(p);
  const st = p.sumar ? A.cuRatinguri(eu === "w" ? p.sumar.alb : p.sumar.negru) : null;
  const desch = numeDeschidere(p);
  const lotAici = S.lot && S.lot.curent === p.id;
  const notabile = st ? ["br", "gr"].filter(k => st.cnt[k]).map(k => iconSVG(k, 15)).join("") : "";
  return `<button class="row" data-id="${esc(p.id)}">
    <span class="res ${cls}" aria-label="${rezT}">${lit}</span>
    <span class="mid"><span class="t">vs ${esc(adv.user)} ${adv.rating ? `<span class="sub">(${adv.rating})</span>` : ""}${notabile}</span>
      <span class="s">${dataRo(p.ts)} · ${timp(p)} · ${eu === "w" ? "albele" : "negrele"}${desch ? " · " + esc(desch) : ""}</span></span>
    <span class="score">${st ? `<b>${af(st.acc)}%</b><small>Evaluare ${st.gRating ?? "—"}</small>` : lotAici ? `<span class="stare" id="pr-${esc(p.id)}">${S.lot.pct || 0}%</span>` : `<span class="stare">Neanalizată</span>`}</span>
  </button>`;
}

async function sincronizare(manual) {
  const b = $("#b-sync");
  if (b) { b.disabled = true; b.innerHTML = `${ico("sync")}Se sincronizează…`; }
  try {
    const noi = await sincronizeaza(S.set.user, S.set.luni || 3, (k, n) => { const x = $("#b-sync"); if (x) x.innerHTML = `${ico("sync")}Luna ${Math.min(k + 1, n)} din ${n}…`; });
    S.set.ultimaSync = Date.now(); await salveazaSetari(S.set);
    S.partide = await db.toate("partide");
    if (manual || noi) toast(noi ? `Am adus ${noi} ${noi === 1 ? "partidă nouă" : "partide noi"}.` : "Nu sunt partide noi.");
  } catch (e) {
    toast(navigator.onLine ? e.message : "Ești offline. Partidele salvate rămân disponibile.");
  }
  if (!$("#ecran-lista").hidden) randeazaLista();
  else if (location.hash === "#antrenor" && S.partide.length) ruta();
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
      if (!$("#ecran-lista").hidden) randeazaLista();
      try {
        await analizeaza(p, (g, n) => { lot.pct = Math.round(g / n * 100); arataPastila(); const e = document.getElementById("pr-" + p.id); if (e) e.textContent = lot.pct + "%"; }, lot.semnal);
      } catch (e) { if (e.message !== "oprit") toast("O partidă nu s-a putut analiza: " + e.message); }
      lot.gata++;
      arataPastila();
    }
  }).finally(() => {
    const opr = lot.semnal.oprit;
    S.lot = null; arataPastila();
    if (!$("#ecran-lista").hidden) randeazaLista();
    toast(opr ? "Analiza a fost oprită." : `Gata: ${lot.gata} ${lot.gata === 1 ? "partidă analizată" : "partide analizate"}.`);
  });
  if (!$("#ecran-lista").hidden) randeazaLista();
}
function arataPastila() {
  const el = $("#pastila");
  if (!S.lot || reviewDeschis() || document.body.classList.contains("in-partida")) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<span class="spin" aria-hidden="true"></span><span>Analizez partida ${Math.min(S.lot.gata + 1, S.lot.total)} din ${S.lot.total} · ${S.lot.pct}%</span><button class="btn glass mic" id="b-stop">Oprește</button>`;
  $("#b-stop").onclick = () => { if (S.lot) S.lot.semnal.oprit = true; };
}

// ───────── IMPORT PGN ─────────
function deschideImport() {
  foaie(`<h2>Importă o partidă</h2><p class="sub">Lipește PGN-ul unei partide (de pe Chess.com, Lichess sau de oriunde).</p>
    <textarea id="pgn-in" rows="9" placeholder='[White "…"]&#10;1. e4 e5 2. Nf3 …'></textarea>
    <div class="act"><button class="btn glass primar" id="pgn-ok">Adaugă și analizează</button><button class="btn glass" data-inchide>Renunță</button></div>`);
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
  const seg = (nume, val, opt) => `<div class="seg glass" data-set="${nume}">${opt.map(([v, l]) => `<button aria-selected="${String(val) === String(v)}" data-v="${v}">${l}</button>`).join("")}</div>`;
  const da = (nume, val) => seg(nume, val ? 1 : 0, [[1, "Da"], [0, "Nu"]]);
  foaie(`<h2>Setări</h2>
    <label class="camp"><span>Utilizator Chess.com</span><input id="set-user" value="${esc(s.user)}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
    <h3 class="titlu-set">Analiza partidelor</h3>
    <div class="camp"><span>Profunzimea analizei</span>${seg("adancime", s.adancime, [[12, "Rapidă · 12"], [14, "Normală · 14"], [16, "Profundă · 16"]])}
      <small>Mai profund înseamnă mai precis, dar mai lent, mai ales pe iPhone. Se aplică partidelor analizate de acum încolo.</small></div>
    <div class="camp"><span>Motoare în paralel</span>${seg("motoare", s.motoare || 0, [[0, "Automat"], [1, "1"], [2, "2"], [4, "4"]])}
      <small>Automat folosește nucleele libere (acum ${motoare().n}).</small></div>
    <div class="camp"><span>Analiza live când explorezi</span>${seg("adancimeLive", s.adancimeLive || 18, [[14, "14"], [18, "18"], [22, "22"]])}</div>
    <div class="camp"><span>Câte luni sincronizez</span>${seg("luni", s.luni || 3, [[1, "1"], [3, "3"], [6, "6"], [12, "12"]])}</div>
    <h3 class="titlu-set">Game Review</h3>
    <div class="camp"><span>Săgeți pe tablă</span>${seg("sageti", s.sageti || "ambele", [["ambele", "Cea mai bună + recomandată"], ["best", "Doar cea mai bună"], ["nimic", "Fără"]])}
      <small>Verde: ce trebuia jucat în locul mutării. Albastru: mutarea recomandată în poziția de acum.</small></div>
    <div class="camp"><span>Momente cheie pentru</span>${seg("momente", s.momente || "ambii", [["eu", "Tine"], ["adv", "Adversar"], ["ambii", "Amândoi"]])}</div>
    <div class="camp"><span>Clasificarea pe tablă</span>${da("clasaTabla", s.clasaTabla)}</div>
    <div class="camp"><span>Linii Stockfish live în analiză</span>${da("liveLinii", s.liveLinii)}</div>
    <div class="camp"><span>Joacă variantele automat</span>${da("autoVariante", s.autoVariante)}</div>
    <div class="camp"><span>Adversarul răspunde singur când muți tu</span>${da("raspunsAuto", s.raspunsAuto !== false)}
      <small>Când joci o mutare pe tablă (în analiză sau la deschideri), Stockfish răspunde automat pentru adversar, fără să mai apeși ›.</small></div>
    <div class="camp"><span>Pauza între mutări</span>${seg("pauza", s.pauza || 900, [[600, "0,6 s"], [900, "0,9 s"], [1500, "1,5 s"]])}</div>
    <div class="camp"><span>Timpul pe mutare</span>${da("timpMutare", s.timpMutare)}</div>
    <div class="camp"><span>Sunete</span>${da("sunete", s.sunete)}</div>
    <div class="camp"><span>Antrenorul citește cu voce</span>${da("voce", s.voce)}</div>
    <div class="act"><button class="btn glass primar" id="set-ok">Salvează</button><button class="btn glass" data-inchide>Închide</button></div>
    <div class="pericol"><button class="btn glass rosu" id="set-sterge">Șterge toate datele locale</button><span id="set-conf"></span></div>
    <p class="nota"><b>Versiunea 3.2.</b> Totul rulează pe dispozitivul tău: Stockfish 19 (GPLv3), chess.js (BSD), deschiderile din setul public Lichess (CC0), piesele cburnett (CC BY-SA). Partidele vin din API-ul public Chess.com.</p>`);
  $$(".foaie [data-set]").forEach(g => (g.onclick = e => { const b = e.target.closest("button"); if (!b) return; $$("button", g).forEach(x => x.setAttribute("aria-selected", x === b)); }));
  $("#set-ok").onclick = async () => {
    const val = n => $(`.foaie [data-set="${n}"] [aria-selected="true"]`).dataset.v;
    const num = n => +val(n), bool = n => val(n) === "1";
    const schimbatMotoare = num("motoare") !== (s.motoare || 0);
    Object.assign(s, {
      user: $("#set-user").value.trim() || s.user, adancime: num("adancime"), motoare: num("motoare"), luni: num("luni"), adancimeLive: num("adancimeLive"),
      sageti: val("sageti"), momente: val("momente"), clasaTabla: bool("clasaTabla"), liveLinii: bool("liveLinii"),
      autoVariante: bool("autoVariante"), raspunsAuto: bool("raspunsAuto"), pauza: num("pauza"), timpMutare: bool("timpMutare"), sunete: bool("sunete"), voce: bool("voce"),
    });
    await salveazaSetari(s);
    if (schimbatMotoare && S.motoare) { S.motoare.opreste(); S.motoare = null; }
    inchideFoaie(); $("#h-user").textContent = s.user;
    if (reviewDeschis()) reimprospateaza(); else if (!location.hash.startsWith("#sesiune") && !location.hash.startsWith("#final-")) ruta();
    toast("Setările au fost salvate.");
  };
  $("#set-sterge").onclick = () => {
    const c = $("#set-conf");
    if (c.dataset.armat) return;
    c.dataset.armat = "1";
    c.innerHTML = `Sigur? Se șterg partidele și analizele de pe acest dispozitiv. <button class="btn glass rosu mic" id="set-da">Da, șterge</button>`;
    $("#set-da").onclick = async () => { await db.goleste("partide"); await db.goleste("analize"); S.partide = []; inchideFoaie(); location.hash = ""; randeazaLista(); toast("Datele locale au fost șterse."); };
  };
}
function foaie(html) {
  const f = $("#foaie"); f.innerHTML = `<div class="foaie-fundal" data-inchide></div><div class="foaie glass" role="dialog" aria-modal="true">${html}</div>`;
  f.hidden = false; f.onclick = e => { if (e.target.closest("[data-inchide]")) inchideFoaie(); };
}
function inchideFoaie() { const f = $("#foaie"); f.hidden = true; f.innerHTML = ""; }
addEventListener("deschide-setari", deschideSetari);

// ───────── rutare și pornire ─────────
// #p-<id> analiza partidei · #antrenor · #exercitii · #sesiune · #lectie-<id> · #final-<id> · #deschideri · #d-<nr> / #r-<id> studiul unei linii
function ruta() {
  const h = decodeURIComponent(location.hash.slice(1));
  inchideAntrenor(); inchideDeschideri();
  const ea = $("#ecran-antrenor");
  const arata = ecran => { $("#ecran-lista").hidden = ecran !== "lista"; $("#ecran-partida").hidden = ecran !== "partida"; ea.hidden = ecran !== "antrenor"; };
  const tab = h.startsWith("p-") || !h ? "partide" : /^(deschideri|d-|r-)/.test(h) ? "deschideri" : h === "exercitii" ? "exercitii" : "antrenor";
  $$("[data-t]").forEach(a => a.setAttribute("aria-current", a.dataset.t === tab ? "page" : "false"));
  if (h.startsWith("p-")) {
    const p = S.partide.find(x => x.id === h.slice(2));
    if (!p) { location.hash = ""; return; }
    inchideReview();
    arata("partida"); $("#pastila").hidden = true;
    scrollTo(0, 0);
    deschideReview(p);
    return;
  }
  inchideReview();
  $("#ecran-partida").innerHTML = "";
  if (!h) { document.body.classList.remove("in-partida"); arata("lista"); randeazaLista(); arataPastila(); return; }
  const plin = h === "sesiune" || h.startsWith("final-") || h.startsWith("d-") || h.startsWith("r-");
  document.body.classList.toggle("in-partida", plin);
  arata("antrenor"); arataPastila();
  if (!plin) scrollTo(0, 0);
  if (h === "antrenor") randeazaAntrenor(ea);
  else if (h === "exercitii") randeazaExercitii(ea);
  else if (h === "sesiune") randeazaSesiune(ea);
  else if (h.startsWith("lectie-")) randeazaLectie(ea, h.slice(7));
  else if (h.startsWith("final-")) randeazaFinal(ea, h.slice(6));
  else if (h === "deschideri") randeazaDeschideri(ea);
  else if (h.startsWith("d-")) randeazaLinie(ea, "d", h.slice(2));
  else if (h.startsWith("r-")) randeazaLinie(ea, "r", h.slice(2));
  else { location.hash = ""; }
}
addEventListener("hashchange", ruta);

(async function porneste() {
  S.set = await setari();
  A.setDeplasari(S.set.deplasari);
  $("#h-user").textContent = S.set.user;
  $("#b-setari").onclick = deschideSetari;
  $("#h-acasa").onclick = e => { e.preventDefault(); location.hash = ""; };
  try { S.teorie = new A.Teorie(await (await fetch("teorie.json?v=32")).json()); }
  catch (e) { S.teorie = new A.Teorie({ pozitii: [], nume: {} }); }
  S.partide = await db.toate("partide");
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
