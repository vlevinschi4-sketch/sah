// motor.js — Stockfish 19 (WASM, rulează local în browser) și analiza unei partide
// cu mai multe motoare în paralel, câte unul pe nucleu liber.
import { Chess } from "./chess.js?v=40";

const URL_MOTOR = new URL("./stockfish-19-lite-single.js", import.meta.url).href;

class Motor {
  constructor() {
    this.w = new Worker(URL_MOTOR);
    this.asteptare = null;
    this.linii = {};
    this.multipv = 1;
    this.w.onmessage = e => this.primeste(String(e.data));
    this.gata = new Promise(res => { this._gata = res; });
    this.trimite("uci");
  }
  trimite(c) { this.w.postMessage(c); }
  primeste(s) {
    if (s === "uciok") { this.trimite("setoption name Hash value 32"); this.trimite("isready"); return; }
    if (s === "readyok") { if (this._gata) { this._gata(); this._gata = null; } if (this._ready) { const r = this._ready; this._ready = null; r(); } return; }
    if (s.startsWith("info ") && s.includes(" pv ") && s.includes(" score ")) {
      if (s.includes(" lowerbound") || s.includes(" upperbound")) return;
      const mp = +(s.match(/ multipv (\d+)/) || [0, 1])[1];
      const ad = +(s.match(/ depth (\d+)/) || [0, 0])[1];
      const sc = s.match(/ score (cp|mate) (-?\d+)/);
      const pv = s.split(" pv ")[1].trim().split(/\s+/);
      this.linii[mp] = { ad, tip: sc[1], val: +sc[2], pv };
      return;
    }
    if (s.startsWith("bestmove") && this.asteptare) {
      const r = this.asteptare; this.asteptare = null;
      r(this.linii);
    }
  }
  async setMultiPV(n) {
    if (n === this.multipv) return;
    this.multipv = n;
    this.trimite(`setoption name MultiPV value ${n}`);
    await new Promise(res => { this._ready = res; this.trimite("isready"); });
  }
  async analizeaza(fen, adancime, multipv) {
    await this.gata;
    await this.setMultiPV(multipv);
    this.linii = {};
    const p = new Promise(res => { this.asteptare = res; });
    this.trimite("position fen " + fen);
    this.trimite("go depth " + adancime);
    return p;
  }
  opreste() { this.w.terminate(); }
}

// scorul UCI e din perspectiva celui la mutare; noi îl păstrăm din perspectiva albului
function inEv(l, laMutare) {
  const semn = laMutare === "w" ? 1 : -1;
  if (l.tip === "mate") return { cp: null, mat: semn * l.val };
  return { cp: semn * l.val, mat: null };
}

export class GrupMotoare {
  constructor(n) {
    const nuclee = navigator.hardwareConcurrency || 4;
    this.n = Math.max(1, Math.min(n || Math.max(1, Math.min(4, nuclee - 1)), 6));
    this.motoare = [];
  }
  porneste() { while (this.motoare.length < this.n) this.motoare.push(new Motor()); return Promise.all(this.motoare.map(m => m.gata)); }
  opreste() { this.motoare.forEach(m => m.opreste()); this.motoare = []; }

  async evalPozitie(motor, fen, adancime) {
    const ch = new Chess(fen);
    if (ch.isCheckmate()) return { ev: { cp: null, mat: 0, castiga_alb: ch.turn() === "b" }, pv: [], ev2: null, pv2: [] };
    if (ch.isGameOver()) return { ev: { cp: 0, mat: null }, pv: [], ev2: null, pv2: [] };
    const legale = ch.moves().length, laMutare = ch.turn();
    const L = await motor.analizeaza(fen, adancime, Math.min(2, legale));
    const l1 = L[1], l2 = L[2];
    return {
      ev: l1 ? inEv(l1, laMutare) : { cp: 0, mat: null },
      pv: l1 ? l1.pv.slice(0, 12) : [],
      ev2: l2 ? inEv(l2, laMutare) : null,
      pv2: l2 ? l2.pv.slice(0, 4) : [],
    };
  }

  /** Analizează toate pozițiile (fens) cu motoarele în paralel. progres(gata, total) */
  async analizeazaPozitii(fens, adancime, progres, semnalOprire) {
    await this.porneste();
    const rez = new Array(fens.length);
    let urm = 0, gata = 0;
    const lucreaza = async motor => {
      while (urm < fens.length) {
        if (semnalOprire && semnalOprire.oprit) throw new Error("oprit");
        const i = urm++;
        rez[i] = await this.evalPozitie(motor, fens[i], adancime);
        gata++;
        if (progres) progres(gata, fens.length);
      }
    };
    await Promise.all(this.motoare.map(lucreaza));
    return rez;
  }
}

// ───────── analiza live (explorare): trimite linii pe măsură ce motorul adâncește ─────────
export class MotorLive {
  constructor() {
    this.w = new Worker(URL_MOTOR);
    this.cauta = false;
    this.urm = null;      // cererea care așteaptă să se oprească căutarea curentă
    this.curent = null;
    this.linii = {};
    this.ultimTrimis = 0;
    this.w.onmessage = e => this.primeste(String(e.data));
    this.gata = new Promise(res => { this._gata = res; });
    this.trimite("uci");
  }
  trimite(c) { this.w.postMessage(c); }
  primeste(s) {
    if (s === "uciok") { this.trimite("setoption name Hash value 64"); this.trimite("setoption name MultiPV value 3"); this.trimite("isready"); return; }
    if (s === "readyok") { if (this._gata) { this._gata(); this._gata = null; } return; }
    if (s.startsWith("info ") && s.includes(" pv ") && s.includes(" score ") && this.curent) {
      if (s.includes(" lowerbound") || s.includes(" upperbound")) return;
      const mp = +(s.match(/ multipv (\d+)/) || [0, 1])[1];
      const ad = +(s.match(/ depth (\d+)/) || [0, 0])[1];
      const sc = s.match(/ score (cp|mate) (-?\d+)/);
      const semn = this.curent.laMutare === "w" ? 1 : -1;
      const ev = sc[1] === "mate" ? { cp: null, mat: semn * +sc[2] } : { cp: semn * +sc[2], mat: null };
      this.linii[mp] = { ad, ev, pv: s.split(" pv ")[1].trim().split(/\s+/).slice(0, 14) };
      const acum = performance.now();
      if (mp === 1 && acum - this.ultimTrimis > 180) { this.ultimTrimis = acum; this.raporteaza(false); }
      return;
    }
    if (s.startsWith("bestmove")) {
      if (this.curent) this.raporteaza(true);
      this.cauta = false; this.curent = null;
      if (this.urm) { const u = this.urm; this.urm = null; this.porneste(u); }
    }
  }
  raporteaza(final) {
    const c = this.curent; if (!c || !c.cb) return;
    const L = [1, 2, 3].map(k => this.linii[k]).filter(Boolean);
    if (L.length) c.cb({ fen: c.fen, linii: L, adancime: L[0].ad, final });
  }
  porneste(c) {
    this.curent = c; this.linii = {}; this.cauta = true; this.ultimTrimis = 0;
    this.trimite("position fen " + c.fen);
    this.trimite("go depth " + c.adancime);
  }
  /** Analizează fen; cb({fen, linii:[{ad, ev, pv}], adancime, final}) e chemat de mai multe ori. */
  async analizeaza(fen, adancime, cb) {
    await this.gata;
    const ch = new Chess(fen);
    if (ch.isGameOver()) { cb && cb({ fen, linii: [], adancime: 0, final: true, terminal: true }); this.opreste(); return; }
    const c = { fen, adancime, cb, laMutare: ch.turn() };
    if (this.cauta) { this.urm = c; this.trimite("stop"); }
    else this.porneste(c);
  }
  opreste() { if (this.cauta) { this.urm = null; this.trimite("stop"); } }
}
