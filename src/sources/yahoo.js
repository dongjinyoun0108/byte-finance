// Market data adapter: Yahoo Finance chart endpoint (no key needed).
// Swap this file for a licensed feed later; the rest of the pipeline only sees { price, prevClose, asOf }.

const UA = 'Mozilla/5.0 (compatible; MorningCoin/2.0)';

function dayIn(tsSeconds, tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(tsSeconds * 1000));
}

/**
 * Parse /v8/finance/chart?range=1mo&interval=1d.
 * Change is measured against the last daily close *before* the trading day of the latest price.
 */
export function parseChart(json) {
  const r = json?.chart?.result?.[0];
  if (!r || json?.chart?.error) throw new Error(`no chart result${json?.chart?.error ? `: ${json.chart.error.description}` : ''}`);
  const meta = r.meta || {};
  const price = Number(meta.regularMarketPrice);
  const asOf = Number(meta.regularMarketTime);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(asOf)) throw new Error('missing price');
  const tz = meta.exchangeTimezoneName;
  const today = dayIn(asOf, tz);
  const ts = r.timestamp || [];
  const closes = r.indicators?.quote?.[0]?.close || [];
  let prevClose;
  for (let i = ts.length - 1; i >= 0; i--) {
    if (closes[i] == null) continue;
    if (dayIn(ts[i], tz) < today) { prevClose = Number(closes[i]); break; }
  }
  if (!Number.isFinite(prevClose)) prevClose = Number(meta.chartPreviousClose ?? meta.previousClose);
  if (!Number.isFinite(prevClose) || prevClose <= 0) throw new Error('missing previous close');
  const spark = closes.filter((c) => c != null).map(Number);
  if (spark.length && spark[spark.length - 1] !== price) spark.push(price);
  return { price, prevClose, asOf: new Date(asOf * 1000).toISOString(), currency: meta.currency, spark: spark.length >= 2 ? spark : [prevClose, price] };
}

export async function fetchQuote(symbol, { fetchImpl = fetch } = {}) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;
  const res = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Yahoo ${symbol} HTTP ${res.status}`);
  return parseChart(await res.json());
}

const LABELS = { sp500: 'S&P 500', nasdaq: 'Nasdaq', dow: 'Dow Jones', asx: 'ASX 200', btc: 'Bitcoin', eth: 'Ethereum', aud: 'AUD/USD', gold: 'Gold', oil: 'Oil (Brent)' };

export function formatValue(price, format) {
  const n = (d) => price.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  switch (format) {
    case 'index2': return n(2);
    case 'index1': return n(1);
    case 'usd0': return `US$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    case 'usd2': return `US$${n(2)}`;
    case 'uscents': return `${(price * 100).toFixed(2)} US cents`;
    default: return n(2);
  }
}

export function formatChange(pct) {
  const r = Math.round(pct * 100) / 100;
  return r >= 0 ? `↑ +${r.toFixed(2)}%` : `↓ ${r.toFixed(2)}%`;
}

/** Fetch every row (in parallel, one retry each). Rows that fail are reported in `missing`. */
export async function fetchBoard(rows, { fetchImpl = fetch, retries = 1 } = {}) {
  const results = await Promise.all(rows.map(async (row) => {
    const symbol = typeof row.symbol === 'function' ? row.symbol() : row.symbol;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const q = await fetchQuote(symbol, { fetchImpl });
        const changePct = ((q.price - q.prevClose) / q.prevClose) * 100;
        if (Math.abs(changePct) > 25) throw new Error(`implausible move ${changePct.toFixed(1)}%`); // bad tick guard
        return {
          key: row.key, symbol, label: (typeof row.label === 'function' ? row.label() : row.label) || LABELS[row.key],
          ...q, changePct, up: Math.round(changePct * 100) / 100 >= 0,
          value: formatValue(q.price, row.format), change: formatChange(changePct),
        };
      } catch (e) {
        if (attempt === retries) return { key: row.key, symbol, error: String(e.message || e) };
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }));
  return { rows: results.filter((r) => !r.error), missing: results.filter((r) => r.error) };
}
