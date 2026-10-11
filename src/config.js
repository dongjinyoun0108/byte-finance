// Everything you might want to tweak lives here: what's on the board, which feeds we read,
// which Canva assets are used, and how much text fits in each slot of the template.

export const TZ = 'Australia/Sydney';

// Canva brand template for the Byte Finance daily carousel.
export const MORNING_TEMPLATE_ID = () => process.env.CANVA_MORNING_TEMPLATE_ID || 'EAHXNvzp9TE';

// Page numbers inside the template.
export const PAGES = { cover: 1, board: 2, aus: 3, us: 4, biz: 5, outro: 6 };

// Canva asset IDs (all in your Canva account).
export const ASSETS = {
  pillUp: 'MAHXNT4DFdc', // green pill
  pillDown: 'MAHXNT_MFX4', // red pill
  poses: {
    coffee: 'MAHXNRGN4Gs',
    newspaper: 'MAHXNQHzTGU',
    celebrating: 'MAHXNTij1uI',
    finger_gun: 'MAHXNTbSTBQ',
    shocked: 'MAHXNSpWUhQ',
    worried: 'MAHXNdP-zIY',
    // Extra poses used for cover variety and special cases (not offered to the story writer)
    bbq: 'MAHXOpp8aQM',
    surfing: 'MAHXOr1cQxk',
    cricket: 'MAHXOpvs_cs',
    wipeout: 'MAHXOq3B1qE',
    umbrella: 'MAHXOjjLGV0',
    rocket: 'MAHXOpv0FTY',
    thinking: 'MAHXOoUksbY',
    kangaroo: 'MAHXOmtGHOw',
    // Finance-culture poses (no real brand logos)
    quarter_zip: 'MAHXOhB8ZDQ', // quarter-zip + puffer vest, iced long black
    cbd_strut: 'MAHXOrHcX9k', // business shirt, chinos, tan leather Chelsea boots
    performative: 'MAHXOtwx-6s', // matcha, tote bag, wired earphones
    trading_desk: 'MAHXOk6_BeM',
    padel: 'MAHXOjnX-yI',
    run_club: 'MAHXOs_eSjQ',
  },
};
// Moods the story writer may choose from.
export const MOODS = ['coffee', 'newspaper', 'celebrating', 'finger_gun', 'shocked', 'worried', 'thinking', 'umbrella'];

// Markets board. `format` controls how the price is printed.
// Yahoo symbols are swappable: point these at a licensed feed later without touching anything else.
export const BOARD = [
  { key: 'sp500', symbol: '^GSPC', format: 'index2' },
  { key: 'nasdaq', symbol: '^IXIC', format: 'index2' },
  { key: 'dow', symbol: '^DJI', format: 'index2' },
  { key: 'asx', symbol: () => process.env.ASX_SYMBOL || '^AXJO', format: 'index1', label: () => process.env.ASX_LABEL || 'ASX 200 (close)' },
  { key: 'btc', symbol: 'BTC-USD', format: 'usd0' },
  { key: 'eth', symbol: 'ETH-USD', format: 'usd0' },
  { key: 'aud', symbol: 'AUDUSD=X', format: 'uscents' },
  { key: 'gold', symbol: 'GC=F', format: 'usd0' },
  { key: 'oil', symbol: 'BZ=F', format: 'usd2' },
];

// News feeds. Each item is summarised in our own words; nothing is copied.
export const FEEDS = [
  { name: 'Yahoo Finance', region: 'us', url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC,%5EIXIC,%5EDJI,NVDA,AAPL,MSFT&region=US&lang=en-US' },
  { name: 'Yahoo Finance', region: 'aus', url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EAXJO,BHP.AX,CBA.AX,CSL.AX,WES.AX&region=AU&lang=en-AU' },
  { name: 'ABC News', region: 'aus', url: 'https://www.abc.net.au/news/feed/51892/rss.xml' },
  { name: 'CNBC', region: 'us', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147' },
  { name: 'RBA', region: 'aus', url: 'https://www.rba.gov.au/rss/rss-cb-media-releases.xml' },
  { name: 'Federal Reserve', region: 'us', url: 'https://www.federalreserve.gov/feeds/press_all.xml' },
];

// The three story slides. Limits are measured against the real template so text never overflows:
// cpl = characters per headline line, lines = max headline lines, body/why = max characters.
export const SLOTS = {
  aus: {
    page: 3,
    label: 'Australian economy, RBA, ASX, Aussie dollar, property or jobs',
    tags: ['Interest rates', 'Economy', 'Aussie dollar', 'ASX', 'Property', 'Jobs', 'Inflation'],
    cpl: 13, lines: 3, body: 90, why: 80,
  },
  us: {
    page: 4,
    label: 'US markets, the Fed, US economy, big tech, crypto or commodities',
    tags: ['Wall Street', 'Fed', 'Tech', 'US economy', 'Crypto', 'Commodities'],
    cpl: 13, lines: 3, body: 90, why: 80,
  },
  biz: {
    page: 5,
    label: 'A big company story (earnings, deals, layoffs, launches) from anywhere',
    tags: ['Big business', 'Earnings', 'Deals', 'Banks', 'Mining', 'Tech', 'Retail'],
    cpl: 13, lines: 3, body: 90, why: 80,
  },
};

// Hashtags: Instagram allows at most 5 per post (since Dec 2025), and says fewer, targeted tags beat generic ones.
// Post counts (Oct 2026) in brackets. Slots: community + format + market, then up to two tags from today's news.
export const MAX_HASHTAGS = 5;
export const BASE_HASHTAGS = ['#AusFinance', '#FinanceNews', '#ShareMarket']; // 18k niche community, 351k news format, 5.4m Aussie market term
export const FILLER_HASHTAGS = ['#ASX200', '#BusinessNews', '#AustralianEconomy']; // used when there are fewer stories
export const TAG_HASHTAGS = {
  'Interest rates': '#RBA', Economy: '#AustralianEconomy', 'Aussie dollar': '#AustralianEconomy', ASX: '#ASX200', Property: '#AustralianProperty',
  Jobs: '#AustralianEconomy', Inflation: '#Inflation', 'Wall Street': '#WallStreet', Fed: '#FederalReserve',
  Tech: '#TechStocks', 'US economy': '#Economics', Crypto: '#BitcoinNews', Commodities: '#Commodities',
  'Big business': '#BusinessNews', Earnings: '#Earnings', Deals: '#BusinessNews', Banks: '#Banking', Mining: '#Mining', Retail: '#Retail',
};
// Biggest overnight mover -> tag (used when a story slot is empty)
export const MOVER_HASHTAGS = { btc: '#BitcoinNews', eth: '#Ethereum', asx: '#ASX200', oil: '#OilPrice', gold: '#Commodities', sp500: '#WallStreet', nasdaq: '#TechStocks', dow: '#WallStreet', aud: '#AustralianEconomy' };

export const DISCLAIMER =
  'General information only, not financial advice. It doesn’t consider your objectives, financial situation or needs.';

// Posting window (Sydney time). The trigger fires at 7:25am AEDT and 7:25am AEST (two UTC times);
// only the one that lands inside this window does anything, so daylight saving is handled.
export const MORNING_WINDOW = { from: '07:10', to: '07:50', weekdays: [1, 2, 3, 4, 5] };

// Daily Reel (Tue-Sat): rendered from the same data as the carousel, posted a few minutes after it.
export const REEL = {
  enabled: true,
  at: '07:35',                 // Sydney time
  music: process.env.REEL_MUSIC || 'morning-desk', // render/assets/audio/music/<name>.wav
  shareToFeed: false,          // Reels tab only; keeps the profile grid to carousels
  dir: 'reels/daily-news',
  lessonDir: 'reels/lesson',   // Sun + Mon: living-diagram lesson Reels (topics listed in content/lesson-visuals.json)
  lessonMusic: process.env.REEL_LESSON_MUSIC || 'sunday-paper',
  hyperframes: '0.8.147',
};
