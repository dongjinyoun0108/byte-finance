// Byte Finance daily carousel, GitHub Actions edition:
// market board + news -> stories (Claude, or free GitHub Models) -> guardrails -> code-rendered slides
// -> images committed to this (public) repo -> Instagram carousel -> posts/DATE/posted.json.

import { BOARD, FEEDS, DISCLAIMER } from './config.js';
import { fetchBoard } from './sources/yahoo.js';
import { fetchNews } from './sources/news.js';
import { writeStories, callWriter, acceptDraft } from './writer.js';
import { readFile } from 'node:fs/promises';
import { buildCarousel, boardMood, coverPose, dayIndex, OFFICIAL_SOURCES } from './carousel.js';
import { sydney, coverDate, clockLabel } from './time.js';
import { coverSlide, boardSlide, storySlide, outroSlide, FIELDS } from '../render/slides.js';

const SHORT = { sp500: 'S&P 500', nasdaq: 'Nasdaq', dow: 'The Dow', asx: 'ASX 200', btc: 'Bitcoin', eth: 'Ethereum', aud: 'Aussie dollar', gold: 'Gold', oil: 'Oil' };
const OUTRO_POSES = ['cbd_strut', 'run_club', 'surfing', 'performative', 'bbq', 'padel', 'cricket', 'quarter_zip'];

/** The cover hook: the biggest overnight mover among the headline markets. */
export function coverHook(board) {
  const pool = ['sp500', 'nasdaq', 'asx', 'btc', 'gold', 'aud', 'oil'].map((k) => board.rows.find((r) => r.key === k)).filter(Boolean);
  if (!pool.length) return null;
  const top = pool.reduce((a, b) => (Math.abs(b.changePct) > Math.abs(a.changePct) ? b : a));
  const pct = Math.abs(top.changePct).toFixed(1);
  if (pct === '0.0') return { headline: 'A quiet night\non the markets', row: top };
  return { headline: `${SHORT[top.key]} ${top.changePct >= 0 ? 'up' : 'down'} ${pct}%\nwhile you slept`, row: top };
}

/** Yahoo row -> what the board slide needs. */
function boardRow(r) {
  const fmt = BOARD.find((b) => b.key === r.key)?.format;
  const map = {
    index2: { decimals: 2 }, index1: { decimals: 1 }, usd0: { decimals: 0, prefix: 'US$' }, usd2: { decimals: 2, prefix: 'US$' },
    uscents: { decimals: 2, suffix: '¢', scale: 100 },
  }[fmt] || { decimals: 2 };
  const k = map.scale || 1;
  const price = r.price * k, prevClose = r.prevClose * k;
  const value = `${map.prefix || ''}${price.toLocaleString('en-US', { minimumFractionDigits: map.decimals, maximumFractionDigits: map.decimals })}${map.suffix || ''}`;
  return { label: r.label, price, prevClose, decimals: map.decimals, prefix: map.prefix || '', suffix: map.suffix || '', changePct: r.changePct, up: r.up, value, spark: r.spark };
}

/**
 * Gathers data, writes and checks stories, and returns the slides (HTML) + caption.
 * Nothing is posted here.
 */
export async function prepare({ now = new Date(), fetchImpl = fetch, writer = callWriter } = {}) {
  const day = sydney(now);
  const idx = dayIndex(day.dateKey);
  const [board, news] = await Promise.all([fetchBoard(BOARD, { fetchImpl }), fetchNews(FEEDS, { now, fetchImpl })]);
  // Stories: posts/DATE/stories.json from the scheduled Claude task if it's there; otherwise the API writer
  // (needs ANTHROPIC_API_KEY); otherwise board-only. Either way every story goes through the guardrails.
  let stories = {}, log = [];
  const draftFile = `posts/${day.dateKey}/stories.json`;
  const draft = await readFile(draftFile, 'utf8').then(JSON.parse, () => null);
  if (draft) {
    const r = acceptDraft({ draft, items: draft.items || [], board });
    stories = r.stories; log = [{ from: draftFile, accepted: Object.keys(r.stories), problems: r.problems }];
  }
  if (!Object.keys(stories).length && process.env.ANTHROPIC_API_KEY) {
    ({ stories, log } = await writeStories({ items: news.items, board, claude: (m) => writer(m, { fetchImpl }) })
      .catch((e) => ({ stories: {}, log: [String(e.message || e)] })));
  }
  if (!draft && !process.env.ANTHROPIC_API_KEY) log.push('no stories.json and no ANTHROPIC_API_KEY: board-only');

  const car = buildCarousel({ board, stories, now }); // caption + which slides survive the checks
  const sp = board.rows.find((r) => r.key === 'sp500');
  const n = ['aus', 'us', 'biz'].filter((k) => stories[k]).length;
  const hook = car.boardOk ? coverHook(board) : null;
  let pose = coverPose(sp, idx);
  if (car.boardOk && sp && pose === boardMood(sp).pose) pose = coverPose(sp, idx + 1);

  const slides = [];
  slides.push({
    name: '1-cover',
    html: coverSlide({
      date: coverDate(now),
      headline: hook ? hook.headline : 'Your morning\nmoney brief',
      kicker: n ? `${n} ${n === 1 ? 'story' : 'stories'} before your coffee` : 'Your markets, before coffee',
      pose, mood: sp && sp.changePct < 0 ? 'down' : 'up',
      sp: hook ? { up: hook.row.changePct >= 0, changePct: hook.row.changePct, label: `${SHORT[hook.row.key]} overnight` } : { up: true, changePct: 0, label: 'Markets overnight' },
      spark: hook ? hook.row.spark : [0, 0],
    }),
  });
  if (car.boardOk) {
    const mood = boardMood(sp);
    slides.push({ name: '2-board', html: boardSlide({ headline: mood.headline, asOf: `Prices at ${clockLabel(now)}`, rows: board.rows.map(boardRow), pose: mood.pose }) });
  }
  const used = ['aus', 'us', 'biz'].filter((k) => stories[k]);
  used.forEach((k, i) => {
    const s = stories[k];
    slides.push({
      name: `${slides.length + 1}-${k}`,
      html: storySlide({
        slot: k, n: i + 1, of: used.length, tag: s.tag, headline: s.headline, body: s.body, why: s.why,
        pose: s.tag === 'Aussie dollar' ? 'kangaroo' : s.mood,
        source: OFFICIAL_SOURCES.includes(s.item.source) ? `Source: ${s.item.source}` : '',
        figure: s.figure || '', figureLabel: s.figure_label || '',
      }),
    });
  });
  slides.push({ name: `${slides.length + 1}-outro`, html: outroSlide({ pose: [0, 1, 2].map((j) => OUTRO_POSES[(idx + j) % OUTRO_POSES.length]).find((x) => x !== pose && x !== (sp && boardMood(sp).pose)), handle: '@byte.finance.au', disclaimer: DISCLAIMER }) });

  return {
    key: day.dateKey, slides, caption: car.caption, boardOk: car.boardOk, storyCount: n,
    log: { board: { loaded: board.rows.length, missing: board.missing }, news: { items: news.items.length, errors: news.errors }, writer: log },
    stories: Object.fromEntries(Object.entries(stories).map(([k, s]) => [k, { headline: s.headline, source: s.item.source, link: s.item.link }])),
    bg: FIELDS.cover.bg,
  };
}
