// cadru.js — piesele de interfață comune: ecranul cu tablă + panou (analiză, exerciții, deschideri, finaluri),
// bula mentorului, tabla mică din carduri, antetul paginilor, bara jucătorilor și foaia de dialog.
import { tablaSVG } from "./tabla.js?v=40";
import { $, esc, ico, iu, mmss } from "./util.js?v=40";

const NAV = {
  first: ["first", "Început"], prev: ["prev", "Înapoi"], next: ["next", "Înainte"], last: ["last", "Sfârșit"],
  auto: ["play", "Redare automată"], reia: ["sync", "Fă-l din nou"], flip: ["flip", "Întoarce tabla"],
};

/** Ecran „tablă în stânga, panou în dreapta”, ca analiza de pe Chess.com.
 *  o: {titlu, sub, icon (html), inapoi (hash), bara (bara de evaluare), jucatori, nav:[chei], extra (html în antet)} */
export function cadruJoc(o) {
  const nav = o.nav || [];
  return `<div class="rv ${o.cls || ""}">
    <div class="rv-st">
      ${o.jucatori ? `<div class="jucator" id="j-sus"></div>` : ""}
      <div class="tabla-rand ${o.bara ? "" : "singur"}">${o.bara ? `<div id="evb"></div>` : ""}<div class="tabla" id="tb"></div></div>
      ${o.jucatori ? `<div class="jucator" id="j-jos"></div>` : ""}
    </div>
    <aside class="rv-dr"><div class="panou-r">
      <div class="panou-cap">
        <a class="btn ghost icon" href="${esc(o.inapoi || "#")}" id="b-inapoi" aria-label="Înapoi">${ico("back", 22)}</a>
        ${o.icon || ""}<div class="titlu"><b id="pc-titlu">${o.titlu || ""}</b><small id="pc-sub">${o.sub || ""}</small></div>
        <span class="spatiu"></span>${o.extra || ""}
      </div>
      <div class="panou-corp" id="pc"></div>
      ${nav.length ? `<div class="panou-jos"><div class="nav" id="nav">${nav.map(n => `<button class="btn" type="button" data-n="${n}" aria-label="${NAV[n][1]}">${ico(NAV[n][0], 26)}</button>`).join("")}</div></div>` : ""}
    </div></aside>
  </div>`;
}

/** Mentorul: avatar + bulă albă. cap/corp sunt HTML; act = butoane sub bulă. */
export function bula({ cap = "", corp = "", act = "", id = "" } = {}) {
  return `<div class="coach" ${id ? `id="${id}"` : ""}><div class="coach-av" aria-hidden="true"><svg viewBox="0 0 56 56"><use href="#i-mentor"/></svg></div>
    <div class="bula">${cap ? `<div class="bula-cap">${cap}</div>` : ""}${corp}</div></div>${act ? `<div class="coach-act">${act}</div>` : ""}`;
}

export const miniTabla = (fen, o = {}) => `<div class="tabla-mini">${tablaSVG(fen, { coords: false, ...o })}</div>`;

export function capPagina(icon, titlu, dreapta = "") {
  return `<div class="cap-pag">${icon ? iu(icon, 36, "ico-pag") : ""}<h1>${titlu}</h1><span class="spatiu"></span>${dreapta}</div>`;
}

export const avatar = (user, cls = "") => `<span class="av ${cls}" aria-hidden="true">${esc((user || "?")[0].toUpperCase())}</span>`;

/** Bara unui jucător deasupra/sub tablă: avatar, nume, rating, piesele capturate și ceasul. */
export function barJucator(fen, cul, j, ceas) {
  const mat = { w: {}, b: {} }, start = { p: 8, n: 2, b: 2, r: 2, q: 1 }, V = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  for (const ch of fen.split(" ")[0]) if (/[pnbrq]/i.test(ch)) { const c = ch === ch.toUpperCase() ? "w" : "b"; mat[c][ch.toLowerCase()] = (mat[c][ch.toLowerCase()] || 0) + 1; }
  const pct = c => Object.entries(mat[c]).reduce((s, [k, n]) => s + V[k] * n, 0);
  const o = cul === "w" ? "b" : "w";
  let cap = "";
  for (const k of ["q", "r", "b", "n", "p"]) for (let i = 0; i < Math.max(0, start[k] - (mat[o][k] || 0)); i++) cap += `<svg viewBox="0 0 45 45"><use href="#p-${o}${k.toUpperCase()}" width="45" height="45"/></svg>`;
  const dif = pct(cul) - pct(o), laMutare = fen.split(" ")[1] === cul;
  return `${avatar(j.user, cul === "b" ? "negru" : "")}
    <span class="jn"><span>${esc(j.user || (cul === "w" ? "Albul" : "Negrul"))}${j.rating ? ` <span class="rt">(${j.rating})</span>` : ""}</span><span class="cap">${cap}${dif > 0 ? `<span class="dif">+${dif}</span>` : ""}</span></span>
    ${ceas != null ? `<span class="ceas ${cul === "w" ? "alb" : ""} ${laMutare ? "activ" : ""}">${mmss(ceas)}</span>` : ""}`;
}

// ───────── foaia de dialog (setări, import) ─────────
export function foaie(html) {
  const f = $("#foaie");
  f.innerHTML = `<div class="foaie-fundal" data-inchide></div><div class="foaie" role="dialog" aria-modal="true">${html}</div>`;
  f.hidden = false;
  f.onclick = e => { if (e.target.closest("[data-inchide]")) inchideFoaie(); };
}
export function inchideFoaie() { const f = $("#foaie"); f.hidden = true; f.innerHTML = ""; }

/** Butoanele de navigare: dezactivează/activează după stare. st = {first:bool, prev:bool, ...} (true = activ) */
export function stareNav(st) {
  const nav = $("#nav"); if (!nav) return;
  for (const [k, v] of Object.entries(st)) { const b = nav.querySelector(`[data-n="${k}"]`); if (b) b.disabled = !v; }
}
