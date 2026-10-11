// "flow" lesson diagrams: boxes, arrows that draw themselves, coins travelling along arrows, proportion bars,
// figure badges and a camera that frames each step. Driven by a spec in content/lesson-visuals.json:
//
//   nodes: { id: { x, y, label, sub?, w?, tone?: paper|ink|gold|blue|red|mint, kind?: 'bar',
//                  // bars only: max?, slices: [{ from?, pct, tone?, label?, step? }], marker?: { pct, label, step? } } }
//   edges: [ { id, from, to, label?, bend?, both?, dashed? } ]
//   steps: [ { show: [ids], flow: [edgeIds], focus: [ids], badge?: nodeId, highlight?: [ids], wobble?: [ids], dim?: true } ]
//
// The badge shows that step's own figure + figureLabel from the lesson, so no number is ever invented here.

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TONES = {
  paper: ['#FFFFFF', '#17181C'], ink: ['#17181C', '#FFFFFF'], gold: ['#F4D27A', '#17181C'],
  blue: ['#2D4E86', '#FFFFFF'], red: ['#F5C8C6', '#8C2323'], mint: ['#BFE5CB', '#14592F'],
};
const FILL = { blue: '#2D4E86', gold: '#E9B21A', red: '#C5453A', mint: '#3E8E62', ink: '#17181C', paper: '#FFFFFF' };

export function flowHtml({ topic, V, T, TOTAL, B, poses, field }) {
  const steps = topic.steps.slice(0, 4);
  const W = 1000, H = 800;
  // ---- geometry ----
  const N = {};
  for (const [id, n] of Object.entries(V.nodes)) {
    const bar = n.kind === 'bar';
    const w = n.w || (bar ? 800 : 300);
    const h = bar ? 160 : n.sub ? 150 : 110;
    N[id] = { ...n, id, bar, w, h, l: n.x - w / 2, t: n.y - h / 2 };
  }
  const anchor = (a, b) => { // point on a's rect (inflated) along the line to b
    const dx = b.x - a.x, dy = b.y - a.y, pad = 10;
    const hw = a.w / 2 + pad, hh = a.h / 2 + pad;
    const s = Math.min(hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6));
    return [a.x + dx * s, a.y + dy * s];
  };
  const edges = (V.edges || []).map((e) => {
    const a = N[e.from], b = N[e.to];
    if (!a || !b) throw new Error(`edge ${e.id}: unknown node`);
    const [x1, y1] = anchor(a, b), [x2, y2] = anchor(b, a);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, len = Math.hypot(x2 - x1, y2 - y1);
    const bend = e.bend ?? 0, cx = mx - ((y2 - y1) / len) * bend * len, cy = my + ((x2 - x1) / len) * bend * len;
    // arrowhead aligned with the curve's end tangent
    const tx = x2 - cx, ty = y2 - cy, tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl, s = 18;
    const head = `M${x2 - ux * s - uy * s * 0.6},${y2 - uy * s + ux * s * 0.6} L${x2},${y2} L${x2 - ux * s + uy * s * 0.6},${y2 - uy * s - ux * s * 0.6}`;
    const lx = 0.25 * x1 + 0.5 * cx + 0.25 * x2, ly = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
    let tail = '';
    if (e.both) {
      const tx2 = x1 - cx, ty2 = y1 - cy, tl2 = Math.hypot(tx2, ty2) || 1, vx = tx2 / tl2, vy = ty2 / tl2;
      tail = `M${x1 - vx * s - vy * s * 0.6},${y1 - vy * s + vx * s * 0.6} L${x1},${y1} L${x1 - vx * s + vy * s * 0.6},${y1 - vy * s - vx * s * 0.6}`;
    }
    return { ...e, d: `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`, head, tail, lx, ly };
  });

  // ---- markup ----
  const nodeHtml = Object.values(N).map((n) => {
    const [bg, fg] = TONES[n.tone || 'paper'] || TONES.paper;
    if (n.bar) {
      const max = n.max || 100;
      const slices = (n.slices || []).map((s, i) => `<i class="slice" id="${n.id}-s${i}" style="left:${((s.from || 0) / max) * 100}%; width:${(s.pct / max) * 100}%; background:${FILL[s.tone || 'blue']}"></i>${s.label ? `<span class="slab" id="${n.id}-sl${i}" style="left:${(((s.from || 0) + s.pct / 2) / max) * 100}%">${esc(s.label)}</span>` : ''}`).join('');
      const mk = n.marker ? `<i class="mark" id="${n.id}-mk" style="left:${(n.marker.pct / max) * 100}%"><span>${esc(n.marker.label || n.marker.pct + '%')}</span></i>` : '';
      return `<div class="node bar" id="n-${n.id}" style="left:${n.l}px; top:${n.t}px; width:${n.w}px; height:${n.h}px"><div class="nb"><div class="blab">${esc(n.label)}</div><div class="track">${slices}${mk}</div></div><i class="hl"></i></div>`;
    }
    return `<div class="node" id="n-${n.id}" style="left:${n.l}px; top:${n.t}px; width:${n.w}px; height:${n.h}px"><div class="nb" style="background:${bg}; color:${fg}"><div class="d nl">${esc(n.label)}</div>${n.sub ? `<div class="ns">${esc(n.sub)}</div>` : ''}</div><i class="hl"></i></div>`;
  }).join('\n');
  const edgeSvg = edges.map((e) => `<g id="e-${e.id}" class="edge${e.dashed ? ' dashed' : ''}"><path class="line" pathLength="1" d="${e.d}"/><path class="head" d="${e.head}"/>${e.tail ? `<path class="head tail" d="${e.tail}"/>` : ''}</g>`).join('');
  const edgeLabels = edges.filter((e) => e.label).map((e) => `<span class="elab" id="el-${e.id}" style="left:${e.lx}px; top:${e.ly}px">${esc(e.label)}</span>`).join('');
  const tokens = edges.map((e) => [0, 1, 2].map((k) => `<i class="tok" id="tk-${e.id}-${k}"></i>`).join('')).join('');
  // badges: one per step that has a figure and a badge target
  const badgeRects = {};
  const badges = steps.map((s, i) => {
    const sp = V.steps[i] || {};
    if (!s.figure || !sp.badge || !N[sp.badge]) return '';
    const n = N[sp.badge];
    const side = sp.badgeSide || (n.t + n.h + 150 < H ? 'below' : 'above');
    const x = side === 'right' ? n.l + n.w + 24 : side === 'left' ? n.l - 24 : n.x;
    const y = side === 'below' ? n.t + n.h + 18 : side === 'above' ? n.t - 18 : n.y - 62;
    const bw = Math.max(String(s.figure).length * 44, String(s.figureLabel || '').length * 12.5) + 56, bh = 128;
    const bl = side === 'right' ? x : side === 'left' ? x - bw : x - bw / 2, bt = side === 'above' ? y - bh : side === 'below' ? y : y;
    badgeRects['bd' + i] = [bl, bt, bw, bh];
    return `<div class="badge ${side}" id="bd${i}" style="left:${x}px; top:${y}px" data-node="${sp.badge}"><div class="bin"><span class="d bf" data-figure="${esc(s.figure)}">${esc(s.figure)}</span><span class="bl">${esc(s.figureLabel || '')}</span></div></div>`;
  }).join('');

  const geo = { N: Object.fromEntries(Object.values(N).map((n) => [n.id, [n.l, n.t, n.w, n.h]])), BD: badgeRects, W, H };

  const css = `
@font-face { font-family: 'Bricolage'; src: url(assets/fonts/bricolage.woff2) format('woff2'); font-weight: 200 800; font-stretch: 75% 100%; }
@font-face { font-family: 'InterT'; src: url(assets/fonts/inter-tight.woff2) format('woff2'); font-weight: 100 900; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1920px; overflow: hidden; background: ${field}; }
#root { position: relative; width: 100%; height: 100%; overflow: hidden; background: ${field}; color: #17181C; font-family: 'InterT', sans-serif; }
.clip { position: absolute; inset: 0; }
.d { font-family: 'Bricolage', sans-serif; font-weight: 700; font-stretch: 88%; letter-spacing: -.03em; }
#grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.5) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,.5) 2px, transparent 2px); background-size: 60px 60px; }
#chrome { position: absolute; left: 80px; right: 80px; top: 230px; display: flex; justify-content: space-between; align-items: center; }
.chip { display: inline-block; font-size: 30px; font-weight: 650; padding: 12px 24px; border-radius: 999px; background: #17181C; color: ${field}; }
.dots { display: flex; gap: 10px; } .dots i { width: 14px; height: 14px; border-radius: 50%; background: rgba(23,24,28,.18); display: block; }
#title { position: absolute; left: 80px; top: 640px; width: 920px; font-size: 150px; line-height: .9; }
#title .ln { overflow: hidden; padding-bottom: 10px; } #title .ln > span { display: inline-block; }
.txt { position: absolute; left: 80px; top: 330px; width: 920px; }
.txt .head { font-size: 84px; line-height: .95; }
.txt .body { font-size: 36px; line-height: 1.32; margin-top: 18px; width: 860px; color: rgba(23,24,28,.88); font-weight: 500; }
.ln { overflow: hidden; } .ln > span { display: inline-block; }
#vp { position: absolute; left: 60px; top: 700px; width: 960px; height: 800px; overflow: hidden; -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 36px, #000 calc(100% - 36px), transparent 100%); mask-image: linear-gradient(to bottom, transparent 0, #000 36px, #000 calc(100% - 36px), transparent 100%); }
#world { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; }
#edges { position: absolute; left: 0; top: 0; overflow: visible; }
.edge .line { fill: none; stroke: #17181C; stroke-width: 4; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; }
.edge.dashed .line { stroke-dasharray: 0.02 0.02; stroke-dashoffset: 0; }
.edge .head { fill: none; stroke: #17181C; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
.elab { position: absolute; white-space: nowrap; font-size: 26px; font-weight: 700; padding: 6px 14px; border-radius: 999px; background: #17181C; color: #fff; }
.node { position: absolute; }
.node .nb { position: absolute; inset: 0; border-radius: 26px; border: 3px solid #17181C; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 10px 16px; box-shadow: 0 6px 0 rgba(23,24,28,.14); }
.nl { font-size: 42px; line-height: 1; }
.ns { font-size: 26px; font-weight: 600; margin-top: 8px; opacity: .85; line-height: 1.15; }
.node.bar .nb { border: 0; box-shadow: none; align-items: stretch; justify-content: flex-start; padding: 0; }
.blab { font-size: 32px; font-weight: 700; text-align: left; margin-bottom: 12px; }
.track { position: relative; height: 70px; border-radius: 16px; border: 3px solid #17181C; background: rgba(255,255,255,.75); overflow: visible; }
.slice { position: absolute; top: 0; bottom: 0; display: block; transform-origin: 0 50%; }
.slab { position: absolute; top: 82px; white-space: nowrap; font-size: 26px; font-weight: 700; }
.mark { position: absolute; top: -26px; bottom: -14px; width: 0; border-left: 4px dashed #17181C; display: block; }
.mark span { position: absolute; top: -34px; left: -2px; white-space: nowrap; font-size: 22px; font-weight: 800; }
.hl { position: absolute; inset: -12px; border-radius: 34px; border: 5px solid #17181C; opacity: 0; display: block; }
.node.bar .hl { inset: 30px -14px -14px -14px; border-radius: 22px; }
.tok { position: absolute; left: -15px; top: -15px; width: 30px; height: 30px; border-radius: 50%; background: #E9B21A; border: 3px solid #17181C; box-shadow: inset -4px -4px 0 rgba(0,0,0,.12); opacity: 0; display: block; }
.badge { position: absolute; width: 0; height: 0; }
.badge .bin { position: absolute; left: 0; top: 0; display: flex; flex-direction: column; align-items: center; background: #17181C; color: #fff; border-radius: 22px; padding: 12px 26px 14px; white-space: nowrap; }
.badge.above .bin { top: auto; bottom: 0; }
.bf { font-size: 76px; line-height: 1; color: #F4D27A; font-variant-numeric: tabular-nums; }
.bl { font-size: 24px; font-weight: 650; margin-top: 4px; opacity: .9; }
.coin { position: absolute; left: 760px; top: 1440px; width: 280px; height: 280px; }
.coin img { position: absolute; inset: 0; width: 100%; height: 100%; }
#outro { position: absolute; inset: 0; }
#o-head { position: absolute; left: 80px; top: 560px; width: 920px; font-size: 128px; line-height: .9; }
#o-sub { position: absolute; left: 84px; top: 820px; font-size: 40px; font-weight: 600; color: rgba(23,24,28,.8); }
#o-follow { position: absolute; left: 80px; top: 920px; }
#o-follow span { display: inline-block; font-size: 42px; font-weight: 650; padding: 20px 38px; border-radius: 999px; background: #17181C; color: ${field}; }
#o-disc { position: absolute; left: 84px; top: 1300px; width: 560px; font-size: 22px; line-height: 1.4; color: rgba(23,24,28,.75); }
`;

  const stepTxt = steps.map((s, i) => `<div class="txt" id="t${i}"><div class="d head fit" data-maxh="170">${esc(s.head)}</div><div class="body fit" data-maxh="150">${esc(s.body)}</div></div>`).join('\n');

  const runtime = `
const B = ${B}, T = ${JSON.stringify(T)}, TOTAL = ${TOTAL};
const SPEC = ${JSON.stringify({ nodes: Object.fromEntries(Object.values(N).map((n) => [n.id, { bar: n.bar, slices: (n.slices || []).map((s) => s.step || 0), marker: n.marker ? n.marker.step || 0 : null }])), edges: edges.map((e) => ({ id: e.id, both: !!e.both })), steps: V.steps })};
const GEO = ${JSON.stringify(geo)};
function fitText(el) {
  const maxh = +el.dataset.maxh || 9999;
  let fs = parseFloat(getComputedStyle(el).fontSize);
  for (let i = 0; i < 40 && (el.scrollHeight > maxh + 2 || el.scrollWidth > el.clientWidth + 2); i++) { fs *= 0.95; el.style.fontSize = fs + 'px'; }
}
function lines(el) {
  const words = el.textContent.trim().split(/\\s+/);
  el.innerHTML = words.map((w) => '<span class="w" style="display:inline-block">' + w + '</span>').join(' ');
  const rows = [];
  el.querySelectorAll('.w').forEach((s) => { let r = rows.find((x) => Math.abs(x.top - s.offsetTop) < 4); if (!r) rows.push(r = { top: s.offsetTop, w: [] }); r.w.push(s.textContent); });
  el.innerHTML = rows.map((r) => '<div class="ln" style="padding-bottom:.08em; margin-bottom:-.08em"><span>' + r.w.join(' ') + '</span></div>').join('');
  return [...el.querySelectorAll('.ln > span')];
}
function fitNodes() {
  document.querySelectorAll('.node:not(.bar) .nl').forEach((el) => { let fs = 42; const box = el.parentElement; for (let i = 0; i < 20 && (el.scrollWidth > box.clientWidth - 30 || box.scrollHeight > box.clientHeight + 1); i++) { fs *= 0.93; el.style.fontSize = fs + 'px'; } });
}
function parseFig(str) {
  const m = String(str).match(/^([^\\d]*?)(\\d[\\d,]*(?:\\.\\d+)?)([^\\d]*)$/);
  return m ? { pre: m[1], num: parseFloat(m[2].replace(/,/g, '')), dec: (m[2].split('.')[1] || '').length, comma: m[2].includes(','), post: m[3] } : null;
}

function build() {
  document.querySelectorAll('.fit').forEach(fitText);
  fitNodes();
  const tl = gsap.timeline({ paused: true });
  const world = document.getElementById('world');

  // ---- camera: frame the boxes a step is about ----
  const frame = (ids, step) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const list = (ids && ids.length ? ids : Object.keys(GEO.N)).map((id) => GEO.N[id]);
    if (step != null && GEO.BD['bd' + step]) list.push(GEO.BD['bd' + step]); // keep the step's badge in shot
    list.forEach((r) => { if (!r) return; x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[0] + r[2]); y1 = Math.max(y1, r[1] + r[3]); });
    const pad = 70, s = Math.max(0.74, Math.min(1.5, 960 / (x1 - x0 + pad * 2), 760 / (y1 - y0 + pad * 2)));
    return { scale: s, x: 480 - s * (x0 + x1) / 2, y: 400 - s * (y0 + y1) / 2 };
  };
  const steps = SPEC.steps;
  tl.set(world, { ...frame(steps[0] && steps[0].focus, 0), transformOrigin: '0 0' }, 0);

  // ---- title + step text (shared shell) ----
  const tlines = [...document.querySelectorAll('#title .ln > span')];
  tl.fromTo('#chrome', { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0.05);
  tl.fromTo(tlines, { yPercent: 110 }, { yPercent: 0, duration: 0.7, stagger: 0.12, ease: 'power4.out' }, 0.15);
  tl.fromTo('#coin', { y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, 0.6);
  tl.to(tlines, { yPercent: -110, duration: 0.5, stagger: 0.06, ease: 'power3.in' }, T[1] - 0.55);
  tl.set('#title', { opacity: 0 }, T[1] + 0.05);
  const txt = [...document.querySelectorAll('.txt')].map((el) => ({ el, head: lines(el.querySelector('.head')), body: lines(el.querySelector('.body')) }));
  txt.forEach((t, i) => {
    const t0 = T[1 + i];
    tl.set(t.el, { opacity: 0 }, 0); tl.set(t.el, { opacity: 1 }, t0);
    if (i < txt.length - 1) tl.set(t.el, { opacity: 0 }, T[2 + i] + 0.05);
    tl.fromTo(t.head, { yPercent: 110 }, { yPercent: 0, duration: 0.6, stagger: 0.07, ease: 'power3.out' }, t0 + 0.05);
    tl.fromTo(t.body, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.55, stagger: 0.06, ease: 'power3.out' }, t0 + 0.35);
    if (i < txt.length - 1) tl.to([...t.head, ...t.body], { yPercent: -110, opacity: 0, duration: 0.4, stagger: 0.02, ease: 'power2.in' }, T[2 + i] - 0.42);
    else tl.to(t.el, { opacity: 0, duration: 0.4, immediateRender: false }, T[5] - 0.3);
    const dot = document.getElementById('dot' + i);
    tl.fromTo(dot, { backgroundColor: 'rgba(23,24,28,.18)', scale: 1 }, { backgroundColor: '#17181C', scale: 1.25, duration: 0.3, ease: 'power2.out' }, t0);
    tl.to(dot, { scale: 1, duration: 0.3 }, t0 + 0.3);
  });

  // ---- diagram vocabulary ----
  const node = (id) => document.getElementById('n-' + id), edge = (id) => document.getElementById('e-' + id);
  const shown = new Set();
  Object.keys(GEO.N).forEach((id) => tl.set(node(id), { opacity: 0 }, 0));
  SPEC.edges.forEach((e) => { tl.set(edge(e.id), { opacity: 0 }, 0); const l = document.getElementById('el-' + e.id); if (l) tl.set(l, { opacity: 0 }, 0); });
  document.querySelectorAll('.badge').forEach((b) => tl.set(b, { opacity: 0 }, 0));

  const showNode = (id, at) => {
    const el = node(id), n = SPEC.nodes[id];
    tl.set(el, { opacity: 1 }, at);
    tl.fromTo(el.querySelector('.nb'), { opacity: 0, scale: 0.82, y: 26 }, { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: 'back.out(1.6)' }, at);
    if (n.bar) {
      n.slices.forEach((st, i) => { if (!st) growSlice(id, i, at + 0.3 + i * 0.25); else hideSlice(id, i); });
      if (n.marker === 0) dropMarker(id, at + 0.6); else if (n.marker) tl.set('#' + id + '-mk', { opacity: 0 }, 0);
    }
  };
  const hideSlice = (id, i) => { tl.set('#' + id + '-s' + i, { scaleX: 0 }, 0); const l = document.getElementById(id + '-sl' + i); if (l) tl.set(l, { opacity: 0 }, 0); };
  const growSlice = (id, i, at) => {
    tl.fromTo('#' + id + '-s' + i, { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power3.inOut' }, at);
    const l = document.getElementById(id + '-sl' + i);
    if (l) tl.fromTo(l, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.35 }, at + 0.6);
  };
  const dropMarker = (id, at) => tl.fromTo('#' + id + '-mk', { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, at);
  const drawEdge = (id, at) => {
    const g = edge(id);
    tl.set(g, { opacity: 1 }, at);
    const line = g.querySelector('.line');
    if (!g.classList.contains('dashed')) tl.fromTo(line, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut' }, at);
    else tl.fromTo(line, { opacity: 0 }, { opacity: 1, duration: 0.5 }, at);
    tl.fromTo(g.querySelectorAll('.head'), { opacity: 0 }, { opacity: 1, duration: 0.15 }, at + 0.5);
    const l = document.getElementById('el-' + id);
    if (l) tl.fromTo(l, { xPercent: -50, yPercent: -50, opacity: 0, scale: 0.7 }, { xPercent: -50, yPercent: -50, opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, at + 0.45);
  };
  // coins along an arrow: points sampled once at build, position derived from one progress value per coin
  const samples = {};
  SPEC.edges.forEach((e) => {
    const p = edge(e.id).querySelector('.line'), L = p.getTotalLength(), pts = [];
    for (let i = 0; i <= 60; i++) { const q = p.getPointAtLength((L * i) / 60); pts.push([q.x, q.y]); }
    samples[e.id] = pts;
  });
  const at = (pts, f) => { const x = Math.max(0, Math.min(1, f)) * 60, i = Math.min(59, Math.floor(x)), r = x - i; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r]; };
  const flowCount = {};
  const flow = (id, t, reverse = false) => {
    const pts = samples[id];
    [0, 1, 2].forEach((k) => {
      const el = document.getElementById('tk-' + id + '-' + k), o = { f: 0 };
      const put = () => { const [x, y] = at(pts, reverse ? 1 - o.f : o.f); el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; };
      const s = t + k * 0.24;
      tl.fromTo(o, { f: 0 }, { f: 1, duration: 1.05, ease: 'power1.inOut', onUpdate: put, onStart: put, immediateRender: false }, s);
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.18, immediateRender: false }, s);
      tl.to(el, { opacity: 0, duration: 0.18 }, s + 0.9);
    });
  };
  const badge = (i, t) => {
    const b = document.getElementById('bd' + i);
    if (!b) return;
    tl.set(b, { opacity: 1 }, t);
    const xp = b.classList.contains('right') ? 0 : b.classList.contains('left') ? -100 : -50;
    tl.fromTo(b.querySelector('.bin'), { xPercent: xp, scale: 0.5, opacity: 0, transformOrigin: xp === 0 ? '0% 50%' : xp === -100 ? '100% 50%' : '50% 0%' }, { xPercent: xp, scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.8)' }, t);
    const f = b.querySelector('.bf'), m = parseFig(f.dataset.figure);
    if (m && !/[–-]/.test(f.dataset.figure.replace(/^-/, ''))) {
      const o = { v: 0 };
      f.style.minWidth = f.getBoundingClientRect().width + 'px';
      tl.fromTo(o, { v: 0 }, { v: m.num, duration: 0.9, ease: 'power3.out', immediateRender: false, onUpdate: () => { f.textContent = m.pre + (m.comma || m.num >= 10000 ? o.v.toLocaleString('en-US', { minimumFractionDigits: m.dec, maximumFractionDigits: m.dec }) : o.v.toFixed(m.dec)) + m.post; } }, t + 0.05);
    }
    return b;
  };
  const highlight = (id, t) => {
    const h = node(id).querySelector('.hl');
    tl.fromTo(h, { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'power3.out' }, t);
    tl.to(h, { opacity: 0, duration: 0.5 }, t + 1.6);
  };
  const wobble = (id, t) => tl.fromTo(node(id).querySelector('.nb'), { y: 0 }, { y: -12, duration: 0.16, yoyo: true, repeat: 5, ease: 'sine.inOut', immediateRender: false }, t);

  // ---- steps ----
  let lastBadge = null;
  steps.forEach((st, i) => {
    const t0 = T[1 + i];
    if (i > 0) tl.to(world, { ...frame(st.focus, i), duration: 1.0, ease: 'power3.inOut' }, t0 - 0.15);
    let t = t0 + 0.35;
    (st.show || []).forEach((id) => {
      if (GEO.N[id]) { if (!shown.has(id)) { showNode(id, t); shown.add(id); t += 0.28; } }
      else if (edge(id)) { drawEdge(id, t); t += 0.22; }
    });
    // slices / markers that wait for this step
    Object.entries(SPEC.nodes).forEach(([id, n]) => {
      if (!n.bar) return;
      n.slices.forEach((s, k) => { if (s === i + 1) growSlice(id, k, t0 + 0.6 + k * 0.1); });
      if (n.marker === i + 1) dropMarker(id, t0 + 0.8);
    });
    const tf = Math.max(t + 0.3, t0 + 1.4);
    (st.flow || []).forEach((id, k) => { flow(id, tf + k * 0.35); const e = SPEC.edges.find((x) => x.id === id); if (e && e.both) flow(id, tf + k * 0.35 + 1.3, true); });
    if (st.badge) {
      if (lastBadge) tl.to(lastBadge, { opacity: 0, duration: 0.3 }, t0 + 0.1);
      lastBadge = badge(i, Math.max(t, t0 + 1.0)) || lastBadge;
    } else if (lastBadge && i > 0) { tl.to(lastBadge, { opacity: 0, duration: 0.3 }, t0 + 0.1); lastBadge = null; }
    (st.highlight || []).forEach((id) => highlight(id, tf + 0.6));
    (st.wobble || []).forEach((id) => wobble(id, tf + 0.4));
    // dim what this step isn't about
    if (st.dim) Object.keys(GEO.N).forEach((id) => { if (shown.has(id)) tl.to(node(id).querySelector('.nb'), { opacity: (st.focus || []).includes(id) ? 1 : 0.32, duration: 0.4, immediateRender: false }, t0 + 0.1); });
    else if (i > 0 && steps[i - 1].dim) Object.keys(GEO.N).forEach((id) => { if (shown.has(id)) tl.to(node(id).querySelector('.nb'), { opacity: 1, duration: 0.4 }, t0 + 0.1); });
  });

  // ---- coin: one gentle swap on the last step, breathing throughout ----
  tl.to('#pose0', { opacity: 0, duration: 0.35 }, T[4] + 1.0);
  tl.fromTo('#pose1', { opacity: 0 }, { opacity: 1, duration: 0.35 }, T[4] + 1.0);
  let n = Math.floor((TOTAL - 2) / (2 * B)); if (n % 2) n--;
  tl.fromTo('#coin img', { scaleY: 1, transformOrigin: '50% 90%' }, { scaleY: 1.018, duration: 2 * B, yoyo: true, repeat: n - 1, ease: 'sine.inOut' }, 1.5);

  // ---- outro ----
  const s5 = T[5];
  tl.to('#vp', { opacity: 0, y: 40, duration: 0.5, ease: 'power2.in' }, s5 - 0.3);
  tl.fromTo('#outro', { opacity: 0 }, { opacity: 1, duration: 0.01 }, s5 + 0.1);
  tl.fromTo(lines(document.getElementById('o-head')), { yPercent: 110 }, { yPercent: 0, duration: 0.6, stagger: 0.09, ease: 'power3.out' }, s5 + 0.15);
  tl.fromTo('#o-sub', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, s5 + 0.5);
  tl.fromTo('#o-follow span', { scale: 0.6, opacity: 0, transformOrigin: '0% 50%' }, { scale: 1, opacity: 1, duration: 0.45, ease: 'expo.out' }, s5 + 0.75);
  tl.fromTo('#o-disc', { opacity: 0 }, { opacity: 1, duration: 0.5 }, s5 + 1.0);
  tl.to('#pose1', { opacity: 0, duration: 0.3 }, s5);
  tl.to('#pose0', { opacity: 1, duration: 0.3 }, s5);

  window.__timelines['main'] = tl;
  if (window.__hfForceTimelineRebind) window.__hfForceTimelineRebind();
}
document.fonts.ready.then(build);
`;

  return `<!doctype html>
<html lang="en" data-resolution="portrait">
<head><meta charset="UTF-8"><meta name="viewport" content="width=1080, height=1920">
<script src="vendor/gsap.min.js"></script>
<style>${css}</style></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="1080" data-height="1920">
 <div id="scene" class="clip" data-start="0" data-duration="${TOTAL}" data-track-index="0">
  <div id="grid" data-layout-ignore></div>
  <div id="chrome"><span class="chip">Money explained</span><div class="dots">${steps.map((_, i) => `<i id="dot${i}"></i>`).join('')}</div></div>
  <div id="title" class="d">${esc(topic.title).split('\n').map((l) => `<div class="ln"><span>${l}</span></div>`).join('')}</div>
  ${stepTxt}
  <div id="vp" data-layout-allow-overflow data-layout-allow-overlap><div id="world">
    <svg id="edges" width="${W}" height="${H}">${edgeSvg}</svg>
    ${edgeLabels}
    ${nodeHtml}
    ${tokens}
    ${badges}
  </div></div>
  <div class="coin" id="coin">${poses.slice(0, 2).map((p, i) => `<img src="assets/coin/${p}.png" alt="" id="pose${i}"${i ? ' style="opacity:0"' : ''}>`).join('')}</div>
  <div id="outro" data-layout-allow-overlap>
    <div id="o-head" class="d">See you next weekend</div>
    <div id="o-sub">Money explained, every Sunday and Monday</div>
    <div id="o-follow"><span>Follow @byte.finance.au</span></div>
    <p id="o-disc">General information only, not financial advice. It doesn’t consider your objectives, financial situation or needs.</p>
  </div>
 </div>
 <audio id="music" src="assets/audio/music.wav" data-start="0" data-duration="${TOTAL}" data-track-index="10" data-volume="1"
   data-automation='{"version":1,"lanes":[{"target":"volume","points":[{"t":0,"v":1},{"t":${(TOTAL - 1.2).toFixed(2)},"v":1},{"t":${TOTAL},"v":0}]}]}'></audio>
</div>
<script>${runtime}</script>
</body></html>`;
}
