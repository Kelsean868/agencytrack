# Demo/test data seed — EXTEND existing seed infrastructure (CORRECTED)

> **Correction note.** The prior version of this brief was authored greenfield. Phase-0 source-verify found mature seed infrastructure already shipped (PR #410) with the same safety architecture: a load-bearing `seededTestData: true` marker, an in-repo allowlist (`scripts/seed/test-roster.mjs`), a two-gate prod-write model, and a runbook — plus a banked FU (`FOLLOW_UPS.md` "Track J — Cyril branch rich seed") that explicitly directs **extending** that script. This corrected brief **extends** the existing infrastructure. The greenfield premises — a new `__seed` marker, a `.env.local` allowlist, a new `scripts/seed/demo-data.mjs`, and re-seeding submissions — are **withdrawn**.

**Track:** Tooling / verification infra (demo-driven)
**Type:** EXTEND the existing prod-write seed infrastructure — add net-new surfaces (goals, policies, manager WAR) + a unified teardown. No app / UI / Firestore-rules change.
**Risk:** ⚠️ **ELEVATED** — writes to production Firestore, scoped to the test tenant. The existing safety model IS the safety surface — extend it, do not fork it.

---

## 1. The decision (Rule 1 — locked)

Extend the existing seed infrastructure; do NOT build a parallel script.

- **Reuse the existing marker** `seededTestData: true` on every seeded doc. Do NOT introduce `__seed` — it would fragment the teardown (the existing `seededTestData`-keyed sweep wouldn't catch new-marker docs, and vice versa), breaking the reversibility guarantee on a prod-write tool.
- **Reuse the canonical allowlist** `scripts/seed/test-roster.mjs` (the 10 test users — BM / UMs / agents, `@agencytrack.test`, `tatillife_south` / Cyril Murray Branch) + the existing two-layer `TEST_EMAIL_ALLOWLIST`. Do NOT source from `.env.local`.
- **Reuse the existing two-gate prod-write model** (`--dry-run` default; `--execute --i-confirm-prod-write` to write) and the hardcoded `tatillife_south` tenant lock.
- **Submissions + leaderboard activation are already shipped** (`functions/scripts/seed-leaderboard-test-data.cjs`, PR #410 — multi-week, varied-ranking submissions for podium / ▲▼ / around-me / champions). Do NOT re-build them. Confirm only that they still produce enough cumulative API for awards to read as in-progress; an amount-tune is in scope **only if** Phase 0 shows it's needed, flagged explicitly (§3).

---

## 2. What's net-new (the actual gap)

The existing seed covers submissions (+ SM account provision). NOT covered, and what this work adds:

- **Goals** — per test roster: `personalAnnualAPI` (+ the goal fields per the goals schema). Drives the hero card, gap analysis, the Game Plan anchor, AND the Weekly Planner Slice 1 anchor (so seeding this makes that card demoable too).
- **Policies (ledger)** — per test agent: a handful, mixed statuses incl. some `settled` and a `lapsed`, so the Policy Ledger populates and persistency has data.
- **Manager WAR** — for the test BM / UMs: a manager activity report (the Track I schema).
- **Unified teardown** — a teardown that removes ALL `seededTestData` docs across submissions + goals + policies + manager-WAR (one sweep, one marker), scoped to the test tenant + roster, verified to leave real data intact. If a teardown exists in the infra, extend it to cover the new types; if not, add it.

---

## 3. Phases

### Phase 0 — gate + source-verify (build on the audit already done)
- `git fetch origin`, verify origin/main HEAD against CONTEXT.md, branch off origin/main.
- Re-confirm the existing infra: the `seededTestData` marker + its sweep (`scripts/verification/seed-verify.mjs`), `test-roster.mjs`, `seed-leaderboard-test-data.cjs`'s two-gate model + tenant lock, the runbook (`docs/runbooks/seed-leaderboard-test-data.md`), the FU (`FOLLOW_UPS.md` "Track J — Cyril branch rich seed").
- Source-verify the NET-NEW schemas (read a real example of each): the goals doc, the policy doc, the manager-WAR doc. Match shapes exactly.
- Determine where the new per-surface seeders fit in the existing structure (per-type seeders vs the main script — match the established pattern + module convention, e.g. `.cjs`).
- Confirm the existing submission seed's amounts give enough cumulative API for awards to read as in-progress; note if a small amount-tune is warranted.

### Phase 1 — confirm safety (HARD gate)
- Confirm the extension preserves ONE safety surface: the single `seededTestData` marker, the `test-roster.mjs` allowlist, the two-gate model, the `tatillife_south` lock, and a UNIFIED teardown. If the net-new surfaces can't share that one safety surface cleanly, **STOP and wait for dispatcher.**

### Phase 2 — build
- Add the goals / policies / manager-WAR seeders into the existing structure, each writing `seededTestData: true`, scoped to the roster + test tenant, behind the existing gates.
- Add/extend the unified teardown to sweep all seeded types.
- (Optional, only if Phase 0 found it needed) a minimal amount-tune to the submission seed so awards show progress — flag it explicitly; do not silently rework #410's logic.

### Phase 3 — verify
- Lint clean. The `--dry-run` prints a correct combined plan (submissions [existing] + goals + policies + manager-WAR).

### Phase 4 — verification walk (seed → app read-back → unified teardown)
1. `--dry-run` → review the combined plan.
2. Seed (existing submissions + the new surfaces) with the prod-write gate.
3. **App read-back:** log in as a test agent → dashboard / awards (in-progress) / career / Policy Ledger (seeded policies) / Game Plan anchor + Weekly Planner suggested-target (from the seeded `personalAnnualAPI`). Log in as the test BM → Team WARs / roll-up / agent-risk-view (seeded team) + the manager activity view (seeded WAR). Leaderboard: podium / ▲▼ / around-me / champions (from #410's submissions).
4. **Unified teardown** → confirm ALL seeded docs (all types) gone AND a known real doc (e.g. a real profile) untouched.
- Capture a couple of screenshots (agent dashboard + manager roll-up, populated) for the report.

### Phase 4 — docs (placeholders; Rule 16)
- `CONTEXT.md` Recently-shipped row + `#TBD`/`{TBD}` placeholders; refresh top-of-file fields + Where-we-left-off.
- Extend the existing runbook (`docs/runbooks/seed-leaderboard-test-data.md`) to cover the new surfaces + the unified teardown. Resolve the "Track J — Cyril branch rich seed" FU.

### Phase 5 — commit / push / PR
- Conventional commit: `feat(tooling): extend demo seed — goals, policies, manager WAR + unified teardown`.
- PR body: the EXTEND decision (reuse marker/allowlist/gates), the net-new surfaces, the unified teardown, the verification + screenshots, the smoke checklist (Rule 18).
- Report feature-branch HEAD SHA (Rule 20). **Do not merge or deploy (Rule 19).**

---

## 4. Acceptance criteria
- [ ] Reuses `seededTestData` marker + `test-roster.mjs` allowlist + the two-gate model + the `tatillife_south` lock — NO `__seed`, NO `.env.local` allowlist, NO parallel script.
- [ ] Adds goals + policies + manager-WAR seeders, each matching the live schema.
- [ ] Submissions NOT re-built (#410 owns them); any amount-tune flagged explicitly.
- [ ] Unified teardown sweeps ALL seeded types (one marker); verified clean; real data untouched.
- [ ] App read-back confirms agent + manager surfaces populate (incl. the Game Plan + Weekly Planner anchors); leaderboard renders.
- [ ] Service-account key never echoed or committed.
- [ ] Lint clean; runbook extended; FU resolved.
