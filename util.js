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
  };
  return `<svg width="${d}" height="${d}" viewBox="0 0 20 20" aria-hidden="true">${P[n]}</svg>`;
}
