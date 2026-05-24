# Track D — Awards Parity Expansion + BM At-Risk View (D3, Phase-1-FIRST kickoff)

**Track:** D, final piece. Follows the completed ruleset arc: D1 (#283 config extract), D1b (#285 loader), D2a (#287 scalar editor), D2b (#289 array editor) — the awards ruleset is now fully configurable per tenant.
**Type:** Feature scoping. **Risk:** Unknown until scoped — this verify determines whether it's one PR or two.
**Goal:** scope the two remaining Track D items the roadmap names — "awards parity expansion" (§3.2) and "BM at-risk view" (§3.3) of `docs/phase7-8-implementation.md` — into buildable PR(s). These are management-facing.

**PHASE-1-FIRST.** Source-verify, report, STOP — no code. The dispatcher locks scope + PR breakdown before any build.

---

## Phase 0 — clean main
git checkout main
git fetch origin
git pull --ff-only origin main
git status
Untracked scripts/verification/ + scripts/seed/ expected — ignore. Do NOT create a branch (read-only).
Hard stops (Rule 12): not on main, dirty tree beyond known untracked, pull conflict -> `STOP and wait for dispatcher`.

---

## Phase 1 — source-verify, then HARD-STOP

Report each with file:line + short quotes. Pair grep with `git ls-files`. Then emit `STOP and wait for dispatcher`.

1. **The spec.** Read `docs/phase7-8-implementation.md` §3.2 (awards parity expansion) and §3.3 (BM at-risk view) IN FULL. For each: enumerate exactly what it specifies — the feature's intent, the surfaces/components named, the data it needs, and any acceptance criteria. Quote the section headers + the concrete deliverables. If the section numbering has drifted (the doc may have been revised), find the parity-expansion and at-risk-view content wherever it now lives and say so.

2. **Awards parity — current state.** What does "parity expansion" extend? D1 already shipped manager-parity tests (computeManagerAwards golden/parity coverage). Quote the current `computeAgentAwards` / `computeManagerAwards` surface in `awardsEngine.js` and identify what parity is ALREADY covered vs what the spec wants expanded (e.g. award types not yet computed, roles not yet covered, a parity surface in the UI). Be concrete about the gap between shipped and spec.

3. **BM at-risk view — host + data.** Find the Branch Manager dashboard/views (component path, route, how BM role is gated). Determine where an "at-risk" view would mount and what data drives "at-risk" — likely some mix of: agents below the weekly activity floors (Appendix A / `weeklyActivityFloors`), below award-eligibility thresholds (the now-configurable ruleset via `getAwardsRuleset`), or below persistency gates. Quote the data sources already loaded on the BM surface vs what a new query would need. Flag any new Firestore read/index the at-risk view would require.

4. **Reuse + precedent.** Identify existing patterns to mirror: the awards panels (AgentAwardsPanel / ManagerAwardsPanel), any existing "gap"/"variance" surfaces (GapAnalysisPanel), the Master Sheet roll-up, and how at-risk-style flagging is done elsewhere (Track I accountability flag / escalation may be a precedent). Quote the closest precedent for an at-risk list/flag.

5. **Constraints.** Nexus tokens; 44px targets; loading/error/empty states; the `getAwardsRuleset(tenantId, year)` loader as the source of award thresholds (so at-risk respects per-tenant config); parseFloat on numerics.

---

## Phase 1 Recommendations (report, do not implement)
- **PR breakdown:** is this ONE PR or TWO (parity expansion separate from at-risk view)? Recommend, with reasoning based on coupling found.
- **Parity expansion:** exact scope of what to add (award types / roles / surfaces), and whether it's engine-only, UI, or both.
- **At-risk view:** recommended host + the at-risk definition (which thresholds, sourced from `getAwardsRuleset` + `weeklyActivityFloors` + persistency), whether it needs a new Firestore read/index (flag for a separate rules/deploy step if so), and the UI shape (list, flags, drill-down).
- **Data freshness:** does at-risk compute from already-loaded data or need new queries? Prefer derive-from-loaded where possible.
- **Tests + smoke** outline for each PR.

**STOP and wait for dispatcher.**
