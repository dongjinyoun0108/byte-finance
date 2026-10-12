# Morning writer brief (for the scheduled Claude task)

Each Tuesday to Saturday morning you write the three story slides for the Byte Finance carousel. Commit them as
`posts/YYYY-MM-DD/stories.json`, using the Sydney date. The GitHub Action renders and posts them at 7:30am Sydney.
**Push by 7:20am Sydney.** If you can't, push what you have; empty slots are fine.

## 1. Gather candidates (last ~20 hours only)

Don't use WebFetch: it can't reach the feeds in an unattended run. The GitHub workflow "Morning feeds" fetches them
and commits `posts/YYYY-MM-DD/feed.json` (your task prompt says how to start it and wait for it). It holds up to 40
recent items from the RBA, ABC News business, Yahoo Finance AU and US, CNBC and the Federal Reserve, each with
`id`, `source`, `region`, `title`, `summary`, `link` and `published`.

Copy every item you might use into `items` **exactly as feed.json has it** (same id, source, title, summary, link).
The guardrails compare your numbers and wording against these. If feed.json has no items, write all slots as null.

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
