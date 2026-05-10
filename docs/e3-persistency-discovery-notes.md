# E3 — Persistency Playground · Discovery Notes (Phase 2)

**Worktree:** `.claude/worktrees/feat-e3-persistency`
**Branch:** `feat/e3-persistency-playground`
**Discovery date:** 2026-05-10
**Outcome:** ⚠️ schema collision found — surfaced to Kelsean before Phase 4 per brief instruction.

---

## 1. Existing persistency code surface

### `src/services/persistencyService.js` (legacy)
- **Path:** `tenants/{tid}/persistency/{agentId}_{YYYY}_{MM}` (zero-padded month, matches new brief format).
- **Field shape (writes):**
  ```
  agentId, agentName, tenantId, year, month,
  persistency,         // numeric, validated 0–100 in PersistencyPanel
  enteredBy,
  enteredAt
  ```
- **Exports:**
  - `getMonthlyPersistency(year, month)` → map by agentId
  - `getAgentPersistency(agentId, year)` → map by docId
  - `getAllPersistencyForYear(year)` → map agentId → array
  - `savePersistencyBatch(entries, enteredBy)` → batch write
- Already uses `getTenantId()` from `firebase.js` correctly (SEC-9 compliant).

### Callers of the legacy service
| File | Line | Call | Consumes scale |
|------|------|------|----------------|
| `src/components/manager/PersistencyPanel.jsx` | 4, 44, 95 | `getMonthlyPersistency`, `savePersistencyBatch` | writes 0–100 |
| `src/components/dashboard/AgentDashboard.jsx` | 12, 120 | `getAgentPersistency` | passes through |
| `src/components/dashboard/ManagerDashboard.jsx` | 11, 174 | `getAllPersistencyForYear` | passes through |
| `src/components/profile/CareerPortal.jsx` | 295–298 | reads `p.persistency` from passed-in map | **expects 0–100** |

### `src/components/profile/CareerPortal.jsx:295–298`
```js
const persEntries = Object.values(persistencyData ?? {}).filter((p) => p.year === thisYear);
const avgPersistency = persEntries.length > 0
  ? persEntries.reduce((sum, p) => sum + (parseFloat(p.persistency) || 0), 0) / persEntries.length
  : 0;
```
**Note:** This is exactly the "average of percentages" anti-pattern the brief flags as bug-prone. Pre-existing bug; not in E3 scope unless we replace the data layer.

### `firestore.rules:110–114` (current persistency block)
```
match /persistency/{docId} {
  allow read: if canManage(tenantId) ||
    (isSignedIn() && isAgent() && getTenantId() == tenantId && resource.data.agentId == request.auth.uid);
  allow write: if canManage(tenantId);
}
```
- Reads: managers (any tenant doc) + own agent.
- Writes: managers only (no agent self-entry yet).
- No branch/unit scoping.
- No field-level validation.

---

## 2. Schema collision with brief's locked schema

The brief's Schema section assumes the legacy field is named `value` (legacy percentage 0–100) and that the new `persistency: 0–1 decimal` field can coexist alongside it without conflict.

**Reality (from code inspection):**
- Legacy field name = `persistency` (NOT `value`).
- Legacy scale = 0–100 (validated `0 ≤ v ≤ 100` in `PersistencyPanel.jsx:74, 176`).
- Brief's new schema also names the field `persistency`, with 0–1 decimal scale.

**Result:** same field name, different semantic scale. Reading a doc would require knowing which schema-era it belongs to. The brief's `value` field name does not exist in the current code at all.

**Brief hard stop trigger (literal wording):**
> Discovery finds existing services writing to `/tenants/{tid}/persistency/` with the legacy `value` field → STOP and surface

Strict literal: doesn't trigger (legacy field is `persistency`, not `value`). Spirit of the rule: triggers (collision risk on the same field name is *worse* than a name mismatch). Surfacing per kickoff prompt instruction: *"Surface before any deviation from locked decisions, especially the Schema section."*

---

## 3. Tab integration findings (no DOM screenshots needed yet — both already exist)

### ManagerDashboard (`src/components/dashboard/ManagerDashboard.jsx`)
- `NAV_ITEMS` already declares `{ id: 'persistency', label: 'Persistency', tabId: 'persistency', Icon: TrendingUp, sectionLabel: 'Operations' }` at line 46.
- Currently renders `<PersistencyPanel />` at line 315.
- E3 plan: replace `PersistencyPanel` import with new `PersistencyTab`. Add `data-testid="tab-persistency"` to the nav-item button (need to inspect Shell component for where to attach).
- Position is between AOM/Awards-cluster and Goals — matches brief request "between AOM and report tabs."

### AgentDashboard (`src/components/dashboard/AgentDashboard.jsx`)
- `NAV_ITEMS` does NOT have a persistency tab today (line 54–62).
- Insertion point: between `awards` and `production-report` is the most logical (pairs with manager view position) — alternatively just before `history`.
- E3 plan: add `{ id: 'persistency', label: 'Persistency', tabId: 'persistency', Icon: TrendingUp }` and a render branch `{activeTab === 'persistency' && <PersistencyTab />}`. Add `data-testid="agent-tab-persistency"`.

### Shell (sidebar/topbar component)
- Both dashboards pass `navItems` and `activeTab` to `Shell`. Shell renders nav buttons — likely the place to attach `data-testid` from `navItem.id` or a passed-in attribute.
- Action: read `src/components/shell/Shell.jsx` once we begin Phase 5 to confirm test-id wiring.

---

## 4. `agentOfMonthService.js` reference shape (per brief)

```js
import { db, getTenantId } from '../firebase';

export function getCurrentMonthKey() { /* '2026-05' */ }
export function getPrevMonthKey() { /* '2026-04' */ }
export async function getAgentOfMonth(monthKey) {
  const tenantId = getTenantId();          // SEC-9 — never a parameter
  const snap = await getDoc(doc(db, `tenants/${tenantId}/agentOfMonth/${monthKey}`));
  return snap.exists() ? snap.data() : null;
}
```
- Uses `getTenantId()` inline, no parameter.
- Trinidad-offset month-key derivation (`Date.now() - 4h`) — the new persistencyService should mirror this for `monthKey` consistency where it shadows current/prev month logic.

---

## 5. Production-data risk

CLAUDE.md says: *"App has not been demoed to Tatil yet."* So persistency docs in production are pre-pilot test data, not live agent records. Replacing the schema does not destroy real customer data.

That said: legacy docs ARE being read by AgentDashboard, ManagerDashboard, CareerPortal in the running app. Replacing them silently mid-flight breaks those KPI surfaces until the new code path lands. Mitigation in the implementation:
- Replace all four callers in the same PR so no caller is left consuming the legacy 0–100 scale.
- Keep the legacy field name `persistency`, but switch its semantic meaning to 0–1 decimal everywhere consistently.
- Update CareerPortal's averaging logic to use the new aggregation function (fixes the pre-existing average-of-percentages bug as a side effect).

---

## 6. Proposed approach (awaiting Kelsean confirmation)

1. **Replace, don't extend.** Drop the four legacy exports (`getMonthlyPersistency`, `getAgentPersistency`, `getAllPersistencyForYear`, `savePersistencyBatch`) and the legacy `PersistencyPanel.jsx`. Build the new service surface and `PersistencyTab` from scratch.
2. **Same field name, new scale.** New docs store `persistency` as 0–1 decimal. Legacy data is treated as "pre-E3" and ignored — pre-pilot, no migration needed.
3. **Update all four callers** in the same PR (PersistencyPanel removed; AgentDashboard/ManagerDashboard/CareerPortal switched to new service).
4. **CareerPortal aggregation fix** comes for free — replace the average-of-percentages with `aggregatePersistency(...)` from `calculations.js`.
5. **firestore.rules** — replace existing block at line 110–114 with role-scoped rules per brief Schema section.

---

## 7. Confirmed facts from Kelsean (2026-05-10, post-surface)

1. **No real production persistency data.** Existing `/tenants/{tid}/persistency/{agentId}_{YYYY_MM}` docs are pre-pilot test/placeholder entries — no Tatil-reported figures have been entered yet. **No migration script needed. All legacy docs treated as ignored.**
2. **Approach approved as proposed:** drop legacy `persistencyService.js` exports, delete `PersistencyPanel.jsx`, reuse the field name `persistency` enforcing 0–1 decimal in new code, update all four callers (AgentDashboard, ManagerDashboard, CareerPortal, plus the panel deletion), replace the existing rules block at `firestore.rules:110–114` with role-scoped rules per brief.
3. **CareerPortal average-of-percentages fix is in scope for this PR** as a side-effect bullet in the PR description under "Side-effect fixes."

## 8. Tightening 1 — Legacy-doc filter rule (`isE3Doc` predicate)

Any persistency doc lacking **all six** of these fields is pre-E3 and **MUST be silently filtered out at the service layer**:

```
businessPlaced, notTakens, incPPPs, lumpsums100, lapses, reinstatements
```

**Rules of engagement (encoded in `persistencyService.js`):**
- Single predicate `isE3Doc(doc)` returns `true` only when **all six** input fields are present (`!== undefined`, `!== null`).
- Predicate applied to every read return path before the doc reaches a UI consumer.
- No "needs re-entry" UI. No warning toast. No stale row. Hidden until overwritten by an E3-shaped write.
- Explicit unit test in `persistencyService.test.js` covers (a) E3 doc passes, (b) doc with `persistency` only fails, (c) doc missing one of the six fields fails, (d) doc with all six but `notes` extra still passes.

## 9. Tightening 2 — Parity map (audit trail for `PersistencyPanel.jsx` deletion)

| Old `PersistencyPanel.jsx` responsibility | New E3 location | Notes |
|-------------------------------------------|-----------------|-------|
| Manager-only entry of monthly persistency % (single input, 0–100) | `PersistencyEntryForm.jsx` (six TTD inputs, % auto-derived via `calculations.js`) | Manager no longer enters % directly — enters six business inputs, persistency derived. Locked-in semantic shift. |
| Per-agent input validation `0 ≤ v ≤ 100` | Per-input non-negative validation in `PersistencyEntryForm.jsx` | New schema has no scalar percentage input — all six numeric inputs enforced `≥ 0` (also enforced in firestore rules). |
| Year selector (current, -1, -2) | Replaced by `monthKey` dropdown in `PersistencyTab.jsx` (e.g. `2026-02`, `2026-01`, …) | Single dropdown lists actual months with E3 docs (returned by `getAvailableMonths`). Defaults to most recent. |
| Month-name selector (Jan–Dec) | Folded into the `monthKey` dropdown above | One control replaces two. |
| "Save All" batch write across all agents | Per-agent save in `PersistencyEntryForm.jsx` | New flow: manager opens an agent's row → form → save (single doc write). No batch. Rationale: batch saves make audit trail (`lastEditedAt/By/ByRole`) ambiguous when only some rows changed. |
| Per-agent input row (name + number input + last-updated) | `PersistencyAgentRow.jsx` (avatar + name + persistency badge + Edit + Open Playground) | Row now displays the derived %, is sortable, and has 90% threshold styling. |
| `Last updated: <date>` display | `PersistencyAgentRow.jsx` shows `lastEditedAt` + `lastEditedByRole` | Audit trail is richer (writer's role visible). |
| Loading skeleton (5 pulse rows) | `PersistencyTab.jsx` retains the same skeleton pattern | Reused. |
| Empty state ("No agents in this team yet.") | `PersistencyTab.jsx` empty state | Scoped to branch (branch_manager) / unit (unit_manager) / tenant (tenant_admin & up). |
| Error banner (load/save failure) | Reused per-form / per-tab | Same pattern, new copy. |
| "Saved successfully" success banner | Transient toast/banner inside `PersistencyEntryForm.jsx` after save | Same pattern, scoped to single-agent save. |
| Tenant resolution via `getTenantId()` (SEC-9 compliant) | New `persistencyService.js` matches | Same pattern preserved. |
| Reload-after-save (`load()`) | Caller-driven reload via callback prop | Same pattern. |
| Agent list source: `getTenantUsers()` filter `role==='agent'` | New tab uses `getTenantUsers()` + scope filter (branch / unit) | Replaces flat-tenant filter with role-scoped manager view. |
| Manager-only write (no agent self-entry) | Both managers AND agents can write; manager wins on collision via `enteredByRole` precedence | Brief locked decision; new rules implement this. |
| Loading state (`loading`, `saving`) | Reused per component | Same pattern. |

**Result:** every old responsibility either moves cleanly to a new E3 location or is intentionally replaced by a more granular pattern (per-agent save, derived percentage). No orphaned behavior. Deletion of `PersistencyPanel.jsx` is auditable against this map.

---

## 10. Walk-script DOM expectations (to be validated post-Phase-5 commit)

Stable selectors planned:
- `data-testid="tab-persistency"` on manager nav button
- `data-testid="agent-tab-persistency"` on agent nav button
- `data-testid="persistency-month-selector"`
- `data-testid="persistency-branch-summary"`
- `data-testid="persistency-agent-row-{agentUid}"`
- `data-testid="persistency-entry-form"`
- `data-testid="persistency-trend-chart"`
- `data-testid="persistency-award-gate-banner"`
- `data-testid="persistency-playground"`
- `data-testid="playground-slider-{leverName}"`
- `data-testid="playground-shortfall-card-{lever}"`
- `data-testid="persistency-projected-output"`

DOM screenshot pass against the deployed Vercel preview will run once Phase 5 commits.
