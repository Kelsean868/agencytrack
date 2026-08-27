# Kickoff brief - slice C2: `ingestCallActivity` accepts EFFECTS, not outcome names

**Drafted:** 27 August 2026 · **Merge channel:** HUMAN-MERGE (changes a deployed public contract)
**Model:** Opus 5 · **Effort:** high
**repomix:** pack FULL - touches `functions/`.
**Deploy gate:** changes a deployed Cloud Function. `firebase deploy --only functions:ingestCallActivity`
against BOTH projects is a named deliverable.

---

## Why this exists

Slice B shipped an endpoint that takes KQM's `outcome` and `campaignCode` and maps them internally
through `outcomeMap.js`. A live audit of the KQM database (Supabase `oujnscwyxwuzmgyszkxd`,
27 August) found that contract matches almost nothing real:

| | Slice B expects | Live KQM has |
|---|---|---|
| Campaign codes | `schools`, `portfolio`, `referrals`, `group_benefits`, `religious_houses`, `due_callback` | `schools_2026`, `portfolio_2026`, `referrals_2026`, `group_benefits_2026`, `religious_houses_2026` |
| Outcomes | 19 snake_case keys | **~100** values across 5 campaigns, mixed display labels and snake_case |

**Every campaign code would 400 today** on the `_2026` suffix alone. Outcomes arrive as display
labels (`"No budget - parents pay"`). `due_callback` is not a campaign in KQM at all - it was
invented by slice B to carry the follow-up ruling.

**The operator has ruled that KQM normalises before sending** (27 Aug). Each system owns its own
vocabulary, because KQM can create campaigns freely and a trigger seeds a fresh vocabulary for each
one - so any design that couples them is a design that silently stops counting calls the first time
someone adds a campaign.

This slice makes AgencyTrack's side of that true. **It gates C1**: until the endpoint accepts the new
shape, anything KQM sends is rejected.

Full audit and design: `claude/slice-c-kqm-webhook-design.md` in the Prospecting project.

## Phase 0 - audit of what actually shipped

Verify against source. If any premise has moved, **STOP and wait for dispatcher** (Rule 17).

| # | Finding to confirm |
|---|---|
| **F1** | `functions/callActivity/outcomeMap.js` exports `CALL_OUTCOMES`, `OUTCOME_KEYS`, `CAMPAIGN_LANES`, `CAMPAIGN_CODES`, `DIAL_BUCKETS`, `WRITABLE_FIELDS`, `isKnownOutcome`, `isKnownCampaign`, `mapCall`. Establish which are consumed OUTSIDE this module before deleting any of them. |
| **F2** | `validatePayload` in `ingestCallActivity.js` destructures `{ sourceApp, sourceId, occurredAt, campaignCode, outcome, durationSec }` and rejects on `isKnownCampaign` / `isKnownOutcome`. Those two rejections are what this slice replaces. |
| **F3** | `FORBIDDEN_BODY_FIELDS` rejects identity in the payload. **This does NOT change** - it is the A-prime principle and it survives the contract change intact. |
| **F4** | `durationSec` is recorded as evidence and never feeds a KPI, with a comment forbidding its use to infer `reached` (a voicemail accrues seconds). **That reasoning must survive** into the new contract, where `reached` arrives pre-computed. |
| **F5** | `functions/callActivity/__tests__/` holds `ingestCallActivity.test.js` (669 lines), `outcomeMap.test.js` (221), `resolveCallSource.test.js` (132) and `fakeFirestore.js` (242). Confirm the counts before rewriting - they are the safety this slice must not lose. |
| **F6** | The endpoint is DEPLOYED and live in both projects (prod `updateTime` 2026-08-27T12:29:06.928Z, staging 02:25:27.031Z). Confirm both are still ACTIVE. This changes a live contract, not a draft. |

## Decisions locked (operator rulings, 27 Aug)

1. **KQM normalises; AgencyTrack validates.** The payload carries EFFECTS, not outcome names.
2. **An unrecognised outcome still counts the call** - handled KQM-side. AgencyTrack now receives a
   small CLOSED contract, so its rejections get stricter, not looser: an invalid effect combination
   is a 400.
3. **`followUp` is decided KQM-side** by a `next_at` lookback, and arrives as `bucket: "followUp"`.
   AgencyTrack does not re-derive it.

## The new contract

```
POST /ingestCallActivity
Authorization: Bearer <call-source token>

{ sourceApp: "kqm-calls",
  sourceId:  <crm.activities.id>,
  occurredAt: <ISO-8601 with offset>,
  lane:      "newBusiness" | "servicing",
  bucket:    "cold" | "referral" | "followUp" | null,
  reached:   boolean,
  booking:   boolean,
  newName:   boolean,
  ffi:       boolean,
  rawOutcome:  "<KQM's own value>",
  rawCampaign: "portfolio_2026",
  durationSec }
```

`rawOutcome` and `rawCampaign` are **stored on the ingest record and NEVER scored.** They exist so a
disputed number can be traced to what the agent actually clicked. Storing them is not the same as
trusting them, and nothing may branch on their values.

## The effect model - the whole of the new mapping

| Input | Effect |
|---|---|
| `lane: "newBusiness"` | `dials` +1, and `dialsByType[bucket]` +1 |
| `lane: "newBusiness"` + `reached` | `telContacts` +1 |
| `lane: "servicing"` | `serviceCalls` +1 |
| `lane: "servicing"` + `reached` | `serviceContacts` +1 |
| `booking` | `appointmentsSet` +1 |
| `newName` | `newNamesAdded` +1 |
| `ffi` | `ffisScheduled` +1 |

**Decision 4 survives mechanically:** a servicing call that reaches the client writes
`serviceContacts`, never `telContacts`, because the lane decides which contact field moves. That is
the same orthogonality slice B built, expressed in one table instead of two.

## Watch items - these are where this slice will bite

- **`bucket` must be null exactly when `lane` is `servicing`, and non-null exactly when it is
  `newBusiness`.** Reject any other combination with a 400. This is the partition invariant moved to
  the boundary: a servicing call with a bucket would break the sum, and a new-business call without
  one would leave `dials` and `dialsByType` disagreeing. **Assert it, do not assume KQM gets it right.**

- **THE PARTITION PROPERTY TEST MUST SURVIVE.** Slice B property-tested that the four `dialsByType`
  buckets always sum to `dials` (300 sequences, seed `20260826`). Rewrite it against the new input
  shape - do not delete it. It is the only thing standing between a partition and a set of tags.

- **BOTH IDEMPOTENCY MUTATIONS MUST SURVIVE.** Deleting the guard must red exactly the idempotency
  tests; moving the check OUTSIDE the transaction must leave the sequential replay tests GREEN and
  red only the concurrent ones. That second mutation is the one that proves the concurrent test is
  load-bearing, and a suite without it certified a double-counting endpoint. **Re-run both and report
  observed counts - do not claim results you have not produced.**

- **`ffi` and `booking` are independent booleans now.** In slice B only `portfolio_review_booked`
  carried both. Under the new contract KQM could send `ffi` without `booking`. Decide and document
  whether that is legal; if it is not, reject it rather than silently writing a half-state.

- **Do not let `reached` be inferred from `durationSec`.** F4's comment exists because a voicemail
  connects and accrues seconds. The temptation grows once `reached` is an input someone might want to
  sanity-check. Carry the comment forward.

- **Deleting from `outcomeMap.js` needs F1 first.** If `CALL_OUTCOMES` or `OUTCOME_KEYS` are consumed
  anywhere else - a UI picker, a doc generator - deleting them breaks that consumer silently.

## File inventory (scope-lock)

```
functions/callActivity/outcomeMap.js              shrink to an effect validator; keep CAMPAIGN/BUCKET
                                                  constants only if F1 proves outside consumers
functions/callActivity/ingestCallActivity.js      validatePayload accepts effects; applyCall drives
                                                  off the effect table; store rawOutcome/rawCampaign
functions/callActivity/__tests__/                 rewrite against the new contract; partition property
                                                  and BOTH idempotency mutations survive
docs/CONTEXT.md, docs/FOLLOW_UPS.md               Phase 4 only
```

**NOT in scope:** the KQM repo (that is C1), `resolveCallSource.js` (auth is unchanged), the
`referralsObtained` guard, the UM/BM nav entry, Daily Capture steppers.

## Named deliverables

- **A lane/bucket coherence test:** `servicing` + non-null bucket is a 400; `newBusiness` + null
  bucket is a 400. Both directions.
- **The partition property test, rewritten and still passing** at the same seed.
- **Both idempotency mutations re-run, with observed pass/fail counts reported**, not asserted.
- **A test proving `rawOutcome` and `rawCampaign` are stored but never scored** - vary them across
  otherwise identical calls and assert the KPI deltas are identical.
- **A servicing-lane test proving `telContacts` does not move** (decision 4, mechanically).
- **`firebase deploy --only functions:ingestCallActivity` to BOTH projects**, verified with
  `gcloud functions describe` rather than the CLI summary - the deploy log emits `failed to update`
  warnings it never withdraws.
- **Re-run `scripts/verification/smoke-ingest-call-activity.mjs` after deploying to staging.** It
  currently posts the OLD shape and must be updated in this slice - it is the only end-to-end proof
  the endpoint works, and leaving it posting a dead contract silently retires it.
- **Post-merge fill** with the squash SHA.

## Note for the record

This changes a contract that was proven against a real Firestore hours earlier. That proof is not
wasted - the transaction, idempotency and TT-date machinery are untouched, and only the shape of what
arrives changes. But the tests that made it safe are being rewritten, and **that is exactly where the
safety could quietly leak out.** The mutation verifications are not ceremony; they are the reason
anyone can trust the numbers this endpoint writes into agents' reports.
