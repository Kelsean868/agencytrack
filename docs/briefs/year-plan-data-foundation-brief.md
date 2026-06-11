# Year Plan — Data-Foundation Slice (Game Plan Step 2, Slice 1 of 3)

## Context
Year Plan is Step 2 of the agent's Game Plan loop: it turns the Money Needs
commission targets into a per-product-line annual **API** plan that Monthly
(Step 3) and Commit (Step 4) consume. This is the **headless data-foundation
slice** — the `yearPlan` store, its service, its rules, and the `licenseProfile`
field plumbing. **No UI ships in this slice.** The panel (Slice 2) and the
StepRail/PlanCascade wiring (Slice 3) build on this.

Design source: `docs/design/year-plan-scoping-notes.md`. Mirror target for every
pattern below: the Money Needs G1 foundation (`moneyNeedsService.js` +
the `/users/{uid}/moneyNeeds/{year}` rules arm).

## Decisions locked (do not re-litigate — surface ANY deviation before implementing)
- **Store:** `tenants/{tid}/users/{uid}/yearPlan/{year}` subcollection, mirroring
  `moneyNeeds/{year}` (doc ID = the year).
- **Allocation unit = API.** `targetAPI` is authoritative per line; derived values
  are display-only.
- **Doc shape (this slice scaffolds it):**
  - `tenantId`, `uid`, `year` (number)
  - `licenseProfile` — snapshot, one of `'composite' | 'life_only' | 'general_only'`
  - `status` — `'draft' | 'committed'` (this slice only ever creates `'draft'`)
  - `lines` — keyed `life | ah | property | motor` (same keys as
    `firstYearCommissionsTargets`), each `{ targetAPI, pct, derivedApps,
    derivedCommission, enabled }`, all numeric fields `0` and `enabled: true` at
    scaffold time
  - `createdAt`, `updatedAt` (serverTimestamp)
- **`licenseProfile` user field:** new, lives on the user doc
  (`tenants/{tid}/users/{uid}`). **Absent ⇒ `'composite'`** (read-time default,
  no migration/backfill). Agent self-sets it (Slice 2 UI); default composite.

### Deferred OUT of this slice (do not build here)
- The Year Plan panel + the agent's license-profile selector → **Slice 2**.
- The **manager-override** edit-user select + the **manager-update** rule
  allowlist change + its `userService` allowlist mirror → **Slice 2** (pairs with
  the agent selector, shares one smoke).
- **Profile → which-lines-enabled** gating logic → **Slice 2** (needs a domain
  confirm from Kyron on whether A&H sits under the life or general license; this
  slice scaffolds all four lines `enabled: true`).
- Commission→API derivation, `derivedApps` math, award-eligibility strip,
  StepRail/PlanCascade wiring, Commit → later slices.

## Phase 1 — recon (HARD STOP — report findings, do NOT build yet)
Read and report exactly:
1. **`createMoneyNeeds` / `getMoneyNeeds` bodies** (`src/services/moneyNeedsService.js`):
   the doc-ID/`year` handling (is the doc ID `String(year)`? is the stored `year`
   a number?), the idempotency pattern (getDoc → what does it return when the doc
   exists?), the scaffold-object construction, and the import sources for
   `doc/getDoc/setDoc/serverTimestamp` + the app `db` handle. The new service must
   mirror these byte-for-byte in style.
2. **The `moneyNeeds` rules arm** in `firestore.rules` — its exact location inside
   the `/tenants/{tenantId}/...` block and the surrounding `/users/{uid}/...`
   sibling arms, so the `yearPlan` arm lands in the right place.
3. **The user self-update rule** — paste the EXACT current `affectedKeys().hasOnly([...])`
   array for the **general (non-`unit_manager`) self-update arm**. `licenseProfile`
   gets appended to THAT array only (not the UM arm, not the manager-update arm).
4. **`firstYearCommissionsTargets`** shape in the moneyNeeds doc — confirm the keys
   are `life / ah / property / motor` (forward-confirm for the Slice 2 input mapping).
5. **Test harness patterns** — the firebase-mock style used in
   `src/services/__tests__/moneyNeedsService.test.js` and the emulator-rules
   harness in `tests/rules/moneyNeeds.rules.test.mjs`, so the new tests match house style.
6. **Existing `licenseProfile` / license enum** — grep the repo to confirm no
   `LICENSE_PROFILES`-style constant or `licenseProfile` field already exists
   (avoid duplication).

## Phase 2 — service (`src/services/yearPlanService.js`, new)
Mirror `moneyNeedsService.js` exactly in style. Export:

1. `createYearPlan(tenantId, uid, year, licenseProfile = 'composite')`
   - **Idempotent** — same pattern as `createMoneyNeeds` (getDoc; if the doc
     exists, return it untouched; else scaffold + `setDoc`).
   - Doc path: `tenants/{tenantId}/users/{uid}/yearPlan/{<mirror createMoneyNeeds year handling>}`.
   - Scaffold = the locked doc shape above: `status: 'draft'`, the passed
     `licenseProfile`, four lines `life/ah/property/motor` each
     `{ targetAPI: 0, pct: 0, derivedApps: 0, derivedCommission: 0, enabled: true }`,
     `year` as a number, `tenantId`, `uid`, `createdAt`/`updatedAt`
     `serverTimestamp()`.
2. `getYearPlan(tenantId, uid, year)` — getDoc → `data()` or `null` (mirror
   `getMoneyNeeds`).
3. `LICENSE_PROFILES = ['composite', 'life_only', 'general_only']` (exported const).
4. `resolveLicenseProfile(userDoc)` — returns `userDoc?.licenseProfile` if it is in
   `LICENSE_PROFILES`, else `'composite'`. (Slice 2 calls this to snapshot the
   profile at create and to read it for the selector default.)

## Phase 3 — rules (`firestore.rules`)
1. **New `yearPlan` arm**, sibling to the `moneyNeeds` arm under
   `/tenants/{tenantId}/.../users/{uid}/...`. Owner-only; **no manager-read arm**
   this slice. Target (verify exact helper names against the live file in Phase 1):
   ```
   // Year Plan — agent-own annual production plan (Game Plan Step 2).
   // Owner-only; manager-read arm added with the Manager-review slice later.
   match /users/{uid}/yearPlan/{year} {
     allow get, list: if isSignedIn() && getTenantId() == tenantId && request.auth.uid == uid;
     allow create: if isAgent() && getTenantId() == tenantId && request.auth.uid == uid
       && request.resource.data.status == 'draft';
     allow update: if isSignedIn() && getTenantId() == tenantId && request.auth.uid == uid;
     allow delete: if false;
   }
   ```
2. **Append `'licenseProfile'`** to the general (non-UM) user self-update
   `hasOnly([...])` array confirmed in Phase 1. Do not touch the UM arm or the
   manager-update arm.

### Tests
- **Service unit tests** (`src/services/__tests__/yearPlanService.test.js`):
  create scaffolds the documented shape; create is idempotent (existing doc
  returned untouched); `getYearPlan` returns data / null; `resolveLicenseProfile`
  maps valid → itself, absent/invalid → `'composite'`; `LICENSE_PROFILES` content.
- **Emulator rules tests** (`tests/rules/yearPlan.rules.test.mjs`, mirror the
  moneyNeeds harness): agent own create/get/list/update **ALLOW**; create with
  `status != 'draft'` **DENY**; non-owner get **DENY**; any manager get **DENY**
  (no manager-read arm yet); delete **DENY**; agent self-update `licenseProfile`
  **ALLOW**; agent self-update including a non-allowlisted field **DENY**
  (regression guard on the allowlist edit).

## Phase 4 — docs (with placeholders)
- Add the PR-table row (placeholder SHA until merge).
- Cross-reference `docs/design/year-plan-scoping-notes.md`.
- Bank the deferred items as explicit FU notes: manager-override → Slice 2;
  profile→line gating + the A&H license-domain confirm → Slice 2; **first
  production write-read-verify smoke → Slice 2**.
- CONTEXT.md: add the `yearPlan/{year}` store to the data-model section if that
  section tracks subcollections; otherwise leave CONTEXT.md untouched (this is a
  feature foundation, Rule 16(b) — does not advance "Current main HEAD" framing).

## Phase 5 — commit / push / PR
- Branch `feat/year-plan-data-foundation`.
- Conventional commit: `feat(year-plan): data-foundation — yearPlan store, service, rules, licenseProfile field`.
- Push; open PR; **Rule 21** — poll for the Gemini bot review (~10 min) and
  disposition each comment before reporting.
- **Rule 20** — the report names the feature-branch HEAD SHA; no silent
  post-report pushes.

## Smoke
This slice is **headless** — no prod UI exercises `yearPlan` or `licenseProfile`
yet. Verification is the **emulator rules tests** (authoritative for the rules
logic) + the **service unit tests**. Deploy the rules at merge
(`firebase deploy --only firestore:rules`) — emulator-proven, and **zero prod
exposure** because no UI writes either path until the panel.

**Reasoned waiver of the prod write-read smoke for this slice:** isolated new
subcollection + simple owner-only rules + full emulator coverage + no prod path
until Slice 2. The first production write-read-verify smoke — agent creates a
`yearPlan` doc → reload → assert persisted, and the manager-override
write-read — rides **Slice 2** (the first UI that can create a plan and set a
profile). Banked in Phase 4.
