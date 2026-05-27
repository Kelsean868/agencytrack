# H4 Plan Configuration — Design Questions

> **Purpose:** Pre-brief design decisions for the H4 Plan Config build.  
> Based on: `docs/h4-plan-config-recon.md` (inventory), `docs/phase7-8-PRD.md §7.5`, Phase C deeper recon (2026-05-27).  
> No build decisions here — dispatcher resolves open questions before brief.

---

## What H4 builds

`config/policyPlans` singleton document allowing tenant admin to manage a curated plan list consumed by the agent's `PolicyLedgerPanel` plan picker. When an agent picks from the catalog, `planId` + `planName` + `policyClass` auto-fill. Agents can also type free text ("Other") which writes to a `pendingReview` queue the tenant admin promotes.

---

## Resolved from PRD §7.5

| Decision | Resolved value |
|---|---|
| Firestore path | `tenants/{tenantId}/config/policyPlans` (singleton) |
| Plan doc shape | `{ plans: [{ id, name, class, productLine, isActive }], pendingReview: [{ name, loggedByAgents, firstLoggedAt }] }` |
| `id` generation | Client-generated UUID (same pattern as policy `policyId`) or auto-incremented string slug |
| `policyClass` auto-fill | When agent picks a plan → `policyClass` field auto-fills from `plan.class` |
| Agent entry for unknown plan | "Other" option in picker → free-text input → written to `pendingReview[]` |
| Pending review surface | Tenant admin badge: "N plans pending review (oldest X days)" |
| Retired plans | `isActive: false` (soft-delete, same as `branchService.js` pattern) |

---

## Open design questions

### Q1 — Plan list write strategy: array-in-doc vs. subcollection

**PRD says:** Singleton with embedded `plans[]` array.  
**Deeper recon finding:** `EditConfigModal` pattern is for flat fields on a singleton doc. It does NOT handle subcollection-row management (add/edit/deactivate per row).  
**Risk:** Embedded arrays in Firestore have a soft limit at ~1MB per doc, and cannot be queried individually. For a plan catalog (typically 5–30 items), this is fine.  
**Alternative considered:** `tenants/{tenantId}/plans/{planId}` subcollection — queryable, pageable, standard row management. But creates a new collection (rules + index) and breaks the `config/` singleton pattern established by `companyMinimums` and `managerActivityStandards`.

**Recommended answer:** Keep PRD's singleton array. Rationale: (a) plan count is small; (b) atomic writes (add/remove/edit in one transaction) are simpler with array; (c) the whole `config/` singleton pattern (`companyMinimums`, `managerActivityStandards`, `policyPlans`) stays consistent. If plan count approaches 50, revisit.

**Dispatcher must confirm:** Yes / No / Subcollection instead.

---

### Q2 — Rules: can agents READ config/policyPlans?

**Context:** Agents read `config/companyMinimums` directly from `AgentDashboard.jsx` and `CareerPortal.jsx` (not only through hierarchy). Same direct-read pattern would apply to `config/policyPlans`.  
**Existing rule pattern for `config/companyMinimums`:** Readable by all tenant members; writable only by `tenant_admin`.

**Recommended answer:** `allow read: if isTenantMember(tenantId)` (same as companyMinimums read arm). Agents need it for the plan picker dropdown. `allow write: if isTenantAdmin(tenantId)`.  

**Follow-on:** Does agent need ONLY the `isActive: true` plans filtered client-side, or server-side? Since this is a small singleton, client-side filter is fine — agent reads the full doc and filters `plan.isActive === true`.

**Dispatcher must confirm:** Yes, agents can read / No, use a Cloud Function intermediary (not recommended).

---

### Q3 — pendingReview queue write permission

**Context:** Agents trigger `pendingReview` additions by picking "Other" and entering a free-text plan name in `PolicyLedgerPanel`. This write must hit `config/policyPlans.pendingReview[]`.  
**Problem:** `config/policyPlans` write is `if isTenantAdmin(tenantId)` per Q2 above — agents cannot write to it.  
**Options:**
- (a) Agent writes to `pendingReview` via a separate `allow update` arm scoped to `affectedKeys().hasOnly(['pendingReview'])` — allows agents to append only.
- (b) Agent entry does NOT hit `pendingReview` live; the free-text `planName` is stored on the policy itself (already happens today) and a Cloud Function on policy `create` aggregates free-text planName values into `pendingReview` post-hoc.
- (c) Dedicated `config/planReviewQueue` singleton with separate rules (more complexity).

**Recommended answer:** Option (b) — aggregate via Cloud Function. Reasons: (a) a `hasOnly(['pendingReview'])` client-write arm is exploitable (agent could flood the array); (b) the policy already stores `planName` free text; (c) a CF on policy writes is the only correct place to deduplicate `loggedByAgents` + `firstLoggedAt` without a race condition. CF runs on `onCreate` for `tenants/{tenantId}/policies/{policyId}`: if `!data.planId && data.planName`, upsert into `pendingReview` using array-union-style transaction (check for existing name, increment loggedByAgents, set firstLoggedAt on first occurrence).

**Dispatcher must confirm:** CF aggregation (b) / live client write arm (a) / separate queue doc (c).

---

### Q4 — policyClass auto-fill UX in PolicyLedgerPanel

**Context:** `PolicyLedgerPanel.jsx` has `policyClass` as a required enum field. When agent picks a plan from the catalog, `policyClass` should auto-fill from `plan.class`.  
**Current state:** `policyClass` is a separate required dropdown, independent of plan selection.  
**Design question:** Is `policyClass` still editable after auto-fill, or locked to the plan's class?

**Recommended answer:** Auto-fill but keep editable (soft suggestion). Reason: Plan class can differ per policy configuration even under the same plan name. A "hard lock" frustrates agents whose head-office spec differs from catalog. Auto-fill reduces manual entry; editable preserves correctness.  
**Implementation:** `onChange` for plan picker → if selected plan has `.class` → `setForm(f => ({ ...f, policyClass: plan.class }))`. User can still override.

**Dispatcher must confirm:** Auto-fill editable / Auto-fill locked / No auto-fill.

---

### Q5 — Free-text plan entry UX ("Other" path)

**Context:** When no catalog plan matches, agent enters a free-text plan name. Today this is a plain text input. The H4 UX change: show a searchable dropdown of `isActive` plans FIRST; if none match, a "Custom plan name" fallback text input appears (or "Other" option in dropdown).

**Design question:** 
- Single combobox (searchable dropdown with "Other" as last option) — unified UX
- Two-field approach (plan picker dropdown + separate text input that activates when no plan selected)

**Recommended answer:** Single combobox / searchable select with an "Other" option. On "Other" selection, a second input appears for free-text plan name. This matches existing enum-with-other patterns in the codebase (e.g., `sourceOfProspect` with an "other" value + optional free-text in the prospectInfo form).

**Dispatcher must confirm:** Single combobox / Two-field / Keep existing (plain text always).

---

### Q6 — Tenant admin plan catalog UI entry point

**Context:** `CompanyConfigPanel.jsx` is a 6-tile display grid. New plan catalog management needs a home in tenant admin UI.  
**Options:**
- Add a 7th tile to `CompanyConfigPanel` → "Policy Plans" tile
- Separate "Plan Catalog" tab alongside CompanyConfigPanel
- Inline panel within existing CompanyConfigPanel

**Recommended answer:** 7th tile in `CompanyConfigPanel` matching the existing tile pattern. Label: "Policy Plans". Sub-label: plan count + "(N pending review)" badge when queue > 0. Opens a new `PlanCatalogModal.jsx` (NOT `EditConfigModal` — the existing modal only handles flat-field editing, not row management; see Q1).  
`PlanCatalogModal` has two tabs: "Active Plans" (table with Edit/Deactivate per row + Add Plan button) + "Pending Review" (table with Approve / Dismiss per row).

**Dispatcher must confirm:** 7th tile pattern / Separate tab / Inline in existing panel.

---

### Q7 — Plan catalog versioning / year-keying

**Context:** `companyMinimums` is a flat singleton updated in-place (no year). `unitGoals` and `branchGoals` ARE year-keyed. Plans are closer to reference data than annual targets.  
**Risk:** A plan retired mid-year still has historical policies referencing it by `planId`. If the plan doc is deleted (not soft-deleted), historical lookups fail.

**Recommended answer:** No year-keying. Use `isActive: false` soft-delete (same as `branchService.js` pattern) and NEVER hard-delete plan array entries. Historical policies keep their `planId`; lookup always returns the plan name even if `isActive: false`. Display: inactive plans shown with a "(Retired)" tag in the admin panel; hidden from the agent's plan picker but still resolvable for history.

**Dispatcher must confirm:** Soft-delete only / Year-keyed / Hard-delete allowed after N months.

---

### Q8 — Soft migration for existing policies with free-text planName but no planId

**Context:** All current policies have `planName` as free text and `planId` as null. H4 adds the catalog.  
**Display question:** In `PolicyLedgerPanel` history view and manager `PolicyReconciliationPanel`, how should a policy with `planId: null` display?

**Recommended answer:** If `planId` exists → resolve from catalog (show `plan.name`). If `planId` is null → show `planName` raw (existing behavior, no change). No backfill of `planId` onto historical policies.  
This is a zero-migration path. No script. No PR-F tooling needed. Pre-catalog policies display exactly as today; post-catalog policies benefit from the structured lookup.

**Dispatcher must confirm:** No backfill (recommended) / Backfill script after catalog populated / Both views always show raw planName.

---

### Q9 — Where `getCompanyPlans` service function lives

**Context:** `goalsService.js` owns `getCompanyMinimums`. A new plan catalog service function will follow the same read pattern.  
**Options:**
- Add `getPolicyPlans` to `goalsService.js` (same `config/` singleton family)
- New `planCatalogService.js`
- Add to existing `policiesService.js` (consumer proximity)

**Recommended answer:** New `planCatalogService.js` (or `policyPlansService.js`). Reason: `goalsService.js` is already 260+ lines covering goals/targets/hierarchy/imports/minimums. Adding plan catalog read/write makes it unwieldy. `planCatalogService.js` stays focused: `getPolicyPlans`, `addPlan`, `deactivatePlan`, `promotePendingPlan`, `dismissPendingPlan`.  
Import in `PolicyLedgerPanel.jsx` (agent read) and the new `PlanCatalogModal.jsx` (admin write).

**Dispatcher must confirm:** New service / Extend goalsService / Extend policiesService.

---

### Q10 — Tenant admin notification badge implementation

**PRD says:** "N plans pending review (oldest X days)" badge on tenant admin surface.  
**Question:** Is this a live subscription or computed on panel mount?

**Recommended answer:** Computed on panel mount (no subscription). `PlanCatalogPanel` tile mounts → read `config/policyPlans.pendingReview.length` → display count. No real-time listener needed; plan review is not time-critical. Same pattern as current `CompanyConfigPanel` tiles (mount → read → display). If `pendingReview.length === 0`, no badge.

**Dispatcher must confirm:** Mount-time read (recommended) / Live onSnapshot subscription.

---

## Build surface estimate (informational, not locked)

| File | Change | Size |
|---|---|---|
| `src/services/planCatalogService.js` | NEW — 5 exported functions | ~120 lines |
| `src/components/admin/PlanCatalogModal.jsx` | NEW — two-tab modal (Active + Pending) | ~280 lines |
| `src/components/admin/CompanyConfigPanel.jsx` | +1 tile (7th tile, plan count + badge) | ~20 lines |
| `src/components/agent/PolicyLedgerPanel.jsx` | Replace text input with plan combobox; auto-fill policyClass | ~60 lines |
| `firestore.rules` | New `config/policyPlans` match block (tenant member read, admin write + agent pendingReview arm if option (a)) | ~15 lines |
| `functions/index.js` | New CF `aggregatePendingPlan` on policy `onCreate` (if option (b) chosen) | ~60 lines |
| `src/services/__tests__/planCatalogService.test.js` | NEW | ~80 lines |
| `src/components/admin/__tests__/PlanCatalogModal.test.jsx` | NEW | ~120 lines |

**Estimated PR size:** M (medium, ~600 net lines). Single PR unless CF dependency is sequenced separately (CF additive = pre-merge deploy eligible per CLAUDE.md).
