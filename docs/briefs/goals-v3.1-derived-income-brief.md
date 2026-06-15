# Kickoff brief — Goals v3.1: Derived Income Panel

**Type:** S (1 new component, 1 edit, 1 test file)  
**Dispatched:** 2026-06-15  
**Authority:** RUN addendum — BUILD-AND-HOLD  
**Design ref:** `design_handoff_v2_app/Agent Goals - Derived Income Build.html`  
**Spec ref:** `docs/goals-v3-spec.md`  
**Rule 10 note:** This brief commits to `docs/briefs/` per Rule 10 before dispatch.

---

## Feature summary

Add `DerivedIncomePanel` — a display-only income estimate card — directly below `GapAnalysisPanel`
in the agent Goals tab (AgentDashboard). Shows what the agent's committed production goal will
earn at their profile commission rate: annual income, per-month average, and YTD earned estimate.

**No inputs, no set-target.** Pure display. Three explicit states:
1. **Loading** — shimmer skeleton (4 bars)
2. **No committed goal** — empty state, CTA button directs agent to commit a goal (button is
   display-only, no routing)
3. **Rate unset** — warning state, "Rate not on file" — when `userProfile.commissionRate` is
   absent/0 the income cannot be derived
4. **Populated** — full income equation card (see § Design below)

---

## Source verification (Rule 17)

### Render site
`src/components/dashboard/AgentDashboard.jsx:670–678` — `activeTab === 'goals'` block renders
`<GapAnalysisPanel>` then closes with `)}`. DerivedIncomePanel goes inside the same block,
immediately after `</GapAnalysisPanel>`, separated by a thin divider.

**Phase 1 verification command:**
```
grep -n "activeTab === .goals" src/components/dashboard/AgentDashboard.jsx
```
Expected: one hit near line 669.

### committedAPI source
`hierarchy.personal.api` — from `getGoalHierarchy()` result stored in `hierarchy` state
(AgentDashboard ~line 374–382). Already available as a prop of GapAnalysisPanel and in scope
for the goals tab render.

**Phase 1 command:**
```
grep -n "personal.*api\|personalAnnualAPI\|hierarchy" src/services/goalsService.js | head -10
```
Expected: `personal.api` populated from `personalDoc.personalAnnualAPI` (line ~335).

### commissionRate source
`parseFloat(userProfile?.commissionRate) || null`  
**Deliberately null (not 35) when absent** — triggers "rate unset" state rather than guessing.
`userProfile` is from `useAuth()` at AgentDashboard line 97.

Verification: CommissionPlayground line 60 confirms the field name is `userProfile.commissionRate`
and the value is a 0–100 percentage (e.g. 35 = 35%).

### ytdAPI source
`ytdTotals.api` — computed at AgentDashboard line 283–296 from `allSubmissions` for current year.
Already passed to GapAnalysisPanel; same reference available in goals tab scope.

### Math
```
annualIncome = committedAPI × (commissionRate / 100)
perMonth     = annualIncome / 12
ytdEarned    = ytdTotals.api × (commissionRate / 100)
ytdPct       = ytdTotals.api / committedAPI × 100   (commission rate cancels)
```
Source: `commissionMath.js:21` confirms `commissionRate` is 0–100, applied as `C / 100`.
DerivedIncomePanel uses the single-rate "blended" simplification (no mode mix weighting) per spec.

### Token map (Nexus — verified in src/index.css + tailwind.config.js)
| Design spec name | Nexus class/var |
|---|---|
| `bg-card / border-border` | `bg-card border border-border` |
| `bg-teal-tint` (income pane) | `bg-primary-tint` |
| teal border on income pane | `border-primary/40` |
| big number (light/dark) | `text-primary-dark dark:text-ink` |
| operator/assumptions bg | `bg-surface-raised` |
| header icon bg | `bg-primary-tint` |
| header icon color | `text-primary` |
| label/badge bg | `bg-surface-muted` |

No `teal-tint` or `teal-dark` custom tokens — design used descriptive names; map to existing
Nexus primary-* tokens above. No new CSS variables needed.

---

## Decisions locked

- **New file:** `src/components/goals/DerivedIncomePanel.jsx`
- **Edit:** `src/components/dashboard/AgentDashboard.jsx` — add import + render below GapAnalysisPanel
- **New test:** `src/components/goals/__tests__/DerivedIncomePanel.test.jsx`
- **Agent-only.** No GoalsPanel (manager) changes — manager doesn't have `commissionRate` or a personal committed goal.
- **Rate unset = null.** `parseFloat(userProfile?.commissionRate) || null` — no 35 default.
- **Divider:** a simple `<div className="border-t border-border mt-2" />` + caption label above DerivedIncomePanel
- **CTA button** in no-goal state is display-only text ("Go to Game Plan →") — no routing/tab switch.
- **Lucide icons:** PiggyBank, Sigma (optional for badge), X, TrendingUp, CalendarDays, Info
- **No new CSS variables.** All styling via existing Tailwind utilities.
- **No Firestore reads.** All data flows from props already fetched by AgentDashboard.
- **BUILD-AND-HOLD.** Human-merge required (new UI surface, aesthetic judgment call).

---

## Phase 0 — branch + sync

```powershell
git checkout main
git fetch origin && git pull origin main
git checkout -b feat/goals-v3.1-derived-income
```

## Phase 1 — source verify

1. Confirm render site line number:
   ```
   grep -n "activeTab === .goals" src/components/dashboard/AgentDashboard.jsx
   ```
2. Confirm `hierarchy.personal.api` field exists in goalsService:
   ```
   grep -n "personal\b" src/services/goalsService.js
   ```
3. Confirm `userProfile` available in AgentDashboard goals tab scope:
   ```
   grep -n "userProfile" src/components/dashboard/AgentDashboard.jsx | head -5
   ```
4. Confirm `ytdTotals` available in goals tab scope:
   ```
   grep -n "ytdTotals" src/components/dashboard/AgentDashboard.jsx | head -5
   ```
5. Hex-grep baseline (no new hex should appear after edit):
   ```
   grep -n "#[0-9a-fA-F]\{3,6\}" src/components/goals/DerivedIncomePanel.jsx
   ```
   Expected: empty (no hex). Any hit is a gate failure.

If any premise is wrong (field absent, line numbers wildly off, token missing) → **STOP and wait
for dispatcher.**

## Phase 2 — implementation

### 2a. New file: `src/components/goals/DerivedIncomePanel.jsx`

Three sub-components + one export:
- `IncomeEquation` — the committed × rate = income flow (horizontal on ≥640px, stacked on mobile)
- `AssumptionsNote` — info-icon disclaimer block
- `DerivedIncomePanel` (default export) — three-state controller

States by priority (highest → lowest):
1. `loading` prop → shimmer skeleton (4 `h-6 bg-surface-muted rounded animate-pulse` bars)
2. `!committedAPI` → empty state card (PiggyBank icon in `bg-primary-tint` pill, text, display CTA)
3. `!commissionRate` → warning state card (AlertTriangle icon, "Rate not on file" text)
4. populated → IncomeEquation card + AssumptionsNote

Props:
```js
DerivedIncomePanel({ hierarchy, ytdTotals, commissionRate, loading })
```
Where `commissionRate` is already parsed (number | null) from caller.

Internal math:
```js
const committedAPI   = hierarchy?.personal?.api ?? null;
const annualIncome   = committedAPI && commissionRate ? committedAPI * (commissionRate / 100) : null;
const perMonth       = annualIncome ? annualIncome / 12 : null;
const ytdAPI         = ytdTotals?.api ?? 0;
const ytdEarned      = annualIncome ? ytdAPI * (commissionRate / 100) : null;
const ytdPct         = committedAPI > 0 ? Math.min(100, Math.round((ytdAPI / committedAPI) * 100)) : null;
```

### 2b. Edit: `src/components/dashboard/AgentDashboard.jsx`

Add import at top (near other goals imports):
```js
import DerivedIncomePanel from '../goals/DerivedIncomePanel';
```

In goals tab block (after `</GapAnalysisPanel>`, before closing `})`):
```jsx
<div className="mt-4 border-t border-border pt-4">
  <DerivedIncomePanel
    hierarchy={hierarchy}
    ytdTotals={ytdTotals}
    commissionRate={parseFloat(userProfile?.commissionRate) || null}
    loading={hierarchyLoading}
  />
</div>
```

## Phase 3 — verification

```
npm run lint && npm test && npm run build
```

All must pass. Additionally:

**Hex-grep** (no hardcoded hex in new file):
```
grep -n "#[0-9a-fA-F]\{3,6\}" src/components/goals/DerivedIncomePanel.jsx
```
Expected: zero hits.

**Scope-lock grep** (only 3 files changed):
```
git diff --name-only
```
Expected: `src/components/goals/DerivedIncomePanel.jsx`,
`src/components/dashboard/AgentDashboard.jsx`,
`src/components/goals/__tests__/DerivedIncomePanel.test.jsx`

If lint/test/build fails on a file outside this set → **STOP and wait for dispatcher.**

## Phase 4 — PR

Open PR: `feat(goals): v3.1 derived income panel — display-only income estimate below gap analysis`

PR body must include:
- Feature description + three states
- Math formula box
- Token-map table
- File inventory (3 files)
- Checklist (Rule 18 — smoke unchecked at open time)
- Gemini disposition table (Rule 21)
- Self-critique gap (Rule 22)
- BUILD-AND-HOLD label

## Phase 5 — smoke

Run `scripts/verification/axe-finds-acd-smoke.mjs` against the Vercel preview to verify:
- No NEW axe violations vs main on the Goals tab leg (if the smoke covers it)
- Both light and dark mode pass

If the smoke script does not exercise the Goals tab, note the gap (Rule 22). The axe-finds smoke
currently covers Dashboard, Awards, and Bell — not Goals. This should be noted as a self-critique
gap. Functional smoke: load the Goals tab in preview in incognito (login → Goals tab), confirm
panel renders in all three state scenarios (force states by noting which require specific data).

Report final HEAD SHA (Rule 20) before declaring pre-review hold.

## Acceptance criteria

- `npm run lint && npm test && npm run build` all pass
- `DerivedIncomePanel.test.jsx` covers: loading state, no-goal state, rate-unset state, populated state renders formatted income values
- No hardcoded hex in DerivedIncomePanel.jsx
- Goals tab in Vercel preview shows panel below gap analysis in both themes
- No new axe violations introduced (Goals tab in preview smoke)
- CI `lint-and-build` + `functions-tests` both `SUCCESS`
- PR is BUILD-AND-HOLD — open PR, surface URL, do NOT merge
