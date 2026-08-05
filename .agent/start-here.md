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

The feature work is currently split across protected PRs:
`agent/domain-validator` for Battle-Clash, `agent/player-harness` for the
Player harness, and `agent/production-foundation` for the Rails backend. Their
required checks are green, but each PR still needs one approving review before
the default branch can advance. The public Pages URL remains the older `main`
artifact until that protected merge and deployment occur. Supabase/OAuth,
production Rails, and hosted PeerServer/TURN remain provider gates.
