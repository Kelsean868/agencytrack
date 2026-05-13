# SEC-9b — Services Migration to Explicit `tenantId` Parameter — Kickoff Brief

**Status:** Ready to dispatch to fresh CC session.
**Estimated CC effort:** 3–5 hours, single PR.
**Two-strike counter:** Project carry-in **0/2** (clean — six consecutive arcs shipped without strikes this week). Standard 2-strike loop applies.
**Main HEAD at brief drafting:** post-#138 squash SHA (CC captures in Phase 1).
**Source:** SEC-9b — last open MEDIUM in `docs/FOLLOW_UPS.md`, listed as "Queued" in `docs/CONTEXT.md`. Closes the pre-pilot MEDIUM queue. Original SEC-9 (PR #16) shipped the runtime holder pattern; SEC-9b retires it in favor of explicit parameter passing per the `TODO (SEC-9b)` comment in `src/firebase.js`.

---

## Context

SEC-9 (PR #16) introduced a runtime `tenantId` holder in `src/firebase.js`:
- `setRuntimeTenantId(id)` — called by AuthContext after auth claims resolve
- `getTenantId()` — called by services to read current tenant
- Throws when unpopulated (fails fast vs. silent undefined)

This pattern assumes one tenant per browser session — single-slot holder. Cross-tenant scenarios (platform_admin viewing multiple tenants in one session) aren't supported without per-call swapping, which is error-prone.

The TODO comment in `firebase.js` explicitly names this brief's work:

> If/when cross-tenant super-admin views are required, migrate services to accept tenantId as an explicit parameter (the pattern already used by notificationService.js).

SEC-9b retires the holder by migrating consumer services to explicit parameter passing, mirroring the pattern already in place for `notificationService`, `branchService`, `goalsService`, and the C2/C3 import services.

This is NOT pilot-blocking (single-tenant pilot doesn't exercise cross-tenant scenarios), but it's the last open MEDIUM and closes the pre-pilot queue cleanly. Worth shipping pre-pilot because refactors get harder once real production data is live.

---

## Decisions locked (do not re-litigate)

### Single PR, atomic migration

SEC-9 itself was a single PR (18 files); SEC-9b mirrors that as the matching cleanup. Sequenced PRs would create partial-state confusion where some services use the holder and others use parameters — easy to get wrong in the middle.

### Per-service commits within the PR

Inside the single PR, organize commits by service: one commit per migrated service. Reviewer can step through commit-by-commit. Final commit removes the holder from firebase.js.

### Delete the holder after migration (contingent on clean Phase 1 audit)

If Phase 1 audit confirms ALL consumers of `getTenantId()` are in `src/` and ALL can be migrated, Phase 5 deletes `getTenantId()`, `setRuntimeTenantId()`, and `_tenantId` from `src/firebase.js`, plus removes the AuthContext setter/clearer calls.

If Phase 1 finds anything unexpected (consumer in `functions/`, consumer that genuinely needs holder semantics, etc.), the deletion is deferred and banked as a follow-up. Migration still happens; only the firebase.js cleanup waits.

### No new tests for migrated services in this PR

Refactor is mechanical (rename + parameterize). Existing components calling these services exercise them via the build + manual smoke. Banking "add tests for migrated services" as an opportunistic follow-up in FOLLOW_UPS.

### Pattern target: `notificationService.js` and `branchService.js`

Both already take `tenantId` as the first parameter. Migrated services follow the same convention: `tenantId` is the first parameter, all other arguments follow.

### Callers source `tenantId` from `useAuth().tenantId` (React) or pass explicitly (non-React)

React components: get `tenantId` from `useAuth()` and pass it to service calls. Non-React contexts (utilities, helpers): must already have `tenantId` available in their scope, or be called from a React context that passes it. If Phase 1 finds a non-React caller without `tenantId` in scope → STOP and surface.

---

## Scope

Ships in this single PR:

- All consumers of `getTenantId()` migrated to explicit `tenantId` parameter
- AuthContext stops calling `setRuntimeTenantId()` (both populate and clear paths)
- `getTenantId()`, `setRuntimeTenantId()`, and `_tenantId` removed from `src/firebase.js` (contingent on clean Phase 1 audit)
- Updated JSDoc on all migrated service functions to document the `tenantId` parameter
- `docs/CONTEXT.md` "Recently shipped" row append (5-row sliding window, drop oldest)
- `docs/FOLLOW_UPS.md` — SEC-9b entry resolved with closing PR # placeholder; "Add tests for migrated services" banked as new opportunistic follow-up

---

## File inventory

**Note:** This is the brief's initial estimate based on project_knowledge_search. Phase 1 audit refines the actual list. If Phase 1 finds a meaningfully different set, STOP and surface.

**Expected files to touch (services):**

- `src/services/authService.js`
- `src/services/managerService.js`
- `src/services/persistencyService.js`
- `src/services/submissionService.js`
- `src/services/userService.js` (mixed today — some functions take `tenantId`, some use holder; finish the migration)

**Other files likely to touch:**

- `src/firebase.js` — remove holder (Phase 5, contingent)
- `src/context/AuthContext.jsx` — remove `setRuntimeTenantId` calls
- All React component callers of the migrated service functions — pass `tenantId` from `useAuth()`
- Existing service tests that mock the migrated services — signature update

**Estimated total call sites:** ~20 per CONTEXT.md historical estimate. Phase 1 audit produces the precise count.

---

## Phases

### Phase 1 — Audit (gates Phase 2; the strike-avoidance phase)

**Output:** structured chat surface (no committed audit doc — keep the discipline of past briefs):

1. **`getTenantId()` consumer enumeration.** Grep `src/` for `getTenantId(` (with paren to exclude `setRuntimeTenantId`). For each match: file path, function name, surrounding code context. Expected: 5 services per AuthContext comment.
2. **`setRuntimeTenantId()` consumer enumeration.** Grep `src/` for `setRuntimeTenantId(`. Expected: AuthContext only (both populate and clear paths).
3. **Cross-side check.** Grep `functions/` for `getTenantId` or `setRuntimeTenantId`. Expected: ZERO (server-side reads tenantId from auth claims, not the client holder). If non-zero → STOP and surface.
4. **Service function signature inventory.** For each consumer service, list all exported functions with their current signatures.
5. **Caller mapping.** For each migrated function, grep all import sites and call sites in `src/`. Group by:
   - React component callers (can use `useAuth().tenantId`)
   - Non-React callers (must already have `tenantId` in scope)
   - Test file mocks
6. **Caller-without-tenantId check.** Identify any non-React caller that does NOT currently have `tenantId` in scope. STOP and surface if found — this changes scope materially.
7. **Test file impact.** Identify all test files that mock the consumer services. List the mocks. Most will need signature updates (mocking a function that now accepts `tenantId`).

**Gate:** Phase 1 complete only when:
- All 5 services confirmed (or different count surfaced)
- Zero `getTenantId` references in `functions/`
- Zero non-React callers without `tenantId` in scope
- Test impact enumerated
- Total call site count surfaced (compare against ~20 estimate)

CC surfaces this in chat. Kyron acknowledges before Phase 2.

### Phase 2 — Per-service migration

For each of the 5 services (commit-per-service):

1. Update function signatures to accept `tenantId` as the first parameter.
2. Replace internal `getTenantId()` calls with the parameter.
3. Update JSDoc to document `tenantId` parameter.
4. Update all React component callers to pass `tenantId` from `useAuth()`.
5. Update all non-React callers to pass `tenantId` from their scope.
6. Update test mocks if needed (signature change may require mock updates).

Commit message format per service: `refactor(<service>): accept tenantId as parameter (SEC-9b)`.

### Phase 3 — AuthContext cleanup

- Remove `setRuntimeTenantId(claimTenantId)` call from the auth state change handler.
- Remove `setRuntimeTenantId(null)` call from the sign-out path.
- Remove the now-unused import of `setRuntimeTenantId` from `firebase.js`.

Commit: `refactor(auth-context): remove runtime holder setter calls (SEC-9b)`.

### Phase 4 — Build + test verification (gates Phase 5)

- `npm run lint` → 0 errors
- `npm run build` → success
- `npm test` → 100% pass (608 tests after #138 lands)

If anything fails → STOP and surface. Do NOT proceed to Phase 5 with broken state.

### Phase 5 — Delete the holder (contingent on clean Phase 1 audit)

Only execute if Phase 1 confirmed all consumers are migratable AND Phase 4 is fully green:

1. Delete `_tenantId` variable from `src/firebase.js`.
2. Delete `setRuntimeTenantId` function from `src/firebase.js`.
3. Delete `getTenantId` function from `src/firebase.js`.
4. Delete the SEC-9 lifecycle comment block (now obsolete).
5. Re-run `npm run lint` and `npm test` to confirm no remaining references.

Commit: `refactor(firebase): remove runtime tenantId holder (SEC-9b complete)`.

If Phase 1 surfaced reasons to defer deletion → skip this phase, bank as follow-up. Migration is still complete; the holder just stays dormant.

### Phase 6 — Docs, lint, build, commit, push, PR

- Update `docs/CONTEXT.md` Recently-shipped row (SHA/PR# placeholders).
- Update `docs/FOLLOW_UPS.md`:
  - SEC-9b entry: marked resolved with placeholder.
  - New opportunistic follow-up: "Add tests for migrated services — opportunistic when those services are next touched. Pattern reference: `agentManagementService.test.js` (PR #138)."
- Final `npm run lint`, `npm run build`, `npm test` all green.
- Push, open PR.
- **PR title:** `refactor(services): migrate to explicit tenantId parameter (SEC-9b)`
- **PR description must include:**
  - Summary
  - Phase 1 audit findings (consumer count, call site count, anything surfaced)
  - Per-service commit list with what changed in each
  - Whether holder was deleted (yes/no, with rationale if no)
  - Verification matrix
  - List of any opportunistic follow-ups banked

### Phase 7 — STOP

DO NOT MERGE. Kyron reviews per-service commits, runs independent build + smoke check, merges manually.

---

## Hard stops

- `npm run lint` fails at any point → fix immediately, don't commit broken state
- `npm test` fails after Phase 2 or Phase 5 → STOP and surface (regression in existing coverage)
- `npm run build` fails → STOP and surface
- Phase 1 finds `getTenantId` references in `functions/` → STOP, server-side scope is different (separate ticket SEC-9c)
- Phase 1 finds a non-React caller without `tenantId` in scope → STOP and surface (could require threading tenantId through extra layers — different shape than the planned refactor)
- Phase 1 surfaces meaningfully more than ~25 call sites → STOP, scope renegotiation needed
- Test files mock services in ways that block the signature change cleanly (e.g., mock returns hardcoded shapes that don't accept variable tenantId) → STOP and surface
- Any service has a circular import or other coupling that prevents clean migration → STOP and surface
- Phase 5 deletion finds residual references to `getTenantId` / `setRuntimeTenantId` → STOP, treat as Phase 2 incomplete
- First unexpected behavior of any kind — standard 2-strike loop applies

---

## NOT in scope

- Adding tests for migrated services — banked as opportunistic follow-up
- Server-side (`functions/`) tenantId handling — SEC-9c separate ticket
- Cross-tenant routing UI for platform_admin — post-pilot
- Multi-tenant data isolation hardening — SEC-9c
- New service additions or refactors beyond signature change
- Behavioral changes to any service function (rename + parameterize only — pure refactor)
- Migration of `setCustomUserClaims` or other Cloud Function utilities
- Changes to `firestore.rules` (rules have their own `getTenantId()` helper, unaffected by this refactor)

---

## Verification matrix (CC must include in PR description)

| Item | Command | Expected |
|---|---|---|
| Lint clean | `npm run lint` | 0 errors (2 pre-existing warnings baseline) |
| Tests pass | `npm test -- --run` | 49 files / 608 tests, 100% pass |
| Build succeeds | `npm run build` | success, no warnings |
| Holder removed (if Phase 5 ran) | `Select-String -Path src\firebase.js -Pattern "getTenantId\|setRuntimeTenantId"` | No matches |
| AuthContext cleaned | `Select-String -Path src\context\AuthContext.jsx -Pattern "setRuntimeTenantId"` | No matches |
| Services use parameter | `Select-String -Path src\services\*.js -Pattern "getTenantId\(\)"` | No matches in migrated services |
| No functions/ impact | `Select-String -Recurse -Path functions\* -Pattern "getTenantId\|setRuntimeTenantId"` | No matches |
| CONTEXT.md updated | `git diff docs/CONTEXT.md` | Recently-shipped row added, oldest removed |
| FOLLOW_UPS.md updated | `git diff docs/FOLLOW_UPS.md` | SEC-9b resolved; new opportunistic follow-up banked |
| PR CI green | GitHub PR Checks tab | lint + test + build all pass |

---

## CC kickoff prompt (one-liner)

> Execute SEC-9b services migration per the brief in `docs/briefs/sec-9b-services-explicit-tenantid-kickoff.md`. Project strike count 0/2 (clean). Standard 2-strike loop. Read the brief, begin Phase 1 (audit). Surface findings in chat before any code changes. This is a larger refactor than recent briefs — discovery gate is load-bearing. Do NOT merge — open PR with per-service commits, stop.
