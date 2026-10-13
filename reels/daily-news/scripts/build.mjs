// Builds index.html (the HyperFrames composition) for one day's Reel from a JSON file.
//   node scripts/build.mjs [data.json]      (default: sample.json; run from reels/daily-news)
// The composition is one continuous pastel "desk": five stations on one strip, a camera that whips/dollies
// between them, and a pull-back outro. All copy and numbers come from the JSON; nothing is invented.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(here, '../..');
const args = process.argv.slice(2);
const AI = args.includes('--ai'); // use AI-animated coin clips (reels/coin-motion/sprites) where they exist
const D = JSON.parse(readFileSync(args.find((a) => !a.startsWith('--')) || join(here, 'sample.json'), 'utf8'));
const OUT = args.find((a) => a.startsWith('--out='))?.slice(6) || 'index.html';

const COIN_POSES = ['bbq', 'cbd_strut', 'celebrating', 'coffee', 'coffee_alt', 'cricket', 'finger_gun', 'kangaroo', 'newspaper', 'padel', 'performative', 'quarter_zip', 'rocket', 'run_club', 'shocked', 'surfing', 'thinking', 'trading_desk', 'umbrella', 'wipeout', 'worried'];
const pose = (p, dflt) => (COIN_POSES.includes(p) ? p : dflt);

// ---- assets into ./assets (gitignored; rebuilt every run) ----
mkdirSync(join(here, 'assets/coin'), { recursive: true });
mkdirSync(join(here, 'assets/fonts'), { recursive: true });
mkdirSync(join(here, 'assets/audio'), { recursive: true });
const fontSrc = {
  'bricolage.woff2': 'node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2',
  'inter-tight.woff2': 'node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2',
};
for (const [to, from] of Object.entries(fontSrc)) copyFileSync(join(repo, from), join(here, 'assets/fonts', to));
// Music bed: one of render/assets/audio/music/*.wav (all original, 112 BPM, -14 LUFS). --music=name or data.music.
const MUSIC = args.find((a) => a.startsWith('--music='))?.slice(8) || D.music || 'morning-desk';
const musicSrc = join(repo, 'render/assets/audio/music', `${MUSIC}.wav`);
if (!existsSync(musicSrc)) throw new Error(`unknown music "${MUSIC}"`);
copyFileSync(musicSrc, join(here, 'assets/audio/music.wav'));

const stories = (D.stories || []).slice(0, 3);
const poses = {
  hook: pose(D.hook?.pose, 'coffee'),
  phone: 'newspaper',
  s: stories.map((s, i) => pose(s.pose, ['thinking', 'celebrating', 'finger_gun'][i])),
  outro: pose(D.outroPose, 'cbd_strut'),
};
const hookReact = hookUpFlag(D) ? 'celebrating' : 'shocked';
for (const p of new Set([poses.hook, hookReact, poses.phone, ...poses.s, poses.outro])) {
  const src = join(repo, 'render/assets/coin', `${p}.png`);
  if (existsSync(src)) copyFileSync(src, join(here, 'assets/coin', `${p}.png`));
}

function hookUpFlag(d) { return (d.hook?.pct ?? 0) >= 0; }
// Where each pose's feet sit (alpha bbox bottom / 1100), so swaps keep the coin planted.
const FOOT = { bbq: .893, cbd_strut: .949, celebrating: .87, coffee: .895, coffee_alt: .898, cricket: .903, finger_gun: .893, kangaroo: .905, newspaper: .888, padel: .901, performative: .938, quarter_zip: .915, rocket: .979, run_club: .935, shocked: .897, surfing: .807, thinking: .899, trading_desk: .876, umbrella: .905, wipeout: .896, worried: .893 };
/** A rigged coin: .actor (travel) > .shadow + .abody (squash/lean) > .breath (idle) > one <img> per pose. */
function actor(id, list, { left, top, width }) {
  const uniq = [...new Set(list)];
  return `<div class="actor" id="${id}" style="left:${left}px; top:${top}px; width:${width}px; height:${width}px">
    <i class="shadow"></i><div class="abody"><div class="breath">${uniq.map((p, i) => `<img class="pose" data-pose="${p}" src="assets/coin/${p}.png" alt="" style="top:${Math.round((0.9 - (FOOT[p] ?? 0.9)) * width)}px${i ? '; opacity:0' : ''}">`).join('')}</div></div></div>`;
}

// AI sprite sheets keyed from Higgsfield clips, keyed by the pose they replace.
const SPRITES = {};
if (AI) {
  mkdirSync(join(here, 'assets/sprites'), { recursive: true });
  for (const [pose, name] of [['coffee', 'coffee'], ['__outro', 'flip'], ['kangaroo', 'kangaroo'], ['newspaper', 'newspaper'], ['shocked', 'shocked'], ['padel', 'padel']]) {
    const meta = join(repo, 'reels/coin-motion/sprites', `${name}.json`);
    if (!existsSync(meta)) continue;
    SPRITES[pose] = { name, ...JSON.parse(readFileSync(meta, 'utf8')) };
    copyFileSync(join(repo, 'reels/coin-motion/sprites', `${name}.png`), join(here, 'assets/sprites', `${name}.png`));
  }
}
// Story coins: a random mix each day. Each story's coin is either the writer's still pose or a random
// animated move (seeded by the date, so a re-render of the same day comes out the same).
const MOVES = ['kangaroo', 'padel', 'shocked'].filter((m) => SPRITES[m]);
if (MOVES.length) {
  let h = [...String(D.date || '')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 4294967296);
  poses.s = poses.s.map((p) => (SPRITES[p] || rnd() < 0.5 ? p : MOVES[Math.floor(rnd() * MOVES.length)]));
}
/** Same rig as actor(), but the body is a sprite sheet stepped frame by frame. */
function spriteActor(id, sp, { left, top, width, dw }) {
  const h = Math.round(dw * sp.fh / sp.fw), rows = Math.ceil(sp.frames / sp.cols);
  return `<div class="actor" id="${id}" data-sprite="${sp.frames},${sp.cols},${sp.fps}" style="left:${left}px; top:${top}px; width:${width}px; height:${width}px">
    <i class="shadow"></i><div class="abody"><div class="breath"><div class="sprite" style="left:${Math.round((width - dw) / 2)}px; top:${Math.round(0.9 * width - sp.feet * h)}px; width:${dw}px; height:${h}px; background-image:url(assets/sprites/${sp.name}.png); background-size:${sp.cols * 100}% ${rows * 100}%"></div></div></div></div>`;
}

/** A coin: the animated clip when one exists for this pose (with --ai), otherwise the still-pose rig. */
function coin(id, list, geo) {
  const sp = SPRITES[list[0]];
  return sp ? spriteActor(id, sp, { ...geo, dw: Math.round(geo.width * 0.86) }) : actor(id, list, geo);
}

// ---- helpers ----
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const C = { sky: '#C9DDF1', lav: '#DDD6F3', mint: '#CFE8D8', powder: '#C8DAF2', blush: '#F3D5CE', butter: '#F4E2A2', ink: '#17181C', sun: '#F7DF8E', upbg: '#BFE5CB', up: '#14592F', downbg: '#F5C8C6', down: '#8C2323', deepMint: '#2E6B4C', deepBlue: '#2D4E86', deepBlush: '#8A3F33' };
const STORY_BG = [C.mint, C.powder, C.blush];
const STORY_DEEP = [C.deepMint, C.deepBlue, C.deepBlush];
const MINUS = '−';

/** "+2.4%" with each digit as a rolling wheel column. */
function wheelNumber(text) {
  return [...text].map((ch, i) => {
    if (!/\d/.test(ch)) return `<span class="wch">${esc(ch)}</span>`;
    const target = Number(ch), stops = 20 + target; // two full turns then land
    return `<span class="wcol"><span class="wstrip" data-stops="${stops}">${Array.from({ length: stops + 1 }, (_, k) => `<span>${k % 10}</span>`).join('')}</span></span>`;
  }).join('');
}

/** Sparkline path for a card (0..w, 0..h). */
function sparkPath(pts, w = 230, h = 52) {
  if (!pts || pts.length < 2) pts = [0, 0];
  const min = Math.min(...pts), max = Math.max(...pts);
  return pts.map((v, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - min) / (max - min || 1)) * (h - 6)).toFixed(1)}`).join(' ');
}

/** Split a headline into 1–3 beats of roughly equal length. */
function beats(headline) {
  const w = headline.split(/\s+/).filter(Boolean);
  if (w.length <= 2) return [w.join(' ')];
  const n = w.length <= 4 ? 2 : 3;
  const base = Math.floor(w.length / n), extra = w.length % n;
  const sizes = Array.from({ length: n }, (_, i) => base + (i >= n - extra ? 1 : 0)); // longer beats last
  const out = []; let k = 0;
  for (const sz of sizes) { out.push(w.slice(k, k + sz).join(' ')); k += sz; }
  return out;
}
const isPct = (f) => /^[+\-−]?\d+(\.\d+)?%$/.test(String(f || '').trim());

// ---- timing (112 BPM; every scene boundary lands on a beat) ----
const BEAT = 60 / 112;
const nS = stories.length;
const beatsPer = [6, 10, ...stories.map(() => 10), 7];
const T = [0];
for (const b of beatsPer) T.push(+(T[T.length - 1] + b * BEAT).toFixed(3));
const TOTAL = +(T[T.length - 1] + 0.35).toFixed(2);
// the outro flip clip plays a touch faster than real time so it lands before the fade
const OUTRO_FLIP = +(TOTAL - T[T.length - 2] - 0.6 - 0.2).toFixed(3);
const stations = 2 + nS; // hook, board, stories
const GAP = 160, P = 1080 + GAP;

// ---- markup per station ----
const chromeBars = Array.from({ length: beatsPer.length }, (_, i) => `<i><b id="pb${i}"></b></i>`).join('');
const hook = D.hook || { name: 'Markets', pct: 0 };
const hookUp = (hook.pct ?? 0) >= 0;
const hookPctText = `${hookUp ? '+' : MINUS}${Math.abs(hook.pct ?? 0).toFixed(1)}%`;
const slotNames = [...(hook.others || []).filter((n) => n !== hook.name).slice(0, 4), hook.name];

const st0 = `
<section class="st" id="st0" style="left:0; background:${C.sky}">
  <div class="ghost" id="h-ghost" data-layout-ignore style="top:1250px">Overnight</div>
  <div id="h-top">
    <div id="h-over" class="lede">${[...'Overnight,'].map((c) => `<span>${esc(c)}</span>`).join('')}</div>
    <div id="h-slot"><div id="h-slotstrip">${slotNames.map((n, i) => `<div class="d slotname${i === slotNames.length - 1 ? ' win' : ''}">${esc(n)}</div>`).join('')}</div></div>
  </div>
  <div id="h-pct" class="d" data-layout-ignore style="color:${hookUp ? C.up : C.down}">${wheelNumber(hookPctText)}</div>
  <div id="h-sub" class="mask"><span>while you slept</span></div>
  <div id="h-disc"></div>
  ${SPRITES[poses.hook] ? spriteActor('h-coin', SPRITES[poses.hook], { left: 480, top: 1030, width: 540, dw: 470 }) : actor('h-coin', [poses.hook, hookReact], { left: 480, top: 1030, width: 540 })}
</section>`;

const rows = (D.board?.rows || []).slice(0, 9);
const heroIdx = Math.max(0, rows.findIndex((r) => r.label === D.board?.hero));
const st1 = `
<section class="st" id="st1" style="left:${P}px; background:${C.lav}">
  <div id="b-head" class="d head fit" data-maxh="230">${esc(D.board?.headline || 'Overnight markets')}</div>
  <div id="b-asof" class="sub">${esc(D.board?.asOf || '')}</div>
  <div id="b-zoom"><div id="b-tilt"><div id="b-grid">
    ${rows.map((r, i) => `<div class="card${i === heroIdx ? ' hero' : ''}" id="card${i}">
      <div class="cl">${esc(r.label)}</div>
      <div class="cv" data-from="${r.prevClose ?? r.price}" data-to="${r.price}" data-dec="${r.decimals ?? 2}" data-pre="${esc(r.prefix || '')}" data-suf="${esc(r.suffix || '')}">${esc(r.prefix || '')}${Number(r.price).toLocaleString('en-US', { minimumFractionDigits: r.decimals ?? 2, maximumFractionDigits: r.decimals ?? 2 })}${esc(r.suffix || '')}</div>
      <svg class="spark" width="230" height="52" viewBox="0 0 230 52"><path d="${sparkPath(r.spark)}" pathLength="1"/></svg>
      <span class="chip ${r.changePct >= 0 ? 'u' : 'dn'}">${r.changePct >= 0 ? '+' : MINUS}${Math.abs(r.changePct).toFixed(2)}%</span>
    </div>`).join('')}
  </div></div></div>
</section>`;

/** Shared story body: tag, headline, figure (count-up), label, optional bars, why. */
function storyBody(s, i, { bars = false } = {}) {
  const deep = STORY_DEEP[i];
  const f = String(s.figure || '').trim();
  const pct = isPct(f) ? parseFloat(f.replace(MINUS, '-')) : null;
  return `
    <div class="col" id="s${i}-col">
      <span class="tag" id="s${i}-tag" style="color:${STORY_BG[i]}">${esc(s.tag)}</span>
      <div class="d head fit" id="s${i}-head" data-maxh="330">${esc(s.headline)}</div>
      ${f ? `<div class="d fig" id="s${i}-fig" style="color:${deep}" data-figure="${esc(f)}">${esc(f)}</div>
      ${s.figureLabel ? `<div class="figlab" id="s${i}-figlab" style="color:${deep}">${esc(s.figureLabel)}</div>` : ''}` : ''}
      ${bars && pct !== null ? `<div class="hbars" id="s${i}-bars">
        <div class="hb"><span>Before</span><i style="--w:${(100 / Math.max(100, 100 + pct)) * 100}%; background:${deep}; opacity:.35"></i></div>
        <div class="hb"><span>Now</span><i style="--w:${(Math.max(0, 100 + pct) / Math.max(100, 100 + pct)) * 100}%; background:${deep}"></i></div>
      </div>` : ''}
      <p class="why fit" id="s${i}-why" data-maxh="200">${esc(s.why)}</p>
    </div>`;
}

function storyStation(s, i) {
  const k = 2 + i, bg = STORY_BG[i], deep = STORY_DEEP[i];
  if (i === 0) {
    // Phone notification dive
    return `
<section class="st" id="st${k}" style="left:${k * P}px; background:${bg}">
  <div class="ghost" data-layout-ignore style="top:1250px; color:rgba(255,255,255,.5)">${esc(s.tag)}</div>
  <div id="p-out">
    <div id="p-dive"><div class="phone" data-layout-allow-overlap><div class="scr">
      <div class="lock">7:25</div>
      <div class="lockdate">${esc(D.date || '')}</div>
      <div class="notif" id="p-notif" data-layout-ignore><div class="nhead"><b class="app"></b><span>Byte Finance</span><span class="dim">now</span></div>
        <div class="ntag">${esc(s.tag)}</div><div class="ntext">${esc(s.headline)}</div></div>
    </div></div></div>
    ${coin('p-coin', [poses.phone, poses.s[0]], { left: 600, top: 1060, width: 440 })}
  </div>
  <div class="inside" id="p-in" style="background:${bg}">
    ${storyBody(s, i)}
    ${coin(`s${i}-coin`, [poses.s[i]], { left: 640, top: 1110, width: 400 })}
  </div>
</section>`;
  }
  if (i === 1 && s.figure) {
    return `
<section class="st" id="st${k}" style="left:${k * P}px; background:${bg}">
  ${storyBody(s, i, { bars: true })}
  ${coin(`s${i}-coin`, [poses.s[i]], { left: 640, top: 1110, width: 400 })}
</section>`;
  }
  // Kinetic headline beats
  const f = String(s.figure || '').trim();
  const bs = beats(s.headline);
  const mark = (t) => (f && t.includes(f) ? esc(t).replace(esc(f), `<span class="figmark" style="--deep:${deep}">${esc(f)}</span>`) : esc(t));
  const figInHead = f && s.headline.includes(f);
  return `
<section class="st" id="st${k}" style="left:${k * P}px; background:${bg}">
  <div class="col" id="s${i}-col">
    <span class="tag" id="s${i}-tag" style="color:${bg}">${esc(s.tag)}</span>
    <div class="kbeats">${bs.map((b, j) => `<div class="kb kb${j} fitline" data-layout-allow-overflow id="s${i}-kb${j}"><div class="d kin${j === bs.length - 1 && bs.length > 1 ? ' outline" data-layout-ignore="' : ''}">${mark(b)}</div></div>`).join('')}</div>
    ${f && !figInHead ? `<div class="figrow" id="s${i}-figrow"><span class="d" style="color:${deep}">${esc(f)}</span>${s.figureLabel ? ` <span class="figlab" style="color:${deep}">${esc(s.figureLabel)}</span>` : ''}</div>` : ''}
    <p class="why fit" id="s${i}-why" data-maxh="200">${esc(s.why)}</p>
  </div>
  ${coin(`s${i}-coin`, [poses.s[i]], { left: 640, top: 1110, width: 400 })}
</section>`;
}

const DISCLAIMER = 'General information only, not financial advice. It doesn’t consider your objectives, financial situation or needs.';

const css = `
@font-face { font-family: 'Bricolage'; src: url(assets/fonts/bricolage.woff2) format('woff2'); font-weight: 200 800; font-stretch: 75% 100%; }
@font-face { font-family: 'InterT'; src: url(assets/fonts/inter-tight.woff2) format('woff2'); font-weight: 100 900; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1920px; overflow: hidden; background: ${C.butter}; }
#root { position: relative; width: 100%; height: 100%; overflow: hidden; background: ${C.butter}; color: ${C.ink}; font-family: 'InterT', sans-serif; }
.clip { position: absolute; inset: 0; }
.d { font-family: 'Bricolage', sans-serif; font-weight: 700; font-stretch: 88%; letter-spacing: -.035em; }
#cam { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; transform-origin: 540px 960px; }
#world { position: absolute; left: 0; top: 0; width: ${stations * P - GAP}px; height: 1920px; }
.st { position: absolute; top: 0; width: 1080px; height: 1920px; overflow: hidden; }
.ghost { position: absolute; left: -20px; font-family: 'Bricolage', sans-serif; font-weight: 800; font-size: 300px; letter-spacing: -.04em; color: rgba(255,255,255,.45); white-space: nowrap; }
.lede { font-size: 62px; font-weight: 650; color: rgba(23,24,28,.62); }
.lede span { display: inline-block; white-space: pre; }
.mask { overflow: hidden; } .mask > span { display: inline-block; }
.head { font-size: 112px; line-height: .92; width: 900px; }
.sub { font-size: 34px; font-weight: 600; color: rgba(23,24,28,.62); }
.coin { position: absolute; }
/* hook */
#h-top { position: absolute; left: 80px; top: 400px; width: 940px; }
#h-slot { height: 190px; overflow: hidden; margin-top: 10px; }
.slotname:not(.win) { opacity: .35; }
.slotname { width: max-content; height: 190px; font-size: 170px; line-height: 190px; white-space: nowrap; }
#h-pct { position: absolute; left: 70px; top: 690px; font-size: 300px; line-height: 1; letter-spacing: -.05em; display: flex; height: 300px; }
.wcol { display: inline-block; height: 1em; overflow: hidden; }
.wstrip { display: flex; flex-direction: column; }
.wstrip span, .wch { display: block; height: 1em; line-height: 1em; font-variant-numeric: tabular-nums; }
#h-sub { position: absolute; left: 84px; top: 1010px; font-size: 46px; font-weight: 600; }
#h-disc { position: absolute; left: 470px; top: 1060px; width: 560px; height: 560px; border-radius: 50%; background: ${C.sun}; }
.actor { position: absolute; }
.actor .shadow { position: absolute; left: 22%; width: 56%; top: 86%; height: 7%; border-radius: 50%; background: rgba(23,24,28,.13); display: block; }
.actor .abody, .actor .breath { position: absolute; inset: 0; }
.actor .pose { position: absolute; left: 0; width: 100%; height: 100%; }
.actor .sprite { position: absolute; background-repeat: no-repeat; background-position: 0% 0%; }
/* board */
#b-head { position: absolute; left: 80px; top: 360px; }
#b-asof { position: absolute; left: 84px; top: 600px; }
#b-zoom { position: absolute; left: 70px; top: 700px; width: 940px; height: 740px; }
#b-tilt { width: 100%; height: 100%; transform: perspective(1800px) rotateX(12deg) rotateZ(-4deg); }
#b-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
.card { background: #F6F3FD; border-radius: 26px; padding: 20px 22px 18px; height: 232px; position: relative; }
.cl { font-size: 30px; font-weight: 700; }
.cv { font-size: 30px; font-weight: 500; margin: 4px 0 8px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.spark { display: block; }
.spark path { fill: none; stroke: ${C.ink}; stroke-opacity: .7; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 1; }
.chip { position: absolute; left: 22px; bottom: 18px; font-size: 26px; font-weight: 700; padding: 6px 14px; border-radius: 999px; }
.chip.u { background: ${C.upbg}; color: ${C.up}; } .chip.dn { background: ${C.downbg}; color: ${C.down}; }
.ring { position: absolute; inset: -7px; border-radius: 32px; border: 6px solid ${C.ink}; opacity: 0; }
/* stories */
.col { position: absolute; left: 80px; top: 380px; width: 920px; display: flex; flex-direction: column; align-items: flex-start; }
.tag { display: inline-block; font-size: 34px; font-weight: 650; padding: 14px 28px; border-radius: 999px; background: ${C.ink}; margin-bottom: 34px; }
.col .head { font-size: 104px; }
.fig { font-size: 230px; line-height: .9; margin-top: 40px; font-variant-numeric: tabular-nums; letter-spacing: -.05em; white-space: nowrap; }
.figlab { font-size: 34px; font-weight: 650; margin-top: 10px; }
.why { font-size: 38px; line-height: 1.32; width: 540px; margin-top: 44px; color: rgba(23,24,28,.74); font-weight: 500; }
.hbars { width: 540px; margin-top: 34px; display: flex; flex-direction: column; gap: 14px; }
.hb { display: flex; align-items: center; gap: 18px; } .hb span { width: 110px; font-size: 26px; font-weight: 650; }
.hb i { display: block; height: 46px; border-radius: 0 14px 14px 0; width: calc(var(--w) * 0.75); transform-origin: 0 50%; }
.phone { position: absolute; left: 110px; top: 400px; width: 560px; height: 1060px; border-radius: 76px; background: ${C.ink}; padding: 18px; transform: perspective(2000px) rotateY(14deg) rotateZ(-5deg); }
.scr { width: 100%; height: 100%; border-radius: 60px; background: #F2F7F3; overflow: hidden; }
.lock { font-family: 'Bricolage', sans-serif; font-weight: 700; font-size: 150px; text-align: center; margin-top: 90px; letter-spacing: -.03em; color: rgba(23,24,28,.85); }
.lockdate { text-align: center; font-size: 28px; font-weight: 600; color: rgba(23,24,28,.55); }
.notif { margin: 70px 22px 0; background: #fff; border-radius: 34px; padding: 26px 28px; font-size: 30px; box-shadow: 0 18px 40px rgba(23,24,28,.12); }
.nhead { display: flex; gap: 14px; align-items: center; font-size: 24px; font-weight: 700; } .nhead .dim { margin-left: auto; color: rgba(23,24,28,.5); font-weight: 500; }
.app { width: 40px; height: 40px; border-radius: 11px; background: #E9B21A; display: block; }
.ntag { margin-top: 12px; font-weight: 700; } .ntext { line-height: 1.25; }
#p-out, #p-dive { position: absolute; inset: 0; }
.inside { position: absolute; inset: 0; opacity: 0; }
.kbeats { display: flex; flex-direction: column; gap: 6px; width: 920px; }
.kb { overflow: hidden; padding-bottom: 8px; }
.kin { font-size: 190px; line-height: .9; white-space: nowrap; display: inline-block; transform-origin: 0 60%; }
.kin.outline { color: transparent; -webkit-text-stroke: 4px ${C.ink}; }
.figmark { color: var(--deep); }
.figrow { margin-top: 30px; font-size: 40px; } .figrow .d { font-size: 120px; }
/* overlays */
#chrome { position: absolute; left: 80px; right: 80px; top: 230px; }
.bars { display: flex; gap: 10px; } .bars i { flex: 1; height: 6px; border-radius: 3px; background: rgba(23,24,28,.14); overflow: hidden; display: block; }
.bars b { display: block; height: 100%; background: ${C.ink}; transform-origin: 0 50%; }
.brand { margin-top: 24px; display: flex; justify-content: space-between; align-items: center; font-size: 30px; font-weight: 650; }
.brand .bn { font-family: 'Bricolage', sans-serif; font-weight: 700; font-size: 36px; display: flex; gap: 12px; align-items: center; }
.brand .dot { width: 24px; height: 24px; border-radius: 50%; background: #E9B21A; box-shadow: inset 0 0 0 4px #F6CD4C; display: block; }
.brand .dt { color: rgba(23,24,28,.6); }
#outro { position: absolute; inset: 0; pointer-events: none; }
#o-head { position: absolute; left: 80px; top: 430px; width: 920px; font-size: 132px; line-height: .9; }
#o-head .ln { overflow: hidden; padding-bottom: 6px; } #o-head .ln > span { display: inline-block; }
#o-follow { position: absolute; left: 80px; top: 720px; }
#o-follow span { display: inline-block; font-size: 42px; font-weight: 650; padding: 20px 38px; border-radius: 999px; background: ${C.ink}; color: ${C.butter}; }
#o-disc { position: absolute; left: 84px; top: 1290px; width: 450px; font-size: 22px; line-height: 1.4; color: rgba(23,24,28,.66); }

`;

const runtime = `
const B = ${BEAT};
const OUTRO_FLIP = ${OUTRO_FLIP};
const T = ${JSON.stringify(T)};
const P = ${P}, GAP = ${GAP}, NST = ${stations}, NS = ${nS};
const HERO = ${heroIdx};
const MINUS = '${MINUS}';

function fitText(el) {
  const maxh = +el.dataset.maxh || 9999;
  let fs = parseFloat(getComputedStyle(el).fontSize);
  for (let i = 0; i < 40 && (el.scrollHeight > maxh + 2 || el.scrollWidth > el.clientWidth + 2); i++) { fs *= 0.95; el.style.fontSize = fs + 'px'; }
}
function fitLine(el, width) {
  let fs = parseFloat(getComputedStyle(el).fontSize);
  for (let i = 0; i < 40 && el.scrollWidth > width; i++) { fs *= 0.95; el.style.fontSize = fs + 'px'; }
}
/** Wrap each rendered line in a mask so it can rise into place. */
function splitLines(el) {
  const html = el.innerHTML;
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const words = [];
  const walk = (node, wrapClass) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) n.textContent.split(/(\\s+)/).forEach((t) => { if (t.trim()) words.push({ t, cls: wrapClass }); });
      else walk(n, n.className || wrapClass);
    });
  };
  walk(tmp, '');
  el.innerHTML = words.map((w, i) => '<span class="w' + (w.cls ? ' ' + w.cls : '') + '" style="display:inline-block">' + w.t + '</span>').join(' ');
  const spans = [...el.querySelectorAll('.w')];
  const lines = [];
  spans.forEach((s) => { const top = s.offsetTop; let l = lines.find((x) => Math.abs(x.top - top) < 4); if (!l) lines.push(l = { top, s: [] }); l.s.push(s); });
  el.innerHTML = lines.map((l) => '<div class="ln" style="overflow:hidden; padding-bottom:.06em; margin-bottom:-.06em"><span style="display:inline-block">' + l.s.map((s) => s.outerHTML).join(' ') + '</span></div>').join('');
  return [...el.querySelectorAll('.ln > span')];
}
function parseFig(str) {
  const m = String(str).match(/^(.*?)(\\d[\\d,]*(?:\\.\\d+)?)(.*)$/);
  if (!m) return null;
  return { pre: m[1], num: parseFloat(m[2].replace(/,/g, '')), dec: (m[2].split('.')[1] || '').length, comma: m[2].includes(','), post: m[3] };
}
const fmt = (v, dec, comma) => comma || v >= 10000 ? v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec);
function countUp(tl, el, at, dur) {
  const f = parseFig(el.dataset.figure || el.textContent);
  if (!f) return;
  const o = { v: 0 };
  const w = el.getBoundingClientRect().width;
  el.style.minWidth = w + 'px';
  tl.fromTo(o, { v: 0 }, { v: f.num, duration: dur, ease: 'power3.out', onUpdate: () => { el.textContent = f.pre + fmt(o.v, f.dec, f.comma) + f.post; } }, at);
}

function build() {
  document.querySelectorAll('.fit').forEach(fitText);
  document.querySelectorAll('.slotname').forEach((el) => fitLine(el, 920));
  document.querySelectorAll('.fitline .kin').forEach((el) => fitLine(el, 920));

  const tl = gsap.timeline({ paused: true });
  const cam = document.getElementById('cam');
  const world = document.getElementById('world');
  const blur = document.getElementById('blurx');

  // ---------- chrome: progress segments fill per scene ----------
  for (let i = 0; i < T.length - 1; i++) tl.fromTo('#pb' + i, { scaleX: 0 }, { scaleX: 1, duration: T[i + 1] - T[i], ease: 'none' }, T[i]);
  tl.fromTo('#chrome', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0.05);

  // ---------- camera helpers ----------
  tl.set(world, { x: 0 }, 0);
  tl.set(cam, { scale: 1, x: 0, y: 0 }, 0);
  const whip = (k, at) => {
    // one strip, power3.inOut, directional blur capped at 22px peaking mid-whip
    const b = { v: 0 };
    tl.set(world, { filter: 'url(#whipblur)' }, at);
    tl.to(world, { x: -k * P, duration: 0.56, ease: 'power3.inOut' }, at);
    tl.fromTo(b, { v: 0 }, { v: 22, duration: 0.28, ease: 'power3.in', onUpdate: () => blur.setAttribute('stdDeviation', b.v.toFixed(2) + ' 0') }, at);
    tl.to(b, { v: 0, duration: 0.28, ease: 'power3.out', onUpdate: () => blur.setAttribute('stdDeviation', b.v.toFixed(2) + ' 0') }, at + 0.28);
    tl.set(world, { filter: 'none' }, at + 0.57);
  };
  const dolly = (k, at) => {
    tl.to(world, { x: -k * P, duration: 1.0, ease: 'power3.inOut' }, at);
    tl.to(cam, { scale: 0.74, duration: 0.5, ease: 'power2.out' }, at);
    tl.to(cam, { scale: 1, duration: 0.5, ease: 'power2.in' }, at + 0.5);
  };

  // ================= coin acting kit =================
  const A = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const a = { el, body: el.querySelector('.abody'), breath: el.querySelector('.breath'), shadow: el.querySelector('.shadow'), poses: [...el.querySelectorAll('.pose')] };
    tl.set(a.body, { transformOrigin: '50% 90%', scaleX: 1, scaleY: 1, rotation: 0, y: 0 }, 0);
    tl.set(a.breath, { transformOrigin: '50% 90%' }, 0);
    tl.set(a.shadow, { transformOrigin: '50% 50%' }, 0);
    return a;
  };
  // Step a sprite sheet: frame index derived from one proxy tween, so any seek lands the same frame.
  const play = (a, at, dur, { from = 0, to } = {}) => {
    const sp = a.el.querySelector('.sprite');
    if (!sp) return;
    const [frames, cols] = a.el.dataset.sprite.split(',').map(Number);
    const rows = Math.ceil(frames / cols), last = to ?? frames - 1;
    const o = { f: from };
    const show = () => { const i = Math.min(last, Math.round(o.f)); sp.style.backgroundPosition = (cols > 1 ? (i % cols) / (cols - 1) * 100 : 0) + '% ' + (rows > 1 ? Math.floor(i / cols) / (rows - 1) * 100 : 0) + '%'; };
    tl.fromTo(o, { f: from }, { f: last, duration: dur, ease: 'none', onUpdate: show, onStart: show }, at);
  };
  const isSprite = (a) => !!a.el.dataset.sprite;
  // Play an animated coin once in real time, cut short if its scene ends first.
  const playFor = (a, at, until) => {
    if (!isSprite(a)) return false;
    const [frames, , fps] = a.el.dataset.sprite.split(',').map(Number);
    const dur = Math.min(frames / fps, until - at - 0.1);
    if (dur > 0.3) play(a, at, dur, { to: Math.round(dur * fps) });
    return true;
  };
  const pose = (a, name, at) => a.poses.forEach((p) => tl.set(p, { opacity: p.dataset.pose === name ? 1 : 0 }, at));
  const land = (a, at, lean = 0) => {
    tl.to(a.body, { scaleX: 1.16, scaleY: 0.82, rotation: -lean * 0.5, duration: 0.08, ease: 'power2.out' }, at);
    tl.to(a.body, { scaleX: 1, scaleY: 1, rotation: 0, duration: 0.62, ease: 'elastic.out(1, 0.42)' }, at + 0.08);
    tl.to(a.shadow, { scaleX: 1.15, opacity: 1, duration: 0.08 }, at);
    tl.to(a.shadow, { scaleX: 1, duration: 0.4, ease: 'power2.out' }, at + 0.08);
  };
  // Hop in on an arc: crouch-free entrance, lean into travel, squash on landing, wobble out.
  const hopIn = (a, at, { fromX = 600, fromY = 0, peak = -200, dur = 0.66 } = {}) => {
    const lean = fromX > 0 ? -12 : fromX < 0 ? 12 : 0;
    tl.fromTo(a.el, { x: fromX }, { x: 0, duration: dur, ease: 'power1.out' }, at);
    tl.fromTo(a.el, { y: fromY }, { y: peak, duration: dur * 0.45, ease: 'power2.out' }, at);
    tl.to(a.el, { y: 0, duration: dur * 0.55, ease: 'power2.in' }, at + dur * 0.45);
    tl.fromTo(a.body, { rotation: lean, scaleX: 0.9, scaleY: 1.12 }, { rotation: lean * 0.4, scaleX: 0.96, scaleY: 1.05, duration: dur, ease: 'power1.inOut' }, at);
    tl.fromTo(a.shadow, { scaleX: 0.3, opacity: 0 }, { scaleX: 0.55, opacity: 0.5, duration: dur * 0.45 }, at);
    tl.to(a.shadow, { scaleX: 1, opacity: 1, duration: dur * 0.55, ease: 'power2.in' }, at + dur * 0.45);
    land(a, at + dur, lean);
  };
  // Double-take: crouch, spring up, swap pose at the top, land with a squash.
  const react = (a, at, name, { height = 120 } = {}) => {
    tl.to(a.body, { scaleX: 1.1, scaleY: 0.86, duration: 0.12, ease: 'power2.out' }, at);
    tl.to(a.el, { y: -height, duration: 0.24, ease: 'power2.out' }, at + 0.12);
    tl.to(a.body, { scaleX: 0.92, scaleY: 1.1, duration: 0.14, ease: 'power2.out' }, at + 0.12);
    tl.to(a.body, { scaleX: 1, scaleY: 1, duration: 0.14 }, at + 0.26);
    tl.to(a.shadow, { scaleX: 0.55, opacity: 0.45, duration: 0.24, ease: 'power2.out' }, at + 0.12);
    if (name) pose(a, name, at + 0.24);
    tl.to(a.el, { y: 0, duration: 0.2, ease: 'power2.in' }, at + 0.36);
    tl.to(a.shadow, { opacity: 1, duration: 0.2, ease: 'power2.in' }, at + 0.36);
    land(a, at + 0.56);
  };
  // Breathing + sway between actions (finite yoyo so every frame is seekable).
  const idle = (a, from, to) => {
    let n = Math.floor((to - from) / B); if (n % 2) n--;
    if (n < 2) return;
    tl.fromTo(a.breath, { scaleY: 1, scaleX: 1 }, { scaleY: 1.03, scaleX: 0.985, duration: B, yoyo: true, repeat: n - 1, ease: 'sine.inOut' }, from);
    let m = Math.floor((to - from) / (2 * B)); if (m % 2) m--;
    if (m >= 2) tl.fromTo(a.breath, { rotation: -1.6 }, { rotation: 1.6, duration: 2 * B, yoyo: true, repeat: m - 1, ease: 'sine.inOut' }, from);
  };
  // Calm entrance: one soft rise or slide into place, no squash, then quiet breathing.
  const settleIn = (a, at, { fromX = 0, fromY = 90, dur = 0.7 } = {}) => {
    tl.fromTo(a.el, { x: fromX, y: fromY, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: dur, ease: 'power3.out' }, at);
    tl.fromTo(a.shadow, { opacity: 0 }, { opacity: 1, duration: dur }, at);
  };
  const breathe = (a, from, to) => {
    let n = Math.floor((to - from) / (2 * B)); if (n % 2) n--;
    if (n >= 2) tl.fromTo(a.breath, { scaleY: 1 }, { scaleY: 1.018, duration: 2 * B, yoyo: true, repeat: n - 1, ease: 'sine.inOut' }, from);
  };
  // Anticipation, then a stretched dash off screen.
  const dash = (a, at, dir = 1) => {
    tl.to(a.body, { rotation: -8 * dir, scaleX: 0.9, scaleY: 1.06, duration: 0.14, ease: 'power2.out' }, at);
    tl.to(a.el, { x: 760 * dir, duration: 0.42, ease: 'power3.in' }, at + 0.14);
    tl.to(a.body, { rotation: 14 * dir, scaleX: 1.18, scaleY: 0.9, duration: 0.3, ease: 'power2.in' }, at + 0.14);
  };
  // A strut: steps on the half-beat, each with a bob, a hip tilt and a heel-strike squash.
  const walk = (a, at, fromX, toX, steps) => {
    const st = B / 2;
    tl.fromTo(a.el, { x: fromX }, { x: toX, duration: steps * st, ease: 'none' }, at);
    for (let i = 0; i < steps; i++) {
      const t = at + i * st, side = i % 2 ? 1 : -1;
      tl.to(a.body, { y: -22, rotation: 5 * side, scaleY: 1.03, scaleX: 0.98, duration: st * 0.5, ease: 'power1.out' }, t);
      tl.to(a.body, { y: 0, scaleY: 0.95, scaleX: 1.04, duration: st * 0.5, ease: 'power1.in' }, t + st * 0.5);
      tl.to(a.shadow, { scaleX: 0.8, duration: st * 0.5 }, t);
      tl.to(a.shadow, { scaleX: 1, duration: st * 0.5 }, t + st * 0.5);
    }
    land(a, at + steps * st, 0);
  };

  // ================= S0 HOOK =================
  {
    const t0 = 0;
    tl.fromTo('#h-ghost', { x: 60 }, { x: -140, duration: T[1] + 0.6, ease: 'none' }, 0);
    tl.fromTo('#h-over span', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.18, stagger: 0.035, ease: 'power2.out' }, t0 + 0.12);
    const names = document.querySelectorAll('.slotname');
    tl.fromTo('#h-slot', { opacity: 0 }, { opacity: 1, duration: 0.15 }, t0 + 0.35);
    tl.fromTo('#h-slotstrip', { y: 0 }, { y: -(names.length - 1) * 190, duration: 1.05, ease: 'power3.inOut' }, t0 + 0.38);
    // number crash + shove
    const land = t0 + 1.45;
    tl.fromTo('#h-pct', { y: 220, opacity: 0, scale: 1.18, transformOrigin: '0% 100%' }, { y: 0, opacity: 1, scale: 1, duration: 0.42, ease: 'expo.out' }, land);
    document.querySelectorAll('#h-pct .wstrip').forEach((s, i) => {
      tl.fromTo(s, { y: 0 }, { y: -(+s.dataset.stops) * 300, duration: 0.75 + i * 0.08, ease: 'power4.out' }, land);
    });
    tl.to('#h-top', { y: -34, duration: 0.4, ease: 'power3.out' }, land + 0.02);
    tl.fromTo('#h-sub > span', { yPercent: 110 }, { yPercent: 0, duration: 0.5, ease: 'power3.out' }, land + 0.3);
    tl.fromTo('#h-disc', { scale: 0 }, { scale: 1, duration: 0.6, ease: 'expo.out' }, t0 + 0.2);
    const hc = A('h-coin');
    hopIn(hc, t0 + 0.3, { fromX: 640, peak: -240 });
    tl.fromTo(hc.breath, { rotation: 0 }, { rotation: -4, duration: 0.25, yoyo: true, repeat: 1, ease: 'sine.inOut' }, t0 + 1.15);
    if (isSprite(hc)) play(hc, t0 + 0.35, T[1] - 0.35);   // the AI clip: sip, wink, shoulder bounce
    else { react(hc, land + 0.12, '${hookReact}', { height: 150 }); idle(hc, land + 0.9, T[1] + 0.2); }
  }
  whip(1, T[1] - 0.28);

  // ================= S1 BOARD =================
  {
    const t0 = T[1];
    const lines = splitLines(document.getElementById('b-head'));
    tl.fromTo(lines, { yPercent: 110 }, { yPercent: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out' }, t0 + 0.05);
    tl.fromTo('#b-asof', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, t0 + 0.4);
    const cards = [...document.querySelectorAll('.card')];
    cards.forEach((c, i) => {
      const r = Math.floor(i / 3), col = i % 3, d = (r + col) * 0.07;
      tl.fromTo(c, { y: 300, opacity: 0, rotationX: -55, transformPerspective: 900 }, { y: 0, opacity: 1, rotationX: 0, duration: 0.7, ease: 'expo.out' }, t0 + 0.15 + d);
      const cv = c.querySelector('.cv');
      const from = +cv.dataset.from, to = +cv.dataset.to, dec = +cv.dataset.dec, pre = cv.dataset.pre, suf = cv.dataset.suf;
      const o = { v: from };
      tl.fromTo(o, { v: from }, { v: to, duration: 1.1, ease: 'power2.out', onUpdate: () => { cv.textContent = pre + o.v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; } }, t0 + 0.45 + d);
      tl.to(c.querySelector('.spark path'), { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, t0 + 0.5 + d);
      tl.fromTo(c.querySelector('.chip'), { scale: 0.4, opacity: 0, transformOrigin: '0% 50%' }, { scale: 1, opacity: 1, duration: 0.35, ease: 'expo.out' }, t0 + 1.25 + d);
    });
    // camera: slow pull-back, then push onto the biggest mover
    tl.fromTo('#b-zoom', { scale: 1.06, transformOrigin: '50% 40%' }, { scale: 0.94, duration: 2.4, ease: 'sine.inOut' }, t0);
    const hero = cards[HERO];
    if (hero) {
      const r = Math.floor(HERO / 3), col = HERO % 3;
      const cx = (col + 0.5) / 3 * 100, cy = (r + 0.5) / 3 * 100;
      const ring = document.createElement('div'); ring.className = 'ring'; hero.appendChild(ring);
      const push = t0 + 2.75;
      tl.to('#b-zoom', { scale: 1.32, x: (50 - cx) * 4.2, y: (50 - cy) * 3.4, transformOrigin: cx + '% ' + cy + '%', duration: 0.95, ease: 'power3.inOut' }, push);
      cards.forEach((c, i) => { if (i !== HERO) tl.to(c, { opacity: 0.4, duration: 0.5, ease: 'power2.out' }, push + 0.2); });
      tl.to('#b-asof', { opacity: 0, duration: 0.3 }, push);
      if (r > 0) tl.to('#b-head', { opacity: 0.18, duration: 0.45, ease: 'power2.out' }, push + 0.1); // grid rises under it
      tl.to(ring, { opacity: 1, duration: 0.25, ease: 'power2.out' }, push + 0.6);
      tl.fromTo(hero, { scale: 1 }, { scale: 1.06, duration: 0.5, ease: 'power3.out' }, push + 0.55);
    }
  }
  if (NS > 0) whip(2, T[2] - 0.28);

  // ================= STORIES =================
  const storyIn = (i, t0, opts = {}) => {
    const head = document.getElementById('s' + i + '-head');
    const tag = document.getElementById('s' + i + '-tag');
    const fig = document.getElementById('s' + i + '-fig');
    const figlab = document.getElementById('s' + i + '-figlab');
    const why = document.getElementById('s' + i + '-why');
    const bars = document.getElementById('s' + i + '-bars');
    const coin = document.getElementById('s' + i + '-coin');
    tl.fromTo(tag, { scale: 0.5, opacity: 0, transformOrigin: '0% 50%' }, { scale: 1, opacity: 1, duration: 0.4, ease: 'expo.out' }, t0);
    if (head) tl.fromTo(splitLines(head), { yPercent: 110 }, { yPercent: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out' }, t0 + 0.1);
    if (fig) {
      tl.fromTo(fig, { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' }, t0 + 0.5);
      countUp(tl, fig, t0 + 0.5, 1.2);
    }
    if (figlab) tl.fromTo(figlab, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, t0 + 0.8);
    if (bars) {
      tl.fromTo(bars.querySelectorAll('.hb'), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.12 }, t0 + 0.75);
      tl.fromTo(bars.querySelectorAll('i'), { scaleX: 0 }, { scaleX: 1, duration: 1.0, stagger: 0.12, ease: 'power3.out' }, t0 + 0.8);
    }
    if (why) tl.fromTo(splitLines(why), { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: 'power3.out' }, t0 + (bars ? 1.4 : 1.2));
    const ac = coin && A(coin.id);
    if (ac) {
      settleIn(ac, t0 + 0.9);
      if (!playFor(ac, t0 + 1.3, opts.until)) breathe(ac, t0 + 1.6, opts.until);
    }
  };

  for (let i = 0; i < NS; i++) {
    const t0 = T[2 + i];
    if (i === 0) {
      // phone: notification drops, then the camera dives through the screen into the story
      const pc = A('p-coin');
      settleIn(pc, t0 + 0.25, { fromX: 360, fromY: 0 });
      if (!playFor(pc, t0 + 0.4, t0 + 1.85)) breathe(pc, t0 + 1.0, t0 + 1.6);
      tl.fromTo('#p-notif', { y: -260, opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'expo.out' }, t0 + 0.55);
      const dive = t0 + 1.75;
      tl.to('#p-dive', { scale: 3.6, x: 120, y: 260, transformOrigin: '42% 38%', duration: 0.75, ease: 'power3.in' }, dive);
      tl.to(pc.el, { x: 520, opacity: 0, duration: 0.5, ease: 'power3.in' }, dive);
      tl.to('#p-out', { opacity: 0, duration: 0.2, ease: 'none' }, dive + 0.58);
      tl.fromTo('#p-in', { opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out' }, dive + 0.55);
      storyIn(0, dive + 0.65, { until: T[3] });
    } else if (document.getElementById('s' + i + '-head')) {
      storyIn(i, t0 + 0.1, { until: T[3 + i] });
    } else {
      // kinetic beats
      const kbs = [...document.querySelectorAll('#st' + (2 + i) + ' .kin')];
      tl.fromTo('#s' + i + '-tag', { scale: 0.5, opacity: 0, transformOrigin: '0% 50%' }, { scale: 1, opacity: 1, duration: 0.4, ease: 'expo.out' }, t0 + 0.05);
      const moves = [
        (el, at) => tl.fromTo(el, { x: 1000 }, { x: 0, duration: 0.6, ease: 'expo.out' }, at),
        (el, at) => tl.fromTo(el, { yPercent: 105 }, { yPercent: 0, duration: 0.55, ease: 'power4.out' }, at),
        (el, at) => tl.fromTo(el, { scale: 1.45, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: 'expo.out' }, at),
      ];
      kbs.forEach((el, j) => {
        const at = t0 + 0.2 + j * 2 * B;
        moves[j % 3](el, at);
        if (j > 0) tl.to(kbs[j - 1], { opacity: 0.38, duration: 0.35, ease: 'power2.out' }, at + 0.05);
      });
      const end = t0 + 0.2 + kbs.length * 2 * B;
      if (kbs.length > 1) tl.to(kbs[kbs.length - 2], { opacity: 1, duration: 0.4 }, end + 0.1);
      tl.fromTo('#st' + (2 + i) + ' .figmark', { color: '#17181C' }, { color: 'var(--deep)', duration: 0.3 }, end);
      tl.fromTo('#st' + (2 + i) + ' .figmark', { scale: 1 }, { scale: 1.08, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out', transformOrigin: '50% 60%' }, end);
      const figrow = document.getElementById('s' + i + '-figrow');
      if (figrow) tl.fromTo(figrow, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.45, ease: 'expo.out' }, end);
      const why = document.getElementById('s' + i + '-why');
      if (why) tl.fromTo(splitLines(why), { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: 'power3.out' }, end + 0.25);
      const kc = A('s' + i + '-coin');
      settleIn(kc, end - 0.3, { fromX: 360, fromY: 0 });
      if (!playFor(kc, end, T[3 + i])) breathe(kc, end + 0.5, T[3 + i]);
    }
    if (i + 1 < NS) {
      if (i === 0) dolly(3 + i, T[3 + i] - 0.5); else whip(3 + i, T[3 + i] - 0.28);
    }
  }

  // ================= OUTRO: pull back over the whole desk =================
  {
    const t0 = T[T.length - 2];
    const W = NST * P - GAP;
    const s = Math.min(1000 / W, 0.2); // few stations: keep the mini cards small so they clear the lockup
    const Yc = 1060;
    tl.to(world, { x: 0, duration: 1.1, ease: 'power3.inOut' }, t0 - 0.35);
    tl.to(cam, { scale: s, x: -s * (W / 2 - 540), y: Yc - 960, duration: 1.1, ease: 'power3.inOut' }, t0 - 0.35);
    tl.to('.st', { borderRadius: 150, duration: 0.6, ease: 'power2.out' }, t0 - 0.2);
    tl.fromTo('#outro', { opacity: 0 }, { opacity: 1, duration: 0.01 }, t0 + 0.45);
    const lines = splitLines(document.getElementById('o-head'));
    tl.fromTo(lines, { yPercent: 110 }, { yPercent: 0, duration: 0.6, stagger: 0.09, ease: 'power3.out' }, t0 + 0.5);
    tl.fromTo('#o-follow span', { scale: 0.6, opacity: 0, transformOrigin: '0% 50%' }, { scale: 1, opacity: 1, duration: 0.45, ease: 'expo.out' }, t0 + 0.95);
    tl.fromTo('#o-disc', { opacity: 0 }, { opacity: 1, duration: 0.5 }, t0 + 1.2);
    const oc = A('o-coin');
    if (isSprite(oc)) {
      // ElevenLabs clip: crouch, one front flip, land back in the same pose
      settleIn(oc, t0 + 0.45, { fromY: 40, dur: 0.4 });
      play(oc, t0 + 0.6, OUTRO_FLIP);
    } else {
      settleIn(oc, t0 + 0.8);
      breathe(oc, t0 + 1.6, ${TOTAL});
    }

  }

  window.__timelines['main'] = tl;
  if (window.__hfForceTimelineRebind) window.__hfForceTimelineRebind();
}
document.fonts.ready.then(build);
`;

// ---- sound design: ElevenLabs-made SFX (render/assets/audio/sfx), each placed on the motion it belongs to ----
// Timings mirror the runtime timeline above; volumes stay low so the music still leads.
const SFX = [];
const SFX_GAIN = 1.6; // overall SFX level vs the music bed
const cue = (name, at, vol) => SFX.push({ name, at: +Math.max(0, at).toFixed(3), vol: +Math.min(0.85, vol * SFX_GAIN).toFixed(2) });
cue('tick', 0.38, 0.16);                                   // hook: slot names roll
cue('pop', 1.45, 0.5);                                     // hook: the % lands
for (let k = 1; k < stations; k++) cue('whoosh', k === 3 ? T[k] - 0.5 : T[k] - 0.34, 0.34); // whips / dolly
cue('whoosh', T[T.length - 2] - 0.4, 0.3);                 // pull back to the outro
cue('slide', T[1] + 0.12, 0.26);                           // board: cards fly in
cue('tick', T[1] + 0.45, 0.12);                            // board: prices count
if (rows.length) { cue('whoosh', T[1] + 2.75, 0.12); cue('pop', T[1] + 3.35, 0.32); } // push onto the hero card + ring
const storyCues = (ts, s) => {
  if (s.figure) { cue('tick', ts + 0.5, 0.15); cue('pop', ts + 1.45, 0.36); }
  cue('coin', ts + 1.2, 0.14);                             // coin settles in
};
stories.forEach((s, i) => {
  const t0 = T[2 + i];
  if (i === 0) { cue('chime', t0 + 0.55, 0.36); cue('whoosh', t0 + 1.75, 0.2); storyCues(t0 + 2.4, s); }
  else if (i === 1 && s.figure) storyCues(t0 + 0.1, s);
  else {
    const n = beats(s.headline).length;
    for (let j = 0; j < n; j++) cue('slide', t0 + 0.2 + j * 2 * BEAT, 0.2);
    const end = t0 + 0.2 + n * 2 * BEAT;
    if (s.figure) cue('pop', end, 0.36);
    cue('coin', end + 0.1, 0.14);
  }
});
if (SPRITES.__outro) { cue('whoosh', T[T.length - 2] + 0.6 + 0.3 * OUTRO_FLIP, 0.16); cue('coin', T[T.length - 2] + 0.6 + 0.74 * OUTRO_FLIP, 0.26); } // flip + landing
else cue('coin', T[T.length - 2] + 1.15, 0.2);             // outro coin
cue('chime', T[T.length - 2] + 0.95, 0.3);                 // follow pill
for (const n of new Set(SFX.map((c) => c.name))) copyFileSync(join(repo, 'render/assets/audio/sfx', n + '.wav'), join(here, 'assets/audio', 'sfx-' + n + '.wav'));
const SFX_LEN = { whoosh: 0.62, pop: 0.3, coin: 0.45, tick: 1.0, chime: 0.9, draw: 0.55, slide: 0.7 };

const html = `<!doctype html>
<html lang="en" data-resolution="portrait">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1080, height=1920">
<script src="vendor/gsap.min.js"></script>
<style>${css}</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="1080" data-height="1920">
  <svg width="0" height="0" style="position:absolute"><filter id="whipblur" x="-5%" y="0" width="110%" height="100%"><feGaussianBlur id="blurx" stdDeviation="0 0"/></filter></svg>
  <div id="scene" class="clip" data-start="0" data-duration="${TOTAL}" data-track-index="0">
    <div id="cam"><div id="world" data-layout-allow-overlap>
      ${st0}
      ${st1}
      ${stories.map(storyStation).join('\n')}
    </div></div>
    <div id="chrome"><div class="bars">${chromeBars}</div>
      <div class="brand"><span class="bn"><b class="dot"></b>Byte Finance</span><span class="dt">${esc(D.date || '')}</span></div></div>
    <div id="outro" data-layout-allow-overlap>
      <div id="o-head" class="d">See you tomorrow, 7:30am</div>
      <div id="o-follow"><span>Follow @byte.finance.au</span></div>
      ${SPRITES.__outro ? spriteActor('o-coin', SPRITES.__outro, { left: 620, top: 1220, width: 360, dw: 300 }) : SPRITES[poses.outro] ? spriteActor('o-coin', SPRITES[poses.outro], { left: 600, top: 1200, width: 380, dw: 320 }) : actor('o-coin', [poses.outro], { left: 600, top: 1200, width: 380 })}
      <p id="o-disc">${DISCLAIMER}</p>
    </div>
  </div>
  <audio id="music" src="assets/audio/music.wav" data-start="0" data-duration="${TOTAL}" data-track-index="10" data-volume="1"
    data-automation='{"version":1,"lanes":[{"target":"volume","points":[{"t":0,"v":1},{"t":${(TOTAL - 1.2).toFixed(2)},"v":1},{"t":${TOTAL},"v":0}]}]}'></audio>
  ${SFX.filter((c) => c.at + 0.05 < TOTAL).map((c, i) => `<audio id="sfx${i}" src="assets/audio/sfx-${c.name}.wav" data-start="${c.at}" data-duration="${Math.min(SFX_LEN[c.name], +(TOTAL - c.at).toFixed(3))}" data-track-index="${11 + i}" data-volume="${c.vol}"></audio>`).join('\n  ')}
</div>
<script>${runtime}</script>
</body>
</html>`;

writeFileSync(join(here, OUT), html);
console.log(`${OUT}: music ${MUSIC}, ${stations} stations, ${nS} stories, ${TOTAL}s; scene starts ${T.join(', ')}`);
