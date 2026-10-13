// Builds index.html for a weekend "Money explained" lesson Reel.
//   node reels/lesson/scripts/build.mjs <topic-id> [--music=sunday-paper]
// One living diagram that builds across the lesson's steps while the camera moves around it, with the coin
// as a quiet narrator. Every number on screen is either from the lesson itself or computed from its stated
// inputs (and checked against the lesson's figures).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_TOPICS } from '../../../src/explainers.js';
import { copySfx, cueList, shellCues, sfxTags } from './sfx.mjs';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(here, '../..');
const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--')) || 'compound-interest';
const topic = ALL_TOPICS.find((t) => t.id === id);
if (!topic) throw new Error(`unknown topic ${id}`);
const VISUALS = JSON.parse(readFileSync(join(repo, 'content/lesson-visuals.json'), 'utf8'));
const V = VISUALS[id];
if (!V) throw new Error(`no visual spec for ${id} in content/lesson-visuals.json`);
const MUSIC = args.find((a) => a.startsWith('--music='))?.slice(8) || 'sunday-paper';

// ---- assets ----
for (const d of ['coin', 'fonts', 'audio']) mkdirSync(join(here, 'assets', d), { recursive: true });
copyFileSync(join(repo, 'node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2'), join(here, 'assets/fonts/bricolage.woff2'));
copyFileSync(join(repo, 'node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2'), join(here, 'assets/fonts/inter-tight.woff2'));
copyFileSync(join(repo, 'render/assets/audio/music', `${MUSIC}.wav`), join(here, 'assets/audio/music.wav'));
copySfx(repo, here);
const poses = [topic.pose || 'thinking', V.endPose || 'worried', 'cbd_strut'];
for (const p of new Set(poses)) copyFileSync(join(repo, 'render/assets/coin', `${p}.png`), join(here, 'assets/coin', `${p}.png`));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const C = { field: V.field || '#C8DAF2', ink: '#17181C', principal: '#2D4E86', interest: '#E9B21A', compound: '#B9780C', debt: '#C5453A', debtDeep: '#8C2323', paper: '#F6F9FD' };
const money = (v) => '$' + Math.round(v).toLocaleString('en-US');

// ---- timing: 112 BPM, scene lengths in beats ----
const B = 60 / 112;
const beats = [6, 12, 10, 12, 12, 7];
const T = [0];
for (const b of beats) T.push(+(T[T.length - 1] + b * B).toFixed(3));
const TOTAL = +(T[T.length - 1] + 0.35).toFixed(2);

if (V.type === 'flow') {
  const { flowHtml } = await import('./flow.mjs');
  writeFileSync(join(here, 'index.html'), flowHtml({ topic, V, T, TOTAL, B, poses, field: V.field || '#C8DAF2' }));
  console.log(`lesson ${id} (flow): ${TOTAL}s, music ${MUSIC}, scenes at ${T.join(', ')}`);
  process.exit(0);
}

// ---- growth model (compound-interest style) ----
const g = V.type === 'growth' ? (() => {
  const yrs = V.years, vals = Array.from({ length: yrs + 1 }, (_, i) => V.start * (1 + V.rate) ** i);
  // check the lesson's own figures against the model before we draw a single pixel
  for (const [i, s] of topic.steps.entries()) {
    const m = String(s.figure || '').match(/^\$([\d,]+)$/);
    if (m && V.marks?.[i] != null) {
      const want = +m[1].replace(/,/g, ''), got = Math.round(vals[V.marks[i]]);
      if (Math.abs(want - got) > 1) throw new Error(`step ${i + 1} figure ${s.figure} doesn't match model (${got})`);
    }
  }
  return { yrs, vals };
})() : null;

// world geometry (diagram units): columns along the x axis, baseline at y = BASE
const COLW = 50, STEP = 66, X0 = 40, BASE = 760, HMAX = 640;
const k = g ? HMAX / g.vals[g.yrs] : 1;
const colX = (i) => X0 + i * STEP;
const columns = g ? g.vals.map((v, i) => {
  const simple = V.start * V.rate * i;            // plain interest, if it never compounded
  const comp = v - V.start - simple;              // the extra: interest earned on interest
  const seg = (h, cls) => `<i class="seg ${cls}" style="height:${(h * k).toFixed(2)}px"></i>`;
  const yl = i === 0 ? 'Now' : i % 5 === 0 ? `Yr ${i}` : '';
  return `<div class="col" id="col${i}" style="left:${colX(i)}px; width:${COLW}px">${seg(comp, 'comp')}${seg(simple, 'int')}${seg(V.start, 'prin')}</div>${yl ? `<span class="yl" style="left:${colX(i) + COLW / 2}px">${yl}</span>` : ''}`;
}).join('') : '';
const curve = g ? g.vals.map((v, i) => `${i ? 'L' : 'M'}${(colX(i) + COLW / 2).toFixed(1)},${(BASE - v * k).toFixed(1)}`).join(' ') : '';
const yr1 = g ? V.start * V.rate : 0, yr2extra = g ? V.start * V.rate * V.rate : 0;

const steps = topic.steps.slice(0, 4);
const css = `
@font-face { font-family: 'Bricolage'; src: url(assets/fonts/bricolage.woff2) format('woff2'); font-weight: 200 800; font-stretch: 75% 100%; }
@font-face { font-family: 'InterT'; src: url(assets/fonts/inter-tight.woff2) format('woff2'); font-weight: 100 900; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1920px; overflow: hidden; background: ${C.field}; }
#root { position: relative; width: 100%; height: 100%; overflow: hidden; background: ${C.field}; color: ${C.ink}; font-family: 'InterT', sans-serif; }
.clip { position: absolute; inset: 0; }
.d { font-family: 'Bricolage', sans-serif; font-weight: 700; font-stretch: 88%; letter-spacing: -.035em; }
#grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.55) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,.55) 2px, transparent 2px); background-size: 60px 60px; }
#chrome { position: absolute; left: 80px; right: 80px; top: 230px; display: flex; justify-content: space-between; align-items: center; }
.chip { display: inline-block; font-size: 30px; font-weight: 650; padding: 12px 24px; border-radius: 999px; background: ${C.ink}; color: ${C.field}; }
.dots { display: flex; gap: 10px; } .dots i { width: 14px; height: 14px; border-radius: 50%; background: rgba(23,24,28,.18); display: block; }
.dots b { position: absolute; width: 14px; height: 14px; border-radius: 50%; background: ${C.ink}; display: block; }
#title { position: absolute; left: 80px; top: 640px; width: 920px; font-size: 150px; line-height: .9; }
#title .ln { overflow: hidden; padding-bottom: 10px; } #title .ln > span { display: inline-block; }
.txt { position: absolute; left: 80px; top: 330px; width: 920px; }
.txt .head { font-size: 84px; line-height: .95; }
.txt .body { font-size: 36px; line-height: 1.32; margin-top: 18px; width: 860px; color: rgba(23,24,28,.88); font-weight: 500; }
.ln { overflow: hidden; } .ln > span { display: inline-block; }
#vp { position: absolute; left: 60px; top: 700px; width: 960px; height: 800px; }
#world { position: absolute; left: 0; top: 0; width: 1500px; height: 900px; transform-origin: 0 0; }
#baseline { position: absolute; left: 0; top: ${BASE}px; height: 4px; width: ${colX(g ? g.yrs : 0) + COLW + 40}px; background: ${C.ink}; border-radius: 2px; transform-origin: 0 50%; }
.col { position: absolute; bottom: ${900 - BASE}px; display: flex; flex-direction: column; justify-content: flex-end; transform-origin: 50% 100%; }
.seg { display: block; width: 100%; }
.seg.prin { background: ${C.principal}; border-radius: 0 0 2px 2px; }
.seg.int { background: ${C.interest}; }
.seg.comp { background: ${C.compound}; border-radius: 6px 6px 0 0; }
.yl { position: absolute; top: ${BASE + 16}px; transform: translateX(-50%); font-size: 22px; font-weight: 650; white-space: nowrap; color: rgba(23,24,28,.8); }
.blk { position: absolute; width: ${COLW}px; border-radius: 6px; }
.tag { position: absolute; white-space: nowrap; font-size: 15px; font-weight: 700; padding: 5px 10px; border-radius: 999px; background: #fff; box-shadow: 0 4px 12px rgba(23,24,28,.12); }
#curve { position: absolute; left: 0; top: 0; overflow: visible; }
#curve path { fill: none; stroke: ${C.ink}; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 1; }
#ring { position: absolute; overflow: visible; }
#ring path { fill: none; stroke: ${C.ink}; stroke-width: 3.5; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; }
#legend { position: absolute; left: 80px; top: 1530px; display: flex; gap: 22px; font-size: 24px; font-weight: 650; }
#legend span { display: flex; align-items: center; gap: 10px; } #legend i { width: 22px; height: 22px; border-radius: 6px; display: block; }
#counter { position: absolute; left: 80px; top: 720px; }
#counter .num { font-size: 110px; line-height: 1; font-variant-numeric: tabular-nums; color: ${C.principal}; white-space: nowrap; }
#counter .lab { font-size: 30px; font-weight: 650; margin-top: 8px; color: rgba(23,24,28,.8); }
.coin { position: absolute; left: 720px; top: 1380px; width: 320px; height: 320px; }
.coin img { position: absolute; inset: 0; width: 100%; height: 100%; }
#outro { position: absolute; inset: 0; }
#o-head { position: absolute; left: 80px; top: 560px; width: 920px; font-size: 128px; line-height: .9; }
#o-sub { position: absolute; left: 84px; top: 820px; font-size: 40px; font-weight: 600; color: rgba(23,24,28,.72); }
#o-follow { position: absolute; left: 80px; top: 920px; }
#o-follow span { display: inline-block; font-size: 42px; font-weight: 650; padding: 20px 38px; border-radius: 999px; background: ${C.ink}; color: ${C.field}; }
#o-disc { position: absolute; left: 84px; top: 1300px; width: 560px; font-size: 22px; line-height: 1.4; color: rgba(23,24,28,.66); }
`;

const stepTxt = steps.map((s, i) => `<div class="txt" id="t${i}"><div class="d head fit" data-maxh="170">${esc(s.head)}</div><div class="body fit" data-maxh="150">${esc(s.body)}</div></div>`).join('\n');

const html = `<!doctype html>
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
    <div id="baseline"></div>
    ${columns}
    <div class="blk" id="drop1" style="background:${C.interest}"></div>
    <div class="blk" id="drop2" style="background:${C.compound}"></div>
    <span class="tag" id="tag0">${money(V.start)}</span>
    <span class="tag" id="tag1">+${money(yr1)} interest</span>
    <span class="tag" id="tag2">+${money(yr2extra)} interest on interest</span>
    <svg id="ring" width="10" height="10"><path pathLength="1" d=""/></svg>
    <svg id="curve" width="1500" height="900"><path pathLength="1" d="${curve}"/></svg>
  </div></div>
  <div id="counter"><div class="d num" data-from="${Math.round(g.vals[3])}">${money(V.start)}</div><div class="lab">after <span id="cyrs">3</span> years at ${+(V.rate * 100).toFixed(2)}%</div></div>
  <div id="legend"><span><i style="background:${C.principal}"></i>Your ${money(V.start)}</span><span><i style="background:${C.interest}"></i>Interest</span><span><i style="background:${C.compound}"></i>Interest on interest</span></div>
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
 ${(() => { const l = cueList(); shellCues(l, T); return sfxTags(l, TOTAL); })()}
</div>
<script>
const B = ${B}, T = ${JSON.stringify(T)}, BASE = ${BASE}, K = ${k}, STEP = ${STEP}, COLW = ${COLW}, X0 = ${X0}, YRS = ${g.yrs};
const VALS = ${JSON.stringify(g.vals.map((v) => Math.round(v)))};
const START = ${V.start}, RATE = ${V.rate};
const colX = (i) => X0 + i * STEP;

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

function build() {
  document.querySelectorAll('.fit').forEach(fitText);
  const tl = gsap.timeline({ paused: true });
  const world = document.getElementById('world');

  // camera: show a range of years [a, b], with the baseline at viewport y = by
  const cam = (a, b, by = 660) => {
    const s = Math.min(2.4, 900 / (colX(b) + COLW - colX(a) + 40));
    return { scale: s, x: 30 - s * (colX(a) - 20), y: by - s * BASE };
  };
  tl.set(world, { ...cam(0, 3), transformOrigin: '0 0' }, 0);

  // ===== OPEN: title words rise in, then lift away =====
  const tlines = [...document.querySelectorAll('#title .ln > span')];
  tl.fromTo('#chrome', { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0.05);
  tl.fromTo(tlines, { yPercent: 110 }, { yPercent: 0, duration: 0.7, stagger: 0.12, ease: 'power4.out' }, 0.15);
  tl.fromTo('#coin', { y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, 0.6);
  tl.to(tlines, { yPercent: -110, duration: 0.5, stagger: 0.06, ease: 'power3.in' }, T[1] - 0.55);
  tl.set('#title', { opacity: 0 }, T[1] + 0.05);

  // step text: head lines rise, body lines follow; the previous step's text lifts out
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

  // ===== STEP 1: interest on interest (years 0-3, close up) =====
  const s1 = T[1];
  const col = (i) => document.getElementById('col' + i);
  const segs = (i) => col(i).querySelectorAll('.seg');
  const HIDE = 'inset(100% 0% 0% 0%)', SHOW = 'inset(0% 0% 0% 0%)';
  const upTo = (i, v) => 'inset(' + ((1 - v / VALS[i]) * 100).toFixed(2) + '% 0% 0% 0%)';
  for (let i = 0; i <= YRS; i++) tl.set(col(i), { clipPath: HIDE, scaleY: 1 }, 0);
  const rise = (i, at, dur = 0.5) => tl.fromTo(col(i), { clipPath: HIDE }, { clipPath: SHOW, duration: dur, ease: 'power3.out', immediateRender: false }, at);
  tl.fromTo('#baseline', { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power3.inOut' }, s1 - 0.2);
  tl.fromTo('.yl', { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.1 }, s1 + 0.3);
  tl.fromTo('#legend', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, s1 + 0.6);
  // year 0: your money rises
  rise(0, s1 + 0.3, 0.7);
  const top = (i) => BASE - VALS[i] * K;
  const tag = (id, x, y, at) => { tl.fromTo('#' + id, { x, y: y + 16, opacity: 0, scale: 0.8 }, { x, y, opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, at); };
  tag('tag0', colX(0) - 6, top(0) - 40, s1 + 0.8);
  // year 1: same money carried over, then +5% drops on top and lands with a little squash
  const drop = (id, i, h, yTop, at) => {
    tl.set('#' + id, { x: colX(i), height: h, opacity: 0 }, 0);
    tl.fromTo('#' + id, { y: yTop - 180, opacity: 0 }, { y: yTop, opacity: 1, duration: 0.38, ease: 'power2.in' }, at);
    tl.fromTo('#' + id, { scaleY: 1, transformOrigin: '50% 100%' }, { scaleY: 0.7, duration: 0.07, yoyo: true, repeat: 1, ease: 'power1.out' }, at + 0.38);
  };
  const y1 = s1 + 1.6;
  tl.fromTo(col(1), { clipPath: HIDE }, { clipPath: upTo(1, ${V.start}), duration: 0.45, ease: 'power3.out', immediateRender: false }, y1);
  drop('drop1', 1, ${yr1} * K, top(1), y1 + 0.4);
  tl.to('#tag0', { opacity: 0, y: '-=10', duration: 0.25 }, y1 + 0.7);
  tag('tag1', colX(1) - 30, top(1) - 40, y1 + 0.85);
  tl.set(col(1), { clipPath: SHOW }, y1 + 0.8); tl.set('#drop1', { opacity: 0 }, y1 + 0.8);
  // year 2: the interest itself earns interest - a tiny extra block, circled
  const y2 = s1 + 3.0;
  tl.fromTo(col(2), { clipPath: HIDE }, { clipPath: upTo(2, ${V.start} + 2 * ${yr1}), duration: 0.45, ease: 'power3.out', immediateRender: false }, y2);
  drop('drop2', 2, Math.max(4, ${yr2extra} * K), top(2), y2 + 0.4);
  tl.set(col(2), { clipPath: SHOW }, y2 + 0.8); tl.set('#drop2', { opacity: 0 }, y2 + 0.8);
  const rcx = colX(2) + COLW / 2, rcy = top(2) + 2, rr = 34;
  const ring = document.querySelector('#ring path');
  ring.setAttribute('d', 'M' + (rcx + rr) + ',' + rcy + ' a' + rr + ',' + (rr * 0.8) + ' 0 1,0 ' + (-2 * rr) + ',0 a' + rr + ',' + (rr * 0.8) + ' 0 1,0 ' + (2 * rr + 6) + ',-4');
  tl.to(ring, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut' }, y2 + 0.85);
  tag('tag2', colX(2) + 44, top(2) - 58, y2 + 1.1);
  // year 3
  rise(3, s1 + 4.6);

  // ===== STEP 2: ten years; camera pulls back, counter rolls =====
  const s2 = T[2];
  tl.to(world, { ...cam(0, 10), duration: 1.1, ease: 'power3.inOut' }, s2 - 0.1);
  tl.to(['#tag0', '#tag1', '#tag2', '#ring'], { opacity: 0, duration: 0.3 }, s2);
  for (let i = 4; i <= 10; i++) rise(i, s2 + 0.5 + (i - 4) * 0.2);
  const num = document.querySelector('#counter .num'), yrsEl = document.getElementById('cyrs');
  const cnt = { v: VALS[3], y: 3 };
  const writeCount = () => { num.textContent = '$' + Math.round(cnt.v).toLocaleString('en-US'); yrsEl.textContent = Math.round(cnt.y); };
  tl.fromTo('#counter', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, s2 + 0.3);
  tl.fromTo(cnt, { v: VALS[3], y: 3 }, { v: VALS[10], y: 10, duration: 0.5 + 6 * 0.2 + 0.4, ease: 'power1.inOut', onUpdate: writeCount }, s2 + 0.5);
  tl.fromTo(col(10), { filter: 'brightness(1)' }, { filter: 'brightness(1.12)', duration: 0.25, yoyo: true, repeat: 1 }, s2 + 2.3);

  // ===== STEP 3: twenty years; full pull-back, the curve draws over the tops =====
  const s3 = T[3];
  tl.to(world, { ...cam(0, YRS), duration: 1.2, ease: 'power3.inOut' }, s3 - 0.1);
  for (let i = 11; i <= YRS; i++) rise(i, s3 + 0.6 + (i - 11) * 0.15, 0.45);
  tl.to('#curve path', { strokeDashoffset: 0, duration: 2.4, ease: 'power2.inOut' }, s3 + 0.6);
  tl.to(cnt, { v: VALS[YRS], y: YRS, duration: 0.45 + 9 * 0.15 + 0.4, ease: 'power1.inOut', onUpdate: writeCount }, s3 + 0.6);
  tl.to(num, { scale: 1.06, transformOrigin: '0% 100%', duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' }, s3 + 2.8);

  // ===== STEP 4: it cuts both ways - the chart flips into debt =====
  const s4 = T[4];
  tl.to('#counter', { opacity: 0, y: -20, duration: 0.35, ease: 'power2.in' }, s4 - 0.1);
  tl.to('#curve', { opacity: 0, duration: 0.3 }, s4);
  tl.to(world, { ...cam(0, YRS, 160), duration: 0.9, ease: 'power3.inOut' }, s4 + 0.1);
  for (let i = 0; i <= YRS; i++) tl.to(col(i), { scaleY: -1, duration: 0.8, ease: 'power3.inOut' }, s4 + 0.5 + i * 0.025);
  tl.to('.seg.prin', { backgroundColor: '#8C2323', duration: 0.6 }, s4 + 0.7);
  tl.to(['.seg.int', '.seg.comp'], { backgroundColor: '${C.debt}', duration: 0.6 }, s4 + 0.7);
  tl.to('.yl', { opacity: 0, duration: 0.3 }, s4 + 0.4);
  tl.to('#legend', { opacity: 0, duration: 0.3 }, s4 + 0.3);
  tl.to('#pose0', { opacity: 0, duration: 0.35 }, s4 + 1.0);
  tl.fromTo('#pose1', { opacity: 0 }, { opacity: 1, duration: 0.35 }, s4 + 1.0);
  tl.fromTo('#coin', { y: 0 }, { y: -12, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, s4 + 1.0);

  // ===== OUTRO =====
  const s5 = T[5];
  tl.to('#vp', { opacity: 0, y: 40, duration: 0.5, ease: 'power2.in' }, s5 - 0.3);
  tl.fromTo('#outro', { opacity: 0 }, { opacity: 1, duration: 0.01 }, s5 + 0.1);
  tl.fromTo(lines(document.getElementById('o-head')), { yPercent: 110 }, { yPercent: 0, duration: 0.6, stagger: 0.09, ease: 'power3.out' }, s5 + 0.15);
  tl.fromTo('#o-sub', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, s5 + 0.5);
  tl.fromTo('#o-follow span', { scale: 0.6, opacity: 0, transformOrigin: '0% 50%' }, { scale: 1, opacity: 1, duration: 0.45, ease: 'expo.out' }, s5 + 0.75);
  tl.fromTo('#o-disc', { opacity: 0 }, { opacity: 1, duration: 0.5 }, s5 + 1.0);
  tl.to('#pose1', { opacity: 0, duration: 0.3 }, s5);
  tl.to('#pose0', { opacity: 1, duration: 0.3 }, s5);

  // gentle breathing on the coin throughout (finite repeats, seek-safe)
  let n = Math.floor((TOTAL_ - 2) / (2 * B)); if (n % 2) n--;
  tl.fromTo('#coin img', { scaleY: 1, transformOrigin: '50% 90%' }, { scaleY: 1.018, duration: 2 * B, yoyo: true, repeat: n - 1, ease: 'sine.inOut' }, 1.5);

  window.__timelines['main'] = tl;
  if (window.__hfForceTimelineRebind) window.__hfForceTimelineRebind();
}
const TOTAL_ = ${TOTAL};
document.fonts.ready.then(build);
</script>
</body></html>`;

writeFileSync(join(here, 'index.html'), html);
console.log(`lesson ${id}: ${TOTAL}s, music ${MUSIC}, scenes at ${T.join(', ')}`);
