# Reel sound effects

Generated once with ElevenLabs Sound Effects (eleven_text_to_sound_v2) on 13 Oct 2026, then trimmed and levelled by
`scripts/make-sfx.py`. Raw takes (4 per sound) are in `../sfx-raw`. No API calls happen at render time.

| file | used for |
| --- | --- |
| whoosh | camera whips, dolly, outro pull-back, lesson step changes |
| pop | numbers landing, badges, diagram boxes appearing |
| tick | count-ups and the hook's rolling names |
| slide | cards, title and kinetic headline lines sliding in |
| draw | arrows drawing in lesson diagrams |
| coin | the coin settling in, coin tokens arriving |
| chime | phone notification and the follow pill |

Cue timings live in `reels/daily-news/scripts/build.mjs` (SFX block) and `reels/lesson/scripts/sfx.mjs`.
