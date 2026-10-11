# Byte Finance (@byte.finance.au)

A daily Instagram carousel for Australian finance news. It posts at **7:30am Sydney time, Monday to Friday**, and nobody needs to approve it.

## How a day runs (`.github/workflows/daily.yml`)

1. GitHub Actions starts at about 6:50am and waits until 7:25am.
2. Prices come from Yahoo Finance and headlines from the Yahoo, RBA and Fed feeds.
3. Stories come from `posts/YYYY-MM-DD/stories.json`, which a scheduled Claude task writes and commits at about 6:45am (brief: `WRITER.md`). This uses your Claude plan, so there's no API fee. If an `ANTHROPIC_API_KEY` secret is set, the job can also write stories itself when that file is missing. With neither, it posts cover + markets board + outro.
4. Every story passes `src/guardrails.js` or it's dropped:
   - no numbers that aren't in the source
   - no advice or prediction wording
   - no copied phrases
   - text must fit its box
5. The slides are rendered in code (`render/slides.js`) and committed to `posts/YYYY-MM-DD/`. Instagram fetches them from their public GitHub link.
6. At 7:30am the carousel is published through the official Instagram API. `posts/YYYY-MM-DD/posted.json` records the post, so it never posts twice.

The slides are 1080x1440 (3:4). The job also saves a 4:5 copy of each slide. If Instagram rejects 3:4, it posts the 4:5 copies instead.

## Secrets (repo Settings → Secrets and variables → Actions)

| Name | What |
|---|---|
| `IG_ACCESS_TOKEN` | Instagram long-lived token (from the Meta app, "Instagram API with Instagram Login"). The job refreshes it weekly and stores the new one encrypted in `state/ig-token.enc`. |
| `ANTHROPIC_API_KEY` | Optional backup writer (Claude Haiku, about a cent a day) for days the scheduled writer misses. |

To pause posting, add a repository variable `PAUSED` = `true`.

## Manual runs

Open Actions → Daily carousel → Run workflow:

- `dry` renders the slides as a downloadable artifact and posts nothing.
- `force` posts immediately.

## Motion version (saved for later)

- `render/actors.js` holds a signature move for each of the 20 coin poses.
- `render/assets/audio` holds the original 112 BPM theme.
- `scripts/design-preview.js --video` and `scripts/pose-reel.js --video` render the animated slides with music.
