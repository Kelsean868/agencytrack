# Phase 7-8 Design Docs Integration — Kickoff Brief

**Type:** Docs-only PR (XS)
**Trigger:** May 2026 design conversation produced two new design docs (`docs/phase7-8-PRD.md`, `docs/phase7-8-implementation.md`) covering Phase 7-8 feature set across 5 tracks (D–H). This PR wires them into the project's documentation system so future Claude.ai sessions and Claude Code dispatches can find and reference them, and banks 5 pre-track verification follow-ups.

## Inputs
- `docs/phase7-8-PRD.md` — comprehensive Phase 7-8 design spec (committed in the brief docs PR)
- `docs/phase7-8-implementation.md` — 5-track implementation plan with PR breakdown, dependencies, recommended order (committed in the brief docs PR)
- This brief: `docs/briefs/pr-phase7-8-docs-integration-kickoff.md`

## Scope
Three file edits across CLAUDE.md, docs/CONTEXT.md, docs/FOLLOW_UPS.md. Zero code changes. Net result: phase7-8 design docs are discoverable from project memory; 5 LOW-priority pre-track verifications are banked for the design pass of each upcoming track.

## Standing rule reminders
- Single-branch PR rule (fresh branch off freshly-fetched main, never reuse)
- Phase 0 gate fires as usual
- Smoke waiver allowed for pure docs changes per banked May 14 rule; justification required inline ("docs-only, no user-visible surface")
- Source-verify (Rule 17): pair `grep` with `git ls-files` for tracked-status on every claimed input before edit
- Post-merge sequence (Session Protocol step 9) runs automatically after Kyron merges, including Rule 15 verbatim git-log verification

---

## Phase 0 — Gate

1. Confirm on `main`, working tree clean:
```
   git status
   git rev-parse --abbrev-ref HEAD
```
2. Sync main:
```
   git fetch origin
   git pull origin main
```
3. Create fresh branch:
```
   git checkout -b docs/phase7-8-docs-integration
```

**Hard stops (Rule 12 canonical):**
- If not on `main` after step 1: **STOP and wait for dispatcher**
- If working tree dirty (untracked or modified files beyond the expected 6 verification scripts): **STOP and wait for dispatcher**
- If `git pull` produces a merge conflict: **STOP and wait for dispatcher**

---

## Phase 1 — Locate sources & verify state

Per Rule 17, source-verify every input before claiming an edit position.

1. Confirm the two design docs are tracked on the freshly-pulled main:
```
   git ls-files docs/phase7-8-PRD.md docs/phase7-8-implementation.md
```
   Expected output: both files listed.

2. Confirm this brief itself is tracked (it ships in the same docs PR alongside the design docs):
```
   git ls-files docs/briefs/pr-phase7-8-docs-integration-kickoff.md
```
   Expected output: the brief path listed.

3. Locate insertion point in CLAUDE.md for the new design docs reference. Find the existing Track B (Design System v2) reference line:
```
   grep -n "design-v2-PRD" CLAUDE.md
```
   Expected output: 1 match. The new Phase 7-8 reference goes IMMEDIATELY AFTER that line.

4. Locate the Build Phase History table in CLAUDE.md:
```
   grep -n "Build Phase History" CLAUDE.md
   grep -n "Track B (v2)" CLAUDE.md
```
   The 5 new Track D–H rows go AFTER the Track B (v2) row in that table.

5. Locate the planned-work or roadmap section in docs/CONTEXT.md:
```
   grep -n "^##" docs/CONTEXT.md | head -30
```
   Identify whether a "Planned" or "Roadmap" section exists. If yes, extend it. If no, add a new section titled "Phase 7-8 Planned Tracks" at the natural insertion point (after Recently shipped, before any follow-up references).

6. Locate the LOW tier section in docs/FOLLOW_UPS.md:
```
   grep -n "^### LOW" docs/FOLLOW_UPS.md
   grep -n "^## Active" docs/FOLLOW_UPS.md
```
   The 5 new PH7-8 items go into the LOW tier under a new subsection "Phase 7-8 Pre-Track Verifications".

**Hard stops (Rule 12 canonical):**
- If either design doc is NOT tracked (`git ls-files` returns empty): **STOP and wait for dispatcher** — design docs must ship in the brief docs PR
- If `grep` for "design-v2-PRD" returns 0 matches: CLAUDE.md structure has drifted; **STOP and wait for dispatcher**
- If `grep` for Track B (v2) returns 0 matches: Build Phase History table has drifted; **STOP and wait for dispatcher**

---

## Phase 2 — Apply edits

### Edit 1 — CLAUDE.md: add Phase 7-8 docs reference line

Insert a new line IMMEDIATELY AFTER the existing Track B (v2) design-v2-PRD reference:

```
Phase 7-8 design: [`docs/phase7-8-PRD.md`](docs/phase7-8-PRD.md). Implementation tracks: [`docs/phase7-8-implementation.md`](docs/phase7-8-implementation.md). Covers Track D (Awards Expansion + Ruleset Config), Track E (Daily Reporting Polish), Track F (Manager Drill-down + Coaching Notes), Track G (Money Needs Worksheet), Track H (Policy Ledger MVP). Pilot remains postponed indefinitely.
```

### Edit 2 — CLAUDE.md: extend Build Phase History table with 5 planned rows

Append the following rows to the Build Phase History table, immediately after the existing Track B (v2) row:

```
| Track D | Awards Expansion + Ruleset Config Migration (move awardsEngine.js constants to config/awardsRuleset/{year}; agent + UM awards parity expansion; BM at-risk view) | 📋 PLANNED — see `docs/phase7-8-implementation.md` |
| Track E | Daily Reporting Polish (per-agent work schedule + T&T holiday calendar + FAB for Daily Log + form structure refinement, polish atop shipped E6) | 📋 PLANNED — see `docs/phase7-8-implementation.md` |
| Track F | Manager Drill-down + Coaching Notes (agent-mirror dashboards under /manager/agent/:agentId; nightly aggregation Cloud Function; coaching notes private to manager chain) | 📋 PLANNED — see `docs/phase7-8-implementation.md` |
| Track G | Money Needs Worksheet (T&T-localized 5-group budget + 3 sub-calculators; piecewise PAYE config; privacy model with manager-read audit) | 📋 PLANNED — see `docs/phase7-8-implementation.md` |
| Track H | Policy Ledger MVP (real-time entry; Submitted → Settled / Rated / Postponed / NTU / Denied / Lapsed state machine; awards engine soft-migrates from settlements) | 📋 PLANNED — see `docs/phase7-8-implementation.md` |
```

### Edit 3 — docs/CONTEXT.md: add Phase 7-8 Planned Tracks section

Add the following section at the natural insertion point (after Recently shipped, before any follow-up references). If a Planned/Roadmap section already exists, extend it instead of duplicating.

```
## Phase 7-8 Planned Tracks

Comprehensive design captured in `docs/phase7-8-PRD.md`. Build order and PR breakdown in `docs/phase7-8-implementation.md`.

Recommended sequence: **D → E → G → F → H** (~36–46 PRs total, no track blocks pilot launch).

- **Track D** — Awards Expansion + Ruleset Config Migration. Moves Tatil 2026 constants from `awardsEngine.js` to `config/awardsRuleset/{year}`. Adds agent + UM awards parity expansion and BM at-risk view. ~6–8 PRs.
- **Track E** — Daily Reporting Polish. Per-agent work schedule (working days + T&T holidays + vacation overrides), Floating Action Button for Daily Log, refined 8-field-in-2-sections form structure. Polish atop already-shipped E6 logging mode. ~5–7 PRs.
- **Track F** — Manager Drill-down + Coaching Notes. New `/manager/agent/:agentId` route with agent-mirror dashboard, historic trend visualizations from nightly Cloud Function aggregates, coaching notes private to manager chain. ~8–10 PRs.
- **Track G** — Money Needs Worksheet. T&T-localized 5-expense-group budget with 3 sub-calculators (Insurance Industry, Car Expenses, Loans/Debt), piecewise PAYE config in `config/payeFormula`, privacy defaults with manager-read audit. ~7–9 PRs.
- **Track H** — Policy Ledger MVP. Real-time per-policy entry, state machine (Submitted → Settled → Lapsed terminal), awards engine soft-migrates from settlements via per-agent `usesPolicyLedger` flag. ~10–12 PRs. Depends on Track D.

Five pre-track verification follow-ups (PH7-8-Q1 through Q5) banked in `docs/FOLLOW_UPS.md` LOW tier; resolve in the design pass for each track.
```

### Edit 4 — docs/FOLLOW_UPS.md: bank 5 LOW-priority items

Add a new subsection to the LOW tier (Active section) titled "Phase 7-8 Pre-Track Verifications". Use the existing FU template structure for consistency. Insert at the END of the LOW tier so it doesn't reorder existing items.

```
### Phase 7-8 Pre-Track Verifications

Five items surfaced in the May 2026 design conversation; each is small enough to resolve in the design pass for its respective track. See `docs/phase7-8-implementation.md` § 9 for full context.

- **PH7-8-Q1 (Track D)** — At-risk threshold design: per-award configurable (Centurion at 80 apps differs from API at 80%) vs single percentage. Recommended: per-award configurable, settable in `config/awardsRuleset/{year}`. Resolve in Track D design pass before D5.

- **PH7-8-Q2 (Track E)** — Verify `dailyNudgeTime` is per-agent on the user doc (existing E6 ProfileScreen code suggests so). Quick code check in `src/components/profile/ProfileScreen.jsx` + `loggingModeService.js`. Resolve before Track E design pass starts.

- **PH7-8-Q3 (Track F)** — Decide whether "concern"-category coaching notes surface in any manager-overview dashboard, or strictly individual-agent context. Default proposal: individual-agent only. Resolve in Track F design pass.

- **PH7-8-Q4 (Track G)** — Confirm "Other" custom line items cap of 5 per group (proposed, not locked). Decide line-item naming ownership (Tenant Admin curated vs free-text agent-defined). Resolve in Track G design pass.

- **PH7-8-Q5 (Track H)** — Verify `agentType: 'agent' | 'bdo' | 'dso'` exists on user docs (or scope adding it). Awards engine eligibility depends on this. Quick grep before H1 schema work. Resolve before H1 schema PR.

Banked from PR #TBD (Phase 7-8 docs integration). Closes with PR #{TBD}.
```

---

## Phase 3 — Verify

1. Edits land at expected positions:
```
   grep -n "phase7-8-PRD" CLAUDE.md
   grep -n "Track D" CLAUDE.md
   grep -n "Track H" CLAUDE.md
   grep -n "Phase 7-8 Planned Tracks" docs/CONTEXT.md
   grep -n "PH7-8-Q1" docs/FOLLOW_UPS.md
   grep -n "PH7-8-Q5" docs/FOLLOW_UPS.md
   grep -n "Phase 7-8 Pre-Track Verifications" docs/FOLLOW_UPS.md
```
   Each grep should return 1+ match.

2. Confirm no unintended changes to surrounding lines:
```
   git diff CLAUDE.md
   git diff docs/CONTEXT.md
   git diff docs/FOLLOW_UPS.md
```
   Review each diff: only the 4 intended edits should appear, no whitespace-only or accidental edits elsewhere.

3. Lint + build baseline (docs-only — should be unchanged from pre-edit):
```
   npm run lint
   npm run build
```
   Both must pass. Lint warnings count should match the pre-edit baseline (zero drift from docs-only edits).

**Hard stops (Rule 12 canonical):**
- If any grep returns 0 matches for the expected new content: **STOP and wait for dispatcher**
- If `git diff` shows edits to lines NOT in the brief: **STOP and wait for dispatcher**
- If `npm run lint` exits with new warnings or `npm run build` fails: **STOP and wait for dispatcher** (docs-only changes should not affect either)

---

## Phase 4 — Open PR

1. Stage and commit:
```
   git add CLAUDE.md docs/CONTEXT.md docs/FOLLOW_UPS.md
   git commit -m "docs: integrate Phase 7-8 design docs (CLAUDE.md + CONTEXT.md + FOLLOW_UPS.md)"
   git push -u origin docs/phase7-8-docs-integration
```

2. Open PR in GitHub UI with:
   - **Title:** `docs: integrate Phase 7-8 design docs (CLAUDE.md + CONTEXT.md + FOLLOW_UPS.md)`
   - **Description:** Reference `docs/briefs/pr-phase7-8-docs-integration-kickoff.md`. Note the four edits. Include smoke-waiver justification: "Docs-only PR. No user-visible surface affected. Smoke waived per banked May 14 rule."
   - **Banks:** PH7-8-Q1 through PH7-8-Q5 (5 new LOW-tier follow-ups in `docs/FOLLOW_UPS.md`)

3. Surface PR URL back to dispatcher and **STOP**. Do not merge; do not run post-merge sequence yet.

---

## Phase 5 — Post-merge sequence (executed after Kyron merges)

Per Session Protocol step 9 (canonical), automatically after Kyron confirms the merge:

1. Sync main:
```
   git checkout main
   git fetch origin
   git pull origin main
```

2. Capture squash SHA:
```
   git log origin/main --oneline -1
```

3. Fill `#TBD` / `{TBD}` placeholders in:
   - `docs/CONTEXT.md` — add recently-shipped row for this PR with squash SHA
   - `docs/FOLLOW_UPS.md` — replace `PR #TBD` and `PR #{TBD}` placeholders in the PH7-8 Pre-Track Verifications subsection with actual PR number

4. Commit and push direct-to-main:
```
   git add docs/CONTEXT.md docs/FOLLOW_UPS.md
   git commit -m "docs: fill Phase 7-8 docs integration squash SHA placeholders"
   git push origin main
```

5. Rule 15 verification (verbatim git-log paste-back):
```
   git fetch origin
   git log origin/main --oneline -1
   git rev-parse HEAD
   git rev-parse origin/main
```
   Report back to dispatcher with verbatim output. `HEAD` and `origin/main` SHAs must match. Hard-stop on mismatch.

6. Report format:
```
   Post-merge sequence complete.
   Squash SHA: <full SHA>
   git log origin/main --oneline -1: <verbatim>
   HEAD: <SHA>
   origin/main: <SHA>
   Match: yes
   pushed and verified
```

---

## Out of scope
- Authoring Track D's first PR kickoff brief (separate work after this integration PR ships)
- Any code changes to `awardsEngine.js`, ProfileScreen, dashboards, or any source files
- Updating the phase7-8-PRD.md or phase7-8-implementation.md docs themselves (they're inputs, not editable in this PR)
- Resolving any of the 5 PH7-8 follow-ups (they're banked here for resolution in the respective track design passes)