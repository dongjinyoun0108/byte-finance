// Builds storyboard.html: one static key frame per beat (real fonts, colours, copy), plus seam map + tokens.
//   node scripts/sketch.mjs  (from reels/daily-news)
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url).pathname;
const b64 = (p) => readFileSync(root + p).toString('base64');
const font = (p) => `data:font/woff2;base64,${b64(p)}`;
const coin = (pose) => `data:image/png;base64,${b64(`render/assets/coin/${pose}.png`)}`;
const C = { sky: '#C9DDF1', lav: '#DDD6F3', mint: '#CFE8D8', powder: '#C8DAF2', blush: '#F3D5CE', butter: '#F4E2A2', ink: '#17181C', sun: '#F7DF8E', upbg: '#BFE5CB', up: '#14592F', downbg: '#F5C8C6', down: '#8C2323', deepMint: '#2E6B4C', deepBlue: '#2D4E86', deepBlush: '#8A3F33' };

const chrome = (n, date = 'Tue 13 October') => `<div class="chrome"><div class="bars">${[0, 1, 2, 3, 4, 5].map((i) => `<i class="${i < n ? 'f' : i === n ? 'h' : ''}"></i>`).join('')}</div>
<div class="brand"><span><b></b>Byte Finance</span><span class="dim">${date}</span></div></div>`;
const spark = (pts, w = 150, h = 50, up = true) => { const min = Math.min(...pts), max = Math.max(...pts); const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * h}`).join(' '); return `<svg width="${w}" height="${h}"><path d="${d}" fill="none" stroke="${C.ink}" stroke-opacity=".7" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`; };
const rows = [['S&P 500', '6,567.11', 0.84], ['Nasdaq', '22,074.20', 1.12], ['Dow Jones', '45,373.60', 0.36], ['ASX 200', '8,897.2', -0.2], ['Bitcoin', 'US$86,958', 2.4], ['Ethereum', 'US$3,268', 1.8], ['AUD/USD', '66.22¢', 0.15], ['Gold', 'US$3,387', -0.45], ['Oil (Brent)', 'US$70.52', -1.09]];
const walk = (s, end) => { let x = 0; const o = [0]; for (let i = 1; i < 16; i++) { s = (s * 9301 + 49297) % 233280; x += (s / 233280 - 0.5) * 0.4 + end / 16; o.push(x); } return o; };

const frames = [
  { id: '01', name: 'HOOK', t: '0.0–3.2', seam: 'cut in', note: '<b>"Overnight," types in, the market slot rolls and locks on Bitcoin,</b> then "+2.4%" crashes in and shoves the line up. Coin slides in from the right. The number holds still 0.6s.', html: `
    <div class="f" style="background:${C.sky}">${chrome(0, 'Tue 13 October')}
      <div class="ghost" style="top:1180px">OVERNIGHT</div>
      <div style="position:absolute; left:80px; top:340px; font-size:62px; font-weight:650; color:rgba(23,24,28,.6)">Overnight,</div>
      <div class="slot" style="top:430px"><div class="faint">ASX 200</div><div class="d" style="font-size:190px">Bitcoin</div><div class="faint">Gold</div></div>
      <div class="d" style="position:absolute; left:70px; top:760px; font-size:300px; line-height:.8; color:${C.up}; letter-spacing:-.05em">+2.4%</div>
      <div style="position:absolute; left:84px; top:1030px; font-size:46px; font-weight:600">while you slept</div>
      <div class="disc" style="left:470px; top:1040px; width:560px; height:560px; background:${C.sun}"></div>
      <img src="${coin('coffee')}" style="position:absolute; left:480px; top:1010px; width:540px">
    </div>` },
  { id: '02', name: 'MARKETS', t: '3.2–8.6', seam: 'whip-pan ←', note: '<b>Cards cascade into a tilted 3×3 grid;</b> prices roll on number wheels, sparklines draw, chips snap on. Camera pulls back, then pushes onto the biggest mover (Bitcoin).', html: `
    <div class="f" style="background:${C.lav}">${chrome(1)}
      <div class="d" style="position:absolute; left:80px; top:300px; font-size:112px; line-height:.92; width:900px">Wall Street closes higher</div>
      <div style="position:absolute; left:84px; top:540px; font-size:34px; font-weight:600; color:rgba(23,24,28,.62)">Prices at 7:25am AEDT</div>
      <div class="grid">${rows.map(([l, v, c], i) => `<div class="card${i === 4 ? ' hero' : ''}"><div class="cl">${l}</div><div class="cv">${v}</div>${spark(walk(7 + i * 13, c), 220, 54)}<span class="chip ${c >= 0 ? 'u' : 'dn'}">${c >= 0 ? '+' : '−'}${Math.abs(c).toFixed(2)}%</span></div>`).join('')}</div>
    </div>` },
  { id: '03', name: 'STORY 1 · AUS', t: '8.6–14.0', seam: 'whip-pan ←', note: '<b>The coin holds up a phone; a news notification drops in.</b> The camera pushes through the screen into the story (next state: tag, headline, 3.60% counting up, why).', html: `
    <div class="f" style="background:${C.mint}">${chrome(2)}
      <div class="ghost" style="top:1240px; color:#E6F4EB">Interest rates</div>
      <div class="phone"><div class="scr">
        <div style="font-size:30px; font-weight:600; color:rgba(23,24,28,.55); text-align:center; margin-top:46px">7:25</div>
        <div class="notif"><div style="display:flex; gap:14px; align-items:center"><b class="app"></b><span style="font-weight:700">Byte Finance</span><span class="dim" style="margin-left:auto">now</span></div>
          <div style="margin-top:10px; font-weight:700; font-size:30px">Interest rates</div><div style="font-size:30px">RBA Leaves Rates On Hold</div></div>
        <div class="d" style="margin:70px 34px 0; font-size:150px; color:${C.deepMint}">3.60%</div>
        <div style="margin:6px 38px; font-size:28px; font-weight:650; color:${C.deepMint}">Cash rate, unchanged</div>
      </div></div>
      <img src="${coin('thinking')}" style="position:absolute; left:600px; top:1040px; width:440px">
    </div>` },
  { id: '04', name: 'STORY 2 · US', t: '14.0–19.4', seam: 'camera push', note: '<b>The figure is the hero.</b> A before/after bar grows from the base (100) to the new level (162) only when the figure is a % change; otherwise the number counts up alone.', html: `
    <div class="f" style="background:${C.powder}">${chrome(3)}
      <div style="position:absolute; left:80px; top:300px"><span class="tag" style="color:${C.powder}">Tech</span></div>
      <div class="d" style="position:absolute; left:80px; top:390px; font-size:120px; line-height:.92; width:900px">Nvidia Sales Surge On AI Boom</div>
      <div class="d" style="position:absolute; left:70px; top:640px; font-size:270px; line-height:.85; color:${C.deepBlue}">+62%</div>
      <div style="position:absolute; left:84px; top:880px; font-size:34px; font-weight:650; color:${C.deepBlue}">Revenue vs a year ago</div>
      <div class="bars2"><div><i style="height:200px; opacity:.35"></i><span>Year ago</span></div><div><i style="height:324px"></i><span>Now</span></div></div>
      <p style="position:absolute; left:84px; top:1300px; width:480px; font-size:36px; line-height:1.32; color:rgba(23,24,28,.7)">Chip makers now drive much of the US share market.</p>
      <img src="${coin('celebrating')}" style="position:absolute; left:610px; top:1060px; width:420px">
    </div>` },
  { id: '05', name: 'STORY 3 · BIZ', t: '19.4–24.8', seam: 'whip-pan ←', note: '<b>The headline builds in punches:</b> "BHP" → "Makes $4.1b" → "Copper Bet", each with its own move; the figure pops, the why line settles. Coin finger-guns in from the edge.', html: `
    <div class="f" style="background:${C.blush}">${chrome(4)}
      <div style="position:absolute; left:80px; top:300px"><span class="tag" style="color:${C.blush}">Mining</span></div>
      <div class="d" style="position:absolute; left:80px; top:420px; font-size:150px; color:rgba(23,24,28,.35)">BHP</div>
      <div class="d" style="position:absolute; left:70px; top:560px; font-size:200px; line-height:.86; width:960px">Makes <span style="color:${C.deepBlush}">$4.1b</span></div>
      <div class="d outline" style="position:absolute; left:76px; top:760px; font-size:200px">Copper Bet</div>
      <p style="position:absolute; left:84px; top:1060px; width:520px; font-size:40px; line-height:1.3; font-weight:500">The miner is picking up a Chilean copper mine project.</p>
      <img src="${coin('finger_gun')}" style="position:absolute; left:620px; top:1080px; width:420px">
    </div>` },
  { id: '06', name: 'OUTRO', t: '24.8–28.0', seam: 'pull-back', note: '<b>The camera pulls back to the whole desk world</b> (every station tiny and tilted), then the lockup lands over it. Coin struts across. Disclaimer small.', html: `
    <div class="f" style="background:${C.butter}">${chrome(5)}
      ${[[C.sky, 60, 300, -8], [C.lav, 700, 280, 6], [C.mint, 70, 1230, 7], [C.powder, 760, 1180, -6], [C.blush, 400, 1520, 4]].map(([bg, x, y, r]) => `<div class="mini" style="left:${x}px; top:${y}px; background:${bg}; transform:rotate(${r}deg)"></div>`).join('')}
      <div class="d" style="position:absolute; left:80px; top:560px; font-size:132px; line-height:.88; width:920px">See you tomorrow, 7:30am</div>
      <div style="position:absolute; left:80px; top:1010px"><span class="tag" style="color:${C.butter}; font-size:42px; padding:20px 38px">Follow @byte.finance.au</span></div>
      <img src="${coin('cbd_strut')}" style="position:absolute; left:620px; top:1110px; width:400px">
      <p style="position:absolute; left:84px; top:1380px; width:440px; font-size:22px; line-height:1.4; color:rgba(23,24,28,.6)">General information only, not financial advice. It doesn’t consider your objectives, financial situation or needs.</p>
    </div>` },
];

const css = `
@font-face { font-family: Bricolage; src: url(${font('node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2')}) format('woff2'); font-weight: 200 800; font-stretch: 75% 100%; }
@font-face { font-family: InterT; src: url(${font('node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2')}) format('woff2'); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #EFEDE8; color: ${C.ink}; font-family: InterT, sans-serif; padding: 48px; }
header { display: flex; align-items: baseline; gap: 24px; margin-bottom: 36px; }
header h1 { font-family: Bricolage, sans-serif; font-weight: 700; font-stretch: 88%; font-size: 44px; letter-spacing: -.02em; }
header p { font-size: 18px; color: rgba(23,24,28,.65); }
header .tagx { margin-left: auto; font-size: 15px; font-weight: 650; background: ${C.ink}; color: #fff; padding: 8px 14px; border-radius: 999px; }
.sheet { display: grid; grid-template-columns: repeat(4, 324px); gap: 34px 28px; }
.cell { width: 324px; }
.vp { width: 324px; height: 576px; overflow: hidden; border-radius: 18px; position: relative; box-shadow: 0 0 0 2px rgba(23,24,28,.08); }
.f { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; transform: scale(.3); transform-origin: 0 0; overflow: hidden; }
.lab { display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-top: 12px; letter-spacing: .02em; }
.lab span:last-child { color: rgba(23,24,28,.55); font-weight: 600; }
.note { font-size: 13.5px; line-height: 1.45; margin-top: 6px; color: rgba(23,24,28,.8); }
.seam { display: inline-block; margin-top: 8px; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: rgba(23,24,28,.08); }
.d { font-family: Bricolage, sans-serif; font-weight: 700; font-stretch: 88%; letter-spacing: -.035em; }
.dim { color: rgba(23,24,28,.6); }
.chrome { position: absolute; left: 80px; right: 80px; top: 150px; }
.bars { display: flex; gap: 10px; } .bars i { flex: 1; height: 6px; border-radius: 3px; background: rgba(23,24,28,.14); } .bars i.f { background: ${C.ink}; } .bars i.h { background: linear-gradient(90deg, ${C.ink} 55%, rgba(23,24,28,.14) 55%); }
.brand { margin-top: 26px; display: flex; justify-content: space-between; font-size: 30px; font-weight: 650; }
.brand span:first-child { font-family: Bricolage, sans-serif; font-weight: 700; font-size: 36px; display: flex; gap: 12px; align-items: center; }
.brand b { width: 24px; height: 24px; border-radius: 50%; background: #E9B21A; box-shadow: inset 0 0 0 4px #F6CD4C; }
.ghost { position: absolute; left: -20px; font-family: Bricolage, sans-serif; font-weight: 800; font-size: 300px; letter-spacing: -.04em; color: rgba(255,255,255,.45); white-space: nowrap; }
.slot { position: absolute; left: 80px; overflow: hidden; height: 300px; }
.slot .faint { font-family: Bricolage, sans-serif; font-weight: 700; font-size: 80px; color: rgba(23,24,28,.18); line-height: .9; }
.disc { position: absolute; border-radius: 50%; }
.grid { position: absolute; left: 70px; top: 640px; width: 940px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; transform: perspective(1800px) rotateX(14deg) rotateZ(-4deg); }
.card { background: #F6F3FD; border-radius: 26px; padding: 22px 22px 18px; height: 250px; position: relative; box-shadow: 0 2px 0 rgba(23,24,28,.06); }
.card.hero { outline: 5px solid ${C.ink}; transform: scale(1.06); }
.cl { font-size: 30px; font-weight: 700; } .cv { font-size: 30px; font-weight: 500; margin: 6px 0 8px; font-variant-numeric: tabular-nums; }
.chip { position: absolute; left: 22px; bottom: 18px; font-size: 26px; font-weight: 700; padding: 6px 14px; border-radius: 999px; }
.chip.u { background: ${C.upbg}; color: ${C.up}; } .chip.dn { background: ${C.downbg}; color: ${C.down}; }
.phone { position: absolute; left: 110px; top: 380px; width: 560px; height: 1060px; border-radius: 76px; background: ${C.ink}; padding: 18px; transform: perspective(2000px) rotateY(14deg) rotateZ(-5deg); }
.scr { width: 100%; height: 100%; border-radius: 60px; background: #F2F7F3; overflow: hidden; }
.notif { margin: 40px 24px 0; background: #fff; border-radius: 34px; padding: 26px 28px; font-size: 26px; box-shadow: 0 18px 40px rgba(23,24,28,.12); }
.app { width: 44px; height: 44px; border-radius: 12px; background: #E9B21A; }
.tag { display: inline-block; font-size: 34px; font-weight: 650; padding: 14px 28px; border-radius: 999px; background: ${C.ink}; }
.bars2 { position: absolute; left: 84px; top: 960px; display: flex; gap: 34px; align-items: flex-end; height: 330px; }
.bars2 div { display: flex; flex-direction: column; align-items: center; gap: 12px; } .bars2 i { width: 150px; border-radius: 18px 18px 0 0; background: ${C.deepBlue}; display: block; } .bars2 span { font-size: 26px; font-weight: 650; }
.outline { color: transparent; -webkit-text-stroke: 4px ${C.ink}; }
.mini { position: absolute; width: 300px; height: 420px; border-radius: 24px; box-shadow: 0 0 0 4px rgba(23,24,28,.08); }
.side { font-size: 14px; line-height: 1.5; }
.side h3 { font-family: Bricolage, sans-serif; font-size: 22px; margin-bottom: 10px; }
.sw { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 14px; } .sw i { width: 46px; height: 46px; border-radius: 10px; display: block; box-shadow: inset 0 0 0 1px rgba(23,24,28,.1); }
.seammap { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; } .seammap div { display: flex; justify-content: space-between; border-bottom: 1px solid rgba(23,24,28,.12); padding-bottom: 6px; }
`;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Byte Finance Reel storyboard</title><style>${css}</style></head><body>
<header><h1>Byte Finance daily Reel · storyboard v1</h1><p>One continuous pastel desk world; the camera flies station to station.</p><span class="tagx">1080×1920 · 28s · 6 beats · music only</span></header>
<div class="sheet">
${frames.map((f) => `<div class="cell" id="frame-${f.id}"><div class="vp">${f.html}</div><div class="lab"><span>${f.id} · ${f.name}</span><span>${f.t}s</span></div><div class="note">${f.note}</div><span class="seam">${f.seam}</span></div>`).join('\n')}
<div class="cell side"><h3>Seam map</h3><div class="seammap">${frames.map((f) => `<div><span>${f.id} ${f.name.toLowerCase()}</span><b>${f.seam}</b></div>`).join('')}</div><p style="margin-top:12px">All lateral moves travel leftward. Cuts land on the 112 BPM beat.</p></div>
<div class="cell side"><h3>Tokens</h3><div class="sw">${[C.sky, C.lav, C.mint, C.powder, C.blush, C.butter, C.ink, C.up, C.down].map((c) => `<i style="background:${c}"></i>`).join('')}</div>
<p><b>Display</b> Bricolage Grotesque 700, 88% width · <b>Text</b> Inter Tight 500–650</p><p style="margin-top:8px"><b>Bans</b>: no slideshow card-wipes, no screensaver motion, no glow or gradients, no bouncy text, no numbers the data doesn’t have.</p></div>
</div></body></html>`;
writeFileSync(new URL('../storyboard.html', import.meta.url), html);
console.log('storyboard.html written');
