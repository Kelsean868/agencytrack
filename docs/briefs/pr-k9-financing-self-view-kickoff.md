# PR-K9 — Financing Self-View (read-only)

run_model: claude-opus-4-8
size: M
track: K (New-Agent Financing & Bonus Tracker)
depends_on: K1–K7 (all merged; K7 squash fa5854a8)
rules_change: NONE
data_model_change: NONE
deploy_required: NO (no rules, no functions)

---

## Intent

First subject-facing view over the financing data. A financed person sees **their own**
financing picture, numbers-only — statement facts + derived motivational figures — with
**zero** manager-internals (risk verdicts, decision-provenance, audit metadata, the 5.3
trigger ratio).

Two audiences, **one component**, scoped to `user.uid`:
1. **Agent** — numbers-only self-view, mounted in `AGENT_NAV`.
2. **Financed UM (own half)** — the *same* component, mounted in `PRODUCING_MANAGER_NAV`
   under "My Production" (the existing `mp-*` own-producer pattern), scoped to the UM's uid.

**Explicitly NOT in K9** (deferred to K10): the financed-UM *unit-management* half
(managing the unit's financed agents). That requires a `unitId` stamp on financing docs +
a unit-scope rule clause + a backfill migration + a unit-filtered manager panel — a
money/auth/migration change that does not belong in a read-only view-layer PR. Do not
build it. Do not add a UM unit-financing nav entry.

---

## Why this is view-layer only (the recon headline)

The financing read-rules were built subject-aware from K1. Every financing data collection
already carries an agent/producing-manager self-read arm via `canAccessOwn`
(`canAccessOwn` admits `(isAgent() || isProducingManager()) && uid == agentId`). The
"UM + agents excluded" contract in K1–K7 is a **write-side** posture only. K9 is the first
time `canAccessOwn` fires on financing data in production — so the work is a SHOWN/PRIVATE
view projection + two mounts, **not** new rules.

---

## Phase 0 — Falsification hard-stop (verify premises before writing)

Confirm against the live tree. **If any check fails, STOP and surface — do not absorb.**
A failure here means K9 is NOT pure view-layer.

0.1 Read arms present (grep `firestore.rules`), each must include the `canAccessOwn` arm:
  - `financingTerms/{agentId}` — `allow get` includes `canAccessOwn(tenantId, agentId)`.
  - `financing/{docId}` (K2 ledger) — `allow get` **and** `allow list` include
    `canAccessOwn(tenantId, resource.data.agentId)`.
  - `financingReconciliation/{docId}` (K6) — `allow get` **and** `allow list` include
    `canAccessOwn(tenantId, resource.data.agentId)`.
  - `config/financingConfig` — readable by any signed-in same-tenant user (the
    `match /config/{docId}` wildcard).
  - **HARD-STOP** if any financing read arm is `canManage`-only (manager-gated) → K9 would
    need a rules change → surface, do not build.

0.2 Ledger list query is satisfied: `listFinancingMonths` issues
  `where('agentId','==', uid)`. Confirm the `allow list` arm above covers it. Confirm
  `financingTerms` is a **single doc per uid** (`getDoc(financingTerms/{uid})`) so no
  `list` arm is needed for terms (there is none — that is expected, not a gap).

0.3 Derived chain inputs are agent-readable (so the motivational hero is pure-derivable in
  a read-only self-view with zero manager-written secrets):
  - `getOwnPolicies` → policies `get`/`list` include `canAccessOwn`.
  - `getPersistencyForAgent` → persistency readable in-tenant + per-doc get.
  - The ruleset is a **static code module** (`config/financingRuleset/2026.js`,
    `DEFAULT_FINANCING_RULESET_2026`), not a Firestore doc — freely available client-side.
  - **HARD-STOP** if any derived input requires a manager-only read → the bonus/take-home
    hero is not subject-derivable → surface.

0.4 Confirm the K7 miss/risk engine functions (`computeConsecutiveMisses`,
  `severityForCount`, `terminationConditionMet`, `findAdjustmentFlags`) are pure functions
  of agent-readable ledger fields. This is the structural-(C) fact: the SHOWN/PRIVATE risk
  line is enforced **at the view layer** (what K9 renders), not at the data layer. Note it;
  do not attempt a data-side split (out of scope).

Paste the grep/read evidence (path:line) for 0.1–0.4 before proceeding.

---

## Phase 1 — Anchor confirm (exact path:line before editing)

1.1 Agent mount: the `AGENT_NAV` array (`navConfig.js`) and the `activeTab === …` render
  switch in `AgentDashboard.jsx`. Cite the insertion points.

1.2 UM-own mount: the "My Production" section in `PRODUCING_MANAGER_NAV` (`navConfig.js`)
  and the `MP_TABS` set + render branch in `ManagerDashboard.jsx` (the `mp-*` pattern).
  Cite where a new `mp-financing` entry + branch go. Confirm the My-Production items are
  gated to UM+BM (not SM/PA) — K9 follows the same gate.

1.3 Derived-engine import paths and signatures: `computeTakeHome` (financingTakeHome.js),
  the K3 bonus engine (financingBonusEngine.js), the K4 orchestrator `getProjectedBonus`
  (financingProjectedBonus.js), the K6 wind-down `computeReconciliation` /
  `computeGarnishProjection` / `computeWindDownClocks` (financingReconciliation.js).
  Cite the exact exports the component will call.

1.4 Service reads: `getFinancingTerms`, `listFinancingMonths`, `reconcileFinancing` (or
  its read counterpart), `getFinancingConfig` — confirm each takes explicit `tenantId`
  and the subject `uid`.

**HARD-STOP** if any anchor is absent or shaped differently than the recon describes.

---

## Phase 2 — Build `FinancingSelfView` (read-only)

New component `src/components/financing/FinancingSelfView.jsx` (confirm dir in Phase 1).
Read-only. Props: `{ tenantId, subjectUid }`. Handles **loading / error / empty** states
(empty = no `financingTerms` doc or `financingStatus === 'not_on_financing'` → render a
neutral "not on financing" empty state, not an error).

"Financed" derives from terms-doc existence + status (there is **no** `isFinanced` flag and
K9 must invent none): financed = `getFinancingTerms()` non-null AND
`financingStatus !== 'not_on_financing'`. This is role-agnostic — a financed UM has a
`financingTerms/{theirUid}` doc exactly as an agent does.

### Field projection contract — THIS IS THE SPEC

Render **only** SHOWN fields. PRIVATE fields must be **absent from the DOM** (not hidden via
CSS). Relabel where noted.

**SHOWN — Ledger** (`financing/{uid}_{YYYY_MM}`):
`runningBalance` (may be negative = surplus owed back), `financingPaid`, `netCommission`,
`bonusOffset`, `validatingAPI`, `actualAPI`, `basisSource` (label).

**SHOWN — Terms** (`financingTerms/{uid}`):
`agreedMonthlyFinancing`, `currentMonthlyFinancing`, `validatingAPI`, `effectiveDate`,
`financingStatus`.

**SHOWN — Reconciliation** (`financingReconciliation/{uid}_{year}`):
`totalFinancingDrawn`, `totalOffsets`, `closingBalance` (may be neg = surplus),
`reconciledPosition`, `surplusPaid`, `waiverApplied`, `outcome`, `serviceMet`,
`serviceMonths`, `garnishStarted`.

**SHOWN — Derived** (pure, subject-derivable):
- K4 take-home waterfall: `gross / tax / net / financingPortion / takeHome / isOwing`.
- K3 bonus gates: `qualified`, `grossGateMet`, `persistencyGateMet`, quarter/year position.
- K6 wind-down clocks: `serviceMonths`, `serviceMet`, `termMonthsRemaining`.

**SHOWN but RELABELED:**
- `managerFinancing` → render as **"Financing this month"** / **"Your draw."** (The value is
  the subject's confirmed draw; strip the manager-decision framing.)

**SPLIT:**
- `statusHistory[]` → render the `{ from, to, at }` state timeline ONLY. Suppress each
  entry's `{ note, byName, role }`. No actor attribution, no manager notes.

**PRIVATE — never render (omit from DOM):**
- Ledger: `adjustmentPct` (the 5.3 trigger ratio — owner-ruled PRIVATE),
  `suggestedFinancing` (pre-decision figure — owner-ruled PRIVATE), `notes`, `source`,
  `enteredBy/ByName/At`, `updatedAt`, `prorationEnteredBy/ByName/At`, `prorationUpdatedBy/At`.
- Terms: `createdAt/By`, `updatedAt/By`.
- Reconciliation: `reconciledBy/ByName/At`, `updatedBy`, `createdAt`.
- Engines: K7 miss/risk verdicts (`computeConsecutiveMisses`, `severityForCount`,
  `terminationConditionMet`, `findAdjustmentFlags`) — **do not call, do not render.**
- `auditNudges` — never client-readable anyway; do not reference.

### Visual hierarchy
The motivational-vs-utilitarian layout (which SHOWN fields are heroes vs statement readouts)
is **owner-deferred to Claude Design** and will arrive as a CD build-annotation sheet. Until
that lands, build a correct-but-plain layout from the contract above (all SHOWN fields
present and correctly valued); the CD sheet reshapes hierarchy, not the field set. Do not
invent a hero treatment ahead of the CD sheet.

Domain display rules: TTD currency; dates stored `YYYY-MM-DD`, displayed `DD-MM-YYYY`;
`parseFloat` already enforced on writes (read side just formats). Negative
`runningBalance`/`closingBalance` renders as a surplus, not an error.

---

## Phase 3 — Mount: agent

Add one `AGENT_NAV` entry (`{ id:'financing', tabId:'financing', … }`) + one
`activeTab === 'financing'` render branch in `AgentDashboard.jsx` mounting
`<FinancingSelfView tenantId={…} subjectUid={user.uid} />`. No shell change.

---

## Phase 4 — Mount: financed-UM own half

Add one "My Production" entry (`mp-financing`) to `PRODUCING_MANAGER_NAV` + one `MP_TABS`
render branch in `ManagerDashboard.jsx`, mounting the **same** `FinancingSelfView` scoped
to `user.uid`. Same UM+BM gate as the other `mp-*` items. This is the own-financing
(agent-style) half of the composite; the unit-management half is K10 and is not built here.

---

## Phase 5 — Smoke (subject-signed-in, value-level) — NON-WAIVABLE

Per decision (A) and the SMOKES.md "self-service list must be tested as the owning user"
standard (PR #298). Selector-only checks are insufficient.

5.1 **As the financed agent** (signed in as the subject, NOT a manager):
  - Seed `financingTerms/{agentUid}` (`on_financing`), ≥2 ledger months, and a
    reconciliation doc via the manager/admin path.
  - Sign in as the agent → open the financing tab → write-read-verify: assert
    `runningBalance`, `currentMonthlyFinancing`, the take-home `takeHome`, and at least one
    reconciliation figure render with the **exact seeded values** (account for History's
    ≥1000 "K" abbreviation if that formatter is reused).
  - Assert **PRIVATE absence**: `adjustmentPct`, `suggestedFinancing`, manager `notes`,
    and any `*By`/`*ByName` audit value are **not present in the DOM**.
  - Assert the relabel: the confirmed draw shows under "Financing this month"/"Your draw,"
    not "Manager Financing."

5.2 **As the financed UM** (same component, UM subject, via My Production):
  - Seed `financingTerms/{umUid}` + ledger for the UM's own uid.
  - Sign in as the UM → My Production → `mp-financing` → same value-level SHOWN assertions
    and PRIVATE-absence assertions as 5.1. This exercises the `canAccessOwn`
    `isProducingManager()` arm for the first time in production.

Use a managed foil subject from a different unit/tenant where helpful; assertions are
value-level, not length/non-null.

---

## Standing reminders

- **Rule 19 (human-merge gate):** money-adjacent surface — HOLD for human review at PR-open.
  CC never merges/deploys. (No rules/functions change, so no `firebase deploy`.)
- **Rule 22 (self-critique):** enumerate ≥1 known gap before reporting PR-ready.
- **Rule 23 (falsifier):** the structural-(C) posture holds only if K9 adds no new data
  exposure — state the evidence that confirms it (every read arm exercised already existed
  pre-K9).
- **Rule 21:** poll for bot review (Gemini + GLM); disposition every comment before
  PR-ready.
- Functional component, no inline styles (Tailwind + CSS vars), loading/error/empty all
  handled, all reads via service files.
- Strike count 0/2. Build to PR-open and HOLD.

## Self-critique seed (carry into the Rule 22 report)
- The CD hierarchy sheet is not yet landed; the plain layout is a placeholder for field
  correctness, not the final motivational treatment.
- 5.1/5.2 prove SHOWN values + PRIVATE absence, but do not prove the derived bonus/take-home
  chain against a hand-pinned arithmetic fixture — add one pinned take-home fixture if cheap.
