# Monthly brief: weekend "Money explained" lessons

Once a month, add **8 new lessons** (4 weeks × Sun + Mon) to the end of `content/explainers.json`.
The weekend job posts lessons in order, so never reorder or edit the existing ones. Only append.

## Picking topics

1. Read every `id` in `src/explainers.js` (TOPICS) and `content/explainers.json`. Never repeat or near-repeat a topic.
2. Pick evergreen Australian money basics that a 20–40 year old would google. Mix the areas:
   - **Tax and pay:** tax brackets, Medicare levy, payslips, salary sacrifice, tax returns
   - **Home:** LMI, stamp duty, fixed vs variable rates, comparison rates, first home schemes
   - **Markets:** what dividends are, market cap, bull vs bear markets, P/E ratio, ASX trading hours
   - **Economy:** GDP, unemployment rate, wage price index, recession, the budget
   - **Everyday money:** HECS-HELP, BNPL, term deposits, savings account rates, credit cards
3. Avoid topics that are mainly political, like negative gearing. If you cover one, report both sides neutrally or skip it.

## Facts: verify before you write

- Every number or rule must be checked this month against an official source with WebSearch/WebFetch:
  - ato.gov.au
  - rba.gov.au
  - moneysmart.gov.au
  - abs.gov.au
  - asx.com.au
  - servicesaustralia.gov.au
  - studyassist.gov.au
- If you can't confirm a figure, leave it out.
- Prefer rules that don't change often. When a figure does change (thresholds, rates), say when it applies, e.g. "for 2026–27".

## Writing rules (same voice as the existing lessons)

- **General information only.** Explain how something works. Never tell the reader what to do with their money.
- **Banned words** (an automated check fails the build on them): buy, sell, should, must, recommend, advice, invest/investing, opportunity, forecast, predict, guarantee, bargain, "time to", "your money", "your portfolio", "your super", "will rise/fall".
- `title`: the question or topic, 1–2 lines split with `\n`, each line at most 24 characters.
- Exactly 4 `steps`, each with:
  - `head`: at most 26 characters
  - `body`: one or two plain sentences, at most 130 characters
  - optionally a `figure` (at most 8 characters, e.g. "18%", "$45,000") with a `figureLabel` (at most 34 characters)
- `pose`: one of coffee, newspaper, celebrating, finger_gun, shocked, worried, thinking, umbrella, rocket, kangaroo, surfing, bbq, cricket, padel, run_club, cbd_strut, performative, quarter_zip, trading_desk, wipeout. Pick one that fits the topic.
- `tags`: exactly 2 specific hashtags, e.g. "#HomeLoans", "#Tax". No spaces or punctuation.
- Plain text: no emoji, links or @mentions. Use Australian spelling.

## Shape (append objects to the JSON array)

```json
{
  "id": "medicare-levy",
  "title": "What is the\nMedicare levy?",
  "pose": "thinking",
  "tags": ["#Tax", "#AusFinance"],
  "steps": [
    { "head": "...", "body": "..." },
    { "head": "...", "figure": "2%", "figureLabel": "...", "body": "..." },
    { "head": "...", "body": "..." },
    { "head": "...", "body": "..." }
  ]
}
```

## The Reel diagram for each lesson (`content/lesson-visuals.json`)

Every lesson also becomes a 32-second Reel: one diagram on a 1000 x 800 canvas that builds step by step while a
camera frames each step. Add one entry per new lesson, keyed by the lesson `id`. Use `"type": "flow"`:

- `field`: background, one of "#C9DDF1" "#DDD6F3" "#CFE8D8" "#C8DAF2" "#F3D5CE" "#F4E2A2" (vary it from the last few lessons).
- `endPose`: the coin pose for step 4 (same list as `pose`).
- `nodes`: `{ id: { x, y, label, sub?, w?, tone? } }`. `x`,`y` are the box centre. Default width 300; height is
  110 (150 with a `sub`). `label` at most 26 characters, `sub` at most 34. `tone`: paper (default), ink, gold, blue,
  red, mint. Keep boxes inside the canvas and at least 16px apart. Use words only: every number on screen must come
  from the lesson's own `figure`s.
- Proportion bars: `{ kind: "bar", x, y, w, label, max?, slices: [{ from?, pct, tone?, label?, step? }], marker?: { pct, label, step? } }`.
  `step` (1-4) delays a slice or marker until that step. Only use percentages the lesson itself states.
- `edges`: `[{ id, from, to, label?, bend?, both?, dashed? }]`. Arrows draw themselves; `label` at most 24 characters.
  Leave out the label when the two boxes are close together.
- `steps`: exactly 4, matching the lesson's steps: `{ show: [node and edge ids, in order], flow: [edge ids that get
  travelling coins], focus: [node ids the camera frames], badge?: nodeId, badgeSide?: right|left|above|below,
  highlight?: [ids], wobble?: [ids], dim?: true }`.
  A step whose lesson step has a `figure` must have a `badge` (the box the figure belongs to). Every node and edge
  must be shown in some step.

Look at existing entries (e.g. `cash-rate`, `super`, `inflation`) for the style: 4–7 boxes, short labels, money
moving along arrows, the camera moving in on what each step is about.

## Check, then push

```bash
node --test test/weekend.test.js test/lesson-visuals.test.js
```

Fix anything it reports (for a badge that covers a box, set `badgeSide`). Then commit only
`content/explainers.json` and `content/lesson-visuals.json` and push to `main`.
