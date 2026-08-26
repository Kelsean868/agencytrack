# Kickoff brief - `ingestCallActivity`, slice B: the endpoint that consumes the token

**Drafted:** 26 August 2026 · **Merge channel:** HUMAN-MERGE (new public surface + KPI writes)
**Model:** Opus 5 · **Effort:** high
**repomix:** pack FULL - touches `functions/`.
**Deploy gate:** adds a Cloud Function AND touches the rules-adjacent aggregator contract.
`firebase deploy --only functions` is a named deliverable.

---

## Why this exists

Slices A and A-prime built the link and its lifecycle: an agent attaches their calling software,
a token is minted, the link names whose KPIs move. **Nothing reads that token yet.** Slice B is the
first thing that does.

One HTTP request per call, from KQM Calls into AgencyTrack. The request carries a bearer token and
an outcome; the endpoint resolves the token to a call source, maps the outcome through one table,
and bumps that day's `dailyActivity`. `aggregateDailyToWeekly` does the rest - fill the daily doc
and the weekly KPIs build themselves.

**This is the slice where a wrong decision becomes wrong DATA.** A and A-prime could be reversed in
an afternoon because nothing depended on them. From B onward, a mapping error writes numbers into
agents' reports, and numbers are much harder to take back than code.

## Phase 0 - audit of what actually shipped

Verify each of these against source before building. If any has moved, **STOP and wait for
dispatcher** (Rule 17).

| # | Finding to confirm |
|---|---|
| **F1** | `functions/callSources/createCallSource.js:77-87` writes the source doc: `tenantId`, `sourceApp`, `sourceUserId`, `creditUid`, `label`, `tokenHash`, `expiresAt`, `createdBy`, `createdAt`. **`tokenHash` is SHA-256 of the raw token; the raw token is never stored.** Resolution is therefore hash-the-presented-token then look it up - never a plaintext compare. |
| **F2** | `functions/kiosk/validateToken.js` is the existing `onRequest` token-validator pattern. **Read it before writing a new one.** Slice A already reused its create/revoke shape; B reuses its validate shape. A second hand-rolled auth path is how the two drift. |
| **F3** | `firestore.rules:256-259` - `dailyActivity` is writable **only** by the owning agent. The endpoint must use the **Admin SDK**, which bypasses rules. This is why it is a Cloud Function and not a client write. |
| **F4** | `src/lib/schema/dailyActivity.js` v2 carries `dials`, `dialsByType {cold, referral, followUp, seminarTradeshow}`, `telContacts`, `appointmentsSet`, `ffisScheduled`, `newNamesAdded`, `serviceCalls`, `serviceContacts`, `referralsObtained`. Confirm the exact names - the endpoint writes these and nothing else. |
| **F5** | `functions/aggregators/dailyToWeekly.js:182` and its ESM twin omit `serviceCalls`/`referralsObtained` when the daily sum is 0. **See the residual section below - this slice is the trigger condition.** |
| **F6** | Confirm whether the aggregator skips weeks whose weekly report is already submitted. The late-arrival decision below assumes it does NOT re-derive a submitted week. **If it does, decision 3 needs re-ruling - surface it, do not paper over it.** |

## Decisions locked (operator rulings, 26 Aug)

1. **`dialsByType` is a PARTITION.** Every call lands in exactly one bucket and the four sum to
   `dials`. Not a set of tags. A call that could be two things is one thing, by the precedence in
   decision 2.

2. **`followUpCalls` means a DUE CALLBACK, and nothing else.** A call is `followUp` when it fulfils
   a scheduled callback in `crm.activities`. A redial of a no-answer stays in its campaign bucket.
   **Rationale to preserve:** a follow-up is a promise kept, not a retry. Counting redials as
   follow-ups inflates `followUpCalls` against `coldCalls` and quietly destroys `coldCalls` as a
   measure of new-name attempts.

3. **A call landing in an already-submitted week writes the daily doc, never the weekly.** The daily
   doc records what actually happened - that is the truth of the day, and dropping it is the exact
   failure Ruling D3 objected to. The submitted weekly stays **exactly as the agent signed it**. The
   discrepancy is recorded so it is visible rather than silent. **Never silently move a number an
   agent submitted and a manager may already have read.**

4. **A Portfolio call that reaches the client does NOT count toward `telContacts`.** It writes
   `serviceCalls` (attempted) and `serviceContacts` (reached), and stops there. `telContacts` keeps
   meaning "people reached about new business". This closes the question D-SC deliberately left open.

5. **A producing UM/BM counts as "an agent"** (operator ruled). This does not affect B's endpoint -
   it is recorded here because it closes the MEDIUM banked by #919, and whoever picks that up should
   know it is decided. **It is NOT in this slice's scope** - see the scope-lock note.

## The mapping - ONE table, and it lives in ONE place

| KQM Calls outcome | reached | AgencyTrack effect |
|---|---|---|
| No answer · Wrong number · Number out of service | no | `dials` +1 |
| Gatekeeper blocked | yes | `dials` +1, `telContacts` +1 |
| Not interested · Already has a plan · No budget | yes | `dials` +1, `telContacts` +1 |
| Callback scheduled · Send info by email | yes | `dials` +1, `telContacts` +1 |
| Principal interested · Approved in principle · Parent list promised | yes | `dials` +1, `telContacts` +1 |
| Meeting booked · Orientation slot offered | yes | `dials` +1, `telContacts` +1, `appointmentsSet` +1 |
| Referred to Board/PTA · Referred to another person · Not the decision maker | yes | `dials` +1, `telContacts` +1, `newNamesAdded` +1 |
| Do not call requested | yes | `dials` +1, `telContacts` +1 |
| Portfolio - review booked | yes | `serviceCalls` +1, `serviceContacts` +1, `appointmentsSet` +1, `ffisScheduled` +1 |

**`reached` is TRUE for "Not interested".** They answered and said no. That is a contact, an
unsuccessful one. `src/lib/schema/callRecord.js` already rules this way; conflating "did not want
it" with "did not answer" undercounts contacts the agent genuinely made.

**Campaign decides the bucket, outcome decides the effect.** Schools / Group benefits / Religious
houses → `cold`. Referrals campaign → `referral`. Due callback → `followUp` (decision 2). Portfolio
→ the service fields, and per decision 4 **not** `telContacts`.

**Nothing else on the weekly report comes from a phone call.** API, apps, lives, hours, F2F, social,
letters are out of scope. The endpoint must not touch them.

## The endpoint contract

`POST /ingestCallActivity` - `onRequest`, us-central1.

```
Header  Authorization: Bearer <raw call-source token>
Body    { sourceApp:   "kqm-calls",
          sourceId:    <crm.activities.id>,   // idempotency key
          occurredAt:  <ISO-8601 with offset>,
          campaignCode, outcome, durationSec }
```

**No agent identity in the payload. Ever.** The token resolves to a `callSources` doc, that doc
carries `creditUid`, and that is whose KPIs move. This is the same principle A-prime enforced on
creation, and for the same reason: identity that travels in a request body is identity a typo or a
tampered field can redirect. If the body contains `creditUid`, `agentEmail`, `uid` or `tenantId`,
**reject with 400** rather than ignoring it.

## Watch items - these are where this slice will bite

- **The TT date trap.** The daily doc ID is `YYYY-MM-DD` in **Trinidad time (UTC-4)**, and the
  codebase anchors to noon UTC to avoid drift (`isWeekendDate`, `dailyToWeekly.js:30`). A call at
  20:30 TT on the 26th is 00:30 UTC on the **27th**. Deriving the date from `occurredAt` in UTC puts
  the call on the wrong day, and near month-end on the wrong month. Convert to TT first, then format.
  **Write the test for a 21:00 TT call before writing the conversion.**

- **Idempotency is not optional, it is the delivery model.** Supabase webhooks retry. The offline
  outbox replays on sync. Store each call under `sourceApp + sourceId` and make the KPI bump
  conditional on that record not already existing, **inside the same transaction as the bump**.
  Checking first and writing second leaves a window where two retries both pass the check.

- **Increment, do not read-modify-write.** Two calls landing in the same second must both count. Use
  `FieldValue.increment()` inside a transaction, never a read-then-set of the whole doc.

- **A token that is expired or revoked must fail CLOSED.** `expiresAt` in the past or `revokedAt`
  set → reject, do not "fail open and count it anyway". And answer a bad token with the SAME
  response as an unknown one, so the endpoint cannot be used to enumerate valid tokens.

- **Never log the raw token, or echo it in a response or error.** Log the source doc ID. The raw
  token is unrecoverable by design and must stay that way in the logs too.

- **This is a PUBLIC unauthenticated surface** in the sense that anyone can POST to it. Rate-limit
  per source doc, cap body size, and reject unknown `outcome` values loudly rather than mapping them
  to zero. An unmapped outcome silently counted as a dial is a data defect that looks like a
  rounding error for months.

## ⚠ The omit-when-zero residual lands HERE, not on slice C

`docs/CONTEXT.md` and the bridge design both say the guard is safe "only while nothing writes those
two fields daily", and sequence its retirement after C. **That sequencing is wrong, and this brief
corrects it.** The trigger condition is a daily writer, and **this slice is the daily writer** - the
moment a Portfolio call writes `serviceCalls`, a week with genuinely zero service calls sums to 0,
the aggregator omits the key, and a stale agent-typed weekly value survives instead of being
corrected to zero.

**In scope for B:** `serviceCalls` only - the field this slice actually starts writing.
`referralsObtained` is NOT written by this mapping (referrals map to `newNamesAdded`), so its guard
stays until something writes it. Retire half the guard, deliberately, and say so in the code where
the other half remains.

If Phase 1 finds the mapping does write `referralsObtained` after all, **STOP and wait for
dispatcher** - that changes the scope of the guard retirement.

## File inventory (scope-lock)

```
functions/callActivity/ingestCallActivity.js      new - the endpoint
functions/callActivity/resolveCallSource.js       new - hash, look up, validate expiry/revocation
functions/callActivity/outcomeMap.js              new - THE mapping table, one place only
functions/callActivity/__tests__/                 new - see named deliverables
functions/index.js                                export the new function
functions/aggregators/dailyToWeekly.js            retire the serviceCalls half of omit-when-zero
src/lib/schema/dailyActivity.aggregator.js        the ESM twin - keep them identical
docs/CONTEXT.md, docs/FOLLOW_UPS.md               Phase 4 only
```

**NOT in scope, do not touch:** the UM/BM nav entry (decision 5 - its own slice), the KQM Calls repo
and its webhook (slice C), Daily Capture steppers (slice D), `firestore.rules` (the endpoint uses
the Admin SDK and needs no rules change).

## Named deliverables

- **A TT-midnight boundary test.** A call at 21:00 TT lands on that TT date, not the following UTC
  date. Include a month-end case (31 Aug 21:00 TT must not land in September).
- **An idempotency test that replays the SAME `sourceId` twice** and asserts the KPI moved once.
  Then a concurrent variant - two simultaneous deliveries of the same `sourceId` - because the
  sequential test passes against a check-then-write implementation that the concurrent one breaks.
- **A partition property test:** for any sequence of calls, the four `dialsByType` buckets sum to
  `dials`. This is decision 1 made mechanical.
- **A rejection test per failure mode:** expired token, revoked token, unknown token, unknown
  outcome, identity field present in the payload. Each must fail closed, and expired/revoked/unknown
  must be indistinguishable to the caller.
- **A late-arrival test:** a call dated inside a submitted week bumps the daily doc and leaves the
  submitted weekly untouched (decision 3).
- **Mutation-verify the idempotency guard.** Remove it; exactly the idempotency tests must go red
  and nothing else. Same discipline that proved slice A-prime's cross-credit rejection.
- **`firebase deploy --only functions`**, output captured in the PR. Confirm the `released`/create
  lines for the new function specifically, and verify with `gcloud functions describe` rather than
  trusting the CLI summary - the deploy log emits `failed to update` warnings it never withdraws.
- **Staging smoke:** POST a real call through the deployed endpoint using a token minted by the
  staging UI, and see the agent's daily numbers move. Run
  `scripts/verification/cleanup-staging-call-sources.mjs` afterwards. Staging only.
- **Post-merge fill** with the squash SHA.

## Note for the record

Slice A-prime's lesson applies directly here: **the shape that makes a mistake impossible beats the
check that catches it.** Identity comes from the token, not the payload. The bucket is a partition,
not a set of tags. Idempotency lives in the transaction, not beside it. Each of those removes a
class of defect rather than guarding an instance of one.
