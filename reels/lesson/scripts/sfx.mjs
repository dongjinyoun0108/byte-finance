// Sound design for lesson Reels: ElevenLabs-made SFX (render/assets/audio/sfx), placed on the motion they belong to.
// Timings mirror the runtime timelines; volumes sit under the music bed.
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';

export const SFX_LEN = { whoosh: 0.62, pop: 0.3, coin: 0.45, tick: 1.0, chime: 0.9, draw: 0.55, slide: 0.7 };
const GAIN = 1.6;

export function copySfx(repo, here) {
  for (const n of Object.keys(SFX_LEN)) copyFileSync(join(repo, 'render/assets/audio/sfx', n + '.wav'), join(here, 'assets/audio', 'sfx-' + n + '.wav'));
}

export function cueList() {
  const list = [];
  list.cue = (name, at, vol) => list.push({ name, at: +Math.max(0, at).toFixed(3), vol: +Math.min(0.85, vol * GAIN).toFixed(2) });
  return list;
}

/** Cues every lesson shares: title, coin entrance, step changes, outro. */
export function shellCues(list, T) {
  list.cue('slide', 0.15, 0.24);              // title rises
  list.cue('coin', 0.95, 0.14);               // coin settles in
  for (let i = 1; i < 4; i++) list.cue('whoosh', T[1 + i] - 0.2, 0.2); // camera to the next step
  list.cue('whoosh', T[5] - 0.35, 0.18);      // into the outro
  list.cue('chime', T[5] + 0.75, 0.3);        // follow pill
}

export function sfxTags(list, TOTAL) {
  // keep cues from stacking: drop a cue of the same kind within 0.18s of the previous one
  const seen = {};
  const keep = [...list].sort((a, b) => a.at - b.at).filter((c) => {
    const ok = seen[c.name] == null || c.at - seen[c.name] > 0.18;
    if (ok) seen[c.name] = c.at;
    return ok && c.at + 0.05 < TOTAL;
  });
  return keep.map((c, i) => `<audio id="sfx${i}" src="assets/audio/sfx-${c.name}.wav" data-start="${c.at}" data-duration="${Math.min(SFX_LEN[c.name], +(TOTAL - c.at).toFixed(3))}" data-track-index="${11 + i}" data-volume="${c.vol}"></audio>`).join('\n ');
}
