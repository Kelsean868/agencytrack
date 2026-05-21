# PR Kickoff — Track I · I1.2: JFW Auto-Count (owner-side, read-only)

**Track:** I. **Type:** Feature PR · **Size:** S–M · **Risk:** Low–Medium (cross-collection `collectionGroup` read + an additive index; possibly a small additive rule clause).
**Provenance:** Track I spec §2 (JFW = activity #1, auto/read-only from the Track F joint-call log). I1.1 reserved `jfwCount` in the WAR schema (locked at 0) and left a placeholder JFW row.

Second of the I1 sequence. **No Cloud Function in this PR.** The CF that denormalizes `jfwCount` onto the WAR doc for *upline* visibility — plus changing the `jfwCount==0` lock — belongs to **I1.3** (the upline browse view), because only I1.3 needs an upline to read the count. I1.2 shows the count to the **manager viewing their own WAR**, which the owner can compute client-side.

---

## Goal

Replace the I1.1 placeholder JFW row with a **read-only count** of the manager's own completed joint calls for the displayed week, computed from the Track F joint-call log via an owner-scoped `collectionGroup` query. The manager never types it.

## Source-verify first (Rule 17, Phase 1 — STOP on contradiction)

This is the determining step — the whole PR shape depends on it. Pair grep with `git ls-files`; report before any code:

1. **`jointCalls` read rule — collectionGroup feasibility.** Find the `jointCalls` match block in `firestore.rules`. Does its `read` allow an **author** path (`resource.data.authorUid == request.auth.uid`) such that a `collectionGroup('jointCalls').where('authorUid','==',uid)` query is rule-safe? If the read is *only* rank-scoped (no author clause), report exactly what's there — adding an `authorUid == request.auth.uid` read clause is a small **additive** change (more permissive), but I want to confirm before assuming.
2. **Date field + "completed" condition.** Confirm the `jointCalls` schema field used to bucket by week (`appointmentDate`? `createdAt`? — and its type: ISO string vs Timestamp). Confirm what marks a call as *done* for JFW credit. Proposed: `appointmentKept === true` (the call actually happened; a logged-but-not-kept appointment is not field work). Confirm the field exists and whether it's reliably set. If there's a clearer "post-call eval complete" signal, report it.
3. **Existing indexes.** Check `firestore.indexes.json` for any `jointCalls` collectionGroup index. We'll need one on `(authorUid, <dateField>)`.
4. **`authorUid` denormalization** on `jointCalls`: confirm the logging manager's uid is stored as `authorUid` (the field we filter on).

**STOP and report** if a collectionGroup read by `authorUid` is not feasible with at most a small additive rule clause + an index — that would change the approach (and might pull a CF forward).

## Approach

- **Service:** add `getOwnJfwCount({ tenantId, managerId, weekStart })` to `managerWarService.js` — `collectionGroup('jointCalls').where('authorUid','==',managerId).where(<dateField>, '>=', weekStart).where(<dateField>,'<', weekEnd)`, then **count client-side the docs with `appointmentKept === true`** (keeps the index 2-field: `authorUid` + `<dateField>`; the completed-filter is a JS filter on the small weekly result set). Returns a number.
- **UI:** in `ManagerWarTab`, replace the placeholder JFW row with the read-only computed count for the currently-selected week. Loading state while the query runs; show `0` cleanly when none; error state if the query fails (don't block the rest of the WAR). The count is **display-only — do NOT write it to the WAR doc** (the doc's `jfwCount` stays 0/locked; no `managerWeeklyReports` rule or schema change).
- **Rules/index:** add the `collectionGroup` index on `jointCalls (authorUid, <dateField>)`; add the `authorUid` read clause to the `jointCalls` rule **only if** Phase 1 finds it missing. Both additive → deploy pre-merge.

## Scope

**IN:** `getOwnJfwCount` service fn + unit tests; the read-only JFW row in `ManagerWarTab` + component test; the additive `collectionGroup` index (+ the `authorUid` read clause only if missing); an emulator case proving an author can run the `authorUid`-scoped collectionGroup read (and a non-author cannot read another's via that path).
**OUT (named):** any Cloud Function; `jfwCount` denormalization onto the WAR doc; the `jfwCount==0` lock change; **upline visibility of the count** — all **I1.3**. Recruiting monthly roll-up (I2); accountability flag (I3); §6 license-state. No `needCovered` work.

## Phases

1. **Source-verify** (the 4 items). STOP and report; do not write code until I confirm the rule/index/field findings.
2. **Service + index (+ conditional rule clause).** `getOwnJfwCount`; `firestore.indexes.json` collectionGroup index; `jointCalls` author read clause only if absent. Service unit tests (count logic, week boundary inclusive-start/exclusive-end, `appointmentKept` filter, empty → 0).
3. **UI** — the read-only JFW row + loading/empty/error; recompute when the week selector changes. Component test. Nexus tokens; 44px; light + dark.
4. **Docs (placeholders).** CONTEXT.md recently-shipped row + Where-we-left-off (`#TBD`/`{TBD}`); FOLLOW_UPS.md — mark I1.2 shipped, note **I1.3 (standards config + upline browse view + jfwCount denormalization/CF) next**.
5. **Commit / push / PR.** Branch off fresh main (`git fetch` first). Additive index (+ maybe rule clause) → **deploy pre-merge** (`firebase deploy --only firestore:indexes` and, if the rule changed, `firestore:rules`); confirm the index finishes building before smoke. Lint + build. **Full suite with `.env.local` moved aside** (env-unset parity). Push, PR via `gh`, Rule 15. Do NOT merge.

## Smoke — RUN (real write-read-verify)

Via `setupBypassSession` against the preview (`VERCEL_BYPASS_TOKEN` by name only):

1. **Count correctness:** as a manager who has logged joint calls (the Test BM, or seed a couple via the Track F joint-call form for the current week with `appointmentKept = true`), open the WAR → the JFW row shows the matching count. Light + dark, 390×844, 0 console errors.
2. **Boundary:** a joint call dated **outside** the selected week, or with `appointmentKept = false`, is **not** counted (verify the count excludes it).
3. The query runs against the **deployed index** (a missing/unbuilt index surfaces as a `FAILED_PRECONDITION` — must not occur).

## Acceptance criteria

- The JFW row shows the correct read-only count for the selected week, recomputed on week change; manager cannot edit it.
- Count = owner's `jointCalls` in `[weekStart, weekStart+7)` with `appointmentKept === true`; out-of-week / not-kept excluded.
- `collectionGroup` query is rule-allowed and index-backed (no `FAILED_PRECONDITION`); index/rule additive, deployed pre-merge.
- `managerWeeklyReports` unchanged (`jfwCount` still 0/locked). Lint 0; build green; suite green incl. env-unset parity; smoke green.

## Post-merge

Standard fill. (Index/rule already deployed pre-merge — no deploy step post-merge.)
