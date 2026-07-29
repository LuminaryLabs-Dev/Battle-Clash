# Intention

## Overall Intent

Develop Battle Clash as an original, deterministic browser dungeon-battle RPG
that demonstrates deep ECS composition with NexusEngine.

## Durable Constraints

- Private GitHub repository under `LuminaryLabs-Dev`.
- Publish the playable through the default release branch and public Pages site.
- Use Core domains for universal contracts and game domains for authored meaning.
- Use atomic idempotent kits as the main behavior-composition units.
- Keep Three.js isolated to the host/presentation boundary.
- Keep PeerJS isolated to the transport-adapter boundary.
- Preserve a fully playable solo fallback.
- Require human-view validation for player-facing claims.
