// 9:16 Reels (1080x1920). A restrained motion system, deliberately different from the bouncy slide animations:
//  - one entrance language: words and lines rise out of a mask (expo-out, 0.75s, 45ms stagger)
//  - one transition: the next scene's colour field wipes up over the last (quart-in-out, 0.6s), the old scene drifts up
//  - data moves with meaning: numbers count, sparklines draw, change chips wipe in
//  - the coin rises once per scene and then only breathes; no bounce, no particles, no blur
//  - scene cuts land on the beat of the 112 BPM theme
// Everything is a pure function of time t, like the slide runtime, so frames are deterministic.
import { FIELDS, coin, fonts, esc, linePath } from './slides.js';

export const BPM = 112;
export const BEAT = 60 / BPM;
const W = 1080, H = 1920;
const INK = '#17181C';

const CSS = () => `
@font-face { font-family: Bricolage; src: url(${fonts().display}) format('woff2'); font-weight: 200 800; font-stretch: 75% 100%; }
@font-face { font-family: InterT; src: url(${fonts().text}) format('woff2'); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${FIELDS.cover.bg}; }
body { position: relative; color: ${INK}; font-family: InterT, sans-serif; -webkit-font-smoothing: antialiased; }
.scene { position: absolute; inset: 0; overflow: hidden; }
.clip { position: absolute; inset: 0; clip-path: inset(262px 0 0 0); }
.inner { position: absolute; inset: 0; will-change: transform; }
.display { font-family: Bricolage, sans-serif; font-weight: 700; font-stretch: 88%; letter-spacing: -0.035em; font-variation-settings: 'opsz' 96; }
.num { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1; }
.m { display: inline-block; overflow: hidden; vertical-align: top; padding: 0 .02em .1em; margin: 0 -.02em -.1em; }
.m > span { display: inline-block; will-change: transform; }
.chip { display: inline-block; font-weight: 650; font-size: 34px; padding: 14px 28px 15px; border-radius: 999px; background: ${INK}; }
.coin { position: absolute; will-change: transform, opacity; }
.disc { position: absolute; border-radius: 50%; }
.chrome { position: absolute; left: 80px; right: 80px; top: 150px; z-index: 50; }
.bars { display: flex; gap: 10px; }
.bars i { flex: 1; height: 6px; border-radius: 3px; background: rgba(23,24,28,.14); overflow: hidden; position: relative; }
.bars i b { position: absolute; inset: 0; background: ${INK}; transform-origin: 0 50%; }
.brand { margin-top: 26px; display: flex; justify-content: space-between; font-size: 30px; font-weight: 650; }
.brand span:first-child { font-family: Bricolage, sans-serif; font-weight: 700; font-stretch: 90%; font-size: 36px; letter-spacing: -0.02em; display: flex; align-items: center; gap: 12px; }
.brand span:first-child::before { content: ''; width: 24px; height: 24px; border-radius: 50%; background: #E9B21A; box-shadow: inset 0 0 0 4px #F6CD4C; }
.brand span:last-child { color: rgba(23,24,28,.62); }
`;

/** Words that rise out of their own masks, staggered. accent: regex of words to colour. */
function words(text, { at = 0, step = 0.045, accent, color } = {}) {
  let i = 0;
  return esc(text).split('\n').map((line) => line.split(' ').map((w) => {
    const c = accent && accent.test(w) ? ` style="color:${color}"` : '';
    return `<span class="m"><span data-a="rise" data-at="${(at + step * i++).toFixed(3)}"${c}>${w}</span></span>`;
  }).join(' ')).join('<br>');
}

/** A number that counts up with the same easing as everything else. */
function counter(figure, at) {
  const m = String(figure).match(/-?\d[\d,.]*/);
  if (!m) return esc(figure);
  const [pre, post] = String(figure).split(m[0]);
  const dec = (m[0].split('.')[1] || '').length;
  return `<span data-a="count" data-at="${at}" data-to="${m[0].replace(/,/g, '')}" data-dec="${dec}" data-pre="${esc(pre)}" data-post="${esc(post)}">${esc(figure)}</span>`;
}

const coinEl = (pose, { x, y, w, at = 0.3 }) => `<img class="coin" src="${coin(pose)}" style="left:${x}px; top:${y}px; width:${w}px" data-a="coin" data-at="${at}">`;

// ---------------------------------------------------------------- scenes (each returns inner HTML; times are relative to scene start)
function hookScene({ dateLabel, headline, up, kicker, pose }) {
  const F = FIELDS.cover;
  return { bg: F.bg, html: `
    <div class="disc" style="left:430px; top:900px; width:640px; height:640px; background:${F.sun}" data-a="disc" data-at="0.15"></div>
    <div style="position:absolute; left:80px; top:300px; width:900px">
      <span class="m"><span class="chip" style="color:${F.bg}" data-a="rise" data-at="0.05">Your 7:30am brief</span></span>
      <h1 class="display" style="margin-top:34px; font-size:150px; line-height:.9">${words(headline, { at: 0.15, accent: /%$/, color: up ? '#14592F' : '#8C2323' })}</h1>
      <p style="margin-top:36px; font-size:40px; font-weight:600; color:rgba(23,24,28,.7)"><span class="m"><span data-a="rise" data-at="0.75">${esc(kicker)}</span></span></p>
    </div>
    ${coinEl(pose, { x: 450, y: 900, w: 600, at: 0.35 })}` };
}

function boardScene({ title, asOf, rows }) {
  const F = FIELDS.board;
  const r = rows.map((row, i) => {
    const at = (0.3 + i * 0.06).toFixed(2);
    const { d } = linePath(row.spark, 120, 44, 4);
    return `<div style="position:relative; display:flex; align-items:center; height:94px">
      <i style="position:absolute; left:0; right:0; bottom:0; height:2px; background:rgba(23,24,28,.1); transform-origin:0 50%" data-a="line" data-at="${at}"></i>
      <div style="width:290px; font-size:40px; font-weight:650"><span class="m"><span data-a="rise" data-at="${at}">${esc(row.label)}</span></span></div>
      <svg width="130" height="44" style="flex:none"><path d="${d}" fill="none" stroke="${INK}" stroke-opacity=".7" stroke-width="3.5" stroke-linecap="round" data-a="draw" data-at="${at}"/></svg>
      <div class="num" style="flex:1; text-align:right; font-size:40px; font-weight:500; padding-right:24px"><span class="m"><span data-a="rise" data-at="${at}"><span data-a="count" data-at="${at}" data-from="${row.prevClose}" data-to="${row.price}" data-dec="${row.decimals}" data-pre="${esc(row.prefix)}" data-post="${esc(row.suffix)}">${esc(row.value)}</span></span></span></div>
      <div class="num" style="width:170px; text-align:center; font-size:34px; font-weight:700; padding:10px 0 11px; border-radius:999px; background:${row.up ? '#BFE5CB' : '#F5C8C6'}; color:${row.up ? '#14592F' : '#8C2323'}" data-a="wipe" data-at="${(+at + 0.25).toFixed(2)}">${row.up ? '+' : '−'}${Math.abs(row.changePct).toFixed(2)}%</div>
    </div>`;
  }).join('');
  return { bg: F.bg, html: `
    <div style="position:absolute; left:80px; top:300px; width:900px">
      <h1 class="display" style="font-size:120px; line-height:.92">${words(title, { at: 0.1 })}</h1>
      <p style="margin-top:22px; font-size:34px; font-weight:600; color:rgba(23,24,28,.62)"><span class="m"><span data-a="rise" data-at="0.3">${esc(asOf)}</span></span></p>
      <div style="margin-top:44px">${r}</div>
    </div>` };
}

function storyScene({ slot, tag, n, of, headline, figure, figureLabel, body, why, pose }) {
  const F = FIELDS[slot] || FIELDS.aus;
  return { bg: F.bg, html: `
    <div style="position:absolute; left:80px; top:300px; width:900px">
      <div style="display:flex; justify-content:space-between; align-items:center">
        <span class="m"><span class="chip" style="color:${F.bg}" data-a="rise" data-at="0.05">${esc(tag)}</span></span>
        <span style="font-size:32px; font-weight:650; color:rgba(23,24,28,.6)"><span class="m"><span data-a="rise" data-at="0.1">${n} of ${of}</span></span></span>
      </div>
      <h1 class="display" data-fit="420" style="margin-top:40px; font-size:128px; line-height:.92">${words(headline, { at: 0.15 })}</h1>
      ${figure ? `<div class="display num" style="margin-top:46px; font-size:210px; line-height:.85; font-stretch:80%; color:${F.deep}"><span class="m"><span data-a="rise" data-at="0.45">${counter(figure, 0.45)}</span></span></div>
      <p style="margin-top:14px; font-size:34px; font-weight:650; color:${F.deep}"><span class="m"><span data-a="rise" data-at="0.6">${esc(figureLabel || '')}</span></span></p>` : ''}
      <div style="margin-top:${figure ? 44 : 60}px; width:${why === undefined ? 600 : 520}px" data-a="fade" data-at="${figure ? 0.85 : 0.6}">
        <p style="font-size:${why ? 42 : 46}px; line-height:1.3; font-weight:500">${esc(body)}</p>
        ${why ? `<p style="margin-top:24px; font-size:37px; line-height:1.32; color:rgba(23,24,28,.66)">${esc(why)}</p>` : ''}
      </div>
    </div>
    ${coinEl(pose, { x: 570, y: 1010, w: 470, at: 0.4 })}` };
}

function listScene({ chip, title, points, pose }) {
  const F = FIELDS.cover;
  return { bg: F.bg, html: `
    <div class="disc" style="left:520px; top:1000px; width:560px; height:560px; background:${F.sun}" data-a="disc" data-at="0.2"></div>
    <div style="position:absolute; left:80px; top:300px; width:900px">
      <span class="m"><span class="chip" style="color:${F.bg}" data-a="rise" data-at="0.05">${esc(chip)}</span></span>
      <h1 class="display" data-fit="440" style="margin-top:34px; font-size:140px; line-height:.9">${words(title, { at: 0.15 })}</h1>
      <div style="margin-top:50px; width:500px">${points.map((p, i) => `<div style="display:flex; gap:18px; align-items:baseline; padding:16px 0; border-bottom:2px solid rgba(23,24,28,.12)" data-a="fade" data-at="${(0.7 + i * 0.12).toFixed(2)}">
        <b class="display" style="font-size:36px; color:${F.deep}">${i + 1}</b><span style="font-size:36px; font-weight:600">${esc(p)}</span></div>`).join('')}</div>
    </div>
    ${coinEl(pose, { x: 560, y: 1000, w: 480, at: 0.4 })}` };
}

function outroScene({ headline, cta, pose, disclaimer }) {
  const F = FIELDS.outro;
  return { bg: F.bg, html: `
    <div style="position:absolute; left:80px; top:300px; width:900px">
      <h1 class="display" style="font-size:160px; line-height:.88">${words(headline, { at: 0.1 })}</h1>
      <div style="margin-top:56px"><span class="m"><span class="chip" style="color:${F.bg}; font-size:40px; padding:20px 36px 22px" data-a="rise" data-at="0.55">${esc(cta)}</span></span></div>
    </div>
    ${coinEl(pose, { x: 540, y: 960, w: 500, at: 0.35 })}
    <p style="position:absolute; left:80px; top:1330px; width:460px; font-size:24px; line-height:1.4; color:rgba(23,24,28,.62)" data-a="fade" data-at="0.8">${esc(disclaimer)}</p>` };
}

// ---------------------------------------------------------------- page + runtime
const RUNTIME = `(() => {
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const E = {
    expo: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    quart: (p) => (p < 0.5 ? 8 * p ** 4 : 1 - Math.pow(-2 * p + 2, 4) / 2),
    cubic: (p) => 1 - Math.pow(1 - p, 3),
  };
  const WIPE = 0.6;
  const scenes = [...document.querySelectorAll('.scene')];
  const starts = scenes.map((s) => +s.dataset.start);
  const total = +document.body.dataset.duration;
  const bars = [...document.querySelectorAll('.bars b')];
  const fmt = (v, el) => { const d = +el.dataset.dec || 0; return (el.dataset.pre || '') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + (el.dataset.post || ''); };
  function seek(t) {
    scenes.forEach((sc, i) => {
      const s = starts[i], next = starts[i + 1] ?? Infinity;
      const covered = t >= next + WIPE;
      sc.style.visibility = t < s || covered ? 'hidden' : 'visible';
      if (i > 0) sc.style.clipPath = 'inset(' + ((1 - E.quart(clamp((t - s) / WIPE))) * 100).toFixed(3) + '% 0 0 0)';
      const q = E.quart(clamp((t - next) / WIPE));
      sc.querySelector('.inner').style.transform = 'translateY(' + (-120 * q).toFixed(2) + 'px)';
      sc.querySelector('.inner').style.opacity = 1 - 0.5 * q;
      const lt = t - s - (i > 0 ? 0.18 : 0); // content starts as the wipe is landing
      for (const el of sc.querySelectorAll('[data-a]')) {
        const a = el.dataset.a, at = +el.dataset.at || 0, p = (lt - at);
        if (a === 'rise') el.style.transform = 'translateY(' + ((1 - E.expo(clamp(p / 0.75))) * 110).toFixed(2) + '%)';
        else if (a === 'fade') { const e = E.expo(clamp(p / 0.8)); el.style.opacity = clamp(p / 0.5); el.style.transform = 'translateY(' + ((1 - e) * 36).toFixed(2) + 'px)'; }
        else if (a === 'wipe') el.style.clipPath = 'inset(0 ' + ((1 - E.expo(clamp(p / 0.6))) * 100).toFixed(2) + '% 0 0 round 999px)';
        else if (a === 'line') el.style.transform = 'scaleX(' + E.expo(clamp(p / 0.9)).toFixed(4) + ')';
        else if (a === 'disc') { const e = E.expo(clamp(p / 0.9)); el.style.transform = 'scale(' + (0.6 + 0.4 * e).toFixed(4) + ')'; el.style.opacity = clamp(p / 0.4); }
        else if (a === 'coin') {
          const e = E.expo(clamp(p / 0.9)), idle = Math.max(0, p - 0.9);
          el.style.opacity = clamp(p / 0.35);
          el.style.transform = 'translateY(' + ((1 - e) * 140 + Math.sin(idle * 2.2) * 7 * clamp(idle)).toFixed(2) + 'px)';
        } else if (a === 'count') {
          const e = E.expo(clamp(p / 1.1)), to = +el.dataset.to, from = el.dataset.from !== undefined ? +el.dataset.from : 0;
          el.textContent = fmt(from + (to - from) * e, el);
        } else if (a === 'draw') {
          const len = el.getTotalLength(); el.style.strokeDasharray = len; el.style.strokeDashoffset = len * (1 - E.quart(clamp(p / 1.0)));
        }
      }
    });
    bars.forEach((b, i) => { const s = starts[i], e = starts[i + 1] ?? total; b.style.transform = 'scaleX(' + clamp((t - s) / (e - s)).toFixed(4) + ')'; });
  }
  window.__fit = () => { for (const el of document.querySelectorAll('[data-fit]')) { const max = +el.dataset.fit; let size = parseFloat(getComputedStyle(el).fontSize); while (el.offsetHeight > max && size > 60) { size -= 4; el.style.fontSize = size + 'px'; } } };
  window.__seek = seek; window.__duration = total;
  seek(0);
})();`;

function page(scenes, { title, dateLabel }) {
  let t = 0;
  const parts = scenes.map((s, i) => {
    const start = t; t += s.beats * BEAT;
    return `<section class="scene" data-start="${start.toFixed(4)}" style="background:${s.bg}; z-index:${i + 1}"><div class="clip"><div class="inner">${s.html}</div></div></section>`;
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS()}</style></head>
<body data-duration="${t.toFixed(4)}">${parts.join('')}
<div class="chrome"><div class="bars">${scenes.map(() => '<i><b></b></i>').join('')}</div><div class="brand"><span>Byte Finance</span><span>${esc(dateLabel)}</span></div></div>
<script>${RUNTIME}</script></body></html>`;
  return { html, duration: t };
}

/** Weekday market reel. d: { dateLabel, hook: {headline, up}, kicker, coverPose, board: {title, asOf, rows}|null, stories: [...], outroPose, disclaimer } */
export function newsReel(d) {
  const scenes = [{ beats: 6, ...hookScene({ dateLabel: d.dateLabel, headline: d.hook.headline, up: d.hook.up, kicker: d.kicker, pose: d.coverPose }) }];
  if (d.board) scenes.push({ beats: 10, ...boardScene(d.board) });
  d.stories.forEach((s, i) => scenes.push({ beats: 10, ...storyScene({ ...s, n: i + 1, of: d.stories.length }) }));
  scenes.push({ beats: 6, ...outroScene({ headline: 'See you\ntomorrow\nat 7:30', cta: 'Follow @byte.finance.au', pose: d.outroPose, disclaimer: d.disclaimer }) });
  return page(scenes, { title: 'Byte Finance reel', dateLabel: d.dateLabel });
}

/** Sun/Mon lesson reel from an explainers.js topic. */
export function lessonReel(topic, { dateLabel, disclaimer }) {
  const slots = ['aus', 'us', 'biz', 'aus'];
  const poses = ['thinking', 'newspaper', 'coffee', 'finger_gun'];
  const scenes = [{ beats: 8, ...listScene({ chip: 'Money explained', title: topic.title.replace(/\n/g, ' '), points: topic.steps.map((s) => s.head), pose: topic.pose }) }];
  topic.steps.forEach((s, i) => scenes.push({ beats: 9, ...storyScene({ slot: slots[i], tag: 'Money explained', n: i + 1, of: topic.steps.length, headline: s.head, figure: s.figure, figureLabel: s.figureLabel, body: s.body, why: undefined, pose: poses[i] }) }));
  scenes.push({ beats: 6, ...outroScene({ headline: 'Save this\nfor later', cta: 'Follow @byte.finance.au', pose: 'cbd_strut', disclaimer }) });
  return page(scenes, { title: 'Byte Finance lesson reel', dateLabel });
}
