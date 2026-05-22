# PR Kickoff — Track I · I3a: Accountability Flag, Tier 1 (visibility)

**Track:** I (I3, first half). **Type:** Feature PR · **Size:** M · **Risk:** Low — pure client-side, no rule/CF/index/deploy (mirrors the c-i overlay's risk profile).
**Provenance:** Track I spec §4 — Tier 1 = the missed-standard surfaces on the manager's own and the upline's views; Tier 2 (escalation) is **I3b**. Builds directly on I1.3c-ii's `getResolvedStandards`.

## Goal

Compute "missed standards" client-side from the WAR data + resolved standards already loaded, and surface it as an informational flag in three places: the manager's own WAR (`ManagerWarTab`), the upline's drill-in (`ManagerWarDetail`), and an at-a-glance indicator on the upline's `TeamWarsTab` list. No backend — the async escalation is I3b.

## "Missed" definition (locked by spec §2/§4 — no decision needed)

- **Numeric activities** (jfwCount, oneOnOnesConducted, namesSourced, interviewsConducted, recruitsInFirstWeeks, trainingSessions): missed = `actual < resolvedTarget` **when a target is set**. No target = not measured = never missed.
- **Boolean expectations** (unitMeetingHeld, dashboardReviewDone): missed = `expected === true && actual === false`.
- Informational styling (warning/amber tone via Nexus tokens) — **NOT** alarm-red. This is visibility; the escalation (the ping) is I3b.

## Source-verify first (Rule 17, Phase 1 — report findings, then proceed; no hard-stop, this is client-side)

1. **WAR + standards data flow** — confirm where `ManagerWarTab` and `ManagerWarDetail` load the WAR fields and `getResolvedStandards`/`resolvedStds` (from I1.3c-ii), so `computeMissedActivities` runs over data already in hand. Quote the load points.
2. **`TeamWarsTab` list structure** — how rows render today, and the **cheapest** way to get each listed manager's resolved standards for the at-a-glance flag: e.g. fetch the shared org-default config once + each manager's override (the override is by-id `get`, no list), or a lighter per-row signal. Report the options + recommend the cheapest. (If per-row resolution is unexpectedly heavy, flag it and we'll decide.)
3. **The standard-bearing field set + labels** — reuse `NUMERIC_STANDARDS`/`BOOLEAN_STANDARDS` + labels from `managerActivityStandardsService` so the flag lists activities consistently with the overlay.
4. **Nexus warning tokens** — the informational/warning token (not the alarm/error red) for the flag chip.

## Build

- **`src/utils/accountabilityFlag.js`** — pure `computeMissedActivities(war, resolvedStandards)` → array of `{ key, label, actual, target, type }` for each missed numeric/boolean. Defensive on missing target/blank.
- **`ManagerWarTab`** — when `missed.length > 0`, render a flag panel/chip ("N standard(s) under target") listing the missed activities (label + actual/target). Hidden when none.
- **`ManagerWarDetail`** — same flag, so the upline sees it on drill-in.
- **`TeamWarsTab` list** — a per-row at-a-glance indicator (e.g. an amber "N under" badge) using the Phase-1 standards-resolution approach. Rows with none → no badge.
- **Tests:** util unit (numeric under/met/no-target; boolean expected-but-false/met; empty); component (flag renders when under, hidden when met) on Tab + Detail; list badge renders per under-row.

## Scope

**IN:** the `computeMissedActivities` util; the flag on `ManagerWarTab` + `ManagerWarDetail`; the `TeamWarsTab` list at-a-glance indicator; util + component tests.
**OUT (named):** Tier 2 escalation — the CF + `manager_alert` notification + upline-resolution (**I3b**); the 2-consecutive-week intensifier (follow-up); the `ManagerDashboard` Overview chip (follow-up). No rule, no CF, no index, no deploy.

## Phases

1. Source-verify (the 4 items). Report; proceed (no hard-stop — client-side).
2. The util + the `ManagerWarTab`/`ManagerWarDetail` flag.
3. The `TeamWarsTab` list indicator (per the Phase-1 approach). Loading/empty/error; Nexus/44px/light+dark.
4. Docs WITH placeholders: CONTEXT.md recently-shipped + Where-we-left-off (`#TBD`/`{TBD}`); FOLLOW_UPS.md — mark I3a shipped, note **I3b (Tier 2 escalation) next**, and bank the intensifier + dashboard-chip as LOW follow-ups.
5. Commit / push / PR. Branch off fresh main. NO deploy (no rule/CF/index). Lint + build. Full suite (env-unset default). Push, PR via `gh`, Rule 15. Do NOT merge.

## Smoke — RUN (client-side; browser legs go to Kyron in incognito, like I1.3c-ii)

CC runs what it can (unit/component coverage is the bulk here). Browser legs are Kyron's incognito verification (CC's sandbox is filter-blocked):
1. A manager with a WAR under one standard → `ManagerWarTab` shows the flag listing that activity (actual/target); a WAR meeting all standards → no flag.
2. An upline drills into that WAR → `ManagerWarDetail` shows the same flag.
3. The upline's `TeamWarsTab` list shows the at-a-glance "under" badge on that manager's row, none on a compliant row.
4. Light + dark, 390×844, no console errors.
CC reports unit/component results + flags which legs need Kyron's browser.

## Acceptance

- `computeMissedActivities` correct for numeric/boolean/no-target/met (unit-tested).
- Flag renders on Tab + Detail when under, hidden when met; list badge per under-row.
- Informational (warning) styling, not alarm.
- No rule/CF/index/deploy. Lint 0; build green; suite green (env-unset). PR open, not merged. Rule 15 SHA.

## Post-merge

Standard fill. No deploy.
