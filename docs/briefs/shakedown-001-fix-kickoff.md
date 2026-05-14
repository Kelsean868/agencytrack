# SHAKEDOWN-001 — Manager First-Login Claims Propagation Fix — Kickoff Brief

**Status:** Ready to dispatch to fresh CC session.
**Estimated CC effort:** 1.5–2.5 hours, single PR.
**Two-strike counter:** Project carry-in **0/2**. Standard 2-strike loop applies.
**Main HEAD at brief drafting:** post-#140 squash SHA (CC captures in Phase 1).
**Source:** SHAKEDOWN-001 entry in `docs/FOLLOW_UPS.md` HIGH section. Pilot blocker — surfaced by 2026-05-13 shakedown run. Documented in `docs/shakedown-findings-2026-05-13.md`.

---

## Context

The 2026-05-13 shakedown found that Branch Managers and Unit Managers logging in fresh see the **Agent Dashboard** with role "Unknown" in the sidebar footer for several minutes. After ~4 minutes (by category 2 timing in CC's shakedown), claims have propagated and they see correct dashboards.

**Real-world impact:**
- Every new manager/UM Tatil onboards will see the wrong dashboard for several minutes after first login.
- The Welcome screen + agent surfaces render rather than the manager experience.
- Demo embarrassment, real-world confusion, possible support tickets at pilot launch.

**Suspected root cause** (Phase 1 confirms or refutes):
Firebase Auth custom claims set via Admin SDK have a propagation delay. The newly-issued ID token after sign-in may not yet carry the role claim. `AuthContext.jsx` has a comment that says "Profile role overrides claim role only if claim role was missing" — implying a fallback to the Firestore `users/{uid}.role` field exists — but the shakedown evidence shows role still resolves to "Unknown" for managers.

Either:
- The fallback exists but isn't firing for managers (logic bug)
- The fallback fires but the user doc read races behind dashboard rendering (timing bug)
- The Firestore doc doesn't have `role` populated when AuthContext reads it (seed-order bug)
- Some other path is overriding the resolved role back to null/undefined

Phase 1 discovery answers which.

This brief fixes whatever Phase 1 reveals.

---

## Decisions locked (do not re-litigate)

### Fix approach: Phase 1 determines exact change

The exact fix is not pre-decided — Phase 1 must trace the current `AuthContext.jsx` role-resolution flow, identify where "Unknown" originates, and surface the recommended change before any code edits. Kyron acks the proposed fix before Phase 2.

Expected fix shapes (CC surfaces which applies):
- **Shape A — Logic gap:** The doc-fallback path exists but has a condition bug (e.g., wrong field name, wrong null check). Surgical edit.
- **Shape B — Timing gap:** Doc is read but render happens before resolution completes. Add loading state until role is resolved OR force token refresh.
- **Shape C — Sync gap:** Add `currentUser.getIdToken(true)` after sign-in to force claims propagation. Standard Firebase Auth pattern for fresh claims.
- **Shape D — Combined:** All three (refresh token + ensure doc fallback fires + render loading until resolved).

Whatever shape, the fix must work for these scenarios:
1. Newly-created user signing in immediately after manager creation (claims may not be on ID token yet)
2. Existing user with valid claims signing in (no regression)
3. User with stale claims after role/branch change (PR-4b's claim refresh atomicity preserved)
4. Sign-out → sign-in as different user (clean state transition, no leaked role)

### Scope is bounded to AuthContext.jsx + authService.js (+ tests)

Phase 1 may surface a small adjustment elsewhere (e.g., `users/{uid}` doc creation timing in `doCreateUser`), but the primary fix lives in client-side auth state resolution. If Phase 1 finds the root cause is server-side (doc not created before user signs in), STOP and surface — that's a different shape of fix.

### Existing PR-4b claim-refresh atomicity must be preserved

The PR-4b change ensures role/branch edits trigger a token refresh atomically. Don't introduce a fix here that breaks that pattern.

### Verification: vitest unit test + manual smoke

- **Vitest test** for the AuthContext role-resolution logic (mock token states, mock doc states, assert correct role resolution). Pattern: `src/context/__tests__/AuthContext.test.jsx` if it doesn't exist, otherwise extend.
- **Manual smoke:** After PR merges, Kyron creates a fresh BM via UserManagementPanel and signs in. Dashboard should render correctly within seconds (not minutes). This is the production proof.

### No re-run of full shakedown in this PR

The shakedown re-run is a separate workflow after BOTH SHAKEDOWN-001 and SHAKEDOWN-002 land. This PR doesn't need to re-execute the shakedown — manual smoke confirms.

---

## Scope

Ships in this single PR:

- `src/context/AuthContext.jsx` — role resolution fix per Phase 1 findings
- `src/services/authService.js` — if Phase 1 surfaces auxiliary changes (e.g., token refresh helper)
- `src/context/__tests__/AuthContext.test.jsx` — new or extended; covers the resolution paths
- `docs/CONTEXT.md` "Recently shipped" row append
- `docs/FOLLOW_UPS.md` — SHAKEDOWN-001 entry marked resolved with closing PR # placeholder

---

## File inventory

**Files expected to touch:**

| Path | Change |
|---|---|
| `src/context/AuthContext.jsx` | Role resolution fix (shape per Phase 1) |
| `src/context/__tests__/AuthContext.test.jsx` | New test file OR extension if exists |
| `src/services/authService.js` | Possibly — only if Phase 1 surfaces a helper change |
| `docs/CONTEXT.md` | Recently-shipped row append (SHA/PR# placeholders post-merge) |
| `docs/FOLLOW_UPS.md` | SHAKEDOWN-001 entry resolved with placeholder |

**No new files expected beyond the test file.**

---

## Phases

### Phase 1 — Discovery (gates Phase 2)

**Surface in chat (no committed discovery doc):**

1. Capture main HEAD SHA via `git log origin/main --oneline -1`. Confirm post-#140 state.
2. Read `src/context/AuthContext.jsx` in full. Trace the auth state change handler:
   - Where does `role` come from? (claim, profile doc, fallback chain)
   - What are the intermediate states between signIn fire and role resolution?
   - Where does "Unknown" copy actually originate? (likely the sidebar footer rendering a default when role is undefined)
3. Read the BM/UM screenshots from `verification/shakedown-screenshots-*/` for T1.02 and T1.03 — confirm exact rendered state.
4. Identify which fix shape (A/B/C/D) applies based on the trace.
5. Identify any existing tests for AuthContext (likely none — Phase 1 confirms).
6. Identify the `users/{uid}` doc creation timing — Phase 1 verifies that the doc IS populated with `role` at the time the manager signs in (rules out the seed-order/server bug shape).

Surface: which fix shape, the specific change recommendation, the test plan. Kyron acks before Phase 2.

### Phase 2 — Apply fix

- Per the approved Phase 1 recommendation
- Surgical edit, preserve PR-4b atomicity, no behavioral changes for existing users with valid claims
- Add or extend AuthContext test covering the four scenarios from "Decisions locked"

### Phase 3 — Verification

- `npm run lint` → 0 errors
- `npm test -- --run` → all pass including new AuthContext tests
- `npm run build` → success
- Local dev-server smoke: log in as kelsean@gmail.com (test agent), confirm no regression in agent flow

### Phase 4 — Docs, commit, push, PR

- Update `docs/CONTEXT.md` Recently-shipped row with placeholders
- Update `docs/FOLLOW_UPS.md` — SHAKEDOWN-001 marked resolved with placeholder
- Conventional commit (single, or split if logical)
- Push, open PR
- **PR title:** `fix(auth): manager role resolution on first login (SHAKEDOWN-001)`
- **PR description must include:**
  - Summary referencing the shakedown finding
  - Phase 1 root cause identified
  - Fix shape applied (A/B/C/D)
  - Test coverage added
  - Verification matrix
  - Note: post-merge manual smoke to be performed by Kyron (create fresh BM, sign in, confirm correct dashboard)

### Phase 5 — STOP

DO NOT MERGE. Kyron reviews + performs manual smoke (or schedules it for after merge).

---

## Hard stops

- `npm run lint` fails → fix, don't commit broken state
- Existing tests start failing → STOP and surface (regression)
- `npm run build` fails → STOP and surface
- Phase 1 finds the root cause is SERVER-side (e.g., user doc creation order in doCreateUser) → STOP and surface, this is a different brief shape
- Phase 1 finds the fix requires touching more than `AuthContext.jsx + authService.js + tests` → STOP and surface scope expansion
- Phase 1 reveals PR-4b's atomicity pattern would be broken by the proposed fix → STOP and surface, propose alternative
- More than 1 hour spent in Phase 1 without converging on a root cause → STOP and surface, request guidance
- First unexpected behavior of any kind — standard 2-strike loop applies, lean toward surfacing early

---

## NOT in scope

- SHAKEDOWN-002 (UM cross-unit visibility) — separate fix brief
- Other shakedown findings (a11y violations, harness-only failures) — bank as polish/post-pilot
- Refactor of AuthContext beyond the SHAKEDOWN-001 fix
- Changes to `functions/index.js` (doCreateUser) — STOP and surface if Phase 1 points here
- Re-running the full shakedown — separate workflow after both 001 + 002 land
- Modifications to `firebase.json` or Firestore rules
- Changes to PR-4b claim-refresh logic
- Adding loading states beyond what's necessary for role resolution

---

## Verification matrix (CC must include in PR description)

| Item | Command | Expected |
|---|---|---|
| Lint clean | `npm run lint` | 0 errors |
| Tests pass | `npm test -- --run` | 100% pass including new AuthContext tests |
| Build succeeds | `npm run build` | success, no warnings |
| Fix shape documented | PR description | A/B/C/D identified with rationale |
| Phase 1 trace documented | PR description | Root cause line-numbered to AuthContext.jsx |
| CONTEXT.md updated | `git diff docs/CONTEXT.md` | Recently-shipped row added, oldest removed |
| FOLLOW_UPS.md updated | `git diff docs/FOLLOW_UPS.md` | SHAKEDOWN-001 marked resolved with placeholder |
| Existing agent smoke | Local dev-server, log in as kelsean@gmail.com | Agent dashboard renders correctly (no regression) |
| Post-merge manual smoke | Note in PR description | Kyron creates fresh BM via UserManagementPanel, signs in, confirms BM dashboard renders within seconds |

---

## CC kickoff prompt (one-liner)

> Execute the SHAKEDOWN-001 fix per the brief in `docs/briefs/shakedown-001-fix-kickoff.md`. Project strike count 0/2. Standard 2-strike loop. Read the brief, begin Phase 1 (discovery). Surface root cause + fix shape (A/B/C/D) + test plan in chat before any code changes. Do NOT merge — open PR with verification matrix, stop.
