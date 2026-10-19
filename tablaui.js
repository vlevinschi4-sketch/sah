// tablaui.js — tablă interactivă refolosibilă (exerciții, deschideri, finaluri): muți atingând sau trăgând piesa.
import { Chess } from "./chess.js?v=32";
import { tablaSVG, patratLa, idPiesa } from "./tabla.js?v=32";
import { deblocheaza } from "./sunete.js?v=32";

export class TablaUI {
  constructor(el, { onMutare } = {}) {
    this.el = el; this.onMutare = onMutare;
    this.st = { fen: new Chess().fen(), flip: false, arrows: [], hl: [], badge: null, interactiv: true, cine: null };
    this.sel = null; this.drag = null;
    this.fant = document.createElement("div"); this.fant.className = "fantoma"; this.fant.hidden = true; document.body.appendChild(this.fant);
    el.classList.add("tabla");
    el.addEventListener("pointerdown", e => this.jos(e));
    el.addEventListener("pointermove", e => this.misca(e));
    el.addEventListener("pointerup", e => this.sus(e));
    el.addEventListener("pointercancel", () => { this.drag = null; this.fant.hidden = true; this.deseneaza(); });
  }
  set(o) { Object.assign(this.st, o); if (o.fen) this.sel = null; this.deseneaza(); }
  distruge() { this.fant.remove(); }
  poateMuta(ch, sq) {
    const p = ch.get(sq);
    if (!p || p.color !== ch.turn()) return false;
    return !this.st.cine || this.st.cine === p.color;
  }
  deseneaza() {
    const s = this.st, ch = new Chess(s.fen);
    const tinte = this.sel ? ch.moves({ square: this.sel, verbose: true }).map(m => ({ sq: m.to, cap: !!m.captured })) : [];
    this.el.innerHTML = tablaSVG(s.fen, { flip: s.flip, arrows: s.arrows, hl: s.hl, badge: s.badge, sel: this.sel, tinte, ascunde: this.drag && this.drag.mutat ? this.drag.from : null });
  }
  jos(e) {
    if (!this.st.interactiv) return;
    deblocheaza();
    const sq = patratLa(e, this.el, this.st.flip); if (!sq) return;
    const ch = new Chess(this.st.fen);
    if (this.sel && this.sel !== sq && ch.moves({ square: this.sel, verbose: true }).some(m => m.to === sq)) { const f = this.sel; this.sel = null; this.executa(f, sq); return; }
    if (!this.poateMuta(ch, sq)) { this.sel = null; this.deseneaza(); return; }
    e.preventDefault();
    this.el.setPointerCapture(e.pointerId);
    const lat = this.el.getBoundingClientRect().width / 8;
    this.sel = sq; this.drag = { from: sq, x0: e.clientX, y0: e.clientY, mutat: false, lat };
    this.fant.innerHTML = `<svg viewBox="0 0 45 45" width="${lat * 1.1}" height="${lat * 1.1}"><use href="#p-${idPiesa(this.st.fen, sq)}" width="45" height="45"/></svg>`;
    this.deseneaza();
  }
  misca(e) {
    const d = this.drag; if (!d) return;
    if (!d.mutat && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6) { d.mutat = true; this.fant.hidden = false; this.deseneaza(); }
    if (d.mutat) { this.fant.style.left = e.clientX - d.lat * .55 + "px"; this.fant.style.top = e.clientY - d.lat * .55 + "px"; }
  }
  sus(e) {
    const d = this.drag; if (!d) return;
    this.drag = null; this.fant.hidden = true;
    const sq = patratLa(e, this.el, this.st.flip);
    if (d.mutat && sq && sq !== d.from) { this.sel = null; this.executa(d.from, sq); return; }
    this.deseneaza();
  }
  executa(from, to) {
    const fenB = this.st.fen, ch = new Chess(fenB);
    const cand = ch.moves({ square: from, verbose: true }).filter(m => m.to === to);
    if (!cand.length) { this.deseneaza(); return; }
    const mv = cand.find(m => !m.promotion || m.promotion === "q") || cand[0];
    const r = ch.move({ from, to, promotion: mv.promotion ? "q" : undefined });
    const info = { from, to, promotion: r.promotion, san: r.san, u: from + to + (r.promotion || ""), fenB, fen: ch.fen() };
    if (this.onMutare) this.onMutare(info);
  }
}
