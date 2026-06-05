# Kickoff — Commission v2 Slice 1: AnchorStrip (real earnings data layer + strip UI)

**Size:** M · **Type:** REDESIGN slice, READ/DERIVE ONLY (no writes, no new collections,
no rules changes, no indexes without a STOP) · **Merge:** HUMAN-MERGE + dispatcher
pre-review.
**Branch:** `feat/commission-v2-s1`
**Layout authority:** `docs/design/commission-v2-s1.html` (lands with this brief) — the
AnchorStrip sections + the three states + the page promotion. The ladder/Modal-Targeting
restyles are S2; the "Set as my goal" WRITE and manager variant are S3 — all OUT here.
**Dispatch AFTER the settlements-read-scope slice completes** (serial discipline; this
slice reads POLICIES, not settlements — independent by design, but one CC thread).

## Operator decisions in force (2026-06-05)
Run-rate = trailing-8-week annualized, <8 settled weeks → linear-YTD fallback with a
"based on N weeks" provenance chip · gap reference = the committed Goals cascade
personalAnnualAPI (no goal → honest empty state) · ladder/dials terminology =
"Prospecting calls" (S2 concern, but no copy here may say "Dials").

## Locked decisions

### D1 — `src/utils/commissionAnchor.js` (pure; the slice's heart)
- `ytdEarned(policies, year)` — Σ `earnedCommission` over the agent's OWN policies with
  settled status, TT-year scoped. Source canon: policies, NOT settlements (settlement
  docs carry no earned-commission field — overnight Item-3 finding).
- `runRate(policies, today)` — trailing-8-week annualized earned commission. Phase 0
  MUST cite the settled-DATE field on policy docs (settledAt / statusHistory entry /
  equivalent); if no reliable settled-date exists, the trailing window is impossible →
  the designed fallback (linear-YTD + chip) becomes the only arm — implement it, FLAG
  the data gap in the PR, do not invent a date.
- `gapToGoal(committedAnnualAPI, runRate, ratios)` — UNIT CONVERSION LOCKED: the goal is
  API; the anchor is commission TTD. Convert the committed API goal to its first-year
  commission equivalent via the EXISTING commissionMath forward path (characterized
  2026-06-05 — extend nothing, reuse), using the agent's actual ratios where the engine
  takes them. The strip states the basis ("vs your committed goal").
- `latestPersistency(history)` — the persistency model is MONTHLY; the chip shows the
  latest available month's %, labeled honestly ("latest month", not "4-wk").
- Exhaustive unit tests: TT-year boundary, 8-week window edges, exactly-8 vs 7 weeks
  (fallback trigger), zero-settled, conversion correctness against the characterized
  engine values, missing-goal arm.

### D2 — Read paths (zero rules changes; cite each in Phase 0)
Own policies via the EXISTING Policy Ledger own-query path + client-side settled filter
(NO new composite index — if the existing path can't serve this without one, STOP) ·
own persistency via the shipped getAgentHistory · committed goal via the existing goals
read the cascade display already uses. All own-reads on existing rules.

### D3 — AnchorStrip UI + states (per the annotation)
The strip atop the Commission page: YTD earned with the `policies.earnedCommission ·
settled` provenance chip · run-rate with its window chip (trailing-8wk OR "based on N
weeks" fallback) · gap vs committed goal · latest-month persistency chip. Three states:
(1) normal · (2) NO COMMITTED GOAL — honest empty per the annotation, with the CTA
rendered but wired to NAVIGATE to the decomposition ladder only (the write is S3) ·
(3) error/loading. D5/D6 conventions throughout; bell-badge-only axe baseline inherits.

### D4 — Page promotion
The audit found the playground renders behind a collapsed state inside the tab. Promote
to the expanded full-page layout per the annotation (IA only — the existing tabs render
as-is beneath the strip; their restyle is S2). Preserve the collapsed-state tests'
intent via conscious evolution if they encode the collapse.

## Phase 0 — source-verify (Rule 17)
The settled-date field on policy docs (D1's pivotal citation) · the Policy Ledger
own-query path + whether settled-filtering needs an index (STOP if yes) · the goals read
for personalAnnualAPI (cite the field name on the goal doc — verify CD's naming against
reality) · getAgentHistory shape · commissionMath forward-path signature for the
conversion · CD's two flags: the 8-week history-derivation function existence (the
ratio auto-fill the playground already does — cite it) and the prospecting-calls
component-list consistency (no copy regression) · the collapsed-state mechanics + its
tests · the trio baseline surfaces' testids for the smoke (Goals cascade, Persistency
tab — for the certification walk) · A11Y_AGENT credential reaches all three tabs ·
test-agent data state (settled policies with earnedCommission? committed goal?) —
informs the smoke's source-aware arms.

## Phase 3 gates
Lint 0 · full suite (incl. last night's 34 commissionMath + 3 baseline tests
untouched-green) · build · hex-grep · static-CSS on new utilities.

## Smoke (E3 — AGENT credential, both themes) — opens with the trio certification walk
1. TRIO BASELINE (the operator's "fully working for agents" certification): login as
   agent → Goals tab renders the cascade with real data → Persistency tab renders
   real data → Commission tab reachable. Assert render + data presence, read-only.
2. ANCHORSTRIP: source-aware — assert whichever state the test agent's data yields,
   with an independent SDK recompute proving the displayed YTD/run-rate/gap equal the
   derivation (the S3a bar==recompute pattern). If no committed goal exists, the empty
   state + navigate-CTA is the asserted arm (and commit one via Career Portal is OUT —
   do not write).
3. Page promotion verified (strip + expanded layout) · axe NO-NEW vs the bell-badge
   baseline · 0 console errors · §2 screenshots both themes. Read-only; no cleanup
   writes.

## Phase 4 — docs
Standard placeholders · FOLLOW_UPS: S2 (ladder + Modal Targeting restyle; NOTE: the tab
files need their one-line default React imports for RTL — pre-authorize in the S2 brief,
citing last night's PARK) and S3 (the write + manager variant) queued · the trio
certification result recorded against the operator's intent.

## Out of scope
Any write · the ladder/targeting restyles (S2) · "Set as my goal" (S3) · manager
variant · settlements anything · Goals/Persistency changes (certification reads only).

## Acceptance
Anchor values provably equal the independent recompute (smoke) and the characterized
engine (unit) · the settled-date citation or the honest fallback-only arm with the gap
flagged · zero rules/index changes · the three states per the annotation, both themes ·
trio certification walk green · prior test sets untouched-green or consciously evolved ·
Rules 12/15/17/18/19/20.
