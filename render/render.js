// Renders slide HTML to a still JPG and (optionally) an animated MP4 using headless Chromium + ffmpeg.
import { chromium } from 'playwright';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const run = (cmd, args) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} failed: ${err.slice(-400)}`))));
});

/**
 * slides: [{ name, html }]. Returns [{ name, jpg: Buffer, mp4?: Buffer }].
 * video: render an MP4 per slide (fps frames per second, holdSeconds of still at the end).
 */
export async function renderSlides(slides, { video = false, fps = 30, holdSeconds = 0 } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'bf-render-'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1440 }, deviceScaleFactor: 1 });
    const out = [];
    for (const s of slides) {
      const file = join(dir, `${s.name}.html`);
      await writeFile(file, s.html);
      await page.goto(`file://${file}?anim`);
      await page.evaluate(async () => { await document.fonts.ready; if (window.__fit) window.__fit(); });
      const result = { name: s.name };
      if (video) {
        const duration = await page.evaluate(() => window.__duration);
        const frames = Math.ceil(duration * fps);
        const fdir = join(dir, s.name);
        await run('mkdir', ['-p', fdir]);
        for (let i = 0; i <= frames; i++) {
          await page.evaluate((t) => window.__seek(t, false), i / fps);
          await page.screenshot({ path: join(fdir, `${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 95 });
        }
        const mp4 = join(dir, `${s.name}.mp4`);
        await run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(fdir, '%04d.jpg'),
          '-vf', `tpad=stop_mode=clone:stop_duration=${holdSeconds},format=yuv420p`,
          '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-r', String(fps), '-movflags', '+faststart', mp4]);
        let finalMp4 = mp4;
        if (s.audio) {
          // music bed from the theme at this slide's offset (so swiping feels continuous) + sound effects
          const out = join(dir, `${s.name}-a.mp4`);
          const vdur = (frames + 1) / fps + holdSeconds;
          const args = ['-y', '-loglevel', 'error', '-i', mp4, '-ss', String(s.audio.offset || 0), '-t', String(vdur), '-i', s.audio.music];
          const fx = s.audio.sfx || [];
          for (const e of fx) args.push('-i', e.file);
          const parts = [`[1:a]afade=t=in:d=0.04,afade=t=out:st=${(vdur - 0.12).toFixed(3)}:d=0.12,volume=${s.audio.musicGain ?? 1}[m]`];
          fx.forEach((e, i) => parts.push(`[${i + 2}:a]adelay=${Math.round(e.at * 1000)}|${Math.round(e.at * 1000)},volume=${e.gain ?? 1}[s${i}]`));
          const labels = ['[m]', ...fx.map((_, i) => `[s${i}]`)].join('');
          parts.push(`${labels}amix=inputs=${fx.length + 1}:normalize=0,alimiter=limit=0.89,loudnorm=I=-14:TP=-1.5:LRA=11[a]`);
          args.push('-filter_complex', parts.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-t', String(vdur), '-movflags', '+faststart', out);
          await run('ffmpeg', args);
          finalMp4 = out;
        }
        result.mp4 = await readFile(finalMp4);
      }
      await page.evaluate(() => window.__seek(999, true));
      result.jpg = await page.screenshot({ type: 'jpeg', quality: 93 });
      out.push(result);
    }
    return out;
  } finally {
    await browser.close();
    await rm(dir, { recursive: true, force: true });
  }
}
