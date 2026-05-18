# E1 Slice 2A — Pre-flight + Wizard Restructure

## Source

- Spec: `docs/Track-E-Specs.md` §E1
- Foundation: PR #68 (schema utilities, migration script, seeder all built and tested)
- Planning decisions (May 9 2026, with Kyron):
  - **Wizard UX:** option (b) — NB primary + expandable "Add PPP" / "Add lumpsum" buttons
  - **Migration timing:** option (a) — Apply pre-Slice-2 (seed → migrate → develop wizard against V2)
  - **Synthetic seed:** yes, into `tatillife_south`

## Scope

### IN — this PR (Slice 2A)

1. Pre-flight: seed synthetic V1 → migrate to V2 → verify (operational, no code commits)
2. Wizard production step (Step 4) restructure to capture three sources
3. Wizard `formData` state shape → V2 (newBusiness, pppIncreases, lumpsums)
4. Submission service writes V2 shape exclusively
5. `extractFields.js` reads V2 first with V1 aliases as fallback (defensive — pre-pilot only)
6. Vitest unit tests for new wizard logic
7. Playwright verification walk against preview deploy

### OUT — Slice 2B (separate kickoff later)

- Dashboard KPI card updates (display the three sources)
- PDF report changes
- Leaderboard / Master Sheet surface updates
- Comprehensive API-usage audit across remaining surfaces

## Discipline gates

- Single-branch PR rule
- Fetch-first
- Two-strike counter starts at 0/2
- **No auto-merge** — code PR touching live wizard UI
- Never push direct to main
- Pre-flight phases (1-4) produce operational logs only, no code commits in this scope
- Slice 2A wizard work (phases 5-9) is the actual code PR

## Phase 1 — Sync + worktree

```
git fetch origin --prune
git checkout main
git pull origin main
git log origin/main --oneline -5   → capture HEAD SHA
```

Verify `docs/CONTEXT.md` § "Current main HEAD" matches actual HEAD. If stale (likely — PR #68 merged after last sync):
- Bundle the CONTEXT.md bump into this PR's first commit (does not warrant a separate sync PR — this PR will already touch docs via the discovery notes update)
- Update HEAD reference + add PR #68 row to "Recently shipped"
- Bump "Where we left off" to reflect Slice 2A in progress

Branch: `feat/e1-slice-2a-wizard-restructure`
Worktree: `.claude/worktrees/feat-e1-slice-2a-wizard-restructure`

## Phase 2 — Pre-flight: seed synthetic V1 reports

Run from main worktree (not the feature worktree — pre-flight is operational):

```
node scripts/seed/synthetic-weekly-reports.mjs --dry-run
```

Verify dry-run output:
- 40 V1 reports planned (5 agents × 8 weeks)
- Field shapes match V1 conventions: `apiSold`, `applicationsSold`, etc.
- Realistic TTD figure ranges
- Sunday-only `weekStarting` dates

If dry-run looks correct:

```
node scripts/seed/synthetic-weekly-reports.mjs --apply --confirm-tenant=tatillife_south
```

Save full output to `verification/e1-slice-2a/seed-output.txt`.

Expected end state: 40 V1 docs at `/tenants/tatillife_south/submissions/`.

**STOP CONDITION:** existing real submissions in tatillife_south detected (any docs not from C2/C3 test imports). Do NOT seed alongside real data without surfacing.

## Phase 3 — Pre-flight: run migration --apply

Dry-run first:

```
node scripts/migrations/2026-05-e1-schema-split.mjs --dry-run --confirm-tenant=tatillife_south
```

Verify:
- 40 reports detected for migration
- 0 already at v2 (none exist yet)
- Alias distribution shown (`apiSold=N api=N annualPremium=N` — should be apiSold=40 since seeder writes apiSold)
- Sample migrated doc shape correct
- Validation passes on sample

If dry-run clean:

```
node scripts/migrations/2026-05-e1-schema-split.mjs --apply --confirm-tenant=tatillife_south
```

Save full output to `verification/e1-slice-2a/migration-output.txt`.

Expected end state: same 40 docs, now at `version: 2`, with `newBusiness/pppIncreases/lumpsums` populated. PPP and LMPS sub-sections zeroed (no historical data).

## Phase 4 — Pre-flight: verify migration succeeded

Spot-check via Firebase Admin SDK script (write a small one-off `scripts/verify-e1-migration.mjs` in worktree, do NOT commit):

For 5 random migrated docs, assert:
- `version === 2`
- `newBusiness.api > 0` (no zeroing bug)
- `newBusiness.apps > 0`
- `pppIncreases.apps === 0` and `pppIncreases.apiIncrease === 0` (expected)
- `lumpsums.grossAmount === 0` (expected)
- `totalProductionCredit === newBusiness.api` (since PPP/LMPS zero)
- `totalCommission` math: `newBusiness.api × (agent.commissionRate / 100)` — note `commissionRate` is stored as percentage (35 = 35%), divide by 100 in calc
- `migrationMeta` present with `sourceVersion: 1`

Output a summary to chat: `40/40 migrated, all V2 shape, all math correct.`

**STOP CONDITION:** any of the assertions fail. Surface, do NOT proceed to Phase 5.

## Phase 5 — Discovery: existing wizard structure

Read these files completely:
- `src/components/wizard/WizardForm.jsx` (main orchestrator)
- All files in `src/components/wizard/steps/Step4*.jsx` (production step — discover exact filename)
- `src/components/wizard/CardStack.jsx`, `CurrencyField.jsx`, `NumericField.jsx` (primitives)
- `src/services/submissionService.js` (or whatever writes the submission doc)
- `src/utils/extractFields.js` (current shape)

Document in `docs/e1-slice-2a-discovery-notes.md`:
- Step 4 exact file path + current state-shape fields
- Submission write shape (which fields, which Firestore path)
- formData state location (parent component)
- Auto-save trigger and logic
- All places `applicationsSold` and `apiSold` are written (Slice 2A removes these writes)

**STOP CONDITION:** Step 4 structure substantially diverges from a "single form with several fields" pattern (e.g., already uses tabs, has split sub-sections, has complex conditional logic). Surface, get Kyron's input on UX option-b adaptation.

## Phase 6 — Wizard restructure (option b)

### UI spec

```
┌──────────────────────────────────────────┐
│  Step 4 — Production                      │
│                                            │
│  ─── New Business ───                      │
│  (always visible)                          │
│  Apps written:        [ 3      ]           │
│  API ($):             [ 18,500 ]           │
│                                            │
│  ─── Other production this week ───        │
│  [ + Add PPP increase ]  [ + Add lumpsum ] │
│                                            │
└──────────────────────────────────────────┘

When "Add PPP increase" clicked:

┌──────────────────────────────────────────┐
│  ─── PPP Increases ─── [Remove]           │
│  Number of PPP increases: [ 1     ]        │
│  Total API increase ($):   [ 4,800 ]       │
│  ...validation: each increase ≥ $2,400 → 
│     warn if avg < 2400 (1 increase × 4800 OK,
│      but 2 × 4800 = avg 2400 OK, 3 × 4800
│      = avg 1600 fails)                     │
└──────────────────────────────────────────┘

When "Add lumpsum" clicked:

┌──────────────────────────────────────────┐
│  ─── Lumpsums ─── [Remove]                │
│  Gross lumpsum amount ($):    [ 25,000 ]   │
│  Computed API credit (10%):   $2,500       │
│  Computed commission (0.5%):  $125         │
└──────────────────────────────────────────┘
```

### State shape

```javascript
formData: {
  // ... existing fields preserved
  newBusiness: { apps: 0, api: 0 },
  pppIncreases: { apps: 0, apiIncrease: 0 },
  lumpsums: { grossAmount: 0 },
  // pppExpanded and lumpsumsExpanded are UI-only state, NOT persisted
}
```

### Submission write shape

When the wizard submits, compute and write:
- `lumpsums.apiCredit = grossAmount × 0.10` (use `computeLumpsumCredit` from `src/lib/schema/weeklyReport.computations.js`)
- `lumpsums.commission = grossAmount × 0.005` (use `computeLumpsumCommission`)
- `totalProductionCredit = computeTotalProductionCredit(report)`
- `totalCommission = computeTotalCommission(report, agentRate)` (agentRate from user doc, divided by 100)
- `version: 2`

### Files to modify

- `src/components/wizard/steps/Step4*.jsx` — full restructure
- `src/components/wizard/WizardForm.jsx` — formData initial state
- `src/services/submissionService.js` — submission write shape
- `src/utils/extractFields.js` — V2 reads, V1 fallback (read newBusiness.api first, fall back to apiSold/api/annualPremium aliases)

### Files NOT to modify (deferred to Slice 2B)

- Dashboard components
- PDF generation logic
- Leaderboard / Master Sheet
- Goals progress calculations

## Phase 7 — Tests

### Vitest unit tests

Add to `src/components/wizard/__tests__/Step4Production.test.js`:
- formData initial state has all three sub-objects with zeros
- Adding PPP expands and shows fields
- Removing PPP collapses and resets fields to zero
- LMPS gross input live-computes credit and commission display
- Submission write produces correct V2 shape
- Submission write preserves all non-Step-4 fields untouched

Add to `src/utils/__tests__/extractFields.test.js`:
- V2 doc reads correctly (newBusiness.api, newBusiness.apps)
- V1 doc still reads correctly (fallback to apiSold/applicationsSold)
- Mixed-shape doc (shouldn't exist post-migration but defensive) reads V2 over V1

Run: `npm test` — all green before moving on.

### Playwright walk

Update `scripts/verification/e2-walk.mjs` patterns into a new `scripts/verification/e1-slice-2a-walk.mjs`:
- Login as test agent (kelsean@gmail.com)
- Navigate to wizard, pick a Sunday with no prior submission
- Fill Step 1-3 with minimal valid data (auto-fill where possible)
- Step 4: enter NB-only data → save → verify auto-save → no PPP/LMPS expansion shown
- Re-open, expand PPP, fill, save, verify
- Re-open, expand LMPS, fill, verify live-computed credit/commission display
- Submit → verify Firestore doc has V2 shape with all three sub-objects populated
- Cleanup: delete the test submission

Save artifacts to `verification/e1-slice-2a/`.

## Phase 8 — Verify lint/build/tests

```
npm test          (all green)
npm run lint      (0 errors, 3 known warnings OK)
npm run build     (green)
node scripts/verification/e1-slice-2a-walk.mjs  (9+ checks pass)
```

If any red: surface, do NOT auto-fix logic errors. Lint/typo fixes are OK.

## Phase 9 — Open PR + STOP

PR title:

```
feat(e1) slice 2a: wizard production step restructure (3-source schema)
```

PR description:

```
## Summary
E1 Slice 2A — wizard production step now captures three sources: new business,
PPP increases, lumpsums. Per Track-E-Specs.md §E1.

## Pre-flight (operational, no code commits)
- Seeded 40 synthetic V1 reports into tatillife_south (5 agents × 8 weeks)
- Migrated all 40 to V2 schema
- Verified migration: shape, totals, commission math (commissionRate-as-percentage handled)

## Wizard restructure (option b)
- NB stays primary, always-visible (matches current agent muscle memory)
- "Add PPP increase" and "Add lumpsum" buttons expand sub-sections on demand
- LMPS section shows live-computed API credit (10%) + commission (0.5%) below gross input

## Schema changes
- formData state: newBusiness/pppIncreases/lumpsums sub-objects
- Submission writes V2 shape exclusively (V1 fields no longer written by new submissions)
- extractFields.js: V2-first reads with V1 fallback (defensive)

## Out of scope (Slice 2B)
- Dashboard / PDF / leaderboard surface updates
- Comprehensive API-usage audit
- Awaiting Kyron's planning input on Slice 2B kickoff

## Verification
- vitest: <X>/<X> tests pass (new tests for wizard + extractFields V2 reads)
- Playwright walk: <X>/<X> checks (saved to verification/e1-slice-2a/)
- Lint + build green

## Awaiting Kyron
- Spot-check screenshots from Playwright walk
- Manual test: submit one wizard report end-to-end on Vercel preview
- Confirm UX feel for option-b expandable buttons
- Plan Slice 2B kickoff
```

**STOP. Do NOT merge.** Code change touching live wizard UI requires Kyron review.

## Hard stops (any → surface and wait)

- Phase 2 detects real (non-test) submissions in tatillife_south → STOP
- Phase 4 verification fails on any of 5 sample docs → STOP
- Phase 5 discovery surfaces architectural divergence (Step 4 already complex) → STOP
- More than 2 strikes anywhere across phases → STOP
- Any commit needs to revert wizard regression to existing main behavior → STOP, this is no longer a clean restructure

## Success states

**Best:** PR open with green CI, Playwright walk all pass, screenshots in verification/, awaiting Kyron review + merge.

**Acceptable:** Pre-flight clean (Phases 1-4), wizard work stopped at Phase 5 discovery surfacing complexity. State preserved for next session.

**Stopped:** Two strikes hit, full state dump in chat for Kyron's direction.