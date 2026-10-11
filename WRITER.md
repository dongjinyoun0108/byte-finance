# Morning writer brief (for the scheduled Claude task)

Each Tuesday to Saturday morning you write the three story slides for the Byte Finance carousel. Commit them as
`posts/YYYY-MM-DD/stories.json`, using the Sydney date. The GitHub Action renders and posts them at 7:30am Sydney.
**Push by 7:20am Sydney.** If you can't, push what you have; empty slots are fine.

## 1. Gather candidates (last ~20 hours only)

Use WebFetch on these feeds. Ask for each item's title, short summary, link and publish time:

- https://www.rba.gov.au/rss/rss-cb-media-releases.xml (RBA)
- https://www.abc.net.au/news/feed/51892/rss.xml (ABC News business)
- https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EAXJO,BHP.AX,CBA.AX,CSL.AX,WES.AX&region=AU&lang=en-AU (Yahoo Finance AU)
- https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC,%5EIXIC,%5EDJI,NVDA,AAPL,MSFT&region=US&lang=en-US (Yahoo Finance US)
- https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147 (CNBC)
- https://www.federalreserve.gov/feeds/press_all.xml (Federal Reserve)

Record each candidate you might use in `items`, with the title and summary **exactly as the feed gives them**. The guardrails compare your numbers and wording against these.

## 2. Pick one story per slot (or null)

- `aus`: Australian economy, RBA, ASX, Aussie dollar, property or jobs. Tag: one of Interest rates, Economy, Aussie dollar, ASX, Property, Jobs, Inflation
- `us`: US markets, the Fed, US economy, big tech, crypto or commodities. Tag: one of Wall Street, Fed, Tech, US economy, Crypto, Commodities
- `biz`: a big company story (earnings, deals, layoffs, launches). Tag: one of Big business, Earnings, Deals, Banks, Mining, Tech, Retail

Prefer hard news (decisions, data, results, deals) over opinion, previews or listicles. Never use the same item twice.

## 3. Write. Tone: AFR front page, in plain English a busy person gets in 3 seconds

- Use ONLY facts in the item's title and summary. No added numbers, dates, causes or quotes.
- Use your own words. Never copy 6 or more words in a row from the source.
- Report, don't advise or predict. Banned: buy, sell, should, must, recommend, advice, invest, opportunity, forecast, predict, bargain, "will rise/fall", "time to".
- `headline`: Title Case, at most 3 lines of 13 characters each, no word over 13 letters.
- `body`: one sentence on what happened, max 90 characters.
- `why`: one sentence on why it matters to Australians, factual, max 80 characters.
- `figure`: the key number from the source, short (e.g. "3.60%", "$4.1b", "+62%"), max 7 characters, or null. `figure_label` (max 30 characters) says what the figure is.
- `mood`: one of coffee, newspaper, celebrating, finger_gun, shocked, worried, thinking, umbrella.
- Plain text only: no emoji, links, @mentions or hashtags.

## 4. File shape

```json
{
  "items": [{ "id": "a1", "source": "RBA", "title": "...", "summary": "...", "link": "https://..." }],
  "aus": { "item_id": "a1", "tag": "Interest rates", "headline": "...", "body": "...", "why": "...", "figure": "3.60%", "figure_label": "Cash rate, unchanged", "mood": "thinking" },
  "us": null,
  "biz": null
}
```

Use `source` "RBA" or "Federal Reserve" for those two feeds. The slide credits those two by name and nothing else.

## 5. Check, then push

```bash
node scripts/check-stories.js posts/YYYY-MM-DD/stories.json
```

Fix every problem it prints, or set that slot to null. Then commit only that file and push to `main`.
