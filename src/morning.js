// Byte Finance daily carousel: gather -> write -> check -> fill Canva -> export -> upload -> post -> log.

import { BOARD, FEEDS, MORNING_TEMPLATE_ID, MORNING_WINDOW } from './config.js';
import { fetchBoard } from './sources/yahoo.js';
import { fetchNews } from './sources/news.js';
import { writeStories, callClaude } from './writer.js';
import { buildCarousel } from './carousel.js';
import { getAccessToken, autofill, exportJpgs } from './canva.js';
import { sydney, inWindow } from './time.js';

async function retry(fn, tries = 2, waitMs = 3000) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < tries - 1) await new Promise((r) => setTimeout(r, waitMs)); }
  }
  throw last;
}

/**
 * options:
 *  now        Date (default: now)
 *  force      ignore the posting window and the already-posted check
 *  dryRun     stop before Canva (returns the autofill data + caption)
 *  renderOnly fill Canva and export, but don't upload or post (for previews)
 *  deps       { store, fetchImpl, claude, canvaFetch, ig, waitMs }
 */
export async function runMorning({ now = new Date(), force = false, dryRun = false, renderOnly = false, deps }) {
  const { store, fetchImpl = fetch, claude = (m) => callClaude(m, { fetchImpl }), canvaFetch = fetchImpl, ig, pollMs } = deps;
  const day = sydney(now);
  const key = `morning-${day.dateKey}`;
  const result = { key, status: 'started' };

  if (process.env.PAUSED === 'true') return { ...result, status: 'paused' };
  if (!force && !inWindow(now, MORNING_WINDOW)) return { ...result, status: 'outside-window', sydney: day.hhmm };
  if (!force && !dryRun && (await store.alreadyPosted(key))) return { ...result, status: 'already-posted' };

  // 1. Data, about 5 minutes before the post goes live.
  const [board, news] = await Promise.all([
    fetchBoard(BOARD, { fetchImpl }),
    fetchNews(FEEDS, { now, fetchImpl }),
  ]);
  result.board = { loaded: board.rows.length, missing: board.missing };
  result.news = { items: news.items.length, feedErrors: news.errors };

  // 2. Stories (Claude + guardrails). No key or no news -> board-only post.
  const { stories, log } = process.env.ANTHROPIC_API_KEY || deps.claude
    ? await writeStories({ items: news.items, board, claude })
    : { stories: {}, log: ['ANTHROPIC_API_KEY not set'] };
  result.writer = log;

  const carousel = buildCarousel({ board, stories, now });
  result.pages = carousel.pages;
  result.caption = carousel.caption;
  result.stories = Object.fromEntries(Object.entries(stories).map(([k, s]) => [k, { headline: s.headline, source: s.item.source, link: s.item.link }]));

  if (!carousel.boardOk && carousel.storyCount === 0) return { ...result, status: 'skipped-no-content' };
  if (dryRun) return { ...result, status: 'dry-run', data: carousel.data };

  // 3. Canva: autofill the brand template, export the pages we're using.
  const token = await getAccessToken({ store, fetchImpl: canvaFetch });
  const designId = await retry(() => autofill({ token, templateId: MORNING_TEMPLATE_ID(), data: carousel.data, title: `Byte Finance ${day.dateKey}`, fetchImpl: canvaFetch, intervalMs: pollMs }));
  const exportUrls = await retry(() => exportJpgs({ token, designId, pages: carousel.pages, fetchImpl: canvaFetch, intervalMs: pollMs }));
  result.designId = designId;
  if (renderOnly) return { ...result, status: 'rendered', exportUrls };

  // 4. Copy images to our own public bucket (Canva links expire), then post.
  const imageUrls = [];
  for (const [i, url] of exportUrls.entries()) {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`Downloading Canva export ${i + 1} failed: HTTP ${res.status}`);
    imageUrls.push(await store.uploadImage(`${key}/${i + 1}.jpg`, Buffer.from(await res.arrayBuffer())));
  }
  // No automatic retry here: a lost response after a successful publish would double-post.
  const mediaId = await ig.publishCarousel({ imageUrls, caption: carousel.caption });

  await store.recordPost({
    key, kind: 'morning', status: 'posted', ig_media_id: mediaId, image_url: imageUrls[0],
    caption: carousel.caption, payload: { pages: carousel.pages, stories: result.stories, board: board.rows.map(({ key: k, value, change }) => ({ k, value, change })), designId },
  });
  return { ...result, status: 'posted', mediaId, imageUrls };
}
