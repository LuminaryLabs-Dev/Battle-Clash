# Start Here

Read in this order:

1. `../AGENTS.md`
2. `../memory.md`
3. `../goal.md`
4. `../MASTER_PLAN.md`
5. `intention.md`
6. `goal.md`
7. `workflow.md`
8. `memory.md`
9. `feedback.md`
10. `change-log.md`

The Battle-Clash release chain is `main` (development) -> `staging`
(production staging) -> `publish` (production). `staging` and `publish` carry
the current `6cf2c4c` source baseline; the protected `agent/domain-validator`
PR still needs approval before `main` can be aligned. Run
`npm run check:tier-baseline` after that merge and before the first new change.
Supabase/OAuth, production Rails, and hosted PeerServer/TURN remain provider
gates.
