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
(production staging) -> `publish` (production). `main` is now aligned at
`86f960f` and is intentionally unprotected during early development. Promotion
PR #2 is the protected `main -> staging` handoff; run the baseline check after
that promotion and before production publication.
Supabase/OAuth, production Rails, and hosted PeerServer/TURN remain provider
gates.
