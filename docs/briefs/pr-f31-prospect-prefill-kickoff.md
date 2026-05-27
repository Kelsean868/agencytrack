# F3.1 — Prospect-Info → New Policy Prefill: Kickoff Brief

**PR size:** XS (pure frontend, 3–4 files)
**Rules change:** NONE
**Schema change:** NONE
**Firestore reads:** Agent already has access to own prospectInfo docs — no new permission needed

---

## Methodology requirement

CC must STOP and wait for dispatcher before making any decision NOT listed in "Decisions locked" below. This includes scope expansion, new architectural patterns, test rewrites, or unexpected source state.

---

## Context

Track F F3 (PR #246) shipped the `prospectInfo` agent-facing panel: agents create appointment-prep records before a joint call. F3.1 (PR #248) linked manager observations back to prospect preps via `prospectInfoId` on the `jointCalls` doc.

This new F3.1 closes the forward arc: after the appointment results in a policy sale, the agent should be able to start a New Policy entry with the prospect's data pre-filled rather than re-typing it.

---

## Phase 1 Source Verify (pre-build, already executed — findings locked)

**prospectInfoService.js** — `PROSPECTING_SOURCES` export (11 values) is the same object imported by `PolicyLedgerPanel.jsx` for the `sourceOfProspect` select. Values are identical strings — no translation needed.

**PolicyLedgerPanel.jsx `EMPTY_FORM`** — the create form initializes from this constant. `ownerName` is a free-text field for the policy holder's full name. `sourceOfProspect` is a `<select>` backed by `PROSPECTING_SOURCES`.

**AgentDashboard.jsx:772–775** — `ProspectInfoPanel` and `PolicyLedgerPanel` are sibling conditional renders on `activeTab`. `setActiveTab` is in scope at the dashboard level.

**No existing hook** — neither `ProspectInfoPanel` nor `PolicyLedgerPanel` has cross-tab navigation or an "initial form" mechanism.

---

## Decisions locked

| Decision | Rationale |
|---|---|
| Prefill only `ownerName` and `sourceOfProspect` | Only obvious 1:1 mappings. `policyType` → `policyClass` taxonomy mismatch; `intendedAppointmentDate` ≠ `dateWritten`. Deferred mappings surface as out-of-scope for dispatcher. |
| Non-destructive: never overwrite agent-entered values | Agent reviews + edits before submit. If agent types in a field before clicking "Log Policy," that value is preserved. |
| No schema change: no `prospectInfoId` stored on policy doc | Pure prefill shortcut; no audit trail requirement for the link. |
| Lift `prefillPolicy` state to AgentDashboard | Minimal coupling. `AgentDashboard` passes a callback to `ProspectInfoPanel` and an `initialForm` prop to `PolicyLedgerPanel`. |
| Clear `prefillPolicy` after first open of create form | One-shot: once PolicyLedgerPanel consumes the prefill and enters 'create' view, the data is live in form state. Clear the dashboard-level state immediately so Back→New Policy doesn't re-prefill. |
| CTA label: "Log Policy" (FileText icon) | Concise; signals "from this prep log a policy outcome." |
| CTA placement: `PrepCard` view mode (not edit mode) | Agent is reviewing a prep to decide if the appointment produced a policy. |

---

## File inventory (exhaustive)

| File | Change |
|---|---|
| `src/components/dashboard/AgentDashboard.jsx` | Add `prefillPolicy` state + `setPrefillPolicy`; pass `onCreatePolicyFromPrep` callback to `ProspectInfoPanel`; pass `initialForm={prefillPolicy}` to `PolicyLedgerPanel`; clear on tab leave via `useEffect` or on consumption |
| `src/components/agent/ProspectInfoPanel.jsx` | Accept `onCreatePolicyFromPrep` prop; add "Log Policy" `FileText` button to `PrepCard` view mode (hidden in edit mode) |
| `src/components/agent/PolicyLedgerPanel.jsx` | Accept `initialForm` prop; use `initialForm ?? EMPTY_FORM` as the starting `form` state when entering create view; clear `initialForm` signal via a passed-through callback or via parent clearing the prop |
| `src/components/agent/__tests__/PolicyLedgerPanel.test.jsx` *(if exists)* | Add test: `initialForm` prop populates create-form fields; existing fields not overwritten |
| `src/components/agent/__tests__/ProspectInfoPanel.test.jsx` *(if exists)* | Add test: `onCreatePolicyFromPrep` callback fired with correct `{ ownerName, sourceOfProspect }` on "Log Policy" click |

**Out of scope:**
- `prospectInfoService.js` — no change
- `policiesService.js` — no change
- `firestore.rules` — no change
- `firestore.indexes.json` — no change
- Any Cloud Function — no change

---

## Phase 2 — Build

### AgentDashboard.jsx changes

```jsx
const [prefillPolicy, setPrefillPolicy] = useState(null);

function handleCreatePolicyFromPrep(prep) {
  setPrefillPolicy({
    ownerName: prep.clientName,
    sourceOfProspect: prep.prospectingSource,
  });
  setActiveTab('policy-ledger');
}

// Clear prefill if agent navigates away from policy-ledger without saving
useEffect(() => {
  if (activeTab !== 'policy-ledger') setPrefillPolicy(null);
}, [activeTab]);

// Render:
{activeTab === 'prospect-info' && (
  <ProspectInfoPanel onCreatePolicyFromPrep={handleCreatePolicyFromPrep} />
)}
{activeTab === 'policy-ledger' && (
  <PolicyLedgerPanel initialForm={prefillPolicy} onPrefillConsumed={() => setPrefillPolicy(null)} />
)}
```

### ProspectInfoPanel.jsx — PrepCard change

In `PrepCard` view mode (not editing), add:
```jsx
{isAuthor && onCreatePolicyFromPrep && (
  <button
    onClick={() => onCreatePolicyFromPrep(prep)}
    className="h-9 px-3 rounded-lg text-xs font-semibold text-primary border border-primary/30 hover:bg-primary/5 transition-colors flex items-center gap-1.5 min-w-[44px]"
  >
    <FileText size={13} /> Log Policy
  </button>
)}
```

`ProspectInfoPanel` must accept `onCreatePolicyFromPrep` prop and thread it to each `PrepCard`.

### PolicyLedgerPanel.jsx changes

- Accept `initialForm` and `onPrefillConsumed` props
- In `openCreate()`: `setForm({ ...EMPTY_FORM, ...(initialForm ?? {}) })` — non-destructive spread; EMPTY_FORM defaults apply; initialForm values override only named keys
- Call `onPrefillConsumed?.()` immediately after the `setForm` call in `openCreate()`
- Existing `EMPTY_FORM` constant unchanged

---

## Phase 3 — Tests

Minimum required:
1. `PolicyLedgerPanel` — `initialForm` prop merges into create form (ownerName + sourceOfProspect pre-populated)
2. `PolicyLedgerPanel` — missing `initialForm` prop → form starts as EMPTY_FORM (no regression)
3. `ProspectInfoPanel` — "Log Policy" button visible in view mode when `onCreatePolicyFromPrep` is provided
4. `ProspectInfoPanel` — "Log Policy" fires `onCreatePolicyFromPrep` with correct `{ ownerName, sourceOfProspect }`
5. `ProspectInfoPanel` — "Log Policy" hidden when `onCreatePolicyFromPrep` is not provided

Run: `npx vitest run` — all 1521+ passing.

---

## Phase 4 — Smoke (production)

Script: manual (no new service layer). In prod (logged in as agent):

1. Go to "Joint-Call Prep" tab → open a prep card in view mode → confirm "Log Policy" button visible
2. Click "Log Policy" → confirm tab switches to "Policy Ledger" and "New Policy" create form opens with `ownerName` prefilled from `clientName` and `sourceOfProspect` pre-selected from `prospectingSource`
3. Confirm agent can edit both prefilled fields
4. Type into `ownerName` → confirm the value updates (agent control, non-destructive)
5. Click "Back" → confirm return to policy list; go back to "Joint-Call Prep" → click "Log Policy" again → confirm form opens fresh with prefill (prefill was cleared on tab leave, now re-set)
6. Confirm saving a policy with prefilled data succeeds

---

## Phase 5 — PR Open

Open PR. Do NOT merge. Smoke box unchecked until smoke runs.

PR checklist:
- [ ] lint (npm run lint)
- [ ] tests (npx vitest run)
- [ ] build (npm run build)
- [ ] smoke (after PR opens)

---

## Out-of-scope findings surfaced during verify

| Finding | Disposition |
|---|---|
| `policyType` → `policyClass` taxonomy mismatch (8 vs 5 categories, different values) | Dispatcher decision: if Tatil wants this mapped, a lookup table is needed. OUT of this PR. |
| No `prospectInfoId` linkage on policy doc (no audit trail) | Accepted per constraints. Future PR if needed. |
| ProspectInfoPanel doesn't currently pass `setActiveTab` — cross-tab navigation was never built | This PR introduces the pattern; AgentDashboard is the correct owner of the navigation. |
