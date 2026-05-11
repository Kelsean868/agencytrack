# BUG-N3 — Production Report shows raw Firestore UID instead of unit name — kickoff brief

**Status:** Ready to execute. Final pre-pilot polish item. After this lands, pilot launch is unblocked.
**Estimated CC effort:** Half-day. Single small PR.
**Two-strike counter:** 0/2 (fresh session).

---

## Context

Branch managers, sales managers, and tenant admins see a **raw Firestore UID** (e.g., `XQhG6awVgaYkCFX7gnd1...`) where a unit name should display on the Production Report screen. Visible during the PR #90 mgr-mobile audit (`verification/mgr-mobile-audit/production-report.png` — view in main worktree at HEAD).

**Symptom:** "Unit XQhG6awVgaYkCFX7gnd1..." appears in the Unit Leaderboard / unit aggregation section instead of "Unit 1" or whatever the configured unit name is.

**Likely root cause** (to confirm in Phase 2 discovery):
- Production Report fetches production data that's keyed by `unitId` but doesn't join with the `units` collection to resolve names, OR
- The render-time fallback displays `unit.id` when `unit.name` is missing or unfetched, OR
- A hook exists for units lookup (e.g., `useUnitsMap`) but isn't wired into the Production Report component.

**Impact:** Visible polish issue, makes the app look unfinished. Functional but unprofessional. Pilot-launch acceptable per LOW classification, but fixing it makes the difference between "polished" and "demo-grade" for the first real branch manager who opens this screen.

**Closure:** This PR closes the **BUG-N3** entry added to `docs/FOLLOW_UPS.md` in PR #94. Don't modify FOLLOW_UPS.md here — note "Closes BUG-N3" in the PR description; future housekeeping handles the actual file update.

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -3`. HEAD should include the WALK-1 squash commit (PR #95: `feat(walks): harden walk scripts...`) at top, plus PR #94 (housekeeping) and PR #92 (polish batch) below.
4. Confirm clean state: `git worktree list` shows only main; `git branch` shows only `main`.
5. Create worktree at `.claude/worktrees/fix-bug-n3-unit-names` on branch `fix/bug-n3-production-report-unit-names`.
6. `cd` into the worktree.

---

## Phase 2 — Discovery (read-only)

1. **Find the Production Report component.** Likely path: `src/components/manager/ProductionReport.jsx` or `src/components/dashboard/ProductionReport.jsx` — search broadly if neither exists.
2. **Trace the data fetching.** For the unit leaderboard / unit aggregation section, identify:
   - Which service or hook fetches the production data (likely `productionService.js`, `getProductionForBranch`, etc.)
   - What shape the returned data has (does it include `unitId` only, or `unitId + unitName` joined?)
   - Where the rendering happens — find the JSX block where the unit identifier appears
3. **Find existing unit-name lookup patterns elsewhere in the codebase.** Likely:
   - `src/services/unitsService.js` or similar — how does the rest of the app fetch unit names?
   - Goals system or Persistency tab — they reference units; how do they display unit names?
   - Any `useUnitsMap`, `useUnits`, or equivalent hook
4. **Confirm the bug.** Use `grep` or read the Production Report component's render block to confirm `unit.id` (or equivalent) is used where `unit.name` should be. Capture the exact line(s).
5. **Identify any other screens with the same bug.** Search for other places that might render `unit.id` directly. Likely candidates: Settlements, Persistency manager view, Goals manager view. Surface in Phase 3 but don't fix in this PR unless explicitly approved.

Output discovery findings in chat using this template:

```
DISCOVERY — BUG-N3 Production Report unit names

Production Report component:
- File: <path>
- Render block (verbatim where unit id appears): <quote>

Data fetching:
- Service/hook: <path>
- Data shape returned: <description>
- Does it include unit name? <yes/no>

Existing unit-lookup pattern:
- Method: <e.g., useUnitsMap hook at src/hooks/useUnitsMap.js, OR direct fetch via unitsService.getUnitsForBranch>
- Used elsewhere at: <list of consumer components>

Root cause confirmed:
- <e.g., "ProductionReport doesn't fetch unit names; the unit.id is rendered as fallback at line X">

Proposed fix:
- Approach 1 (recommended): <e.g., "wire useUnitsMap into ProductionReport, render unit.name with fallback to 'Unknown Unit' if not found">
- Approach 2 (alternative): <e.g., "denormalize unit name onto production docs at write time — out of scope, would need migration">
- Files to touch: <list, target ≤3>

Same bug elsewhere?
- <yes/no, list of other screens with similar pattern — recommend separate PR for those>

Risk assessment: LOW (single render fix + one hook wire-up)
```

**STOP at end of Phase 2 and wait for Kelsean's approval.** This is a short stop — design should be straightforward, but the choice between approaches (hook wire-up vs schema denormalization) is a real architecture decision worth a sanity check before implementation.

---

## Phase 3 — Implement (only after approval)

After Kelsean approves the approach:

1. Wire the unit-name lookup into the Production Report component per the approved approach.
2. Render `unit.name` where `unit.id` previously appeared.
3. **Add a fallback** for the case where a unit exists in production data but isn't in the units lookup (e.g., deleted unit): show `"(unknown unit)"` or `"Unit unavailable"` — NOT the raw UID. Surface microcopy to Kelsean if unsure.
4. Match the existing project patterns: functional component, `useMemo`/`useCallback` if appropriate for the lookup, no inline styles.
5. **No source code changes outside the Production Report component + maybe one hook file.** If the fix would require touching production-data services, schema migrations, or unrelated components → STOP and surface.
6. **Dark mode + mobile parity:** the fix is a text content change, but verify the unit name rendering doesn't break layout at narrow viewports if names are longer than the previous UIDs (UIDs are ~28 chars; names might be shorter or longer).

---

## Phase 4 — Tests

If the Production Report component has existing tests, extend them with an assertion that unit names render correctly. Mock the units lookup and the production data, render the component, assert the unit name appears (not the ID).

If no existing tests cover this component:
- **Optional:** add a small render test using the WizardFormSaveStatus.test.jsx scaffolding pattern (or MobileNavDrawer.test.jsx) as a template. ~2-3 test cases: unit name renders, fallback renders for missing unit, fallback renders for empty unit name.
- **Or skip** if the test setup is more work than the fix itself. Document in the PR description.

`npm test` must remain 100% passing.

---

## Phase 5 — Production smoke (using the hardened walks)

This is the first PR after WALK-1, so use the new patterns:

### Visual smoke (mandatory)

Use Playwright with the helper module from `scripts/verification/lib/walk-helpers.mjs`:

1. Apply bypass to the preview URL using `buildBypassUrl` from the helper.
2. Sign in as test branch manager.
3. Navigate to Production Report.
4. Capture screenshot at desktop (1440x900) and mobile (390x844).
5. **Programmatic check:** scan the rendered text on the Production Report for UID-like strings. A unit identifier matching the pattern `/^[a-zA-Z0-9]{20,}$/` is suspect — if found in the user-facing text, the fix didn't work or there's a missed location.
6. Compare visually to the "before" reference: `verification/mgr-mobile-audit/production-report.png` (from PR #90).
7. Toggle dark mode, repeat the screenshot capture.

Save smoke screenshots to a worktree-local gitignored directory. Reference them in the PR description.

### Comparison value

The "before" screenshot shows `XQhG6awVgaYkCFX7gnd1...`. The "after" should show whatever the actual unit name is (e.g., "Unit 1", "Naparima Unit", or whatever production data has).

---

## Phase 6 — Verify, commit, push, PR

1. `npm run lint` → 0 errors
2. `npm run build` → green
3. `npm test` → 100% passing
4. Commit:
   ```
   fix(bug-n3): Production Report — render unit names instead of raw Firestore UIDs
   
   Branch managers saw strings like "XQhG6awVgaYkCFX7gnd1..." in the unit
   leaderboard / unit aggregation section where unit names should appear.
   
   Root cause: <one-line per Phase 2 finding>
   
   Fix: <one-line per approved approach>
   
   Fallback: missing/deleted units render "(unknown unit)" instead of the raw UID.
   
   Visual smoke: PASS (before/after screenshots in PR description).
   Programmatic check: no UID-like strings remain in user-facing text on
   Production Report.
   
   Closes BUG-N3 (FOLLOW_UPS.md closure handled in future housekeeping PR).
   ```
5. Push, open PR titled: `fix(bug-n3): Production Report — render unit names instead of raw Firestore UIDs`
6. PR description MUST include:
   - The before/after screenshots (or local paths if not uploaded inline)
   - The exact root cause + fix narrative
   - Visual smoke result + programmatic UID-pattern check result
   - "Closes BUG-N3" statement
   - Any same-bug-elsewhere notes from Phase 2 (as candidates for follow-up PRs, NOT addressed here)
7. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Phase 2 discovery reveals the fix needs schema migration or significant data-shape changes → STOP and surface; re-scope
- Production Report component is structurally different than expected (e.g., uses a complex chart library that handles its own data formatting) → STOP and surface
- Same-bug-elsewhere check in Phase 2 surfaces 3+ other screens with the same issue → STOP and surface; we may want to do them as a batch
- Any change needed outside the Production Report component, units hook/service, or test files → STOP
- Smoke fails (UIDs still visible after fix, or unit names broken) → STOP and surface
- Test suite regression → STOP
- CI gate fails → STOP and fix before requesting review
- Two strikes hit → STOP

---

## Out of scope

- Fixing the same bug on other screens (if Phase 2 surfaces them — separate PRs)
- Adding new units management UI
- Schema migrations (denormalizing unit names onto production docs)
- Touching `docs/FOLLOW_UPS.md` (housekeeping handles closure)
- Walk script changes (WALK-1 is done; this PR uses the helpers)
- Any rules changes
- Any other Production Report polish (other display issues, sort, filters — separate)
