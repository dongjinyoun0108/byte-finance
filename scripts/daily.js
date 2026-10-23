// Entry point for the GitHub Actions job (.github/workflows/daily.yml).
//   node scripts/daily.js            normal scheduled run (waits for 7:25/7:30 Sydney, posts once per day)
//   node scripts/daily.js --dry      render to ./out only, post nothing, ignore time and day
//   node scripts/daily.js --force    post now, even outside the window or if today already posted
//   add --weekend / --weekday to force which format is made (default: lesson on Sun/Mon, market news Tue-Sat)
import { mkdir, writeFile, readFile, readdir, access } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { chromium } from 'playwright';
import { prepare } from '../src/daily.js';
import { prepareWeekend } from '../src/weekend.js';
import { renderSlides } from '../render/render.js';
import { instagram } from '../src/instagram.js';
import { currentToken, instagramUserId } from '../src/igtoken.js';
import { sydney } from '../src/time.js';
import { REEL, reelMusic } from '../src/config.js';
import { readFileSync } from 'node:fs';
const hasLessonVisual = (id) => { try { return !!JSON.parse(readFileSync('content/lesson-visuals.json', 'utf8'))[id]; } catch { return false; } };

const arg = (n) => process.argv.includes(`--${n}`);
const REELONLY = arg('reel'); // carousel already posted today: render and post just the reel, now
const REELTEST = arg('reeltest'); // render today's reel and upload it to Instagram WITHOUT publishing; result -> previews/
const PREVIEW = arg('preview') || REELTEST; // like --dry, but commits today's reel.mp4 to previews/ so it can be checked
const DRY = arg('dry') || PREVIEW, FORCE = arg('force');
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
    try { git('pull', '--rebase', '--autostash', 'origin', BRANCH); git('push', 'origin', `HEAD:${BRANCH}`); return; } catch (e) { if (i === 2) throw e; }
  }
}

/** Wait until hh:mm Sydney time (no-op if already past). */
async function waitUntil(hhmm) {
  while (sydney(new Date()).hhmm < hhmm) await sleep(15000);
}

/** 9:16 Story card: today's cover on its own background with a nudge to the post. */
async function storyCard(coverJpg, bg) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.setContent(`<body style="margin:0;width:1080px;height:1920px;background:${bg};font-family:Helvetica,Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;color:#17181C">
    <div style="font-size:54px;font-weight:800;letter-spacing:-1px">Today's brief is up ☕</div>
    <img style="width:900px;border-radius:36px;box-shadow:0 30px 60px rgba(23,24,28,.18)" src="data:image/jpeg;base64,${coverJpg.toString('base64')}">
    <div style="font-size:40px;font-weight:700;background:#17181C;color:${bg};padding:22px 40px;border-radius:999px">Tap the profile to read it</div></body>`);
  await page.evaluate(() => document.images[0].decode());
  const jpg = await page.screenshot({ type: 'jpeg', quality: 92 });
  await browser.close();
  return jpg;
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

/** Chrome headless shell from the Playwright install, so HyperFrames doesn't download its own. */
async function headlessShell() {
  const root = join(homedir(), '.cache/ms-playwright');
  for (const d of (await readdir(root).catch(() => [])).filter((x) => x.startsWith('chromium_headless_shell')).sort().reverse()) {
    for (const p of ['chrome-linux/headless_shell', 'chrome-headless-shell-linux64/chrome-headless-shell']) if (await exists(join(root, d, p))) return join(root, d, p);
  }
  return null;
}

const runCmd = (cmd, args, opts = {}) => new Promise((ok, fail) => {
  const c = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  let log = '';
  c.stdout.on('data', (d) => { log += d; }); c.stderr.on('data', (d) => { log += d; });
  c.on('close', (code) => (code === 0 ? ok(log) : fail(new Error(`${cmd} ${args.join(' ')} exited ${code}\n${log.slice(-2000)}`))));
});

/**
 * Builds and renders a Reel project to an MP4 and returns the file's bytes.
 *   market days: reels/daily-news from the day's data;  lesson days: reels/lesson for the day's topic.
 */
async function renderReel({ dir, buildArgs, outFile }) {
  const t0 = Date.now();
  // build.mjs rewrites the tracked composition; keep git from treating that as a local change mid-run
  try { execFileSync('git', ['update-index', '--skip-worktree', `${dir}/index.html`]); } catch { /* not a git checkout */ }
  console.log((await runCmd('node', [`${dir}/scripts/build.mjs`, ...buildArgs])).trim());
  const env = { ...process.env };
  const hs = await headlessShell();
  if (hs) env.HYPERFRAMES_BROWSER_PATH = hs;
  const log = await runCmd('npx', ['--yes', `hyperframes@${REEL.hyperframes}`, 'render', '--output', resolve(outFile)], { cwd: dir, env });
  console.log(`reel rendered in ${Math.round((Date.now() - t0) / 1000)}s: ${(log.match(/[\d.]+ MB[^\n]*/) || [''])[0]}`);
  return readFile(outFile);
}

/**
 * Instagram (Instagram-login API) only takes Reels by public URL. Publish the MP4 on a one-commit orphan branch
 * `media`, force-pushed each time, so the video is reachable at a raw URL without bloating main's history.
 */
async function hostVideo(file, name) {
  const blob = execFileSync('git', ['hash-object', '-w', file]).toString().trim();
  const tree = execFileSync('git', ['mktree'], { input: `100644 blob ${blob}\t${name}\n` }).toString().trim();
  const commit = execFileSync('git', ['-c', 'user.name=byte-finance-bot', '-c', 'user.email=bot@users.noreply.github.com', 'commit-tree', tree, '-m', `Reel ${name}`]).toString().trim();
  execFileSync('git', ['push', '-f', 'origin', `${commit}:refs/heads/media`], { stdio: 'inherit' });
  const url = `https://raw.githubusercontent.com/${REPO}/media/${name}`;
  for (let i = 0; i < 36; i++) { // wait until the CDN serves it
    const r = await fetch(url, { method: 'HEAD' }).catch(() => null);
    if (r?.ok && +(r.headers.get('content-length') || 0) > 1000) return url;
    await sleep(5000);
  }
  throw new Error(`video never became reachable at ${url}`);
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
    const g = async (path) => (await fetch(`https://graph.instagram.com/v21.0/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`)).json().catch((e) => ({ error: String(e) }));
    const media = await g(`${me.userId}/media?fields=timestamp,media_type,caption,permalink&limit=20`);
    const quota = await g(`${me.userId}/content_publishing_limit?fields=quota_usage,config`);
    const recent = (media.data || []).map((m) => `${m.timestamp} ${m.media_type} ${m.permalink || ''} ${(m.caption || '').split('\n')[0].slice(0, 60)}`).join('\n') || JSON.stringify(media.error || media);
    await saveStatus('last-check.txt', `Instagram OK: @${me.username}\nquota: ${JSON.stringify(quota.data || quota.error || quota)}\nrecent media:\n${recent}`);
    if (changed) commitPush(['state'], 'Refresh Instagram token');
    return;
  }
  const now = new Date();
  const day = sydney(now);
  // Market posts follow the US session: Tue-Sat Sydney mornings. Lessons on Sun + Mon (no US trading overnight).
  const WEEKEND = arg('weekend') || ((day.weekday === 7 || day.weekday === 1) && !arg('weekday'));
  const dir = DRY ? 'out' : `posts/${day.dateKey}`;
  if (REELONLY) {
    const posted = JSON.parse(await readFile(`${dir}/posted.json`, 'utf8').catch(() => 'null'));
    if (!posted) throw new Error('nothing posted today yet; run the normal job instead');
    if (posted.reelId) return console.log(`reel already posted today (${posted.reelId})`);
  } else if (!DRY && !FORCE) {
    if (day.hh < 6 || day.hh >= 11) return console.log(`outside the morning window (${day.hhmm} Sydney)`);
    if (await exists(`${dir}/posted.json`)) return console.log('already posted today');
    await waitUntil('07:25');
  }
  if (!DRY && !WEEKEND) {
    // pick up stories.json committed by the scheduled Claude writer since checkout
    const pull = () => { try { git('pull', '--rebase', '--autostash', 'origin', BRANCH); } catch { /* keep going with what we have */ } };
    pull();
    if (!FORCE && !(await exists(`${dir}/stories.json`))) { await waitUntil('07:28'); pull(); }
  }

  // Weekdays: market news. Weekends: a "Money explained" lesson from the topic bank.
  const p = WEEKEND ? prepareWeekend({ now: new Date() }) : await prepare({ now: new Date() });
  console.log(JSON.stringify({ key: p.key, topic: p.topic, slides: p.slides.map((s) => s.name), log: p.log, stories: p.stories }, null, 1));
  if (!WEEKEND && !p.boardOk && p.storyCount === 0) throw new Error('no board and no stories passed the checks; nothing posted');

  const rendered = await renderSlides(p.slides);
  const bgs = p.slides.map((s) => (s.html.match(/body \{ background: (#[0-9A-Fa-f]{6})/) || [])[1] || p.bg);
  const tall = rendered.map((r) => r.jpg);
  const short = await pad45(tall, bgs);
  await mkdir(`${dir}/45`, { recursive: true });
  for (const [i, jpg] of tall.entries()) await writeFile(`${dir}/${i + 1}.jpg`, jpg);
  for (const [i, jpg] of short.entries()) await writeFile(`${dir}/45/${i + 1}.jpg`, jpg);
  await writeFile(`${dir}/caption.txt`, p.caption);
  await writeFile(`${dir}/story.jpg`, await storyCard(tall[0], bgs[0]));

  // Reel: render in the background while the carousel goes out; it posts at 7:35.
  //   market days: the news Reel from today's data;  lesson days: the topic's living-diagram lesson (if it has a visual).
  const reelOut = DRY ? `${dir}/reel.mp4` : join(process.env.RUNNER_TEMP || 'out', 'reel.mp4');
  let reelSpec = null;
  if (REEL.enabled && process.env.REELS !== 'off') {
    if (!WEEKEND && p.reel) {
      await writeFile(`${dir}/reel.json`, JSON.stringify({ ...p.reel, music: reelMusic(REEL.music, day.dateKey) }, null, 1));
      reelSpec = { dir: REEL.dir, buildArgs: [`${dir}/reel.json`, '--ai'], outFile: reelOut };
    } else if (WEEKEND && hasLessonVisual(p.topic)) {
      reelSpec = { dir: REEL.lessonDir, buildArgs: [p.topic, `--music=${reelMusic(REEL.lessonMusic, day.dateKey, 2)}`], outFile: reelOut };
    }
  }
  const reelJob = reelSpec ? renderReel(reelSpec).catch((e) => ({ error: e })) : null;
  if (REELONLY) {
    const posted = JSON.parse(await readFile(`${dir}/posted.json`, 'utf8'));
    const video = reelJob && await reelJob;
    if (!video) throw new Error('no reel for today');
    if (video.error) throw video.error;
    const { token } = await currentToken();
    const { userId } = await instagramUserId(token);
    const ig = instagram({ userId, token });
    const done = await ig.findPosted({ caption: p.caption, type: 'VIDEO', since: Date.parse(`${p.key}T00:00:00Z`) - 11 * 3600e3 }).catch(() => null);
    if (done) posted.reelId = done.id;
    else {
      const videoUrl = await hostVideo(reelSpec.outFile, `reel-${p.key}.mp4`);
      const container = await ig.prepareReel({ videoUrl, caption: p.caption, shareToFeed: REEL.shareToFeed });
      posted.reelId = await ig.publish(container, { caption: p.caption, type: 'VIDEO' });
    }
    posted.reelAt = new Date().toISOString();
    delete posted.reelError;
    await writeFile(`${dir}/posted.json`, JSON.stringify(posted, null, 1));
    commitPush([`${dir}/posted.json`], `Posted reel ${p.key}`);
    return console.log(`posted reel ${posted.reelId}`);
  }
  if (DRY) {
    const r = reelJob && await reelJob;
    if (r?.error) { console.error(r.error); process.exitCode = 1; }
    if (REELTEST) {
      const res = { at: new Date().toISOString(), topic: p.topic };
      try {
        if (!reelJob) throw new Error('no reel for today');
        if (r?.error) throw r.error;
        res.bytes = r.length;
        const { token } = await currentToken();
        const { userId } = await instagramUserId(token);
        const ig = instagram({ userId, token });
        const t1 = Date.now();
        res.videoUrl = await hostVideo(reelSpec.outFile, `reel-${p.key}-test.mp4`);
        res.container = await ig.prepareReel({ videoUrl: res.videoUrl, caption: 'test (not published)', debug: (m) => { (res.trace ||= []).push(m); } });
        res.processedSeconds = Math.round((Date.now() - t1) / 1000);
        res.result = 'uploaded and processed OK (not published)';
      } catch (e) { res.result = 'FAILED'; res.error = String(e.stack || e).slice(0, 3000); }
      await mkdir('previews', { recursive: true });
      await writeFile(`previews/${p.key}-reeltest.json`, JSON.stringify(res, null, 1));
      commitPush(['previews'], `Reel test ${p.key}`);
      return console.log(JSON.stringify(res, null, 1));
    }
    if (PREVIEW) {
      await mkdir('previews', { recursive: true });
      const log = { at: new Date().toISOString(), reel: !reelJob ? 'none' : r?.error ? String(r.error.stack || r.error) : 'ok', slides: tall.length, topic: p.topic, reelData: p.reel };
      await writeFile(`previews/${p.key}.json`, JSON.stringify(log, null, 1));
      if (reelJob && !r?.error) await writeFile(`previews/${p.key}-reel.mp4`, r);
      await mkdir(`previews/${p.key}-slides`, { recursive: true });
      for (const [i, jpg] of tall.entries()) await writeFile(`previews/${p.key}-slides/${i + 1}.jpg`, jpg);
      commitPush(['previews'], `Preview ${p.key}`);
    }
    return console.log(`dry run: ${tall.length} slides${reelJob && !r?.error ? ' + reel.mp4' : ''} in ./out\n\n${p.caption}`);
  }

  const { token, changed } = await currentToken();
  commitPush([dir, ...(changed ? ['state'] : [])], `Slides for ${p.key}`);
  const raw = (f) => `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${dir}/${f}`;
  const urls34 = tall.map((_, i) => raw(`${i + 1}.jpg`));
  const urls45 = short.map((_, i) => raw(`45/${i + 1}.jpg`));
  await waitPublic([...urls34, ...urls45, raw('story.jpg')]);
  if (!FORCE) await waitUntil('07:30');

  const { userId, username } = await instagramUserId(token);
  const ig = instagram({ userId, token });
  let mediaId, format = '3:4';
  // Never post twice: if today's carousel is already on the account (an earlier run that errored after
  // publishing), record it and carry on with the story and reel.
  const dayStart = Date.parse(`${p.key}T00:00:00Z`) - 11 * 3600e3;
  const existing = await ig.findPosted({ caption: p.caption, type: 'CAROUSEL_ALBUM', since: dayStart }).catch(() => null);
  try {
    if (existing) { mediaId = existing.id; format = 'existing'; console.log(`carousel already posted today (${mediaId}); not posting again`); }
    else mediaId = await ig.publishCarousel({ imageUrls: urls34, caption: p.caption, altTexts: p.alts });
  } catch (e) {
    if (!/aspect|ratio|dimension|size/i.test(e.message)) throw e;
    console.warn(`3:4 rejected (${e.message}); posting the 4:5 versions`);
    format = '4:5';
    mediaId = await ig.publishCarousel({ imageUrls: urls45, caption: p.caption, altTexts: p.alts });
  }
  let storyId = null; // nudge followers via Stories; never fails the run
  if (!existing) try { storyId = await ig.publishStory({ imageUrl: raw('story.jpg') }); } catch (e) { console.warn(`story skipped: ${e.message}`); }
  const posted = { mediaId, storyId, username, format, postedAt: new Date().toISOString(), stories: p.stories };
  await writeFile(`${dir}/posted.json`, JSON.stringify(posted, null, 1));
  commitPush([dir], `Posted ${p.key}`);
  console.log(`posted ${mediaId} to @${username} (${format})`);

  if (reelJob) { // never undoes the carousel; a failure here just fails the run so the owner gets an email
    try {
      const video = await reelJob;
      if (video.error) throw video.error;
      const reelDone = await ig.findPosted({ caption: p.caption, type: 'VIDEO', since: dayStart }).catch(() => null);
      if (reelDone) posted.reelId = reelDone.id;
      else {
        const videoUrl = await hostVideo(reelSpec.outFile, `reel-${p.key}.mp4`);
        const container = await ig.prepareReel({ videoUrl, caption: p.caption, shareToFeed: REEL.shareToFeed });
        if (!FORCE) await waitUntil(REEL.at);
        posted.reelId = await ig.publish(container, { caption: p.caption, type: 'VIDEO' });
      }
      posted.reelAt = new Date().toISOString();
      await writeFile(`${dir}/posted.json`, JSON.stringify(posted, null, 1));
      commitPush([dir], `Posted reel ${p.key}`);
      console.log(`posted reel ${posted.reelId}`);
    } catch (e) {
      console.error(`reel not posted: ${e.stack || e}`);
      posted.reelError = String(e.message || e).slice(0, 2000); // logs aren't always reachable; keep the reason with the post
      await writeFile(`${dir}/posted.json`, JSON.stringify(posted, null, 1));
      try { commitPush([dir], `Reel failed ${p.key}`); } catch { /* still exit non-zero below */ }
      process.exitCode = 1;
    }
  }
}

// Save why a run failed where it can be read without the Actions logs (tokens redacted).
async function saveStatus(name, text) {
  if (!process.env.GITHUB_ACTIONS) return;
  try {
    await mkdir('status', { recursive: true });
    const clean = String(text).replace(/access_token=[^&\s"']+/g, 'access_token=…').replace(/IG[A-Za-z0-9_-]{40,}/g, '…');
    await writeFile(`status/${name}`, `${new Date().toISOString()}\n${clean}\n`);
    commitPush(['status'], `Run status: ${name}`);
  } catch { /* best effort */ }
}

main().catch(async (e) => {
  console.error(e);
  await saveStatus('last-error.txt', e.stack || e);
  process.exitCode = 1; // a failed run emails the repo owner
});
