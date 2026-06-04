# Kickoff — Weekly Planner v2 Slice 2: agent-set weekly plan (store + steppers + commit)

**Size:** L · **Type:** feature, NET-NEW DATA (collection + rules) · **Merge:** HUMAN-MERGE +
dispatcher pre-review. Day mode — no auto-merge.
**Branch:** `feat/weekly-planner-v2-slice-2`

## Context
S1 (#445) shipped the read-only SuggestedWeekCard (derived 3-chip line, floor fallback,
no-anchor CTA) + the extracted `goalDecomposition.js` engine; item 14 added its 9 state
tests. S2 makes the plan REAL: the agent turns suggestions into a committed weekly plan via
steppers, stored per-week in Firestore. S3 (plan-vs-actual) and S4 (manager roll-up) come
later — NOT in scope.

## Locked decisions (dispatcher)
1. **Schema** — `tenants/{tenantId}/weeklyPlans/{agentId}_{weekStart}` (deterministic
   composite ID, mirroring the managerWeeklyReports house pattern; weekStart = Sunday,
   `YYYY-MM-DD` in the ID, TT-safe Timestamp in the doc via `parseDateOnlyTT`):
   ```
   {
     agentId, tenantId,
     weekStart: Timestamp,
     targets:    { callsMade, contactsMade, factFindsCompleted,
                   closingInterviewsKept, applicationsSubmitted }   // integers, Number()-enforced
     provenance: { same 5 keys: 'derived' | 'floor' | 'agent' },
     anchorAPIAtCommit: number | null,   // personalAnnualAPI snapshot used for derivation (S3 honesty)
     committedAt, updatedAt: serverTimestamp
   }
   ```
   One doc per agent-week; re-commit overwrites; agent may delete own doc.
2. **Pre-fill provenance (honest, per the S1 Finding-A ruling):** dials (callsMade), CIs,
   apps pre-fill from the derived chain (rounded integers) when derivable; contacts + FFIs
   pre-fill from the resolved company floor, labeled as such. In the floor state (<8wks
   history), all 5 pre-fill from floor. Any metric the agent changes flips its provenance
   to `'agent'`. Never present a floor value as personal.
3. **Floor clamp:** stepper minimum per metric = the agent's RESOLVED floor (the existing
   `resolvedMinimums` path — reuse it, do not re-implement). No ceiling. Commit is blocked
   below floor by construction (clamp), and the service re-validates.
4. **No-anchor state is UNCHANGED:** no planning without an anchor in S2 — the CTA stands.
   Steppers/commit exist only in the derived and floor states.
5. **UI lives in the existing card** (S1 card idiom = layout authority; no CD annotation
   this slice — note any idiom deviations in the PR): a "Plan this week" affordance opens
   edit mode → 5 stepper rows (label · provenance chip · − value +, ≥44px targets) →
   **Commit** (primary, `dark:bg-primary-dark`) + **Reset** (ghost; returns all steppers to
   the current suggestions). Committed state: "Your weekly plan" with the 5 values +
   provenance chips + committed-date microcopy + Edit. Both themes; loading/error states;
   stable testids.
6. **Rules:** new `weeklyPlans` match block. Agent: full CRUD on OWN doc only
   (`request.auth.uid == agentId` + tenant claim match + ID/field consistency checks).
   Manager read: mirror the established upline-read pattern used by sibling collections.
   No manager write. Emulator tests REQUIRED (JDK is installed): allow own create/read/
   update/delete; deny other-agent write; deny cross-tenant; deny unauthenticated; verify
   the read scoping matches the mirrored pattern.

## Phase 0 — source-verify (Rule 17) before anything
- `resolvedMinimums` exact shape/keys + where it lives (AgentDashboard ~196–214) and how to
  thread it to the card (it may already be passed for S1's floor state — confirm).
- `goalDecomposition.js` exports needed for pre-fill; the S1 card's current props/states +
  the item-14 tests (they must keep passing).
- GREENFIELD confirm: no existing `weeklyPlans` collection, rules block, or service.
- The managerWeeklyReports rules block + service as the pattern templates (ID construction,
  weekStart handling, validation parity).
- Index check: deterministic-ID direct gets should need no composite index — confirm
  nothing in this slice issues a query that does.

## Phase 1 — HARD STOP (mandatory)
After Phase 0 and BEFORE writing any rules or service code: **STOP and wait for
dispatcher** with (a) the proposed firestore.rules diff, (b) schema confirmation or any
premise contradiction, (c) the emulator-test plan, (d) anything the repo contradicts in
this brief. Do not proceed past this stop on your own judgment.

## Phase 2 — build
`src/services/weeklyPlanService.js` (deterministic ID, TT-safe weekStart, Number()
enforcement, floor re-validation on write, get/commit/delete) · rules block + emulator
tests · card edit/committed modes per decision 5 · unit tests (pre-fill assembly incl.
derived+floor merge, clamp behavior, provenance transitions, ID/weekStart determinism).

## Phase 3 — gates
Lint 0 · full suite green (incl. the 9 S1 card tests + item-14 set unchanged) · build ·
rules emulator tests green · hex-grep clean on touched files.

## Phase 4/5 — docs + PR
Standard placeholders (#TBD/{TBD}); smoke per below with the box honestly stated; PR is
HUMAN-MERGE with the rules diff called out at the top of the body.

## Smoke (E3 standard — real write-read-verify, both themes)
Login as the test agent → Game Plan → open plan mode → adjust ≥1 stepper (verify clamp at
floor by attempting to go below) → Commit → RELOAD → assert the committed values + 'agent'
provenance persisted (this exercises rules + claims live) → Edit → Reset returns to
suggestions → DELETE the smoke's plan doc as the agent (own-delete path; delete, not zero)
→ axe NO-NEW serious/critical + 0 console errors → screenshots of suggestion, edit, and
committed states, both themes, attached. NOTE: this writes one doc to the live test tenant
under the agent's own auth — that's the point (selector-only checks miss rules bugs); the
cleanup delete is part of the walk.

## Out of scope (do not touch)
S3 actuals/variance · S4 manager roll-up UI · Playground-tab absorption · notifications ·
manager-facing plan views (read RULES are granted; UI is S4's).

## Acceptance
Schema exactly as locked · rules emulator suite green with the deny cases · clamp +
provenance behavior per decisions 2–3 · no-anchor unchanged · S1 tests unchanged-green ·
smoke walk PASS incl. persistence + cleanup · Rules 12/15/17/18/19/20 throughout.
