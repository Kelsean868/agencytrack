# Track G G5 — Privacy + Opt-In Share Kickoff Brief

## Slice
**G5 — Privacy + Opt-In Share** (PR-OPEN ONLY — do NOT auto-merge)

Dispatcher reviews rules arms + consent flow then merges manually.

## Goal
Add opt-in sharing controls to the Money Needs Worksheet:
- Agent toggles `visibility` between `'private'` and `'shared'` (visible to UM + BM)
- BM-to-SM toggle: `shareWithSm` (boolean, BM can expose agent's worksheet to SM)
- New Firestore rules arms so managers can read worksheets when consent is given
- Emulator allow AND deny tests for every arm + every denial

## Methodology requirement
CC must surface (STOP and wait for dispatcher) before any decision not in "Decisions locked."

## Rule 17 source verification (completed pre-brief)
- Current moneyNeeds rule arm (lines 1068–1075): owner `get/list/create/update`; no manager read arm.
- `canManage(tenantId)`: true for unit_manager, branch_manager, sales_manager, tenant_admin, platform_admin.
- `callerUnitId(tenantId)`: fetches caller's `unitId` from Firestore (used for UM scoping).
- Existing `get()` helper at line 54 can read agent user doc for `unitId`.

## Sharing model

### `visibility` field
- `'private'` (default) — only the agent can read
- `'shared'` — UM and BM of the agent's unit can read (opt-in by agent)

### `shareWithSm` field
- `false` (default)
- `true` — SM can also read (BM-controlled toggle, not agent-controlled)

### Who can read what
| Reader | Condition |
|--------|-----------|
| Agent (own) | always |
| Unit Manager | `visibility == 'shared'` AND `callerUnitId == resource.data.uid's unitId` |
| Branch Manager | `visibility == 'shared'` |
| Sales Manager | `shareWithSm == true` |
| Tenant Admin | `visibility == 'shared'` OR `shareWithSm == true` (can see anything shared) |

**Denial cases (every rule arm must deny these):**
1. Agent reads another agent's `private` worksheet → DENY
2. UM reads `private` worksheet (even own-unit agent) → DENY
3. UM reads `shared` worksheet from different unit → DENY
4. BM reads `private` worksheet → DENY
5. SM reads `shared` worksheet (only shareWithSm=true unlocks SM) → DENY
6. Unauthenticated read → DENY

## Firestore rules changes

Replace the current `match /users/{uid}/moneyNeeds/{year}` block with:

```
match /users/{uid}/moneyNeeds/{year} {
  // Owner: full read/write
  allow get, list: if canAccessOwn(tenantId, uid);

  // UM: read if shared AND same unit
  allow get, list: if canManage(tenantId)
    && getRole() == 'unit_manager'
    && resource.data.visibility == 'shared'
    && get(/databases/$(database)/documents/tenants/$(tenantId)/users/$(uid)).data.unitId == callerUnitId(tenantId);

  // BM: read if shared
  allow get, list: if canManage(tenantId)
    && getRole() == 'branch_manager'
    && resource.data.visibility == 'shared';

  // SM: read if shareWithSm
  allow get, list: if canManage(tenantId)
    && getRole() == 'sales_manager'
    && resource.data.shareWithSm == true;

  // Tenant admin: read if shared OR shareWithSm
  allow get, list: if canManage(tenantId)
    && getRole() == 'tenant_admin'
    && (resource.data.visibility == 'shared' || resource.data.shareWithSm == true);

  // Create: owner, must start private
  allow create: if canAccessOwn(tenantId, uid)
    && request.resource.data.visibility == 'private';

  // Update: owner only (agent controls visibility; BM shareWithSm update addressed below)
  allow update: if canAccessOwn(tenantId, uid);

  // BM update: only allowed to flip shareWithSm field (no other field changes)
  allow update: if canManage(tenantId)
    && getRole() == 'branch_manager'
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['shareWithSm', 'updatedAt', 'updatedBy']);

  allow delete: if false;
}
```

**Note on BM shareWithSm update arm:** The `diff().affectedKeys().hasOnly([...])` pattern ensures
BM can only toggle `shareWithSm` and the audit fields — cannot modify expense data.

## UI changes (`MoneyNeedsPanel.jsx`)

Replace the current "Visibility: Private (only you) · Sharing controls coming in G5." banner with:

### Agent controls
- Visibility toggle: "Share with my Unit Manager & Branch Manager" checkbox (or toggle)
  - When checked: `visibility = 'shared'`; when unchecked: `visibility = 'private'`
  - Saved via `updateDoc` patch on `visibility` + `updatedAt/updatedBy`

### Manager-only controls (rendered when viewer is BM/SM/TA — not G5 scope for MoneyNeedsPanel as it is agent-only)
- **Out of scope for G5 in MoneyNeedsPanel** — MoneyNeedsPanel is agent-only.
- BM's `shareWithSm` toggle is a manager-side surface (out of G5 scope for this PR).
  Only the Firestore rule arm is added; the BM UI surface is deferred.

## Service changes (`moneyNeedsService.js`)

### `updateVisibility(tenantId, uid, year, visibility)`
- `visibility` must be `'private'` or `'shared'`
- Single `updateDoc` patch: `{ visibility, updatedAt: serverTimestamp(), updatedBy: uid }`
- Returns `{ visibility }`
- Throws for invalid year or invalid visibility value

## Test changes

### `moneyNeedsService.test.js` — new suite: `updateVisibility` (4 tests)
- patches visibility field
- stamps updatedAt + updatedBy
- throws for invalid year
- throws for invalid visibility value

### `__tests__/moneyNeedsRules.test.js` (NEW FILE — emulator tests)
- Uses Firebase emulator (admin SDK pattern consistent with existing rule tests in the project)
- Allow tests (must succeed): agent reads own, UM reads shared same-unit, BM reads shared, SM reads shareWithSm=true, TA reads shared
- Deny tests (must fail): agent reads other's private, UM reads private, UM reads shared different-unit, BM reads private, SM reads shared (no shareWithSm), unauthenticated read

## Decisions locked
- `visibility` values: exactly `'private'` | `'shared'` (no other values)
- `shareWithSm` is boolean only
- BM `shareWithSm` update arm uses `affectedKeys().hasOnly([...])` pattern
- MoneyNeedsPanel agent visibility toggle only (no BM UI in this PR)
- `updateVisibility` service function (not inline updateDoc in component)
- Emulator tests are the acceptance gate for rules — dispatcher must review before merge

## File inventory
- `firestore.rules` — replace moneyNeeds block with expanded arms
- `src/services/moneyNeedsService.js` — add `updateVisibility`
- `src/services/__tests__/moneyNeedsService.test.js` — add 4 tests
- `src/components/agent/MoneyNeedsPanel.jsx` — replace placeholder banner with visibility toggle
- `src/__tests__/moneyNeedsRules.test.js` (NEW) — emulator allow + deny tests

## Verification
- `npm run lint && npm test && npm run build` — all pass
- Emulator: `firebase emulators:start --only firestore` then run rules tests — ALL allow and deny cases pass
- PR-OPEN only — dispatcher reviews rules arms + emulator output before merging

## Phase 1 — Source verify on dispatch
- Confirm `callerUnitId(tenantId)` helper available in rules (line 54 — yes, confirmed)
- Confirm `get()` helper available in rules for cross-doc reads (yes, used in existing arms)
- Confirm `affectedKeys().hasOnly()` is available in Firestore rules (yes — standard rules API)
- Confirm existing emulator test pattern in project (check `src/__tests__/` or `functions/test/`)
