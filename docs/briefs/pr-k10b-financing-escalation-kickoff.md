# PR-K10b - EscalateToBM (financingEscalations: tracked/ack record)

run_model: claude-opus-4-8
size: M
track: K (deferred half of K10)
depends_on: K10a #769 merged; fu-financing-display-polish MERGED (hard gate, Phase 0.0)
rules_change: YES (new collection block) | data_model_change: YES (new collection + index #22)
deploy_required: YES - MANUAL by Kyron post-merge (firebase deploy --only firestore:rules,firestore:indexes)
channel: HUMAN-MERGE, never green (rules change)

## Intent
Wire the K10a-deferred "Flag to BM": a UM raises a TRACKED escalation on a unit agent's
financing; the same-branch BM sees an inbox and ACKS it. Net-new collection
financingEscalations + rules + composite index + drawer/roster wiring + BM inbox subview.
Recon: recon report @ 58de123e (all citations below are its anchors - re-verify each).

NAMING: prefix everything financingEscalation*. functions/war/escalationLogic.js owns
bare "escalation" for a DIFFERENT concept (WAR missed-standard upline notify) - do not
reuse or import its symbols.

## Decisions locked (do not re-litigate)
- Flat collection /tenants/{tid}/financingEscalations/{escalationId}.
- Doc ID = `${agentId}_${reason}_${YYYY_MM}` (idempotent per month; re-raise allowed in a
  later month; nudges-key precedent).
- States: 'open' -> 'acknowledged'. Nothing richer. allow delete: if false.
- Reasons enum: ['draw_decision','confirm_request','notify_5_3','termination_risk'].
- Inbox only - NO notification-bell ping this slice (banked FU; CF-side if taken).
- BM surface = new FinancingTab subview { id:'escalations' } (inherits BM-only gating).
- Schema per recon table: tenantId, agentId, agentName, agentUnitId (== creating UM uid),
  branchId (denorm - the BM read key), raisedByUid/Name/Role, reason, note (trim, cap
  2000 like coachingNotes), status, createdAt, acknowledgedByUid/At (absent until ack).

## Phase 0 - Gates + falsification (STOP on any miss)
0.0 SEQUENCING GATE: `gh pr list --state open` - if fu-financing-display-polish (or any
  open PR touching UnitFinancingRoster.jsx / AgentFinancingDrawer.jsx /
  unitFinancingRoster.js) is OPEN, STOP - dispatcher must rule merge order first.
0.1 Net-new confirmed: grep financingEscalation across src/ functions/ firestore.rules
  firestore.indexes.json -> zero hits (recon verified; re-verify on current main).
0.2 Re-verify recon anchors at current line positions (display-polish will have shifted
  them): drawer disabled Flag button (AgentFinancingDrawer.jsx ~:180-191, testid
  unit-financing-drawer-flag), drawer props {row,onClose,onCoach}, roster drawer mount +
  onCoach threading, assembleRosterRow field set (unitFinancingRoster.js ~:96-131).
0.3 Rules precedents present: coachingNotes block ~firestore.rules:910-961 (UM-own-unit
  create + agent-never-reads), nudges branch arm ~:1548-1549, callerBranchId helper ~:64,
  notifications hasOnly field-restricted update (SEC-10).
0.4 Emulator harness: tests/rules/financing.rules.test.mjs + coaching-notes.rules.test.mjs
  exist; @firebase/rules-unit-testing in package.json; run command
  `firebase emulators:exec --only firestore "node tests/rules/<file>"`; NOTE rules tests
  are NOT in CI - the emulator matrix is a mandatory LOCAL pre-merge gate.

## Phase 1 - branchId completeness probe (HARD GATE - recon Rule-22 gap #1)
The BM inbox keys on where('branchId','==',callerBranchId). Recon confirmed the field is
queried (managerService.js:48) and written at creation (functions/index.js:195) but never
sampled real docs. Before building: read-only Admin-SDK sample of agent user docs in
tatillife_smoke AND tatillife_south - count agents with null/missing branchId.
- If complete (or trivially fixable in smoke tenant): proceed.
- If sparse in real data: STOP and surface. Fallback options for dispatcher ruling:
  (a) backfill branchId on user docs, (b) BM reads tenant-wide (coachingNotes peer-BM
  limitation precedent, firestore.rules:904-906). Do NOT silently pick one.

## Phase 2 - Build
2a. Service src/services/financingEscalationService.js: createFinancingEscalation
  (setDoc on composite ID - reject/surface if an OPEN doc already exists for the key;
  a previously acknowledged doc for the same key means same-month re-raise -> surface
  the "already raised this month" state to the UI, do not overwrite), 
  listBranchEscalations (BM inbox query), acknowledgeFinancingEscalation (field-
  restricted update: status/acknowledgedByUid/acknowledgedAt only). All take explicit
  tenantId. parseFloat n/a (no numerics beyond timestamps).
2b. Rules block per the recon draft (create: UM-only, agentUnitId == auth.uid,
  raisedByUid == auth.uid, status=='open', reason in enum, keys().hasAll([...]);
  get/list: SM/TA/PA, or BM with resource.data.branchId == callerBranchId(tenantId);
  UM NO list arm; agent excluded entirely; update: same readers, diff().affectedKeys()
  .hasOnly(['status','acknowledgedByUid','acknowledgedAt']) && status=='acknowledged';
  delete false). Add the tenantId==path validation like sibling blocks.
2c. Index #22 in firestore.indexes.json: financingEscalations COLLECTION
  (branchId ASC, status ASC, createdAt DESC). ALSO enumerate the smoke's own query
  shape (Phase 5 seeds/verifies by agentId?) - if it differs, add that index in the
  SAME PR (PR #231 lesson).
2d. UM wiring: replace the disabled drawer button with a live control -> minimal
  reason(enum select)/note form -> createFinancingEscalation. Thread an onFlag handler
  through the roster drawer mount (mirror onCoach). Add the flag action on flagged
  rows' risk cards per the CD sheet ("Flag to Branch Manager" beside Coach).
  EXTEND assembleRosterRow to carry agent?.branchId (one line beside the agentUnitId
  denorm) - this is the recon's branchId-gap fix. After ack or same-month duplicate,
  the drawer shows state, not a dead button.
2e. BM inbox: FinancingTab SUBVIEWS + { id:'escalations' } + FinancingEscalationInbox
  component: open-first list (agentName, reason label, raisedByName, age), Acknowledge
  button (BM same-branch), acknowledged section collapsed. Loading/error/empty all
  handled; empty = "No open escalations."
2f. Read the CD sheet + README Screen-2 section end-to-end before building the inbox
  visuals (recon gap #2) - follow its annotations where they exist; Nexus tokens.

## Phase 4 - Emulator rules matrix (MANDATORY local pre-merge gate)
tests/rules/financingEscalations.rules.test.mjs mirroring coaching-notes matrix. Minimum
cases: UM own-unit create ALLOW / other-unit DENY / agent create DENY / agent read DENY /
BM same-branch list ALLOW / BM other-branch DENY / UM list DENY / SM+TA read ALLOW /
BM same-branch ack ALLOW / other-branch ack DENY / ack touching extra fields DENY /
status value must DIFFER in the ack deny-test (hasOnly gotcha, PR #365) / delete DENY /
cross-tenant DENY / create with status!='open' DENY / reason outside enum DENY.
Run via emulators:exec; paste the full matrix result in the PR body.

## Phase 5 - Smoke: SPLIT (deploy dependency)
PRE-MERGE (preview, no rules deployed): UI-level only - drawer form renders, roster flag
  action present, inbox subview mounts for BM, UM cannot see the BM financing tab
  (existing gate). The WRITE path cannot be prod-smoked pre-deploy - state this
  explicitly in the PR body as a Rule 13 acceptance-criteria waiver.
POST-DEPLOY (separate step, after Kyron runs firebase deploy --only
  firestore:rules,firestore:indexes and confirms index Enabled in console):
  full write-read-ack cycle as real subjects in tatillife_smoke - UM raises on an
  in-unit agent (value-level doc assert incl. branchId), out-of-unit raise fails,
  agent signed-in cannot read it, BM same-branch sees + acks (status flip asserted),
  same-month duplicate surfaces the raised state. Cleanup, 0 orphans. Bank this as a
  deferred-verification FU with exact re-run steps at PR-open.

## Standing
Rule 19: HOLD at PR-open - human merge, then MANUAL deploy by Kyron, then post-deploy
smoke. CC never merges/deploys. Rule 21 poll + disposition. Rule 22 >=1 gap. Rule 23:
the emulator matrix IS the falsifier set - every DENY case must actually DENY.
Strike 0/2.

## Self-critique seed
- The Rule 13 waiver (write-path unsmoked at merge) must be unmissable in the PR body.
- If Phase 1 finds sparse branchId, everything after it is blocked - that is the
  designed outcome, not a failure.
- The same-month duplicate UX (raise blocked after ack) is a product judgment call
  locked by dispatcher ruling #2 - surface any awkwardness found in practice rather
  than redesigning the key.
