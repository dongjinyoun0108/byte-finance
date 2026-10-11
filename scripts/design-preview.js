// Renders the redesigned carousel with sample data into ./preview (stills + MP4s).
//   node scripts/design-preview.js [--video]
import { mkdir, writeFile } from 'node:fs/promises';
import { coverSlide, boardSlide, storySlide, outroSlide } from '../render/slides.js';
import { renderSlides } from '../render/render.js';

const walk = (n, endPct, seed) => {
  let x = 0; const out = [0]; let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
  for (let i = 1; i < n; i++) { x += rnd() * 0.22 + endPct / n; out.push(x); }
  return out;
};
const ROWS = [
  ['S&P 500', 6567.11, 6512.4, 2],
  ['Nasdaq', 22074.2, 21830.15, 2],
  ['Dow Jones', 45373.6, 45210.8, 2],
  ['ASX 200', 8897.2, 8915.1, 1],
  ['Bitcoin', 86958, 84920, 0, 'US$'],
  ['Ethereum', 3267.8, 3210, 0, 'US$'],
  ['AUD/USD', 66.22, 66.12, 2, '', '¢'],
  ['Gold', 3386.7, 3402, 0, 'US$'],
  ['Brent oil', 70.52, 71.3, 2, 'US$'],
].map(([label, price, prevClose, decimals, prefix = '', suffix = ''], i) => {
  const changePct = ((price - prevClose) / prevClose) * 100;
  return { label, price, prevClose, decimals, prefix, suffix, changePct, up: changePct >= 0,
    value: `${prefix}${price.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`,
    spark: walk(40, changePct, 17 + i * 31) };
});

const slides = [
  { name: '1-cover', html: coverSlide({ date: 'Wednesday 7 October', headline: 'Bitcoin up 2.4%\nwhile you slept', kicker: '3 stories before your coffee', pose: 'coffee', mood: 'up',
    sp: { up: true, changePct: 2.40, label: 'Bitcoin overnight' }, spark: walk(60, 2.4, 5) }) },
  { name: '2-board', html: boardSlide({ headline: 'Wall Street closes higher', asOf: 'Prices at 7:25am AEDT', rows: ROWS, pose: 'trading_desk' }) },
  { name: '3-aus', html: storySlide({ slot: 'aus', n: 1, of: 3, tag: 'Interest rates', headline: 'RBA keeps rates on hold', body: 'The Reserve Bank left the cash rate at 3.60% for a third straight meeting.', why: 'Mortgage repayments stay where they are, for now.', pose: 'kangaroo', source: 'Source: RBA', figure: '3.60%', figureLabel: 'Cash rate, unchanged' }) },
  { name: '4-us', html: storySlide({ slot: 'us', n: 2, of: 3, tag: 'Tech', headline: 'Nvidia surges on chip boom', body: 'Quarterly revenue hit US$57 billion, 62% higher than a year ago.', why: 'Chip makers now drive much of the US market’s moves.', pose: 'rocket', figure: '+62%', figureLabel: 'Revenue vs a year ago' }) },
  { name: '5-biz', html: storySlide({ slot: 'biz', n: 3, of: 3, tag: 'Mining', headline: 'BHP bets $4.1b on copper', body: 'BHP is buying a Chilean copper project.', why: 'Copper feeds EVs and power grids, a growing slice of BHP’s earnings.', pose: 'quarter_zip', figure: '$4.1b', figureLabel: 'Deal size' }) },
  { name: '6-outro', html: outroSlide({ pose: 'cbd_strut', handle: '@byte.finance.au', disclaimer: 'General information only, not financial advice. It doesn’t consider your objectives, financial situation or needs.' }) },
];

// Music: each slide plays the theme from where the previous slide stopped, so swiping feels continuous.
import { SLIDE_SECONDS } from '../render/slides.js';
const AUDIO = 'render/assets/audio';
slides.forEach((sl, i) => {
  sl.audio = { music: `${AUDIO}/theme.wav`, offset: i * SLIDE_SECONDS, sfx: [] };
  if (i === 0) sl.audio.sfx.push({ file: `${AUDIO}/ding.wav`, at: 2.15, gain: 0.7 });
  else sl.audio.sfx.push({ file: `${AUDIO}/whoosh.wav`, at: 0.12, gain: 0.35 });
});
const video = process.argv.includes('--video');
await mkdir('preview', { recursive: true });
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const out = await renderSlides(only ? slides.filter((x) => x.name.includes(only)) : slides, { video });
for (const r of out) {
  await writeFile(`preview/${r.name}.jpg`, r.jpg);
  if (r.mp4) await writeFile(`preview/${r.name}.mp4`, r.mp4);
}
console.log(`Rendered ${out.length} slides${video ? ' with video' : ''} into ./preview`);
