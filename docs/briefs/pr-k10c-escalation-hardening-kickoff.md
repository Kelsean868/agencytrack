# PR-K10c - Escalation Hardening: get()-bindings + BM Bell Ping

run_model: claude-opus-4-8
size: M
track: K (fast-follows banked at #779 post-merge)
rules_change: YES | functions_change: YES (new CF)
deploy_required: YES - MANUAL by Kyron post-merge
  (firebase deploy --only firestore:rules,functions)
channel: HUMAN-MERGE. NEVER auto-merge. Build to PR-open and HOLD - no exception
  under any window authorization.

## Intent - two fast-follows, one deploy event
A. RULES get()-BINDINGS (closes two trust residuals on financingEscalations create):
   1. branchId binding (the banked FU): request.resource.data.branchId must equal
      get(/databases/$(database)/documents/tenants/$(tenantId)/users/
      $(request.resource.data.agentId)).data.branchId - a UM can no longer misroute
      an escalation to another branch's BM.
   2. unitId binding (dispatcher upgrade): the same get()'s .data.unitId must equal
      request.auth.uid - closing the deeper hole that a UM could raise on ANY agentId
      while claiming their own unit (the current arm binds agentUnitId==auth.uid but
      never checks the agent actually belongs to that unit). One get() serves both
      bindings (same doc; rules dedupe repeated get()s of one document).
B. BM BELL PING (banked at #779; CF-side per dispatcher ruling, NOT client-write):
   New gen-1 CF onFinancingEscalationCreate: on create of
   tenants/{tid}/financingEscalations/{id}, write a notifications doc to each
   branch_manager user in that tenant whose branchId == doc.branchId (mirror the
   onWarSubmitNotifyUpline recipient-lookup + notification-shape precedent,
   functions/index.js / onWarSubmitNotifyUpline.js). Ping only - the escalation doc
   remains the record. No notification on ack (minimal slice).

## Phase 0 (STOP on any miss)
0.1 Cite the current create arm + confirm no get()-binding exists yet. Cite the
  callerBranchId helper as the in-file get() precedent, and any sibling rule doing a
  cross-doc get() on request.resource data (precedent for cost/pattern).
0.2 Cite onWarSubmitNotifyUpline's recipient lookup + notification doc shape + its
  test file (functions jest) as the CF template.
0.3 Confirm the emulator matrix file (financingEscalations.rules.test.mjs, 20 cases)
  and that the harness supports seeding the agent user doc the get() will read.
0.4 Confirm the smoke tenant's A11Y accounts still satisfy agent.unitId==UM.uid and
  agent.branchId==BM.branchId (the #779 post-deploy probe pattern) - the post-deploy
  smoke reuses them.

## Phase 2
2a. Rules: add both bindings to the create arm. Consider the failure UX: a binding
  miss surfaces as permission-denied, which the service currently maps to
  "already raised" - extend the service's pre-write validation to check the roster
  row's agentUnitId/branchId coherence first so the misleading mapping is rare, and
  note the residual.
2b. Emulator matrix: +cases - forged agentId (agent in another unit, agentUnitId
  claimed as own) DENY; wrong branchId (string but not the agent's real branch) DENY;
  correct-binding create still ALLOW; agent doc missing branchId -> DENY (fail closed).
2c. CF: onFinancingEscalationCreate + functions jest test (recipient lookup mocked,
  notification shape asserted, idempotence: CF must tolerate re-delivery without
  duplicate-spamming - use the escalation doc id in the notification dedupe key or
  document why not).
2d. No client changes expected beyond the service pre-write validation (2a).

## Phase 5 - split smoke (deploy-gated, same as #779)
PRE-MERGE: emulator matrix (now ~24 cases) green - paste full result; functions jest
  green; lint/suite/build; UI smoke NOT needed (no UI change beyond service internals)
  but run the existing K10b UI smoke once against preview as a regression check.
POST-DEPLOY (banked FU with exact steps, Rule 13 waiver in PR body):
  re-run the write-read-ack live cycle (#780's smoke) - must still pass 7/7 with
  bindings live; add legs: forged-agentId raise DENIED live; BM receives the bell
  notification doc (value-level: recipient uid, escalation id in payload); cleanup
  incl. the notification docs, 0 orphans.

## Standing
HOLD at PR-open - human merge -> Kyron deploys rules+functions -> post-deploy smoke ->
/post-merge. Rule 21: trigger Gemini on-demand (rules PR). Rule 22 >=1 gap. Rule 23:
every new DENY case must genuinely deny. Strike 0/2.
