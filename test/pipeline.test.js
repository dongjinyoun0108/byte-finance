import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseChart, fetchBoard, formatValue, formatChange } from '../src/sources/yahoo.js';
import { parseFeed, fetchNews, cleanText } from '../src/sources/news.js';
import { checkStory, bannedHits, wrapLines, longestSharedRun } from '../src/guardrails.js';
import { writeStories } from '../src/writer.js';
import { buildCarousel, boardMood, hashtags, coverHeadline, coverPose, dayIndex, COVER_HEADLINES, COVER_POSES } from '../src/carousel.js';
import { getAccessToken, exportJpgs } from '../src/canva.js';
import { runMorning } from '../src/morning.js';
import { memoryStore } from '../src/store.js';
import { instagram, instagramToken } from '../src/instagram.js';
import { sydney, inWindow, coverDate, clockLabel } from '../src/time.js';
import { BOARD, FEEDS, SLOTS, MOODS, MORNING_WINDOW, ASSETS } from '../src/config.js';
import { alertFor } from '../src/alert.js';
import { NOW, chartJson, fakeWorld, fakeClaude, goodDraft, GOOD_STORIES, RSS_US, RDF_RBA } from './helpers.js';

const ENV = { CANVA_CLIENT_ID: 'cid', CANVA_CLIENT_SECRET: 'csec' };
Object.assign(process.env, ENV);
delete process.env.PAUSED;

// ---------- time ----------
test('time: 7:25am Sydney is in the window in both AEDT and AEST; weekends and other hours are not', () => {
  assert.equal(sydney(NOW).hhmm, '07:25');
  assert.equal(sydney(NOW).tz, 'AEDT');
  assert.ok(inWindow(NOW, MORNING_WINDOW));
  assert.ok(!inWindow(new Date('2026-10-06T21:25:00Z'), MORNING_WINDOW), '8:25am AEDT is outside');
  const winter = new Date('2026-06-09T21:25:00Z'); // Wed 10 June, 7:25am AEST
  assert.equal(sydney(winter).tz, 'AEST');
  assert.ok(inWindow(winter, MORNING_WINDOW));
  assert.ok(!inWindow(new Date('2026-10-09T20:25:00Z'), MORNING_WINDOW), 'Saturday is outside');
  assert.equal(coverDate(NOW), 'Wed 7 October');
  assert.equal(clockLabel(NOW), '7:25am AEDT');
});

// ---------- Yahoo ----------
test('yahoo: change is vs the last close before the latest trading day', () => {
  const q = parseChart(chartJson({ price: 110, prev: 100 }));
  assert.equal(q.prevClose, 100);
  assert.equal(q.price, 110);
  // Only today's bar present -> falls back to chartPreviousClose
  const j = chartJson({ price: 110, prev: 100 });
  j.chart.result[0].timestamp = j.chart.result[0].timestamp.slice(-1);
  j.chart.result[0].indicators.quote[0].close = [110];
  assert.equal(parseChart(j).prevClose, 99);
  assert.throws(() => parseChart({ chart: { result: null, error: { description: 'No data' } } }), /No data/);
});

test('yahoo: formatting matches the board style', () => {
  assert.equal(formatValue(6512.4, 'index2'), '6,512.40');
  assert.equal(formatValue(8915.06, 'index1'), '8,915.1');
  assert.equal(formatValue(84920.4, 'usd0'), 'US$84,920');
  assert.equal(formatValue(71.3, 'usd2'), 'US$71.30');
  assert.equal(formatValue(0.66119, 'uscents'), '66.12 US cents');
  assert.equal(formatChange(0.8412), '↑ +0.84%');
  assert.equal(formatChange(-0.4512), '↓ -0.45%');
  assert.equal(formatChange(-0.001), '↑ +0.00%');
});

test('yahoo: fetchBoard loads all nine rows; failures are reported, not thrown', async () => {
  const w = fakeWorld();
  const b = await fetchBoard(BOARD, { fetchImpl: w.fetchImpl });
  assert.equal(b.rows.length, 9);
  assert.equal(b.missing.length, 0);
  const sp = b.rows.find((r) => r.key === 'sp500');
  assert.equal(sp.value, '6,567.11');
  assert.equal(sp.change, '↑ +0.84%');
  assert.equal(b.rows.find((r) => r.key === 'asx').label, 'ASX 200 (close)');
  assert.equal(b.rows.find((r) => r.key === 'gold').up, false);

  const w2 = fakeWorld({ failSymbols: ['BTC-USD'] });
  const b2 = await fetchBoard(BOARD, { fetchImpl: w2.fetchImpl, retries: 0 });
  assert.equal(b2.rows.length, 8);
  assert.deepEqual(b2.missing.map((m) => m.key), ['btc']);
});

// ---------- news ----------
test('news: parses RSS 2.0 and RDF, decodes entities and CDATA', () => {
  const us = parseFeed(RSS_US);
  assert.equal(us.length, 3);
  assert.equal(us[1].title, 'Fed holds rates steady at 3.75% & signals patience');
  assert.match(us[0].summary, /^Nvidia reported quarterly revenue/);
  const rba = parseFeed(RDF_RBA);
  assert.equal(rba.length, 1);
  assert.equal(rba[0].published, '2026-10-06T03:30:00.000Z');
  assert.equal(cleanText('&lt;b&gt;Hi&lt;/b&gt; &#8217;'), 'Hi ’');
});

test('news: drops stale items, de-duplicates, survives a dead feed', async () => {
  const w = fakeWorld();
  const { items, errors } = await fetchNews(FEEDS, { now: NOW, fetchImpl: w.fetchImpl });
  const titles = items.map((i) => i.title);
  assert.ok(!titles.includes('Old story from last week'));
  assert.equal(titles.filter((t) => t.startsWith('Nvidia')).length, 1);
  assert.ok(titles.some((t) => t.startsWith('Statement by the Monetary Policy Board')));
  assert.equal(errors.length, 1); // the Fed feed returned 503
  assert.deepEqual(items.map((i) => i.id), items.map((_, i) => `n${i + 1}`));
});

// ---------- guardrails ----------
const ITEM = { title: 'BHP agrees $4.1 billion copper deal in Chile', summary: 'BHP will acquire a copper project in Chile for $4.1 billion, the miner said on Tuesday.', source: 'Yahoo Finance' };
const ok = { ...GOOD_STORIES.biz, item_id: 'n1' };
const check = (s, extra) => checkStory(s, { item: ITEM, slot: SLOTS.biz, moods: MOODS, extraNumbers: extra });

test('guardrails: a clean story passes', () => {
  assert.deepEqual(check(ok), []);
});

test('guardrails: advice, predictions, invented numbers, copying, overflow and emoji all fail', () => {
  assert.ok(check({ ...ok, why: 'Time to buy miners before copper will rise.' }).some((e) => e.includes('banned')));
  assert.ok(check({ ...ok, body: 'BHP is paying $5 billion for it.' }).some((e) => e.includes('number not in source: 5')));
  assert.ok(check({ ...ok, why: 'BHP will acquire a copper project in Chile soon.' }).some((e) => e.includes('copies')));
  assert.ok(check({ ...ok, headline: 'BHP Makes An Enormous Copper Acquisition In South America' }).some((e) => e.includes('headline too long')));
  assert.ok(check({ ...ok, headline: 'Extraordinarily Big' }).some((e) => e.includes('word too long')));
  assert.ok(check({ ...ok, body: 'BHP is acquiring a copper project in Chile, which is a huge win for the miner and its many shareholders.' }).some((e) => e.includes('body over')));
  assert.ok(check({ ...ok, headline: 'BHP Goes Big 🚀' }).some((e) => e.includes('unsupported characters')));
  assert.ok(check({ ...ok, tag: 'Crypto' }).some((e) => e.includes('tag must be')));
  assert.ok(check({ ...ok, mood: 'angry' }).some((e) => e.includes('mood must be')));
  assert.ok(check({ ...ok, why: 'Details at www.bhp.com' }).some((e) => e.includes('links')));
  assert.ok(checkStory(ok, { item: undefined, slot: SLOTS.biz, moods: MOODS }).some((e) => e.includes('unknown item_id')));
});

test('guardrails: market words used in news are allowed', () => {
  assert.deepEqual(bannedHits('Tech sell-off drags Nasdaq; investors and shares in focus'), []);
  assert.deepEqual(bannedHits('Fed will cut rates'), ['will cut']);
  assert.deepEqual(wrapLines('RBA Keeps Rates on Hold', 14), ['RBA Keeps', 'Rates on Hold']);
  assert.equal(longestSharedRun('a b c d', 'x a b c y'), 3);
});

test('guardrails: board numbers may be quoted in stories', () => {
  const s = { ...ok, why: 'The ASX 200 dipped 0.20% yesterday.' };
  assert.ok(check(s).some((e) => e.includes('0.20')));
  assert.deepEqual(check(s, [-0.2]), []);
});

// ---------- writer ----------
async function loadNews() {
  const w = fakeWorld();
  const [board, news] = await Promise.all([fetchBoard(BOARD, { fetchImpl: w.fetchImpl }), fetchNews(FEEDS, { now: NOW, fetchImpl: w.fetchImpl })]);
  return { board, items: news.items };
}

test('writer: accepts three clean stories in one round', async () => {
  const { board, items } = await loadNews();
  const claude = fakeClaude([goodDraft]);
  const { stories, log } = await writeStories({ items, board, claude });
  assert.deepEqual(Object.keys(stories).sort(), ['aus', 'biz', 'us']);
  assert.equal(claude.seen.length, 1);
  assert.equal(log[0].round, 1);
  assert.equal(stories.aus.item.source, 'RBA');
});

test('writer: a failing slot gets one fix-up round with the errors; still-bad slots are dropped', async () => {
  const { board, items } = await loadNews();
  const claude = fakeClaude([
    (id) => ({ ...goodDraft(id), us: { ...goodDraft(id).us, body: 'Nvidia made $US99 billion.' }, biz: { ...goodDraft(id).biz, why: 'Investors should buy now.' } }),
    (id) => ({ aus: null, us: goodDraft(id).us, biz: { ...goodDraft(id).biz, why: 'You should buy.' } }),
  ]);
  const { stories, log } = await writeStories({ items, board, claude });
  assert.deepEqual(Object.keys(stories).sort(), ['aus', 'us']);
  assert.equal(claude.seen.length, 2);
  const followUp = claude.seen[1].at(-1).content;
  assert.match(followUp, /us: .*number not in source: 99/);
  assert.match(followUp, /biz: .*banned/);
  assert.ok(log[1].problems.biz);
});

test('writer: the same item cannot fill two slots; bad JSON yields no stories', async () => {
  const { board, items } = await loadNews();
  const dup = fakeClaude([(id) => ({ ...goodDraft(id), biz: { ...goodDraft(id).biz, item_id: goodDraft(id).aus.item_id } }), () => ({ aus: null, us: null, biz: null })]);
  const r = await writeStories({ items, board, claude: dup });
  assert.ok(!r.stories.biz);
  const broken = async () => 'sorry, no';
  const r2 = await writeStories({ items, board, claude: broken });
  assert.deepEqual(r2.stories, {});
});

// ---------- carousel ----------
test('carousel: fills every template field, picks pills and poses, max 5 hashtags', async () => {
  const { board, items } = await loadNews();
  const { stories } = await writeStories({ items, board, claude: fakeClaude([goodDraft]) });
  const c = buildCarousel({ board, stories, now: NOW });
  assert.deepEqual(c.pages, [1, 2, 3, 4, 5, 6]);
  assert.equal(c.data.board_headline.text, 'Wall Street closes higher');
  assert.equal(c.data.sp500_pill.asset_id, ASSETS.pillUp);
  assert.equal(c.data.gold_pill.asset_id, ASSETS.pillDown);
  assert.equal(c.data.us_coin.asset_id, ASSETS.poses.celebrating);
  assert.equal(c.data.date.text, 'Wed 7 October');
  assert.equal(c.data.board_time.text, 'Prices as at 7:25am AEDT  ·  @byte.finance.au');
  assert.match(c.data.aus_body.text, /3\.60 per cent\. Mortgage/);
  assert.match(c.data.cover_headline.text, /\n/);
  assert.ok(c.data.cover_coin.asset_id);
  // all 50 template fields are filled
  assert.equal(Object.keys(c.data).length, 51);
  const tags = c.caption.trim().split('\n').at(-1).split(' ');
  assert.ok(tags.length <= 5 && tags.length >= 3);
  assert.deepEqual(tags.slice(0, 3), ['#AusFinance', '#FinanceNews', '#ShareMarket']);
  assert.match(c.caption, /not financial advice/);
  assert.match(c.caption, /S&P 500 ↑ 0\.84%/);
  assert.match(c.caption, /1\. RBA Keeps Rates on Hold/);
});

test('carousel: board is left out if any row is missing; cover counts the stories', async () => {
  const w = fakeWorld({ failSymbols: ['^DJI'] });
  const board = await fetchBoard(BOARD, { fetchImpl: w.fetchImpl, retries: 0 });
  const stories = { aus: { ...GOOD_STORIES.aus, item: { source: 'RBA' } } };
  const c = buildCarousel({ board, stories, now: NOW });
  assert.deepEqual(c.pages, [1, 3, 6]);
  assert.ok(!/\{n\}|2 |3 /.test(c.data.cover_headline.text), 'no count headlines with 1 story');
  assert.ok(!('sp500_value' in c.data));
  assert.ok(!c.caption.includes('Prices as at'));
});

test('carousel: board mood follows the S&P 500', () => {
  assert.equal(boardMood({ changePct: 1.4 }).headline, 'Wall Street rallies');
  assert.equal(boardMood({ changePct: 0.05 }).pose, 'newspaper');
  assert.equal(boardMood({ changePct: -0.5 }).headline, 'Wall Street closes lower');
  assert.equal(boardMood({ changePct: -2 }).pose, 'shocked');
  assert.deepEqual(hashtags({}), ['#AusFinance', '#FinanceNews', '#ShareMarket', '#ASX200', '#BusinessNews']);
});

// ---------- Canva ----------
test('canva: the new refresh token is saved before the access token is used', async () => {
  const w = fakeWorld();
  const store = memoryStore({ secrets: { canva_refresh_token: 'RT1' } });
  const token = await getAccessToken({ store, fetchImpl: w.fetchImpl });
  assert.equal(token, 'AT');
  assert.equal(await store.getSecret('canva_refresh_token'), 'RT2');
  await assert.rejects(getAccessToken({ store: memoryStore(), fetchImpl: w.fetchImpl }), /canva-auth/);
});

test('canva: export must return one image per page', async () => {
  const bad = async () => ({ ok: true, status: 200, json: async () => ({ job: { id: 'x', status: 'success', urls: ['a'] } }) });
  await assert.rejects(exportJpgs({ token: 't', designId: 'D', pages: [1, 2], fetchImpl: bad }), /1 images for 2 pages/);
});

// ---------- end to end ----------
function deps(world, store, claude = fakeClaude([goodDraft])) {
  return { store, fetchImpl: world.fetchImpl, claude, ig: instagram({ userId: 'IGU', token: 'IGT', fetchImpl: world.fetchImpl, pollMs: 1 }), pollMs: 1 };
}

test('end to end: posts a 6-slide carousel once, then refuses to double-post', async () => {
  const w = fakeWorld();
  const store = memoryStore({ secrets: { canva_refresh_token: 'RT1' } });
  const r = await runMorning({ now: NOW, deps: deps(w, store) });
  assert.equal(r.status, 'posted', JSON.stringify(r));
  assert.equal(r.mediaId, 'IGMEDIA1');
  assert.equal(w.canva.autofillBody.brand_template_id, 'EAHXNvzp9TE');
  assert.deepEqual(w.canva.exportBody.format.pages, [1, 2, 3, 4, 5, 6]);
  assert.equal(store.files.size, 6);
  assert.ok(store.posts.has('morning-2026-10-07'));
  const igPosts = w.calls.filter((c) => /graph\.(facebook|instagram)\.com/.test(c.url) && c.method === 'POST');
  assert.equal(igPosts.length, 6 + 1 + 1); // 6 children, 1 carousel, 1 publish
  assert.equal(alertFor(r), null);

  const again = await runMorning({ now: NOW, deps: deps(w, store) });
  assert.equal(again.status, 'already-posted');
});

test('end to end: outside the window, paused, or nothing to post -> no post', async () => {
  const w = fakeWorld();
  const store = memoryStore({ secrets: { canva_refresh_token: 'RT1' } });
  assert.equal((await runMorning({ now: new Date('2026-10-06T21:25:00Z'), deps: deps(w, store) })).status, 'outside-window');
  process.env.PAUSED = 'true';
  assert.equal((await runMorning({ now: NOW, deps: deps(w, store) })).status, 'paused');
  delete process.env.PAUSED;
  const empty = fakeWorld({ failSymbols: ['^GSPC'], feeds: { us: '<rss></rss>', au: '<rss></rss>', rba: '<rss></rss>' } });
  const r = await runMorning({ now: NOW, deps: deps(empty, store) });
  assert.equal(r.status, 'skipped-no-content');
  assert.match(alertFor(r), /skipped/);
  assert.equal(store.posts.size, 0);
});

test('end to end: a Canva failure throws before anything is posted', async () => {
  const w = fakeWorld({ canvaFail: true });
  const store = memoryStore({ secrets: { canva_refresh_token: 'RT1' } });
  await assert.rejects(runMorning({ now: NOW, deps: deps(w, store) }), /Canva job failed/);
  assert.equal(w.calls.filter((c) => /graph\.(facebook|instagram)\.com/.test(c.url)).length, 0);
  assert.equal(store.posts.size, 0);
});

test('end to end: posts with gaps and flags them', async () => {
  const w = fakeWorld({ failSymbols: ['ETH-USD'] });
  const store = memoryStore({ secrets: { canva_refresh_token: 'RT1' } });
  const claude = fakeClaude([(id) => ({ ...goodDraft(id), biz: null })]);
  const r = await runMorning({ now: NOW, deps: deps(w, store, claude) });
  assert.equal(r.status, 'posted');
  assert.deepEqual(w.canva.exportBody.format.pages, [1, 3, 4, 6]);
  assert.match(alertFor(r), /board left out.*eth.*only 2 of 3/);
});

test('dry run returns slides and caption without touching Canva or Instagram', async () => {
  const w = fakeWorld();
  const r = await runMorning({ now: NOW, force: true, dryRun: true, deps: deps(w, memoryStore()) });
  assert.equal(r.status, 'dry-run');
  assert.ok(r.data.board_headline);
  assert.equal(w.calls.filter((c) => c.url.includes('canva') || /graph\./.test(c.url)).length, 0);
});

test('cover: headline and pose change every posting day and always fit', () => {
  // Mon 12 Oct .. Fri 23 Oct 2026, weekdays only
  const days = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'];
  const idx = days.map(dayIndex);
  for (let i = 1; i < idx.length; i++) assert.equal(idx[i], idx[i - 1] + 1, 'Friday -> Monday counts as the next day');
  const heads = idx.map((i) => coverHeadline(3, i));
  for (let i = 1; i < heads.length; i++) assert.notEqual(heads[i], heads[i - 1]);
  const poses = idx.map((i) => coverPose({ changePct: 0.5 }, i));
  for (let i = 1; i < poses.length; i++) assert.notEqual(poses[i], poses[i - 1]);
  for (let i = 0; i < 12; i++) {
    assert.ok(['wipeout', 'shocked', 'trading_desk', 'umbrella'].includes(coverPose({ changePct: -1.2 }, i)));
    assert.ok(['rocket', 'celebrating', 'surfing', 'padel', 'cricket'].includes(coverPose({ changePct: 1.2 }, i)));
    assert.ok(!['rocket', 'celebrating', 'surfing', 'wipeout', 'shocked'].includes(coverPose({ changePct: 0.05 }, i)));
  }
  for (const pool of Object.values(COVER_POSES)) for (const p of pool) assert.ok(ASSETS.poses[p], `missing asset for ${p}`);
  for (const h of COVER_HEADLINES) {
    const lines = h.text.replace('{n}', '3').split('\n');
    assert.ok(lines.length <= 4, h.text);
    const max = [11, 11, 9, 8];
    lines.forEach((l, i) => assert.ok(l.length <= max[i], `${JSON.stringify(l)} too long`));
  }
});

test('cover: pose never duplicates the board pose', async () => {
  const w = fakeWorld();
  const board = await fetchBoard(BOARD, { fetchImpl: w.fetchImpl });
  for (let d = 0; d < 10; d++) {
    const now = new Date(NOW.getTime() + d * 86400e3);
    const c = buildCarousel({ board, stories: {}, now });
    assert.notEqual(c.data.cover_coin.asset_id, c.data.board_coin.asset_id);
  }
});

test('kangaroo rides along on Aussie dollar stories', async () => {
  const w = fakeWorld();
  const board = await fetchBoard(BOARD, { fetchImpl: w.fetchImpl });
  const stories = { aus: { ...GOOD_STORIES.aus, tag: 'Aussie dollar', item: { source: 'RBA' } } };
  const c = buildCarousel({ board, stories, now: NOW });
  assert.equal(c.data.aus_coin.asset_id, ASSETS.poses.kangaroo);
});

test('caption: hook follows the market and rotates with the CTA', async () => {
  const w = fakeWorld();
  const board = await fetchBoard(BOARD, { fetchImpl: w.fetchImpl });
  const caps = [0, 1, 2].map((d) => buildCarousel({ board, stories: {}, now: new Date(NOW.getTime() + d * 86400e3) }).caption.split('\n'));
  assert.notEqual(caps[0][0], caps[1][0]);
  assert.match(caps[0][0], /📈|🐂|🚀/);
  for (const c of caps) assert.match(c.join('\n'), /not financial advice/);
});

test('no Yahoo credit on slides or caption; official sources still credited', async () => {
  const { board, items } = await loadNews();
  const { stories } = await writeStories({ items, board, claude: fakeClaude([goodDraft]) });
  const c = buildCarousel({ board, stories, now: NOW });
  const allText = Object.values(c.data).filter((v) => v.type === 'text').map((v) => v.text).join(' ') + c.caption;
  assert.ok(!/yahoo/i.test(allText));
  assert.equal(c.data.aus_source.text, 'Source: RBA');
  assert.equal(c.data.us_source.text, '@byte.finance.au');
  assert.match(c.caption, /^.*\nAussie finance news, Wed 7 October/);
});
