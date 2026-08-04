# Active Goal

## Goal

Replace the active-play web dashboard with an immersive world-first presentation:
tiny interaction-specific masked edge sigils, world-owned combat feedback,
polished colored cubes, and responsive bird's-eye camera framing.

## Status

Complete locally on `agent/immersive-world-ui`. No push or deployment was
performed; the public Pages build remains the prior `main` release.

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
