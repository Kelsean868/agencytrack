# Year Plan — Design Scoping Notes (Game Plan Step 2)

> **Status:** Design canon for Game Plan Step 2. Produced after codebase survey (post-PR #569).
>
> **What this is:** settled design decisions, the data model, UX structure, implementation
> phases, and open questions requiring dispatcher ruling — so the kickoff brief starts from
> facts. **What this is not:** a build brief. Each slice earns its own kickoff brief (Rule 10).
>
> **Companion files:**
> - `src/components/dashboard/GamePlanV2/` — StepRail, PlanCascade (both need wiring)
> - `src/services/moneyNeedsService.js` — source of `firstYearCommissionsTargets`
> - `src/utils/awardsEngine.js` + `src/config/awardsRuleset/2026.js` — award thresholds
> - `src/services/goalsService.js` — Commit step feed target (`setGoals`)

---

## TL;DR

Year Plan converts the Money Needs commission-by-line output into a **concrete annual API
target per product line**. Allocation unit = API. Commission is displayed as context, not as
the allocatable value. A new `yearPlan/{year}` subcollection under the user doc stores the
plan. Draft/committed status — committed happens in Step 4 (Commit). License profile is a
new `licenseProfile` field on the user doc that gates which product lines are available.

---

## 1. Key Design Decision — Resolved

**Allocation unit = API (TTD), not commission.**

Rationale:
- API is the production metric the entire app uses (wizard, mastersheet, leaderboard, awards).
- `commissionRate` is a single per-agent value (not per-line); commission is fully derivable
  from API × rate at any time — storing commission as the target would add no precision.
- `setGoals()` (the Commit step's feed target) accepts `{ personalAnnualAPI, personalAnnualApps }` —
  API is already the contract between Year Plan and the goals system.

Display rule: always show commission equivalent alongside API (read-only derived field), so
the agent can trace the line from Money Needs → API target → expected commission. The
relationship is transparent; only the allocation is in API.

---

## 2. Data Model

### 2a. New subcollection: `yearPlan/{year}`

Path: `tenants/{tenantId}/users/{uid}/yearPlan/{year}` (year = 4-digit int, e.g. 2026)

```
{
  year,               // int — partition key
  uid,                // agent uid
  tenantId,

  // License profile snapshot (copied from user doc at save time for historical integrity)
  licenseProfile,     // 'composite' | 'life_only' | 'general_only'

  // Allocation
  allocationMode,     // 'percent' | 'direct'

  lines: {
    life:     { targetAPI, pct, derivedApps, derivedCommission, enabled },
    ah:       { targetAPI, pct, derivedApps, derivedCommission, enabled },
    property: { targetAPI, pct, derivedApps, derivedCommission, enabled },
    motor:    { targetAPI, pct, derivedApps, derivedCommission, enabled },
  },

  totalAnnualAPI,     // sum of enabled lines' targetAPI
  totalAnnualApps,    // sum of enabled lines' derivedApps

  // Source traceability
  derivedFromMoneyNeedsYear,        // year of the source money needs doc
  derivedFromCommissionTotal,       // firstYearCommissionsTargets.total at derivation time

  // Award eligibility (computed client-side at view time; not stored — always fresh)
  // (see §4 — computed from totalAnnualAPI + awardsRuleset at render time)

  status,             // 'draft' | 'committed' — committed set in Step 4 Commit
  createdAt, updatedAt, updatedBy,
}
```

`enabled` flag on each line is derived from `licenseProfile`:
- `composite` → all 4 lines enabled
- `life_only` → `life` + `ah` enabled; `property` + `motor` disabled
- `general_only` → `property` + `motor` enabled; `life` + `ah` disabled

Disabled lines are hidden in the UI (not grayed-out — hidden). They carry `targetAPI: 0,
enabled: false` in the stored doc to keep the shape consistent.

### 2b. New field on user doc: `licenseProfile`

Path: `tenants/{tenantId}/users/{uid}.licenseProfile`

```
licenseProfile: 'composite' | 'life_only' | 'general_only'   // string | undefined
```

Absent/undefined = `composite` (safe default — shows all lines; agent or manager can narrow).

Product line → license mapping:
| Line | Life license needed | General license needed |
|------|--------------------|-----------------------|
| Life | ✓ | |
| A&H | ✓ | |
| Property | | ✓ |
| Motor | | ✓ |

`life_only` holds Life + A&H; `general_only` holds Property + Motor; `composite` holds all four.

**Open decision (STOP — see §6, Q1):** who sets `licenseProfile` — manager-only, or
agent-self-set with manager override?

### 2c. No new Firestore rules/indexes at this scope

`yearPlan/{year}` follows the same tenant-scoped agent-write pattern as `moneyNeeds/{year}`.
Reads: agent reads own doc (`request.auth.uid == uid`). Writes: same. Manager reads via
`isManager() && sameTenant()`. No collectionGroup query needed at this stage.

Composite index needed only if a manager-side list view is introduced (not in scope here).

---

## 3. Commission-to-API Starting Point

Money Needs stores `firstYearCommissionsTargets: { life, ah, property, motor, total }` on the
`moneyNeeds/{year}` doc (commission TTD, not API TTD).

Year Plan derives a **suggested API target per line** at open time:

```
suggestedAPI[line] = firstYearCommissionsTargets[line] / (commissionRate / 100)
```

`commissionRate` sourced from `user.commissionRate` (default 35 if absent).
`playgroundCommissionRate` (goals doc) is an alternative source if the agent has customized it
in the Commission Playground.

**Open decision (STOP — see §6, Q2):** use `user.commissionRate` or `playgroundCommissionRate`
for the starting-point conversion? Or let the agent choose?

This is a **starting suggestion only** — the agent edits the per-line API targets directly.
The formula and the assumed rate are displayed inline ("Based on 35% commission rate") so the
agent understands what they're looking at.

---

## 4. Award Eligibility Strip

Eligibility is computed **client-side** from `totalAnnualAPI` against the live `awardsRuleset_{year}`
doc from Firestore (same source as `awardsEngine.js`). Not stored in the yearPlan doc.

Thresholds to show (from `src/config/awardsRuleset/2026.js` — definitive):

| Award | API threshold | Notes |
|-------|--------------|-------|
| Bronze Club L3 | 250k | lowest club tier |
| Bronze Club L2 | 350k | |
| Bronze Club L1 | 450k | |
| Silver Club | 550k | |
| Gold Club | 650k+ | |
| MDRT | 500k | overlaps club bands |
| Agent of the Year | 1,000k | also needs 50 apps + 90% persist |
| Quarterly Award | ~125k/quarter | implied by annual projection |

Display pattern: show the **next tier the agent would reach** at their current total, plus the
gap. If already past a tier, mark it `✓`. Compact horizontal strip (not full award card).

**Open decision (STOP — see §6, Q3):** show all tiers at once (scrollable), or show only the
"next 2 unlockable" tiers from the current total?

---

## 5. UX Structure

### 5a. Panel entry point

Year Plan opens as an overlay/modal (same pattern as Money Needs within Game Plan v2) or as
an inline expansion. **Open decision (STOP — see §6, Q4):** modal vs inline expansion?

### 5b. Panel sections (order)

1. **Header** — "Year Plan · 2026" + status badge (`draft` = amber, `committed` = green)

2. **License profile picker** — shown first time (licenseProfile absent/unset) OR always
   accessible via a "Change" affordance. 3 radio options with product-line tooltips:
   - Composite License (All 4 lines)
   - Life Only (Life + A&H)
   - General Only (Property + Motor)

3. **Allocation mode toggle** — PERCENT | DIRECT (default: PERCENT)

4. **Product line table** — one row per enabled line
   - Line name (Life / A&H / Property / Motor)
   - Target API input (44px+ touch target, TTD, formatted)
   - PERCENT mode: show % input + sync to API field
   - DIRECT mode: API input only
   - Derived: Apps estimate (read-only; shown with assumption: "~TTD X avg policy")
   - Derived: Commission equivalent (read-only; "~TTD Y at 35%")
   - Disabled lines: not rendered

5. **Totals row** — Total API | Total Apps | Total Commission

6. **Source trace** — "Starting from Money Needs: TTD X commission need (2026)" — links back to
   the Money Needs panel

7. **Award eligibility strip** — compact, horizontal. Next tier + gap. (see §4)

8. **Save as Draft** button → saves/updates the yearPlan doc, status = 'draft'
   Commit is deferred to Step 4; this panel only saves draft.

### 5c. StepRail wiring

Current ([`StepRail.jsx:94`](../../src/components/dashboard/GamePlanV2/StepRail.jsx)):
```jsx
<StepCard variant="next" num="2" kicker="Next" title="Year Plan" sub="Coming soon" />
```

After this PR:
```jsx
<StepCard
  variant={yearPlanFilled ? 'done' : moneyNeedsFilled ? 'next' : 'coming'}
  num="2"
  kicker={yearPlanFilled ? 'Done' : moneyNeedsFilled ? 'Next' : 'Coming'}
  title="Year Plan"
  sub={yearPlanFilled ? formatCurrency(yearPlan.totalAnnualAPI) : 'Split across product lines'}
  onClick={moneyNeedsFilled || yearPlanFilled ? onOpenYearPlan : undefined}
/>
```

`yearPlanFilled` = a `yearPlan/{currentYear}` doc exists for this agent.
`onOpenYearPlan` = new prop on `StepRail`, parallels `onOpenMoneyNeeds`.

### 5d. PlanCascade wiring

Current ([`PlanCascade.jsx:62`](../../src/components/dashboard/GamePlanV2/PlanCascade.jsx)):
```jsx
<ComingRung step="Step 2 · Year Plan" title="Year Plan" desc="Split across product lines" />
```

After this PR: when `yearPlanFilled`, replace with a live rung showing
`totalAnnualAPI` (formatted TTD) + product-line breakdown (compact, 2–4 lines).
When not filled, ComingRung stays as-is.

### 5e. GamePlanV2/index.jsx changes

New props needed:
- `yearPlanData` — loaded from `yearPlanService.getYearPlan(tenantId, uid, year)` (new service)
- `yearPlanFilled` — derived boolean
- `onOpenYearPlan` — new handler (parallels `openMoneyNeeds`)

A new `YearPlanPanel.jsx` component handles the modal/overlay rendering.

---

## 6. Open Decisions — STOP for Dispatcher

All four require dispatcher ruling before the kickoff brief can lock "Decisions locked."

**Q1 — License profile ownership**
Who sets `licenseProfile` on the user doc?
- Option A: **Manager-sets-only** (same as role) — agent sees it read-only; if absent, they're shown a message "Ask your manager to set your license profile."
- Option B: **Agent-self-sets** — agent picks on first open; manager can override.
- Option C: **Agent-self-sets, no override** — agent owns it entirely.

Lean: Option B. Aligns with "show how it's set the first time and changed later" in the brief. Managers already access the edit-user panel (UserManagementPanel) and can override there.

**Q2 — Commission-to-API conversion rate source**
Which `commissionRate` drives the starting-point suggestion?
- Option A: `user.commissionRate` (manager-set, more authoritative)
- Option B: `playgroundCommissionRate` from the goals doc (agent-customized in Commission Playground)
- Option C: Show both with a toggle "Use playground rate / Use my official rate"

Lean: Option A for the derivation, with a tooltip showing "based on your commission rate of X%. Change in your profile." Option C is the most transparent but adds surface complexity.

**Q3 — Award eligibility strip scope**
- Option A: Show **all tiers** — full ladder from Bronze L3 to AGOY. Scrollable if needed.
- Option B: Show only the **next 2 unlockable tiers** from the current total.
- Option C: Show the **current tier + next 2 tiers** above the current total.

Lean: Option C. Rewards the agent for what they've already planned ("you've hit Bronze L3") while showing the immediate aspiration targets.

**Q4 — Panel entry point (modal vs inline)**
- Option A: **Modal overlay** — same pattern as the existing Money Needs panel (full-screen on mobile, centered modal on desktop). Consistent with existing Game Plan UX.
- Option B: **Inline expansion** — expands within the PlanCascade area (no overlay). Feels more integrated; harder to read on small screens.

Lean: Option A (modal). Mirrors the Money Needs pattern already in production; avoids a new layout pattern.

---

## 7. Implementation Slices

Each slice is one PR with its own kickoff brief (Rule 10).

### Slice 1 — Data foundation (XS)
- Add `licenseProfile` to user doc shape (no migration needed — absent = `composite`)
- Add `yearPlanService.js` with `createYearPlan`, `getYearPlan`, `updateYearPlan`
- Firestore rules for `yearPlan/{year}` subcollection
- Unit tests for the service
- No UI yet

### Slice 2 — Year Plan Panel (M)
- `YearPlanPanel.jsx` — full panel with license picker, allocation table, award strip
- `useYearPlan.js` hook — loads yearPlan doc + licenseProfile
- Both themes, axe NO-NEW

### Slice 3 — StepRail + PlanCascade wiring (S)
- Wire `yearPlanFilled` prop into `StepRail` (Step 2 becomes dynamic)
- Wire `yearPlanFilled` + `yearPlan.totalAnnualAPI` into `PlanCascade` (ComingRung → LiveRung)
- Update `GamePlanV2/index.jsx` to load year plan data + pass new props/handlers
- Smoke: verify both states (filled / unfilled) render correctly

### Slice 4 — Commit integration (S, post-Monthly Plan)
- In Step 4 Commit: read `yearPlan.totalAnnualAPI` + `yearPlan.totalAnnualApps`
- Feed into `setGoals()` as `personalAnnualAPI` + `personalAnnualApps`
- Set `yearPlan.status = 'committed'`
- This slice deferred until after Monthly Plan (Step 3) exists, per brief scope note

> **Scope note from brief:** Step 2 panel (Slices 1–3) is in-scope for the first Year Plan brief.
> Slice 4 (Commit integration) lands with or after the Monthly Plan brief.

---

## 8. Integration Constraints

- **No backfill.** `licenseProfile` absent = `composite` at runtime. No migration script.
- **No CF changes.** Year Plan is client-only reads/writes. The `onSubmissionWrite` CF and
  leaderboard aggregate do not change.
- **No index changes for Slice 1–3.** Single-doc reads by uid + year; no composite query.
- **`setGoals()` unchanged.** It already accepts `{ personalAnnualAPI, personalAnnualApps }` at
  aggregate level. Year Plan feeds the total, not per-line values.
- **Coming-soon gate**: `agent-tab-money-needs` remains disabled (PR #542). Year Plan opens
  from within `agent-tab-game-plan` (already accessible). Gate state is unchanged.
- **AgentReportDocument.jsx** — no Year Plan data in the PDF for now (out of scope).

---

## 9. Honest-Data Doctrine Compliance

| Surface | Decision |
|---------|----------|
| StepRail Step 2 while Money Needs unfilled | variant="coming", no onClick — agent cannot reach Year Plan without Money Needs data |
| Starting suggestion while Money Needs has zero commissions | Show $0 suggestion with clear "complete Money Needs first" prompt |
| Award strip when total API = 0 | Show "Set your Year Plan to see award eligibility" placeholder |
| licenseProfile absent | Default to composite (all lines shown) — permissive fallback, never hides data |
| Draft badge on yearPlan | Always show 'draft' badge until Step 4 commits — no implicit "done" state |
