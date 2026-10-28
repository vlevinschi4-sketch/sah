// statistici.js — ratingul în timp, rezultatele pe deschideri și culori, precizia pe faze și greșelile frecvente.
import * as A from "./analiza.js?v=40";
import { S, culoareaMea, rezultat, numeDeschidere, partideSortate, mele, statEx, serie } from "./stare.js?v=40";
import { capPagina } from "./cadru.js?v=40";
import { iconSVG } from "./tabla.js?v=40";
import { $, $$, esc, af, iu, plural, numeRo, familieRo, tip } from "./util.js?v=40";

// culori validate pentru fundalul întunecat (scripts/validate_palette.js: bandă de luminozitate, CVD, contrast)
const SERII = [["rapid", "Rapid", "#5a9a43"], ["blitz", "Blitz", "#4589d6"], ["bullet", "Bullet", "#b07a1c"]];
const fam = n => (n || "").split(":")[0].replace(/\s+\d.*$/, "").trim();

export function randeaza(el) {
  const ps = partideSortate(), st = statEx();
  const rating = tc => { const p = ps.find(q => q.timeClass === tc); return p ? (culoareaMea(p) === "w" ? p.alb : p.negru).rating : null; };
  const delta = tc => {
    const g = ps.filter(q => q.timeClass === tc);
    if (g.length < 2) return null;
    const acum = (culoareaMea(g[0]) === "w" ? g[0].alb : g[0].negru).rating;
    const limita = Date.now() / 1000 - 30 * 86400;
    const vechi = g.find(q => q.ts <= limita) || g[g.length - 1];
    return acum - (culoareaMea(vechi) === "w" ? vechi.alb : vechi.negru).rating;
  };
  const an = ps.filter(p => p.sumar), m = an.slice(0, 30).map(mele);
  const med = xs => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const accMed = med(m.map(x => x.acc).filter(x => x != null));
  const faza = k => med(m.map(x => x.avansat[k] && x.avansat[k].acc).filter(x => x != null));
  const sc = cul => { const g = ps.filter(p => culoareaMea(p) === cul); const s = { castig: 0, remiza: 0, pierdere: 0 }; g.forEach(p => s[rezultat(p)[0]]++); return { ...s, n: g.length, pct: g.length ? Math.round((s.castig + s.remiza / 2) / g.length * 100) : null }; };
  const W = sc("w"), B = sc("b");
  const tile = (ic, v, l, x = "") => `<div class="st-tile">${ic}<span class="v">${v ?? "—"}</span><span class="l">${l}</span>${x ? `<span class="x">${x}</span>` : ""}</div>`;
  const dTxt = d => (d == null ? "" : `<span class="${d >= 0 ? "k-be" : "k-bl"}">${d >= 0 ? "+" : "−"}${Math.abs(d)}</span> în 30 de zile`);
  // greșelile pe tipuri
  const tipuri = {};
  for (const p of S.partide) for (const g of p.greseli || []) if (g.tip && g.cl !== "in") tipuri[g.tip] = (tipuri[g.tip] || 0) + 1;
  const gr = Object.entries(tipuri).sort((a, b) => b[1] - a[1]).slice(0, 8), maxG = gr.length ? gr[0][1] : 1;
  el.innerHTML = `${capPagina("statistici", "Statistici", `<span class="sub">${esc(S.set.user)}</span>`)}
    <div class="st-grid">
      ${tile(iu("rapid", 26), rating("rapid"), "Rapid", dTxt(delta("rapid")))}
      ${tile(iu("blitz", 26), rating("blitz"), "Blitz", dTxt(delta("blitz")))}
      ${tile(iu("dezlegari", 26), st.rating, "Dezlegări", `${st.n} rezolvate`)}
      ${tile(iconSVG("be", 26), accMed != null ? af(accMed) + "%" : null, "Precizie medie", an.length ? `ultimele ${plural(Math.min(30, an.length), "partidă analizată", "partide analizate")}` : "analizează partide")}
      ${tile(iu("flacara", 26), serie(), "Zile consecutive", "partide sau antrenament")}
      ${tile(iu("rush", 26), st.rush.best, "Puzzle Rush", "record")}
    </div>
    <h2 class="sect-t">${iu("statistici", 26)}Ratingul în timp</h2>
    <div class="card"><div class="card-b" style="padding-top:12px" id="graf-r"></div></div>
    <div class="st-doua">
      <div>
        <h2 class="sect-t">${iu("partide", 26)}Rezultate pe culori</h2>
        <div class="card">${[["w", "Cu albul", W], ["b", "Cu negrul", B]].map(([c, n, s]) => `<div class="bar-r" style="grid-template-columns:minmax(0,1fr) 150px 52px">
          <span><span class="lamut ${c}" style="display:inline-block;vertical-align:-3px;margin-right:8px"></span>${n} · ${plural(s.n, "partidă", "partide")}</span>${wdl(s)}<span class="n">${s.pct ?? "—"}%</span></div>`).join("")}</div>
        <h2 class="sect-t">${iconSVG("mi", 26)}Ce greșești cel mai des</h2>
        <div class="card">${gr.length ? gr.map(([t, n]) => `<div class="bar-r" style="grid-template-columns:minmax(0,1fr) 120px 40px"><span>${esc(A.TIPURI[t])}</span><span class="bara" style="height:10px"><i style="width:${Math.round(n / maxG * 100)}%;background:#d9822b;border-radius:0 4px 4px 0"></i></span><span class="n">${n}</span></div>`).join("")
          : `<div class="gol"><p>Analizează câteva partide ca să apară greșelile tale.</p></div>`}</div>
        <h2 class="sect-t">${iconSVG("ex", 26)}Precizia pe faze și tipuri de mutări</h2>
        <div class="st-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
          ${tile("", faza("opening") != null ? af(faza("opening")) + "%" : null, "Deschidere")}${tile("", faza("tactics") != null ? af(faza("tactics")) + "%" : null, "Tactică", "momentele cu combinații")}${tile("", faza("strategy") != null ? af(faza("strategy")) + "%" : null, "Strategie", "mutările liniștite")}${tile("", faza("endgame") != null ? af(faza("endgame")) + "%" : null, "Final")}
        </div>
      </div>
      <div>
        <h2 class="sect-t">${iu("deschideri", 26)}Rezultate pe deschideri</h2>
        <div class="card" id="st-desch"></div>
      </div>
    </div>`;
  graficRating($("#graf-r"), ps);
  deschideri($("#st-desch"), ps);
}
function wdl(s) {
  const n = s.castig + s.remiza + s.pierdere || 1;
  return `<span class="wdl" style="width:100%;height:10px;gap:2px;background:none" title="${s.castig} câștigate, ${s.remiza} remize, ${s.pierdere} pierdute">
    ${s.castig ? `<i class="w" style="flex:${s.castig};border-radius:4px 0 0 4px"></i>` : ""}${s.remiza ? `<i class="d" style="flex:${s.remiza}"></i>` : ""}${s.pierdere ? `<i class="l" style="flex:${s.pierdere};border-radius:0 4px 4px 0"></i>` : ""}</span>`;
}
function deschideri(el, ps) {
  const g = { w: new Map(), b: new Map() };
  for (const p of ps) {
    const f = familieRo(numeDeschidere(p)), m = g[culoareaMea(p)];
    if (!m.has(f)) m.set(f, { castig: 0, remiza: 0, pierdere: 0, n: 0 });
    const x = m.get(f); x[rezultat(p)[0]]++; x.n++;
  }
  const sect = (c, t) => {
    const l = [...g[c].entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 6);
    if (!l.length) return "";
    return `<div class="card-h" style="font-size:15px"><span class="lamut ${c}"></span>${t}</div>${l.map(([f, s]) => `<div class="bar-r" style="grid-template-columns:minmax(0,1fr) 110px 44px">
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(f)}">${esc(f)} <span class="sub">· ${s.n}</span></span>${wdl(s)}<span class="n">${Math.round((s.castig + s.remiza / 2) / s.n * 100)}%</span></div>`).join("")}`;
  };
  el.innerHTML = sect("w", "Cu albul") + sect("b", "Cu negrul") || `<div class="gol"><p>Nicio partidă încă.</p></div>`;
}
// grafic cu linii: ratingul pe fiecare ritm de joc, cu linie verticală și etichetă la trecerea cu mouse-ul / degetul
function graficRating(el, ps) {
  const serii = SERII.map(([tc, n, c]) => {
    const pts = ps.filter(p => p.timeClass === tc && p.rated !== false).map(p => [p.ts, (culoareaMea(p) === "w" ? p.alb : p.negru).rating]).filter(x => x[1]).sort((a, b) => a[0] - b[0]);
    return { tc, n, c, pts };
  }).filter(s => s.pts.length >= 3);
  if (!serii.length) { el.innerHTML = `<div class="gol"><p>Ai nevoie de câteva partide sincronizate ca să apară graficul.</p></div>`; return; }
  const W = 720, H = 220, P = { l: 44, r: 56, t: 12, b: 26 };
  const xs = serii.flatMap(s => s.pts.map(p => p[0])), ys = serii.flatMap(s => s.pts.map(p => p[1]));
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.floor((Math.min(...ys) - 20) / 50) * 50, y1 = Math.ceil((Math.max(...ys) + 20) / 50) * 50;
  const X = t => P.l + (W - P.l - P.r) * (x1 === x0 ? .5 : (t - x0) / (x1 - x0)), Y = v => P.t + (H - P.t - P.b) * (1 - (v - y0) / (y1 - y0));
  const pas = (y1 - y0) / 50 > 6 ? 100 : 50;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="grafic" role="img" aria-label="Ratingul în timp">`;
  for (let v = y0; v <= y1; v += pas) s += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(255,255,255,.08)" stroke-width="1"/><text x="${P.l - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="rgba(255,255,255,.5)">${v}</text>`;
  const luni = []; const d = new Date(x0 * 1000); d.setDate(1); d.setHours(0, 0, 0, 0);
  while (d.getTime() / 1000 <= x1) { if (d.getTime() / 1000 >= x0) luni.push(d.getTime() / 1000); d.setMonth(d.getMonth() + 1); }
  const pasL = Math.ceil(luni.length / 8);
  luni.forEach((t, i) => { if (i % pasL === 0) s += `<text x="${X(t)}" y="${H - 6}" text-anchor="middle" font-size="11" fill="rgba(255,255,255,.5)">${new Date(t * 1000).toLocaleDateString("ro-RO", { month: "short" })}</text>`; });
  for (const sr of serii) {
    s += `<path d="${sr.pts.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ")}" fill="none" stroke="${sr.c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const u = sr.pts[sr.pts.length - 1];
    s += `<circle cx="${X(u[0])}" cy="${Y(u[1])}" r="4.5" fill="${sr.c}" stroke="#262522" stroke-width="2"/><text x="${X(u[0]) + 9}" y="${Y(u[1]) + 4}" font-size="12" font-weight="700" fill="#fff">${u[1]}</text>`;
  }
  s += `<line id="gr-x" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" stroke="rgba(255,255,255,.35)" stroke-width="1" visibility="hidden"/></svg>`;
  el.innerHTML = `<div class="chips" style="margin-bottom:8px">${serii.map(sr => `<span class="chip" style="cursor:default;display:inline-flex;align-items:center;gap:6px"><i style="width:14px;height:3px;border-radius:2px;background:${sr.c};display:inline-block"></i>${sr.n} · ${sr.pts.length}</span>`).join("")}</div>${s}`;
  const svg = el.querySelector("svg"), lin = el.querySelector("#gr-x");
  const arata = e => {
    const r = svg.getBoundingClientRect(), xv = (e.clientX - r.left) / r.width * W;
    if (xv < P.l || xv > W - P.r) { lin.setAttribute("visibility", "hidden"); tip(null); return; }
    const t = x0 + (xv - P.l) / (W - P.l - P.r) * (x1 - x0);
    lin.setAttribute("x1", xv); lin.setAttribute("x2", xv); lin.setAttribute("visibility", "visible");
    const randuri = serii.map(sr => { let b = sr.pts[0]; for (const p of sr.pts) if (Math.abs(p[0] - t) < Math.abs(b[0] - t)) b = p; return `<span style="display:inline-block;width:10px;height:3px;background:${sr.c};vertical-align:3px;margin-right:6px"></span>${sr.n}: <b>${b[1]}</b>`; });
    tip(`${new Date(t * 1000).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" })}<br>${randuri.join("<br>")}`, e.clientX, r.top + 10);
  };
  svg.addEventListener("pointermove", arata);
  svg.addEventListener("pointerleave", () => { lin.setAttribute("visibility", "hidden"); tip(null); });
}
