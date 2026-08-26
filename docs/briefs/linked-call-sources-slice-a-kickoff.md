# Kickoff brief - Linked call sources, slice A: the link and its lifecycle

**Drafted:** 26 August 2026 - **Merge channel:** HUMAN-MERGE (new collection + new write path + rules + functions)
**Model:** Opus 5 - **Effort:** high
**repomix:** pack FULL. This brief touches `functions/` - scoped packs are forbidden there (Rule 17).
**Deploy gate:** adds Cloud Function exports AND a rules block. Merging ships neither.
`firebase deploy --only functions,firestore:rules` is a named deliverable below.

---

## Why this exists, in one paragraph

Agents have assistants. When an assistant makes calls for an agent, **those calls are the agent's
KPIs** - operator ruling, 26 Aug 2026: *"whether I do the calls, my employee does the calls, or the
business does the calls, those KPIs get reported."* The metric measures the agent's practice, not
their fingers. There is no "on behalf of" anywhere in the reporting.

To make that safe, an external calling system must never be able to *say* whose KPIs it is writing.
It presents a **token**; the token resolves to a **stored link**; the link names the agent who gets
credit. Identity never travels in a request body, so a typo or a tampered field cannot silently
credit the wrong agent, and an unknown token fails closed.

**Slice A builds the link and its lifecycle only.** No ingest endpoint, no external system, nothing
consumes the token yet. Creating a link, listing links, revoking a link, and revoking on
deactivation is the entire scope.

## Phase 0 - audit findings (completed 26 Aug 2026, quoted from current source)

| # | Finding |
|---|---|
| **F1** | `kioskTokens` is the pattern to mirror. Doc shape `{tokenId, tenantId, branchId, createdBy, createdAt, expiresAt, revokedAt, lastUsedAt}`, TTL **365 days** (`functions/kiosk/createToken.js`). |
| **F2** | `revokeKioskToken` is `onCall`, gated on the same role set, and sets `revokedAt` rather than deleting. Mirror this. |
| **F3** | UI precedent is `src/.../KioskModeTab.jsx:64,88` - it calls `createKioskToken` / `revokeKioskToken`. The call-sources UI is the same shape. |
| **F4** | **TRAP - do not use `canManage()` for this collection.** `firestore.rules:41` defines `canManage` via `isManager()`, and `isManager()` (line 17) **includes `unit_manager`**. The Cloud Functions use a narrower set - `MANAGER_ROLES` = branch_manager, sales_manager, tenant_admin, platform_admin. A unit manager is explicitly blocked from even *seeing* `agentNumber` in `EditUserDrawer` (`EditUserDrawer.test.jsx:113`), so granting them power to mint a token that writes KPIs would be incoherent. |
| **F5** | `deactivateUser` (`functions/index.js:847`) is `onCall` and takes `{ targetUid, active }` - a **boolean**, so the same function handles deactivate and reactivate. The auto-revoke hook belongs in the `active === false` branch only. |

## Decisions locked

1. **Token TTL is 365 days, matching `kioskTokens` exactly.** Operator ruling. No separate expiry
   policy for assistant tokens.
2. **Deactivating a user revokes their inbound links.** Operator ruling. **One-way: reactivating
   does NOT restore them** - a manager re-links deliberately. A token that silently comes back to
   life after an offboarding is worse than two clicks.
3. **The gate is branch_manager and above** - the Cloud Functions' `MANAGER_ROLES` set, in BOTH the
   callable and the rules. Per F4, `canManage()` is the wrong helper here. If the rules need a new
   helper, write one; do not widen an existing one.
4. **Store `tokenHash` (SHA-256), never the raw token.** The raw token is returned once, at
   creation, and never again. This is a **deliberate divergence** from `kioskTokens`, which stores
   the token as the doc id - new collection, no migration cost, and hashing means a rules mistake
   leaks nothing usable.
5. **A role change does NOT revoke a link.** *(Inferred extension of the operator's ruling, not
   stated by them - flagged so it can be overturned.)* Auto-revoking on promotion would silently
   stop capture. Instead the manager UI shows a warning when `creditUid`'s role is not `agent`.
6. **No ingest in this slice.** Nothing reads the token yet. If the implementation finds itself
   writing an endpoint, the scope is wrong - STOP and wait for dispatcher.

## The data

`tenants/{tenantId}/callSources/{sourceId}`

| Field | Meaning |
|---|---|
| `sourceApp` | which external system, e.g. `"kqm-calls"` |
| `sourceUserId` | that system's id for the caller |
| `creditUid` | **the agent whose KPIs will move** |
| `label` | human name for the UI, e.g. "Tracy-ann Nurse (assistant)" |
| `tokenHash` | SHA-256 of the bearer token |
| `active`, `createdBy`, `createdAt`, `expiresAt`, `revokedAt`, `lastUsedAt` | lifecycle, mirroring F1 |

**Agents must not be able to read this collection.** A token in a doc an agent can read is a token
an agent can use - and F4's trap plus decision 4 are the two independent defences against that.

## File inventory (scope-lock)

```
functions/callSources/createCallSource.js      new - mint, hash, return raw once
functions/callSources/revokeCallSource.js      new - set revokedAt
functions/callSources/__tests__/               new - incl. the unit_manager denial case
functions/index.js                             exports only
functions/__tests__/deactivateUser.test.js     the auto-revoke case (F5)
firestore.rules                                new match block, narrow gate
src/components/admin/  (a CallSourcesTab)      list / create / revoke, modelled on KioskModeTab
docs/CONTEXT.md                                Phase 4 only
docs/FOLLOW_UPS.md                             Phase 4 only, append per Rule 7(b)
```

Anything outside this list is a Rule 9 surface.

## Phases

1. **Discovery gate.** Re-read F1-F5 against current source and confirm each. **STOP and wait for
   dispatcher if `isManager()` no longer includes `unit_manager`** - decision 3 rests on it.
2. **Backend.** The two callables, the rules block, the `deactivateUser` hook.
3. **UI.** The tab: list links with their credit agent and expiry, create, revoke, show the raw
   token exactly once with a copy control and an explicit "this will not be shown again".
4. **Docs.** CONTEXT.md row; FOLLOW_UPS for decision 5 if the dispatcher wants it revisited.

## Named deliverables

- **A denial test for the F4 trap.** A `unit_manager` attempting to create a call source must be
  rejected. This is the single most important test in the slice - it is the one that fails silently
  if someone reaches for `canManage()`.
- **A deactivation test (F5):** deactivating a user with two inbound links sets `revokedAt` on both;
  reactivating them does NOT clear it (decision 2).
- **Token hygiene, non-negotiable:** the raw token must never reach chat output, a PR description, a
  commit message, a log line, a screenshot, or a URL query param. Reference by name only. This is
  the repo's standing secrets rule and it applies to a token this slice mints itself.
- **`firebase deploy --only functions,firestore:rules`** with the output captured in the PR
  description. Neither ships on merge.
- **Smoke walk**, both themes: sign in as a branch manager, create a link, see it listed, revoke it,
  confirm it reads revoked. **Staging only** - this mints credentials, so never against a
  feature-branch preview, which is bound to production Firebase.
- **Post-merge fill:** CONTEXT.md `Recently shipped` row with the **squash** SHA.

## What comes after (context only - not this slice)

B: the `ingestCallActivity` endpoint. C: the KQM Calls webhook. D: retire the omit-when-zero guard
from PR #909 and add Daily Capture steppers for `serviceCalls` / `referralsObtained` - **C makes
that guard wrong in the other direction, so whoever lands C owns D.**