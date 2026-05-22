# PR Kickoff — Track I · I1.3a: `jfwCount` Denormalization (Cloud Function)

**Track:** I. **Type:** Feature PR · **Size:** M · **Risk:** Medium (first new Cloud Function in this track; a rule lock-change; Admin-SDK collectionGroup).
**Provenance:** Track I spec §2 (`jfwCount` auto/read-only, "credit finalized after the post-call eval"). Deferred from I1.2: an *upline* can't run the author-scoped collectionGroup query (it's `authorUid == own uid`-only), so for I1.3b's browse view to show JFW, the count must be **denormalized onto the WAR doc** by a server-side writer.

Isolated PR. **No browse view, no standards** (those are I1.3b/I1.3c). The owner's live JFW compute from I1.2 stays untouched; this PR adds the stored value for uplines to read later.

---

## Goal

A Cloud Function recomputes a manager's weekly JFW count from the Track F joint-call log and writes it onto their WAR doc, and the `jfwCount` rule changes from "must be 0" to "client preserves it, only the CF changes it" — keeping it un-gameable while making it readable by uplines (I1.3b).

## Source-verify first (Rule 17, Phase 1 — STOP on contradiction)

This determines the whole build; report before any code:

1. **Existing CF conventions in `functions/`** — read `functions/index.js`. What trigger style is in use (gen-1 `functions.firestore.document(...).onWrite` vs gen-2 `onDocumentWritten`)? Region/runtime? How are existing CFs (e.g. `doCreateUser`, the cron) **tested** — is there a functions-emulator test harness, or only deploy? What's the deploy command (`firebase deploy --only functions`)? Mirror the existing style exactly.
2. **Deploy/test strategy for the CF** — this is imperative code, unlike additive rules. Report and **recommend**: (a) functions-emulator test pre-merge + deploy the CF *post-merge* with a production smoke after, or (b) deploy the CF pre-merge (from the branch) so the preview smoke can hit it. Note any precedent in how prior CFs were shipped. I'll decide after Phase 1.
3. **WAR doc identity** — confirm the `managerWeeklyReports` doc-id format (`{managerId}_{weekStart}`) and which fields the CF can read (`managerId`, `weekStart`, `tenantId`) to scope its recompute. Confirm `weekStart` is the YYYY-MM-DD Sunday.
4. **`getOwnJfwCount` logic to mirror** — quote the exact predicate (collectionGroup `jointCalls`, `authorUid == managerId`, `tenantId ==`, `appointmentDate` in `[weekStart, weekEnd)`, count `appointmentKept === true`). The CF must reproduce this **identically** to avoid client/CF drift.
5. **Current `jfwCount` lock rule** — quote the `managerWeeklyReports` create/update rule clauses that pin `jfwCount == 0`, so the change is precise.
6. **Index** — confirm the 3-field collectionGroup index `(authorUid, tenantId, appointmentDate)` is deployed (the CF's Admin-SDK query uses it; Admin SDK still needs composite indexes).

**STOP and report.** Especially flag if the existing CFs use a style/test pattern that changes the approach.

## Build

- **Cloud Function — WAR-write trigger.** On `managerWeeklyReports/{warId}` write (create + update; ignore delete): read `managerId`/`weekStart`/`tenantId` off the doc; compute `jfwCount` via an Admin-SDK collectionGroup query mirroring `getOwnJfwCount` exactly (`authorUid == managerId`, `tenantId ==`, `appointmentDate` in `[weekStart, weekEnd)`, count `appointmentKept === true`); **write `jfwCount` back only if it differs** from the current value (loop-guard — the CF's own write must not re-trigger endlessly). The Admin SDK bypasses rules, so it can set the locked field.
  - The WAR doc always exists when this fires (it was just written) — no stub-creation problem. **Freshness:** the count is as-of the last WAR save; a joint call logged *after* a save is reflected on the next save. Full-freshness via a `jointCalls`-write trigger is **deferred** (note as a FU) — not needed for a weekly cadence.
- **Rule change — `managerWeeklyReports`.** `jfwCount`: on **create**, must be `0` (or absent → default 0); on **update**, must equal `resource.data.jfwCount` (client preserves; cannot change it). The CF (Admin SDK) is the only writer that changes it. **Backward-compatible:** existing docs are all `jfwCount == 0`, so "preserve" == the old "==0" for them — safe to deploy pre-merge.
- **Owner display (I1.2) UNCHANGED** — the owner's WAR still shows the live `getOwnJfwCount`. (Owner sees live; uplines will read the stored snapshot in I1.3b. They converge at save time, since the CF computes the same value on save.)

## Scope

**IN:** the CF + its tests; the `managerWeeklyReports` `jfwCount` lock-rule change + emulator tests; the index confirmation.
**OUT (named):** the upline browse view (**I1.3b**, the consumer of the stored value); standards config (**I1.3c**); a `jointCalls`-write trigger for full freshness (deferred FU); any change to the owner's live display; any `needCovered` work.

## Phases

1. **Source-verify** (the 6 items). STOP; do not write code until I confirm — especially the deploy/test strategy (item 2) and the existing CF style (item 1).
2. **CF + rule change.** The trigger (mirroring the existing CF style); the `jfwCount` lock change. CF logic unit test (count given fixtures, loop-guard short-circuit when unchanged). Emulator rules tests: client create `jfwCount==0` ALLOW; client update preserving `jfwCount` ALLOW; **client update *changing* `jfwCount` DENY**; existing `managerWeeklyReports` cases stay green.
3. (No UI in this PR.)
4. **Docs (placeholders).** CONTEXT.md recently-shipped row + Where-we-left-off (`#TBD`/`{TBD}`); FOLLOW_UPS.md — mark I1.3a shipped, note **I1.3b (upline browse view) next**, bank the full-freshness `jointCalls`-trigger FU.
5. **Commit / push / PR.** Branch off fresh main. Rule change deploys pre-merge (backward-compatible). CF deploy per the Phase-1-decided strategy. Lint + build. Full suite with `.env.local` moved aside (env-unset parity). Push, PR via `gh`, Rule 15. Do NOT merge.

## Smoke — RUN (the CF is the whole point — verify the stored value)

Per the Phase-1 deploy decision (CF on the preview, or post-merge production):

1. **Denormalization correctness:** as a manager with N `appointmentKept===true` joint calls in the current week, save/submit the WAR → after the CF runs, **REST-read the WAR doc → `jfwCount === N`** (matches the owner's live count).
2. **Update path:** log one more kept call → re-save the WAR → `jfwCount` becomes N+1.
3. **Boundary:** a not-kept or out-of-week call does not change `jfwCount`.
4. **Loop-guard:** the CF's write-back does not cause runaway re-triggering (the doc settles to the computed value; verify no error/quota spike in the function logs).

## Acceptance criteria

- The CF writes the correct `jfwCount` (== `getOwnJfwCount`) onto the WAR doc on save; updates on re-save; loop-guarded.
- Rule: client cannot change `jfwCount` (DENY in emulator + the create/preserve cases ALLOW); the CF can (Admin SDK). Backward-compatible with existing 0-valued docs.
- No drift: the CF's count predicate is identical to `getOwnJfwCount`.
- Lint 0; build green; suite green incl. env-unset parity; CF emulator/test green; smoke green.

## Post-merge

Standard fill. Note in the report whether the CF deployed pre- or post-merge so I track the deploy state.
