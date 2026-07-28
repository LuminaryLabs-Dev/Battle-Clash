# Agent Memory

## Decisions

- Display name: Battle Clash.
- Repository name: `Battle-Clash`.
- GitHub owner: verified `LuminaryLabs-Dev`.
- Visibility: private.
- Planning branch: `agent/planning-foundation`.
- No `main` push.
- No gameplay implementation yet.
- GitHub Pages deployment is triggered only by a future push to `main` and
  publishes the verified `dist/` production artifact.
- Pages uses the GitHub Actions source. The private repository's eventual Pages
  site is public at `https://luminarylabs-dev.github.io/Battle-Clash/`.
- Architecture: deep game domains compose NexusEngine Core domains through
  atomic idempotent kits; Three.js is a presentation host only.

## Conventions

- Reconcile active work in `.agent/workflow.md`.
- Append meaningful progress to `.agent/change-log.md`.
- Mark unknown future product decisions as `TBD`.
