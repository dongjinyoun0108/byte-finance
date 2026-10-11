// Headline gathering from RSS / RDF feeds. We keep title + short summary + link only,
// and the writer must rephrase them in its own words.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…' };

export function cleanText(s = '') {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/<[^>]+>/g, ' ') // tags that were entity-encoded
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? cleanText(m[1]) : '';
}

/** Parse RSS 2.0 or RSS 1.0 (RDF) into [{ title, summary, link, published }]. */
export function parseFeed(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const b = m[1];
    const title = tag(b, 'title');
    if (!title) continue;
    const dateText = tag(b, 'pubDate') || tag(b, 'dc:date') || tag(b, 'published') || tag(b, 'updated');
    const published = dateText ? new Date(dateText) : null;
    items.push({
      title,
      summary: tag(b, 'description').slice(0, 600),
      link: tag(b, 'link'),
      published: published && !Number.isNaN(published.getTime()) ? published.toISOString() : null,
    });
  }
  return items;
}

const norm = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

/** Fetch all feeds, keep recent items, de-duplicate by title. Failed feeds are skipped. */
export async function fetchNews(feeds, { now = new Date(), maxAgeHours = 20, fetchImpl = fetch, perFeed = 15 } = {}) {
  const errors = [];
  const lists = await Promise.all(feeds.map(async (f) => {
    try {
      const res = await fetchImpl(f.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MorningCoin/2.0)', Accept: 'application/rss+xml, application/xml, text/xml' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseFeed(await res.text()).slice(0, perFeed).map((it) => ({ ...it, source: f.name, region: f.region }));
    } catch (e) {
      errors.push({ feed: f.url, error: String(e.message || e) });
      return [];
    }
  }));
  const cutoff = now.getTime() - maxAgeHours * 3600e3;
  const seen = new Set();
  const items = [];
  for (const it of lists.flat()) {
    if (it.published && (Date.parse(it.published) < cutoff || Date.parse(it.published) > now.getTime() + 3600e3)) continue;
    if (!it.published && it.source !== 'Yahoo Finance') continue; // undated official items could be old
    const k = norm(it.title);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    items.push(it);
  }
  items.sort((a, b) => (Date.parse(b.published || 0) || 0) - (Date.parse(a.published || 0) || 0));
  return { items: items.slice(0, 40).map((it, i) => ({ id: `n${i + 1}`, ...it })), errors };
}
