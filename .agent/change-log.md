# Agent Change Log

## 2026-07-28 18:49:31 EDT

- Bootstrapped the repository-local agent workspace.
- Added planning-only root documentation.
- Recorded the ECS, Core domain, deep game-domain, atomic-kit, and Three.js host boundaries.
- Recorded the private-repository and no-main-push constraints.
- Added no gameplay implementation.

## 2026-07-28 18:51:58 EDT

- Validated the planning-only scaffold.
- Created the private `LuminaryLabs-Dev/Battle-Clash` GitHub repository.
- Published `agent/planning-foundation` without creating or pushing `main`.
- Verified the remote default branch is `agent/planning-foundation`.

## 2026-07-28 18:57:50 EDT

- Added `.github/workflows/deploy-pages.yml`.
- Scoped automatic deployment to pushes on `main`.
- Required `npm ci`, `npm run build`, and `dist/index.html` before deployment.
- Published the workflow only to `agent/planning-foundation`.
- Verified GitHub recognizes the workflow as active.
- Configured GitHub Pages to use the Actions deployment source.
- Confirmed no `main` branch exists and no deployment run occurred.

## 2026-07-28 20:42:00 EDT

- Implemented the deterministic NexusEngine ECS dungeon greybox and Three.js host.
- Added Core World, Network, Persistence, and deep atomic game-domain composition.
- Added PeerJS deterministic room discovery, defender-host authority, attacker
  commands, authoritative snapshot sync, and solo fallback.
- Added the optional Node PeerServer signaling layer.
- Added persistent XP, levels, perk points, power scaling, and a defender Heart ward.
- Passed headless determinism, progression, protocol, and defense checks.
- Passed the production build.
- Proved two independent browser sessions auto-matched as defender and attacker.
- Proved visible pointer deployment, synchronized combat, defender ward use,
  persistent XP, and a visible level-two result without console errors.

## 2026-07-28 20:58:00 EDT

- Pushed the validated implementation to `main` and made `main` the default branch.
- Allowed `main` through the `github-pages` environment policy.
- Confirmed the custom private-repository runner was blocked by the
  organization's failed payment or Actions spending limit, not by the build.
- Switched Pages to the supported `main/docs` publishing source and retained the
  artifact workflow as a manual path for when billing is restored.
- Completed managed Pages run `30412526291` successfully from commit `bbf4029`.
- Verified the public URL returned HTTP 200 and Pages reported `built`.
- Completed a live public dungeon run with a real pointer deployment, a win,
  persistent XP, and zero browser console errors.
- Proved two separate public browser sessions auto-matched into room 0 as
  authoritative defender and remote attacker.

## 2026-07-30 15:01:25 EDT

- Created local branch `agent/immersive-world-ui`; no push or deployment occurred.
- Removed the persistent objective card, six-cell status dashboard, control row,
  active diagnostics, and centered result modal from the player view.
- Added tiny masked edge sigils for the party, Heart, current interaction,
  raid pressure, and an invoked angular system menu.
- Upgraded the Three.js greybox with rounded cube silhouettes, layered caps and
  crests, contact shadows, deployment runes, projectile trails, attached damage
  meters, richer lighting, void dressing, and win/loss world shockwaves.
- Replaced fixed camera zoom with projected-bounds orthographic framing across
  desktop, compact landscape, and portrait viewports.
- Preserved the deterministic digest `82162b1ebe00c55b` and passed the production build.
- Proved real-pointer deployment, combat start, win, loss, Next Run recovery,
  Escape menu access, zero browser errors/warnings, and screenshot readability.

## 2026-08-03 16:40:00 EDT

- Extended the local branch into the persistent frontier slice: authored six
  connected territories on 100x100 grids with Home Base, overworld, territory,
  and encounter scene descriptors.
- Added ECS-owned World, Scene, Hero, Territory, Army, Economy, and Landscape
  resources plus discover, enter, claim, economy-tick, and scene-transition APIs.
- Added compact in-world frontier controls and readouts for Home Base, discovery,
  claiming, entering fronts, and returning home.
- Added NexusEngine A* grid path queries through the navigation domain and
  validated deterministic simulation, browser scene traversal, and production build.
- Kept all changes local on `agent/immersive-world-ui`; no push or deployment.

## 2026-08-03 16:50:00 EDT

- Added deterministic landscape generation and persistent blocked-cell/hazard
  mutation for each territory, with A* rerouting checks.
- Added scene-aware Three.js presentation: Home Base sanctum, connected
  overworld nodes/routes, territory obstacle cubes, and a hero marker.
- Territory clicks now resolve NexusEngine A* paths before moving the hero.
- Encounter transitions seed deterministic territory-specific defender counts
  and scenario metadata.
- Added explicit flow, frontier, hero, army, economy, encounter, and sanctum
  deep-domain boundary kits plus a Core Interaction kit.
- Added separate local persistence for the world profile.
- Revalidated `npm run check`, `npm run build`, browser traversal, A* movement,
  dynamic landscape mutation, and encounter composition with no browser errors.

## 2026-08-03 17:05:00 EDT

- Added persistent SanctumState and Home Base actions for army healing,
  recruitment, and Sanctum upgrades with economy costs and unlocks.
- Added 8–12 defender composition targets for territory encounters and a
  deterministic Blackglass Warden boss archetype for the stronghold route.
- Fixed Sanctum return/startup normalization so the Home Base scene always owns
  the Dawnwatch territory and its economy controls.
- Added validation for Sanctum progression, stronghold boss seeding, and the
  persisted Home Base state; kept all work local with no push/deploy.

## 2026-08-03 17:20:00 EDT

- Added economy storage caps, army food/gold upkeep, and Sanctum iron-to-gold
  trading with PeerJS command normalization.
- Expanded the authored world proof from 6 to 12 connected territories with
  additional fronts, strongholds, dungeons, wilds, and resource profiles.
- Added NexusEngine world-graph A* alongside territory-grid A* and validated a
  Dawnwatch-to-Blackglass route.

## 2026-08-04 03:40:00 EDT

- Added `scripts/validate-domain-coverage.mjs` with 498 semantic checks and a
  99% threshold. The current report passes at 100% and is consumed by the
  BattleClash-Player cross-repository gate.

## 2026-08-04 04:05:00 EDT

- Added explicit `?solo=1` PeerJS bypass for deterministic browser-agent
  validation; normal room discovery remains the default.

## 2026-08-04 04:20:00 EDT

- Local browser proof with `?solo=1` reached Home Base → frontier → Ash
  Crossing → encounter → victory → Dawnwatch Sanctum with zero console errors.
- 2026-08-04: Expanded semantic validation to 612 checks, including per-event
  behavior, resource ownership, asset manifest integrity, GLB descriptors, and
  cube fallback resolution. Battle-Clash and BattleClash-Player gates pass.

## 2026-08-04 21:10:00 EDT

- Audited the online PR surface and exposed the existing Supabase/Rails account
  contracts in the folded system menu: Google sign-in, profile export, and
  idempotent profile deletion now have player-facing controls.
- Profile export uses a browser download boundary; deletion clears only Battle
  Clash local profile/queue keys after the server tombstone succeeds.
- Added HTML markers to the auth contract and preserved 675/675 semantic proof,
  production build, Pages artifact, and responsive zero-error browser proof.
