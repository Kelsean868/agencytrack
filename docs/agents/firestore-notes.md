# Firestore, rules and Cloud Functions — traps and query notes

Moved out of CLAUDE.md (§ Key Technical Decisions, original lines 189–192; § Banked
patterns, lines 784, 788, 790, 804, 806) on the router split.

**Read this file before writing `firestore.rules`, adding a composite index, or writing a
Cloud Function that puts a `FieldValue` sentinel inside an array.** CLAUDE.md carries a
one-line sentinel pointing here; the failure modes below are the reason it exists — two of
them produce a *falsely passing* test rather than an error.

## `isTestAccount` — the two leaderboard surfaces

CLAUDE.md keeps the binding summary (flagged accounts are excluded from both leaderboard
surfaces; set via `scripts/maintenance/flag-test-accounts.mjs`; `kyronmarchan+tenant@gmail.com`
is hard-excluded from flagging). The mechanism:

- `isTestAccount: true` on a user doc (`tenants/{tid}/users/{uid}`) excludes that account from both leaderboard surfaces. Two-surface architecture:
  - **`leaderboard/{uid}` (singular, gamification points, `Leaderboard.jsx`):** Write-layer guard in `onSubmissionWrite` (CF) — if flagged, skips the leaderboard `.set()` and deletes any existing `leaderboard/{uid}` doc (self-healing). Banked PR #550 (`0ccab45`).
  - **`leaderboards/{branchId}` (plural, branch-aggregate podium + champions, `ProductionLeaderboardSurface.jsx` via `useLeaderboard.js`):** Read-layer filter in `leaderboardAggregate.js` (`groupByBranch` + `computeWeeklyChampions`) — test accounts excluded from `branchByAgent` map (subs dropped/skipped), from `byBranch.users` (not ranked even at $0), and from weekly champion eligibility. Propagated by hourly `recomputeLeaderboardScheduled` cron or `recomputeLeaderboardOnDemand` callable. Banked PR #552 (`8d91eeb`).
  Set via `scripts/maintenance/flag-test-accounts.mjs` (`--apply --emails`). Hard-excluded from flagging: `kyronmarchan+tenant@gmail.com` (real tenant admin). Absent/false → behavior unchanged on both surfaces.

## collectionGroup rules need a top-level recursive wildcard

- **Firestore collectionGroup rules require a top-level recursive wildcard `match /{path=**}/collectionName/{id}`.** Path-specific match rules (`match /tenants/{tid}/users/{uid}/collectionName/{id}`) are NOT reliably evaluated for collectionGroup queries by Firestore's security rule engine. ALWAYS add a separate top-level wildcard match when a collection needs a `allow list` for collectionGroup access. Two additional gotchas caught in I1.2 (PR #256): (1) A combined `allow list: if arm1 || arm2` where arm2 references a `{pathVariable}` causes production Firestore to reject the ENTIRE OR expression for collectionGroup queries — it cannot short-circuit OR when any arm is statically unverifiable. Split such rules into two separate `allow list` declarations (each is evaluated independently). (2) The emulator false-fails for collectionGroup rules that reference path variables in any arm — production Firestore is the authoritative gate for collectionGroup rule validity. Emulator-green is necessary but not sufficient for collectionGroup rules.

## `hasOnly` deny-tests must change the value

- **`hasOnly` enforcement relies on `diff().affectedKeys()`, so unchanged field values are invisible to the rule.** Firestore's `request.resource.data.diff(resource.data).affectedKeys()` only includes keys whose values *change* in the write. If an emulator deny-test writes `{ agentId: 'agent-a' }` and the document already has `agentId: 'agent-a'`, `agentId` does NOT appear in `affectedKeys()`, `hasOnly` never evaluates it, and the write is allowed. **Emulator deny-tests for `hasOnly` violations must write a value that differs from the existing document** (e.g. `agentId: 'tampered-id'`) so the key appears in the diff and triggers the rule. Same caveat applies to `hasAll`, `hasAny`, and any rule expression that reads from `diff().affectedKeys()`. Banked from PR #365 (`359149b`, 2026-05-27).

## `FieldValue.serverTimestamp()` is rejected inside array elements

- **`FieldValue.serverTimestamp()` is rejected by Firestore inside array elements during `tx.update()` — use `Timestamp.now()` instead.** Firestore's Admin SDK enforces this at runtime, not at type-check time: `Update() requires either a single JavaScript object… FieldValue.serverTimestamp() cannot be used inside of an array (found in field "pendingReview.\`0\`.firstLoggedAt")`. Replace with `admin.firestore.Timestamp.now()` (a real value, not a sentinel) anywhere a timestamp is stored inside an array field. CF unit tests that mock `admin.firestore.FieldValue` to return a plain string do NOT catch this — the mock is a valid Firestore value but the sentinel validation only fires against real Firestore. Always verify CF writes that use `FieldValue` methods inside arrays via post-deploy smoke or CF emulator integration tests. Banked from PR #373 (`df161fe`, 2026-05-28) — H4 `aggregatePendingPlan` CF.

## Self-service `list` queries must be smoke-tested as the owning user

- **Self-service `list` queries must be smoke-tested as the owning user.** For any Firestore collection where an agent (or any `canAccessOwn` user) should be able to list their own docs, the smoke MUST include a write-then-list cycle signed in as that user: `signInAs(agentUid) → getDocs(query where ownerId == uid) → assert non-empty`. Admin SDK reads (bypass rules) and manager reads (`canManage`) do NOT prove agent list access. Pattern: `allow read → allow get/list` split silently drops the `canAccessOwn` arm from `list`; verified only by an agent-signed-in list query. This is the second `list`-rule regression to slip past `get`-only coverage (SHAKEDOWN-002B → hotfix PR #298). Banked from PR #298 (`a2ffbff`).

## Cron timezone handling for the Trinidad pilot

**Cron timezone handling for Trinidad pilot:** Trinidad observes permanent AST (UTC-4, no DST). Firebase Functions v1 default is `America/Los_Angeles` (DST-observing). For scheduled functions whose cron strings are written in UTC reasoning (e.g., comments like "Sunday 6 PM Trinidad time = 22:00 UTC"), chain `.timeZone('UTC')` to preserve author intent and avoid DST drift. Alternative — `.timeZone('America/Port_of_Spain')` with cron strings rewritten to AST-local — works but requires rewriting all cron strings.
