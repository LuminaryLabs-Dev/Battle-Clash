# Nexus-to-Battle-Clash Expansion Checklist

This contract expands Battle Clash without moving gameplay truth into Three.js,
PeerJS, or UI code. Each capability names its Nexus owner, Battle Clash
composition point, proof, and player result.

| # | Capability | Nexus owner / kit | Battle Clash composition | Done when / player result |
|---|---|---|---|---|
| 1 | Transition phases | `n:world:scene` `scene-lifecycle-kit` | `n:game:battle-clash:flow` coordinator | ECS reaches `exiting → preparing → loading → ready → revealing → stable/failed`; no same-frame pop |
| 2 | Route commands | Core World + Scene | `transitionToScene()` wrapper | Every route uses guards and Flow; invalid routes reject |
| 3 | Scene descriptors | Core Scene | `src/data/world.js` | Sanctum/map/territory/room/encounter/victory/defeat descriptors validate |
| 4 | Preparation gates | `n:runtime:startup`, `n:asset`, presentation kits | startup preparations + Flow readiness | Data/assets/presentation/camera are ready or explicitly fallback |
| 5 | Visual transition | graphics/camera/audio/UI descriptors | `main.js` + `styles.css` | Fade/veil/progress and reduced-motion path pass |
| 6 | Enter/exit lifecycle | Core Scene lifecycle | world commit + host cleanup | Transient entities/effects are cleared; no scene leaks |
| 7 | Lock/cancel/retry/timeout | Startup failure + Scene guards | Flow `cancel/fail/markReady` | Concurrent routes serialize; failure/timeout/retry are deterministic |
| 8 | Diegetic loading | UI descriptor kit | `#sceneTransition` | Destination, reason, phase, progress are visible without a dashboard |
| 9 | Input availability | Interaction/Input kits | transition phase gates | Inputs block during transition and restore at stable |
| 10 | Camera/lighting/audio | camera/graphics/audio kits | scene presentation profiles | Each scene has a readable mood/framing profile |
| 11 | Renderer boundary | Core presentation contracts | Three host projection only | No simulation authority or domain Three.js imports |
| 12 | Assets/fallback | `n:asset` registry kit | asset catalog + GLB loader | Hash/license/review passes; cube fallback and disposal pass |
| 13 | Complete loop | World, Scene, Simulation, Progression | authored scene/room/content data | Home → map → territory → rooms → boss → victory → rewards → Home |
| 14 | Gameplay data | actor/simulation/economy/interaction | ECS resources/components/events | Hero, army, enemies, hazards, objectives, loot, quests, gear, crafting, Sanctum are data-driven |
| 15 | Navigation/determinism | `n:world:navigation:pathfinding` A* | navigation + landscape resources | Hero/world/combat routes and identical-seed digest pass |
| 16 | Live rooms | Core Network/realtime + PeerJS | hello/reconnect/receipt contract | Authority, sequence, expiry, reconnect, and one receipt pass |
| 17 | Account/offline sync | persistence + runtime data/transaction | Supabase/Rails adapters + local queue | Profile round-trip, retry, conflict, idempotency pass |
| 18 | Browser proof | capture/UI contracts | Playwright/player harness | Desktop/compact/portrait screenshots and zero console errors |
| 19 | Release validation | diagnostics/composition/data contracts | npm check/build/pages workflows | Semantic, simulation, asset, peer, auth, sync, tier gates pass |
| 20 | Docs/operations | persistence + release workflows | `docs/`, `memory.md`, `goal.md`, tier manifests | Ownership, evidence, URLs, rollback, secrets, promotion docs agree |

## Expansion order

1. Keep Core Scene authoritative; add one descriptor or room at a time.
2. Add ECS data and validator behavior before renderer polish.
3. Promote assets only after hash, license, attribution, review, and fallback
   evidence exists.
4. Keep provider adapters optional so solo mode remains green.
5. Promote `main → staging → publish` only after focused checks and browser
   evidence pass at the next tier.

## Current baseline

- Flow state machine and diegetic transition projection: implemented.
- Nexus semantic coverage: **684/684 (100%)**.
- Simulation, auth/sync/PeerJS contracts, build, and Pages artifact: pass.
- Supabase, hosted PeerServer/TURN, OAuth credentials, and fresh deployed
  browser proof remain provider-gated and are not claimed as locally complete.
