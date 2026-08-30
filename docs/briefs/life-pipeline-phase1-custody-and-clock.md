# Life pipeline — Phase 1 build brief: the custody chain and the clock

**Written 30 August 2026.** Approved by the operator the same day. Extends the design brief (Claude project: `claude/life-pipeline-brief.md`) §5 Phase 1 with the three design rulings taken on 30 August.

**Target repo:** this one only. No KQM work in this phase — the cross-system join is Phase 1.5 and is scoped in §9, not built here.

---

## 1. Why this phase is first

Every other phase *asks* an agent for data. This one *gives* them something: what money is sitting at the branch and how long it has. That is the only reason an agent keeps a pipeline record current, and a pipeline is worth exactly what its currency is worth.

It is also the only phase where the app is currently **wrong** rather than merely incomplete. `clawbackClock.js` anchors the 30-day clock to `dateIssued`. Issue precedes dispatch, so every countdown in the app today runs **early** by however long printing and internal mail take. Safe, but it cries wolf — and an agent who learns the clock is wrong stops reading it.

---

## 2. Decisions locked on 30 August — do not re-litigate

| # | Decision | Rationale |
|---|---|---|
| D1 | **`written` becomes the real starting status.** A policy record opens when the application is written, not when it is submitted. | Without it the KQM event and the ledger record are created by two different people at two different moments, and there is nothing to hang the Phase 1.5 join on. It also gives the agent a "waiting on signature" list they do not have today. |
| D2 | **The custody chain is DATES, not statuses.** `dispatchedAt`, `branchNotifiedAt`, `agentCollectedAt` are timestamps on a policy that stays `settled` throughout. | Ten transitions to police in the rules for what is really one linear walk — and it breaks the first time a package skips a step or the agent learns two dates at once. Dates answer "at the branch 6 days, uncollected" with no state machine at all. |
| D3 | **"Requirements outstanding" is a FLAG, not a status.** (Phase 3 — recorded here so it is not re-decided.) | It recurs — underwriting can ask twice — and it co-exists with a rating. As a status it fights the machine every time. |
| D4 | The clock anchors to **dispatch from head office**, in **calendar** days, `CLAWBACK_DAYS = 30`. | Operator ruling, 30 Aug. |
| D5 | The clawback takes the **full commission** and it is **HELD, not lost**. Delivery releases it and commissions resume normally. | Operator ruling, 30 Aug. This is a copy change with teeth — see slice 1D. |
| D6 | Agents enter the custody dates for now. The CRO is not connected to AgencyTrack. | Operator ruling, 30 Aug. The model must not assume the agent forever — see Arm F. |

---

## 3. What exists today (verified in source, 30 August)

- `src/constants/policyLifecycle.js` — `POLICY_STATUSES`, `LEGAL_AGENT_TRANSITIONS`, `TRANSITION_REQUIRED_FIELDS`, `TRANSITION_OPTIONAL_FIELDS`, `POLICY_STATUS_LABELS`. Mirrored into `firestore.rules`.
- `src/services/policiesService.js` — `createPolicy`, `transitionPolicyStatus` (atomic `writeBatch`: policy update + a `history` subcollection doc), `confirmPolicy`, `lapsePolicy`, `getOwnPolicies`, `getPoliciesForManager`, `getDeliverablePolicies`, `recordPolicyDelivery`, `getPolicyHistory`.
- `firestore.rules` `match /policies/{policyId}` — **Arm A** body-edit (own, `submitted` only), **Arm B** legal transition, **Arm C** manager confirmation, **Arm D** BM-only lapse, **Arm E** CRO delivery.
- `src/utils/clawbackClock.js` — `deriveClawback(dateIssued, {delivered, today})`, `CLAWBACK_DAYS = 30`, `AT_RISK_DAYS = 7`, TT calendar days, display-only, nothing stored.
- `src/lib/policyLedgerDerivation.js` — `policyValue`, `pipelineStage`, `PIPELINE_STAGES` (5 tiles), `derivePipeline`.
- `src/components/agent/PolicyLedgerPanel.jsx`, `src/components/cro/DeliveryRegisterPanel.jsx`, `MarkDeliveredDialog.jsx`.
- `tests/rules/policies.rules.test.mjs` — the emulator suite this phase extends.

**Automation on the collection today: exactly one Cloud Function** — `functions/policyPlans/aggregatePendingPlan.js`, an `onCreate` trigger that files unknown free-text plan names for admin review. It does not update the policy. Everything else is a human writing through the UI.

---

## 4. Slices

Build in this order. Each slice is one branch, one PR (single-branch PR rule).

### Slice 1A — `written` becomes the starting status

**Model: Opus 5, high effort.** Cross-cutting: enum + transition map + rules + UI + a derivation whose tile count was previously locked.

1. `POLICY_STATUSES` gains `'written'` at the head.
2. `LEGAL_AGENT_TRANSITIONS.written = ['submitted', 'ntu']`. An application that is written and then abandoned is an NTU; it is not a denial (nobody underwrote it).
3. `TRANSITION_REQUIRED_FIELDS.submitted` gains `dateSubmitted` **only for the `written -> submitted` edge**. The existing `postponed -> submitted` re-entry stays field-free. Encode this as a per-edge lookup rather than widening the per-target map, or the re-entry breaks.
4. `createPolicy` defaults `status: 'written'` and stops requiring `dateSubmitted` at create. `dateWritten` stays required. `validate()`'s `dateSubmitted >= dateWritten` check moves to the transition.
5. `firestore.rules`:
   - **Arm A** currently requires `resource.data.status == 'submitted'` for a body edit. It must accept `in ['written', 'submitted']` — an agent must be able to fix a typo on an unsigned application.
   - **Arm B** gains the `written -> submitted` edge with `affectedKeys().hasOnly(['status','statusUpdatedAt','dateSubmitted'])`, `dateSubmitted is timestamp`, `<= request.time`, and `>= resource.data.dateWritten`.
   - The create arm's status guard becomes `'written'`.
6. `pipelineStage()` gains a `written` bucket and `PIPELINE_STAGES` a sixth tile, `{ key: 'written', label: 'Written', role: 'in-flight' }`, at the head.

> **This deliberately revises the Rule 9 banked decision that locks 5 pipeline tiles.** Folding `written` into the Submitted tile would hide exactly the list the status exists to create. Say so in the PR body; do not fold it silently.

7. **No migration.** Every existing policy is at `submitted` or beyond, and `written` has no inbound edge, so no document changes. State that in the PR rather than writing a no-op script.

**Deliverable:** `tests/rules/policies.rules.test.mjs` extended — a `written` policy is body-editable by its owner; `written -> submitted` succeeds with `dateSubmitted` and fails without it; `written -> settled` is refused; `written -> rated` is refused; a `dateSubmitted` earlier than `dateWritten` is refused; a second agent cannot touch either.

### Slice 1B — the four custody dates

**Model: Opus 5, high effort.** This slice opens the first agent-writable arm on a `settled` policy. Today no agent arm can touch a settled policy at all, and that is a property worth losing carefully.

1. Three new fields, all nullable timestamps, all stamped `null` in `createPolicy`: `dispatchedAt`, `branchNotifiedAt`, `agentCollectedAt`. Delivery stays as it is (`policyDeliveryDate` / `deliveredBy` / `deliveredAt`, CRO-owned, Arm E).
2. New service function `recordCustodyDates(tenantId, agentProfile, policyId, policy, dates)` — a `writeBatch` mirroring `transitionPolicyStatus`: update the policy, write a `history` doc with `fromStatus === toStatus === 'settled'` and the changed fields. The custody walk must be as auditable as a status change, because it is the walk with money on it.
3. **`firestore.rules` — new Arm F, agent custody dates.** The tightest arm in the file:

```
allow update: if isSignedIn()
  && (isAgent() || isProducingManager())
  && getTenantId() == tenantId
  && resource.data.agentId == request.auth.uid
  && resource.data.status == 'settled'
  && request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['dispatchedAt', 'branchNotifiedAt', 'agentCollectedAt'])
  && <each present field is a timestamp, <= request.time,
      and >= resource.data.dateIssued>
```

   - **Backdating is allowed; future dates never are.** Agents learn these dates after the fact — that is the whole point — but a future date would move the deadline out.
   - **`>= dateIssued` on every one of them.** Issue precedes dispatch precedes everything. A dispatch date before the issue date is a typo, and it would move the deadline *earlier*, which is the direction that costs an agent commission.
   - `hasOnly` must list **exactly** these three. If this arm can reach `settledAPI`, `earnedCommission`, `status` or any delivery field, an agent can rewrite their own confirmed production. Assert that with a test per forbidden field, not one test with a comment.
4. Ordering (`dispatchedAt <= branchNotifiedAt <= agentCollectedAt`) is validated in the **service and the UI**, not the rules. Rules enforce the safety property (no future, no earlier than issue, no other field); the ordering is a data-quality nicety and a real package can teach the agent two dates out of order.

**Deliverable:** `tests/rules/policies.rules.test.mjs` — one refusal test per forbidden field reachable through Arm F; future-date refused; before-`dateIssued` refused; non-`settled` policy refused; another agent's policy refused; the CRO's Arm E still works unchanged afterwards.

### Slice 1C — re-anchor the clock

**Model: Sonnet 5, medium effort.** Pure module, well-fenced, with the hard thinking already done here.

`deriveClawback` takes the policy (or the three dates) rather than `dateIssued`, and resolves its anchor in this order:

| Order | Anchor | `anchorSource` | Display |
|---|---|---|---|
| 1 | `dispatchedAt` | `'dispatched'` | exact countdown |
| 2 | `branchNotifiedAt` minus 2 business days | `'estimated'` | countdown **labelled an estimate** |
| 3 | neither | `'unknown'` | **no countdown at all** — "dispatch date not recorded" |

`dateIssued` is **no longer an anchor**. It is the wrong date, and using it as a third fallback would quietly restore today's bug for every policy whose custody dates are blank.

**Why the estimate leans early.** The agent reliably knows the CRO's email date, not dispatch. Dispatch is 1–2 business days *before* the email, so anchoring to the email would push the deadline up to two days **later** than the truth — telling an agent they are fine on the day the clawback bites. Subtracting 2 business days errs early by at most a day, which is the harmless direction.

The return gains `anchorSource` and `anchorDate`. **Never render a precise countdown from an estimated or absent anchor without saying so** — a number nobody entered, displayed as fact, is how the whole feature loses its credibility.

**Deliverable:** unit tests for each anchor branch, the business-day subtraction across a weekend, the snap-to-exact when `dispatchedAt` arrives later, and TT-boundary cases (a 20:00 TT timestamp must not read as the next day).

### Slice 1D — held, not lost

**Model: Sonnet 5, medium effort.**

`tone: 'overdue'` reads terminal today. Per D5 it is not: the commission is **held**, and delivery releases it.

1. Rename the tone to `'held'`; keep `overdue` on the returned object as the boolean predicate if consumers need it, but nothing user-facing may say "lost", "forfeited" or "clawed back".
2. **Keep counting past day 30.** `daysLeft` going negative is the signal; the display becomes "held for N days".
3. **Show the amount.** `earnedCommission` is already captured at `settled`, so the panel can say what is sitting there. An agent who believes the money is gone has no reason to hurry; an agent who can see the figure does.
4. Copy states what releases it: deliver the policy and return the signed receipt.

**Deliverable:** the copy in the PR body, verbatim, so the operator can correct the wording before it reaches an agent.

### Slice 1E — the branch view

**Model: Sonnet 5, medium effort.**

A list, derived client-side from `getOwnPolicies()` (agent) and `getDeliverablePolicies()` (CRO) — **no new Firestore reads, no new index**, the same discipline `policyLedgerDerivation.js` already holds to.

Three groups, sorted by urgency within each: **at the branch, uncollected** (`branchNotifiedAt` set, `agentCollectedAt` null) · **collected, undelivered** (`agentCollectedAt` set, `policyDeliveryDate` null) · **delivered**. Each row: days in that state, the clock with its anchor label, and the held commission where it applies.

This is the screen that answers "what is sitting at the branch and how long has it been there" without walking to the branch. It is the payoff for slices 1A–1D and the reason an agent keeps the dates current.

---

## 5. The book stays

The physical signed book at each branch is a chain of custody and almost certainly serves a compliance purpose. **The app mirrors it; it does not replace it, and nothing in this phase should be built or worded as though it does.** What the app adds is what the book cannot: telling you today, from wherever you are, what is at the branch and what it is worth.

The **policy receipt** is a client-signed document. Record that it exists and its date. **Do not store the image** unless that is decided deliberately and separately.

---

## 6. Rules that govern this phase

**Store process state, never medical detail.** `rateReason` and `pendingReason` are free text and are exactly where a medical finding will quietly accumulate. Phase 1 adds no such field, and must not. When Phase 3 arrives, "Paramedical outstanding" is operational; *why* the client needs one is not.

**Deploy ordering.** Slices 1A and 1B change `firestore.rules`, which is deploy-gated: merging ships code, not rules. Rules must be released **after** merge, and the release verified with a probe, before the UI that depends on them reaches an agent. The additive carve-out does not apply — Arm A's status guard *widens* in 1A, which is a behaviour change to an existing arm.

**Node 20 decommissions 2026-10-30.** Nothing in this phase touches `functions/`, so it does not move that date — but do not add a function here without pricing it in.

---

## 7. Named deliverables (rituals, stated as work)

1. **Rules emulator run** — `tests/rules/policies.rules.test.mjs`, extended per slices 1A and 1B. Paste the observed pass/fail counts into the PR, not a summary of them.
2. **Mutation verification on Arm F.** Delete the `hasOnly` clause and re-run: the forbidden-field tests must go red and nothing else. Report the observed counts both ways. An arm this permissive-looking needs proof its guard is load-bearing.
3. **Smoke walk** — `scripts/verification/smoke-custody-chain.mjs` against a locally-served `--mode staging` build: create a policy at `written`, walk it to `submitted`, `settled`, then through all three custody dates and into the branch view, asserting the clock's `anchorSource` at each step. **Negative-controlled**: restore the `dateIssued` anchor and confirm exactly the anchor assertions go red.
4. **Verbatim `git log` paste-back (Rule 16)** — raw output, not a description.
5. **Post-merge fill (Rule 16)** — one per work PR, or one consolidated fill under 16(c) if the slices auto-merge as a batch. Caps applied, overflow to `docs/CONTEXT-history.md` verbatim. `Current main HEAD` tracks work squashes only.
6. **Rules deploy stamp** — for 1A and 1B, `firebase deploy --only firestore:rules` after merge, with the post-deploy probe result recorded. Step 5a means the deploy state is *queried*, never inferred from a successful CLI exit.

---

## 8. Stop conditions

Stop and surface rather than deciding alone if:

- **Arm F cannot be written so that `hasOnly` provably excludes every money field.** That is the one property this phase must not trade away.
- **An existing policy is found at a status outside the enum**, which would mean the ledger has been written by something this brief does not know about.
- **The branch view needs a Firestore composite index.** It should not — everything derives from reads that already happen. If it does, the derivation has drifted into a query and wants rethinking.
- **`written` turns out to already exist** in any form in a mockup, a spec or a comment with different semantics from D1.

---

## 9. Out of scope — named so it is not drifted into

- **Phase 1.5, the KQM join.** Direction is settled: AgencyTrack's policy record is the system of record for the case; KQM's events are the activity trail that feeds KPIs. Creating a policy at `written` should be what emits the KQM event, not the reverse — the policy carries product, coverage and API, the event carries a count and a figure. Today the same fact is entered in both and nothing links them; they will disagree within a week of real use. It is a cross-repo slice and needs its own brief.
- **The CRO's own connection.** D6 puts the agent in the seat for now. Arm F is written so a CRO arm can be added later without changing the field model.
- Phase 2 (ACH mandate), Phase 3 (underwriting middle and the counter-offer maths), Phase 4 (`route: branch_issued`), Phase 5 (the headroom offer — now unblocked, since PRs #933/#934 encoded the medical limits, the confirmed band mapping and age next birthday).

---

## 10. The trap in the vocabulary

`newBusinessType` on a policy is a **product classification** (`nb_ordinary`, `replacement`). The daily document's `newBusiness.apps` / `newBusiness.api` are **KPI counters**, and are what the KQM ladder started feeding on 30 August. They share a word and nothing else. Anyone touching both in one sitting will eventually conflate them — check which one you are holding before you write to it.
