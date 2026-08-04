# Active Goal

## Goal

Replace the active-play web dashboard with an immersive world-first presentation:
tiny interaction-specific masked edge sigils, world-owned combat feedback,
polished colored cubes, and responsive bird's-eye camera framing.

## Status

The immersive game is deployed from `main`. The active continuation is a
cross-repository semantic validator and player-harness gate; full AAA content
and production art remain larger follow-on work.

## Success Criteria

- Active play contains no persistent cards, status dashboard, objective panel,
  control bar, or exposed diagnostics.
- Tiny masked sigils show only party, Heart, and currently valid interactions.
- A real pointer can deploy a blue cube delver and Start launches combat.
- Combat, win, loss, reward, and restart remain readable through the world.
- Desktop, compact landscape, and portrait framing keep the full room visible.
- The system menu is absent until invoked and closes with Escape.
- NexusEngine Core World owns the flat uniform-grid world contract.
- NexusEngine Core Network owns session and authority contracts.
- Gameplay truth remains in ECS entities, components, resources, events, and atomic kits.
- Three.js remains a presentation/input host.
- PeerJS remains a transport adapter and failures preserve solo play.
- Build and deterministic replay checks pass.
- Local browser screenshots, readability metrics, and zero-console-error proof pass.

## Continuation: semantic validation

- `npm run check:domains` must cover at least 99% of registered domains,
  semantic objects, commands, scenes, territories, and the complete flow.
- `BattleClash-Player/npm run check:game` delegates to that validator.
