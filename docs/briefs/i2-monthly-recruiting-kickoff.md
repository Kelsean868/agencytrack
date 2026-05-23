# I2 — Monthly Recruiting Input — Kickoff Brief

**Track:** I (Manager Activity Reporting) · **Item:** I2 · **Type:** new collection + rule + index + write path + UI (medium) · **Risk:** Phase-1 HARD-STOP (new collection, new rule, new index)

---

## Scope (one PR)

A new monthly recruiting collection with its own write path and a sibling top-level tab. This is **net-new monthly input**, not a roll-up — `candidatesAssessed` and `agentsContracted` exist nowhere in source today (audited: zero hits in `src/`, `functions/`, `firestore.rules`, `firestore.indexes.json`). The WAR already captures top-of-funnel recruiting weekly (`namesSourced`, `interviewsConducted`, `recruitsInFirstWeeks`); I2 captures the two further-down-funnel monthly stages a manager enters once per month.

In scope: the collection + rule + index, a `managerMonthlyRollupService.js`, the manager's monthly input form, the upline team-view, tests, and the rule/index deploy. Out of scope (banked as FUs below): monthly targets/standards + accountability flag, `recruitsInFirstWeeks` auto-derive, a compliance edit-freeze, and the head-of-sales definitional confirmations.

---

## Locked decisions

1. **Storage key = `YYYY-MM`; display = `MM-YYYY`.** `monthKey` is stored as `YYYY-MM` (and baked into the doc-id) so the lexicographic string sort in the index equals chronological order. **Every user-facing surface** — the month picker, all labels, the team-view column — renders `MM-YYYY` (T&T convention). Store ISO, display local. Never store `MM-YYYY` (it would sort Jan-2027 before May-2026 and break the index/range queries).
2. **UI placement = Option B** — a new sibling top-level tab in the manager area (not folded into the weekly WAR tab; monthly ≠ weekly cadence).
3. **Edit window = no time gate** (mirror the WAR + persistency). A compliance freeze is a possible future, banked, not built.
4. **Monthly fields are unstandarded in I2** — capture only, no targets/flag yet. "Monthly recruiting standards + accountability flag" is banked as an FU to layer once data flows and definitions are confirmed.
5. **`recruitsInFirstWeeks` auto-derive (prep-doc open #7) = deferred** → FU (I3-adjacent, not I2).
6. **Definitions are provisional** — `candidatesAssessed` / `agentsContracted` get provisional labels + help text flagged provisional (same convention as the tenure bands). Kyron confirms semantics with head-of-sales in parallel; not blocking.

---

## Phase 0 — clean-main gate
`git checkout main && git fetch origin && git pull --ff-only origin main && git status`. Confirm HEAD = the current main HEAD (will be in the dispatch). Anything else → HARD-STOP and report. Untracked `scripts/verification/*.mjs` → ignore. Single branch off fresh main: `feat/i2-monthly-recruiting`. Never reuse.

---

## Phase 1 — HARD-STOP source-verify (NO code; STOP for Claude's lock before writing the rule)

Confirm and report; then **STOP** for Claude to lock before any rule/code:

1. **Rule helpers available.** Confirm `roleRank()`, `getRole()`, `getTenantId()`, `isSignedIn()` are top-level rule functions usable inside a `match /tenants/{tenantId}/managerMonthlyRollups/{rollupId}` block (roleRank hoisted in #268). Confirm `callerBranchId(tenantId)` + `uplineCanRead()` will be **block-local** (mirroring the WAR — they take/scope `tenantId` from the surrounding match), not hoisted.
2. **The match block compiles.** Draft the rule block below and confirm `firebase deploy --only firestore:rules --dry-run` (or emulator load) accepts it.
3. **`unitId` always present on manager user docs.** The rule's `validRollupWrite()` and the service write `unitId`. Grep `buildDocFields` / the user-doc schema and confirm `unitId` is always present on UM/BM/SM user docs (as `branchId` is). If a role legitimately lacks `unitId` (e.g. SM/BM not in a unit), report it — we may need it optional in the rule.
4. **Doc-id existence trick.** Confirm the WAR's null-resource pattern at `firestore.rules:711` (`warId.split('_')[0] == request.auth.uid`) works identically for `rollupId.split('_')[0]` — i.e. the owner's pre-write `getDoc` on a not-yet-existing `{uid}_{YYYY_MM}` doc passes `get`.
5. **Index scope.** Confirm the WAR index is `COLLECTION`-scoped (not collectionGroup) and that I2's `(branchId ASC, monthKey ASC)` should match that scope.

**STOP. Report 1–5. Wait for Claude's lock before writing the rule or any code.**

---

## Phase 2 — build

### Collection
`/tenants/{tid}/managerMonthlyRollups/{managerId}_{YYYY_MM}`

Doc-id `{managerId}_{YYYY_MM}` (predictable → owner existence-check on null resource). Fields:
- `managerId`, `tenantId`, `monthKey` (string `YYYY-MM`), `managerRole`, `managerRoleRank`, `branchId`, `unitId`
- `candidatesAssessed` (int ≥ 0), `agentsContracted` (int ≥ 0)
- `status` (`'draft' | 'submitted'`), `updatedAt`
- optional: `submittedAt`, `notes` (free text, trimmed, ≤ 1000 chars)

Privacy = **WAR direction**: owner RW, upline R; peers + downline DENY.

### Rule block (proposed — verified to mirror `managerWeeklyReports` at `firestore.rules:648-722`; lock at Phase 1)
```
match /managerMonthlyRollups/{rollupId} {
  function callerBranchId(tenantId) {
    return get(/databases/$(database)/documents/tenants/$(tenantId)/users/$(request.auth.uid)).data.branchId;
  }
  function uplineCanRead() {
    return roleRank() > resource.data.managerRoleRank
      && (
        getRole() in ['tenant_admin', 'platform_admin', 'sales_manager']
        || (getRole() == 'branch_manager'
            && callerBranchId(tenantId) == resource.data.branchId)
      );
  }
  function validRollupWrite() {
    let d = request.resource.data;
    return d.managerId == request.auth.uid
      && d.tenantId == tenantId
      && d.keys().hasAll([
           'managerId', 'tenantId', 'monthKey',
           'managerRole', 'managerRoleRank', 'branchId', 'unitId',
           'candidatesAssessed', 'agentsContracted',
           'status', 'updatedAt'
         ])
      && d.candidatesAssessed is int && d.candidatesAssessed >= 0
      && d.agentsContracted   is int && d.agentsContracted   >= 0
      && d.status in ['draft', 'submitted']
      && d.monthKey is string
      && d.managerRole in ['unit_manager', 'branch_manager', 'sales_manager']
      && d.managerRoleRank == roleRank();
  }
  allow create: if isSignedIn() && getTenantId() == tenantId
    && getRole() in ['unit_manager', 'branch_manager', 'sales_manager']
    && validRollupWrite();
  allow update: if isSignedIn() && getTenantId() == tenantId
    && resource.data.managerId == request.auth.uid
    && validRollupWrite();
  allow get: if isSignedIn() && getTenantId() == tenantId
    && (resource == null
        ? rollupId.split('_')[0] == request.auth.uid
        : resource.data.managerId == request.auth.uid || uplineCanRead());
  allow list: if getTenantId() == tenantId
    && roleRank() >= 2
    && (resource.data.branchId == callerBranchId(tenantId) || roleRank() >= 3);
  allow delete: if false;
}
```
Notes: no `jfwCount`-immutability analog (no CF auto-count for monthly fields). `list` mirrors the WAR's no-`isSignedIn` shape (relies on `getTenantId() == tenantId`, which implicitly requires a token) — keep it identical, do not "improve" it.

### Index
`firestore.indexes.json` — add, COLLECTION-scoped (mirror the WAR):
```
{
  "collectionGroup": "managerMonthlyRollups",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "branchId", "order": "ASCENDING" },
    { "fieldPath": "monthKey", "order": "ASCENDING" }
  ]
}
```

### Service — `src/services/managerMonthlyRollupService.js` (mirror `managerWarService.js`)
- `save(...)` — create/update at doc-id `{uid}_{monthKey}`. **`parseFloat()` then coerce to int** on `candidatesAssessed`/`agentsContracted` (non-negative; reject/clamp negatives client-side too). Set meta fields (`managerId`, `tenantId`, `monthKey`, `managerRole`, `managerRoleRank`, `branchId`, `unitId`) from the current user/AuthContext — never from client form input. `status`, `updatedAt: serverTimestamp()`; `submittedAt` on submit. `notes` trimmed ≤ 1000.
- Reads: owner's current-month doc by id; upline team list for a selected `monthKey` (the indexed query).
- Tenant-scoped via explicit `tenantId` param (SEC-9b pattern — no global tenant holder).

### UI — Option B sibling tab
- New top-level manager tab (e.g. "Monthly Recruiting"). Follow `frontend-design` skill; Nexus tokens; 44px targets; loading/error/empty states on every component.
- **Own input form:** a month selector (stores `YYYY-MM`, **displays `MM-YYYY`**), `candidatesAssessed`, `agentsContracted`, optional `notes`; Save draft / Submit. Provisional labels + help text:
  - `candidatesAssessed` → **"Candidates Assessed"** — help: *"Recruiting candidates who completed a formal assessment this month. (Definition provisional — pending head-of-sales confirmation.)"*
  - `agentsContracted` → **"Agents Contracted"** — help: *"New agents who signed a contract this month; log under the month the contract is issued. (Provisional — pending head-of-sales confirmation.)"*
- **Upline team view** (BM/SM/TA/PA): pick a month → list the team's monthly rollups (read-only), `MM-YYYY` in the header. Mirror the `TeamWarsTab` pattern (BM = own branch, SM+ = tenant-wide — enforced by the rule's `list`).
- All month rendering goes through one formatter: store `YYYY-MM`, display `MM-YYYY`. Add a small `formatMonthKey()` helper + its inverse for the picker.

---

## Phase 3 — tests

**Rule (emulator):** owner create + update; peer DENY; downline DENY; upline read (BM same-branch ✓, BM other-branch DENY, SM tenant-wide ✓); `list` (BM own-branch ✓, SM tenant ✓, UM DENY); the null-resource existence get (owner pre-write by `rollupId` prefix ✓, non-owner prefix DENY); validation (negative int DENY, missing key DENY, wrong `managerRoleRank` DENY, forged `managerId` DENY, bad `status` DENY).
**Service:** save shape (parseFloat→int, meta fields sourced from user not form, doc-id, draft→submit transition, `submittedAt`, notes trim).
**Component:** form render/save/submit; the `YYYY-MM`↔`MM-YYYY` mapping (store ISO, display local); team-view render + empty state.
All gates green: emulator rule tests, app suite (env-unset), functions tests (unchanged baseline), lint 0, build.

---

## Phase 4 — docs (placeholders)
- `CONTEXT.md`: recently-shipped row + Where-we-left-off (`#TBD`/`{TBD}`) → I2 shipped; Track I remaining = §6.
- `FOLLOW_UPS.md`: mark I2 shipped; **bank these FUs** — (a) monthly recruiting standards + accountability flag (extend `config/managerActivityStandards` + `NUMERIC_STANDARDS`); (b) `recruitsInFirstWeeks` auto-derive from `contractStartDate`; (c) head-of-sales definitional confirmation for `candidatesAssessed` + `agentsContracted` (lift provisional flags); (d) possible compliance edit-freeze for monthly input.

---

## Phase 5 — deploy, PR, smoke
- **Deploy the rule + index PRE-merge** (both additive — new match block, new collection index; no client touches the collection until the frontend ships). `firebase deploy --only firestore:rules,firestore:indexes`.
- Lint + build + app suite + functions tests + emulator rule tests green.
- Push, open PR via `gh`. Rule 15 (`git log origin/feat/i2-monthly-recruiting --oneline -1`, full SHA). **Do NOT merge.**

**Smoke (PRE-merge, on the Vercel preview against the pre-deployed additive rule — real write-read-verify):**
- REST legs (CC): owner UM writes a rollup → reads back (persisted); peer UM read → 403; downline read → 403; upline BM same-branch read → 200; cross-branch BM read → 403; SM tenant-wide list → 200.
- Browser legs (Kyron, incognito on the preview): the form submits + persists on reload (write-read-verify); the month displays as `MM-YYYY` while the doc-id/stored key is `YYYY-MM`; the upline team-view lists the rollup.
- Clean up any test rollup docs after.

Report: the rule block (final) + service + UI summary; the index entry; all test results; the PR #/URL; Rule 15 SHA; the smoke legs. Do NOT merge — Claude reviews, then Kyron merges, then the post-merge fill.

---

## Acceptance criteria
- `monthKey` stored `YYYY-MM`, displayed `MM-YYYY` everywhere — verified in smoke.
- Meta fields (`managerId`/rank/`branchId`/`unitId`) sourced from the authed user, never client form input.
- `parseFloat()` enforced on both numeric fields; negatives rejected.
- Rule enforces WAR-direction privacy (owner RW, upline R, peer/downline DENY) — verified live, not just emulator.
- No CF, no change to the WAR or escalation collections/rules.
