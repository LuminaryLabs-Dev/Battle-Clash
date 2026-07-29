# Battle Clash Goal

## Active Goal

Ship the first public Battle Clash dungeon run: a colored-cube, bird's-eye
Three.js game with deterministic NexusEngine ECS combat, persistent RPG
progression, and a PeerJS attack/defend room.

## Status

Complete. The implementation is on `main`, the managed Pages deployment
succeeded from `/docs`, and the public game passed solo and two-browser PeerJS
proof without console errors.

## Release Criteria

- Solo play always works, even when signaling or peer connectivity is unavailable.
- One browser auto-elects the defender-host room and another auto-discovers it as attacker.
- The defender host owns the authoritative ECS simulation.
- The attacker can deploy delvers, begin a run, and receive synchronized snapshots.
- The defender gets one visible Heart fortification ward per run.
- Runs award persistent XP, levels, perk points, and per-level delver power.
- Core World owns the flat uniform-grid world contract.
- Core Network owns session, authority, peer, and envelope descriptors.
- Core Persistence owns the profile slot contract; browser storage is only an adapter.
- Three.js and PeerJS never own gameplay outcomes.
- Deterministic checks, production build, local human-view proof, Pages deployment,
  and public browser proof all pass.

## Later Product Work

- More dungeon rooms, elites, hazards, bosses, loot, and build choices.
- Authenticated profiles and cloud persistence.
- Hosted PeerServer plus production TURN infrastructure.
- Defender-authored dungeon layouts and seasonal room rotation.
- Original production art, sound, and animation.
