---
format: 1080x1920
duration: 28s
message: "Everything that moved overnight, in 30 seconds"
arc: Hook (biggest mover) → Markets → 3 stories → Follow
audience: Aussie 20–40s on the morning commute
mode: collaborative
---

## Decisions

- **Spine:** one continuous pastel "morning desk" world. The camera never cuts to a new slide; it flies (3D push, whip-pan
  with motion blur, always leftward) from station to station, so the whole Reel reads as one move. The gold coin is the host
  and turns up at every station in the pose for that story.
- **Format:** 9:16, ~28s, music only (theme, 112 BPM), cuts on the beat. Key content inside the Reels safe zone
  (top 260px and bottom 420px kept clear, right 140px clear of the button rail).
- **Data-driven:** every word and number comes from the day's JSON (same as the carousel). Layouts must hold for long and
  short headlines, up/down markets, stories with and without a key figure.
- **Bans:** no slideshow (no card-after-card wipes), no screensaver motion, no glow/gradients, no bounce on text,
  no invented numbers or charts not backed by the data.
- **Held frame:** the hero number in frame 01 holds still for ~0.6s after it lands.

## Frame 1 — Hook: "Bitcoin up 2.4% while you slept"

- duration: 3.2s (0.0–3.2)
- blueprint: ticker-takeover
- src: compositions/01-hook.html
- status: outline
- transition_in: cut
- scene: "Overnight," types in; the market name rolls like a slot machine (S&P 500 → Nasdaq → ASX 200) and locks on the biggest mover; "+2.4%" crashes in and shoves the line up; coffee coin slides in from the right.

Hook in outcome language: what moved while you slept. Number-wheel digits on the %.

## Frame 2 — Markets board

- duration: 5.4s (3.2–8.6)
- blueprint: grid-card-assemble (+ camera pull-back)
- src: compositions/02-board.html
- status: outline
- transition_in: whip-pan left
- scene: 9 ticker cards (S&P 500, Nasdaq, Dow, ASX 200, Bitcoin, Ethereum, AUD/USD, Gold, Oil) cascade into a tilted 3×3 grid; each price rolls on a number wheel, its sparkline draws, its green/red chip snaps on; the camera pulls back to show the whole board, then pushes onto the biggest mover's card.

Proof of the hook: the full overnight picture at a glance.

## Frame 3 — Story 1 (Aus): phone notification dive

- duration: 5.4s (8.6–14.0)
- blueprint: device-surface-showcase → parallax-device-dive
- src: compositions/03-story.html
- status: outline
- transition_in: whip-pan left
- scene: the coin holds up a phone; a news notification drops in ("Interest rates · RBA Leaves Rates On Hold"); the camera pushes through the screen into the story: tag, headline, big figure counting up ("3.60%"), one-line why.

## Frame 4 — Story 2 (US): data hero

- duration: 5.4s (14.0–19.4)
- blueprint: dataviz-countup
- src: compositions/04-story.html
- status: outline
- transition_in: camera push
- scene: the figure is the hero ("+62%") with a before/after bar that grows from the base to the new level (only when the figure is a % change); headline and why set beside it; coin pose reacts (celebrating / worried).

## Frame 5 — Story 3 (Business): kinetic headline

- duration: 5.4s (19.4–24.8)
- blueprint: kinetic-type-beats
- src: compositions/05-story.html
- status: outline
- transition_in: whip-pan left
- scene: the headline builds in 2–3 full-screen beats ("BHP" / "Makes $4.1b" / "Copper Bet"), each beat with its own move, landing on the figure pop and the one-line why; coin finger-guns in from the edge.

## Frame 6 — Outro: follow

- duration: 3.2s (24.8–28.0)
- blueprint: logo-assemble-lockup
- src: compositions/06-outro.html
- status: outline
- transition_in: camera pull-back
- scene: camera pulls back to the whole desk world (all stations visible, tiny); "See you tomorrow, 7:30am" + "Follow @byte.finance.au" lock up over it; coin struts across; disclaimer small.

Callback: the pull-back shows every station the viewer just travelled through.
