// Renders a reel page (render/reel.js) to an H.264/AAC MP4 with the theme music, plus a cover JPG.
import { chromium } from 'playwright';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const run = (cmd, args) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} failed: ${err.slice(-500)}`))));
});

/** reel: { html, duration }. Returns { mp4: Buffer, cover: Buffer }. coverAt: seconds into the reel for the cover frame. */
export async function renderReel(reel, { fps = 60, coverAt = 2.6, music = join(here, 'assets/audio/theme.wav') } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'bf-reel-'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    const file = join(dir, 'reel.html');
    await writeFile(file, reel.html);
    await page.goto(`file://${file}`);
    await page.evaluate(async () => { await document.fonts.ready; window.__fit(); });
    const frames = Math.round(reel.duration * fps);
    for (let i = 0; i < frames; i++) {
      await page.evaluate((t) => window.__seek(t), i / fps);
      await page.screenshot({ path: join(dir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
    }
    await page.evaluate((t) => window.__seek(t), coverAt);
    const cover = await page.screenshot({ type: 'jpeg', quality: 92 });
    const mp4 = join(dir, 'reel.mp4');
    const d = (frames / fps).toFixed(3);
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, '%05d.jpg'), '-i', music,
      '-filter_complex', `[1:a]atrim=0:${d},afade=t=in:d=0.05,afade=t=out:st=${(d - 0.8).toFixed(3)}:d=0.8,loudnorm=I=-14:TP=-1.5:LRA=11[a]`,
      '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(fps),
      '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-t', d, '-movflags', '+faststart', mp4]);
    return { mp4: await readFile(mp4), cover };
  } finally {
    await browser.close();
    await rm(dir, { recursive: true, force: true });
  }
}
