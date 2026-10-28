// util.js — mici unelte folosite peste tot în aplicație.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const af = v => (v == null ? "—" : Number(v).toFixed(1).replace(".", ","));
const FIG = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘" };
export const fig = san => (san && FIG[san[0]] ? FIG[san[0]] + san.slice(1) : san || "");
export const figText = t => esc(t).replace(/(^|[\s(.…])([KQRBN])(?=[a-h1-8x]*[a-h][1-8])/g, (m, p, k) => p + FIG[k]);
export const nrMut = ply => (ply % 2 ? `${Math.ceil(ply / 2)}.` : `${ply / 2}…`);
export const evFmt = v => String(v ?? "").replace(".", ",").replace(/^-/, "−");
export const mmss = s => (s == null ? "" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`);
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const dataRo = ts => new Date(ts * 1000).toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
export const MOTIV = { checkmated: "mat", resigned: "abandon", timeout: "timp expirat", abandoned: "partidă părăsită", repetition: "repetare",
  stalemate: "pat", insufficient: "material insuficient", timevsinsufficient: "timp, material insuficient", agreed: "de comun acord",
  "50move": "regula celor 50 de mutări", lose: "", win: "" };

export function toast(msg, ms = 3200) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false; t.classList.add("on");
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.classList.remove("on"); setTimeout(() => (t.hidden = true), 250); }, ms);
}
export function tip(html, x, y) {
  const t = $("#tip");
  if (!html) { t.style.opacity = 0; return; }
  t.innerHTML = html; t.style.opacity = 1;
  const w = t.offsetWidth; t.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)) + "px"; t.style.top = Math.max(8, y - t.offsetHeight - 10) + "px";
}
export function timp(p) {
  if (p.timeClass === "daily") return "corespondență";
  if (!p.timeControl || p.timeClass === "importata") return "importată";
  const [b, inc] = String(p.timeControl).split("+");
  const min = Math.round(+b / 60);
  return inc && inc !== "0" ? `${min}|${inc}` : `${min} min`;
}
// evaluare (perspectiva albului) -> text scurt
export function evScurt(ev) {
  if (!ev) return "";
  if (ev.mat != null) return ev.mat === 0 ? (ev.castiga_alb ? "1-0" : "0-1") : (ev.mat > 0 ? "M" + ev.mat : "-M" + -ev.mat);
  const v = (ev.cp / 100).toFixed(1);
  return v === "-0.0" || v === "0.0" ? "0.0" : (ev.cp > 0 ? "+" : "") + v;
}
// pictograme mici (SVG) pentru butoane
export function ico(n, d = 18) {
  const P = {
    sync: `<path d="M4 10a6 6 0 0 1 10.2-4.3L16 7.5M16 4v3.5h-3.5M16 10a6 6 0 0 1-10.2 4.3L4 12.5M4 16v-3.5h3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
    play: `<path d="M6.5 4.8v10.4l8.6-5.2z" fill="currentColor"/>`,
    pause: `<path d="M6 4.5h2.8v11H6zM11.2 4.5H14v11h-2.8z" fill="currentColor"/>`,
    plus: `<path d="M10 5v10M5 10h10" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
    gear: `<circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 2.8v2M10 15.2v2M2.8 10h2M15.2 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
    first: `<path d="M5.5 5v10M15 5l-6.5 5 6.5 5z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`,
    prev: `<path d="M12.5 4.5L7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    next: `<path d="M7.5 4.5L13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    last: `<path d="M14.5 5v10M5 5l6.5 5L5 15z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`,
    flip: `<path d="M6 3.5v13M6 16.5l-2.5-2.5M6 16.5L8.5 14M14 16.5v-13M14 3.5L11.5 6M14 3.5L16.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
    back: `<path d="M12.5 4.5L7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    sunet: `<path d="M3.5 7.5h3l4-3.5v12l-4-3.5h-3z" fill="currentColor"/><path d="M13.5 7a4 4 0 0 1 0 6M15.5 5a7 7 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
    mut: `<path d="M3.5 7.5h3l4-3.5v12l-4-3.5h-3z" fill="currentColor"/><path d="M13.5 8l4 4M17.5 8l-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
    cheie: `<path d="M10 3.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L10 13.3l-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="currentColor"/>`,
    bec: `<path d="M10 2.8a5 5 0 0 0-2.9 9.1c.6.4.9 1 .9 1.7v.6h4v-.6c0-.7.3-1.3.9-1.7A5 5 0 0 0 10 2.8z" fill="currentColor"/><path d="M8 16h4M8.6 18h2.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
    ochi: `<path d="M1.8 10S5 4.5 10 4.5 18.2 10 18.2 10 15 15.5 10 15.5 1.8 10 1.8 10z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="10" cy="10" r="2.6" fill="currentColor"/>`,
    x: `<path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
    bifa: `<path d="M4.5 10.5l3.6 3.6 7.4-8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    caut: `<circle cx="8.6" cy="8.6" r="5.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12.6 12.6l4.6 4.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
    lista: `<path d="M4 5.5h12M4 10h12M4 14.5h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
    sageata: `<path d="M4 10h11M11 5.5l4.5 4.5-4.5 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    stea: `<path d="M10 2.5l2.3 4.8 5.2.7-3.8 3.6.9 5.2L10 14.3l-4.6 2.5.9-5.2L2.5 8l5.2-.7z" fill="currentColor"/>`,
    motor: `<rect x="3" y="5" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 9h2M11 9h2M7 12h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  };
  return `<svg width="${d}" height="${d}" viewBox="0 0 20 20" aria-hidden="true">${P[n]}</svg>`;
}

// pictogramele colorate din sprite-ul din index.html (#i-…)
export const iu = (n, d = 24, cls = "") => `<svg width="${d}" height="${d}" ${cls ? `class="${cls}"` : ""} aria-hidden="true"><use href="#i-${n}"/></svg>`;
// ziua locală (nu UTC), ca seria de zile să se schimbe la miezul nopții din România
export const ziKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// „21 de partide”, „3 partide”, „1 partidă”
export function plural(n, unu, multe) {
  if (n === 1) return `1 ${unu}`;
  const de = n !== 0 && (n % 100 === 0 || n % 100 >= 20);
  return `${n} ${de ? "de " : ""}${multe}`;
}
export const dataLunga = ts => new Date(ts * 1000).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
// un număr pseudo-aleator stabil pentru un text (ex. alegerea formulării sau a exercițiului zilei)
export function hash(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const alege = (lista, cheie) => lista[hash(String(cheie)) % lista.length];

// numele deschiderilor (din baza Lichess, în engleză) cu familiile traduse în română
const FAM_RO = [
  ["Italian Game", "Partida Italiană"], ["Ruy Lopez", "Partida Spaniolă"], ["Sicilian Defense", "Apărarea Siciliană"], ["French Defense", "Apărarea Franceză"],
  ["Caro-Kann Defense", "Apărarea Caro-Kann"], ["Scandinavian Defense", "Apărarea Scandinavă"], ["Queen's Gambit Declined", "Gambitul damei refuzat"],
  ["Queen's Gambit Accepted", "Gambitul damei acceptat"], ["Queen's Gambit", "Gambitul damei"], ["King's Gambit", "Gambitul regelui"], ["Scotch Game", "Partida Scoțiană"],
  ["Vienna Game", "Partida Viena"], ["Four Knights Game", "Partida celor patru cai"], ["Three Knights Opening", "Partida celor trei cai"], ["Two Knights Defense", "Apărarea celor doi cai"],
  ["Petrov's Defense", "Apărarea Petrov"], ["Russian Game", "Apărarea Petrov"], ["Philidor Defense", "Apărarea Philidor"], ["Pirc Defense", "Apărarea Pirc"],
  ["Modern Defense", "Apărarea modernă"], ["London System", "Sistemul Londra"], ["English Opening", "Deschiderea engleză"], ["Dutch Defense", "Apărarea olandeză"],
  ["King's Indian Defense", "Apărarea est-indiană"], ["King's Indian Attack", "Atacul est-indian"], ["Nimzo-Indian Defense", "Apărarea nimzo-indiană"], ["Queen's Indian Defense", "Apărarea vest-indiană"],
  ["Slav Defense", "Apărarea slavă"], ["Semi-Slav Defense", "Apărarea semi-slavă"], ["Center Game", "Partida de centru"], ["Bishop's Opening", "Deschiderea nebunului"],
  ["King's Pawn Game", "Deschiderea pionului regelui"], ["Queen's Pawn Game", "Deschiderea pionului damei"], ["Alekhine Defense", "Apărarea Aliehin"],
  ["Ponziani Opening", "Deschiderea Ponziani"], ["Danish Gambit", "Gambitul danez"], ["Evans Gambit", "Gambitul Evans"], ["Catalan Opening", "Deschiderea catalană"],
  ["Grünfeld Defense", "Apărarea Grünfeld"], ["Benoni Defense", "Apărarea Benoni"], ["Bird Opening", "Deschiderea Bird"], ["Réti Opening", "Deschiderea Réti"],
  ["Owen Defense", "Apărarea Owen"], ["Nimzowitsch Defense", "Apărarea Nimzowitsch"], ["Englund Gambit", "Gambitul Englund"], ["Elephant Gambit", "Gambitul elefantului"],
  ["Latvian Gambit", "Gambitul leton"], ["Trompowsky Attack", "Atacul Trompowsky"], ["Indian Defense", "Apărarea indiană"], ["Zukertort Opening", "Deschiderea Zukertort"],
  ["Hungarian Opening", "Deschiderea ungară"], ["Polish Opening", "Deschiderea poloneză"], ["Van't Kruijs Opening", "Deschiderea Van't Kruijs"], ["Mieses Opening", "Deschiderea Mieses"],
  ["Rat Defense", "Apărarea Rat"], ["St. George Defense", "Apărarea Sfântul Gheorghe"], ["Blackmar-Diemer Gambit", "Gambitul Blackmar-Diemer"], ["Colle System", "Sistemul Colle"],
  ["Giuoco Piano", "Giuoco Piano"], ["Ponziani", "Ponziani"], ["Queen's Pawn Opening", "Deschiderea pionului damei"], ["King's Pawn Opening", "Deschiderea pionului regelui"],
  ["Petrov Defense", "Apărarea Petrov"], ["Sicilian", "Apărarea Siciliană"], ["Caro Kann Defense", "Apărarea Caro-Kann"], ["Scandinavian", "Apărarea Scandinavă"],
  ["Philidor", "Apărarea Philidor"], ["Pirc", "Apărarea Pirc"], ["Vienna", "Partida Viena"], ["Scotch", "Partida Scoțiană"], ["French", "Apărarea Franceză"],
];
const nrm = t => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['’`]/g, "").replace(/[.,:;()\/-]/g, " ").replace(/\s+/g, " ").trim();
const FAM_N = FAM_RO.map(([en, ro]) => [nrm(en), ro, en]).sort((a, b) => b[0].length - a[0].length);
/** Familia deschiderii, în română: „Caro Kann Defense Advance Botvinnik…” → „Apărarea Caro-Kann”. */
export function familieRo(n) {
  if (!n) return "Necunoscută";
  const x = nrm(n);
  for (const [k, ro] of FAM_N) if (x === k || x.startsWith(k + " ")) return ro;
  return n.split(":")[0].replace(/\s+\d.*$/, "").trim();
}
export function numeRo(n) {
  if (!n) return n;
  for (const [en, ro] of FAM_RO) if (n.startsWith(en) && (n.length === en.length || /[\s:]/.test(n[en.length]))) { const rest = n.slice(en.length).replace(/^[:\s]+/, ""); return rest ? `${ro}: ${rest}` : ro; }
  // numele din adresele Chess.com, fără apostrofuri și fără „:” („Petrovs Defense Classical Variation”)
  const x = nrm(n);
  for (const [k, ro] of FAM_N) if (x === k || x.startsWith(k + " ")) {
    const rest = n.split(/\s+/).slice(k.split(" ").length).join(" ").replace(/^[:\s-]+/, "");
    return rest ? `${ro}: ${rest}` : ro;
  }
  return n;
}
