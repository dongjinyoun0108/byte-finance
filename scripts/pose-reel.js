// Renders every coin pose doing its signature move.
//   node scripts/pose-reel.js [--strip] [--video] [pose ...]
//   --strip: one filmstrip PNG per pose (frames at key times) into ./preview/reel
//   --video: one MP4 reel of all poses with music into ./preview/pose-reel.mp4
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { storySlide, SLIDE_SECONDS } from '../render/slides.js';

const all = (await readdir('render/assets/coin')).filter((f) => f.endsWith('.png') && !f.includes('_alt')).map((f) => f.slice(0, -4));
const poses = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const list = poses.length ? poses : all;
const slots = ['aus', 'us', 'biz'];
const OUT = 'preview/reel';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1440 } });
const TIMES = [0.15, 0.4, 0.65, 0.9, 1.15, 1.4, 1.8, 2.4];
const video = process.argv.includes('--video');
let n = 0;
for (const [i, pose] of list.entries()) {
  const html = storySlide({ slot: slots[i % 3], n: i + 1, of: list.length, tag: pose.replace('_', ' '), headline: pose.replace('_', ' '), body: 'Signature move preview.', why: '', pose });
  const file = join(process.cwd(), OUT, `${pose}.html`);
  await writeFile(file, html);
  await page.goto(`file://${file}?anim`);
  await page.evaluate(() => document.fonts.ready);
  if (process.argv.includes('--strip')) {
    const shots = [];
    for (const t of TIMES) { await page.evaluate((x) => window.__seek(x, false), t); shots.push(await page.screenshot({ type: 'jpeg', quality: 70, clip: { x: 380, y: 400, width: 700, height: 1040 } })); }
    await page.evaluate(() => window.__seek(999, true));
    shots.push(await page.screenshot({ type: 'jpeg', quality: 70, clip: { x: 380, y: 400, width: 700, height: 1040 } }));
    for (const [k, b] of shots.entries()) await writeFile(join(OUT, `${pose}-${k}.jpg`), b);
  }
  if (video) {
    const fr = Math.round(SLIDE_SECONDS * 30);
    for (let f = 0; f < fr; f++) {
      await page.evaluate((x) => window.__seek(x, false), f / 30);
      await page.screenshot({ path: join(OUT, `f${String(n++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 90 });
    }
  }
}
await browser.close();
if (video) {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(OUT, 'f%05d.jpg'), '-stream_loop', '-1', '-i', 'render/assets/audio/theme.wav',
    '-shortest', '-vf', 'scale=720:960,format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', 'preview/pose-reel.mp4']);
  if (r.status) throw new Error(r.stderr.toString());
  spawnSync('sh', ['-c', `rm -f ${OUT}/f*.jpg`]);
}
console.log(`done: ${list.length} poses`);
