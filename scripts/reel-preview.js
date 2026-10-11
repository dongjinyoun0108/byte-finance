// Demo reels with sample data.
//   node scripts/reel-preview.js [news|lesson] [--frames] [--video]
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { newsReel, lessonReel } from '../render/reel.js';
import { renderReel } from '../render/render-reel.js';
import { TOPICS } from '../src/explainers.js';
import { DISCLAIMER } from '../src/config.js';

const kind = process.argv[2] === 'lesson' ? 'lesson' : 'news';
const walk = (n, end, seed) => { let x = 0, s = seed; const o = [0]; for (let i = 1; i < n; i++) { s = (s * 9301 + 49297) % 233280; x += (s / 233280 - 0.5) * 0.3 + end / n; o.push(x); } return o; };
const row = (label, prev, price, decimals, prefix = '', suffix = '', i = 0) => {
  const changePct = ((price - prev) / prev) * 100;
  return { label, prevClose: prev, price, decimals, prefix, suffix, changePct, up: changePct >= 0, spark: walk(22, changePct, 11 + i * 17),
    value: `${prefix}${price.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}` };
};
const rows = [
  row('S&P 500', 6512.4, 6567.11, 2), row('Nasdaq', 21830.15, 22074.2, 2, '', '', 1), row('Dow Jones', 45210.8, 45373.6, 2, '', '', 2),
  row('ASX 200', 8915.1, 8897.2, 1, '', '', 3), row('Bitcoin', 84920, 86958, 0, 'US$', '', 4), row('Ethereum', 3210, 3267.8, 0, 'US$', '', 5),
  row('AUD/USD', 66.12, 66.22, 2, '', '¢', 6), row('Gold', 3402, 3386.7, 0, 'US$', '', 7), row('Oil (Brent)', 71.3, 70.52, 2, 'US$', '', 8),
];
const reel = kind === 'news'
  ? newsReel({
    dateLabel: 'Tue 13 October', hook: { headline: 'Bitcoin up 2.4% while you slept', up: true }, kicker: '3 stories before your coffee', coverPose: 'coffee',
    board: { title: 'Wall Street closes higher', asOf: 'Prices at 7:25am AEDT', rows },
    stories: [
      { slot: 'aus', tag: 'Interest rates', headline: 'RBA Leaves Rates On Hold', figure: '3.60%', figureLabel: 'Cash rate, unchanged', body: 'The Reserve Bank kept the cash rate steady at 3.60% at its latest meeting.', why: 'Home loan repayments stay where they are for now.', pose: 'thinking' },
      { slot: 'us', tag: 'Tech', headline: 'Nvidia Sales Surge On AI Boom', figure: '+62%', figureLabel: 'Revenue vs a year ago', body: 'Quarterly revenue climbed 62% on a year earlier to US$57 billion.', why: 'Chip makers now drive much of the US share market.', pose: 'celebrating' },
      { slot: 'biz', tag: 'Mining', headline: 'BHP Makes $4.1b Copper Bet', figure: '$4.1b', figureLabel: 'Deal size', body: 'The miner is picking up a Chilean copper mine project.', why: 'Copper feeds EVs and power grids, a growing slice of earnings.', pose: 'finger_gun' },
    ],
    outroPose: 'cbd_strut', disclaimer: DISCLAIMER,
  })
  : lessonReel(TOPICS[0], { dateLabel: 'Sun 18 October', disclaimer: DISCLAIMER });

const out = 'preview/reel';
await mkdir(out, { recursive: true });
console.log(`${kind}: ${reel.duration.toFixed(2)}s`);
if (process.argv.includes('--frames')) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await writeFile(`${out}/${kind}.html`, reel.html);
  await page.goto(`file://${process.cwd()}/${out}/${kind}.html`);
  await page.evaluate(async () => { await document.fonts.ready; window.__fit(); });
  const times = (process.argv.find((a) => a.startsWith('--t='))?.slice(4) || '0.2,0.6,1.2,2.5,3.4,3.7,5,8,9,10.5,14,20,25.5').split(',').map(Number);
  for (const t of times) {
    await page.evaluate((x) => window.__seek(x), t);
    await page.screenshot({ path: `${out}/${kind}-${t.toFixed(2)}.jpg`, type: 'jpeg', quality: 80 });
  }
  await browser.close();
  console.log(times.join(' '));
}
if (process.argv.includes('--video')) {
  const r = await renderReel(reel);
  await writeFile(`${out}/${kind}.mp4`, r.mp4);
  await writeFile(`${out}/${kind}-cover.jpg`, r.cover);
  console.log('video written');
}
