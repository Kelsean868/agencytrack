# Kickoff — Compliance v2 Slice 2: Nudge (CF + notifications) + row actions (unlock/view re-home)

**Size:** L · **Type:** REDESIGN slice with NEW COLLECTION + NEW CLOUD FUNCTION (full
architectural-unit checklist: rules + write + read + emulator tests + smoke) ·
**Merge:** HUMAN-MERGE + dispatcher pre-review. **MANDATORY HARD STOP after Phase 1**
(schema + rules + CF signature written, emulator matrix green, ZERO ui build) — the #471
pattern. CC NEVER deploys rules or functions (Rule 19): rules deploy = operator,
pre-merge from the worktree; CF deploy = operator, post-merge.
**Branch:** `feat/compliance-v2-s2`
**Layout authority:** `docs/design/compliance-v2-s1.html` (already on main) — the Nudge
flow, cooldown chip, and Nudge-all confirm sections. Row-action grammar: not-in rows get
Nudge; submitted rows get unlock + view.

## Operator decisions in force (ratified at S1 landing)
Transport = BOTH (doc + email) · dedupe via deterministic IDs + 24h UI cooldown ·
Nudge-all = filtered exception list only, with confirm-count step · no auto-escalation ·
on-time per D2 of S1.

## Locked decisions

### D1 — `sendComplianceNudge` callable CF (functions/index.js)
- Mirrors the resendInviteEmail pattern: actor-role gate (UM/BM/SM/TA via a
  NUDGE_ACTOR_ROLES const), tenant scoping from caller claims, target validation (every
  audienceUid must be in the caller's scope: UM → same unitId; BM → same branchId;
  SM/TA → tenant), Admin-SDK writes.
- Input: `{ audienceUids: string[] (1..50), type: 'compliance.filing.nudge',
  weekStart: 'YYYY-MM-DD' (validated Sunday) }`. One invocation serves both single Nudge
  and Nudge-all.
- Per target, atomically: (a) SET-MERGE
  `tenants/{tid}/notifications/{audienceUid}_{type}_{weekStart}` →
  `{ type, audienceUid, payload:{weekStart, lens:'filing', managerName}, createdBy,
  createdAt: serverTimestamp(), readAt: null }` (re-nudge refreshes createdAt — dedupe is
  structural); (b) mail doc via buildMailDoc to the agent's email (subject/body template:
  professional, names the week, no shaming language — keep copy minimal and kind);
  (c) append `tenants/{tid}/auditNudges/{autoId}` →
  `{ actorUid, actorRole, audienceUid, type, weekStart, at }` (admin-only collection,
  mirrors auditInviteResends).
- Returns per-target results (queued/failed); email failures are NON-FATAL to the
  notification write (the invite precedent's emailQueued shape).
- Functions tests: role gate, scope enforcement (UM cannot nudge outside unit), array cap,
  Sunday validation, doc shapes, email-failure non-fatality.

### D2 — Firestore rules: `tenants/{tid}/notifications/{notifId}`
- create/update: false (CF-only). delete: `request.auth.uid == resource.data.createdBy`
  (enables smoke cleanup + a future retract affordance; audit survives in auditNudges).
- get: `audienceUid == request.auth.uid` OR upline (the #471 uplineCanReadPlan-style
  helper — powers the manager cooldown chip via deterministic-ID GET, index-free).
- list: NONE by design (no index; the agent-inbox feature, if ever, adds it later).
- `auditNudges`: client read/write false (Admin-only).
- EMULATOR MATRIX (extend tests/rules/, the weeklyPlans suite as template): denied client
  create/update on notifications · creator delete allowed, non-creator denied · audience
  get allowed · upline get allowed (UM same-unit, BM same-branch) · cross-unit UM get
  denied · cross-tenant denied · auditNudges fully denied. Target ≥ 18 cases.

### D3 — UI (CompliancePanel rows + bar area)
- NOT-IN rows: Nudge button → confirm none (single) → calls the CF → on success the
  button becomes the cooldown chip "Nudged {relative}" (from the notification doc's
  createdAt via upline GET); chip persists across reload; button re-enables after 24h.
- NUDGE ALL: header affordance on the exception list → CD's confirm step naming count +
  scope ("Nudge N agents — {scope label}?") → one CF call with the filtered uids.
- SUBMITTED rows: re-home UNLOCK (existing unlockSubmission service — re-mount ONLY, zero
  service/rules change; confirm dialog retained) + VIEW (SubmissionViewer) as compact row
  actions per the annotation's action grammar.
- Cooldown reads: on panel load, fan-out deterministic-ID GETs for the not-in set only
  (small N) — never a list query.
- Loading/disabled/error states for every action; D5 conventions (tokens, both themes,
  ≥44px, muted-not-faint); the StatusPill on-tint family stays as-is (contrast-debt FU
  owns it — do not patch here).

### D4 — Phase 1 HARD STOP deliverable (before ANY UI build)
Present: the rules diff · the emulator matrix results (all green locally) · the CF
signature + functions-test results · the notification/audit doc shapes · the deploy
choreography note. STOP and wait for dispatcher. After dispatcher approval, the operator
deploys RULES pre-merge from the worktree (#471 choreography), then Phase 2 proceeds.

## Phase 0 — source-verify (Rule 17)
resendInviteEmail + buildMailDoc + auditInviteResends exact shapes (cite) · agent email
field on users docs (the mail recipient) · the #471 upline helper to mirror · S1's
reserved row-action area + testids · unlockSubmission service + rules that already permit
it (cite; confirm re-mount needs zero changes) · functions test harness location/pattern ·
managerName source for the payload (caller's user doc).

## Phase 3 gates
Lint 0 · full suite · build · hex-grep · emulator matrix green · functions tests green ·
CI (incl. functions-tests job) green.

## Smoke (E3 — BM credential, both themes)
Live walk: Compliance → not-in row → Nudge → confirm CF success → cooldown chip renders
with relative time → RELOAD → chip persists (upline GET proof) → Nudge-all confirm dialog
shows correct count + scope then CANCEL (do not blast; single-nudge already proves the CF
live) → submitted row shows unlock + view actions; click VIEW → SubmissionViewer opens.
UNLOCK live round-trip is WAIVED with justification: pre-existing write path re-mounted
unchanged, and unlocking the test agent's submitted week would corrupt the data state the
S3a/S3b final-arm smokes depend on — wiring is covered by RTL tests instead (assert
handler calls unlockSubmission with the right id behind the confirm). Email delivery:
note in the PR that the operator may verify the test inbox manually (non-gating).
Cleanup: DELETE the smoke's notification doc as the creator (the D2 delete rule),
getDoc-confirm gone. Axe: enumerate-and-accept allowlist (the documented StatusPill
on-tint family + bell badge), zero unexpected serious · 0 console errors (Fontshare
filter in place) · §2 screenshots both themes.

## Phase 4 — docs
Standard placeholders · FOLLOW_UPS: S2 shipped; S3 (plan-adoption lens + lens toggle —
pure read, zero rules changes) is the remaining Compliance slice; note the agent-inbox
as a future consumer of the notifications primitive.

## Out of scope
S3 lens/toggle · plan-type nudges (S3 reuses the CF with type='compliance.plan.nudge') ·
agent-side notification UI · StatusPill/token fixes · any escalation logic · changes to
unlockSubmission semantics.

## Acceptance
Phase-1 hard stop honored with the full deliverable · CF enforces role+scope+cap with
functions-test proof · rules per D2 with the emulator matrix · structural dedupe via
deterministic IDs proven (re-nudge updates createdAt, no second doc) · cooldown chip
live-proven across reload · unlock/view re-homed with RTL wiring proof + waiver rationale ·
Nudge-all confirm proven to the cancel point · cleanup confirmed gone · Rules
12/15/17/18/19/20 + deploy choreography exactly as written.
