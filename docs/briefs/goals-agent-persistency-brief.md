# Agent Goal Hierarchy — thread persistency into the hero

## Context
The agent restyle (PR #612, live) shipped the CommitmentHero with API + Apps but **not
Persistency** — the third metric CD designed — because persistency isn't in the `hierarchy`
prop. The audit confirmed the data is cheaply available: the `persistency` array (E3 records
with a derived `.persistency`) is already loaded in AgentDashboard's initial fetch batch via
`getAgentHistory`, so the agent's persistency is a `useMemo` + one new prop away, **zero new
Firestore reads**. This completes the hero's third metric without a loop change.

The one real finding: there is **no personal persistency target**. The loop's Commit
(`commitPlanService`) writes `personalAnnualAPI` + `personalAnnualApps` only — never
`personalAnnualPersistency` — and `getGoalHierarchy` doesn't project it. So the hero shows
the agent's persistency against the **90% company minimum (the floor)**, not a personal
target. (See the banked question for the larger alternative.)

## Decisions locked (surface ANY deviation before implementing)
- **No loop / Commit change. No new fetch. No `getGoalHierarchy` change.** Persistency
  reaches the panel via a new prop, not via the hierarchy.
- Compute the agent's **current persistency** in AgentDashboard from the already-loaded
  `persistency` array (E3 records). **Phase 1 decides the exact value** — see recon item 1;
  it must match how persistency is represented elsewhere in the app so the numbers reconcile
  (likely the most-recent in-force `.persistency`, possibly a current-year aggregate).
- Thread it as a new prop on `GapAnalysisPanel` (e.g. `ytdPersistency`), passed at the
  existing call site (currently `{ hierarchy, ytdTotals, loading, error }`).
- **DECISION POINT — reference value (recommendation baked in; flip on Kyron's word):**
  Render persistency as **actual vs the 90% company minimum** (`companyMinimums.persistency`),
  labelled as the minimum/floor (not "target"). Rationale: persistency is a floor-compliance
  metric, and no personal target is written. *(Alternative requires the banked target path
  below — do not build it here.)*
- **Empty state:** an agent with no persistency history → show "—" / "no data yet" for the
  metric. Do not fabricate a value or default to the floor as if it were actual.
- **Status tone:** current persistency below the 90% floor → `--warning` tone, consistent
  with the API/Apps below-floor honesty already in the hero.
- Nexus tokens, Lucide, ≥44px, both themes, mobile. Match the existing API/Apps metric-row
  treatment so the third metric reads as a peer, not a bolt-on.

## Phase 1 — recon (report findings inline, then PROCEED)
1. **The persistency value** — inspect the `persistency` E3 records (`.persistency`, `.year`,
   `.monthKey`) and how persistency is displayed elsewhere in the app (e.g. any dashboard
   persistency readout). Report whether the hero should show the **latest** in-force
   `.persistency` or a **current-year aggregate**, and match the existing convention so the
   hero number reconciles with the rest of the app. Pick the one that's already canonical.
2. Confirm `companyMinimums.persistency` is `90` and how it's read at this render point.
3. Confirm the hero's metric-row structure so the third metric is added consistently with
   API/Apps (same vs-reference treatment, same tone logic).

## Phase 2 — build
- The `useMemo` for current persistency (empty array → null), the new prop, the hero's third
  metric row (actual vs 90% floor, warning tone below floor, "—" when null).

## Phase 3 — tests
- Extend the panel test: third metric renders with a value; below-floor warning tone; null →
  "—" empty treatment. Keep the suite green.

## Phase 4 — docs + commit/PR
- PR row; note it completes the agent hero (the #612 follow-up), persistency vs floor.
- CONTEXT.md per Rule 16(b): live user-visible UI change — advances Current main HEAD.
- Branch `feat/goals-agent-persistency`; `feat(goals): persistency in agent hero`.
- Push; PR; **Rule 21** Gemini; **Rule 20** HEAD SHA.

## Smoke
**Render smoke (read-only panel), production-facing.** Test agent (has E3 history) → Goals →
assert the hero now shows the **third persistency metric** vs the 90% floor, both themes +
mobile. If reproducible, verify the **null/empty** treatment (agent with no persistency
history → "—"). No write-read needed.

## Merge posture
**Human-merge** — visual hero change, aesthetic gate. Build to PR-open and STOP; eyeball the
three-metric hero in preview, both themes, then merge. Vercel auto-deploys. No rules.

## Banked question (DO NOT build here — for Kyron's separate decision)
Should persistency become a **committed personal target**? That would mean: a persistency
input in Game Plan Step 4, a new `annualPersistency` param threaded into `commitPlan`, and a
write to `personalAnnualPersistency` in the Commit transaction — plus projecting it through
`getGoalHierarchy`. That's a loop change + a product decision (do agents commit a persistency
*goal*, or only clear the floor?), and it's separable from this hero thread. Bank it; don't
fold it in.
