# PR Kickoff — Track I · I1.1: Manager WAR Foundation + Manual-Activity Entry

**Track:** I (the headline track — Manager Activity Reporting). **Type:** Feature PR · **Size:** M · **Risk:** Medium (new collection + a new rank/scope read rule — the privacy axis).
**Provenance:** Track I design spec `docs/AgencyTrack_TrackI_ManagerWAR_DesignSpec.md` §2 + §0.5 step 2. **Read model confirmed by Kyron 2026-05-21** (see below).

This is I1.1 of a 3-PR I1 sequence: **I1.1** = schema + read rule + manual-activity entry (this PR); **I1.2** = JFW auto-count (collectionGroup over Track F joint calls + index); **I1.3** = blank-default standards config + upline browse view. I1.1 deliberately excludes JFW auto-count, standards, and the upline-facing view to keep the rule + entry surface in one reviewable PR.

---

## Goal

Stand up the Manager Weekly Activity Report: the `managerWeeklyReports` collection, the read rule enforcing the confirmed privacy model, the service, and the manager's own entry surface for the six manually-entered activities. Minimal-entry-first (the managers' #1 adoption concern per the workshop).

## CONFIRMED read model (the privacy axis — do not deviate)

A WAR is a manager's report on **their own** weekly activity → submissions-style with the manager as owner, scoped **upward**:

- The manager **owns, writes, and reads their own** WAR (create + update + read own).
- The **upline reads it, read-only**: a Unit Manager's WAR is readable by their Branch Manager → Sales Manager → tenant/platform admin. Uplines **never write** a subordinate's WAR.
- **Peers** (same-level managers) and **downline** (their own agents) **cannot** read it.
- Filers: **UM, BM, SM** each file a WAR. tenant_admin / platform_admin do not file (they read).

This is the agent-weekly-report direction (owner writes, chain reads) — **not** the coaching-notes rank-exclusion model (there is no third-party subject to exclude; the manager is both author and subject). It matches §4's flag-upward accountability: the upline who'd receive a miss-flag is exactly who reads the report.

## Source-verify first (Rule 17, Phase 1 — STOP on contradiction)

Pair grep with `git ls-files`. Report before writing code:

1. **Agent weekly-report conventions** to mirror: collection path + doc-id pattern (e.g. `{uid}_{weekStartISO}`?), Sunday-week validation, `parseFloat()` usage, auto-save vs explicit submit. Align the WAR with the established pattern; flag if the spec's tenant-level `/tenants/{tid}/managerWeeklyReports/` path is inconsistent with how agent reports are stored (subcollection vs tenant-level) and recommend.
2. **Existing rank/scope helpers in `firestore.rules`** — the coaching-notes helpers (`cnRoleRank()`, `cnUMScopeOk()` or equivalents), the F2.1 BM-resolution path (`agent.branchId → branches/{branchId}.managerId`), and any `canManage`/branch/unit scope checks. The WAR read rule must reuse these, not invent a parallel mechanism.
3. **`isProducingManager`** — confirm the field exists on the user/manager doc and where it's set (gates the personal-production sub-panel).
4. **Manager dashboard structure** — where UM/BM/SM see their own views; the right place to add a "Weekly Activity" / "My WAR" tab. Note how the three roles' dashboards differ.
5. **Denormalization sources** for the read rule: the manager's role, rank, `branchId`, `unitId` (so the rule can resolve "is the reader this manager's upline-in-scope?").

## Schema — `/tenants/{tid}/managerWeeklyReports/{managerId}_{weekStartISO}`

Deterministic doc id = `{managerId}_{weekStartISO}` (one per manager per week; `weekStartISO` = a validated Sunday). Fields:

- `managerId` (owner uid) · `weekStart` (ISO Sunday) · `tenantId` (denormalized)
- `managerRole` + `managerRoleRank` (denormalized) · `branchId` · `unitId` (denormalized scope for the read rule)
- **Activity fields (6 manual this PR):**
  - `oneOnOnesConducted` (number)
  - `namesSourced`, `interviewsConducted`, `recruitsInFirstWeeks` (numbers — the weekly recruiting portion; the monthly roll-up is I2)
  - `trainingSessions` (number), `trainingTopic` (string, optional)
  - `unitMeetingHeld` (boolean), `attendanceCount` (number, optional)
  - `dashboardReviewDone` (boolean)
  - **Personal production** (gated behind `isProducingManager`): `personalApi` (number, TTD), `personalApps` (number) — separate sub-panel, **never** blended with unit totals.
- `jfwCount` (number) — **reserved in the schema, defaulted to 0/null; NOT entered and NOT auto-counted in this PR.** Auto-count is I1.2. Do not show an editable JFW field.
- `createdAt`, `updatedAt`, `submittedAt` (timestamps)

`parseFloat()` on every numeric. `weekStart` validated as a Sunday (mirror the agent wizard's validation).

## Read rule — `firestore.rules` (the privacy axis)

New collection block for `managerWeeklyReports`, reusing the existing rank/scope helpers found in Phase 1:

- **create / update:** only the owner (`request.auth.uid == resource.data.managerId` / matching the doc-id manager segment). Owner-write only.
- **read:** owner **OR** an upline-in-scope manager — a reader whose rank > the WAR's `managerRoleRank` **and** whose scope contains the WAR owner (BM reads UM WARs in their branch via `branchId`; SM/admin broader per the existing scope helpers). Read-only for uplines.
- **deny:** peers (same/lower rank, not in upline scope), downline agents.
- Field-shape validation on write (required keys present; numerics are numbers; `weekStart` is a Sunday string), consistent with how F1/F3 validate.

Mirror the coaching-notes rank+scope precedent exactly; do not invent a new scope mechanism. **No collectionGroup query and no index in this PR** — own-read is by doc-id; the upline-read smoke leg is a single-doc REST read (no index). The upline browse *query* (and its index) lands with I1.3.

## The entry surface (manager's own WAR)

A new tab/section in the manager's own dashboard (per Phase-1 placement), shown to UM/BM/SM:

- Week selector defaulting to the current Sunday week; loads the existing doc for that week if present (edit) or a blank one (create).
- The six manual activities, grouped for minimal entry (booleans as toggles, counts as small steppers/inputs). Personal-production sub-panel rendered only when `isProducingManager`.
- Auto-save or explicit submit — **mirror whatever the agent wizard does** (consistency + the established pattern).
- Loading / error / empty states. Nexus tokens (`bg-surface`/`bg-card`/`bg-card-raised`), 44px touch targets, no gradient buttons, light + dark.

## Scope

**IN:** the schema; the read rule (confirmed model); `managerWarService.js` (upsert own by `{managerId}_{weekStart}`, read own, read-a-specific-WAR-by-id for the upline smoke leg); the manager's own entry surface (6 manual activities + gated personal production); emulator rules tests (owner RW; upline single-doc read ALLOW; peer + agent DENY); service unit tests; component tests.
**OUT (named, deferred):** JFW auto-count + collectionGroup + index (**I1.2**); standards config + upline browse view (**I1.3**); recruiting monthly roll-up (I2); accountability flag (I3); §6 license-state. No `needCovered` work. No Cloud Function.

## Phases

1. **Source-verify** (the 5 items above). STOP and report if the agent-report pattern, the rank/scope helpers, or `isProducingManager` differ from assumptions.
2. **Schema + rule + service.** New `managerWeeklyReports` rule block (additive — a brand-new collection). `managerWarService.js`. Emulator rules tests: owner create/update/read ALLOW; an upline single-doc read ALLOW; a peer manager DENY; an agent (downline) DENY; owner-only write (upline write DENY). Service unit tests.
3. **Entry surface** + component tests. Loading/error/empty; Nexus; 44px; light + dark; `parseFloat`; Sunday validation.
4. **Docs (placeholders).** CONTEXT.md recently-shipped row + Where-we-left-off (`#TBD`/`{TBD}`); FOLLOW_UPS.md — mark **I1.1 shipped**, note **I1.2 (JFW auto-count) next**, keep the Track I roadmap row current.
5. **Commit / push / PR.** Single branch off fresh main (`git fetch` first). **Rule is additive (new collection) → deploy pre-merge** (`firebase deploy --only firestore:rules`); confirm deployed before smoke. **No index** (confirm). Lint + build. **Full suite with `.env.local` moved aside** (env-unset parity). Push, open PR via `gh`, Rule 15 verify. Do NOT merge.

## Smoke — RUN (real write-read-verify; this PR introduces a privacy rule, so the negative legs are mandatory)

Via `setupBypassSession` against the Vercel preview (`VERCEL_BYPASS_TOKEN` by env-var name only):

1. **Owner happy path:** a manager (use Test BM 001, or a UM test account) → WAR tab → fill the manual activities → submit → reload → values persist (owner read-write). Light + dark, 390×844, 0 console errors.
2. **Upline read (ALLOW):** an upline of that manager reads the WAR doc by id via REST → 200, returns the entered values.
3. **Peer DENY:** a same-level manager not in the upline scope reads the WAR doc via REST → 403.
4. **Downline DENY:** the test agent (`kelsean@gmail.com`) reads a manager WAR doc via REST → 403.

The deployed rule must produce ALLOW on legs 1–2 and 403 on legs 3–4. (Negative legs via direct Firestore REST per the established pattern.)

## Acceptance criteria

- `managerWeeklyReports` writes succeed for the owner and persist; the entry surface round-trips the 6 activities; personal production shows only for `isProducingManager`.
- Read rule: owner + upline ALLOW; peer + downline DENY — proven in both emulator tests and the live smoke.
- `jfwCount` reserved in schema, not editable, not shown as an input.
- No index; rule additive (new collection), deployed pre-merge. Lint 0; build green; suite green incl. env-unset parity; smoke green.

## Post-merge

Standard sequence: sync main, capture squash SHA, fill `#TBD`/`{TBD}`, commit + push direct to main, Rule 15 verify. (Rule already deployed pre-merge — no deploy step post-merge.)
