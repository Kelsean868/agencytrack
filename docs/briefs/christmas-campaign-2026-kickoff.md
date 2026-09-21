# Christmas Campaign and Retreat 2026 - build brief (Rev 2)

**Rev 1 written 3 September 2026; operator rulings R1-R4 taken 6 September 2026. Rev 2 written 20 September 2026** after the signed PDF was re-read end to end and the live ledger was queried. Rev 2 supersedes Rev 1; where they differ, Rev 2 wins.

**Source of truth:** `Christmas Campaign and Retreat 2026 -- 02 Sept 2026 FINAL for Sales Force - Signed.pdf`, 9 pages, signed by Garvis Ryan (Manager, Sales Administration), Amery Rauseo (Executive, Business Development) and Anthony Shaw (General Manager). Read in full for Rev 2 - every rule quoted below is from that document, not from a summary of it.

**Companion:** `persistency-24-month-model-brief.md`. Its P1 is on `main` (PR #937), so C1's dependency is already satisfied.

**Target repo:** this one only.

---

## 0. Ground truth - the live ledger, queried 20 September 2026

Read-only Admin SDK count against `tenants/tatillife_south/policies` (`verification/campaign-window-count.mjs`, gitignored by design):

| Fact | Value |
|---|---|
| Policy docs in the tenant | **229** |
| Of those, `importSource == 'oipa_import'` | **229 - all of them. There are zero organic policies.** |
| `dateIssued` missing | 0 |
| `dateIssued` inside 2026-07-01 .. 2026-12-31 | **5** (2 in July, 3 in August) |
| Those 5 by status | settled 4, ntu 1 |
| Those 5 by type | `nb_ordinary` 5 |
| Those 5 by origin | **`oipa_import` 5 - none organic** |
| `isSelfOrFamily` among them (Rule 3) | 1 |
| Rule 7 credit as it stands | **3 net apps, TTD 73,946.28 net API** |

**This is the finding that shapes the whole build.** PR #948 (P2b) filters imported policies out of `CampaignLensPanel` so that an imported historical book cannot earn campaign credit retroactively. The intent was right. The mechanism is wrong: **100% of the operator's campaign-window production is imported**, so the filter as written hides the entire campaign, and the lens would render TTD 0 / 0 apps while the ledger holds 3 apps and TTD 73,946.28. A surface reporting zero production to an advisor who has production is the same class of defect as the ×0 multiplier bug fixed in #871 - a confident wrong number about money.

**Second consequence, to be surfaced not hidden:** with no organic policies in the ledger, the campaign readout is only ever as current as the last OIPA export (15 Sep 2026). Business sold in September and not yet issued does not exist in the ledger. The campaign surfaces must carry the export date, exactly as the persistency card already does ("From portfolio import, 15 Sep 2026").

---

## 1. The campaign, as the signed document states it

| Item | Value | Page |
|---|---|---|
| Qualifying period | 1 July 2026 - 31 December 2026 | 2 |
| Retreat | Costa Rica, four nights, April 2027 | 2 |
| Company targets | Settled API during the campaign TTD 28.0M (NB + increased PPPs). By 31 Dec 2026: TTD 30,300,000 (NB & increased premiums); TTD 40,400,000 (NB, increases & lumpsums); 24-Month Persistency 90% | 2 |
| Rule 1 | Campaign period 1 Jul - 31 Dec 2026 | 3 |
| Rule 2 | All applications MUST be **settled by 31 Dec 2026**. No manual credit | 3 |
| Rule 3 | No credit (application or API) for policies on oneself, spouse or children | 3 |
| Rule 4 | Replacement credit = difference between new API and replaced API. **No application count** | 3 |
| Rule 5 | **24-Month Persistency at the Final Month (December 2026). `>= 90%` = 100% of prize. `< 90%` = Disqualified.** Applies to ALL categories and to both cash AND accommodation | 3 |
| Rule 6 | Eligible: Salespersons, PPGAs, Trainee Unit Managers, Unit Managers, Agency Managers, Direct Sales (BDOs, DSOs, Team Lead) | 3 |
| Rule 7 | Production credit applies to policies **in force as at 31 Dec 2026**, per the table below | 3 |
| Rule 8 | A policy written in-period and then increased in-period earns **no extra app**, only the increased API. An in-period increase to a policy written **before** the period earns **one** app if `>= TTD 2,400` API, **once only** however many further increases follow | 4 |
| Rule 9 | Policies lapsed, terminated or not taken within the first three months after the period (by **March 2027**) trigger recalculation of the category and claw-back of the prize | 4 |
| Rule 10 | This campaign **overrides all other campaigns and incentives in progress** - no cash for Agent of the Month or Agent/Manager of the Quarter. Recognition only | 4 |
| Rule 11 | **Where there is any ambiguity, the decision of the Executive Business Development is final** | 4 |
| Close of business | All policies must be **issued** by 31 Dec 2026; submitted-but-not-issued does NOT count. Final on-track report 12 Jan 2027; queries close 14 Jan 2027 | 4 |
| Prizes | Retreat cash paid in a separate payroll, January 2027 | 4 |

**Rule 5 has exactly two rows. There is no partial band, no sliding scale, and no 85-89% half-prize.** The bands currently in `campaignEngine.js` (`>=90 x1.0`, `85-89 x0.5`, `80-84 x0.25`, `<80 DQ`) come from the PREVIOUS campaign and are a year out of date. They must not be applied to this one.

**Rule 7 - production credit table (page 3, verbatim):**

| Production Category | Applications Credit | API Credit |
|---|---|---|
| Net Settled Ordinary Business | 100% | 100% |
| Increase PPPs `>= $2,400.00` | 100% | 100% |
| Replacements (replacing UL for WL) | 0% | Difference in API, old policy to new |
| S.P.I.A. | 0% | 0% |
| Lump Sums | 0% | 0% |
| Platinum Edge | 100% | 0% |

**Table 1 - advisor levels (page 5). Cash AND a retreat room; Rule 5 gates both:**

| Level | Rank | Net API (TTD) | Net Apps | Cash (TTD) | Retreat category |
|---|---|---|---|---|---|
| 5 | Pioneer | 825,000 | 35 | 70,000 | Double |
| 4 | Elite | 675,000 | 35 | 52,000 | Double |
| 3 | Premier | 475,000 | 35 | 30,000 | Single |
| 2 | VIP | 375,000 | 35 | 20,000 | Single |
| 1 | Champion | 275,000 | 35 | 7,000 | Shared |

Double = may bring one guest. Single = the qualifier only. Shared = paired with another Shared qualifier.

**Table 2 - manager accommodation (page 7).** Managers are Agency Managers, Unit Managers and the Direct Sales Team Leader. Trainee UMs are excluded. A manager is paid cash **only** as an advisor (Table 1) and takes the **higher** accommodation of Table 1 and Table 2:

| Manager | Qualifying agents (excl. the manager) | Personal API | Personal Apps | Retreat category |
|---|---|---|---|---|
| Agency Manager | 5 | 0 | 0 | Double |
| Agency Manager | 3 | 0 | 0 | Single |
| Unit Manager | 2 | 275,000 | 35 | Double |
| Unit Manager | 2 | 0 | 0 | Single |
| Unit Manager | 1 | 275,000 | 35 | Single |
| Team Leader | 2 | 275,000 | 35 | Double |
| Team Leader | 2 | 0 | 0 | Single |
| Team Leader | 1 | 275,000 | 35 | Single |

**General rules (page 8) that change behaviour and therefore belong on screen:**

1. A qualifier must **still be contracted to Tatil Life at the time the retreat is held**. No retreat payment forms part of a separation package.
2. An agent **promoted during the period** is assumed to retain their original position for the campaign, but this does not prevent qualifying under the new position.
3. A qualifier who **cannot attend receives the cash only** - no transfer, no substitution.
4. A Single qualifier may bring a guest **at their own expense**, prepaid to the company in writing.
5. Single/Double qualifiers **may not transfer a room** to a Shared qualifier.
6. **Production credit may not be transferred** between agents.
7. Guests must be 18+ and accompanied by the qualifying agent.

Retreat logistics (medical questionnaire, liability waiver, travel documents, credit card at travel) are not app concerns and stay out of scope.

---

## 2. What exists today (verified in source, 20 Sep 2026, `main` at `681d36b5`)

- **Campaign docs** at `tenants/{tenantId}/campaigns/{id}` (`campaignService.js`): `name, startDate, endDate, scope {type, unitIds, agentIds}, targets[], structure: 'qualify'|'placement'|null, tiers[{level, name, api, apps, cash, voucher}], placements[], standingsMetric, persistencyGateEnabled`. Rules on `/campaigns` police roles only, no field validation - new fields need **no rules change and no deploy**.
- **`src/utils/campaignEngine.js`**: `PERSISTENCY_GATE_BANDS` (last year's four bands), `GATE_BAND_RANGE_LABELS`, `gateBandFor(pct)`, `persistencyPctForPeriod(records, start, end)` (SUM-aggregate over the campaign months; `null` when no record), `resolveTier`, `isTieredCampaign`, `campaignYears`, `computeStandings` (ranks from **weekly submissions**, applies the band multiplier to cash/voucher), `computeCampaignProgress`, `getDaysRemaining`. Display only - nothing writes a payout. **No `normalizeGate`, no final-month basis, no accommodation, no credit table, no clawback - confirmed by grep, not assumed.**
- **Gate consumers:** `CampaignPanel.jsx`, `CampaignStandings.jsx`, `MeetingMode.jsx` `CampaignScene`, `kiosk/panels/CampaignLeaderboardPanel.jsx`, plus `companyConfigRegistry.js` § CAMPAIGN PERSISTENCY GATE (four `rec.gate.*` rows citing `campaignEngine.js` by line number, pinned by the parity test).
- **`src/lib/policyCampaignLens.js`** (flag `policyLedgerCampaignLens`): classifies each policy counts / pending / excluded for one campaign. Excludes `isSelfOrFamily` and non-Life; windows on `dateSubmitted ?? dateWritten`; values by `policyValue()`. **No production-credit table** - every counting policy is 1 app + 100% API.
- **`src/lib/portfolioImport/excludeImported.js`** (PR #948): filters `importSource == 'oipa_import'` out of the aggregating readers, `CampaignLensPanel` among them. See C-D10.
- **The ledger already carries the campaign's categories.** `policiesService.js` `VALID_NEW_BIZ_TYPES = ['nb_ordinary','inc_ppp','replacement','spia','lumpsum','platinum_edge']`, `replacedPolicyAPI`, `isSelfOrFamily`, `dateIssued`, statuses `lapsed`/`ntu`/`denied`. The Rule 7 table maps 1:1.
- **Awards:** `awardsEngine.js` + `awardsRuleset/2026.js`. No notion of a campaign suppressing cash.
- **Roles:** `agent, unit_manager, branch_manager, sales_manager, cro, tenant_admin, platform_admin`. No `trainee_unit_manager`, no `ppga`, no `team_leader`.

---

## 3. Decisions locked - do not re-litigate

| # | Decision | Rationale |
|---|---|---|
| C-D1 | **The gate becomes per-campaign config with two modes; legacy campaigns keep their behaviour byte-for-byte.** `campaign.persistencyGate = { mode: 'bands'\|'binary', threshold: 90, basis: 'periodAggregate'\|'finalMonth' }`. Absent -> `{ mode: 'bands', basis: 'periodAggregate' }`. Christmas 2026 -> `{ mode: 'binary', threshold: 90, basis: 'finalMonth' }`. | Last year's campaign had bands; this one has a cliff. Rewriting the shared constant would silently re-grade any campaign still open. |
| C-D2 | **`finalMonth` reads ONE monthly record - `monthKey === endDate.slice(0,7)` - and abstains (`null`) when absent.** Never falls back to the period aggregate. | Rule 5 says "at the Final Month". A six-month aggregate is a different number and can land an advisor on the other side of the cliff. `null` renders the existing no-data pill at x1: neither paid on a fabricated figure nor disqualified by one. |
| C-D3 | **Standings stay on weekly submissions. The production-credit table lands in the policy lens.** | `computeStandings` is the manager's ranked view fed by settlement-confirmed weekly numbers; the lens is the agent's per-policy view and the only place the app knows `newBusinessType`. Moving standings onto the ledger is a data-source change with its own brief (banked, §5). |
| C-D4 | **Accommodation is a tier attribute, not a prize.** `tier.accommodation: 'shared'\|'single'\|'double'\|null`. Cash stays in `tier.cash`. | Table 1 is cash plus a room per level. The room is not money and must never be multiplied by the gate multiplier - Rule 5 either grants it whole or removes it. |
| C-D5 | **Manager qualification (Table 2) is derived and displayed; nothing is stored.** `branch_manager` -> Agency Manager, `unit_manager` -> Unit Manager. Team Leader is not modelled (no role exists); its rows live in config and are skipped with an on-screen reason. | Same display-only contract as every other campaign number. Inventing a role for one campaign is out of scope. |
| C-D6 | **Rule 9 clawback is a FLAG on a standing, never a recalculation.** `campaign.clawbackUntil: '2027-03-31'`; a counting policy that reaches `lapsed`/`ntu` between `endDate` and `clawbackUntil` marks the standing "subject to recalculation" and names the policies. The app never re-ranks and never zeroes a prize. | The recalculation is Sales Administration's, on Tatil's books. The app's job is that nobody is surprised in March. |
| C-D7 | **Rule 10 is a copy change in awards, not an engine change.** `campaign.suppressesAwardCash: true`; for months inside the window, Advisor of the Month and Quarterly awards render `prize` as "Recognition only - cash suspended by <campaign name>". Eligibility untouched. | The awards are still won; only the cash is withheld. Removing eligibility would erase the recognition the document explicitly keeps. |
| C-D8 | **Rule 8's first clause is NOT enforced.** An `inc_ppp` record `>= 2,400` in-window earns one app. | The ledger has no link from an increase to the base policy, so the two cases are indistinguishable. Needs a `basePolicyId` field - banked, §5. Operator accepted the over-count (R3). |
| C-D9 | **Nothing in this brief writes money.** Every figure is projected and display-only. The mockup's "Confirm & release" close-flow stays unbuilt. | Standing contract. |
| **C-D10** | **Campaign eligibility is decided by `dateIssued` + status + `isSelfOrFamily` - NEVER by `importSource`. This amends PR #948 for the campaign path only.** In `policyCampaignLens.js`, replace the origin filter with the window test: a policy counts when its `dateIssued` falls in `[startDate, endDate]` **and** its status is `settled`/`confirmed` **and** it is not self/family. An imported policy issued 15 Aug 2026 and in force **counts**. An imported policy issued in 2019 does not - because of its **date**, not its origin. `excludeImported` stays in force unchanged for every OTHER aggregating reader (CRO Delivery Register, `getPoliciesForManager`, `useMyProduction`, `AgentAwardsPanel`, financing). | The §0 query settles it: all 5 campaign-window policies are imported and there are no organic policies at all, so the origin filter hides 100% of the operator's campaign production and would render TTD 0. #948's stated risk - a historical book earning credit retroactively - is fully answered by the date window, which is also what the signed document actually tests (Rule 2, Rule 7, Close of Business). Origin was a proxy for age; the date is the thing itself. |
| **C-D11** | **Every campaign surface carries the portfolio export date.** The agent-facing readout is stamped "As at <export date>" using the same provenance the persistency card already reads (`ledgerExportDate`), with a line stating that business issued after that date is not yet included. | With zero organic policies, the ledger is a snapshot, not a live feed. A campaign figure presented without its as-at date invites the advisor to read a stale number as current - and to conclude they are further from Champion than they are, or closer. |

Plus everything in `docs/CONTEXT.md` § Locked decisions.

---

## 4. Slices

Build in this order. One branch, one PR each. Build to PR-open and HOLD for human merge (Rule 19).

### Slice C1 - the gate: mode + basis

**Model: Opus 5, high effort.** Payout arithmetic across four surfaces that must agree.

1. `campaignEngine.js`:
   - `normalizeGate(campaign)` -> `{ mode, threshold, basis }` with the C-D1 defaults. Exported; every consumer resolves through it, never by reading `campaign.persistencyGate` directly.
   - `persistencyPctAtFinalMonth(records, endDate)` -> whole-number percentage of the single record whose `monthKey === endDate.slice(0,7)`, else `null`. Uses `record.persistency` (decimal) x 100, rounded as `persistencyPctForPeriod` rounds.
   - `persistencyPctForGate(records, campaign)` -> dispatches on `basis`. **The only function consumers call.** `persistencyPctForPeriod` stays exported for its tests and legacy callers.
   - `gateBandFor(persPct, gate)` gains the gate argument. `bands` -> today's lookup, unchanged. `binary` -> `{ min: threshold, payout: 1, label: '100%', tone: 'success' }` or `{ min: 0, payout: 0, label: 'DQ', tone: 'danger' }`. `null` in -> `null` out, both modes.
   - `computeStandings` resolves the gate once via `normalizeGate` and threads it into `gateBandFor`. Signature unchanged.
   - `GATE_BAND_RANGE_LABELS` becomes a function of the gate; binary yields `['>= 90%', '< 90%']`.
2. Consumers - `CampaignPanel.jsx`, `MeetingMode.jsx` `CampaignScene`, `CampaignLeaderboardPanel.jsx`, `CampaignStandings.jsx`: swap `persistencyPctForPeriod(...)` for `persistencyPctForGate(records, campaign)` and thread the gate into every `gateBandFor`. The band ladder renders two rows for a binary gate.
3. Builder form (`CampaignPanel.jsx`): under the existing gate toggle add *Gate style* (Tiered bands / Single threshold) and *Read persistency* (Average over the period / Final month only), with a threshold input shown for Single threshold. Defaults must produce a doc with **no** `persistencyGate` key, so an untouched edit round-trips byte-identical.
4. `companyConfigRegistry.js` § CAMPAIGN PERSISTENCY GATE: re-point the four `rec.gate.*` line-number citations after the move; add that these bands apply to `mode: 'bands'` campaigns only and that a campaign may declare a single threshold instead.

**Deliverable - evidence paste-back:** a unit-test table in the PR body for one fixture agent with records `2026-07 .. 2026-12`, giving the resolved band under all four combinations (`bands/periodAggregate`, `bands/finalMonth`, `binary/periodAggregate`, `binary/finalMonth`) where the December record is `0.89` and the six-month aggregate is `0.91`. **The two bases must disagree on that fixture; the disagreement is the point.**

### Slice C2 - Table 1 and the retreat readout

**Model: Sonnet 5, medium effort.**

1. `campaignService.js` `sanitizeTiers` passes `accommodation` through as `'shared'|'single'|'double'|null` (anything else -> `null`).
2. Builder tier row gains an *Accommodation* select (None / Shared / Single / Double). `addTier` seeds `accommodation: null`.
3. **The retreat is a first-class readout, not a pill.** The agent-facing campaign card shows two things at once: the cash the advisor is on for, and the room they are on for, plus the distance to the next room. Wording is plain: "Costa Rica, April 2027 - you are on for a **Shared** room. TT$100,000 more API and 12 more apps moves you to **Single**." The gate state is stated alongside it in the same breath, because Rule 5 removes the room as well as the cash: at `< 90%` the card reads "Disqualified - cash and retreat", never a reduced figure.
4. `CampaignStandings.jsx` ladder and rows, and the kiosk panel, show the room beside the cash.
5. `resolveTier` unchanged - accommodation never affects qualification.
6. **AMENDED 20 Sep 2026, after C3 merged - the target must be the level in reach, not the ladder's ceiling.** C3 takes BOTH `apiTarget` and `appsTarget` in `derivePolicyLens` from the campaign's **top** tier (Christmas 2026: Pioneer, 825,000/35). Pairing them was right - C3 fixed a genuine inconsistency where apps came from the entry tier while API came from the top - but the ceiling is the wrong denominator for an agent-facing progress figure. On live data today the card reads **TTD 73,946 of 825,000**, about 9%, when the operator is **27% of the way to Champion** (275,000), the lowest level and the one that decides whether he travels at all. Every tier requires 35 apps, so the apps figure is unaffected; the API ceiling is the whole issue. C2 owns the fix because C2 is the slice that introduces distance-to-next-room. Derive and expose **two** tiers, not one: `tierReached` (the highest tier both current figures clear, or `null` when none is cleared yet) and `tierNext` (the next rung up, or `null` at Pioneer). Progress is measured against `tierNext` when one exists, because that is what the advisor is working toward; at Pioneer there is nothing above, so progress is against Pioneer itself and the copy says so. **Never render a percentage against a tier the advisor has not been shown.** Full body in `docs/FOLLOW_UPS.md` under "Campaign lens reads the ladder ceiling, not the level in reach".
7. **There are TWO agent-facing campaign surfaces and they run off different derivations. Do not create a third number.** `HomeV2` renders `CampaignCard`, which uses `computeCampaignProgress` and reads thresholds from `campaign.targets[]`; the policy ledger renders `CampaignLensPanel`, which uses `derivePolicyLens` and reads the tier ladder. They answer different questions today and that is tolerable, but an advisor who sees a retreat room on one screen and a different level implied on the other has been told two things. **Put the retreat readout on `CampaignCard` - the dashboard is where the advisor actually looks - AND make both surfaces resolve "the level you are on for" through the same exported helper**, placed in `campaignEngine.js` beside `resolveTier`, never inside either component. If the two derivations disagree on the tier for the same live account, surprise-stop and report it rather than papering over it in the UI.

**Deliverables:** one screenshot of the builder with the five Table 1 rows entered; one of the rendered ladder; and **one of the agent card showing cash, room, and distance to the next room, with the tier-reached / tier-next pair named in the PR body for the operator's live account** (expected today: no tier reached, next is Champion at 275,000 / 35 apps, current 3 apps / TTD 73,946.28).

### Slice C3 - the production-credit table and the window test

**Model: Opus 5, high effort.** Per-policy money classification, and the C-D10 amendment.

1. `policyCampaignLens.js` gains `creditFor(policy, campaign)` -> `{ apps: 0|1, api: number, reason }`, keyed on `policy.newBusinessType`:
   - `nb_ordinary` -> `{ apps: 1, api: policyValue }`
   - `inc_ppp` -> `{ apps: policyValue >= campaign.credit.incPppAppThreshold ? 1 : 0, api: policyValue }` (default `2400`)
   - `replacement` -> `{ apps: 0, api: max(0, policyValue - replacedPolicyAPI) }`; when `replacedPolicyAPI` is `null`, `api: 0` with `reason: 'Replaced API not recorded'` - never assume zero was replaced
   - `spia`, `lumpsum` -> `{ apps: 0, api: 0 }`
   - `platinum_edge` -> `{ apps: 1, api: 0 }`
   - unknown or absent -> `{ apps: 0, api: 0, reason: 'Unclassified new-business type' }` - abstain, never default to ordinary
   - Configured as `campaign.credit = { table: {...}, incPppAppThreshold: 2400 }` with the Rule 7 values as defaults. **Apply the table only when `campaign.credit` is present**, so legacy campaigns are unchanged.
   - Per R4, this slice makes `replacedPolicyAPI` **required at create** when `newBusinessType === 'replacement'` (`policiesService.validate` + the create form). `firestore.rules` does not validate policy body fields at create beyond what it does today - confirm at Phase 0; if a rules arm does police it, surprise-stop.
2. **The counting window is settlement, not submission (C-D10).** When `campaign.credit` is present, a policy counts only if its status is `settled`/`confirmed` **and** `dateIssued` falls within `[startDate, endDate]`. A settled policy issued after the cut-off is excluded with `'Issued after cut-off'`; one issued before the start is excluded with `'Issued before the campaign'`. The pending bucket keeps its present meaning.
3. **Remove the `excludeImported` call from the campaign path** (`PolicyLedgerPanel.jsx` passes the raw array to `CampaignLensPanel`), and replace the comment block there with the C-D10 rationale. `excludeImported` and its guard test remain in force for every other consumer - do not weaken the shared helper, and do not touch the other call sites.
4. `derivePolicyLens` sums `apps` and `api` separately and exposes both, with the apps target from the tier (35).
5. `CampaignLensPanel.jsx` shows apps and API side by side against their targets, the per-policy reason strings, and the C-D11 export-date stamp.

**Deliverables:**
- A table in the PR body with one fixture per `newBusinessType` (seven rows, including a replacement with `replacedPolicyAPI: null`) and the credit each produces.
- **An evidence paste-back against real production data:** run `verification/campaign-window-count.mjs` and show the lens reproducing its figures for the operator's account - as at this brief, **5 policies in window, 3 net apps, TTD 73,946.28 net API**, with the self/family policy and the NTU each named in the excluded list under their own reason. A lens that cannot reproduce the script's numbers is not finished.

### Slice C4 - manager Table 2, the clawback flag, Rule 10, and the general rules

**Model: Opus 5, high effort.**

1. **Table 2** - `campaignEngine.js` `deriveManagerQualification(campaign, standings, managers, usersByUnit)`:
   - `campaign.managerQualification` carries the eight rows keyed by role (`branch_manager`, `unit_manager`, `team_leader`) with `{ agentsQualifying, personalApi, personalApps, accommodation }`, evaluated highest accommodation first.
   - A qualifying agent = a standings row with `qualified === true` (tier reached **and** gate passed), scoped to the manager's branch or unit, excluding the manager (R2).
   - Personal production = the manager's own standings row when they produce, else `0/0`.
   - Output per manager: `{ asAdvisor: tier|null, asManager: row|null, accommodation: higherOf(...), cash: asAdvisor?.cash ?? 0 }`. Cash is **only** the advisor cash.
   - Rendered as a "Managers" block in `CampaignScene` and `CampaignPanel` standings. `team_leader` rows are skipped with the on-screen note "Direct Sales Team Leader is not modelled".
2. **Rule 9 flag** - `campaign.clawbackUntil` (YYYY-MM-DD). **CORRECTED 20 Sep 2026, verified against `policiesService.js` before dispatch - the field this brief originally named does not do the job.** Rule 9 turns on WHEN THE POLICY ACTUALLY EXITED, not when somebody recorded it, and the service writes three different date-ish things: `statusDate` is a `serverTimestamp()` stamped at CREATE (line 117) and is useless here; `statusUpdatedAt` is a `serverTimestamp()` written on every transition, so it is the RECORDING date; and **`dateLapsed` is an operator-supplied Firestore Timestamp that `lapsePolicy` REQUIRES** ("dateLapsed is required to lapse a policy") - the real-world event date, and the only correct input for a lapse. Use `dateLapsed` for `lapsed`. **For `ntu` there is no event date at all** - a field sweep of the service returns `dateWritten`, `dateSubmitted`, `dateIssued` and `dateLapsed` and nothing else, so an NTU carries only `statusUpdatedAt`. **Do not silently substitute the recording stamp for the event date**: a policy that went NTU in February but was keyed in April would fall outside the window and never be flagged, and the agent would first hear about the claw-back from Sales Administration. Handle it the way C3 handles a missing `replacedPolicyAPI` - include the NTU in `clawbackRisk[]` but mark it `dateBasis: 'recorded'` with the reason "NTU date not recorded - shown on the date it was keyed", so the screen states what it knows and what it is guessing. A lapse uses `dateBasis: 'event'`. **If a `dateNtu`-equivalent field turns up in `firestore.rules` or the schema that this sweep missed, use it and say so - surprise-stop rather than proceeding on the brief's word.** A policy that counted and whose exit date falls in `(endDate, clawbackUntil]` joins a `clawbackRisk[]` list with its credit. The panel shows "N policies lapsed in the claw-back window - Sales Admin will recalculate your level". Standings carry `clawbackRisk: true` only on surfaces that already load policies - **do not add a policies read to `computeStandings`**.
3. **Rule 10** - `campaign.suppressesAwardCash: true`. `awardsEngine.js` takes an optional `activeCampaigns` argument; when a flagged campaign covers the award month or quarter, `advisorMonth` and `quarterlyAward` render `prize: 'Recognition only - cash suspended by <campaign name>'` with a matching `note`. Eligibility, `inContention` and criteria untouched. `AgentAwardsPanel` / `HomeV2` pass the campaigns already loaded via `getActiveCampaignsForAgent`.
4. **The general rules on screen.** A short "Campaign rules that affect you" disclosure on the agent campaign card, carrying items 1, 3 and 6 from §1's general-rules list (still contracted at retreat time; cannot attend means cash only; credit is not transferable), and a footer line: **"Where there is any ambiguity, the decision of the Executive Business Development is final."** Everything the app shows is an indication, never an adjudication - the same honesty contract the TTAIFA work established.

**Deliverables - three evidence paste-backs:** (a) a Table 2 test matrix - an Agency Manager at 5/4/3/2 qualifying agents and a Unit Manager at 2 + personal 275k/35, 2 + 0/0, 1 + 275k/35, 1 + 0/0, expecting Double/Single/Single/None and Double/Single/Single/None; (b) **four** exit fixtures, not two - lapsed-in-window and lapsed-after-window keyed on `dateLapsed`, plus an NTU in-window and an NTU whose `statusUpdatedAt` sits inside the window while the exit plainly did not, each showing its `dateBasis` and reason string; (c) a screenshot of the Awards panel for a July-December month showing the "Recognition only" prize.

### Slice C5 - author the campaign (OPERATOR, no code)

After C1-C4 are on `main`, create the campaign in the builder, scope `branch` (the document is company-wide; one campaign per tenant is the honest shape):

- Name `Christmas Campaign and Retreat 2026`; `2026-07-01` -> `2026-12-31`; structure **Qualify tiers**; standings metric **API**.
- Gate: Single threshold **90**, **Final month only**.
- Tiers (level / name / API / apps / cash / accommodation): 1 Champion 275000 35 7000 shared - 2 VIP 375000 35 20000 single - 3 Premier 475000 35 30000 single - 4 Elite 675000 35 52000 double - 5 Pioneer 825000 35 70000 double.
- Credit table: Rule 7 defaults, `incPppAppThreshold` 2400.
- `clawbackUntil` `2027-03-31`; `suppressesAwardCash` on.
- Manager qualification: the eight Table 2 rows.

The company targets (28.0M / 30.3M / 40.4M / 90%) are **not** campaign fields. They belong wherever the strategic plan holds company targets; if no such field exists, that is a FOLLOW_UPS entry, not a reason to bolt them onto the campaign doc.

**Post-merge ritual:** after each merge, `git fetch origin && git pull origin main && git log origin/main --oneline -5`, then the CONTEXT.md post-merge fill per Rule 16. No `firebase deploy` is expected anywhere in this track - `/campaigns` rules police roles only and no slice touches `functions/`; confirm with `git diff --stat` rather than assuming it.

---

## 5. Out of scope - bank as FOLLOW_UPS

- Standings computed from the settled ledger instead of weekly submissions (C-D3) - "Campaign standings from settled ledger".
- A `basePolicyId` on `inc_ppp` records (C-D8).
- Roles for Trainee UM, PPGA, BDO/DSO, Team Leader (C-D5). `isBdoDso` already exists and is enough for Rule 6, since BDOs/DSOs are eligible here.
- Any payout write, release or payroll export (C-D9).
- Retreat logistics fields - guest registration, medical questionnaire, travel documents.
- **New:** whether the awards and production surfaces should also count imported policies by date rather than excluding them by origin (see §6 Q1).

---

## 6. Open questions for the operator - do not settle by implementation

| # | Question | Why it is not the builder's call |
|---|---|---|
| Q1 | C-D10 fixes the origin-vs-date test for the **campaign** path only. The same argument applies to `AgentAwardsPanel`, `useMyProduction` and the financing surfaces: they exclude imported policies wholesale, and the operator's only policies are imported. Should those also move to a date test, and over which window? | Awards run the full calendar year while the import is the entire historical book, so a wholesale include would inflate them the way the campaign was deflated. The right window per surface is a business judgement, not a code decision. |
| Q2 | Rule 6 lists PPGAs and Trainee Unit Managers as eligible. Neither role exists. Does anything need to distinguish them, or does `agent` cover both for this campaign? | Role modelling for one campaign was ruled out in Rev 1 (C-D5); confirming it stays out keeps the decision explicit rather than assumed. |

---

## 7. Stop conditions

- If any of the four gate consumers holds its own copy of the band logic instead of calling `gateBandFor` -> surprise-stop; C1's "every surface agrees" claim is unprovable until it is single-sourced.
- If `computeStandings` is found to read policies anywhere -> surprise-stop; C-D3 and C4.2 both assume it does not.
- If removing `excludeImported` from the campaign path changes any figure on a surface **other than** the campaign lens -> surprise-stop; C-D10 is scoped to one call site and a wider blast radius means the helper is wired differently than §2 records.
- If a `firestore.rules` arm is found to validate policy body fields at create -> surprise-stop before C3's `replacedPolicyAPI` requirement.

---

## 0.1 Ground truth, part two - the gap and the persistency lever (queried 20 September 2026)

Second read-only pass, `verification/campaign-gap-and-lapses.mjs`. These are the figures the campaign surfaces must reproduce, and the material the reinstatement track will be built on.

**The whole book (229 docs, all `nb_ordinary`, all imported):**

| Issued by year | | Status | |
|---|---|---|---|
| 2018 | 27 | settled | 117 |
| 2019 | 38 | lapsed | 87 |
| 2020 | 34 | ntu | 22 |
| 2021 | 10 | denied | 3 |
| 2022 | 27 | | |
| 2023 | 30 | **in flight** | **0** |
| 2024 | 21 | | |
| 2025 | 26 | | |
| 2026 | 6 | | |
| earlier | 10 | | |

**Nothing is in flight.** No `written`, `submitted`, `rated` or `postponed` docs exist. The ledger holds terminal states only, so the campaign figure changes only when a new export lands - which is what C-D11's as-at stamp exists to say out loud.

**The gap to Champion, the lowest level:**

| | Apps | API (TTD) |
|---|---|---|
| Counted now | 3 | 73,946.28 |
| Champion | 35 | 275,000 |
| Still needed | **32** | **201,053.72** |

The three counted policies average TTD 24,649 API each; Champion needs an average of 7,857. **Applications are the binding constraint, not API** - a campaign surface that leads with an API progress bar would point the advisor at the wrong number. C2's readout must give apps equal prominence, and the distance-to-next-room line must name whichever of the two is actually short.

**The persistency lever - the reinstatement track's ground truth:**

Of 87 lapsed policies, **80 are already past 24 months from issue and cannot move the December figure at all.** Only **7** are still inside their first 24 months, holding **TTD 28,196.88** - which is exactly the lapse input behind the 86.6% that `deriveFromLedger` produced for September, an independent cross-check of both numbers.

| Issued | Months to 24 | API (TTD) |
|---|---|---|
| 2024-10-28 | 1 | 1,182.36 |
| 2025-05-28 | 8 | 2,400.00 |
| 2025-08-14 | 11 | 11,996.64 |
| 2025-11-19 | 14 | 4,821.12 |
| 2025-11-11 | 14 | 3,617.64 |
| 2025-11-19 | 14 | 2,400.00 |
| 2025-11-20 | 14 | 1,779.12 |

On September's figures (gross 210,975.24, lapses 28,196.88), 90% needs lapses at or below 21,097.52 - a reduction of **TTD 7,099.36**. The single 11,996.64 policy clears it alone; so do two of the smaller pairs. **This is the shape the reinstatement engine must produce: not a list of lapses, but the smallest set that clears the gate.** The aged-out 80 must never appear on that list - a hit list that includes policies which cannot help is worse than no hit list, because it sends the advisor to make calls that do nothing.

**Scope note:** the reinstatement engine is NOT part of this campaign track. It is the next brief. These figures are recorded here because C3's evidence paste-back must reproduce the campaign half of them, and because the two tracks share one arithmetic.

---

## 8.1 Rev 2 operator rulings - taken 20 September 2026

| # | Question | Ruling |
|---|---|---|
| R5 | The annuity missed-premium rule gives 86.6% under `ignore` and 72.2% under `lapse`, and Tatil has not confirmed which applies. Does the campaign track wait on that confirmation? | **No. Build on the shipped default (`ignore`) and do not gate on Tatil.** The rule is already stored alongside every saved figure (PR #949's provenance fields), so a later correction re-derives rather than rewrites, and the gate surface reads whatever the setting says. Waiting would hold a build for a number the build does not hard-code. |
| R6 | Can the track run unattended? | **Yes, to PR-open only.** Rule 19 is unchanged: Claude Code opens PRs and holds. No merge, no `firebase deploy`, no production write, no campaign document authored (C5 stays operator-only). |
