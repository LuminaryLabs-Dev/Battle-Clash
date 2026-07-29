# Active Goal

## Goal

Publicly deploy the first playable Battle Clash dungeon run using NexusEngine
ECS, Core World, Core Network, persistent progression, a PeerJS attack/defend
room, atomic game kits, and a Three.js bird's-eye host.

## Status

Complete. Commit `bbf4029` deployed through GitHub Pages and the public site
passed live solo and paired-browser validation.

## Success Criteria

- A player can deploy blue cube delvers and start a deterministic dungeon run.
- Delvers move, target, attack, take defensive fire, and reach win or loss.
- NexusEngine Core World owns the flat uniform-grid world contract.
- NexusEngine Core Network owns session and authority contracts.
- A second browser auto-discovers the defender host as attacker.
- XP persists and two wins visibly produce a level gain.
- Gameplay truth remains in ECS entities, components, resources, events, and atomic kits.
- Three.js remains a presentation/input host.
- PeerJS remains a transport adapter and failures preserve solo play.
- Build and deterministic replay checks pass.
- Local browser screenshots and interaction proof pass.
- `main` is pushed and the GitHub Pages deployment succeeds.
- The public Pages game loads and is playable without console errors.
