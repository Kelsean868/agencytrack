# Kickoff — Compliance v2 Slice 1: filing reality bar + exception list + streak roster (read/derive only)

**Size:** M · **Type:** REDESIGN slice, READ/DERIVE ONLY (no writes, no new collections,
no CF, no rules changes, no indexes without a STOP) · **Merge:** HUMAN-MERGE + dispatcher
pre-review (first slice of a redesigned manager surface).
**Branch:** `feat/compliance-v2-s1`
**Layout authority:** `docs/design/Compliance-v2-Build.html` (lands with this brief) —
S1 implements the FILING-lens portions only. The lens toggle, Nudge affordances, and
plan-adoption lens are S2/S3 and OUT of scope (see below).

## Context
First full redesign track from the Track-J reclassification. CD's mechanics spec is
grounded by the 2026-06-04 combined probe; S2 (notifications CF + collection) and S3
(plan-adoption lens) queue behind this slice. The operator's six product defaults lock at
landing; D2 below is the load-bearing one.

## Locked decisions (dispatcher; grounded citations from the probe)

### D1 — Data layer: extend the existing two-fetch pair, nothing new
- Base reads: `getWeeklySubmissions(tenantId, week)` + `getTenantUsers(tenantId)` —
  the exact pair CompliancePanel already uses (CompliancePanel.jsx:132). Reuse its
  derivations: submitted = status==='submitted'; pending; missing = roster minus
  submitted set (:147-186). CBTT via `cbttComplianceFlag(u)` (:188-197) unchanged.
- STREAK WINDOW = 8 weeks (matches the WARs consistency idiom). Phase 0 determines the
  cheapest multi-week submissions read: an existing range query / index on weekStarting
  if one exists, else N×getWeeklySubmissions over getRecentSundays(8). If a NEW composite
  index would be required, STOP and surface — do not add indexes inside a read-only slice.

### D2 — On-time semantics (operator default; overridable pre-landing)
on-time ⇔ submittedAt ≤ Sunday 23:59:59 AST immediately following the covered week
(week = Sun–Sat; in before the Monday review). late ⇔ submitted after that. not-in ⇔ no
submitted report. submittedAt is a Firestore Timestamp written serverTimestamp() at
submissionService.js:149 — consume via .toDate(). NO deadline concept exists in the repo
today (validators.js has only validateSundayDate/getRecentSundays) — this slice CREATES
the definition: implement it ONCE in a new pure util (D4), never inline.

### D3 — Surface composition (filing lens only)
1. REALITY BAR: filed % · on-time · late · not-in — per the annotation's filing lens,
   WITHOUT the lens toggle (that arrives in S3 with plan data; no dead UI).
2. EXCEPTION-FIRST NOT-IN LIST: per the annotation, but WITHOUT Nudge buttons (S2 ships
   the action; reserve the row space/affordance area per the annotation so S2 slots in
   without re-layout). S1 = see the truth; S2 = act on it.
3. ROSTER: status pill (on-time/late/not-in) · submitted time · 8-week on-time streak.
   Row click opens the SHARED 5-tab coaching drawer — reuse, never rebuild (Phase 0
   locates the shared component and confirms it mounts from a Compliance row).
4. CBTT: kept as its own labeled section (operator default #5), reusing the existing
   cbttComplianceFlag list presentation, restyled to the annotation's grammar.

### D4 — New pure util `src/utils/complianceDerive.js`
isOnTime(submission, weekStart) · classifyWeek(...) → on-time|late|not-in ·
onTimeStreak(submissionsByWeek, weeks=8) — pure, TT-safe (parseDateOnlyTT/getTodayTT
class helpers; the deadline boundary is exactly the UTC-4 trap), no React/Firebase.
Exhaustive unit tests: boundary at Sunday 23:59:59 vs Monday 00:00:00 AST, missing weeks
break streaks, drafts are not-in, multi-week ordering.

### D5 — Conventions
Nexus tokens only · both themes · ≥44px · text-ink-muted never text-ink-faint ·
stable testids · no inline styles beyond the dynamic-width precedent.

## Phase 0 — source-verify (Rule 17)
The multi-week fetch shape (D1; STOP on new-index requirement) · the shared coaching
drawer component (location, props, mount pattern from a row) · CompliancePanel's current
mount point + nav (this slice REPLACES the panel's presentation in place — confirm route/
tab and any other consumers of the panel) · existing CompliancePanel tests baseline ·
the annotation's filing-lens sections vs this scope (flag redesign-class deltas
stop-on-contradiction) · BM smoke credential reaches the panel (probe item e cites
A11Y_BRANCH_MANAGER; re-confirm nav path).

## Phase 2 — build
complianceDerive.js + tests · the three D3 sections per the annotation · loading/error/
empty states (empty roster, zero submissions week, all-on-time week) · preserve any
load-bearing existing testids or consciously evolve with rationale.

## Phase 3 — gates
Lint 0 · full suite (existing CompliancePanel tests untouched-green or consciously
evolved) · build · hex-grep · static-CSS check on new utilities.

## Smoke (E3 — BM credential, both themes, read-only)
Login A11Y_BRANCH_MANAGER → Compliance → assert reality-bar counts CONSISTENT with the
rendered roster (recompute filed/on-time/late/not-in from the rows; bar == derived) →
exception list shows exactly the not-in set → streak chips render for agents with
history (source-aware: assert whatever the live data state yields; do not require
specific streak values) → CBTT section present → row click opens the shared drawer →
axe NO-NEW serious/critical + 0 console errors → §2 screenshots both themes. No writes,
no cleanup beyond session.

## Phase 4 — docs
Standard placeholders · FOLLOW_UPS: (1) note S1 shipped, S2 (sendComplianceNudge CF +
notifications collection per the locked architecture) and S3 (plan-adoption lens +
toggle; zero rules changes — #471 manager-GET covers it) queued; (2) carry the
derived-suggestion-chip relabel micro-FU ('Dials' → 'Prospecting calls' on
SuggestedWeekCard's suggestion state) here from #477's CONTEXT note.

## Out of scope
Nudge/notifications (S2) · lens toggle + plan-adoption (S3) · any write · CBTT logic
changes · Master Sheet anything · the email path.

## Acceptance
Reality bar provably consistent with roster math · D2 implemented solely via
complianceDerive.js with the boundary tests · exception list exact · drawer reuse (no
rebuild) · CBTT kept · annotation's filing-lens grammar both themes · BM smoke PASS ·
Rules 12/15/17/18/19/20.
