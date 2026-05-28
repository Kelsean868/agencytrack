# Phase 9 — SM Target Layer: Design Questions

> **Purpose:** Block-surface before implementation begins. Each question carries CC's recommended answer and a one-line rationale. Kyron's explicit ACK on every question unlocks the build brief.  
> Source: `docs/phase9-sm-target-recon.md` + ground-truth verification of `goalsService.js`, `firestore.rules`, `GapAnalysisPanel.jsx`, `GoalsPanel.jsx`, `App.jsx` (2026-05-28).

---

## Source-verification corrections / confirmations

The following were checked against current source before drafting. No recon errors found — all confirmed:

- `getGoalHierarchy(tenantId, unitId, year, agentId)` returns `{ companyFloor, branchTarget, unitTarget, personal }`. `src/services/goalsService.js:219–271`.
- `getBranchGoals(tenantId, year)` fetches ONE doc at `tenants/{tenantId}/branchGoals/{year}` — no branch-ID scoping. Implicit single-branch-per-tenant assumption is live in the codebase today.
- `firestore.rules` `branchGoals` write (lines 546–556): `branch_manager | tenant_admin | platform_admin` only. `sales_manager` is **absent**.
- `firestore.rules` `unitGoals` write (line 537): `sales_manager` is present with `// BUG-N2` comment.
- `firestore.rules` `roleRank()` (lines 27–33): `sales_manager = 3`, above `branch_manager = 2`, below `tenant_admin = 4`.
- `GoalsPanel.jsx` lines 746–751: `sales_manager` gets `canSeeBranch = true` (sees Branch tab). No SM-specific target-setting tab exists.
- `GapAnalysisPanel.jsx` lines 6–11: `LAYER_CONFIG` is a hardcoded 4-entry static array.
- `App.jsx` line 13: `MANAGER_ROLES = new Set(['unit_manager', 'branch_manager', 'sales_manager', 'platform_admin'])`. `tenant_admin` is NOT in MANAGER_ROLES.

---

## Questions

### Q1 — SM scope: one aggregate target doc per SM/year, or separate per-branch docs?

**Recon assumption:** One doc per SM uid per year — `salesManagerGoals/{smUid}_{year}`. If SM manages multiple branches, the doc covers their aggregate cross-branch territory.

**Alternative:** `salesManagerGoals/{smUid}_{branchId}_{year}` — SM sets a distinct target for each branch they oversee.

**CC recommendation:** One aggregate doc per SM per year (mirror the `branchGoals/{year}` shape).  
**Rationale:** Consistent with every existing layer (one doc per scope level per year). For Tatil's current structure (one SM, one effective branch grouping), per-branch SM targets add complexity with no immediate payoff. Path: `tenants/{tenantId}/salesManagerGoals/{smUid}_{year}`.

---

### Q2 — Who writes `salesManagerGoals`?

**Context from rules:**
- `branchGoals` write: BM self-sets + TA/PA can override.
- `unitGoals` write: UM self-sets (own unit via `callerUnitId`) + BM/SM/TA/PA can write.
- No SM-write gate exists on any goals collection today.

**Options:**
- A. SM self-sets (+ TA/PA override) — mirrors BM pattern exactly.
- B. TA-sets only (SM cannot set own target).
- C. Both SM and TA can write freely (no callerUid scoping for SM).

**CC recommendation:** Option A — SM self-sets (scoped to own uid in doc ID) + TA/PA can override.  
**Rationale:** Mirrors the BM pattern. SM sets their own territory target; TA can adjust. Proposed write rule:
```
allow write: if request.auth != null
  && request.auth.token.tenantId == tenantId
  && (
    request.auth.token.role in ['platform_admin', 'tenant_admin']
    || (request.auth.token.role == 'sales_manager'
        && docId.matches(request.auth.uid + '_.*'))
  );
```

---

### Q3 — Who reads `salesManagerGoals`?

**Context from rules:**
- `branchGoals` and `unitGoals`: any authenticated tenant member can read (broad — used for agent-facing roll-up display).
- `goals/{agentId}`: agent reads own; managers (`canManage`) read any.

**Options:**
- A. Broad: any authenticated tenant member (matches branchGoals/unitGoals pattern).
- B. Restricted: SM + TA + PA only.
- C. SM's downline: SM + BMs they manage + agents in their branches.

**CC recommendation:** Option A — any authenticated tenant member.  
**Rationale:** GapAnalysisPanel displays the SM target to agents as a 5th tier above Branch — the feature is meaningless if agents can't read it. Matches the existing read pattern for upper layers. Proposed read rule:
```
allow read: if request.auth != null && request.auth.token.tenantId == tenantId;
```

---

### Q4 — How is the SM uid resolved inside `getGoalHierarchy`?

**Context:** Current signature is `getGoalHierarchy(tenantId, unitId, year, agentId)`. The SM goals doc key is `{smUid}_{year}`. To render the SM tier for an agent, the function needs the SM uid — but neither `unitId` nor `agentId` tells you the SM uid directly.

The recon notes that `branches/{branchId}.managerId` stores the BM uid, not the SM uid. A `salesManagerId` field does not currently exist on branch docs.

**Options:**
- A. Add `salesManagerId` to branch docs; `getGoalHierarchy` fetches `branches/{agentBranchId}` internally to resolve SM uid. Requires a branch-doc schema change in this PR.
- B. Add `smUid` as an optional 5th parameter to `getGoalHierarchy`. Callers (AgentDashboard, CareerPortal) resolve SM uid separately before calling. Backward-compatible: callers that don't pass it get `salesManagerTarget: null`.
- C. Query `users` where `role == 'sales_manager'` inside `getGoalHierarchy`. Simple for single-SM tenants; fragile if two SMs ever exist.
- D. Store `smUid` in tenant `config/settings`. Works for single-SM tenants; not scalable.

**CC recommendation:** Option B — add optional `smUid` param to `getGoalHierarchy`.  
**Rationale:** Keeps the function pure (no hidden lookups). Callers that already know the SM uid pass it; callers that don't get a null SM tier displayed as "Not set." Branch-doc schema change (Option A) is a separate concern that can ship in a follow-up without blocking the goals layer.

**Dependent decision (Kyron must answer):** Does a `salesManagerId` field exist anywhere in branch docs today, or is this a net-new field? If it doesn't exist, how should AgentDashboard / CareerPortal resolve the SM uid to pass as the 5th param? (Option C — query by role — is the fallback if no branch-doc field exists yet.)

---

### Q5 — BUG-N2: is `sales_manager` in the `unitGoals` write arm intentional?

**Context:** `firestore.rules` line 537:
```
|| request.auth.token.role == 'sales_manager' // BUG-N2: sales_manager has at least branch_manager-level scope per 5-tier hierarchy
```
The comment reads it as intentional (SM outranks BM, so SM can write unit goals cross-branch). But it's tagged `BUG-N2`, which implies it was flagged for audit.

**CC recommendation:** Treat as intentional — leave it unchanged in this PR.  
**Rationale:** SM rank 3 > BM rank 2 in `roleRank()`. SM writing unit-level targets within their territory is consistent with the hierarchy. The `BUG-N2` tag likely means "this was added quickly — verify it's right." This PR's audit confirms it is right. Do not change the unitGoals rule in this PR.

**Explicit ask:** Should this PR resolve the `BUG-N2` comment (remove the tag, confirm the line as intentional in a commit message), or leave the annotation for a separate rules-audit PR?

---

### Q6 — Should SM be able to write `branchGoals`?

**Context:** `branchGoals` write (lines 546–556) lists `branch_manager | tenant_admin | platform_admin` only. SM is absent. SM rank 3 > BM rank 2.

**Options:**
- A. SM cannot write branchGoals — BM owns their branch target; SM writes only their own SMG layer.
- B. SM can write branchGoals (add `sales_manager` to branchGoals write rule, mirroring unitGoals).

**CC recommendation:** Option A — SM does NOT write branchGoals.  
**Rationale:** Each tier owns exactly one goals doc. SM sets the SMG layer (cross-branch aggregate). The branch's own target is the BM's domain. SM overriding a branch target would blur ownership; if a SM needs to adjust a branch target they escalate to TA. This also keeps the new `salesManagerGoals` write rule clean and isolated.

---

### Q7 — GapAnalysisPanel: display behavior when `salesManagerTarget` is null?

**Context:** `LAYER_CONFIG` is a static array — all 4 rows render today regardless of whether `hierarchy.{key}` is null. Agents in tenants with no SM goals set would see an "SM Target" row with blank/zero values.

**Options:**
- A. Always render the SM row; show "Not set" when `salesManagerTarget` is null. Matches current behavior for other null tiers (unitTarget, branchTarget also render even when unset).
- B. Suppress the SM row when `salesManagerTarget` is null. Cleaner for tenants with no SM.
- C. Show SM row only when the viewing user is SM or above (hide from agents entirely).

**CC recommendation:** Option A — always render, show "Not set" when null.  
**Rationale:** Consistent with how the existing 4 tiers behave. Option B requires dynamic LAYER_CONFIG filtering (larger diff). Option C breaks the feature intent (agents seeing their full goal cascade is the point).

**Confirm:** Should the null display be identical to how other tiers render when unset today, or does Kyron want a distinct "SM target not configured" message?

---

### Q8 — `salesManagerGoals` inherits the single-branch-per-tenant assumption — acknowledge?

**Context:** `branchGoals/{year}` has no branch-ID component — it's one doc for the whole tenant. For Tatil's current single-branch structure this is correct. SM goals as `salesManagerGoals/{smUid}_{year}` inherit the same aggregate-per-SM-per-year model.

**No blocking question** — surfaced for awareness. If Tatil expands to multiple regions each managed by a different SM before Phase 9 ships, the path choice matters.

**CC recommendation:** Proceed with the single-aggregate-doc model for Phase 9. Multi-territory SM support is explicitly out of scope per the recon.

**Kyron: please confirm this is correct for Tatil's near-term structure.**

---

### Q9 — `getGoalHierarchy`: optional 5th param vs. new function?

**Context:** Two callers today — `AgentDashboard` and `CareerPortal`. Both pass `(tenantId, unitId, year, agentId)`.

**Options:**
- A. Add `smUid` as optional 5th param to existing `getGoalHierarchy`. Backward-compatible; callers that don't pass it get `salesManagerTarget: null`.
- B. New `getGoalHierarchyFull(tenantId, unitId, year, agentId, smUid)` function. Explicit opt-in; existing callers unchanged until migrated.

**CC recommendation:** Option A — optional 5th param on the existing function.  
**Rationale:** Backward-compatible with zero caller changes needed until smUid resolution is implemented. Avoids API duplication. If callers aren't updated to pass smUid in this PR, SM tier renders as null (per Q7 — acceptable "Not set" state).

---

## ACK checklist — LOCKED (2026-05-28)

- [x] **Q1** — One aggregate SM doc per year. Path: `salesManagerGoals/{smUid}_{year}`.
- [x] **Q2** — Who writes: SM self-sets (scoped to own uid in doc ID) + TA/PA override.
- [x] **Q3** — Who reads: any authenticated tenant member (broad, matching branchGoals/unitGoals pattern).
- [x] **Q4** — SM uid resolution: optional 5th param on `getGoalHierarchy` (Q9). Callers resolve smUid via `getSalesManagerUid(tenantId)` — queries users where `role == 'sales_manager'`, returns single uid (0 → null; >1 → first + console.warn). `salesManagerId` does NOT exist on branch docs; query-by-role is the Phase 9 shortcut. Multi-territory branch-doc resolution deferred to follow-up.
- [x] **Q5** — BUG-N2: intentional, leave unitGoals rule unchanged in this PR. SM can write all unit goals tenant-wide (consistent with SM rank 3 > BM rank 2).
- [x] **Q6** — SM does NOT write branchGoals. BM owns the branch target; SM owns the SMG layer.
- [x] **Q7** — Null SM tier: always-render + "Not set" (match existing tier null behavior). No distinct message needed.
- [x] **Q8** — Single-aggregate model for Phase 9. One doc per SM per year covers the whole tenant.
- [x] **Q9** — Optional 5th param (`smUid = null`) on existing `getGoalHierarchy`. Backward-compatible.
