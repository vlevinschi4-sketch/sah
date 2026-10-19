// sunete.js — sunete scurte pentru mutări, generate local (fără fișiere audio).
let ctx = null;
function context() {
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
function lovitura(t0, frecv, durata, vol) {
  const c = context(); if (!c) return;
  const len = Math.floor(c.sampleRate * durata), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 5);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = frecv; f.Q.value = 3.5;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(c.destination);
  src.start(c.currentTime + t0);
}
function ton(t0, frecv, durata, vol) {
  const c = context(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = "sine"; o.frequency.value = frecv;
  g.gain.setValueAtTime(0, c.currentTime + t0);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + durata);
  o.connect(g); g.connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + durata + 0.02);
}
export function sunetMutare(san) {
  if (!san) return;
  if (/#/.test(san)) { lovitura(0, 900, 0.09, 1.4); ton(0.05, 660, 0.35, 0.12); ton(0.18, 880, 0.4, 0.1); return; }
  if (/\+/.test(san)) { lovitura(0, 1300, 0.07, 1.3); ton(0.02, 990, 0.18, 0.08); return; }
  if (/^O-O/.test(san)) { lovitura(0, 1000, 0.06, 1.1); lovitura(0.09, 1100, 0.06, 1.1); return; }
  if (/x/.test(san)) { lovitura(0, 1500, 0.06, 1.5); lovitura(0.035, 900, 0.07, 1.2); return; }
  lovitura(0, 1150, 0.06, 1.2);
}
export function sunetGresit() { ton(0, 330, 0.18, 0.1); ton(0.12, 262, 0.22, 0.09); }
export function sunetCorect() { ton(0, 660, 0.15, 0.09); ton(0.1, 990, 0.25, 0.09); }
export function deblocheaza() { context(); }
