// Entry point for the GitHub Actions job (.github/workflows/daily.yml).
//   node scripts/daily.js            normal scheduled run (waits for 7:25/7:30 Sydney, posts once per day)
//   node scripts/daily.js --dry      render to ./out only, post nothing, ignore time and day
//   node scripts/daily.js --force    post now, even outside the window or if today already posted
import { mkdir, writeFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { prepare } from '../src/daily.js';
import { renderSlides } from '../render/render.js';
import { instagram } from '../src/instagram.js';
import { currentToken, instagramUserId } from '../src/igtoken.js';
import { sydney } from '../src/time.js';

const arg = (n) => process.argv.includes(`--${n}`);
const DRY = arg('dry'), FORCE = arg('force');
const REPO = process.env.GITHUB_REPOSITORY || 'dongjinyoun0108/byte-finance';
const BRANCH = process.env.GITHUB_REF_NAME || 'main';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true, () => false);
const git = (...a) => execFileSync('git', a, { stdio: 'inherit' });

function commitPush(paths, message) {
  git('add', ...paths);
  try { execFileSync('git', ['diff', '--cached', '--quiet']); return; } catch { /* has changes */ }
  git('-c', 'user.name=byte-finance-bot', '-c', 'user.email=bot@users.noreply.github.com', 'commit', '-m', message);
  for (let i = 0; i < 3; i++) {
    try { git('pull', '--rebase', 'origin', BRANCH); git('push', 'origin', `HEAD:${BRANCH}`); return; } catch (e) { if (i === 2) throw e; }
  }
}

/** Wait until hh:mm Sydney time (no-op if already past). */
async function waitUntil(hhmm) {
  while (sydney(new Date()).hhmm < hhmm) await sleep(15000);
}

/** 4:5 copy of a 3:4 slide (centre it on the slide's own flat background) in case Instagram rejects 3:4. */
async function pad45(jpgs, bgs) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  const out = [];
  for (const [i, jpg] of jpgs.entries()) {
    await page.setContent(`<body style="margin:0;background:${bgs[i]}"><img style="display:block;height:1350px;margin:0 auto" src="data:image/jpeg;base64,${jpg.toString('base64')}"></body>`);
    await page.evaluate(() => document.images[0].decode());
    out.push(await page.screenshot({ type: 'jpeg', quality: 93 }));
  }
  await browser.close();
  return out;
}

async function waitPublic(urls) {
  for (let i = 0; i < 24; i++) {
    const ok = await Promise.all(urls.map((u) => fetch(u, { method: 'HEAD' }).then((r) => r.ok && /image/.test(r.headers.get('content-type') || ''), () => false)));
    if (ok.every(Boolean)) return;
    await sleep(5000);
  }
  throw new Error('slide images never became publicly reachable');
}

async function main() {
  if (arg('check')) { // verify the Instagram token without posting
    const { token, changed } = await currentToken();
    const me = await instagramUserId(token);
    console.log(`Instagram OK: @${me.username} (id ${me.userId})${changed ? ', token refreshed' : ''}`);
    if (changed) commitPush(['state'], 'Refresh Instagram token');
    return;
  }
  const now = new Date();
  const day = sydney(now);
  const dir = DRY ? 'out' : `posts/${day.dateKey}`;
  if (!DRY && !FORCE) {
    if (day.weekday > 5) return console.log('weekend, nothing to do');
    if (day.hh < 6 || day.hh >= 11) return console.log(`outside the morning window (${day.hhmm} Sydney)`);
    if (await exists(`${dir}/posted.json`)) return console.log('already posted today');
    await waitUntil('07:25');
  }
  if (!DRY) {
    // pick up stories.json committed by the scheduled Claude writer since checkout
    const pull = () => { try { git('pull', '--rebase', 'origin', BRANCH); } catch { /* keep going with what we have */ } };
    pull();
    if (!FORCE && !(await exists(`${dir}/stories.json`))) { await waitUntil('07:28'); pull(); }
  }

  const p = await prepare({ now: new Date() });
  console.log(JSON.stringify({ key: p.key, slides: p.slides.map((s) => s.name), log: p.log, stories: p.stories }, null, 1));
  if (!p.boardOk && p.storyCount === 0) throw new Error('no board and no stories passed the checks; nothing posted');

  const rendered = await renderSlides(p.slides);
  const bgs = p.slides.map((s) => (s.html.match(/body \{ background: (#[0-9A-Fa-f]{6})/) || [])[1] || p.bg);
  const tall = rendered.map((r) => r.jpg);
  const short = await pad45(tall, bgs);
  await mkdir(`${dir}/45`, { recursive: true });
  for (const [i, jpg] of tall.entries()) await writeFile(`${dir}/${i + 1}.jpg`, jpg);
  for (const [i, jpg] of short.entries()) await writeFile(`${dir}/45/${i + 1}.jpg`, jpg);
  await writeFile(`${dir}/caption.txt`, p.caption);
  if (DRY) return console.log(`dry run: ${tall.length} slides in ./out\n\n${p.caption}`);

  const { token, changed } = await currentToken();
  commitPush([dir, ...(changed ? ['state'] : [])], `Slides for ${p.key}`);
  const raw = (f) => `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${dir}/${f}`;
  const urls34 = tall.map((_, i) => raw(`${i + 1}.jpg`));
  const urls45 = short.map((_, i) => raw(`45/${i + 1}.jpg`));
  await waitPublic([...urls34, ...urls45]);
  if (!FORCE) await waitUntil('07:30');

  const { userId, username } = await instagramUserId(token);
  const ig = instagram({ userId, token });
  let mediaId, format = '3:4';
  try {
    mediaId = await ig.publishCarousel({ imageUrls: urls34, caption: p.caption });
  } catch (e) {
    if (!/aspect|ratio|dimension|size/i.test(e.message)) throw e;
    console.warn(`3:4 rejected (${e.message}); posting the 4:5 versions`);
    format = '4:5';
    mediaId = await ig.publishCarousel({ imageUrls: urls45, caption: p.caption });
  }
  await writeFile(`${dir}/posted.json`, JSON.stringify({ mediaId, username, format, postedAt: new Date().toISOString(), stories: p.stories }, null, 1));
  commitPush([dir], `Posted ${p.key}`);
  console.log(`posted ${mediaId} to @${username} (${format})`);
}

main().catch(async (e) => {
  console.error(e);
  process.exitCode = 1; // a failed run emails the repo owner
});
