# PR-B3 - planSuggestions: Suggest-Back Loop (Fork B slice 3)

run_model: claude-opus-4-8
size: M
track: Game Plan manager review (Fork B), slice 3 of 3
depends_on: B1 MERGED + DEPLOYED (the uplineCanReadUserPlan helper must exist in LIVE
  rules - hard gate); B2 MERGED (the drawer this extends). Recon @ B3-prep report.
rules_change: YES (new subcollection block) | data_model_change: YES (new collection,
  NO composite index - see locked shape)
deploy_required: YES - MANUAL by Kyron (firebase deploy --only firestore:rules)
channel: HUMAN-MERGE (rules + a manager->agent write path)

## Intent
Close the Fork B loop: a manager reading an agent's plan can send a plan-level
suggestion; the agent sees it on their Game Plan hub and marks it seen. The agent
still commits their own plan - suggestions are advice, never control.

## Locked design (dispatcher rulings on the B3-prep recon - do not re-litigate)
- Collection: /tenants/{tid}/users/{agentId}/planSuggestions/{suggestionId} - sibling
  of yearPlan/monthlyPlan/prospectInfo.
- Schema (exact): tenantId, agentId (== path), year (required, plan year), note
  (free-text, trim, cap 2000 - coachingNotes precedent), raisedByUid (== auth.uid),
  raisedByName, raisedByRole, status ('open'|'seen'), createdAt, seenAt (null until
  ack). Nothing else - the mockup draws ONE free-text note; no reason enum, no
  line/month attachment, no severity.
- Rules (the recon's drafted block is the spec, refined):
  * get/list: agent-own (auth.uid == agentId) OR uplineCanReadUserPlan(agentId) -
    reuse B1's helper VERBATIM (Phase 0 confirms its landed name/shape).
  * create: uplineCanReadUserPlan(agentId) AND raisedByUid pinned to auth.uid AND
    agentId/tenantId path-bound AND status=='open' AND keys().hasAll([...the nine]) -
    AND NOT the agent (auth.uid != agentId; no self-suggestions).
  * update: AGENT-ONLY ack - auth.uid == agentId, resource open, diff hasOnly
    (['status','seenAt']), new status 'seen'. Managers never update.
  * delete: false.
- Authorship symmetric with the read arm (any upline reader; mockup draws only UM but
  rules nothing out - ruled symmetric).
- Status lifecycle: open -> seen ONLY. No considered/resolved.
- NO composite index: reads are path-scoped orderBy(createdAt,'desc'), unread
  client-filtered. If any phase finds itself wanting where('status')+orderBy or a
  collectionGroup ("suggestions I've sent" inbox), STOP - that is a different PR.
- NO notification ping this slice (banked fast-follow, K10b precedent).
- Agent surface: PlanSuggestionsCard on the GamePlanV2 hub (index.jsx ~:310-342 slot,
  after PlanCascade). Newest-first, unread emphasized; opening/viewing marks seen
  (writes the ack). Empty state: render nothing or a quiet zero-state - no nagging.
- Manager surface: "Send suggestion" card/section added to B2's AgentPlanDrawer
  (Year Plan tab footer or drawer footer - match the mockup's hub-level framing,
  gameplan-pages.jsx:69-85 as the visual reference): free-text box + Send, gold
  SUGGEST A CHANGE eyebrow, disabled-with-reason when the plan is unavailable.
  B2's dynamic focus-trap enumeration must pick the new controls up automatically -
  assert it, don't re-implement it.
- Clarity invariant (#786): agent hub card = agent's own data on an unmasked surface?
  NO - suggestion notes discuss the agent's financial plan; the PlanSuggestionsCard
  container gets data-clarity-mask="True" + a MASKED_SURFACES guard entry + the docs
  line. The drawer-side card is inside the already-masked panel (state which applied).

## Phase 0 - Gates + falsification (STOP on any miss)
0.1 B1 gate: uplineCanReadUserPlan landed in firestore.rules on main AND deployed
  (cite the merged lines; confirm deploy via a trivial live read as a manager subject
  or the B1 post-deploy smoke's recorded result). If B1 is unmerged or undeployed:
  STOP - B3's every arm depends on it.
0.2 B2 gate: AgentPlanDrawer tab shell + dynamic focus trap merged (cite lines).
  If B2 is open/unmerged: STOP - the manager card has no home.
0.3 The recon's own falsifier: grep gameplan-*.jsx + the v2 HTML for
  manager.*note|feedback|coaching|from your manager - confirm the agent-side
  suggestion surface is genuinely undrawn (the hub-card design is ours, not the
  mockup's). If a drawn affordance surfaces, follow it instead and say so.
0.4 Precedent anchors at current lines: financingEscalations block (create pinning +
  hasOnly ack + delete:false), prospectInfo agent-read arm, coachingNotes note-cap
  validation, the GamePlanV2 hub fragment + card seams, the Clarity mask guard's
  MASKED_SURFACES list.

## Phase 2 - Build
2a. Rules block per the locked spec, inside the users/{agentId} tree.
2b. Service planSuggestionsService.js: createPlanSuggestion (manager-side; explicit
  tenantId+agentId+year; trim/cap note), listPlanSuggestions (agent + manager reads,
  orderBy createdAt desc), markSuggestionSeen (agent ack). Denied -> neutral mapping
  on all reads.
2c. PlanSuggestionsCard (agent hub) + the drawer Send card (manager) per locked
  design. Loading/error/empty everywhere; TTD/date conventions n/a beyond timestamps
  (DD-MM-YYYY on display).
2d. Unit tests: service arg-shape; card render incl. unread emphasis + mark-seen
  write; the mask-guard entry (Rule 23: demonstrate the guard red once).

## Phase 4 - Emulator matrix (new block; lift the persona set from B1's expanded harness)
agent reads own ALLOW / other-agent DENY / UM same-unit read+create ALLOW / UM
other-unit DENY / BM same-branch ALLOW / BM other-branch DENY / SM+TA+PA create ALLOW
(symmetric ruling) / AGENT create DENY (no self-suggestions) / forged raisedByUid DENY
/ create missing keys DENY / create status!='open' DENY / agent ack ALLOW (open->seen,
hasOnly) / manager ack DENY / ack extra fields DENY / re-ack (already seen) DENY /
delete DENY / cross-tenant DENY. Paste the full table in the PR body.

## Phase 5 - Split smoke (deploy-gated; K10b/B1 pattern)
PRE-MERGE (preview): emulator matrix green; UI legs - manager drawer shows the Send
  card (focus trap cycles it); agent hub renders the card's empty state; B2's smoke
  re-run as regression; both themes; PRIVATE-absence unaffected.
POST-DEPLOY (Rule 13 waiver + deferred FU, exact steps): live cycle as real subjects -
  UM sends on an in-unit agent (value-level doc assert incl. pinned raisedByUid);
  agent sees it unread, opens, marks seen (status flip + seenAt live); out-of-unit UM
  create DENIED; agent self-create DENIED; manager ack DENIED; cleanup 0 orphans.
  OPERATOR OPTION: additive-arm pre-merge deploy carve-out applies if Kyron wants the
  live legs pre-merge.

## Standing
Rule 19 HOLD at PR-open -> human merge -> operator deploy -> post-deploy smoke ->
/post-merge (bank the notify-on-send fast-follow + close Fork B's tracking entry).
Rule 21: Gemini on-demand (rules PR) + the pre-merge final poll. Rule 22 >=1 gap.
Rule 23: every DENY genuinely denies; the mask guard demonstrated red. Strike 0/2.
