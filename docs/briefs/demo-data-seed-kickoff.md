# Demo/test data seed — idempotent, reversible, test-tenant-only

**Track:** Tooling / verification infra (demo-driven)
**Type:** A standalone Admin-SDK script that writes test data to **production** Firestore, scoped to the test tenant. No app / UI / Firestore-rules change.
**Risk:** ⚠️ **ELEVATED** — this writes to the production database (the deployed app reads from it). The risk is concentrated in the SAFETY GUARDS, which are non-negotiable (§2). A mis-scoped write is a data-safety event.

---

## 1. Why

Demos and live verification start data-starved today: the agent has ~31k API (every award "NOT STARTED"), the manager's team shows TTD 0. We need a reusable seed that populates the test tenant so the agent dashboard / awards / career, the Policy Ledger, the leaderboard, and the manager's roll-up + activity all look alive — and that can be cleanly torn down. It also activates the leaderboard features (podium, ▲/▼ movement, around-me cluster, champions banner) that need multi-week, multi-agent, varied-ranking data.

The PR ships and *verifies* the script (seed → teardown round-trip, clean). Using it for an actual demo is a separate operator action: run `seed --apply`, demo, then `teardown`.

---

## 2. HARD safety requirements (non-negotiable — Phase 1 gate)

The script writes to PRODUCTION Firestore (project `agencytrack-2a610`), scoped to the test tenant. Therefore:

1. **Test-tenant guard.** Hard-coded: the script REFUSES to run unless the target tenant is exactly `tatillife_south`. No flag, env, or arg can override it to another tenant.
2. **Agent allowlist.** It only writes data for the known test-agent UIDs (source from `.env.local` / the documented test accounts — `kelsean@gmail.com` and the team members under the test BM). It never touches other users.
3. **ADD-only / non-destructive.** It only creates/updates SEEDED docs; it never modifies or deletes any doc it didn't create. Every seeded doc carries a marker (e.g. `__seed: true`) so teardown is precise.
4. **Idempotent.** Re-running yields the same state — deterministic doc IDs keyed by tenant+agent+week / tenant+agent+policyKey; upsert, never append duplicates.
5. **Reversible.** A `teardown` mode removes ONLY docs with the `__seed` marker, in the test tenant, for the allowlisted UIDs — verified to leave all real data intact.
6. **Dry-run default.** A `--dry-run` mode prints exactly what it WOULD write/delete (counts + sample paths) without writing. Writing requires an explicit `--apply`.
7. **Never echo or commit the service-account key.** Authenticate the way existing Admin-SDK scripts do (source-verify in Phase 0).

---

## 3. What it seeds (source-verify each schema in Phase 0 — Rule 17)

Populate the surfaces that matter for demos + the leaderboard. **Read an existing real doc of each type first and match its shape exactly.** If any shape is uncertain or heavy, STOP and surface.

Priority tiers (if scope must be cut, keep the MUSTs):

- **MUST — Weekly submissions.** For the ~5 team agents, across the current week + ≥3 prior weeks, with varied API + activity counts and **deliberately different week-over-week rankings** (so the leaderboard shows a real podium, ▲/▼ movement, and an around-me cluster). Cumulative API should span award-relevant territory (a spread: one agent high ~300k+, others mid/low). Drives KPIs, awards, career, trends, the roll-up, and the leaderboard.
- **MUST — Goals.** A `personalAnnualAPI` (+ apps/activity goals per the schema) per agent, so the hero card, gap analysis, and Game Plan anchor show real targets.
- **SHOULD — Policies (ledger).** A handful per agent, mixed statuses incl. some `settled` and a `lapsed`, so the Policy Ledger populates and persistency has data.
- **SHOULD — Manager WAR.** A manager activity report for the test BM (planning / training / 1-on-1 / joint / recruiting / supervision per the Track I schema), so the manager's own activity view populates.
- **If needed for the champions banner** — write the `weeklyChampions/{prevWeekStarting}` doc directly (the aggregation function won't fire for back-dated seeded weeks). Verify the banner's read path in Phase 0.

All weeks = Sundays. Currency TTD. `parseFloat` on numeric writes (match the app's contract).

---

## 4. Phases

### Phase 0 — gate + source-verify
- `git fetch origin`, verify origin/main HEAD against CONTEXT.md, branch off origin/main.
- Source-verify: how existing Admin-SDK scripts authenticate + connect; the exact live doc shape for each seeded type (submission, goal, policy, manager-WAR, weeklyChampions) by reading a real example; the test-agent UIDs; the leaderboard's `previousRank` + champions read paths.
- Confirm the test tenant id (`tatillife_south`) and the agent allowlist.

### Phase 1 — confirm safety design (HARD gate)
- Confirm the design satisfies ALL of §2 (tenant guard, allowlist, ADD-only, idempotent, reversible, dry-run, no key leak). If any can't be guaranteed, **STOP and wait for dispatcher.**

### Phase 2 — build
- One script (e.g. `scripts/seed/demo-data.mjs`) with `seed` (default `--dry-run`, `--apply` to write) and `teardown` modes. Deterministic IDs, `__seed` marker, clear console summary.

### Phase 3 — verify (script runs; lint clean)
- Lint clean. The `--dry-run` prints a correct plan.

### Phase 4 — verification walk (seed → app read-back → teardown)
This is the real verification — a seed that writes unreadable or wrong-shaped data is worse than none:
1. `--dry-run` → review the plan.
2. `seed --apply` against the test tenant.
3. **Read-back via the app** (not just Firestore): log in as the test agent → dashboard KPIs / awards / career / leaderboard populate from the seeded data; the Policy Ledger shows seeded policies. Log in as the test BM → Team WARs / roll-up / agent-risk-view show the seeded team; the manager activity view shows the seeded WAR. (Confirms the seeded shape satisfies READ rules + the UI's expectations.)
4. Leaderboard specifically: podium (top 3), ▲/▼ movement vs prior week, around-me cluster, champions banner all render.
5. `teardown` → confirm seeded docs gone AND a known real doc (e.g. the agent's real profile) is untouched.
- Capture a couple of screenshots (agent dashboard + manager roll-up, populated) for the report.

### Phase 4 — docs (placeholders; Rule 16)
- `CONTEXT.md` Recently-shipped row + `#TBD`/`{TBD}` placeholders; refresh top-of-file fields + Where-we-left-off.
- `FOLLOW_UPS.md`: mark the queued "test-data seed" item resolved. Document `seed` / `teardown` / `--dry-run` usage in a short runbook or the script header.

### Phase 5 — commit / push / PR
- Conventional commit: `feat(tooling): idempotent reversible demo-data seed (test-tenant-only)`.
- PR body: the safety guards, what it seeds, the `seed` / `teardown` / `--dry-run` usage, the verification result + screenshots, the smoke checklist (Rule 18).
- Report feature-branch HEAD SHA (Rule 20). **Do not merge or deploy (Rule 19).**

---

## 5. Acceptance criteria
- [ ] Hard test-tenant guard + agent allowlist; refuses any other tenant/UID.
- [ ] ADD-only, idempotent (re-run = same state), reversible (teardown removes only `__seed` docs, real data intact), `--dry-run` default.
- [ ] Seeds submissions + goals (MUST), policies + manager WAR (SHOULD), + champions doc if needed — each matching the live schema.
- [ ] App read-back confirms all target surfaces populate (agent + manager); leaderboard podium / movement / cluster / champions render.
- [ ] Teardown verified clean; no real data touched.
- [ ] Service-account key never echoed or committed.
- [ ] Lint clean; docs updated with placeholders.
