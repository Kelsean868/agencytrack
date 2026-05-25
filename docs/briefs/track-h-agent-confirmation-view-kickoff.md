# Build Lock — Track H: Agent Confirmation-Surfacing

**Branch:** `feat/track-h-agent-confirmation-view` (single branch; `git fetch origin` before branching off main)
**Build to:** PR-open, then run the pre-merge preview smoke, then **STOP** for dispatcher review + Kyron merge.
**No Phase 6** — this slice changes no rules, indexes, services, or Cloud Functions, so there is nothing to deploy.

---

## Why
H2a shipped manager confirmation + a `policy_discrepancy` notification, but the agent's own policy list shows none of the confirmation state, and the notification renders with a generic Bell icon. This slice surfaces confirmation to the agent on their own ledger and gives the discrepancy notification a proper alert icon. Pure additive **display** — reads fields the policy doc and the notification already carry.

## Ground truth (from Phase-1 verify — do not re-derive, do not contradict)
- `getOwnPolicies` returns `{ id, ...d.data() }` → every policy object in the agent list already carries `confirmedByManager`, `confirmedAt`, `confirmedByUid`, `managerSettledAPI`, `managerNote`, `hasDiscrepancy`, `settledAPI`. **No service-layer change.**
- `PolicyLedgerPanel` card today renders only: `ownerName`, `insuredName`, status badge, `proposedAPI`, `sourceOfProspect`, `cashWithApp`, `dateWritten`. Footer shows the "Update Status" button only when `LEGAL_AGENT_TRANSITIONS[p.status]` is non-empty.
- `settled` is terminal for agents → confirmed policies never show "Update Status", so the footer slot is free for the confirmation strip.
- `NotificationDrawer` `TYPE_META` has no `policy_discrepancy` entry → falls back to `submission_reminder` (Bell / primary). `AlertTriangle` is already imported; `text-warning` / `bg-warning/10` are already used by other types.
- **Token rule:** use `PolicyLedgerPanel`'s own Nexus token family (`text-ink`, `text-ink-muted`, emerald for settled) and the existing status-badge chip shape (`text-xs px-2 py-0.5 rounded-full font-semibold`). Do **not** copy `PolicyReconciliationPanel`'s `text-text` / `green-100` classes.

---

## Scope — exactly two source files (+ their tests + docs)

### Item 1 — `src/components/agent/PolicyLedgerPanel.jsx`: confirmation strip
In the list card footer, the three footer states are **mutually exclusive** (a card is never two of these):

1. **Confirmed** (`p.confirmedAt` present) — render a strip separated by the existing `border-t border-border`:
   - Chip: `Confirmed by {p.confirmedByManager}` — emerald, matching the panel's settled-badge palette (`bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400`) + existing chip shape.
   - If `p.hasDiscrepancy`: an amber `Discrepancy` chip (`bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400`), same shape.
   - Values line (`text-ink-muted`, values in `text-ink font-semibold`):
     - if `hasDiscrepancy`: `Your value: {formatCurrency(p.settledAPI)} · Manager: {formatCurrency(p.managerSettledAPI)}`
     - else: `Settled: {formatCurrency(p.managerSettledAPI)}`
   - If `p.managerNote`: a muted line `Note: {p.managerNote}`.
2. **Settled but not yet confirmed** (`p.status === 'settled' && !p.confirmedAt`): a single muted line `Awaiting manager confirmation.` — no chip.
3. **Non-terminal** (`LEGAL_AGENT_TRANSITIONS[p.status]` non-empty): the existing "Update Status" button, unchanged.

No new imports (`formatCurrency` already imported). Chips are text-only (match existing badges — no icons).

### Item 2 — `src/components/ui/NotificationDrawer.jsx`: one `TYPE_META` entry
Add **exactly one** line:
```
policy_discrepancy: { Icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
```
`AlertTriangle` is already imported. No other change to this file.

## Out of scope — do NOT touch
`firestore.rules`, `firestore.indexes.json`, `policiesService.js`, `notificationService.js`, any Cloud Function, the create form, the transition modal, the manager panel, notification `link` behavior, any new notification type beyond the one map entry above.

---

## Tests (proportionate to the change; follow the repo's component-test patterns — mock `AuthContext` + `getOwnPolicies`)
**`PolicyLedgerPanel`** (extend existing test file or add `src/components/agent/__tests__/PolicyLedgerPanel.test.jsx`):
- confirmed + discrepancy → "Confirmed by …", "Discrepancy", both values, and Note all render.
- confirmed + clean (no discrepancy) → "Confirmed by …" + single "Settled" value; "Discrepancy" **not** present.
- confirmed + no `managerNote` → no Note line.
- `settled` + not confirmed → "Awaiting manager confirmation"; no confirmation chip; no Update Status.
- non-terminal (e.g. `submitted`) → Update Status button; no confirmation strip; no awaiting line.

**`NotificationDrawer`** (extend/add): a `policy_discrepancy` notification renders with the `AlertTriangle`/warning meta, not the Bell fallback (assert via testid/icon/class as the harness allows).

---

## Smoke — PRE-MERGE on the Vercel preview (no Phase 6)
Pure-display slice; the preview reads prod Firestore. Seed deterministic fixtures via Admin SDK, assert the render, clean up. Paste all output verbatim; report the table in the PR.

1. Seed in `tatillife_south` for the test agent (UID `J0j4uBqzTPcfm1IlGCPyDzo27RP2`), `ownerName` tag `SMOKE-AGENT-CONF-<ts>` (+ all required create fields):
   - **Policy A:** `status: settled`, `confirmedAt` set, `confirmedByManager: "Test Branch Manager"`, `managerSettledAPI: 6000`, `settledAPI: 5000`, `hasDiscrepancy: true`, `managerNote: "Adjusted per receipt."`
   - **Policy B:** `status: settled`, `confirmedAt` set, `managerSettledAPI: 4000`, `settledAPI: 4000`, `hasDiscrepancy: false`, no `managerNote`.
   - **Notification:** `type: policy_discrepancy`, `userId` = agent UID, title/body per H2a shape.
2. Log in as the test agent on the **preview URL** (`setupBypassSession`). Open Policy Ledger.
3. Assert: Policy A shows "Confirmed by Test Branch Manager", "Discrepancy", "Your value: $5,000.00", "Manager: $6,000.00", "Note: Adjusted per receipt." Policy B shows "Confirmed by …", "Settled: $4,000.00", and **no** "Discrepancy". Open the bell drawer → the `policy_discrepancy` notification is present and renders with the warning triangle.
4. Delete both seeded policies (`-r`) + the notification via Admin SDK. Re-enumerate `SMOKE-AGENT-CONF` → **EMPTY**. Paste verbatim.

---

## Gates & docs
- Scope-check: `gh pr diff <n> --name-only` must equal **exactly** `{ src/components/agent/PolicyLedgerPanel.jsx, src/components/ui/NotificationDrawer.jsx, <PolicyLedgerPanel test>, <NotificationDrawer test>, docs/CONTEXT.md, docs/FOLLOW_UPS.md }`. Anything else → STOP and report.
- PR checklist (Rule 18) filled from ground truth; the smoke box stays unchecked until the preview smoke passes.
- **Phase 4 (placeholder docs):** `docs/CONTEXT.md` recently-shipped row with `#TBD` / `{TBD}` SHA placeholders; `docs/FOLLOW_UPS.md` — mark the **discrepancy-surfacing half** of the agent-side "H11 discrepancy/lapse surfacing" tail DONE (the **lapse** half remains, lands with H2c).
- **Phase 5:** commit / push / open PR. STOP at PR-open.
- **No Phase 6.** Post-merge, run the standard sequence (sync main, capture squash SHA, fill the `#TBD`/`{TBD}` placeholders, commit + push direct to main, Rule 15 verify) — but **no deploy / no prod smoke** step.
