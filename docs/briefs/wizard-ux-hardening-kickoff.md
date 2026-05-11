# Wizard UX + A11y hardening — kickoff brief

**Status:** Ready to execute. First of three Pilot Polish PRs (this → Mobile FU#1 → Login logo + UX-N + BUG-N2).
**Estimated CC effort:** 1 day. Single PR.
**Two-strike counter:** 0/2 (fresh session).

---

## Context

The weekly submission wizard is the agent's primary write surface — they fill it out every Monday. Auto-save runs in the background as they progress through the 5 consolidated steps (per memory: wizard consolidates 9→5 in `WizardForm.jsx`). Current state has gaps that real pilot agents will hit:

1. **Retry button** — when auto-save fails, the agent has no manual recourse. They retry by editing a field, hoping the next auto-save fires correctly.
2. **Saved ✓ indicator** — successful auto-saves may be silent, leaving the agent uncertain whether their work is persisted.
3. **Offline-vs-failed distinction** — currently no differentiation between "your network is down" (transient, user understands) and "the save call returned an error" (system issue, escalate).
4. **role=alert / aria-live** — screen-reader users get no announcement when save status changes.
5. **Persistent-failure handling** — if auto-save fails 3+ times in a row, there's no escalation (user sees the same error repeatedly with no path forward).

**Discipline:** discovery → surface → approve → implement. Do NOT start writing code until Kelsean approves the design proposal in Phase 3.

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -3`. HEAD should be `2712af6` (the housekeeping PR #86 merge) or newer.
4. Confirm clean state: `git worktree list` shows only the main worktree. `git branch` shows only `main`.
5. Create worktree at `.claude/worktrees/feat-wizard-ux-hardening` on branch `feat/wizard-ux-hardening`.
6. `cd` into the worktree.

---

## Phase 2 — Discovery (read-only)

Read and understand the current wizard auto-save implementation:

1. **WizardForm.jsx orchestrator** — find the auto-save hook/effect, identify when saves trigger (debounced on field change? step transition? both?).
2. **Auto-save hook/service** — locate `useAutoSave`, `useWizardAutoSave`, or equivalent. Trace the save lifecycle: start → success → error.
3. **Current status UI** — what does the user see today when a save starts, succeeds, fails? Is there a save indicator anywhere?
4. **Error propagation** — when `savePersistency` / `saveSubmission` / etc. throws, where does the error surface? Toast? Inline? Silent?
5. **Online/offline detection** — does the code already check `navigator.onLine` or listen to `online` / `offline` events anywhere?
6. **ARIA / accessibility** — search the wizard files for `role=`, `aria-`, screen-reader-related code. Catalog what exists.
7. **Test coverage** — search for `*.test.jsx` files covering the wizard's save flow. Catalog what's tested.
8. **Existing follow-up notes** — check `docs/FOLLOW_UPS.md` for the "Wizard UX hardening" entry and any pre-existing design notes.

For each finding, capture:
- File path + line range
- Current behavior
- Gap relative to the 5 sub-items

---

## Phase 3 — Surface findings + design proposal (STOP HERE)

Output a single structured summary in chat. Use this template verbatim:

```
DISCOVERY — Wizard UX + A11y hardening

Current auto-save architecture:
- Hook/file: <path>
- Trigger: <when saves fire>
- Lifecycle states: <list, e.g. idle / saving / saved / error>
- Current status UI: <description>
- Error propagation: <description>
- Online detection: <yes/no, where>
- ARIA support: <catalog>
- Test coverage: <catalog>

Sub-item analysis:

1. RETRY BUTTON
   Current: <state>
   Proposed: <design — where the button lives, when it appears, what it does>
   Files to touch: <list>

2. SAVED ✓ INDICATOR
   Current: <state>
   Proposed: <design — visual, position, timing of appear/disappear>
   Files to touch: <list>

3. OFFLINE-VS-FAILED DISTINCTION
   Current: <state>
   Proposed: <design — detection mechanism, distinct messages, distinct visuals>
   Files to touch: <list>

4. ROLE=ALERT / ARIA-LIVE
   Current: <state>
   Proposed: <design — which element, polite vs assertive, what gets announced>
   Files to touch: <list>

5. PERSISTENT-FAILURE HANDLING
   Current: <state>
   Proposed: <design — failure threshold, what UI escalation looks like, recovery path>
   Files to touch: <list>

Cross-cutting concerns:
- Is a new SaveStatusIndicator component warranted, or extend existing? <recommendation>
- Any backend/Firestore changes needed? <should be NO — surface if otherwise>
- Test coverage plan: <list of new tests>

Estimated scope:
- Files modified: <count>
- New files: <count>
- New tests: <count>
- Risk assessment: <low/medium/high + why>
```

**STOP at end of Phase 3.** Do not write any code. Wait for Kelsean's response: approval, edits to the design, or scope re-cut.

---

## Phase 4 — Implement (only after approval)

After Kelsean approves the design proposal, implement per the approved spec:

1. Follow the file modification list from Phase 3 exactly. Don't expand scope.
2. Use existing Nexus theme tokens (`--color-success`, `--color-warning`, `--color-danger`, `--color-primary` etc.) for any new visuals. No hardcoded colors.
3. 44px touch targets minimum (Retry button must comply).
4. Match existing project patterns (functional components, useMemo/useCallback for expensive calcs, no inline styles).
5. ARIA roles use `polite` for save success, `assertive` for errors and persistent failures.
6. Online detection via `navigator.onLine` + `window.addEventListener('online' / 'offline', …)`. Add cleanup on unmount.
7. Persistent-failure threshold: 3 consecutive failures (configurable as a constant, e.g. `MAX_AUTOSAVE_RETRIES = 3`).
8. Any new copy text uses the existing tone (warm, agent-facing, action-oriented). Surface to Kelsean if you need new microcopy strings — don't invent without check.

---

## Phase 5 — Tests

Add component-level tests for each new behavior:

1. **Retry button:** renders when save is in error state; click triggers retry; hides on success.
2. **Saved ✓ indicator:** appears after successful save, fades after N seconds (e.g. 3s).
3. **Offline detection:** simulating offline event shows offline-specific UI; online restoration clears it.
4. **ARIA announcements:** verify `role="status"` (or `alert`) + `aria-live` attributes are correct on the indicator element. Use `@testing-library/react`'s accessibility queries.
5. **Persistent failure:** after 3 simulated consecutive failures, escalated UI appears with manual-save path.

Aim for parity with existing wizard test patterns. If no existing tests cover the wizard save flow, surface this in Phase 5 output — do NOT skip tests because "no existing pattern."

`npm test` must remain 100% passing.

---

## Phase 6 — Production smoke (new standard, per project memory)

Apply the smoke standard memorialized in project memory. This is a more complex smoke than the rules-fix ones because we're exercising wizard write paths.

### Happy-path smoke (mandatory)

1. Launch Playwright, navigate to the Vercel preview URL after PR push (use `VERCEL_BYPASS_TOKEN` from `.env.local` in the main worktree — same approach as the E3 walk).
2. Sign in as test agent (`kelsean@gmail.com` / `AgentTest123!`).
3. Navigate to the weekly wizard.
4. Type into a field. Wait for the auto-save trigger.
5. **Verify Saved ✓ indicator appears.** Screenshot.
6. **Inspect the accessibility tree** for the indicator element. Verify `aria-live="polite"` (or `role="status"`) is present.
7. Hard reload (`page.reload({ waitUntil: 'networkidle' })`).
8. Re-open the wizard. **Verify the typed value persisted.**

### Offline-mode smoke (best-effort, can skip if technically painful)

1. Set browser context offline via Playwright (`context.setOffline(true)`).
2. Type into a field, wait for auto-save attempt.
3. **Verify offline-distinct UI appears** (not the generic "Error" message).
4. Set back online.
5. **Verify save recovers** (either auto or with retry button click).

If the offline smoke is brittle or requires significant scaffolding, skip it — document in PR description. The component tests in Phase 5 cover offline UI rendering; the production smoke is just nice-to-have for this sub-item.

### Persistent-failure smoke

Skip in preview/production (would require mocking the Firestore write to fail repeatedly). Cover entirely via Phase 5 component tests.

Save screenshots locally (gitignored). Reference them by description in the PR body.

---

## Phase 7 — Verify, commit, push, PR

1. `npm run lint` → 0 errors
2. `npm run build` → green
3. `npm test` → 100% passing
4. Commit (one or more conventional commits — small logical chunks are fine):
   ```
   feat(wizard): UX + a11y hardening — save indicator, retry, offline, ARIA, persistent-failure

   Five sub-items addressed:
   - Saved ✓ indicator (appears after successful auto-save, ARIA live region)
   - Retry button (renders on save error, manual recovery)
   - Offline-vs-failed distinction (navigator.onLine + event listeners)
   - role/aria-live announcements (polite for success, assertive for errors)
   - Persistent-failure escalation (3 consecutive failures → escalated UI)

   Component tests added: <count>
   Production smoke: PASS (happy path + ARIA inspection; offline smoke <ran/skipped — see PR body>)
   ```
5. Push, open PR titled: `feat(wizard): UX + A11y hardening — save indicator, retry, offline, ARIA, persistent-failure`
6. PR description MUST include:
   - The 5 sub-items, one paragraph each, before/after
   - Component test count + names
   - Production smoke results with screenshots
   - ARIA accessibility tree inspection result
   - Any design decisions deferred to Kelsean or noted as follow-ups
7. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Phase 3 surfaces that the wizard auto-save architecture is significantly different from expected (e.g., uses a complex state machine that needs refactoring rather than augmenting) → STOP and surface; re-scope before implementing
- Estimated scope in Phase 3 exceeds 8 files modified OR introduces new dependencies → STOP and surface; re-scope
- Production smoke fails on happy path → STOP and surface (regression)
- Test suite regression on existing tests → STOP and surface
- CI gate fails on the PR → STOP and fix before requesting review
- Two strikes hit → STOP

---

## Out of scope

- Wizard restructure or step changes (5-step structure stays as memory documents)
- Submission data model changes (no Firestore schema changes)
- Firestore rule changes
- Walk script changes (WALK-1 is separate)
- Mobile-specific styling fixes (that's Mobile FU#1, separate PR)
- New microcopy strings without Kelsean approval (surface before inventing)
- Touching other screens (only the wizard)
