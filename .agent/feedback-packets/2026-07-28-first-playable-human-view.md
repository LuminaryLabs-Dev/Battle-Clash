# First Playable Human-View Packet

## Acceptance Question

Have I checked what the human would actually see, and do I need screenshots,
visual inspection, launch-state inspection, or before/after comparison to
validate this properly?

Answer: yes. A game claim required launch inspection, screenshots, real pointer
and button interaction, two-browser comparison, terminal-state inspection, and
console review.

## Route

- Surface: game / interactive scene.
- Primary task: auto-match, deploy, start, observe, defend, earn XP, continue.
- Perspectives: player readability, camera framing, objective clarity,
  feedback feel, multiplayer role clarity, terminal-state clarity.
- Techniques: initial screenshot, pointer deployment, button activation,
  paired-session snapshots, result screenshot, console inspection.

## Evidence

- Initial attacker view:
  `output/playwright/local-peer-room/.playwright-cli/page-2026-07-29T00-39-18-963Z.png`
- First networked result:
  `output/playwright/local-peer-room/.playwright-cli/page-2026-07-29T00-40-40-324Z.png`
- Level-two result:
  `output/playwright/local-peer-room/.playwright-cli/page-2026-07-29T00-41-27-383Z.png`
- Production preview:
  `output/playwright/production-preview/.playwright-cli/page-2026-07-29T00-47-16-689Z.png`
- Public launch:
  `output/playwright/live-pages/.playwright-cli/page-2026-07-29T00-56-06-137Z.png`
- Public terminal state:
  `output/playwright/live-pages/.playwright-cli/page-2026-07-29T00-56-53-865Z.png`

## Observations

- PASS: the orthographic frame shows the complete room, perimeter, Heart,
  sentinels, relics, and walls at launch.
- PASS: the objective, room role, level, XP, timer, party budget, and Heart
  health are readable without opening Advanced.
- PASS: an actual pointer click on the blue perimeter deployed a delver and the
  authoritative attacker snapshot changed from `0 + 8` to `1 + 7`.
- PASS: independent browser sessions displayed complementary ATTACKER LINKED
  and DEFENDER LINKED roles.
- PASS: the defender ward was consumed and synchronized during active combat.
- PASS: two networked wins produced Level 2, 84 / 135 XP, and one perk point.
- PASS: reload restored Level 2 and 84 XP before reconnecting as attacker.
- PASS: the production `dist/` preview loaded 49 Core World cells with no errors.
- PASS: the public Pages URL returned HTTP 200 and completed a full solo run.
- PASS: two public Pages sessions auto-matched as defender and attacker in room 0.
- PASS: the public consoles reported zero errors and zero warnings.
- PASS: both browser consoles reported zero errors and zero warnings.
- PASS: the result state clearly exposes the next-run action.

## Disposition

Local and public player-view acceptance passed.
