# Battle Clash Memory

## Purpose

Build an original village battle game inspired by the broad base-building and
raid genre without copying another game's name, art, characters, layouts, UI,
audio, text, or balance.

## Durable Architecture Decisions

- NexusEngine is the deterministic Core runtime and remains an external dependency.
- The game uses ECS and plain-data configuration as its gameplay source of truth.
- Game meaning is organized into deep, inspectable domains.
- Deep game domains compose NexusEngine Core domains and small atomic kits.
- Core World owns world identity, partitioning, cells, surfaces, focus, and portable world lifecycle state.
- Three.js is a presentation host only and never owns gameplay outcomes.
- The first playable is a colored-cube greybox with a bird's-eye orthographic camera.
- The first implementation branch must not be `main`.

## Repository Policy

- This repository is private.
- No gameplay implementation is authorized yet.
- Update this file only when a lasting decision changes.

