// A fake internet for tests: Yahoo, RSS feeds, Claude, Canva, Instagram, image downloads.

export const NOW = new Date('2026-10-06T20:25:00Z'); // Wed 7 Oct 2026, 7:25am AEDT

const day = (iso) => Math.floor(Date.parse(iso) / 1000);

export function chartJson({ price, prev, tz = 'America/New_York', lastBar = '2026-10-06T13:30:00Z', prevBar = '2026-10-05T13:30:00Z', time = '2026-10-06T20:00:00Z' }) {
  return {
    chart: {
      result: [{
        meta: { regularMarketPrice: price, regularMarketTime: day(time), exchangeTimezoneName: tz, currency: 'USD', chartPreviousClose: prev * 0.99 },
        timestamp: [day('2026-10-02T13:30:00Z'), day(prevBar), day(lastBar)],
        indicators: { quote: [{ close: [prev * 0.98, prev, price] }] },
      }],
      error: null,
    },
  };
}

export const QUOTES = {
  '^GSPC': { price: 6567.11, prev: 6512.4 },
  '^IXIC': { price: 22074.2, prev: 21830.15 },
  '^DJI': { price: 45373.6, prev: 45210.8 },
  '^AXJO': { price: 8897.2, prev: 8915.1, tz: 'Australia/Sydney', lastBar: '2026-10-05T23:00:00Z', prevBar: '2026-10-04T23:00:00Z', time: '2026-10-06T06:10:00Z' },
  'BTC-USD': { price: 86958, prev: 84920, tz: 'UTC', lastBar: '2026-10-06T00:00:00Z', prevBar: '2026-10-05T00:00:00Z', time: '2026-10-06T20:24:00Z' },
  'ETH-USD': { price: 3267.8, prev: 3210, tz: 'UTC', lastBar: '2026-10-06T00:00:00Z', prevBar: '2026-10-05T00:00:00Z', time: '2026-10-06T20:24:00Z' },
  'AUDUSD=X': { price: 0.66219, prev: 0.6612, tz: 'Europe/London', lastBar: '2026-10-06T00:00:00Z', prevBar: '2026-10-05T00:00:00Z', time: '2026-10-06T20:20:00Z' },
  'GC=F': { price: 3386.7, prev: 3402 },
  'BZ=F': { price: 70.52, prev: 71.3 },
};

export const RSS_US = `<?xml version="1.0"?><rss version="2.0"><channel><title>Yahoo</title>
<item><title>Nvidia shares jump 4% after record data-centre sales</title><link>https://example.test/nvda</link>
<description><![CDATA[Nvidia reported quarterly revenue of $US57 billion, up 62% from a year earlier, driven by data-centre chips.]]></description>
<pubDate>Tue, 06 Oct 2026 21:05:00 GMT</pubDate></item>
<item><title>Fed holds rates steady at 3.75% &amp; signals patience</title><link>https://example.test/fed</link>
<description>The Federal Reserve kept its benchmark rate at 3.75% on Tuesday.</description>
<pubDate>Tue, 06 Oct 2026 18:00:00 GMT</pubDate></item>
<item><title>Old story from last week</title><link>https://example.test/old</link><description>Stale.</description>
<pubDate>Tue, 29 Sep 2026 18:00:00 GMT</pubDate></item>
</channel></rss>`;

export const RSS_AU = `<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>BHP agrees $4.1 billion copper deal in Chile</title><link>https://example.test/bhp</link>
<description>BHP will acquire a copper project in Chile for $4.1 billion, the miner said on Tuesday.</description>
<pubDate>Tue, 06 Oct 2026 08:00:00 GMT</pubDate></item>
<item><title>Nvidia shares jump 4% after record data-centre sales</title><link>https://example.test/nvda-dup</link><description>dup</description>
<pubDate>Tue, 06 Oct 2026 21:05:00 GMT</pubDate></item>
</channel></rss>`;

export const RDF_RBA = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<item rdf:about="https://www.rba.gov.au/media-releases/2026/mr-26-29.html">
<title>Statement by the Monetary Policy Board: Monetary Policy Decision</title>
<link>https://www.rba.gov.au/media-releases/2026/mr-26-29.html</link>
<description>At its meeting today, the Board decided to leave the cash rate target unchanged at 3.60 per cent.</description>
<dc:date>2026-10-06T14:30:00+11:00</dc:date></item></rdf:RDF>`;

export const GOOD_STORIES = {
  aus: { item_id: null, tag: 'Interest rates', headline: 'RBA Keeps Rates on Hold', body: 'The Reserve Bank left the cash rate target at 3.60 per cent.', why: 'Mortgage repayments stay where they are for now.', mood: 'coffee' },
  us: { item_id: null, tag: 'Tech', headline: 'Nvidia Surges on Chip Boom', body: 'Nvidia’s revenue hit $US57 billion, 62% higher than a year ago.', why: 'Chip demand is a key driver of global tech share prices.', mood: 'celebrating' },
  biz: { item_id: null, tag: 'Mining', headline: 'BHP Bets $4.1b on Copper', body: 'BHP is acquiring a Chilean copper project.', why: 'The deal adds to BHP’s copper exposure.', mood: 'finger_gun' },
};

/** Returns { fetchImpl, calls, canva } — a router over every external URL the pipeline touches. */
export function fakeWorld({ failSymbols = [], feeds = {}, canvaFail = false } = {}) {
  const calls = [];
  const canva = { autofillBody: null, exportBody: null, tokens: [] };
  let n = 0;
  const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
  const text = (body, status = 200) => ({ ok: status < 400, status, text: async () => body, json: async () => JSON.parse(body) });

  async function fetchImpl(url, opts = {}) {
    url = String(url);
    calls.push({ url, method: opts.method || 'GET' });
    if (url.includes('query1.finance.yahoo.com')) {
      const sym = decodeURIComponent(url.split('/chart/')[1].split('?')[0]);
      if (failSymbols.includes(sym)) return json({}, 500);
      return json(chartJson(QUOTES[sym]));
    }
    if (url.includes('feeds.finance.yahoo.com') && url.includes('region=US')) return text(feeds.us ?? RSS_US);
    if (url.includes('feeds.finance.yahoo.com') && url.includes('region=AU')) return text(feeds.au ?? RSS_AU);
    if (url.includes('rssindex') || url.includes('abc.net.au') || url.includes('cnbc.com')) return text('<rss><channel></channel></rss>');
    if (url.includes('rba.gov.au')) return text(feeds.rba ?? RDF_RBA);
    if (url.includes('federalreserve.gov')) return text('nope', 503);
    if (url === 'https://api.canva.com/rest/v1/oauth/token') {
      const body = new URLSearchParams(opts.body);
      canva.tokens.push(body.get('refresh_token'));
      return json({ access_token: 'AT', refresh_token: `RT${canva.tokens.length + 1}`, expires_in: 14400 });
    }
    if (url === 'https://api.canva.com/rest/v1/autofills') {
      canva.autofillBody = JSON.parse(opts.body);
      return json({ job: { id: 'af1', status: 'in_progress' } });
    }
    if (url.endsWith('/autofills/af1')) {
      if (canvaFail) return json({ job: { id: 'af1', status: 'failed', error: { code: 'autofill_error', message: 'boom' } } });
      return json({ job: { id: 'af1', status: 'success', result: { type: 'create_design', design: { id: 'DESIGN1' } } } });
    }
    if (url === 'https://api.canva.com/rest/v1/exports') {
      canva.exportBody = JSON.parse(opts.body);
      return json({ job: { id: 'ex1', status: 'in_progress' } });
    }
    if (url.endsWith('/exports/ex1')) {
      return json({ job: { id: 'ex1', status: 'success', urls: canva.exportBody.format.pages.map((p) => `https://export.canva.test/p${p}.jpg`) } });
    }
    if (url.startsWith('https://export.canva.test/')) return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff]).buffer };
    if (url.includes('graph.instagram.com/refresh_access_token')) return json({ access_token: 'IGT2', expires_in: 5184000 });
    if (url.includes('graph.facebook.com') || url.includes('graph.instagram.com')) {
      if ((opts.method || 'GET') === 'GET') return json({ status_code: 'FINISHED' });
      const body = new URLSearchParams(opts.body);
      if (url.endsWith('/media_publish')) return json({ id: 'IGMEDIA1' });
      return json({ id: `C${++n}`, _body: Object.fromEntries(body) });
    }
    throw new Error(`unexpected fetch ${url}`);
  }
  return { fetchImpl, calls, canva };
}

/** A fake Claude that answers with the given slot objects, filling item ids by matching titles. */
export function fakeClaude(script) {
  const seen = [];
  const fn = async (messages) => {
    seen.push(messages.map((m) => ({ ...m })));
    const step = script[Math.min(seen.length - 1, script.length - 1)];
    const material = JSON.parse(messages[0].content.split('\n').slice(1).join('\n'));
    const idFor = (word) => material.candidates.find((c) => c.title.includes(word))?.id;
    const out = typeof step === 'function' ? step(idFor) : step;
    return JSON.stringify(out);
  };
  fn.seen = seen;
  return fn;
}

export function goodDraft(idFor) {
  return {
    aus: { ...GOOD_STORIES.aus, item_id: idFor('Monetary Policy') },
    us: { ...GOOD_STORIES.us, item_id: idFor('Nvidia') },
    biz: { ...GOOD_STORIES.biz, item_id: idFor('BHP') },
  };
}
