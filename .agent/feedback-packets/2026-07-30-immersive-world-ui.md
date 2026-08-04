# Immersive World UI Human-View Packet

## Route

- Surface: browser game and interactive Three.js scene.
- Primary task: deploy delvers, begin combat, understand the result, and restart.
- Perspectives: player readability, camera framing, feedback feel, objective
  clarity, first-time use, and regression recovery.
- Techniques: before/after screenshots, live launch, real pointer interaction,
  in-app commands, menu keyboard interaction, viewport matrix, console review,
  and image readability metrics.

## Current-To-Target Delta

- Before: active-play objective card, six-cell status dashboard, bottom control
  row, instruction pill, visible diagnostics disclosure, and centered result modal.
- Target: battlefield above ninety percent of the active hierarchy, no
  persistent cards, tiny masked interaction sigils at the edges, world-owned
  feedback, and diagnostics available only after invoking the system menu.

## Evidence

- Before compact frame:
  `output/playwright/ui-diagnosis/.playwright-cli/page-2026-07-30T17-50-27-940Z.png`
- Final clean desktop frame:
  `output/playwright/immersive-ui/.playwright-cli/page-2026-07-30T18-59-40-972Z.png`
- Final clean compact frame:
  `output/playwright/immersive-ui/.playwright-cli/page-2026-07-30T18-56-45-198Z.png`
- Final clean portrait frame:
  `output/playwright/immersive-ui/.playwright-cli/page-2026-07-30T18-59-45-563Z.png`
- Valid pointer-hover frame:
  `output/playwright/immersive-ui/.playwright-cli/page-2026-07-30T18-55-32-546Z.png`
- Win and world shockwave:
  `output/playwright/immersive-ui/.playwright-cli/page-2026-07-30T18-57-18-432Z.png`
- Loss and world shockwave:
  `output/playwright/immersive-ui/.playwright-cli/page-2026-07-30T18-57-40-322Z.png`
- Invoked system menu:
  `output/playwright/immersive-ui/.playwright-cli/page-2026-07-30T18-54-19-443Z.png`

## Runtime Proof

- A real pointer click changed deployment from eight reserves to seven and
  created one troop while the canvas cursor reported `crosshair`.
- The visible Start icon launched the raid.
- A bounded win produced the gold Heart shockwave, `+92 XP`, and Next Run.
- A bounded timeout produced the red hold shockwave, `+24 XP`, and Next Run.
- Next Run restored `deploy`, eight reserves, and 520 Heart health.
- Escape opened and closed the system menu.
- Final fresh browser session reported `ready=true`, zero errors, zero warnings,
  no document overflow, and the menu hidden by default.
- The compact initial and win screenshots passed the readability metric:
  `dark=44.88% readable=46.89%` and `dark=44.41% readable=47.23%`.

## Verdict

- Decision: PASS.
- Offending active-play regions: none.
- World replacements: blue perimeter runes own deployment, entity materials and
  attached meters own damage, the Heart glow and sigil own objective health,
  projectiles own attack feedback, the clock ring owns pressure, and gold/red
  shockwaves own completion.
- Camera: PASS at 1440x900, 800x600, and 390x844; the full platform remains visible.
- Smallest next edit: none required for this visual goal. Further work should
  deepen playable character control, abilities, encounters, and progression.
