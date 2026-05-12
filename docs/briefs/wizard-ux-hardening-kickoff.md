> **⚠️ SUPERSEDED** — the 5 hardening items in this brief were already shipped in [PR #88](https://github.com/Kelsean868/agencytrack/pull/88) on 2026-05-11. This brief is retained as historical reference only. The R1 micro-fix (Saved-while-offline semantic copy) shipped via [PR #124](https://github.com/Kelsean868/agencytrack/pull/124). R2-R5 deferred polish items are tracked in `docs/FOLLOW_UPS.md` under "Wizard polish (post-pilot)".
>
> **Process lesson:** this brief was drafted from a stale FOLLOW_UPS.md state without verifying actual codebase state. Future brief drafting from FOLLOW_UPS.md items must verify topic state via `git log --all --grep="<topic>"` as step 0.

---

# WIZARD-UX — Weekly Wizard UX + A11y hardening — kickoff brief

**Status:** Third post-M-series PR. Path (A) HIGH-priority sequence, 3 of 3 (final HIGH item).
**Estimated CC effort:** 1 day. Single PR.
**Two-strike counter:** 0/2 (fresh session).
**Project carry-in:** 0/2 (clean state).

---

## Context

The Weekly Wizard is the highest-frequency surface in the app — every agent uses it every week, every manager reviews submissions weekly. UX friction here gets multiplied by every-agent-every-week.

Five specific gaps tracked in the follow-up backlog need resolution before pilot launch:

1. **Retry button** — when save fails, no clear retry affordance; user has to trigger another change to re-fire the auto-save
2. **Saved✓ indicator** — visual confirmation that auto-save fired and succeeded; without this, users don't know if their data is safe
3. **Offline-vs-failed distinction** — both currently show as generic "save failed"; offline (no connection) is recoverable by reconnecting, failed (server error) needs retry; users should know which they're dealing with
4. **role=alert/aria-live** — screen reader announcement for save status; a11y baseline currently missing
5. **Persistent-failure handling** — when save fails repeatedly, the wizard should escalate visibly without losing user work

Small individually, compound into a meaningfully better daily experience.

**What this PR DOES:**
- Build a proper save-status indicator with 5 explicit states: idle / saving / saved / failed / offline
- Add retry button affordance when save fails
- Detect offline state via `navigator.onLine` + online/offline event listeners
- Wire aria-live announcements for save state changes
- Implement persistent-failure detection (N consecutive failures → escalated UX response)
- Optional: local-storage backup for offline state (Phase 3 design call)

**What this PR does NOT do:**
- Refactor the wizard's step structure (already shipped in P7A)
- Change wizard validation logic
- Modify the save service backend (uses existing autoSave flow)
- Add offline-first capability beyond local backup of in-flight work
- Touch other surfaces (Goals, Awards, Settlements have separate save flows)

**Closures expected in PR description** (not in FOLLOW_UPS.md):
- Resolves "Wizard UX+A11y hardening (retry button, Saved✓ indicator, offline-vs-failed distinction, role=alert/aria-live, persistent-failure handling)" from post-M-series HIGH backlog

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -5`. HEAD should include the PR-4 squash commit at top.
4. Confirm clean state: `git worktree list` shows only main + the stale TA-cleanup filesystem residue (per PR-4's banked finding — git metadata is clean, the directory is Windows-file-locked). Don't try to remove the locked directory.
5. Create worktree at `.claude/worktrees/feat-wizard-ux-hardening` on branch `feat/wizard-ux-hardening`.
6. `cd` into the worktree.

---

## Phase 2 — Discovery

### 2a — Current wizard save flow

1. `src/components/wizard/WizardForm.jsx` — read in full. Capture:
   - State management (form values, current step, save state)
   - Auto-save mechanism (debounce timing, what triggers it, what payload it sends)
   - Existing save status state shape (idle/saving/saved/error or similar)
   - How saves are dispatched (service call, with what error handling)
2. `src/components/wizard/WizardFormSaveStatus.jsx` (or similar — search for the existing save-status component). Capture:
   - Current rendering — what does the user see today?
   - Props/state passed in
   - Whether retry affordance exists
   - aria-live or role attributes (likely missing)
3. The save service — likely `src/services/submissionService.js` or similar. Capture:
   - The save function signature
   - Error handling — does it throw, return error object, or signal differently?
   - Whether errors are distinguishable (network vs server vs validation)

### 2b — Connectivity detection patterns

1. Check existing usage of `navigator.onLine` in the codebase (likely none today)
2. Note browser event support: `window.addEventListener('online', ...)` + `window.addEventListener('offline', ...)`
3. **Important caveat:** `navigator.onLine` is unreliable — reports "online" if connected to any network, even if internet is unreachable. Use BOTH: `navigator.onLine` as primary signal, fetch failure as secondary signal.

### 2c — A11y patterns already in use

1. Search the codebase for existing `role="alert"`, `role="status"`, `aria-live` usage. Capture patterns to mirror.
2. Toast.jsx (Polish-1) already uses these — confirm patterns we use here are consistent.
3. Save status announcement pattern:
   - `role="status"` + `aria-live="polite"` for routine state changes (saving, saved)
   - `role="alert"` + `aria-live="assertive"` for failure states (urgent attention)

### 2d — Existing save error UX

1. Find where save errors currently surface. Likely a simple error string in WizardForm state with minimal visual treatment.
2. Capture: what error info reaches the user today? Generic "save failed" or something more specific?
3. Determine error categorization possibilities:
   - Network error (fetch fails / TypeError on fetch)
   - Server error (HTTP 5xx)
   - Auth error (HTTP 401/403)
   - Validation error (HTTP 400 with field errors)
   - Unknown (everything else)

---

## Phase 3 — Design + scope surface (STOP HERE — design gate)

Output a structured surface covering all 5 items:

```
DISCOVERY — Wizard UX + A11y hardening

CURRENT STATE:
- WizardForm.jsx: <save state shape, where it lives>
- WizardFormSaveStatus.jsx: <current rendering description>
- Save service: <signature, error handling>
- A11y baseline: <what role/aria attrs exist today>
- Error categorization: <what's possible from current error shape>

ITEM 1 — SAVE STATUS INDICATOR DESIGN
States (5):
- idle: <visual — possibly absent / hidden>
- saving: <visual — spinner + "Saving…">
- saved: <visual — checkmark + "Saved" + last-saved timestamp>
- failed: <visual — error icon + reason + Retry button>
- offline: <visual — offline icon + "Offline — changes will save when reconnected" + retry-when-online>

Placement: <inside step header / fixed bar at top / next to navigation buttons>
Visual hierarchy: prominent enough to notice, quiet enough not to distract
Recommendation: <one approach with rationale>

ITEM 2 — RETRY BUTTON
Placement: inside the failed-state indicator
Affordance: <button with "Retry" label + RefreshCw icon>
Behavior: re-fires the save with the same payload
Throttle: minimum 2 seconds between manual retries (prevent rapid-tap fury)

ITEM 3 — OFFLINE DETECTION
Primary signal: navigator.onLine + online/offline events
Secondary signal: fetch failure pattern (TypeError or fetch-failed error)
State transitions:
- online → offline: triggered by event listener; show offline UI
- offline → online: triggered by event listener; auto-retry pending save
Recommendation: <one approach for false-positive handling — navigator.onLine reports online when on captive wifi with no internet>

ITEM 4 — ARIA-LIVE ANNOUNCEMENTS
- role="status" aria-live="polite" on the indicator container for routine states (saving, saved)
- role="alert" aria-live="assertive" on failed/offline states (urgent)
- Toggle pattern: change role/aria-live attributes based on state, OR use two separate live regions (one polite, one assertive)
Recommendation: <one approach>

ITEM 5 — PERSISTENT-FAILURE HANDLING
Threshold: <N consecutive failures = persistent — recommend 3>
Escalation UX:
- After threshold reached, indicator becomes more prominent (e.g., banner pinned to top of wizard, not just inline indicator)
- Copy: "Save has failed N times. Your work is preserved locally and will sync when the issue resolves." (assuming local backup is included)
- Action button: "Retry now" + secondary "Contact support" link
Optional: local-storage backup of in-flight wizard state for offline / persistent-failure scenarios

OPTIONAL — LOCAL STORAGE BACKUP:
Scope decision in Phase 3:
- (a) Include: localStorage backup of form state on every change; restore on wizard re-open if Firestore save hasn't succeeded yet. Protects user work in offline + persistent-failure scenarios.
- (b) Defer: simpler scope; rely on user staying on the page until save succeeds.
Recommendation: <(a) or (b) with rationale — (a) is genuinely valuable for the use case but adds ~80 lines of code; (b) is cheaper but loses work in offline scenarios>

NEW / MODIFIED COMPONENTS:
- WizardForm.jsx: wire new state machine, online/offline listeners, persistent-failure tracking
- WizardFormSaveStatus.jsx: heavy modification — 5 states, retry button, offline UI
- NEW hook (recommended): useOnlineStatus.js — encapsulates navigator.onLine + event listeners
- NEW hook (optional, if (a) is chosen): useWizardBackup.js — localStorage backup logic
- Toast integration: useToast for "back online" notification (transient, useful) and persistent-failure escalation
- Tests: RTL coverage for all 5 states + retry behavior + online/offline transitions

SCOPE ESTIMATE:
- Files modified: <count>
- New files: <count, including hooks>
- Total file count: <under 30 ceiling>
- Risk: LOW for visual additions; MEDIUM for offline detection (false-positive handling); LOW for aria-live (simple attrs); MEDIUM for persistent-failure (threshold tuning)

SHOULD WIZARD-UX BE SPLIT?
- Single PR feasible — items 1-4 share state machine + indicator component
- Item 5 (persistent-failure) + optional local-storage backup adds the most lines but is conceptually unified
- Recommendation: single PR

OPEN QUESTIONS FOR KELSEAN:
- Local-storage backup: include (a) or defer (b)?
- Persistent-failure threshold: 3 consecutive failures, or different?
- Offline UI copy: lock specific wording (current proposal: "Offline — changes will save when reconnected")
- Failed-state copy: generic or include error details (e.g., "Save failed: <error name>") — privacy/UX tradeoff
- aria-live single region with role-toggle, or two regions (polite + assertive)?
- Toast for "back online after offline": include or skip (user already sees the indicator update)
- Indicator placement: inline in step header / fixed top bar / floating bottom-right?
```

**STOP at end of Phase 3.** Wait for Kelsean to:
- Lock the 5-state indicator design + placement
- Decide local-storage backup
- Lock persistent-failure threshold
- Approve specific copy strings
- Confirm aria-live approach
- Greenlight Phase 4

---

## Phase 4 — Implement (only after Phase 3 approval)

Build per locked design. Order:

1. **useOnlineStatus hook** — primary connectivity detection, encapsulates browser APIs
2. **WizardFormSaveStatus refactor** — 5-state indicator with retry button + offline UI + aria-live
3. **WizardForm wiring** — state machine integration, online/offline listeners, persistent-failure counter
4. **Optional: useWizardBackup hook** — if Phase 3 approves local-storage backup
5. **Toast integration** — "back online" + persistent-failure escalation
6. **Tests** — RTL coverage for all 5 states + transitions + retry + offline simulation

**Constraints (carry over):**
- Use M1 primitives where applicable (SaveButton already in use for explicit submit; this is about the auto-save indicator)
- Use Polish-1 Toast primitive for transient state-change notifications
- Use existing Nexus tokens — no new ones
- 44px touch targets for retry button
- Dark mode parity
- `prefers-reduced-motion` respected for any indicator animations
- Functional components, hooks for state
- A11y baseline: role/aria-live per Phase 3 approval; keyboard focus on retry button when failed state activates

**No data layer change.** The save service and submission schema stay as-is. Only the indicator + state machine + connectivity detection change.

---

## Phase 5 — Tests

Required coverage:

**Indicator states:**
- All 5 states render with correct visual + correct role/aria-live
- State transitions fire in expected sequence (idle → saving → saved; idle → saving → failed; etc.)
- Retry button visible only in failed state

**Connectivity behavior:**
- Mock navigator.onLine + online/offline events
- Verify offline event triggers offline UI
- Verify online event triggers auto-retry (if save was pending)

**Persistent-failure:**
- After N=3 consecutive failures, escalated UX appears (e.g., banner / different copy)
- Counter resets on successful save

**Local-storage backup (if (a) approved):**
- Form state writes to localStorage on change (with key tied to user + week)
- On wizard re-open with unsaved local state, prompt to restore
- On successful save, clear local backup

**A11y:**
- role/aria-live attributes correct per state
- Retry button keyboard-accessible + correctly focused on failed state

`npm test` must remain 100% passing.

---

## Phase 6 — Production smoke (CC EXECUTES — non-negotiable per project standard)

Use `scripts/verification/lib/walk-helpers.mjs` setupBypassSession pattern.

### Smoke scope

1. **Save indicator visible verification:**
   - Sign in as test agent (`kelsean@gmail.com`)
   - Open the wizard
   - Make a change → indicator shows "Saving…" → transitions to "Saved" with timestamp
   - Capture screenshots showing the saved state at desktop + mobile

2. **Retry button verification:**
   - Hard to simulate save failure in production smoke — use Playwright route intercept to force a 500 response on the save endpoint
   - Verify failed state UI appears with retry button
   - Click retry → save re-fires (intercept can be cleared to confirm success)

3. **Offline detection verification:**
   - Use Playwright's `context.setOffline(true)` to simulate offline
   - Indicator transitions to offline UI
   - `context.setOffline(false)` → indicator returns to idle/saved → optional Toast fires for "back online"

4. **A11y verification:**
   - Inspect DOM for correct role + aria-live attributes per state
   - Run a basic a11y scan (axe-core if available, or manual verification of focus + announcements)

5. **Persistent-failure verification:**
   - Force 3 consecutive 500 responses via route intercept
   - Verify escalated UX appears after 3rd failure
   - Clear intercept; click retry → save succeeds → counter resets

6. **Regression sweep:**
   - Other manager surfaces still render
   - Other agent surfaces still render
   - Login flows still work

### Smoke gates

- All 5 indicator states verifiable
- Retry behavior works
- Offline simulation works
- A11y attributes correct
- Persistent-failure escalates correctly
- No console errors
- No regression on other surfaces

If smoke fails:
- Indicator state issues: fix in scope
- Offline detection issues: re-evaluate primary/secondary signal approach
- Persistent-failure threshold off: adjust per Phase 3 lock

---

## Phase 7 — Verify, commit, push, PR

1. `npm run lint` → 0 errors
2. `npm run build` → green
3. `npm test` → 100% passing
4. Commit organization (logical chunks):
   - `feat(wizard): useOnlineStatus hook with online/offline event listeners`
   - `feat(wizard): WizardFormSaveStatus 5-state indicator + retry + offline UI + aria-live`
   - `feat(wizard): WizardForm wires persistent-failure detection`
   - `feat(wizard): localStorage backup hook for offline + persistent-failure scenarios` (if (a))
   - `feat(wizard): Toast integration for back-online + persistent-failure escalation`
   - `test(wizard): RTL coverage for save status states + transitions + a11y`
5. Push, open PR titled: `feat(wizard): WIZARD-UX — save status hardening + offline detection + a11y`
6. PR description MUST include:
   - **Summary:** 5 UX gaps closed (retry / Saved✓ / offline-vs-failed / aria-live / persistent-failure)
   - **Closes:** Wizard UX+A11y hardening from post-M-series HIGH backlog
   - **State machine diagram or description** of the 5 indicator states + transitions
   - **A11y improvements** explicit list
   - **Smoke results** from Phase 6 — screenshots embedded
   - **Path (A) progress: 3/3 HIGH items closed. MEDIUMs begin next.**
7. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Phase 2 reveals current save flow is significantly different from expected (e.g., not auto-save but explicit-save) → SURFACE; brief may need re-scope
- Phase 3 offline detection requires service-worker or other infrastructure → SURFACE; may be out of scope
- Phase 6 cannot simulate offline via Playwright APIs → fall back to mocked smoke with surface in PR description
- Any source code changes outside Wizard surfaces → STOP
- Test suite regression → STOP
- CI gate fails → STOP and fix before requesting review
- ANY token appearance in any artifact → IMMEDIATE STOP
- Two strikes hit → STOP

---

## Out of scope

- Service-worker based offline-first capability (significant scope)
- Wizard step refactoring (already done in P7A)
- Save service backend changes
- Validation logic changes
- Other surfaces' save flows (Goals, Awards, Settlements have separate paths)
- Updating `docs/FOLLOW_UPS.md`

---

## What success looks like

After this PR merges:

1. Agents see clear save status at all times — never wonder if their work is saved
2. Failed saves are recoverable with one-tap retry
3. Offline state is distinct from failed state — users know to wait vs act
4. Screen reader users get appropriate announcements
5. Persistent failures don't silently lose work
6. **Path (A): all 3 HIGH items closed.** Wizard is the most-used surface in the app; hardening it before pilot is the right call.

After WIZARD-UX merges, the remaining backlog is MEDIUM + LOW priority — none of it pilot-blocking. Pilot launch becomes a real option whenever you're ready.
