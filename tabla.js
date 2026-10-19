// tabla.js — tabla de șah în SVG, săgeți, iconițele claselor și bara de evaluare.

export const CULORI = {
  br: "#1fb9a0", gr: "#6f98c4", be: "#7fb34a", ex: "#7fb34a", go: "#93ad86", bk: "#a8825f",
  in: "#f0b93a", mi: "#f39a3c", ms: "#f0705c", bl: "#e2443a", fo: "#9a9aa2",
  rec: "#3f8fe8", am: "#e2443a",
};
const FILES = "abcdefgh";

// iconița unei clase, ca SVG (merge și în HTML, și pe tablă)
export function iconSVG(cl, d = 20, x = null, y = null) {
  const c = CULORI[cl]; if (!c) return "";
  const pos = x != null ? ` x="${x}" y="${y}"` : "";
  const txt = (t, fs) => `<text x="10" y="${10 + fs * 0.36}" text-anchor="middle" font-size="${fs}" font-weight="800" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif" letter-spacing="-.5">${t}</text>`;
  const forme = {
    br: txt("!!", 10.5), gr: txt("!", 12.5), in: txt("?!", 10), mi: txt("?", 12.5), bl: txt("??", 10.5), fo: txt("→", 12),
    be: `<path d="M10 4.2l1.75 3.6 3.95.55-2.85 2.8.67 3.92L10 13.2l-3.52 1.87.67-3.92-2.85-2.8 3.95-.55z" fill="#fff"/>`,
    ex: `<path d="M5.6 9.2h2.1v5.9H5.6zM8.6 15.1V9.1l2.5-3.9c.5-.7 1.6-.3 1.5.6l-.3 2.2h2.6c.9 0 1.5.8 1.3 1.6l-.9 4.1c-.2.8-.8 1.4-1.6 1.4z" fill="#fff"/>`,
    go: `<path d="M5.6 10.4l2.9 2.9 5.9-6.3" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    ms: `<path d="M6.6 6.6l6.8 6.8M13.4 6.6l-6.8 6.8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
    bk: `<path d="M4.4 6.3c1.9-.9 3.8-.8 5.1.4v7.4c-1.3-1.1-3.2-1.2-5.1-.4zM15.6 6.3c-1.9-.9-3.8-.8-5.1.4v7.4c1.3-1.1 3.2-1.2 5.1-.4z" fill="#fff"/>`,
  };
  return `<svg${pos} width="${d}" height="${d}" viewBox="0 0 20 20" class="ico" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="${c}"/>${forme[cl]}</svg>`;
}

export function parseFen(fen) {
  const rows = fen.split(" ")[0].split("/"), out = {};
  rows.forEach((r, i) => { let f = 0; for (const ch of r) { if (/\d/.test(ch)) f += +ch; else { out[FILES[f] + (8 - i)] = ch; f++; } } });
  return out;
}
const sqXY = (sq, flip) => { const f = FILES.indexOf(sq[0]), r = +sq[1] - 1; return flip ? [(7 - f) * 45, r * 45] : [f * 45, (7 - r) * 45]; };

function arrowPath(from, to, flip) {
  const [x1, y1] = sqXY(from, flip).map(v => v + 22.5), [x2, y2] = sqXY(to, flip).map(v => v + 22.5);
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const tipX = x2 - ux * 6, tipY = y2 - uy * 6, h = 15, w = 4, hw = 10.5;
  const bx = tipX - ux * h, by = tipY - uy * h, sx = x1 + ux * 8, sy = y1 + uy * 8;
  const P = [[sx + nx * w, sy + ny * w], [bx + nx * w, by + ny * w], [bx + nx * hw, by + ny * hw], [tipX, tipY], [bx - nx * hw, by - ny * hw], [bx - nx * w, by - ny * w], [sx - nx * w, sy - ny * w]];
  return "M" + P.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" L") + "Z";
}
export const sageata = (u, c, o) => (u ? { from: u.slice(0, 2), to: u.slice(2, 4), c, o } : null);

/** o: {flip, arrows:[{from,to,c,o}], hl:[{sq,c,o}], badge:{sq,cl}, sel, tinte:[sq], coords} */
export function tablaSVG(fen, o = {}) {
  const flip = !!o.flip, pcs = parseFen(fen);
  let s = `<svg viewBox="0 0 360 360" role="img" aria-label="Tablă de șah">`;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const sq = FILES[f] + (r + 1), [x, y] = sqXY(sq, flip), light = (f + r) % 2 === 1;
    s += `<rect x="${x}" y="${y}" width="45" height="45" fill="var(${light ? "--sq-l" : "--sq-d"})"/>`;
  }
  (o.hl || []).forEach(h => { const [x, y] = sqXY(h.sq, flip); s += `<rect x="${x}" y="${y}" width="45" height="45" fill="${h.c}" opacity="${h.o ?? .42}"/>`; });
  if (o.sel) { const [x, y] = sqXY(o.sel, flip); s += `<rect x="${x}" y="${y}" width="45" height="45" fill="var(--sel)" opacity=".55"/>`; }
  if (o.coords !== false) for (let i = 0; i < 8; i++) {
    const file = flip ? FILES[7 - i] : FILES[i], rank = flip ? i + 1 : 8 - i;
    const isL = sq => (FILES.indexOf(sq[0]) + (+sq[1] - 1)) % 2 === 1;
    const jos = file + (flip ? 8 : 1), stg = (flip ? "h" : "a") + rank;
    s += `<text x="${i * 45 + 42}" y="357" font-size="8.5" font-weight="700" text-anchor="end" fill="var(${isL(jos) ? "--coord-l" : "--coord-d"})">${file}</text>`;
    s += `<text x="2.5" y="${i * 45 + 10}" font-size="8.5" font-weight="700" fill="var(${isL(stg) ? "--coord-l" : "--coord-d"})">${rank}</text>`;
  }
  for (const sq in pcs) {
    if (sq === o.ascunde) continue;
    const p = pcs[sq], [x, y] = sqXY(sq, flip), id = (p === p.toUpperCase() ? "w" : "b") + p.toUpperCase();
    s += `<use href="#p-${id}" x="${x}" y="${y}" width="45" height="45"/>`;
  }
  (o.tinte || []).forEach(t => { const [x, y] = sqXY(t.sq, flip);
    s += t.cap ? `<circle cx="${x + 22.5}" cy="${y + 22.5}" r="19" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="4"/>` : `<circle cx="${x + 22.5}" cy="${y + 22.5}" r="6.5" fill="rgba(0,0,0,.2)"/>`; });
  (o.arrows || []).filter(Boolean).forEach(a => { s += `<path d="${arrowPath(a.from, a.to, flip)}" fill="${a.c}" fill-opacity="${a.o ?? .85}"/>`; });
  if (o.badge && CULORI[o.badge.cl]) {
    const [x, y] = sqXY(o.badge.sq, flip);
    s += iconSVG(o.badge.cl, 19, Math.min(x + 28, 340), y - 2 < 0 ? y + 1 : y - 2).replace('class="ico"', 'class="ico" style="filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.35))"');
  }
  return s + `</svg>`;
}

export function patratLa(evt, el, flip) {
  const r = el.getBoundingClientRect(), x = (evt.clientX - r.left) / r.width * 8, y = (evt.clientY - r.top) / r.height * 8;
  if (x < 0 || y < 0 || x >= 8 || y >= 8) return null;
  const f = Math.floor(x), rk = Math.floor(y);
  return flip ? FILES[7 - f] + (rk + 1) : FILES[f] + (8 - rk);
}

// bara de evaluare verticală: wAlb = procentul de câștig al albului (0–100)
export function baraEval(wAlb, text, flip) {
  const alb = Math.max(2, Math.min(98, wAlb));
  const albJos = !flip;
  return `<div class="evbar ${albJos ? "" : "inv"}" role="img" aria-label="Evaluare ${text}">
    <div class="evbar-alb" style="height:${alb}%"></div>
    <span class="evbar-t ${wAlb >= 50 ? "pe-alb" : "pe-negru"}">${text.replace(/^[+-]/, "").replace("M", "M")}</span></div>`;
}

export function idPiesa(fen, sq) {
  const p = parseFen(fen)[sq];
  return p ? (p === p.toUpperCase() ? "w" : "b") + p.toUpperCase() : null;
}
