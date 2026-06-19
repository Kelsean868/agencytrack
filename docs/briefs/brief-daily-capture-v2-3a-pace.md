# Brief — Daily Capture v2 · Phase 3a: Pace pill (weekly points floor + week-to-date pace)

**Track:** Daily Capture v2 · **Phase:** 3a (3b = configurable working days, follows). **Size:** M–L.
**Merge:** HUMAN-MERGE — points/gamification surface. **Stacks on:** `main` (after `/post-merge 688`).
**Preconditions:** `/post-merge 688` merged (clean main). The Phase 3 smoke must seed `tatillife_smoke` `config/companyMinimums.weeklyActivityFloors` (that tenant has none) idempotently in setup.

## Goal
Add a week-to-date PACE signal to the DCv2 save-card pill: is the agent on pace to clear the weekly points floor by week's end? Working days fixed at 5 in 3a (parameterized in 3b).

## Verified ground truth (recon — do not re-litigate)
- POINTS_WEIGHTS confirmed; `computeDayPoints(dailyDoc)` already maps daily→computePoints (Phase 2 pill uses it).
- Floors (code defaults, Firestore override-on-defaults via `getCompanyMinimums`): callsMade 60, telContacts 40, appointmentsScheduled 20, interviewsKept 15, factFindsCompleted 10, closingInterviewsKept 10, applicationsSubmitted 1, clientsSold 1, api 4800, referralsNewLeads 100.
- `telContacts` is the live key; `contactsMade` is NOT in the floor system. `telContacts` and `clientsSold` are UNSCORED in computePoints.
- Current pill shows `dayPoints` (today only) in the save footer, hidden on Sunday. No week-total exists. `weekDocs` (this week's daily docs) is already subscribed.

## The three net-new pieces
1. **weeklyPointsFloor** (per-tenant) = `computePoints(floorAsSubmissionShape)`.
2. **weekPoints** (week-to-date) = Σ `computeDayPoints(weekDoc)` over the already-subscribed `weekDocs` — no new Firestore read.
3. **Pace badge** on the pill: `weekPoints` vs `weekToDateTarget` → ahead / on-pace / behind.

## Decisions Locked (verified de-dup — do not deviate)
`weeklyPointsFloor` maps each floor key to its computePoints-consumed field, counting each underlying activity ONCE:

| floor key (value) | → computePoints field | pts |
|---|---|---|
| callsMade (60) | dials bucket | 60 |
| appointmentsScheduled (20) | appointmentsSet | 60 |
| factFindsCompleted (10) | ffiConducted | 50 |
| closingInterviewsKept (10) | ciConducted | 100 |
| applicationsSubmitted (1) | applicationsSold | 25 |
| api (4800) | apiSold (÷1000) | 4 |
| referralsNewLeads (100) | otherNewNames @1pt **[CONFIRMED — Kyron]** | 100 |

- **DROP `interviewsKept`** — it ≡ ffiConducted + ciConducted (= factFindsCompleted + closingInterviewsKept); adding it double-counts. This is the single most important guard.
- **EXCLUDE `telContacts` and `clientsSold`** — both UNSCORED in computePoints.
- With the live south floors → **weeklyPointsFloor ≈ 399**.

Pace:
- `workingDays = 5` — a single NAMED constant this phase (3b replaces it with `workingDaysPerWeek`).
- `elapsedWorkingDays` = Mon–Fri count from week start through today inclusive.
- `weekToDateTarget = weeklyPointsFloor × (elapsedWorkingDays / 5)`.
- State: **behind** (`weekPoints < target × 0.95`) / **ahead** (`> target × 1.05`) / **on-pace** (within ±5%). Band tweakable at review.
- Pill: **KEEP** the existing `dayPoints` "pts today"; **ADD** the pace badge. Hidden on Sunday like the current pill.

## Product judgment — RESOLVED (Kyron)
`referralsNewLeads → otherNewNames @1pt` (100 pts), CONFIRMED. Rationale: this is a *minimum* floor, so the conservative per-name rate applies — the referral premium (@3pt) is not baked into the baseline. Floor = 399, not 299/599. No further review needed on this line.

## Phase 0 (re-confirm; recon already mapped most — STOP only on a surprise)
1. The exact computePoints-consumed field for each floor target (which raw field feeds the `dials` accumulator; which feeds `otherNewNames`; `appointmentsSet`/`ffiConducted`/`ciConducted`/`applicationsSold`/`apiSold` direct). Emit the v1 flat submission shape computePoints scores.
2. `getCompanyMinimums` returns `weeklyActivityFloors` as override-on-defaults.
3. `computeDayPoints` is reusable over `weekDocs` and shares the scoring basis with the floor map (so weekPoints and weeklyPointsFloor are apples-to-apples).
4. Re-confirm zero `workingDaysPerWeek` collision.

## Phase 1 — implement
Pure `mapFloorToPoints` (isolated, exported) + `weeklyPointsFloor` + `weekPoints` memo + pace math + pace badge.

## Phase 2 — static verify
Lint/build/full suite + unit tests: `mapFloorToPoints` asserts EACH floor key's point contribution, `interviewsKept` dropped, `telContacts`/`clientsSold` zero, `referralsNewLeads` @1pt, total ≈ 399 for the default floors; pace math asserts target-by-elapsed-days and the three states across the band.

## Phase 3 — smoke (REAL)
Seed `tatillife_smoke` floors in setup. Log daily entries via the real save path to a known point total; assert: (a) `weeklyPointsFloor` computes to the expected value for the seeded floors; (b) `weekPoints` equals the logged sum; (c) the pace badge state is correct — log below target → **behind**, log past target → **ahead**. Both themes; axe NO-NEW vs main.

## Phase 4 — docs (note 3b follow-on for `workingDaysPerWeek`).
## Phase 5 — branch `feat/daily-capture-v2-3a-pace` off `main`; PR; Rule 20 SHA; HOLD.
## Phase 6 — Gemini disposition.

## Self-critique (Rule 22)
The de-dup correctness is load-bearing: the unit tests must pin every floor key's contribution so a later floor edit can't silently reintroduce the interviewsKept double-count. The `referralsNewLeads @1pt` rate is resolved (Kyron, minimum-floor rationale) — the unit test should assert it as 100 pts so the choice is locked in code. And `workingDays = 5` hardcoded mis-paces Saturday-working agents until 3b — acceptable for first ship, explicitly flagged.
