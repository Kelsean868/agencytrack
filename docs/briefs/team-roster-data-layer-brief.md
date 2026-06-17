# Brief: Manager Team Roster — data layer (per-member assembly + sort + period filter), v1

## Context
Direction-1 consolidated Team Performance roster (#4). The UI/layout is being designed in Claude Design
in parallel; this brief builds the **data layer only**, independently, so the two land together. **No UI
in this brief** — a pure assembly module + a hook + sort/filter logic + tests. Suited to an unsupervised
window: build-and-hold, read/compute only, unit-tested.

## Objective
Build a per-member roster data assembly for a manager's team: the 8 v1 fields, period filtering, and
sort — as testable logic the UI will later consume.

## The 8 fields per member
name · contractDate (→ tenure) · API submitted · Apps submitted · API issued (settled) · Apps issued
(settled) · persistency · % of annual goal.

## Decisions (locked)
- **Member set** scoped by manager role — UM = their unit's agents; BM = their branch's agents + UMs.
  Resolve the same way existing roster screens do (`getTenantUsers` + role/scope filter; confirm the
  pattern in Phase 1).
- **Source from per-member docs** — submissions (submitted), settlements (issued), persistency docs,
  plan docs (annual target), user docs (name/contractDate). **NOT** the branch leaderboard aggregate —
  keeps it UM-scopable and smoke-assertable.
- **Period filter:** year / month / week (no day). Scopes the 4 production fields only.
- **Persistency** = the month containing the selected period (latest month for a year view).
- **% of annual goal** = full-year YTD submitted API ÷ committed annual target; `null` → "—" when no
  committed target. Annual — not period-scoped. **Structure the calc so a future "pacing" variant
  (cumulative-through-period ÷ target) is a one-line swap.**
- Defaults: period = current year; sort = name A→Z.

## Procedure note
Branch at **Phase 0, before any code**. PowerShell — no `&&`. Tier B (read/compute frontend logic);
**build-and-hold, human merge.**

## Phase 1 — recon (report, then proceed)
1. Settlement record period granularity (`periodKey`) — monthly or finer? This decides the week-filter
   behavior for issued production (if settlements are month-keyed, a week selection resolves issued to
   its containing month).
2. Submission date field + the submitted production fields, and the canonical production-API formula
   already in use.
3. Persistency doc shape (`{uid}_{YYYY}_{MM}`) and the committed-annual-target source
   (monthlyPlan.anchorAPI / yearPlan total, committed).
4. The member-set resolution pattern (UM/BM scope) from an existing roster screen.
5. Whether the per-member period queries need **new composite indexes** (submissions/settlements by
   member + date range). If yes, add them to `firestore.indexes.json` (Kyron deploys on merge).
   Report, then proceed.

## Phase 2 — build
- A pure assembly module (e.g. `src/lib/teamRoster.js`) + a hook (e.g. `src/hooks/useTeamRoster.js`):
  given `(tenantId, managerScope, period {grain, value})`, returns per-member rows with the 8 fields.
- Pure sort functions for each column (name, contractDate/tenure, submittedAPI, submittedApps,
  issuedAPI, issuedApps, persistency, pctOfAnnualGoal), asc/desc.
- Period-filter logic: year/month/week scoping of production; persistency→containing month; %goal→annual.
- % of annual goal compute (annual default; pacing-swappable per the locked decision).
- **No UI.**

## Phase 3 — tests (primary verification)
- Unit tests against fixtures for: the assembly, each sort (incl. ties), the period filter at each grain,
  persistency month-resolution, and % goal (incl. the null-target "—" case).
- **Optional** integration check against the seeded `tatillife_smoke` roster if feasible without UI
  (admin-SDK read + run the assembly): assert the 4 seeded agents appear with the seeded spread and that
  sorting issued API descending orders them 800k→60k. If it needs UI or undeployed indexes, defer this
  live leg to the UI build and note it — the unit tests fully cover the logic regardless.

## Phase 4-5
- Docs placeholders (CONTEXT.md, FOLLOW_UPS.md). **Also bank the #681 hardening FU** in FOLLOW_UPS:
  > LOW — Update-button reload uses a fixed 500ms fallback (clientsClaim absent → controllerchange never
  > fires). Harden to event-driven: reload when the waiting SW hits 'activated' (statechange), long
  > fallback timeout. Pull forward only if "clicked Update twice" reports surface. (From #681 review.)
- Branch, push, open PR. **HOLD for human review.**

## Acceptance
- The hook returns correctly-scoped per-member rows with all 8 fields; each column sorts; period filter
  scopes production correctly; % goal handles no-target; unit tests green. Zero UI, zero writes. Any new
  indexes added to `firestore.indexes.json`.

## Risks
- Settlement grain (week-for-issued) is the one unknown — Phase 1 resolves it. % goal default is annual
  (pacing-swappable). Read/compute only, no prod writes → low risk; unit tests are the safety net for an
  unsupervised build.
