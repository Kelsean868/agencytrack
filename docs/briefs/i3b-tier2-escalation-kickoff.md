# PR Kickoff — Track I · I3b: Accountability Escalation, Tier 2 (CF + notifications)

**Track:** I (I3, second half — completes I3). **Type:** Feature PR (Cloud Function) · **Size:** M–L · **Risk:** Medium — a new CF (shared resource) + upline-resolution + miss-computation that must not drift from I3a's client logic.
**Provenance:** Track I spec §4 Tier 2; builds on I3a (`computeMissedActivities`) + I1.3c-ii (`getResolvedStandards`). No automated consequences — the notification is the whole mechanism; the upline's response is human.

## Locked decisions (Kyron)

- **Escalation chain:** UM under → notify their BM(s); BM under → notify their SM(s); **SM under → no escalation (chain stops at SM).**
- **Notify ALL** at the relevant tier (2+ BMs in the branch / 2+ SMs in the tenant → all of them).
- **Uniform:** every manager's own miss pings their direct upline, uplines included (a BM under pings their SM). No special-casing.
- **De-dup:** fire only on the first `draft → submitted` transition (`before.status !== 'submitted' && after.status === 'submitted'`), not on edit-and-resubmit.

## Goal

A CF on WAR write that, on the first submit transition, computes the submitting manager's missed standards and — if any — writes a `manager_alert` notification to each of the manager's upline(s) per the locked topology. Backend-only; the alerts surface in the existing `NotificationDrawer` (which already renders `manager_alert`).

## Source-verify first (Rule 17, Phase 1 — STOP; new CF + the miss-logic-sharing call are the crux)

1. **Existing WAR-write CF** — quote `functions/war/recomputeJfwCount.js` (`onWarWrite`): the trigger registration, gen (gen-1, region), the before/after access, the loop-guard/transition pattern. The new CF mirrors this shape and the submit-transition gate.
2. **Notification write shape** — quote the `manager_alert` write from F2.1's BM-notify (`jointCallsService.js` ~115) and/or `notificationService` — the exact doc fields (`userId`, `tenantId`, `type`, `title`/`body`, `link`, `read`, `createdAt`). Reuse verbatim shape.
3. **Miss-computation, CF-side** — the resolution (`getResolvedStandards` = org-default config + per-manager override merge) and the comparison (`computeMissedActivities`) are both client-side (`src/`). The CF (separate `functions/` workspace) needs the same. DECIDE: re-implement as a pure, unit-tested module in `functions/` (mirroring the `jfwCountLogic.js` pattern) with a "mirrors `src/utils/accountabilityFlag.js`" header + a sync FU, vs a shared module. Report the cross-workspace import constraints and **recommend** — the comparison logic is simple, so a tested copy is likely cleanest, but confirm.
4. **Upline-resolution query** — UM→BMs needs `users where role == 'branch_manager' && branchId == X`; BM→SMs needs `users where role == 'sales_manager'` within the tenant. Report whether a composite index `(role, branchId)` on `users` already exists (the app does branch/manager queries — it may). If not, it's a new additive index. Quote the user-doc fields the query keys on.
5. **Deploy timing + frontend** — confirm NO frontend change is needed (alerts via the existing drawer). New CF export deploy timing: **lean POST-merge** (shared resource; production smoke after, per the I1.3a precedent). Confirm.

**STOP and report** — especially items 3 (miss-logic sharing) and 4 (the index). I lock those before code.

## Approach (subject to Phase-1 confirmation)

- **CF:** a new export (e.g. `onWarSubmitNotifyUpline`), gen-1, on WAR write, gated on the first `draft→submitted` transition. Mirrors `onWarWrite`'s shape.
- **Pure module** (`functions/war/escalationLogic.js` or similar, tested): `resolveStandards(orgDefault, override, role)` + `computeMissed(war, resolved)` (mirrors the client) + `resolveUplineRecipients({role, branchId, tenantId, allUsers})` returning the recipient UIDs per the locked topology (UM→branch BMs; BM→tenant SMs; SM→[]).
- **CF body:** on transition, read the org-default config + the manager's override (Admin SDK) → resolve → compute missed. If `missed.length > 0`, resolve recipients (Admin SDK query), write a `manager_alert` to each. Best-effort `try/catch` — a failed escalation must NEVER block or fail the WAR write.
- **Index:** if Phase-1 finds none, add `users (role ASC, branchId ASC)` — additive, pre-merge.

## Scope

**IN:** the new CF export; the pure escalation-logic module + its tests; the upline-resolution query (+ index if needed); the `manager_alert` writes; de-dup on first transition.
**OUT (named):** the 2-consecutive-week intensifier (LOW FU); the `ManagerDashboard` Overview chip (LOW FU); I2; §6. **No new rule** (notifications + Admin SDK). **No frontend change** (confirm in Phase 1).

## Phases

1. **Source-verify** (the 5 items). STOP; I lock the miss-logic-sharing + index + deploy.
2. **Pure module + CF.** The escalation-logic module (tested) + the CF export mirroring `onWarWrite`. De-dup gate. Best-effort notification writes.
3. **Index** (if needed) + wiring. Pure-module unit tests: resolution, missed, and the recipient topology — UM→branch BMs (incl. multiple BMs), BM→tenant SMs (incl. multiple SMs), **SM→empty (chain stops)**, uniform (a BM's own miss → SMs).
4. **Docs (placeholders).** CONTEXT.md recently-shipped + Where-we-left-off (`#TBD`/`{TBD}`); FOLLOW_UPS.md — mark I3b shipped + **I3 COMPLETE**; note the miss-logic sync FU (CF mirrors `accountabilityFlag.js`); intensifier + dashboard chip remain LOW.
5. **Commit / push / PR.** Branch off fresh main. Index (if any) additive → deploy PRE-merge. **CF deploys POST-merge** (shared resource). Lint + build. Full suite (env-unset). Push, PR via `gh`, Rule 15. Do NOT merge.

## Deploy + Smoke

- **Pre-merge:** the index (if added); the pure-module unit tests (resolution, missed, topology); frontend preview unaffected (no frontend change). (Note the CF-test-harness gap — the CF wiring itself is verified by deploy + production smoke, like I1.3a.)
- **Post-merge:** deploy the CF, then **production smoke** —
  1. As a UM under one standard, submit the WAR → assert each BM in that branch receives a `manager_alert` (correct title/body/link).
  2. A compliant UM submit → **no** notification.
  3. Re-submit the same WAR → **no** second notification (de-dup).
  4. As a BM under, submit → the SM(s) get alerted (uniform).
  5. As an SM under, submit → **no** escalation (chain stops).
  6. Loop-guard / logs clean; the WAR write itself never fails on an escalation error.

## Acceptance

- Escalation fires only on the first submit transition, only when missed > 0, to all uplines at the correct tier; SM-level stops.
- Miss-computation matches I3a (same activities flagged); the CF copy is unit-tested + noted as mirroring the client.
- No new rule; no frontend change; index (if any) additive pre-merge; CF post-merge.
- A failed notification never blocks the WAR write.
- Lint 0; build green; suite green (env-unset); production smoke green.

## Post-merge

Deploy the CF, run the production smoke, then the standard docs fill. Mark **I3 complete** (Tier 1 + Tier 2).
