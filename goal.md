# Battle Clash Goal

## Active Goal

Prepare a decision-complete architecture and execution plan for a browser-based
colored-cube village battle greybox using NexusEngine ECS, Core World, layered
game domains, atomic kits, and a Three.js bird's-eye host.

## Status

Planning complete; implementation awaiting explicit authorization.

## Success Criteria For The Future First Playable

- One readable village battlefield appears from a bird's-eye orthographic view.
- Buildings, troops, defenses, resources, projectiles, and selection states use distinct cube colors.
- The player can place a small force, start a raid, observe deterministic combat, and reach a clear win or loss.
- All gameplay state is represented by entities, components, resources, events, and deterministic systems.
- Game domains compose public NexusEngine Core domains and atomic kits without renderer leakage.
- Core World provides the map's world identity, flat surface, uniform grid, and snapshot-safe cell lifecycle.
- Three.js renders descriptors and forwards semantic input without owning gameplay rules.
- A human-view browser review confirms initial view, interaction view, and battle readability.

## Out Of Scope For The First Playable

- Multiplayer.
- Backend services.
- Accounts, monetization, payments, or live operations.
- Production art, sound, animation, or copied intellectual property.
- Large progression trees, clans, chat, matchmaking, or asynchronous raids.

