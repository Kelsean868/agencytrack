# Trio Redesign — Schema / Data Matrix (canon)

> **Status:** Companion to `docs/design/trio-redesign-scoping-notes.md`. Classifies every data
> element the Commission v2 redesign and the deferred manager scenes (Goals v2 / Persistency v2)
> need, as **EXISTS** (live field/query, cited) · **DERIVABLE** (computable from existing data,
> source named) · **NET-NEW** (no source; requires a new field/collection/CF). Produced as Item 4
> of `docs/briefs/trio-night-queue-kickoff.md`, grounded in the 2026-06-05 Item-3 probe.
>
> **Read this before scoping any trio slice** — it is the difference between "reskin" and "new
> write path / new index / new rule."

Legend: **EXISTS** ✅ · **DERIVABLE** 🟡 (source) · **NET-NEW** 🔴 (build)

---

## A. Commission v2 — AnchorStrip ("Your reality")

| Element | Class | Source / build note |
|---|---|---|
| YTD earned commission ($) | 🟡 DERIVABLE | **Not on settlements** (`settlementService.js:45–64` = `settledAPI`/`settledApps`/`persistency` only). On **policies**: `sum(policies.earnedCommission where status=='settled' && agentId==uid && year)`. No aggregation fn today → new client query or read helper. |
| Projected annual run-rate ($) | 🔴 NET-NEW | No run-rate fn exists. Method (linear / trailing-8wk / seasonal) is a **MORNING DECISION**; once locked, compute from the YTD-earned series. |
| Gap-to-goal | 🟡 DERIVABLE | Goal side EXISTS (`goals.personalAnnualAPI`, `goalsService.getGoals`); reference (API-goal vs commission-goal vs playground input) is a **MORNING DECISION**. |
| 4-week persistency | ✅ EXISTS | `persistencyService.getAgentHistory(tenantId, uid, n)` → recent monthly persistency; agent own-read scoped (`where agentId==uid`). |
| Below-floor flag | ✅ EXISTS | Tenure annual-API floor via `resolveAnnualAPIFloor` (`tenureFloors.js:54–69`); compare to YTD API. |
| **Read-path / rules** | ⚠️ | Policies: agent own-read OK (earnedCommission source). Settlements: tenant-wide read (`firestore.rules:521–529`) — pre-existing over-broad read, see scoping-notes §3.1 flag. |

## B. Commission v2 — Decomposition ladder (7-stage)

| Element | Class | Source / build note |
|---|---|---|
| Income→API→activity chain (all 7 stages) | ✅ EXISTS | `goalDecomposition.js` `decomposeFromIncome` / `decomposeFromAPI`. Engine unchanged — reskin only. |
| Activity ratios from history | ✅ EXISTS | `deriveRatiosFromHistory(submissions)` (`goalDecomposition.js:111`); reads `submissions` already passed to the component. |
| Cadence toggle (1/2/4/10) | 🟡 DERIVABLE | Mode schedules EXIST (`commissionMath.FIRST_PAYMENT_RATIO`); cadence selector is UI state over the existing mode math. |
| Ladder "Dials" semantics | 🟡 DERIVABLE | Prospecting 4-sum EXISTS (`planVariance.computeProspectingCallsActual`); which figure the ladder shows is a **MORNING DECISION**. Daily-source for calls is a known gap. |

## C. Commission v2 — Modal Targeting

| Element | Class | Source / build note |
|---|---|---|
| Mode-mix → required API | ✅ EXISTS | `commissionMath.reverseCalc` / `modeBreakdown`. Engine unchanged. |
| 12-month stacked cash-flow | ✅ EXISTS | `commissionMath.cashFlowForecast`. Engine unchanged; `CashFlowChart` already renders it. |
| Commission rate | ✅ EXISTS | `userProfile.commissionRate` (already read by `index.jsx`). |

## D. Commission v2 — Writes

| Element | Class | Source / build note |
|---|---|---|
| "Set as my goal" → Goals cascade | ✅ EXISTS | `goalsService.setGoals` write path EXISTS (validation `:129–151`). New trigger UI; same write — but a new agent write surface → **HUMAN-MERGE** review. |
| Manager "suggest-a-goal" | 🟡 DERIVABLE | Notifications primitive EXISTS (`nudges` collection + bell `notifications` doc, S2 `sendComplianceNudge` pattern). A goal-suggestion nudge type is NET-NEW config but rides the existing primitive. No recommend/lock *mode* field on goals today (Item 3c ABSENT) → 🔴 if "locked vs recommended" must persist. |

---

## E. Goals v2 (MANAGER scene — deferred to manager-program backlog)

| Element | Class | Source / build note |
|---|---|---|
| Per-node YTD cascade (5 tiers) | ✅ EXISTS | `getGoalHierarchy` assembles goals/unitGoals/branchGoals/salesManagerGoals/companyFloor (`goalsService.js`). |
| YTD API per tier (rollup) | ✅ EXISTS | `useBranchOverview.js:84–87` (submissions-based, role-scoped). |
| Tenure-floor banding | ✅ EXISTS | `tenureFloors.js` 6 bands. |
| Tier-goal provenance (setBy/setAt) | ✅ EXISTS (partial) | `setBy`/`setByName` all tiers; `setByRole` unit-tier only; `setAt`/`updatedAt` present. |
| Recommend-vs-lock mode | 🔴 NET-NEW | No `mode`/`status`/`recommended` field on cascade docs (Item 3c ABSENT). Coaching drawer writes free-text notes only (`coachingNotesService.js`), NOT goal recommendations. |
| Self tier (manager's own goal, excluded from rollups) | 🔴 NET-NEW | No Self-tier doc/field; rollup-exclusion is new logic. |

## F. Persistency v2 (MANAGER scene — deferred to manager-program backlog)

| Element | Class | Source / build note |
|---|---|---|
| Reality bar (% · 6-mo trend · below-floor · award-eligible · lapses) | ✅ EXISTS | `persistencyService.getAgentHistory` + derived award gate (90%). |
| Banded roster (90/80) + source badge + editedAt | ✅ EXISTS | `enteredByRole` / `lastEditedAt` written (`persistencyService.js:259–277`). |
| Entry-drawer (manager-wins write) | ✅ EXISTS | `PersistencyEntryForm` + `savePersistency`; rules `:475–481` (BM/admin write arms). |
| What-if playground → projected pp | 🔴 NET-NEW | Lever→pp formula does not exist (Item 3, manager-program flag). |
| Share-as-recommendation | 🟡 DERIVABLE | Rides the `nudges` notifications primitive. |
| At-risk exception book | 🟡 DERIVABLE | Derivable from history vs 90/80 bands; sub-state taxonomy is a product call. |

---

## G. Cross-cutting NET-NEW summary (what the trio actually has to BUILD)

1. **YTD earned-commission read helper** (policies aggregation) — the one load-bearing new read.
2. **Projected run-rate fn** — gated on the run-rate-method MORNING DECISION.
3. **Recommend-vs-lock mode on goals** — only if the manager Goals scene needs persisted lock state.
4. **Self-tier storage + rollup exclusion** — manager-program.
5. **Lever→pp persistency formula** — manager-program.

Everything else the Commission redesign needs is **EXISTS or DERIVABLE** — the math engines
(`commissionMath`, `goalDecomposition`) are live, unduplicated, and tested. The redesign's real
risk surface is items 1–2 (the AnchorStrip's truth), which is exactly why the slice order is
**data-first** (scoping-notes §3.3).
