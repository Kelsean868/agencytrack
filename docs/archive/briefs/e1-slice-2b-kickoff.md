# E1 Slice 2B — Surface Adaptation + PDF Redesign + Awards V2 Compat

## Source

- Spec: `docs/Track-E-Specs.md` §E1
- Foundation:
  - PR #68 — schema utilities, migration script, V2-aware extractors
  - PR #69 — wizard restructure (3-source capture: NB / PPP / LMPS)
- Planning decisions (May 9 2026, with Kyron):
  - **API metric:** Total Production API everywhere — NB.api + PPP.apiIncrease + LMPS.apiCredit. Matches Tatil whiteboard semantics and award thresholds.
  - **Commissionable API:** compartmentalized to Commission Playground (existing) + wizard review screen (new this slice).
  - **PDF format:** whiteboard-style breakdown (NB / PPP / LMPS / Total columns) for **both** agent self-view and manager-tier downloads.
  - **Slice 2B scope:** full — audit + surface updates + wizard review breakdown + PDF redesign + awards V2 verification.
  - **V1 fallback:** keep indefinitely in `extractFields.js` as defensive code.

## Scope

### IN — this PR

1. Comprehensive API-usage audit across codebase (output: `docs/e1-slice-2b-audit.md`)
2. `extractFields.js` enhanced with `totalProductionCredit` + `totalCommission` extractors (V2-first, V1 fallback)
3. Surface updates: AgentDashboard, ManagerDashboard, MasterSheet, gapAnalysis, weeklyChampions, awardsEngine, MotivationalCarousel
4. Wizard review screen (`screen === 'review'` in `WizardForm.jsx`) — adds production credit + commission breakdown panel before submit
5. PDF reports redesigned with whiteboard-style breakdown columns (agent + manager-tier variants)
6. Awards V2 verification — `awardsEngine.js` reads V2 schema correctly via the new extractors
7. Vitest unit tests for new extractors + awardsEngine V2 paths
8. Playwright verification walk — **HARD REQUIREMENT** this slice (not deferrable; soft strike from 2A still standing)

### OUT — deferred

- TV display kiosk (E5, post-pilot)
- Real Tatil tenant setup
- Pilot launch operational checklist
- Daily input mode (E6 — next pre-pilot HIGH after this lands)

## Discipline gates

- Single-branch PR rule
- Fetch-first
- **Two-strike counter starts at 1/2** — Playwright skip from Slice 2A still standing. This session, Playwright is a hard requirement; skipping again would trip strike 2.
- No auto-merge — substantial code change touching live UI
- Phases produce intermediate state. Stop and surface between phases if complications arise.
- Bundle CONTEXT.md sync into this PR's first commit (HEAD will be stale after #69 merged)

---

## Phase 1 — Sync + worktree

```
git fetch origin --prune
git checkout main
git pull origin main
git log origin/main --oneline -5   → capture current HEAD SHA
```

Verify `docs/CONTEXT.md` § "Current main HEAD" matches actual HEAD. It will be stale (#69 merged after last sync). Bundle the CONTEXT.md bump into this PR's first commit:

- HEAD reference → current
- Add PR #69 to "Recently shipped" table
- Update "Where we left off" to reflect Slice 2B in progress
- Update active follow-up row for Track E

Branch: `feat/e1-slice-2b-surface-adaptation`
Worktree: `.claude/worktrees/feat-e1-slice-2b-surface-adaptation`

---

## Phase 2 — API-usage audit

**Critical pre-work.** Document every place "API" is read, computed, or displayed before touching any code.

### Discovery scope

Grep for these patterns across `src/`:
- `apiSold` (V1 alias)
- `applicationsSold` (V1 alias)
- `\.api\b` (might catch newBusiness.api as well)
- `extractFields\(` callers
- `totalProductionCredit` (already exists in V2 schema — confirm callers know about it)

### Output: `docs/e1-slice-2b-audit.md`

Table format:

| File:line | Type | Current behavior | Target metric | Risk |
|---|---|---|---|---|
| AgentDashboard.jsx:142 | display | `extractFields(s).api` → KPI card | totalProductionCredit | high (user-visible) |
| MasterSheet.jsx:88 | sum | sums `submission.apiSold` across week | totalProductionCredit | medium (manager view) |
| awardsEngine.js:72 | compute | reads `submission.apiSold` for monthly threshold | totalProductionCredit | high (eligibility) |
| ... | ... | ... | ... | ... |

### Risk levels

- **High** — user-visible metric on dashboard, KPI card, leaderboard, award progress
- **Medium** — manager view, internal aggregation
- **Low** — defensive / debug logic that doesn't affect display

### STOP conditions

- Audit surfaces > 25 distinct call sites → re-scope conversation with Kyron before proceeding
- Audit surfaces a surface that uses `apiSold` for **commissionable** semantics (not production) — surface this; commissionable API should only live in Commission Playground per planning decisions
- Audit finds direct `.apiSold` reads bypassing `extractFields.js` (those should be migrated to use the helper)

---

## Phase 3 — `extractFields.js` enhancements

### New exported helpers

```javascript
// Total Production API — what the whiteboard shows, what awards measure
export function extractTotalProductionCredit(submission) {
  // V2-first: stored field
  if (submission?.totalProductionCredit !== undefined) {
    return Number(submission.totalProductionCredit) || 0;
  }
  // V2 derive from sub-objects (in case totalProductionCredit isn't pre-computed)
  if (submission?.newBusiness !== undefined) {
    const nb = Number(submission.newBusiness?.api) || 0;
    const ppp = Number(submission.pppIncreases?.apiIncrease) || 0;
    const lmps = Number(submission.lumpsums?.apiCredit) || 0;
    return nb + ppp + lmps;
  }
  // V1 fallback — total = NB only (no PPP/LMPS in V1 schema)
  return Number(submission?.apiSold) || Number(submission?.api) || Number(submission?.annualPremium) || 0;
}

// Commissionable API — used by Commission Playground only
export function extractTotalCommission(submission, commissionRate) {
  // V2-first
  if (submission?.totalCommission !== undefined) {
    return Number(submission.totalCommission) || 0;
  }
  // V2 derive
  if (submission?.newBusiness !== undefined) {
    const nb = Number(submission.newBusiness?.api) || 0;
    const lmpsComm = Number(submission.lumpsums?.commission) || 0;
    const rateDecimal = (Number(commissionRate) || 0) / 100;  // commissionRate is percentage
    return nb * rateDecimal + lmpsComm;
  }
  // V1 fallback
  const v1Api = Number(submission?.apiSold) || 0;
  const rateDecimal = (Number(commissionRate) || 0) / 100;
  return v1Api * rateDecimal;
}
```

### Existing `extractFields()` — leave alone

Don't change the return shape. Just add the two new helpers as separate exports. Surfaces opt in by importing what they need. This minimizes blast radius.

### Tests (vitest)

Add to `src/utils/__tests__/extractFields.test.js`:
- V2 doc with stored `totalProductionCredit` → returns stored value
- V2 doc without stored field → derives from sub-objects
- V1 doc → falls back to `apiSold`
- V1 doc with only `annualPremium` (legacy) → falls back correctly
- Zero / null / undefined inputs handled gracefully (return 0, no NaN)
- `extractTotalCommission`: commissionRate as percentage (35) divided by 100 correctly
- `extractTotalCommission`: PPP excluded from commission (V2 derive verifies this)

---

## Phase 4 — Surface updates (driven by audit)

For each finding in `docs/e1-slice-2b-audit.md` classified as "use totalProductionCredit":

1. Replace the read with `extractTotalProductionCredit(submission)`
2. Verify display still works (manual check on Vercel preview after push)
3. Update relevant tests

### Likely files to modify (audit will confirm exact list)

- `src/components/dashboard/AgentDashboard.jsx` — YTD API ring, weekly KPI cards
- `src/components/dashboard/ManagerDashboard.jsx` — overview metrics
- `src/components/manager/MasterSheet.jsx` — agent-by-agent table
- `src/components/dashboard/MotivationalCarousel.jsx` — weekly goal progress, MDRT progress, club thresholds
- `src/utils/gapAnalysis.js` — `ytdTotals.api` should be totalProductionCredit
- `src/utils/weeklyChampions.js` — `topAPI` should be totalProductionCredit
- `src/utils/awardsEngine.js` — `computeAgentAwards` reads submitted data — needs V2 awareness for eligibility math
- Any other surfaces flagged in audit

### CommissionPlayground: do NOT modify

Goal Decomposition tab already uses commissionable API semantics correctly. Modal Targeting tab is also commissionable. Both stay as-is.

### STOP conditions

- A surface needs both totalProductionCredit AND totalCommission displayed (didn't expect this) — surface, get UX guidance
- A surface uses NB-only API for production calc (not awards) — surface, this is suspicious; production calcs should use total
- Test failures requiring logic changes (not just expected-value updates from V1 to V2)

---

## Phase 5 — Wizard review screen breakdown

Find the review screen rendering in `src/components/wizard/WizardForm.jsx` (`screen === 'review'` branch). It currently shows a summary of the 5 grouped wizard steps via `ReviewSummary`.

Add a new "Production Summary" panel between the existing summary and the submit button.

### Spec

```
┌─────────────────────────────────────────────┐
│  Production this week                        │
│                                              │
│  New Business           3 apps · TTD 25,000  │
│  PPP increases          1 increase · TTD 4,800 │
│  Lumpsum (10% of TTD 25,000)    TTD 2,500   │
│  ──────────────────────────────────────     │
│  Total Production API           TTD 32,300  │
│                                              │
│  Estimated commission                        │
│  From new business (rate 35%)   TTD 8,750   │
│  From lumpsum (0.5% × TTD 25K)    TTD 125   │
│  PPP — production credit only, no commission │
│  ──────────────────────────────────────     │
│  Estimated commission earned    TTD 8,875   │
│                                              │
└─────────────────────────────────────────────┘
```

### Behavior

- Only show LMPS row if `lumpsums.grossAmount > 0`
- Only show PPP row if `pppIncreases.apps > 0` or `pppIncreases.apiIncrease > 0`
- Always show NB row (even if 0)
- Use `computeTotalProductionCredit` and `computeTotalCommission` from `src/lib/schema/weeklyReport.computations.js` (already built in Slice 1)
- Pull `agent.commissionRate` from user doc, divide by 100 for the calc
- Render with existing ReviewSection / ReviewRow primitives if possible (don't reinvent)

### Tests

Vitest test for the review breakdown component:
- All three sources present → all three rows shown, total correct
- Only NB → only NB row shown, total = NB
- NB + LMPS, no PPP → 2 rows + total
- Commission math respects rate-as-percentage (35 not 0.35)
- PPP excluded from commission line

---

## Phase 6 — PDF redesign

### Discovery first

Find existing PDF generation code:
- `grep -rn "html2canvas\|jsPDF\|@react-pdf" src/`
- Likely: `src/components/pdf/` or `src/services/pdfService.js`
- Read existing agent + manager PDF templates

Discovery output: which library, which template files, current shape.

### Target format (matches Tatil whiteboard production report)

Three column groups: **Weekly | MTD | YTD**. Each group has:
- New Business: Apps + API
- PPP: Apps + Inc.
- LMPS: amount
- TOTAL

Header rows:
```
                    | NEW BUSINESS  | API ADJUSTMENTS              |
                    | APPS | API    | APPS | Inc. PPP | 10% LMPS  | TOTAL
```

Agent self-view PDF: just the agent's own row(s) for the period
Manager-tier PDF: grouped by Unit, agent rows under each unit, unit subtotals, branch total at bottom

### Files to modify

Discovery determines exact list. Likely:
- Agent PDF template
- Manager PDF template (Unit Manager / Branch Manager / Sales Manager variants)
- Wherever PDFs are triggered (download buttons in History tab, manager dashboard)

### Constraints

- Currency format: `TTD #,##0` consistent throughout
- 4-decimal precision NOT needed (whole TTD values)
- Same fonts as current PDFs (Satoshi / Cabinet Grotesk if PDFs use them, else system)
- Page break logic: agent PDF fits on 1 page typically; manager PDF can paginate by unit
- Print-friendly: BW-readable (don't rely on color alone for emphasis)

### Tests

If existing PDF tests exist, update them. If not, add a basic snapshot test or visual regression check via Playwright (PDF download → verify file exists, file size sensible, opens without error).

### STOP conditions

- PDF library is something CC isn't familiar with and discovery surfaces complex layout primitives — surface for guidance
- Existing PDF generation has bugs that block the redesign — surface, address separately

---

## Phase 7 — Awards V2 verification

`awardsEngine.js` is the pure computation engine (no Firebase, no React) — per CLAUDE.md notes. After Slice 2A, submitted data is V2 shape. Verify awards work correctly.

### Audit awardsEngine.js for V2 compatibility

For each award computation:
- Identify which fields it reads from `submittedData`
- Confirm those fields exist in V2 shape OR via `extractTotalProductionCredit` / `extractTotalCommission`
- Update reads to use the new extractors where appropriate

Specifically check:
- Monthly Advisor of Month — reads API totals
- Quarterly thresholds — reads API totals
- Club levels (Bronze/Silver/Gold) — reads API totals
- Centurion (100 net apps, max 20 increased premiums) — reads apps count, may need awareness of PPP
- Persistency awards — separate from API, no schema impact
- Production Credit Rules table from incentives doc:
  - "Increased Premiums (≥$2,400 API)" gets 100% apps + 100% API credit → these are PPP increases in V2 schema
  - Lumpsums get 0% apps + 10% API → already represented as `lumpsums.apiCredit`

### Centurion math nuance

The Centurion award says "100 net apps (max 20 increased premiums ≥$2,400 API)". Translated to V2:
- App count = NB.apps + PPP.apps (since PPP increases count as apps for Centurion, capped at 20)
- Total apps for Centurion = `newBusiness.apps + Math.min(pppIncreases.apps, 20)`

This is a meaningful semantic for Centurion specifically. Other awards (Monthly Apps ≥15, Quarterly Apps ≥45) probably also want this combined count, but the cap rule may differ. Document each award's apps logic explicitly in the audit.

### Tests

- Vitest tests for awards V2 compat:
  - Monthly Advisor of Month — V2 submission with NB only meets threshold
  - Monthly Advisor of Month — V2 submission with NB + PPP combined meets threshold (if combined apps ≥15)
  - Quarterly — same pattern
  - Centurion — apps cap on PPP (test boundary: 20 PPP, 21 PPP)
  - Award progress percent: V2 inputs produce same progress as equivalent V1 inputs would

### STOP conditions

- Award math has ambiguity that needs Tatil business-rule clarification (e.g., does Persistency Award use total production or just NB API for the $250K threshold?) — surface, do NOT guess
- Settlement-confirmed data path needs separate audit — that's a different schema (settlements collection) — out of scope for Slice 2B unless audit surfaces a hard dependency

---

## Phase 8 — Tests + verification

### Vitest

```
npm test
```

Expected: all existing tests still pass + new tests added in Phases 3, 5, 7. Total should be ~80+ tests.

### Lint + build

```
npm run lint     (0 errors, 3 known warnings OK)
npm run build    (green)
```

### Playwright walk — HARD REQUIREMENT (no skipping)

Create `scripts/verification/e1-slice-2b-walk.mjs` based on `scripts/verification/e2-walk.mjs` patterns.

**Required checks** (all must pass; document any failures explicitly in PR description, do NOT skip):

1. Login as test agent (`kelsean@gmail.com`, password `AgentTest123!`)
2. AgentDashboard YTD ring shows Total Production API (not just NB.api) — screenshot
3. AgentDashboard weekly KPI card shows correct totalProductionCredit — screenshot
4. Career tab → Awards: progress bars/checklists render with V2 data (no NaN, no zero where data exists) — screenshot
5. History tab → click a submission → SubmissionViewer shows breakdown correctly — screenshot
6. Wizard → start a new submission → fill all 5 screens → review screen shows production breakdown panel — screenshot
7. Submit a wizard report → verify Firestore doc has `version: 2`, `totalProductionCredit` populated, `totalCommission` populated correctly
8. Download PDF (agent self-view) → verify it opens and shows whiteboard-format breakdown — screenshot of PDF
9. Login as manager test seat → MasterSheet shows correct totals per agent — screenshot
10. Manager downloads PDF → verify whiteboard-format with unit groupings — screenshot of PDF
11. Mobile (380px viewport) on AgentDashboard + Wizard review screen — screenshots
12. Dark mode on AgentDashboard + Wizard review screen — screenshots

Save artifacts to `verification/e1-slice-2b/`.

### STOP if Playwright walk fails any of checks 1-7, 9, or 11

Checks 8 and 10 (PDF visual) are nice-to-have at this granularity — manual review of generated PDFs is acceptable if Playwright PDF inspection is too brittle.

---

## Phase 9 — Open PR + STOP

### PR title

```
feat(e1) slice 2b: surface adaptation + PDF redesign + awards V2 compat
```

### PR description

```
## Summary
E1 Slice 2B — completes the schema split rollout. Every surface across the
app now reads V2-aware: dashboards, KPI cards, leaderboards, goals progress,
weekly champions, motivational carousel, awards engine, manager views, PDFs.

Per docs/Track-E-Specs.md §E1 + planning decisions May 9 2026.

## What ships

### Audit + extractors
- docs/e1-slice-2b-audit.md (audit table, ~N call sites)
- src/utils/extractFields.js — new helpers: extractTotalProductionCredit + extractTotalCommission

### Surface updates (per audit)
- AgentDashboard, ManagerDashboard, MasterSheet
- gapAnalysis, weeklyChampions, awardsEngine, MotivationalCarousel
- (full list in audit doc)

### Wizard review breakdown
- Production credit + Commission breakdown panel before submit
- Single moment of truth for agents — see total + commissionable in one place

### PDF redesign
- Agent self-view PDF: whiteboard-format breakdown columns
- Manager-tier PDFs: same columns, grouped by Unit, branch total at bottom

### Awards V2 verification
- awardsEngine reads V2 fields correctly
- Centurion apps cap on PPP increases (max 20) implemented
- Tests cover V2 compat for monthly/quarterly/club awards

## Pre-flight (CONTEXT.md sync)
Bundled into first commit per project precedent. HEAD bumped post-#69, recently-shipped table updated.

## Verification

### Vitest
- <X> tests, all pass
- New tests added: extractors (Phase 3), wizard review breakdown (Phase 5), awards V2 (Phase 7)

### Lint + build
- 0 errors, 3 known warnings (baseline)
- Build green

### Playwright walk — REQUIRED this slice (Slice 2A skipped, this one didn't)
- 12/12 checks pass
- Artifacts: verification/e1-slice-2b/
- Light + dark + mobile + PDF screenshots all captured

## Out of scope (deferred)
- E5 — TV display kiosk (post-pilot)
- E6 — Daily input mode (next pre-pilot HIGH)
- Real Tatil tenant setup (operational)

## Awaiting Kyron
- Spot-check key screenshots from verification/e1-slice-2b/
- Manual smoke: submit one full wizard, verify dashboard + PDF + Awards tab end-to-end
- Confirm Centurion apps cap interpretation is correct (NB.apps + min(PPP.apps, 20))
- Squash-merge if happy
```

**STOP. Do NOT merge.** Code change touching multiple live surfaces requires Kyron review.

---

## Hard stops (any → surface and wait)

- Phase 2 audit surfaces > 25 call sites or finds NB-only commissionable semantics outside Commission Playground
- Phase 4 surface update breaks an existing test in a way requiring logic change (test was wrong, not the change — confirm with Kyron)
- Phase 6 PDF library discovery surfaces complexity beyond redesign scope
- Phase 7 awards math has ambiguity needing Tatil business-rule clarification (especially Centurion apps cap interpretation)
- Phase 8 Playwright walk fails on dashboard or wizard checks (UX-critical)
- **Two strikes hit (counter at 2/2) — STOP regardless of phase**

## Success states

**Best:** PR open with green CI, Playwright 12/12 pass, screenshots in verification/, awards verified V2-aware, awaiting Kyron review + merge.

**Acceptable:** PR open with 10-12/12 Playwright (PDF visual checks may fail to brittleness — manual PDF inspection acceptable substitute).

**Acceptable with note:** Audit Phase 2 surfaces something architectural (e.g., a surface using NB-only for production calc) — work stops, surface, plan resolution. Foundation work complete; nothing harmful shipped.

**Stopped:** Two strikes hit, full state dump in chat for Kyron's direction.

---

## Notes for CC

- Strike 1 (soft) from Slice 2A: skipping Playwright was scope-narrowing without surfacing. This slice's Playwright is non-negotiable.
- Bundle CONTEXT.md sync into Phase 1 first commit (precedent established in 2A).
- The audit (Phase 2) is the critical pre-work. Don't shortcut it. Every later phase depends on the audit being thorough.
- When in doubt about a surface's metric (production vs commissionable), default to **production** — that's the planning decision. Commissionable lives only in Commission Playground + wizard review.
- Centurion apps cap interpretation: confirm `newBusiness.apps + Math.min(pppIncreases.apps, 20)` is correct before locking that in code. Surface to Kyron if any doubt.
