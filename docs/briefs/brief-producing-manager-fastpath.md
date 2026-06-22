# Brief — Producing-Manager Fast-Path Extension (My Production daily-review → Confirm)

**Merge class:** HUMAN-MERGE (manager-facing routing; Rule 19). NOT green-channel.
**Model:** Sonnet (mechanical mirror of the agent fast-path; recon-verified, RTL-coverable).
**Hold:** STOP at PR-open. CC never merges or deploys (Rule 19).
**Scope guard:** ManagerDashboard.jsx only. No rules, functions, schema, or hook changes.

---

## Context

The Wizard v3 fast path (Confirm-screen-first entry) shipped for agents in #722/#723.
Producing managers (UM/BM) already have the full daily-capture machinery — DailyCaptureV2
on `mp-*` tabs, uid-generic `getDraft`, and the identical `onReviewSubmit(week, draftHint)`
payload — but their daily-review "Review & submit" routes to the date-picker (full path)
instead of Confirm. This wires the manager's daily-review to the same fast path the agent
uses. It is **entry-wiring in ManagerDashboard only.**

### Recon-verified anchors (live tree d982762 — CC re-verifies at Phase 0)

Agent reference (the template):
- `AgentDashboard.jsx:426-434` — `openWizardForWeek(week, draft=null)`: calls
  `resolvePath(loggingMode, draft)`, then `setWizardInitialStep(path==='fast'?10:1)`,
  `setWizardInitialScreen(path==='fast'?'confirm':null)`, `setWizardWeek(week)`,
  `setShowWizard(true)`.
- `AgentDashboard.jsx:468` — WizardForm mount threads `initialWeek` / `initialStep` /
  `initialScreen` / `goal={goals}` / `floors={resolvedMinimums?.weeklyActivityFloors}`.
- `AgentDashboard.jsx:478-488` — DailyCaptureV2 `onReviewSubmit={(week, draftHint) => {
  setShowDailyModal(false); openWizardForWeek(week, draftHint); }}` (Phase-1.2: route on
  the REVIEWED week's real aggregation, not `currentWeekSub`).
- `WizardForm.jsx:211` — `const [screen, setScreen] = useState(initialScreen ?? (initialWeek ? 'step' : 'date'))`.
  No internal `resolvePath` — screen is prop-driven.
- `WizardForm.jsx:208,279` — `useAuth()` → `getDraft(tenantId, user.uid, weekStarting)`:
  uid-generic, so a manager mount auto-loads `submissions/{managerUid}_{week}`.
- `resolvePath(loggingMode, draft)` lives in `WizardForm.helpers.js` → `'fast' | 'full'`,
  no role check.

Manager current state (what we change):
- `ManagerDashboard.jsx:246-256` — `showMpDailyModal` early-return renders DailyCaptureV2 with
  `onReviewSubmit={() => { setShowMpDailyModal(false); setActiveTab('mp-report'); }}` — the
  `(week, draftHint)` args are **ignored**.
- `ManagerDashboard.jsx:235-237` — `showWizard` mount: bare `<WizardForm onClose=... />`
  (ManagerOverviewTab "Submit Report" — separate full-path entry, LEAVE UNTOUCHED).
- `ManagerDashboard.jsx:241-243` — `mp-report` early-return: bare `<WizardForm onClose=... />`
  (direct-nav weekly report — LEAVE UNTOUCHED, full/date-picker, agent parity).
- `ManagerDashboard.jsx:165-166` — `const mpLoggingMode = userProfile?.loggingMode ?? 'hybrid'`
  (exists, gates DailyFAB, not yet passed to the wizard).
- `DailyCaptureV2.jsx:772-775` — SundayConfirmView calls
  `onReviewSubmit(weekStarting, { aggregatedFromDaily: weekDocs.length>0, daysWorked: weekDocs.length })`.
- `useMyProduction.js:110-117` — exposes `goals`, `companyMinimums`, `currentWeek`; **no**
  `currentWeekSub` (not needed).
- `ManagerDashboard.jsx:457-461` — DailyFAB gated by `showMpDailyCTA` (mode-driven, no role gate).

---

## Locked decisions

1. **Dedicated `showMpWizard` boolean host**, mirroring the agent's `showWizard` — NOT
   overloading the mp-report tab. Avoids stale-vars-on-nav-click; the wizard hosts (showWizard,
   showMpWizard) are dedicated booleans, vars re-set fresh on each open.
2. **mp-report direct-nav and showWizard mounts stay full-path / unchanged.** Fast path is
   the daily-review → Confirm flow only (agent parity: the agent's direct entry is also full).
3. **`resolvePath(mpLoggingMode, draftHint)`** drives the path, exactly like the agent.
   BM-optional reporting needs no special-casing (no-FAB → never reaches onReviewSubmit →
   direct mp-report → date-picker).
4. **Thread `goal` + `floors`** into the new mount so managers get step-11 seeded targets.
   Source from `useMyProduction` (`goals`, `companyMinimums`). Phase 0 verifies the exact
   floors field the agent passes vs the useMyProduction shape; if mismatched, accept the
   `DEFAULT_WEEKLY_ACTIVITY_FLOORS` fallback in `useSeededTargets` and note it. Non-blocking.
5. **No `useMyProduction` change, no new draft read** — `getDraft` is uid-generic.

---

## Phase 0 — verify before building (READ-ONLY, Rule 17 — STOP-and-surface on any drift)

1. Re-confirm every anchor above at HEAD (`git grep` + read; cite path:line if shifted).
2. Confirm `resolvePath` is importable into ManagerDashboard from `WizardForm.helpers`.
3. Floors shape: read the agent's exact `floors={...}` source and the `useMyProduction`
   equivalent. State the field path to thread (or confirm DEFAULT fallback).
4. Confirm DailyCaptureV2 `handleSave`'s `aggregateCurrentWeekDaily` is uid-generic (manager
   aggregates to own draft) — quick grep, low-risk sanity check.
5. Confirm the early-return ordering: when `onReviewSubmit` sets `showMpDailyModal=false` +
   `showMpWizard=true` in one tick, the next render must reach the `showMpWizard` early-return
   (activeTab is the prior mp-* tab, NOT 'mp-report', so the mp-report return won't shadow it).

If any premise shifted, STOP and report before editing.

---

## Phase 1 — build (`ManagerDashboard.jsx` only)

1. Import `resolvePath` from `WizardForm.helpers`.
2. Add state alongside `showMpDailyModal`:
   `showMpWizard` (false), `mpWizardWeek` (''), `mpWizardInitialStep` (1),
   `mpWizardInitialScreen` (null).
3. Add `openMpWizardForWeek(week, draftHint = null)` mirroring the agent's helper:
   ```
   const openMpWizardForWeek = (week, draftHint = null) => {
     const path = resolvePath(mpLoggingMode, draftHint);
     setMpWizardInitialStep(path === 'fast' ? 10 : 1);
     setMpWizardInitialScreen(path === 'fast' ? 'confirm' : null);
     setMpWizardWeek(week);
     setShowMpWizard(true);
   };
   ```
4. Rewrite the `showMpDailyModal` `onReviewSubmit`:
   `onReviewSubmit={(week, draftHint) => { setShowMpDailyModal(false); openMpWizardForWeek(week, draftHint); }}`.
   (Drop `setActiveTab('mp-report')`.)
5. Add the dedicated host early-return, grouped with the `showWizard` host (place it directly
   after the `showWizard` return, before the `mp-report` activeTab return):
   ```
   if (showMpWizard) {
     return (
       <WizardForm
         initialWeek={mpWizardWeek}
         initialStep={mpWizardInitialStep}
         initialScreen={mpWizardInitialScreen}
         goal={myProd.goals}
         floors={/* Phase-0 verified floors field, else omit for DEFAULT fallback */}
         onClose={() => setShowMpWizard(false)}
       />
     );
   }
   ```
6. Leave the `showWizard` and `mp-report` mounts unchanged.

No other files touched.

---

## Phase 2 — tests (Vitest, co-located; extend `ManagerDashboardMyProduction.test.jsx` or sibling)

1. Mock DailyCaptureV2 to surface its `onReviewSubmit`; invoke with a **fast** payload
   `('2026-06-14', { aggregatedFromDaily: true, daysWorked: 3 })` → assert the WizardForm mount
   receives `initialScreen='confirm'` and `initialStep=10`.
2. Invoke with an **empty/full** payload `({ aggregatedFromDaily: false, daysWorked: 0 })` →
   assert `initialScreen=null` / `initialStep=1` (full).
3. Assert mp-report direct nav still mounts a bare WizardForm (no initialScreen) — regression
   guard on the untouched full-path entry.
4. Assert no crash for SM/PA (the host is only reachable via the role-gated FAB; defensive).
5. Existing 18 My Production tests stay green.

---

## Phase 3 — gates

Full suite green · lint 0 · build clean · Gemini poll + disposition every comment (Rule 21).

---

## Phase 4 — docs (placeholders, committed in-PR)

- `CONTEXT.md` Recently-shipped placeholder row: `{TBD SHA}` producing-manager fast-path
  (HUMAN-MERGE) — /post-merge fills the SHA (Rule 16; feature PR does NOT pre-write the final row).
- `docs/FOLLOW_UPS.md` — bank:
  - Deferred-Sunday manager-confirm production smoke (2026-06-28; rides with the wizard
    Phase-2 deferred smoke). New script `scripts/verification/smoke-mp-fastpath-confirm.mjs`
    (commit it; currently it will be untracked).
  - Scope note: mp-report direct-nav fast-path (would need a Dashboard-side draft read /
    `currentWeekSub` in `useMyProduction`) deliberately deferred — agent parity says full-path
    is correct for direct entry; revisit only if product wants it.

---

## Phase 5 — commit / push / PR-open / STOP

- Branch: `feat/producing-manager-fastpath`.
- PR title: `feat(pm): producing-manager fast-path — daily-review → Confirm`.
- Run `git branch --show-current` before commit (standing rule).
- Rule 20: report the feature-branch HEAD SHA in the PR-ready report; no silent post-report pushes.
- Rule 22: enumerate ≥1 known gap.
- STOP at HOLD. Do not merge or deploy.

---

## Self-critique seed (for CC's Rule 22)

- Live Confirm reachability is Sunday-gated (`SundayConfirmView`) — the merge rests on the
  component test + RTL; the live production assertion waits for 2026-06-28.
- The `floors` prop shape is assumed to mirror the agent; if it doesn't, seeded targets fall
  back to DEFAULT (honest fallback, but not identical to the agent experience). Verify at Phase 0.
- `onClose` does not reset the three mpWizard vars — safe because `openMpWizardForWeek` re-sets
  them on every open, but note it if a future entry path bypasses the helper.
