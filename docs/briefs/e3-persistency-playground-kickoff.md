# E3 — Persistency Playground & Tracking

**Status:** Ready to ship after security PR (chore/security-remove-sa-key) merges.
**Estimated CC effort:** 3-5 days, single PR.
**Two-strike counter:** 0/2 (fresh session).

---

## Context

AgencyTrack receives a monthly persistency report from Tatil Life ~2 weeks after month-end. Persistency is a 12-month rolling calculation that gates 90%+ of the 2026 incentive awards. Until now, agents and managers have had no in-app visibility into their persistency. This feature changes that and adds an interactive what-if calculator (the "Playground") so agents can model paths to a target persistency.

**Phase 1 (this PR):** Manual entry by branch managers and agents. No PDF parser.
**Phase 2 (deferred to post-pilot):** Auto-parse the Tatil monthly report PDF.

---

## Decisions locked (do not re-litigate)

- **Currency:** TTD only.
- **Aggregation rule:** SUM underlying numerator and denominator values, then divide. NEVER average individual persistency percentages. This is the most bug-prone area — explicit tests required.
- **Manual entry first.** Both branch managers AND agents can enter figures; if both enter for the same month, manager's entry wins (overwrites with audit trail).
- **Playground access:** both agents (own data) and managers (any agent's data, coaching mode).
- **Award gate threshold:** 90% (visual reminder only, no enforcement logic).
- **Scope:** SINGLE PR. Manual entry, display, and Playground ship together.
- **No "Save scenario" button** in Playground (lean — defer to post-pilot if agents request).

---

## The persistency formula (validated against Tatil's Feb 2026 report)

```
Gross Settled = (Business Placed − Not Takens) + Inc PPPs + (Lumpsums × 0.10)
Net Settled   = Gross Settled − Lapses + Reinstatements
Persistency   = Net Settled / Gross Settled
```

Validated against Ricardo Duke's row in the Mikel Granderson branch:
- Gross 406,335.53 = (357,468.84 − 0) + 48,000 + 866.69 ✓
- Net 300,397.73 = 406,335.53 − 133,600.08 + 27,662.28 ✓
- Persistency 73.93% (reports as 74%) ✓

Note: This formula differs from Kelsean's original Excel calculator, which only had `Placed − Not Taken`. The real report adds Inc PPPs and 10% of Lumpsums into Gross Settled.

---

## Schema

**Collection path:** `/tenants/{tid}/persistency/{agentId}_{YYYY_MM}` (flat doc — matches the existing codebase pattern used everywhere else in AgencyTrack: e.g. `submissions/{agentId}_{weekStarting}`, `settlements/{agentId}_{year}_{periodKey}`. Do NOT introduce a nested subcollection pattern here.)

**Document ID format:** `{agentUid}_{YYYY_MM}` — e.g. `J0j4uBqzTPcfm1IlGCPyDzo27RP2_2026_02`. The `YYYY_MM` portion is the 12-mo period ENDING that month.

**IMPORTANT — backward compatibility:** A legacy persistency doc shape already exists in the codebase (Architecture doc §Persistency Document — fields: `agentId`, `year`, `month`, `value`, `enteredBy`, `enteredAt`, `notes`). E3 extends this same collection. Discovery (Phase 2) MUST inspect `agentOfMonthService.js` AND any existing references to `/tenants/{tid}/persistency/` to confirm no existing service writes the legacy `value` field anywhere we'd be overwriting. Document findings in discovery notes. If legacy docs exist in production, surface to Kelsean before Phase 4.

**Field shape (all required unless noted):**
```
{
  // Identity
  agentId: string              // matches uid portion of doc ID
  tenantId: string             // for cross-collection queries
  year: number                 // 2026
  month: number                // 1-12
  monthKey: string             // '2026-02' (denormalised for query convenience)
  reportPeriodStart: string    // '2025-03-01' (12 mo ending monthKey)
  reportPeriodEnd: string      // '2026-02-28'

  // Audit
  enteredAt: Timestamp         // first-entry timestamp
  enteredBy: uid               // first-entry uid
  enteredByRole: 'agent' | 'unit_manager' | 'branch_manager' | 'sales_manager' | 'tenant_admin'
  lastEditedAt: Timestamp      // updated on every overwrite
  lastEditedBy: uid
  lastEditedByRole: same enum as enteredByRole

  // Input fields (TTD, parseFloat enforced, non-negative)
  businessPlaced: number
  notTakens: number
  incPPPs: number              // 12 Month Inc PPPs total
  lumpsums100: number          // total lumpsums (we apply 10% in calc)
  lapses: number
  reinstatements: number

  // Calculated + stored for query efficiency
  grossSettled: number
  netSettled: number
  persistency: number          // 0-1 decimal (NOT percentage)
  meetsAwardGate: boolean      // persistency >= 0.90

  // Legacy field — DEPRECATED, do not write
  value?: number               // legacy percentage (92.5 = 92.5%). Read only for migration check.
  notes?: string               // legacy field, optional
}
```

**Firestore rules — THIS IS A MODIFICATION, not a new block.** The existing rule for `/tenants/{tenantId}/persistency/{docId}` (in `firestore.rules`) currently reads:
```
allow read: if isSignedIn() && isInTenant(tenantId);
allow write: if isManager() && isInTenant(tenantId);
```
**Replace** that block (do not add alongside) with role-scoped rules:
- Agents: read AND write own persistency doc (where `resource.data.agentId == request.auth.uid`).
- Unit Managers: read all docs where the agent's unitId matches the manager's unitId.
- Branch Managers: read AND write all docs where the agent's branchId matches the manager's branchId.
- Sales Managers: read all docs in tenant.
- Tenant Admins: read all docs in tenant.
- Validation on write: all six numeric input fields non-negative; `tenantId == getTenantId()`; `enteredByRole` matches the writer's actual claim role.

CC must show both the OLD and NEW rule blocks in the PR description to confirm the existing rule was replaced, not duplicated.

---

## Phases

### Phase 1 — Sync + worktree
```bash
git fetch origin --prune
git pull origin main
# Create worktree: .claude/worktrees/feat-e3-persistency
# Branch: feat/e3-persistency-playground
```

### Phase 2 — Discovery (MANDATORY — read DOM, not just code)

Inspect rendered DOM in Vercel preview after first commit:
- ManagerDashboard tab structure (note how AOM tab and ProductionReport tab integrate)
- AgentDashboard insertion point for new Persistency tab
- Existing tab styling/spacing conventions
- Read `src/services/agentOfMonthService.js` (similar service shape)
- Document findings in `docs/e3-persistency-discovery-notes.md` BEFORE writing components

This is non-negotiable. Walk script selector quality has been a recurring issue (E5.1 4/16 fails, E6 9/18 fails) — DOM inspection during discovery prevents this.

### Phase 3 — Pure calculation library (test-first)

Create `src/lib/persistency/calculations.js` with pure functions (no Firestore dependencies):

```js
calculateGrossSettled({ businessPlaced, notTakens, incPPPs, lumpsums100 })
  // returns (businessPlaced - notTakens) + incPPPs + (lumpsums100 * 0.10)

calculateNetSettled({ grossSettled, lapses, reinstatements })
  // returns grossSettled - lapses + reinstatements

calculatePersistency({ netSettled, grossSettled })
  // returns netSettled / grossSettled, OR 0 if grossSettled is 0
  // result is decimal 0-1, NEVER percentage

aggregatePersistency(agentRecords)
  // CRITICAL: SUMS underlying values, then divides
  // returns { sumGrossSettled, sumNetSettled, sumLapses, sumReinstatements, aggregatedPersistency }
  // NEVER average individual percentages

projectPersistency({
  currentGrossSettled,
  currentLapses,
  currentReinstatements,
  goodBusinessFallingOff,    // business older than 12mo dropping off
  newBusinessPlanned,
  newReinstatementsPlanned,
  newOrphansAdopted,         // orphans count as new business in gross settled
  newLapsesAnticipated
})
  // NB and Orphans both add to gross settled (mathematically identical)
  // Reinstatements add to net settled only
  // goodBusinessFallingOff REDUCES gross settled (rolling window)

calculateShortfall({ currentPersistency, targetPersistency, currentGrossSettled, currentLapses, currentReinstatements, goodBusinessFallingOff })
  // returns { nbNeeded, nrNeeded, noNeeded }
  // Algebraically solve for each lever independently
```

**Tests** (`src/lib/persistency/__tests__/calculations.test.js`):
- Validate against actual Tatil report data (Ricardo Duke row, Mikel Granderson branch sub-total)
- Validate aggregation produces correct branch-level number when summing multiple agents
- Edge cases: zero gross settled returns 0% (not NaN), single agent unit, all-zero records
- **Explicit anti-test**: average-of-percentages approach must produce different result than correct sum-then-divide approach for a known dataset. Document why this matters.

### Phase 4 — Service layer

Create `src/services/persistencyService.js`.

**Tenant isolation pattern (NON-NEGOTIABLE, per SEC-9):**
- All Firestore reads/writes inside this service MUST resolve tenantId by calling `getTenantId()` from `firebase.js`.
- Do NOT accept tenantId as a parameter from callers.
- Do NOT read `import.meta.env.VITE_TENANT_ID` directly.
- Do NOT read tenantId from props, AuthContext, or anywhere else inside the service.
- If `getTenantId()` returns null (signed-out state), throw an explicit error — do not silently fail or default.
- Reference implementation: `src/services/managerService.js` and `src/services/persistencyService.js` (if exists in legacy form) — match their pattern.

**Service surface:**
- `getPersistencyForAgent(monthKey, agentUid)` → record or null
- `getPersistencyForUnit(monthKey, unitId)` → array of records
- `getPersistencyForBranch(monthKey, branchId)` → array of records
- `getAvailableMonths(scopeId, scopeType)` → array of monthKeys (`['2026-02', '2026-01', ...]`)
- `getAgentHistory(agentUid, lastNMonths)` → array sorted oldest first
- `savePersistency(monthKey, agentUid, inputs, role)` 
  - Calculates derived fields via calculations.js
  - On first write: sets `enteredAt`, `enteredBy`, `enteredByRole`, `lastEditedAt`, `lastEditedBy`, `lastEditedByRole` (last three == first three).
  - On overwrite: preserves `enteredAt`/`enteredBy`/`enteredByRole`, updates only the `lastEdited*` fields.
  - `role` parameter is the writer's claim role (must be one of the enum values in Schema).
- `calculateAndCacheBranchAggregate(monthKey, branchId)` → aggregate doc

**Acceptance test (must be in PR description):** Sign in as test agent (uid `J0j4uBqzTPcfm1IlGCPyDzo27RP2`, tenant `tatillife_south`), call `savePersistency`, verify the written doc has `tenantId: 'tatillife_south'`. Then sign in as a user with a different tenantId and verify the read for the first agent's doc is denied by rules. Screenshot both states in PR.

Service tests in `src/services/__tests__/persistencyService.test.js`. Mock Firestore. Validate calculations applied on write. Validate that calling `savePersistency` when `getTenantId()` returns null throws.

### Phase 5 — Manager UI (PersistencyTab)

**Files:**
- `src/components/manager/PersistencyTab.jsx`
- `src/components/manager/PersistencyEntryForm.jsx`
- `src/components/manager/PersistencyAgentRow.jsx`
- `src/components/manager/__tests__/PersistencyTab.test.jsx`

**Layout:**
- **Top row:** Month selector (dropdown of available months, defaults to most recent)
- **Branch summary card:**
  - Big number: branch persistency %
  - Color-coded (green ≥90%, amber 80-89%, red <80%)
  - Sub-stats: gross settled, net settled, lapses, reinstatements (aggregated)
- **Unit breakdown:** Each unit's aggregated persistency, click to expand to agents
- **Agent list:**
  - Sortable by persistency (default), name, gross settled
  - Each row: avatar, name, persistency badge, "Edit" button
  - 90% threshold visually highlighted
  - "Open Playground" button per agent
- **Action:** "Add new month" button → creates next month's empty entries

**Entry form** (modal or expandable row):
- 6 input fields with TTD prefix: Business Placed, Not Takens, Inc PPPs, Lumpsums (100%), Lapses, Reinstatements
- Live preview of: Gross Settled, Net Settled, Persistency %
- Save → persistencyService.savePersistency()
- Cancel → close without saving

**Tab integration:** Insert "Persistency" tab in ManagerDashboard.jsx between AOM and report tabs. `data-testid="tab-persistency"`.

### Phase 6 — Agent UI (PersistencyTab)

**Files:**
- `src/components/agent/PersistencyTab.jsx`
- `src/components/agent/__tests__/PersistencyTab.test.jsx`

**Layout:**
- Top: Big persistency number for current month (color-coded)
- **Award gate banner if <90%:**
  > "Your persistency is X%. Awards require 90% minimum. Use the Playground below to model your path."
- **Trend chart:** Last 6-12 months, line chart with 90% threshold line marked
- **Self-entry form** (collapsible):
  - Same 6 fields as manager
  - Visible when manager hasn't entered yet for current month
  - Locked when manager has entered (shows manager's data)
- **"Open Playground" button** → opens PersistencyPlayground component

**Tab integration:** Insert "Persistency" tab in AgentDashboard.jsx. `data-testid="agent-tab-persistency"`.

### Phase 7 — Playground (the differentiating feature)

**Files:**
- `src/components/persistency/PersistencyPlayground.jsx`
- `src/components/persistency/__tests__/PersistencyPlayground.test.jsx`

Used by both agents (own data) and managers (any agent's data, coaching mode).

**Inputs panel** (sliders + numeric):

*Section 1 — Current State* (read-only, populated from Firestore):
- Current Gross Settled: TTD X
- Current Lapses: TTD X
- Current Reinstatements: TTD X
- Current Persistency: X%

*Section 2 — Target:*
- Target Persistency: slider 80-100%, default 92%
- Target Date: month picker (default end of current 12-mo rolling window)

*Section 3 — Projections* (sliders/inputs):
- Good Business Falling Off: TTD (default 0, agent estimates)
- New Business to Place: TTD (slider 0-1M, step 5K)
- New Reinstatements: TTD (slider 0-200K, step 1K)
- New Orphans Adopted: TTD (slider 0-500K, step 5K)
- New Lapses Anticipated: TTD (slider 0-500K, step 5K)

**Output panel** (live update on slider change):
- Big number: Projected Persistency (color-coded)
- Progress bar: Current → Projected → Target
- Three "what-if" cards (each shows isolated lever):
  - Card 1: "Via New Business: TTD X needed"
  - Card 2: "Via Reinstatements: TTD X needed"
  - Card 3: "Via Orphan Adoption: TTD X needed"

Use react-hook-form or controlled state. Animate slider value changes.
Test: validate output values match calculations.js for known inputs.

### Phase 8 — Branch Report (manager-only sub-feature)

"Branch Report" button in PersistencyTab opens a printable view:
- Branch totals
- Per-unit aggregates
- Per-agent rows
- "Download as CSV" button (use Papa Parse, already in deps)
- "Print" CSS view that renders cleanly

### Phase 9 — Comprehensive tests

`npm test` → 100% pass.

Cover:
- calculations purity
- aggregation correctness (with sum-vs-average rejection test)
- service write/read with calculations applied
- component render
- manager edit flow
- agent self-entry flow
- playground projection accuracy
- award gate display logic

### Phase 10 — Walk script

Create `scripts/verification/e3-persistency-walk.mjs`. **Target: ≥14/18 walk pass rate.**

Use stable selectors:
- `data-testid` attributes throughout (add as you build, not retrofitted)
- Scoped role queries with `.first()`
- Avoid generic `locator('nav')`, `locator('button[name="X"]')` — they fail on duplicates

Inspect rendered DOM in Vercel preview during build, NOT after.

**Tests:**
1. `01_manager_login_renders`
2. `02_persistency_tab_visible` (data-testid="tab-persistency")
3. `03_month_selector_loads_options`
4. `04_branch_summary_shows_aggregated_persistency`
5. `05_agent_list_renders_with_correct_count`
6. `06_ninety_percent_threshold_visually_marked`
7. `07_entry_form_opens_for_agent_row`
8. `08_entry_form_calculates_persistency_live`
9. `09_entry_form_saves_to_firestore`
10. `10_saved_data_persists_after_reload`
11. `11_agent_login_renders`
12. `12_agent_persistency_tab_shows_own_data`
13. `13_award_gate_banner_when_under_90`
14. `14_trend_chart_renders_with_history`
15. `15_playground_opens_from_agent_view`
16. `16_playground_sliders_update_projection_live`
17. `17_playground_shortfall_cards_show_three_levers`
18. `18_mobile_380px_layout_no_overflow`

### Phase 11 — Lint + commit + push + PR

- `npm run lint` → 0 errors (lint after EVERY commit that adds files — project-permanent rule)
- Multiple commits OK; each with conventional commit message
- Push, open PR
- **PR title:** `feat(e3): persistency playground — manual entry, 12-month tracking, what-if modeling`
- **PR description must include:**
  - Summary
  - List of components/services added
  - Test count and pass rate
  - Walk pass rate (X/18)
  - Screenshots: manager view, agent view, playground (use Vercel preview + bypass token)
  - Verification matrix (commands run + outputs)

### Phase 12 — STOP

DO NOT MERGE. Kelsean reviews and merges manually after smoke test.

---

## Hard stops

- `npm run lint` fails → fix immediately, don't commit broken state
- Test suite fails → STOP and surface
- Walk pass rate below 11/18 → STOP and surface (selector quality issue — re-do discovery)
- CI gate fails on the PR (lint or build) → STOP and fix before requesting review (the gate blocks merge regardless)
- Discovery (Phase 2) finds existing services writing to `/tenants/{tid}/persistency/` with the legacy `value` field → STOP and surface to Kelsean before Phase 4 (schema collision risk)
- Firestore rules deploy fails or rule simulator shows existing agents losing read access they had → STOP and surface (rules MODIFICATION gone wrong)
- Two strikes hit → STOP

---

## NOT in scope (do NOT build)

- PDF parser for Tatil monthly report (deferred to post-pilot E3.2)
- Email notifications when persistency drops
- Cloud Functions (Phase 1 is purely client + Firestore rules)
- Cross-tenant aggregation
- Persistency API for external integrations
- Award qualification enforcement (just visual gate banner)
- Historical month edit-locking
- Multi-currency
- "Save scenario" button in Playground
- Push notifications

---

## Design guidance

- Use existing Nexus warm theme tokens (`--color-primary`, `--color-surface`, `--color-card`, etc.)
- Lucide icons: `TrendingUp` for trend, `Target` for goals, `AlertCircle` for award gate, `Calculator` for playground
- 44px touch targets minimum
- Mobile responsive (380px viewport must work)
- Persistency badge colors:
  - Green ≥90% (`--color-success`)
  - Amber 80-89% (`--color-warning`)
  - Red <80% (`--color-danger`)
- Currency display: "TTD X,XXX.XX" or "$X,XXX.XX TTD"
- All percentages displayed with one decimal place (e.g., 75.8%, not 75% or 75.82%)

---

## Verification matrix (CC must include in PR description)

| Item | Command | Expected |
|------|---------|----------|
| Lint clean | `npm run lint` | 0 errors |
| Tests pass | `npm test` | 100% pass |
| Walk pass rate | `node scripts/verification/e3-persistency-walk.mjs` | ≥14/18 |
| Build succeeds | `npm run build` | success, no warnings |
| Discovery doc | `dir docs\e3-persistency-discovery-notes.md` | exists |
| Calculations validation | (test output) | matches Tatil Feb 2026 data |
| Aggregation rejection test | (test output) | sum-then-divide ≠ average |

---

## Sample test data (for CC's validation)

Use this real data from Tatil's February 2026 persistency report to validate calculations:

**Ricardo Duke (Mikel Granderson branch):**
- Business Placed: 357,468.84
- Not Takens: 0
- Inc PPPs: 48,000
- Lumpsums 100%: 8,666.90
- Lapses: 133,600.08
- Reinstatements: 27,662.28
- Expected Gross Settled: 406,335.53
- Expected Net Settled: 300,397.73
- Expected Persistency: 0.7393 (74%)

**Mikel Granderson branch sub-total (multiple agents aggregated):**
- Aggregated Gross Settled: 1,126,479.43
- Aggregated Net Settled: 733,177.39
- Aggregated Persistency: 0.6509 (65%)

These numbers MUST match when CC's calculations.js processes the inputs.

---

## CC kickoff prompt (one-liner)

> Execute E3 — Persistency Playground per the brief at `docs/briefs/e3-persistency-playground-kickoff.md`. Two-strike counter 0/2. Read the brief in full (do not skim — every locked decision matters), then begin Phase 1. Surface before any deviation from locked decisions, especially the Schema section (which is a known modification to an existing collection). Do NOT merge — open PR and stop.
