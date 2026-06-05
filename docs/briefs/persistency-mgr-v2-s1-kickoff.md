# Kickoff — Persistency Manager v2 Slice 1: Reality Bar + At-Risk Book + Banded Roster

**Size:** M · **Type:** REDESIGN slice (manager program #1), READ/DERIVE ONLY — no
writes, no rules changes, no CF, no indexes (STOP on any) · **Merge:** HUMAN-MERGE +
dispatcher pre-review.
**Branch:** `feat/persistency-mgr-v2-s1`
**Layout authority:** `docs/design/persistency-mgr-v2-s1.html` (lands with this brief).
OUT of S1: the entry-drawer restyle (S2 — the shipped manager-wins write is untouched
and remains reachable wherever it lives today), the what-if playground + share-as-
recommendation (S3), any agent-surface change.

## Locked decisions

### D1 — Scope aggregate math (the honest %)
Scope persistency % = the SHIPPED six-input derivation applied to SUMMED inputs across
the roster's resolved docs for the month (sum gross/net settled API, lapses,
reinstatements, in-force, issued → run the existing formula once) — NOT the mean of
per-agent percentages. Exposure-weighted by construction. Same rule for each month of
the 6-month spark. Phase 0 cites the derivation function; reuse it, never transcribe.

### D2 — Fan-out + partial-resolution semantics (locks the CD flag)
Roster resolution + per-agent monthly GETs follow the Compliance v2 deterministic
fan-out pattern (cite and reuse its roster/scope helpers). Partial resolution is a
FIRST-CLASS state per the annotation: render the resolved subset, show an "N
unresolved" chip on the bar, and agents without a doc for the month are "no data" —
they appear in the roster with a no-data treatment, are EXCLUDED from the % aggregate
and from below-floor/eligible counts, and the bar's counts state their coverage
("of M with data"). Never zero-fill, never silently drop.

### D3 — The bar, the book, the roster (per the annotation)
- Reality bar: month picker + Unit/Branch scope, aggregate % + 6-mo spark, below-floor
  count (<80), award-eligible count (≥90), lapses-this-month (summed count).
- At-risk book: exception-first, agents <80 lead. Per-row "lapsed this month": Phase 0
  cites whether a lapsed-TTD AMOUNT exists on the monthly doc; if only the lapse COUNT
  exists, the row shows the count and the TTD framing is dropped (flag in PR, no
  invented amounts). Row actions: COACH wired to the existing coaching-notes drawer
  (cite, reuse); the PLAYGROUND action is HIDDEN until S3 — no dead buttons.
- Roster: every agent's % on the two-tick band (danger floor tick 80 + success gate
  tick 90 — reuse the pace-row tick grammar primitives, cite), source badge from the
  verified fields (enteredByRole / lockedByManager / editedAt): "Manager · locked" vs
  "Self-entry · <date>", neutral text-ink-muted (informational — self-entry is
  KEEP-for-pilot, ratified).

### D4 — Roles and scope switching
Primary: UM (unit scope) and BM (unit/branch toggle) via the established role-scope
resolution. SM: reuse the existing SM branch-picker pattern (cite the leaderboard's) if
it drops in cleanly; if it exceeds a thin reuse, ship UM/BM and bank the SM arm as an
FU — say which in the report.

### D5 — States
Skeleton · empty (all-above-floor celebration arm per annotation) · partial-fan-out
(D2) · no-data month. Both themes, D5/D6 conventions, bell-badge-only axe baseline.

## Phase 0 — source-verify (Rule 17)
The current manager persistency surface (component, mount, what it renders today — the
inventory this redesign replaces/extends; cite) · the six-input derivation function ·
the monthly doc field census (the six inputs + enteredByRole/lockedByManager/editedAt +
any lapsed-amount field — the D3 verdict) · manager-tier read rules for persistency
docs (the entry flow implies they exist — cite the block; STOP on any gap) · the
Compliance fan-out helpers · the coaching drawer call site · the pace-tick primitives ·
testids + BM credential reach · test-tenant data state (which agents have months — the
smoke's source-aware arms).

## Phase 3 gates
Lint 0 · full suite (new derive-util unit suite: summed-input aggregate vs hand-computed
fixtures, partial-resolution exclusions, spark windowing, count rules) · build ·
hex-grep.

## Smoke (E3 — BRANCH MANAGER credential, both themes, source-aware)
Bar renders for the data month → the == leg: SDK-read the same roster docs, recompute
the aggregate via the derive util, assert bar % / below-floor / eligible / lapses ==
recompute exactly · roster bands + ticks render with source badges matching doc fields ·
at-risk ordering correct vs the data · partial/no-data arms asserted as the data yields
(never forced) · Coach opens the existing drawer · axe NO-NEW vs bell badge · 0 console
errors · §2 screenshots. Read-only.

## Phase 4 — docs
Standard placeholders · FOLLOW_UPS: S2 (drawer restyle) + S3 (playground + nudge write,
CF-allowlist choreography per the Compliance pattern; suggest-a-goal noted as the cheap
sibling after) queued · any D3/D4 degradations banked.

## Acceptance
Bar values provably equal the independent recompute · D1 math (summed inputs, never
mean-of-percents) enforced in unit fixtures · D2 semantics visible in the UI states ·
verified-field source badges · zero rules/CF/index/write changes · Rules
12/15/17/18/19/20.
