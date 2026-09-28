# FR-6 "Mark reinstated" — Phase-1 recon

**Type:** audit-only, inline dispatch (Rule 10 exempt). **No source, rules or test change in this PR.**
**Author:** Claude Code (Opus 5.5, effort high) · **Date:** 28-09-2026 · **Base:** `main` @ `7a909b5d`
**Question:** how can an agent record that a lapsed policy has been reinstated, so the FR-3 reinstatement planner, persistency and (later) financing can use it — without breaking the P2d head-office lock?

---

## 1. Current state (verified on `7a909b5d`, file:line quotes)

### 1.1 There is no `reinstated` policy status

`git grep -n "'reinstated'" -- src functions/*.js firestore.rules` returns one hit, a comment:

> `src/lib/financingProjectedBonus.js:10` — `//   reinstatedUnder2yrAPI = 0  (no 'reinstated' policy status today; K8 sources this)`

The policy lifecycle is `written → submitted → rated/postponed → settled / ntu / denied`, plus `settled → lapsed` (manager only). Nothing leaves `lapsed`.

### 1.2 `isLegalAgentTransition` never allows `lapsed` — and nothing transitions out of it

> `firestore.rules:107-117`
> ```
> function isLegalAgentTransition(fromStatus, toStatus) {
>   return toStatus != 'lapsed'
>     && (
>       (fromStatus == 'written'   && toStatus in ['submitted', 'ntu'])
>       || (fromStatus == 'submitted' && toStatus in ['rated', 'postponed', 'ntu', 'denied', 'settled'])
>       || (fromStatus == 'rated'     && toStatus in ['settled', 'ntu'])
>       || (fromStatus == 'postponed' && toStatus in ['submitted', 'settled', 'denied'])
>     );
> }
> ```

No `fromStatus == 'lapsed'` branch exists, so an agent can neither enter nor leave `lapsed`. The only arm that sets `lapsed` is **Arm D** (`firestore.rules:645-658`): branch manager / tenant admin / platform admin, own branch, `settled → lapsed` only, with `setsOwnStatusProvenance()`. No arm, for any role, moves a policy **out** of `lapsed`.

### 1.3 The import sets lapsed statuses with `statusSource: 'oipa_import'`

> `src/lib/portfolioImport/oipaImportConfig.js:127` — `Lapsed:                 { status: 'lapsed' },`
> `src/lib/portfolioImport/oipaImportConfig.js:144` — `Terminated: { status: 'lapsed' },`
> `src/lib/portfolioImport/parseOipaExport.js:392` — `statusSource: STATUS_SOURCE_IMPORT,` (= `'oipa_import'`, `oipaImportConfig.js:261/277`)

At P4e the import brought in **87 lapsed** policies (`oipaImportConfig.js:268-270`, "117 settled, 87 lapsed, 22 ntu and 3 denied all arrived from the OIPA export"). `status` and `statusSource` are **import-owned** (`src/lib/portfolioImport/buildImportPlan.js:39-49`, `IMPORT_OWNED_FIELDS`): a re-import overwrites them. It records a human-set status it overrides in `previousStatus / previousStatusSource / previousStatusSetBy` (`buildImportPlan.js:253-269`).

**Consequence that shapes the design:** when head office actually reinstates a policy, the next export shows it `Premium Paying`, which maps to `settled` (`oipaImportConfig.js:125`). The reinstatement then becomes **evidenced** by itself on the next import. "Mark reinstated" therefore only has to bridge the gap between the client paying and the next export.

Also note the seed override `TRM2501670` (`oipaImportConfig.js:175-178`): *"Stays lapsed. Client will take a NEW policy, not a reinstatement — never link the two."* A reinstatement is not a replacement sale.

### 1.4 `isHeadOfficeStatus` locks head-office figures (P2d)

> `firestore.rules:405-413`
> ```
> // P2d — Kyron's ruling, 27 Sep 2026 (money lever, option A): HEAD-OFFICE
> // FIGURES ARE LOCKED. A policy whose current status the OIPA import set
> // (statusSource 'oipa_import' ...) carries head office's figures; no agent arm may change a money field on it.
> function isHeadOfficeStatus(data) {
>   return data.get('statusSource', null) == 'oipa_import';
> }
> ```

It is enforced on **Arm A** body edits (`firestore.rules:481-489`, money and credit-deciding fields) and **Arm F** self-confirm (`firestore.rules:609`, `&& !isHeadOfficeStatus(resource.data)`). It is also enforced on the self-confirm history event (`firestore.rules:705`, `statusSource != 'oipa_import'`). Agents edit only their own **self-declared** policies. `statusSource` itself can only be written as `'agent' | 'manager'` by a client (`setsOwnStatusProvenance`, `firestore.rules:400-403`), so a client cannot fake its way in or out of the lock.

### 1.5 Where a reinstatement would be read

| Reader | Today | File:line |
|---|---|---|
| **Persistency figure** | `reinstatements` is a **manual** monthly input ("not in export — enter manually"). It is added to Net Settled only: `calculateNetSettled = gross − lapses + reinstatements`. | `src/lib/persistency/deriveFromLedger.js:86` (`LEDGER_MANUAL_INPUTS`), `src/lib/persistency/calculations.js:92-93` |
| **Who writes that manual input** | The agent, on their own monthly persistency record (P2d BUG-05, Kyron 26 Sep 2026: "agents enter their own persistency inputs"); also TA/PA and the branch's BM. | `firestore.rules:804-814`, `src/services/persistencyService.js:37` |
| **Outlook** | A saved record's `reinstatements` wins; otherwise 0 and named in `assumedZero`. | `src/lib/persistency/persistencyOutlook.js:134-150` |
| **FR-3 reinstatement planner** | `reinstatementPlan` lists the counted lapses from `figure.evidence`. A selection is modelled as `deriveAll({ ...fig.inputs, reinstatements: current + extra })`. Read-only: ticking is never saved. | `src/lib/fr/moneyModel.js:270` (`reinstatementPlan`), `:290` (`currentReinstatements: fig.inputs.reinstatements`), `:329` and `:386` (`deriveAll({ ...inputs, reinstatements: … })`); UI `src/components/fr/money/ReinstatementPlanner.jsx:19` ("reinstated is FR-6, not here") |
| **Financing projected bonus** | `reinstatedUnder2yrAPI` is omitted, so it reads 0. The engine would add it to Net-for-Persistency. | `src/lib/financingProjectedBonus.js:10, 109, 125`; `src/lib/financingBonusEngine.js:45, 70, 146` |
| **Awards engine** | Reads settlement-row `persistency`. Reinstatement is not an input. | `src/utils/awardsEngine.js:187-190` |
| **Points** | `reinstatementsSubmitted` / `reinstatementAPI` come from the **weekly report**, not the policy. | `src/lib/computePoints.js:65-66` |

**Finding (for the ruling, not a defect of this recon):** the only reinstatement input that exists today (§1.5, row 2) is **agent-declared and already blended** into the persistency figure. That is exactly what non-negotiable 5 forbids for new work ("evidenced and declared are never blended"). Whatever FR-6 builds should not add a second, per-policy declared input that sums into the same number.

---

## 2. The conflict

Most lapsed policies an agent would want to win back are **head-office** policies (`statusSource: 'oipa_import'`, §1.3). A plain agent status change `lapsed → settled` on them would:

1. **break the P2d lock** (§1.4): the agent would change a head-office policy's status and, with it, its money consequences (persistency, production credit, awards);
2. **be overwritten by the next import** while head office still shows it lapsed (§1.3), flip-flopping through `previousStatus`;
3. **blend declared into evidenced** (non-negotiable 5): a `settled` status says "head office confirms this", which it would not.

So FR-6 cannot be "add `lapsed → settled` to `isLegalAgentTransition`".

---

## 3. Options (two), with a recommendation

### Option A — agent-declared reinstatement overlay, kept separate from the evidenced status (RECOMMENDED)

The agent marks an **own lapsed** policy "reinstated — waiting for head office". The policy's `status`, `statusSource` and every money field stay exactly as the import left them. The mark is a separate, dated declaration. Readers show it **beside** the evidenced figure, never inside it. The next import that moves the policy to `settled` evidences it, and the declaration becomes moot.

**Data:** three fields on the policy doc, not a new collection:
- `reinstatementDeclaredAt` (timestamp);
- `reinstatementDeclaredBy` (uid);
- `reinstatementNote` (optional short string, e.g. the receipt reference).

No amount is stored. The reinstated amount is **the same figure persistency already counts for that lapse** (`figure.evidence`), so the agent never types money.

**Rules diff sketch** (additive arm plus one history branch; no existing arm edited):

```
// FR-6 Arm G — agent declares (or withdraws) a reinstatement on an OWN LAPSED policy.
// Status, statusSource and every money field are untouched, so the P2d lock
// (isHeadOfficeStatus) is not engaged: head office's figures do not move.
allow update: if isSignedIn()
  && (isAgent() || isProducingManager())
  && getTenantId() == tenantId
  && resource.data.agentId == request.auth.uid
  && resource.data.status == 'lapsed'
  && request.resource.data.status == 'lapsed'
  && request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['reinstatementDeclaredAt', 'reinstatementDeclaredBy', 'reinstatementNote'])
  && (
    // declare
    (request.resource.data.reinstatementDeclaredBy == request.auth.uid
     && request.resource.data.reinstatementDeclaredAt == request.time
     && (!('reinstatementNote' in request.resource.data)
         || (request.resource.data.reinstatementNote is string
             && request.resource.data.reinstatementNote.size() <= 200)))
    // withdraw
    || (request.resource.data.get('reinstatementDeclaredAt', null) == null
        && request.resource.data.get('reinstatementDeclaredBy', null) == null)
  );

// history agent arm — add one OR branch (lapsed → lapsed declaration event):
|| (request.resource.data.fromStatus == 'lapsed'
    && request.resource.data.toStatus == 'lapsed'
    && request.resource.data.get('event', null) in ['reinstatement_declared', 'reinstatement_withdrawn']
    && get(/databases/$(database)/documents/tenants/$(tenantId)/policies/$(policyId)).data.status == 'lapsed')
```

**Write path:** client only, no Cloud Function.
- `policiesService.declareReinstatement(tenantId, agentProfile, policyId, { note })`, and `withdrawReinstatement(...)`.
- Each is one `writeBatch`: the policy update, plus a history doc `{ fromStatus: 'lapsed', toStatus: 'lapsed', event, changedFields, actorUid, actorRole, agentId, unitId, at }`, the same shape as `lapsePolicy` (`src/services/policiesService.js:441-497`).
- A JS mirror guard in the service, as `transitionPolicyStatus` has (`:184-188`).
- Optional: a notification to the agent's BM, reusing the existing `notifications` create (manager-only). That needs a CF, or it can be skipped in v1.

**Readers that change:**
- `deriveFromLedger` / `persistencyOutlook`: evidenced figures are **unchanged**. Add `declared: { reinstatements, policies[] }` beside them. The declared lapses are those in `evidence.lapses` that carry a live declaration; the amount is taken from the same evidence.
- **FR-3 planner** (`reinstatementPlan`, `ReinstatementPlanner.jsx`): a declared lapse shows "Reinstated — waiting for head office (declared 12 Oct)". The header shows **two** figures: "86.6% evidenced" and "90.1% with 2 declared reinstatements". The "Mark reinstated" / "Withdraw" control lives here.
- **Policy Ledger row:** a "Declared reinstated" chip.
- **Financing** (`financingProjectedBonus.js`): **no change.** Money reads evidenced only, and `reinstatedUnder2yrAPI` stays 0 until K8 sources it from evidenced reinstatements.
- **Awards:** no change.
- **Expiry:** readers ignore a declaration once `status != 'lapsed'` (evidenced by an import). A declaration older than N days (proposal: 60) with the policy still lapsed shows "Not confirmed by head office after 60 days". That is a ruling for Kyron. The derived value is never stored (non-negotiable 2).

**Import interplay:** the three fields are **not** in `IMPORT_OWNED_FIELDS`, so a re-import keeps them. When the import moves the policy to `settled`, the declaration is moot by the reader rule above. Optionally, a later import change could clear them; this is not needed in v1.

**Indexes (Rule 17 completeness):**
- **App reads:** the agent reads own policies with the existing `where('agentId','==',uid)` (`getOwnPolicies`). Declaration fields are filtered client-side. **No new composite index.**
- **Manager view** (if wanted: "declared, not yet evidenced" across a branch): the existing branch-scoped `getPoliciesForManager` list, filtered client-side. **No index.**
- **The smoke's own query:** it `get`s the one policy by id, then lists that policy's `history` subcollection with `where('agentId','==',uid)`. That is the same query as `getPolicyHistory` (`policiesService.js:503`) and needs no new index. **Nothing to add to `firestore.indexes.json`.**

**Test plan:**
1. **Rules (emulator)**, extending `tests/rules/policies.rules.test.mjs` and `tests/rules/p2d-numbers.rules.test.mjs`.
   - Allow: agent declares on an own lapsed **head-office** policy.
   - Allow: agent withdraws.
   - Deny: another agent's policy.
   - Deny: a `settled` policy.
   - Deny: touching `status`, `statusSource` or any money field in the same write.
   - Deny: a backdated or forged `reinstatementDeclaredBy`.
   - Deny: a note over 200 characters.
   - Deny: a manager using Arm G on someone else's policy.
   - History arm: allow the `lapsed → lapsed` event only while the parent is lapsed.
2. **Unit:**
   - `deriveFromLedger` `declared` block: never changes the evidenced `persistency`.
   - Monotonicity (rule 3): declaring one more never lowers "with declared".
   - Planner shows two figures.
   - Expiry rule.
   - Financing unchanged (parity test pinned to 0).
3. **Harness walk:** a planner scene with one declared lapse, both themes.
4. **Smoke (staging only, never a feature preview):** declare, reload, see the chip and the two figures, then withdraw.

**Deploy sequence (rules deploy is Kyron's, Rule 19):**
1. Merge the rules PR (Arm G + history branch, additive).
2. Kyron runs `firebase deploy --only firestore:rules`; capture the output.
3. Merge the client PR (service, readers, UI) behind the FR opt-in.
4. Staging smoke.
5. Production 60-second read-only check.

Additive rules may deploy before the client merge, per CLAUDE.md § Workflow ("new match blocks / new arms"). No index or function deploy.

### Option B — manager-confirmed reinstatement (status change gated by permission)

A BM (or TA/PA, or an SM with `canConfirmSettlements`) moves a lapsed policy back to `settled` with `statusSource: 'manager'` and `reinstatedAt`. This mirrors Arm D in reverse. The agent may request it; only the manager commits it.

**Rules diff sketch:** a new "Arm H", modelled on Arm D (`firestore.rules:645-658`).
- `canManage(tenantId)`, with role in `['platform_admin','tenant_admin','branch_manager']` (or `canConfirmSettlements`);
- `managerDocInScope(tenantId, resource.data)`;
- `resource.data.status == 'lapsed'` and `request.resource.data.status == 'settled'`;
- `affectedKeys().hasOnly(['status','statusUpdatedAt','reinstatedAt','reinstatedBy','reinstatementNote','statusSource','statusSetBy','statusAsOf'])`;
- `setsOwnStatusProvenance()` and `reinstatedAt is timestamp`;
- plus a `lapsed → settled` branch in the history **manager** arm.

**Write path:** `policiesService.reinstatePolicy(...)`, a manager service, one `writeBatch` with policy, history and an agent notification (as `lapsePolicy`). Optionally an agent "request reinstatement" flag, which would need its own arm, or a `notifications` create, which only managers may do today, so the request needs a CF.

**Readers that change:** none structurally. It becomes `settled`, so persistency, production, awards and financing all count it as evidenced. **That is the problem:** a manager's word, not head office's, becomes an evidenced status (a non-negotiable 5 tension). The import would also flip it back to `lapsed` until head office's export agrees, recording `previousStatus` each time (`buildImportPlan.js:253-269`).

**Indexes:** none new. The smoke's own query is the same as Option A's.

**Test plan:** rules tests mirroring Arm D's (`scripts/verification/h2c-lapse-smoke.mjs` is the template), plus an import re-run fixture proving the override is recorded.

**Deploy sequence:** as Option A. The rules change is still additive (new arm), but it changes what `settled` means, so it is post-merge only by the spirit of the carve-out.

### Recommendation

**Option A.**
- It never changes a head-office status or figure, so P2d holds by construction (the arm cannot touch `status`, `statusSource` or money).
- It keeps declared and evidenced apart, as two figures (non-negotiable 5).
- It needs no CF, index or new collection, and the import evidences it on its own.

Option B makes a manager's belief look like head office's truth and flip-flops with every import. It is worth revisiting only if Tatil wants branch managers to be able to confirm reinstatements before the export does. That is a policy decision for Kyron, and it could later sit **on top of** A: a manager "confirm" stamp on the declaration, still not a status change.

**Before any FR-6 build, the finding in §1.5 needs a ruling:** the existing monthly `reinstatements` manual input is already declared-and-blended. Recommended: leave it as is for v1, but have the FR-6 planner show per-policy declarations **separately**, and never auto-write them into that manual input. That way there is no double count and no new blending.

---

## 4. Persona review (Option A) and falsification

| Lens | Assessment |
|---|---|
| **Tenant isolation / data integrity** | Arm G is pinned to `getTenantId() == tenantId` and `resource.data.agentId == request.auth.uid`. It writes three non-money fields on one own doc. The history event is append-only and parent-bound. No cross-tenant path. |
| **Role / permissions** | Agents and producing managers act on their **own** policies only. Managers get no new write power. P2d is untouched, because the arm cannot change `status`, `statusSource` or any money or credit field. |
| **Money correctness** | Evidenced persistency, production, awards and financing are **unchanged**. The declared figure is shown separately and never feeds financing (money). Its amount is the evidence's own lapse figure, not typed by the agent. |
| **Operator legibility** | Two figures ("86.6% evidenced · 90.1% with 2 declared"), each declaration dated and attributable (`reinstatementDeclaredBy`). Expiry is visible after N days. The ledger chip tells a manager what is pending head office. |
| **A11y / contrast** | New UI is one button and one chip, in the existing FR planner rhythm; 44px targets; both themes in the harness walk. |
| **Pilot ops / reversibility** | Additive arm. Withdraw is built in. Reverting the client leaves inert fields. Reverting the rules arm stops new declarations with no data migration. |
| **Maintainability** | No new collection, index or CF. One service pair and one reader block. The expiry rule is derived, not stored. |

**Falsification (Rule 23).** The recommendation is overturned if any of these holds:

1. **Head office does not re-export reinstated policies as `Premium Paying` / `Active`.** Then the declaration never becomes evidenced, and a manager step (Option B, or a confirm stamp on A) is required. To check: ask Kyron for one known reinstated policy and look at its OIPA sub-status in the next export.
2. **Tatil wants reinstatements to count for awards or financing before head office confirms.** Then declared money is wanted, and Option A's "never feeds money" is the wrong line.
3. **The persistency memo treats a reinstatement differently from "lapse API added back to Net".** For example, if it credits a different amount, then "the amount is the evidence's own lapse figure" is wrong, and a typed amount (with its P2d risk) returns.

Until one of these is checked, the recommendation is **provisional** (Rule 23). It is a recon finding, not a banked decision.

---

## 5. Follow-up banked in this PR

`docs/FOLLOW_UPS.md` gains, at the end (Rule 7b), the CI flake occurrence from #1004 attempt 1. `DailyCaptureV2` is already a named flake (index: "#899 flake fix is on `staging` ONLY"). `AwardsRulesetPanel` is a registered member (2026-09-16) but with a **different** test. Both are recorded against this occurrence.
