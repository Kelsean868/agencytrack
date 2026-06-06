# Kickoff — Night Queue: Persistency S2 to PR-OPEN + program grounding

**Type:** overnight autonomous queue (~10h window) under the STANDING GREEN CHANNEL +
NIGHT RULES D1–D5 (per-item premise fail → park + continue · new-decision questions →
SKIP + log MORNING DECISIONS · full halt only for circuit-breaker / unrecoverable prod /
env loss / hard lines: rules, functions, schema, any Firestore write OUTSIDE the
established capture→write→verify→restore smoke pattern). Serialize ALL smokes. Hardened
harness mandatory. Env checks run from the CANONICAL worktree (C:\Projects\AgencyTrack)
— .env.local never propagates to worktrees. Channels per item; CC never self-promotes.
Two-revert circuit breaker. Strike count starts 0/2.

## Execution order: 0 → B → A → C → D → E

---

### ITEM 0 — #505 post-merge fill · conditional
If origin/main contains the #505 squash (operator merges before bed): run the full
/post-merge 505 sequence with the two addenda — (1) deferred Coach-drawer leg FU
("n/a in preview env, no at-risk rows; closes when at-risk data exists"), (2) the
walk-helpers token-capture promotion FU (Item B executes it tonight — reference
forward). If #505 is NOT merged: SKIP, log MORNING DECISIONS, and PARK Item A
(its premise is S1 on main).

### ITEM B — walk-helpers token-capture promotion · GREEN (verification-infra,
AUTO-MERGE, pre-authorized by this brief)
**Branch:** `test/walk-helpers-token-capture`
Promote the S1 smoke's bearer-token capture (addInitScript window.fetch patch +
IndexedDB Firebase-Auth fallback) into walk-helpers.mjs as a reusable export
(captureBearerToken or similar). Refactor persistency-mgr-v2-s1-smoke.mjs to consume it
(behavior-identical). Scope: scripts/verification/** ONLY — zero src changes. Gates:
lint · the refactored S1 smoke re-run green against PRODUCTION (read-only legs only —
prod is post-#505 if Item 0 ran; if #505 unmerged, re-run against main's prod state and
note) · close the micro-FU. AUTO-MERGE on self-pass (scripts-only class).

### ITEM A — Persistency S2 → PR-OPEN · HUMAN-MERGE (the anchor; run ALL phases, HOLD)
Execute `docs/briefs/persistency-mgr-v2-s2-kickoff.md` in full (it is on main), with
this NIGHT RIDER folded into its smoke:
- The sentinel six-input values SHALL produce a BELOW-FLOOR derived % (~70%: e.g.
  realistic gross with net at 0.70×). While the sentinel is live (between WRITE and
  RESTORE): assert the at-risk book renders the agent, exception-first ordering holds,
  and COACH opens CoachingNotesModal with the right agent props — closing the deferred
  Coach/at-risk legs from #505 in the same sanctioned write window. Then RESTORE per
  the brief (byte-exact or DELETE-if-absent; PASS/FAIL leg).
- OPTIONAL extension (skip if restore surface balloons): sentinel months for ONE
  additional agent (distinct values) → the == recompute leg at n≥2 resolved proves the
  summed-vs-mean distinction LIVE; restore/delete both. If skipped, say so — the unit
  anti-mean fixtures remain the D1 proof.
- Phase-0 first item is pre-answered (entry preserved: PersistencyTab.jsx:302–320 +
  PersRoster.jsx:199–209 Edit action) — re-cite to confirm currency, then proceed.
All gates + smoke green → OPEN THE PR with full evidence (itemized smoke table, the
sentinel-window leg results, restore proof) and HOLD. DO NOT MERGE — write-surface
restyle is human-class. Use Item B's helper for the recompute leg's token.

### ITEM C — Persistency S3 prep probe · GREEN (audit-only, report)
Grounding for the playground + the program's first nudge-CF extension. Verdicts with
file:line: the nudge CF allowlist current shape + where 'persistency.recommendation'
(or similar) would slot (functions/compliance/ pattern) · buildMailDoc template
structure + what a persistency-recommendation template needs · the notifications/nudges
write artifacts (the 4-artifact pattern) for reuse citations · the Policy Ledger
filtered-view link target for the degraded at-risk arm (route/params) · the at-risk
sub-states FINAL verdict from the Policy Ledger schema (grace/NSF/missed-payment:
EXISTS where, or 'lapsed'-only — cite) · the what-if lever→input mapping feasibility
(the derivation function's signature accepts the adjusted inputs cleanly?). No branch.

### ITEM D — Goals-mgr grounding probe · GREEN (audit-only, report)
The next program arc's facts: tier-goal write paths today (the setters for
unit/branch/SM tiers — signatures, callers, rules arms) · provenance field census
COMPLETE per tier (setBy/setByName/setAt — which tiers have what) · recommend-vs-lock:
confirm mode-field ABSENT everywhere + enumerate where a mode would live per tier doc ·
the manager GoalsPanel/GapAnalysis manager-side current state (components, mounts,
styling era) · cascade resolution helpers · tenureFloors consumption points for the
roster banding · Self-tier storage candidates (the manager's own goal doc shape today —
factual options only, the judgment stays parked) · the coaching recommend drawer's
write site (what it writes — the reuse candidate for recommend-a-target). No branch.

### ITEM E — Branch/worktree hygiene sweep · GREEN (housekeeping, AUTO-MERGE if any
commit needed; else report-only)
Run the standing cleanup per docs/runbooks/branch-cleanup.md +
scripts/maintenance/prune-merged-branches.mjs: prune gone-upstream locals (skip
worktree-attached), enumerate surviving stale branches with verdicts, report. Detach
any of this session's worktrees left on merged branches.

---

## MORNING DECISIONS — expected contents (log, never resolve)
Item C verdicts that are judgments (sub-states arm selection if schema is ambiguous;
nudge type naming) · Item D's parked judgments (Self-tier storage, lock enforcement
semantics) flagged with the new facts attached · anything parked · the S2 PR's
merge-readiness one-liner.

## End-of-night report
Per-item status table · PR links + SHAs (Rule 20) · auto-merge evidence (Item B/E) ·
the S2 itemized smoke table with the sentinel-window legs · restore-proof lines ·
MORNING DECISIONS · strike count.
