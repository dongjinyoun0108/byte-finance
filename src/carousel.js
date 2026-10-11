// Turns market data + stories into (a) the Canva autofill data, (b) which pages to export, (c) the caption.

import { ASSETS, PAGES, SLOTS, BASE_HASHTAGS, FILLER_HASHTAGS, TAG_HASHTAGS, MOVER_HASHTAGS, MAX_HASHTAGS, DISCLAIMER } from './config.js';
import { coverDate, clockLabel, sydney } from './time.js';

const text = (t) => ({ type: 'text', text: t });
const image = (id) => ({ type: 'image', asset_id: id });

/** Deterministic board headline and pose from the S&P 500 move (no AI, so it can't be wrong). */
export function boardMood(sp) {
  const p = Math.round(sp.changePct * 100) / 100;
  if (p >= 1) return { headline: 'Wall Street rallies', pose: 'celebrating' };
  if (p >= 0.2) return { headline: 'Wall Street closes higher', pose: 'finger_gun' };
  if (p >= 0) return { headline: 'Wall Street edges higher', pose: 'newspaper' };
  if (p > -0.2) return { headline: 'Wall Street edges lower', pose: 'newspaper' };
  if (p > -1) return { headline: 'Wall Street closes lower', pose: 'worried' };
  return { headline: 'Wall Street slides', pose: 'shocked' };
}

// Cover headlines, rotated daily. Each fits the cover box: lines 1-2 ≤ 11 characters,
// line 3 ≤ 9 and line 4 ≤ 8 (lines 3-4 sit beside the coin). {n} = number of stories.
export const COVER_HEADLINES = [
  { min: 2, text: '{n} things\nyou need to\nknow this\nmorning' },
  { min: 0, text: 'What\nmoved\nwhile you\nslept' },
  { min: 0, text: 'Your\nmorning\nmoney\nbrief' },
  { min: 2, text: '{n} stories\nbefore\nyour\ncoffee' },
  { min: 0, text: 'Before\nthe ASX\nopens' },
  { min: 0, text: 'Overnight\nin 60\nseconds' },
  { min: 2, text: 'The {n}\nbig money\nstories\ntoday' },
  { min: 0, text: 'Catch up\nbefore\nwork' },
];

// Cover pose pools by market mood (S&P 500 move). Rotates within the pool day by day.
export const COVER_POSES = {
  bigUp: ['rocket', 'celebrating', 'surfing', 'padel', 'cricket'],
  up: ['quarter_zip', 'surfing', 'cbd_strut', 'bbq', 'run_club', 'finger_gun', 'cricket', 'padel', 'coffee'],
  flat: ['coffee', 'performative', 'thinking', 'quarter_zip', 'bbq', 'trading_desk', 'newspaper', 'cbd_strut'],
  down: ['worried', 'trading_desk', 'umbrella', 'thinking', 'newspaper'],
  bigDown: ['wipeout', 'shocked', 'trading_desk', 'umbrella'],
  unknown: ['coffee', 'performative', 'bbq', 'quarter_zip', 'newspaper', 'thinking'],
};

/** Market posting days (Tue-Sat Sydney) elapsed since Tue 6 Jan 2026: consecutive posting days get consecutive
 * numbers (Saturday -> Tuesday is +1), so rotations never repeat back to back. */
export function dayIndex(dateKey) {
  const dd = Math.round((Date.parse(`${dateKey}T00:00:00Z`) - Date.parse('2026-01-06T00:00:00Z')) / 86400e3);
  const w = Math.floor(dd / 7);
  const r = ((dd % 7) + 7) % 7; // 0 Tue .. 4 Sat, 5 Sun, 6 Mon
  return w * 5 + Math.min(r, 4);
}

export function coverHeadline(n, idx = 0) {
  const options = COVER_HEADLINES.filter((h) => n >= h.min);
  return options[((idx % options.length) + options.length) % options.length].text.replace('{n}', String(n));
}

export function coverPose(sp, idx = 0) {
  let mood = 'unknown';
  if (sp) {
    const p = Math.round(sp.changePct * 100) / 100;
    mood = p >= 1 ? 'bigUp' : p >= 0.3 ? 'up' : p > -0.3 ? 'flat' : p > -1 ? 'down' : 'bigDown';
  }
  const pool = COVER_POSES[mood];
  return pool[((idx % pool.length) + pool.length) % pool.length];
}

// Fixed caption phrases, rotated daily (not AI-written, so they can't break the rules).
export const OFFICIAL_SOURCES = ['RBA', 'Federal Reserve'];

export const CAPTION_HOOKS = {
  up: ['Green screens overnight 📈', 'Wall St woke up happy 📈', 'A good night for the bulls 🐂', 'Up and away overnight 🚀'],
  flat: ['Quiet night on the markets ☕', 'Not much moved overnight. Here’s what did ☕', 'A calm one overnight 😌', 'Sideways night on Wall St ↔️'],
  down: ['Ouch. Wall St had a rough one 📉', 'Red screens overnight 📉', 'A tough night for the bulls 🐻', 'Markets slipped overnight 📉'],
  unknown: ['Your morning money catch-up ☕', 'Here’s what’s moving this morning ☕'],
};
export const CAPTION_CTAS = [
  'Swipe for the details. Follow @byte.finance.au for tomorrow’s.',
  'Save this for your commute 🚆',
  'Send this to the mate who checks their portfolio at the lights 👀',
  'Which story surprised you? Tell us below 👇',
  'Swipe through, then you’re across it. Follow for tomorrow’s.',
  'Share with someone who needs their morning money fix ☕',
];

/** 3 fixed tags + the two most specific tags from today's stories (or the biggest mover). Max 5. */
export function hashtags(stories, board) {
  const tags = [...BASE_HASHTAGS];
  for (const k of ['aus', 'us', 'biz']) {
    const h = stories[k] && TAG_HASHTAGS[stories[k].tag];
    if (h && !tags.includes(h)) tags.push(h);
  }
  const rows = board?.rows || [];
  if (rows.length) {
    const top = rows.filter((r) => MOVER_HASHTAGS[r.key]).sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0];
    const h = top && MOVER_HASHTAGS[top.key];
    if (h && !tags.includes(h)) tags.push(h);
  }
  for (const h of FILLER_HASHTAGS) if (!tags.includes(h)) tags.push(h);
  return tags.slice(0, MAX_HASHTAGS);
}

/**
 * board: { rows, missing } from fetchBoard. stories: from writeStories. now: Date of the data fetch.
 * Board slide is included only when every row loaded; a story slide only when it passed the checks.
 */
export function buildCarousel({ board, stories, now }) {
  const data = {};
  const pages = [PAGES.cover];
  const boardOk = board.missing.length === 0 && board.rows.length > 0;
  const n = ['aus', 'us', 'biz'].filter((k) => stories[k]).length;

  const idx = dayIndex(sydney(now).dateKey);
  const sp = board.rows.find((r) => r.key === 'sp500');
  data.date = text(coverDate(now));
  data.cover_headline = text(coverHeadline(n, idx));
  let pose = coverPose(sp, idx);
  if (boardOk && sp && pose === boardMood(sp).pose) pose = coverPose(sp, idx + 1); // cover and board never match
  data.cover_coin = image(ASSETS.poses[pose]);

  if (boardOk) {
    const mood = boardMood(sp);
    data.board_headline = text(mood.headline);
    data.board_coin = image(ASSETS.poses[mood.pose]);
    data.board_time = text(`Prices as at ${clockLabel(now)}  ·  @byte.finance.au`);
    for (const r of board.rows) {
      data[`${r.key}_value`] = text(r.value);
      data[`${r.key}_change`] = text(r.change);
      data[`${r.key}_pill`] = image(r.up ? ASSETS.pillUp : ASSETS.pillDown);
      if (r.key === 'asx') data.asx_label = text(r.label);
    }
    pages.push(PAGES.board);
  }

  for (const k of ['aus', 'us', 'biz']) {
    const s = stories[k];
    if (!s) continue;
    data[`${k}_tag`] = text(s.tag);
    data[`${k}_headline`] = text(s.headline);
    if (k === 'aus') data.aus_body = text(`${s.body} ${s.why}`);
    else { data[`${k}_body`] = text(s.body); data[`${k}_why`] = text(s.why); }
    // Official sources (RBA, Fed) are credited; aggregator feeds are not shown on the slide.
    data[`${k}_source`] = text(OFFICIAL_SOURCES.includes(s.item.source) ? `Source: ${s.item.source}` : '@byte.finance.au');
    data[`${k}_coin`] = image(ASSETS.poses[s.tag === 'Aussie dollar' ? 'kangaroo' : s.mood]);
    pages.push(SLOTS[k].page);
  }
  pages.push(PAGES.outro);

  const hookMood = !sp ? 'unknown' : sp.changePct >= 0.3 ? 'up' : sp.changePct > -0.3 ? 'flat' : 'down';
  const hooks = CAPTION_HOOKS[hookMood];
  // The first ~125 characters show before "more" and feed Instagram search, so lead with keywords and the headlines.
  const lines = [hooks[idx % hooks.length], `Aussie finance news, ${coverDate(now)}`, ''];
  const heads = ['aus', 'us', 'biz'].filter((k) => stories[k]).map((k, i) => `${i + 1}. ${stories[k].headline}`);
  if (heads.length) lines.push(...heads, '');
  if (boardOk) {
    const pick = ['sp500', 'nasdaq', 'asx', 'btc', 'aud'].map((k) => board.rows.find((r) => r.key === k)).filter(Boolean);
    lines.push(`Overnight: ${pick.map((r) => `${r.label.replace(' (close)', '')} ${r.change.replace(/^([↑↓]) [+-]?/, '$1 ')}`).join('  |  ')}`, '');
  }
  lines.push(CAPTION_CTAS[idx % CAPTION_CTAS.length], '');
  const sources = [...new Set(['aus', 'us', 'biz'].filter((k) => stories[k]).map((k) => stories[k].item.source))].filter((x) => OFFICIAL_SOURCES.includes(x));
  lines.push(`${DISCLAIMER}${boardOk ? ` Prices as at ${clockLabel(now)}.` : ''}${sources.length ? ` Includes info from ${sources.join(', ')}.` : ''}`, '');
  lines.push(hashtags(stories, board).join(' '));

  return { data, pages, caption: lines.join('\n'), boardOk, storyCount: n };
}
