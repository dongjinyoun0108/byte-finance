// Byte Finance slide templates. Each function returns a complete HTML page (1080x1440)
// whose animation is driven by runtime.js. Fonts and images are inlined as data URIs so the
// page renders identically anywhere (no network).
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const b64 = (p) => readFileSync(p).toString('base64');
const font = (pkg, file) => `data:font/woff2;base64,${b64(join(root, 'node_modules/@fontsource-variable', pkg, 'files', file))}`;

let FONTS;
function fonts() {
  FONTS ??= {
    display: font('bricolage-grotesque', 'bricolage-grotesque-latin-standard-normal.woff2'),
    text: font('inter-tight', 'inter-tight-latin-wght-normal.woff2'),
  };
  return FONTS;
}
const coinCache = new Map();
export function coin(pose) {
  if (!coinCache.has(pose)) coinCache.set(pose, `data:image/png;base64,${b64(join(here, 'assets/coin', `${pose}.png`))}`);
  return coinCache.get(pose);
}
const RUNTIME = readFileSync(join(here, 'actors.js'), 'utf8') + '\n' + readFileSync(join(here, 'runtime.js'), 'utf8');
// optional second frame for a pose's signature action (e.g. coffee_alt.png = mid-sip)
const altFrame = (pose) => (existsSync(join(here, 'assets/coin', `${pose}_alt.png`)) ? coin(`${pose}_alt`) : null);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------- design tokens (flat pastel)
export const FIELDS = {
  cover: { bg: '#C9DDF1', top: '#E4EEF8', side: '#9FBFE2', sun: '#F7DF8E', deep: '#2B4F7E' }, // morning sky
  board: { bg: '#DDD6F3', top: '#EDE9FA', side: '#B9ADE6', sun: '#CBC2EE', deep: '#4B3F86' }, // lavender
  aus: { bg: '#CFE8D8', top: '#E6F4EB', side: '#A6D3B7', deep: '#2E6B4C' }, // eucalyptus mint
  us: { bg: '#C8DAF2', top: '#E3ECF9', side: '#9EBDE6', deep: '#2D4E86' }, // powder blue
  biz: { bg: '#F3D5CE', top: '#F9E8E4', side: '#E5AFA3', deep: '#8A3F33' }, // blush clay
  outro: { bg: '#F4E2A2', top: '#FAEFC9', side: '#E6C766', deep: '#7A5D12' }, // butter
};

const CSS = () => `
@font-face { font-family: Bricolage; src: url(${fonts().display}) format('woff2'); font-weight: 200 800; font-stretch: 75% 100%; }
@font-face { font-family: InterT; src: url(${fonts().text}) format('woff2'); font-weight: 100 900; }
:root { --ink: #17181C; --ink2: rgba(23,24,28,.66); --rule: rgba(23,24,28,.12);
  --upbg: #BFE5CB; --up: #14592F; --downbg: #F5C8C6; --down: #8C2323; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1080px; height: 1440px; overflow: hidden; }
body { position: relative; color: var(--ink); font-family: InterT, sans-serif; -webkit-font-smoothing: antialiased; }
.stage, .zoom { position: absolute; inset: 0; transform-origin: 50% 45%; }
.spark { position: absolute; z-index: 7; width: 64px; height: 64px; }
.display { font-family: Bricolage, sans-serif; font-weight: 700; font-stretch: 88%; letter-spacing: -0.035em; font-variation-settings: 'opsz' 96; }
.num { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1; }
.brand { position: absolute; top: 66px; left: 72px; z-index: 20; font-family: Bricolage, sans-serif; font-weight: 700; font-stretch: 90%; font-size: 40px; letter-spacing: -0.02em; display: flex; align-items: center; gap: 12px; }
.brand::before { content: ''; width: 26px; height: 26px; border-radius: 50%; background: #E9B21A; box-shadow: inset 0 0 0 4px #F6CD4C; }
.meta { position: absolute; top: 72px; right: 72px; z-index: 20; font-size: 30px; font-weight: 600; color: var(--ink2); }
.w { display: inline-block; will-change: transform, filter; }
.nw { display: inline-block; white-space: nowrap; }
.lm { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: .08em; margin-bottom: -.08em; }
.plinth { position: absolute; z-index: 3; }
.plinth .side, .plinth .top { position: absolute; left: 0; right: 0; }
.coin { position: absolute; z-index: 5; } .coin img { position: absolute; left: 0; top: 0; width: 100%; }
.cshadow { position: absolute; z-index: 4; border-radius: 50%; background: rgba(23,24,28,.20); filter: blur(8px); }
.wipe { position: absolute; top: -10%; bottom: -10%; left: -20%; width: 140%; z-index: 100; visibility: hidden; }
.track { position: absolute; left: 0; white-space: nowrap; display: flex; }
.track span { flex: none; }
`;

function page({ title, body, duration = 3.2, extraCss = '', bg, zoom = true }) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${CSS()} body { background: ${bg}; } ${extraCss}</style></head>
<body data-duration="${duration}"><div class="stage"><div class="zoom"${zoom ? ' data-in="zoomIn" data-at="0" data-dur="0.45"' : ''}>${body}</div></div>
<script>window.__fit = () => { for (const el of document.querySelectorAll('[data-fit]')) { const max = +el.dataset.fit; let size = parseFloat(getComputedStyle(el).fontSize); while (el.offsetHeight > max && size > 48) { size -= 4; el.style.fontSize = size + 'px'; } } };</script>
<script>${RUNTIME}</script></body></html>`;
}

const brand = () => '<div class="brand">Byte Finance</div>';

/** Headline in one of five treatments: word (blur rise), char (letters pop), line (masked slide-up),
 *  popword (words pop and twist), wave (letters ride in). */
export function headlineFx(text, mode, at = 0.1) {
  const lines = text.split('\n');
  if (mode === 'word') return words(text, at);
  let i = 0;
  if (mode === 'line') {
    return lines.map((line) => line.split(' ').map((w) => `<span class="lm"><span class="w" data-in="line" data-at="${(at + 0.05 * i++).toFixed(2)}" data-dur="0.6">${esc(w)}</span></span>`).join(' ')).join('<br>');
  }
  if (mode === 'popword') {
    return lines.map((line) => line.split(' ').map((w) => `<span class="w" data-in="popword" data-at="${(at + 0.07 * i++).toFixed(2)}" data-dur="0.6">${esc(w)}</span>`).join(' ')).join('<br>');
  }
  // per-letter modes
  const kind = mode === 'wave' ? 'wave' : 'char';
  const step = kind === 'wave' ? 0.03 : 0.022;
  const dur = kind === 'wave' ? 0.7 : 0.35;
  return lines.map((line) => line.split(' ').map((w) => `<span class="nw">${[...w].map((c) => `<span class="w" data-in="${kind}" data-at="${(at + step * i++).toFixed(2)}" data-dur="${dur}">${esc(c)}</span>`).join('')}</span>`).join(' ')).join('<br>');
}

/** Headline split into words that rise in one by one. */
function words(text, at, step = 0.045, dur = 0.6) {
  let i = 0;
  return text.split('\n').map((line) => line.split(' ').map((w) => `<span class="w" data-in="word" data-at="${(at + step * i++).toFixed(2)}" data-dur="${dur}">${esc(w)}</span>`).join(' ')).join('<br>');
}

/** Two flat colour panels sweep across to open the slide. */
const wipes = (a, b) => `<div class="wipe" style="background:${a}" data-in="wipe" data-at="0" data-dur="0.75"></div>
<div class="wipe" style="background:${b}" data-in="wipe" data-at="0.1" data-dur="0.75"></div>`;

/** Coin on a flat pastel pedestal. topY = centre of the pedestal's top face. */
export const SLIDE_SECONDS = 4.2857; // exactly 2 bars of the 112 BPM theme
let actorN = 0;
/** Coin on a pedestal, performing the pose's signature move (see actors.js). */
function plinthCoin(pose, F, { cx, topY, w, pw, sideH, at = 0.2, live = false }) {
  const eh = Math.round(pw * 0.2);
  const coinTop = topY + 6 - w * 0.9;
  const plinthAt = live ? -5 : Math.max(0, at - 0.15);
  const id = `actor${++actorN}`;
  const alt = altFrame(pose);
  return `
  <div class="plinth" style="left:${cx - pw / 2}px; top:${topY - eh / 2}px; width:${pw}px; height:${sideH + eh}px" data-in="plinth" data-at="${plinthAt}" data-dur="0.9">
    <div class="side" style="top:${eh / 2}px; height:${sideH + eh / 2}px; background:${F.side}; border-radius: 0 0 50% 50% / 0 0 ${eh / 2}px ${eh / 2}px"></div>
    <div class="top" style="top:0; height:${eh}px; background:${F.top}; border-radius:50%"></div>
  </div>
  <div class="cshadow" data-shadow-for="${id}" style="left:${cx - w * 0.26}px; top:${topY - 14}px; width:${w * 0.52}px; height:30px"></div>
  <div class="coin" id="${id}" data-act="${pose}" data-at="${at}"${live ? ' data-live="1"' : ''} data-deep="${F.deep}" style="left:${cx - w / 2}px; top:${coinTop}px; width:${w}px; height:${w}px">
    <img src="${coin(pose)}">${alt ? `<img src="${alt}" style="opacity:0">` : ''}
  </div>`;
}

/** Four-point sparkles that pop and twinkle around the coin. */
function sparkles(list, at = 0.2) {
  const star = (c) => `<svg viewBox="0 0 64 64"><path d="M32 2 C35 22 42 29 62 32 C42 35 35 42 32 62 C29 42 22 35 2 32 C22 29 29 22 32 2Z" fill="${c}"/></svg>`;
  return list.map(([x, y, size, c], i) => `<div class="spark" style="left:${x}px; top:${y}px; width:${size}px; height:${size}px" data-in="twinkle" data-at="${(at + i * 0.08).toFixed(2)}" data-dur="0.5" data-phase="${i * 1.7}">${star(c)}</div>`).join('');
}

/** A looping marquee strip. */
function marquee({ text, top, height, size, color, bg, rot = 0, speed = 90, at = 0, rest = 120, z = 2, weight = 700, opacity = 1 }) {
  const unit = `<span style="padding-right:${size * 0.9}px">${esc(text)}</span>`;
  return `<div style="position:absolute; left:-80px; right:-80px; top:${top}px; height:${height}px; background:${bg}; transform: rotate(${rot}deg); z-index:${z}; overflow:hidden; opacity:${opacity}">
    <div class="track display" style="top:${(height - size) / 2 - size * 0.12}px; font-size:${size}px; line-height:1.2; color:${color}; font-weight:${weight}; letter-spacing:-0.02em" data-in="marquee" data-speed="${speed}" data-at="${at}" data-rest="${rest}">${unit.repeat(8)}${unit.repeat(8)}</div>
  </div>`;
}

/** Smooth SVG path through values, scaled into a box. */
export function linePath(values, w, h, pad = 4) {
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (w - 2 * pad), pad + (1 - (v - min) / span) * (h - 2 * pad)]);
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return { d, pts };
}

// ---------------------------------------------------------------- cover (a "living still": composed from frame 1)
export function coverSlide({ date, headline, kicker = '3 stories inside', pose, mood, sp, spark }) {
  const F = FIELDS.cover;
  const sun = mood === 'down' ? '#D9D6E8' : F.sun;
  const { d } = linePath(spark, 330, 70, 4);
  const css = `
  .sun { position: absolute; left: 470px; top: 520px; width: 520px; height: 520px; border-radius: 50%; background: ${sun}; z-index: 1; }
  h1 { position: absolute; left: 72px; top: 250px; z-index: 6; font-size: 122px; line-height: .93; width: 900px; }
  .kick { position: absolute; left: 72px; top: 172px; z-index: 6; background: #FFFFFF; font-size: 28px; font-weight: 650; padding: 10px 20px 11px; border-radius: 999px; }
  .stat { position: absolute; left: 72px; top: 1150px; z-index: 6; }
  .stat b { display: block; font-family: Bricolage, sans-serif; font-weight: 700; font-stretch: 88%; letter-spacing: -0.03em; font-size: 104px; line-height: 1; color: ${sp.up ? 'var(--up)' : 'var(--down)'}; }
  .stat span { display: block; margin-top: 10px; font-size: 30px; font-weight: 600; }
  .stat svg { display: block; margin-top: 18px; }
  .swipe { position: absolute; right: 72px; top: 64px; z-index: 20; font-size: 26px; font-weight: 650; background: var(--ink); color: ${F.bg}; padding: 12px 22px 13px; border-radius: 999px; }
  `;
  const body = `
  <div class="sun"></div>
  ${marquee({ text: `${date}  ✦  7:30am  ✦  Your money, before coffee  ✦`, top: 880, height: 104, size: 46, color: F.bg, bg: '#17181C', rot: -7, speed: 70, rest: 60, z: 2, at: -1 })}
  ${plinthCoin(pose, F, { cx: 730, topY: 1130, w: 590, pw: 470, sideH: 360, live: true, at: 0.2 })}
  ${sparkles([[470, 610, 70, '#17181C'], [960, 560, 54, '#FFFFFF'], [990, 900, 40, '#17181C'], [440, 960, 46, '#FFFFFF'], [880, 470, 34, "#17181C"]], 2.1)}
  ${brand()}
  <div class="swipe">Swipe for today’s stories</div>
  <div class="kick">${esc(kicker)}</div>
  <h1 class="display" data-fit="250">${esc(headline).replace(/\n/g, '<br>')}</h1>
  <div class="stat num"><b data-in="punch" data-at="2.15" data-dur="0.45" data-amt="0.16">${sp.changePct >= 0 ? '+' : '−'}${Math.abs(sp.changePct).toFixed(2)}%</b><span>${esc(sp.label || 'S&P 500 overnight')}</span>
    <svg width="330" height="70"><path d="${d}" fill="none" stroke="#17181C" stroke-width="4" stroke-linecap="round"/></svg></div>`;
  return page({ title: 'Cover', body, extraCss: css, duration: SLIDE_SECONDS, bg: F.bg, zoom: false });
}

// ---------------------------------------------------------------- markets board
export function boardSlide({ headline, asOf, rows, pose, text = 'char' }) {
  const F = FIELDS.board;
  const css = `
  .head { position: absolute; left: 72px; top: 190px; width: 560px; z-index: 6; }
  .head h1 { font-size: 104px; line-height: .93; }
  .head p { margin-top: 24px; font-size: 30px; color: var(--ink2); font-weight: 600; }
  .disc { position: absolute; right: 60px; top: 130px; width: 400px; height: 400px; border-radius: 50%; background: ${F.sun}; z-index: 1; }
  table { position: absolute; left: 72px; right: 72px; top: 640px; border-collapse: collapse; z-index: 6; width: 936px; }
  td { height: 82px; font-size: 34px; border-bottom: 2px solid var(--rule); }
  td.l { font-weight: 650; width: 270px; }
  td.s { width: 170px; }
  td.v { text-align: right; font-weight: 500; padding-right: 26px; }
  td.c { text-align: right; width: 170px; }
  .chip { display: inline-block; min-width: 150px; text-align: center; font-weight: 700; font-size: 30px; padding: 8px 14px 9px; border-radius: 999px; }
  .chip.up { background: var(--upbg); color: var(--up); } .chip.down { background: var(--downbg); color: var(--down); }
  `;
  const body = `
  <div class="disc" data-in="pop" data-at="0" data-dur="0.6"></div>
  ${plinthCoin(pose, F, { cx: 830, topY: 560, w: 410, pw: 330, sideH: 40, at: 0.1 })}
  ${sparkles([[640, 170, 48, '#17181C'], [1000, 420, 36, '#FFFFFF']], 0.8)}
  ${brand()}
  <div class="head">
    <h1 class="display" data-fit="300">${headlineFx(headline, text, 0.05)}</h1>
    <p data-in="fade" data-at="0.35">${esc(asOf)}</p>
  </div>
  <table class="num">${rows.map((r, i) => {
    const { d } = linePath(r.spark, 150, 46);
    const at = (0.18 + i * 0.045).toFixed(2);
    return `<tr data-in="glide" data-at="${at}" data-dur="0.6">
      <td class="l">${esc(r.label)}</td>
      <td class="s"><svg width="150" height="46"><path d="${d}" fill="none" stroke="#17181C" stroke-opacity=".75" stroke-width="3" stroke-linecap="round" data-draw data-at="${at}" data-dur="1.1"/></svg></td>
      <td class="v"><span data-count="${r.price}" data-from="${r.prevClose}" data-decimals="${r.decimals}" data-prefix="${r.prefix || ''}" data-suffix="${r.suffix || ''}" data-at="${at}">${esc(r.value)}</span></td>
      <td class="c"><span class="chip ${r.up ? 'up' : 'down'}" data-in="pop" data-at="${(+at + 0.25).toFixed(2)}" data-dur="0.5">${r.up ? '+' : '−'}<span data-count="${Math.abs(r.changePct).toFixed(2)}" data-decimals="2" data-suffix="%" data-at="${at}">${Math.abs(r.changePct).toFixed(2)}%</span></span></td>
    </tr>`;
  }).join('')}</table>`;
  return page({ title: 'Markets', body, extraCss: css, duration: SLIDE_SECONDS, bg: F.bg });
}

// ---------------------------------------------------------------- story
const STORY_TEXT = { aus: 'word', us: 'line', biz: 'popword' };
export function storySlide({ slot, n, of, tag, headline, body, why, pose, source, figure, figureLabel, text = STORY_TEXT[slot] }) {
  const F = FIELDS[slot];
  const css = `
  .tag { position: absolute; left: 72px; top: 184px; z-index: 6; background: var(--ink); color: ${F.bg}; font-weight: 650; font-size: 30px; padding: 12px 24px 13px; border-radius: 999px; }
  .col { position: absolute; left: 72px; top: 266px; width: 936px; z-index: 6; display: flex; flex-direction: column; align-items: flex-start; }
  h1 { font-size: 140px; line-height: .93; width: 936px; }
  .fig { margin-top: 44px; color: ${F.deep}; }
  .fig b { display: block; font-family: Bricolage, sans-serif; font-weight: 700; font-stretch: 80%; font-size: 176px; line-height: .86; letter-spacing: -0.04em; }
  .fig > span { display: block; margin-top: 12px; font-size: 28px; font-weight: 650; }
  .copy { margin-top: ${figure ? 48 : 64}px; width: ${why ? 480 : 500}px; }
  .copy p { font-size: ${why ? 33 : 40}px; line-height: 1.34; font-weight: 500; }
  .copy p:empty { display: none; }
  .copy p + p { margin-top: 22px; color: var(--ink2); }
  .copy p.src { margin-top: 26px; font-size: 25px; color: var(--ink2); font-weight: 600; }
  `;
  const figNum = figure ? figure.match(/-?\d[\d,.]*/) : null;
  const figHtml = figure
    ? (() => {
      if (!figNum) return esc(figure);
      const [pre, post] = figure.split(figNum[0]);
      const dec = (figNum[0].split('.')[1] || '').length;
      return `<span data-count="${figNum[0].replace(/,/g, '')}" data-decimals="${dec}" data-prefix="${esc(pre)}" data-suffix="${esc(post)}" data-at="0.25">${esc(figure)}</span>`;
    })()
    : '';
  const html = `
  ${marquee({ text: tag, top: 1215, height: 230, size: 210, color: F.top, bg: 'transparent', speed: 130, rest: 40, z: 1, at: 0 })}
  ${brand()}
  <div class="meta">${n} of ${of}</div>
  <div class="tag" data-in="pop" data-at="0.05" data-dur="0.5" data-rot="-6">${esc(tag)}</div>
  <div class="col">
  <h1 class="display" data-fit="${figure ? 400 : 520}">${headlineFx(headline, text, 0.12)}</h1>
  ${figure ? `<div class="fig" data-in="slam" data-at="0.2" data-dur="0.8"><b class="num">${figHtml}</b>${figureLabel ? `<span>${esc(figureLabel)}</span>` : ''}</div>` : ''}
  <div class="copy" data-in="glide" data-at="0.45" data-dur="0.7"><p>${esc(body)}</p><p>${esc(why || '')}</p>${source ? `<p class="src">${esc(source)}</p>` : ''}</div>
  </div>
  ${plinthCoin(pose, F, { cx: 810, topY: 1290, w: 540, pw: 400, sideH: 220, at: 0.15 })}
  ${sparkles([[590, 860, 50, '#17181C'], [990, 820, 40, '#FFFFFF'], [1000, 1080, 30, '#17181C']], 0.9)}
  `;
  return page({ title: `Story ${n}`, body: html, extraCss: css, duration: SLIDE_SECONDS, bg: F.bg });
}

// ---------------------------------------------------------------- outro
export function outroSlide({ pose, handle, disclaimer, text = 'wave', headline = 'See you\ntomorrow\nat 7:30', ribbon = 'See you tomorrow at 7:30  ✦  Byte Finance  ✦', cta }) {
  const F = FIELDS.outro;
  const css = `
  h1 { position: absolute; left: 72px; top: 190px; width: 900px; z-index: 6; font-size: 164px; line-height: .9; }
  .follow { position: absolute; left: 72px; top: 720px; z-index: 6; background: var(--ink); color: ${F.bg}; font-size: 36px; font-weight: 650; padding: 20px 34px 22px; border-radius: 999px; }
  .disc { position: absolute; left: 72px; bottom: 66px; z-index: 6; font-size: 22px; line-height: 1.4; color: var(--ink2); max-width: 430px; }
  `;
  const body = `
  ${marquee({ text: ribbon, top: 900, height: 100, size: 44, color: F.bg, bg: '#17181C', rot: 6, speed: 90, at: 0, rest: 30, z: 2 })}
  ${brand()}
  <h1 class="display" data-fit="500">${headlineFx(headline, text, 0.05)}</h1>
  <div class="follow" data-in="pop" data-at="0.45" data-dur="0.5" data-rot="-4">${esc(cta || `Follow ${handle}`)}</div>
  ${plinthCoin(pose, F, { cx: 790, topY: 1250, w: 560, pw: 420, sideH: 260, at: 0.15 })}
  ${sparkles([[560, 760, 52, '#17181C'], [1000, 700, 40, '#FFFFFF']], 0.8)}
  <p class="disc" data-in="fade" data-at="0.6">${esc(disclaimer)}</p>`;
  return page({ title: 'Outro', body, extraCss: css, duration: SLIDE_SECONDS, bg: F.bg });
}

// ---------------------------------------------------------------- weekend explainer cover
export function explainerCover({ title, steps, pose, date }) {
  const F = FIELDS.cover;
  const css = `
  .kick { position: absolute; left: 72px; top: 184px; z-index: 6; background: var(--ink); color: ${F.bg}; font-weight: 650; font-size: 30px; padding: 12px 24px 13px; border-radius: 999px; }
  h1 { position: absolute; left: 72px; top: 262px; width: 936px; z-index: 6; font-size: 132px; line-height: .92; }
  .sun { position: absolute; left: 470px; top: 640px; width: 520px; height: 520px; border-radius: 50%; background: ${F.sun}; z-index: 1; }
  .list { position: absolute; left: 72px; top: 690px; width: 420px; z-index: 6; }
  .list p { font-size: 32px; font-weight: 600; line-height: 1.3; padding: 14px 0; border-bottom: 2px solid var(--rule); }
  .list p b { font-family: Bricolage, sans-serif; font-weight: 700; color: ${F.deep}; margin-right: 12px; }
  .swipe { position: absolute; right: 72px; top: 64px; z-index: 20; font-size: 26px; font-weight: 650; background: var(--ink); color: ${F.bg}; padding: 12px 22px 13px; border-radius: 999px; }
  `;
  const body = `
  <div class="sun"></div>
  ${marquee({ text: `Money explained  ✦  ${date}  ✦  Save it for later  ✦`, top: 1010, height: 100, size: 44, color: F.bg, bg: '#17181C', rot: -6, speed: 70, rest: 60, z: 2, at: -1 })}
  ${plinthCoin(pose, F, { cx: 770, topY: 1250, w: 540, pw: 420, sideH: 260, live: true, at: 0.2 })}
  ${sparkles([[520, 700, 60, '#17181C'], [990, 640, 46, '#FFFFFF'], [1000, 980, 36, '#17181C']], 1.2)}
  ${brand()}
  <div class="swipe">Swipe to learn</div>
  <div class="kick">Money explained</div>
  <h1 class="display" data-fit="400">${esc(title).replace(/\n/g, '<br>')}</h1>
  <div class="list">${steps.slice(0, 4).map((s, i) => `<p><b>${i + 1}</b>${esc(s.head)}</p>`).join('')}</div>`;
  return page({ title: 'Money explained', body, extraCss: css, duration: SLIDE_SECONDS, bg: F.bg, zoom: false });
}
export { fonts, esc };
