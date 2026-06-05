# Kickoff — Settlements Read Tightening (rules XS)

**Size:** XS–S · **Type:** SECURITY rules change (firestore.rules only + emulator tests)
· **Merge:** HUMAN-MERGE + dispatcher pre-review · **MANDATORY HARD STOP after Phase 1**
(rules diff + emulator matrix + consumer-inventory proof, ZERO other changes) — the #471
pattern. Operator deploys rules pre-merge from the worktree after dispatcher approval.
**Branch:** `fix/settlements-read-scope`

## Context (overnight Item-3 finding, 2026-06-05)
`firestore.rules:521-529` — settlements `allow read: if getTenantId() == tenantId` is
TENANT-WIDE: any signed-in agent can read every peer's settlement docs. Pre-existing,
not introduced recently. Decision: tighten to own-read + manager-tier, mirroring the
submissions pattern.

## Locked decision — D1 target rule shape
- `get/list` allowed when: the requesting agent is the doc's agent
  (`resource.data.agentId == request.auth.uid` for get; list constrained by
  `where('agentId','==',uid)` like the established own-list patterns) OR the caller is
  manager-tier with scope (mirror the submissions/upline pattern exactly — UM same-unit,
  BM same-branch, SM/TA/PA tenant — cite and reuse the existing helpers; do NOT invent a
  new helper if one fits).
- Writes: UNCHANGED (whatever the current write arms are — this slice touches read only).
- No schema, no service, no src changes in this slice.

## Phase 0 — consumer inventory (Rule 17; the safety condition)
Enumerate EVERY client-side settlements read in src/ (services + components):
- For each: which role(s) execute it, what query shape (own-scoped? unit/branch
  aggregate? tenant-wide?), file:line.
- The tightened rule must keep every legitimate shipped read working. If ANY shipped
  agent-role read is broader than own (e.g., an agent surface reading peers'
  settlements), STOP and surface — that is a product question, not a rules patch.
- Confirm CF/Admin readers (leaderboard aggregator etc.) are rules-exempt (Admin SDK).

## Phase 1 — build + HARD STOP deliverable
Rules diff (additive/tightening on the settlements block ONLY — zero other blocks
touched, prove with the diff) · emulator matrix in tests/rules/ (template:
weeklyPlans/nudges suites): agent own get/list ALLOW · agent foreign get DENY · agent
unscoped/foreign list DENY · UM same-unit ALLOW + cross-unit DENY · BM same-branch ALLOW
+ cross-branch DENY · SM/TA tenant ALLOW · cross-tenant DENY · unauth DENY · write arms
unchanged (one sanity case) — target ≥ 14 cases, all green locally · the Phase-0
consumer table. STOP and wait for dispatcher.

## After approval (choreography)
Operator deploys rules pre-merge from the worktree (`firebase deploy --only
firestore:rules`) → CC runs a focused live verification (agent credential: own
settlements still readable on the surface that uses them per the inventory; a foreign
read attempt via SDK probe DENIED — read-only probe, no writes) → full gates → PR →
pre-review → merge → standard fill. No CF, no post-merge deploy.

## Out of scope
Write arms · settlement schema/services · leaderboard anything · Commission S1 (which
reads POLICIES, not settlements — unaffected by design).

## Acceptance
Consumer inventory proves zero legitimate reads broken · emulator matrix green ·
settlements block is the only rules diff · live own-read + foreign-deny verification
post-deploy · Rules 12/15/17/18/19/20 + the hard stop honored.
