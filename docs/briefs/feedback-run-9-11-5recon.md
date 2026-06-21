# Feedback Run — #9 + #11 (+#10) + a11y sweep + #5/empty-state recon
**Single queue brief — the only run tonight**

- **Status:** READY. Decisions locked (see each block). Source-verify at Phase 0.
- **Channel:** build to PR-open, **HOLD all** for review. No auto-merge this run (contents below are agent-facing / role-gated / read-only — none qualify for the auto lane).
- **Merge model:** every PR gets a **CC self-review pass** that pre-digests the diff so the operator's merge is a glance, not a re-review. #9 + a11y sweep → glance-merge-ready. #11 → flagged for **close** review (large cross-cutting nav rewire). #5 + empty-state → no PR, recon reported inline.
- **Smoke credentials:** read from `.env.local` at Phase 0 — do **not** hardcode account emails (the operator has reseeded the smoke accounts). Enumerate which roles the available credentials cover and smoke each; name any uncovered role as the gap.
- **Deploys:** none. **Production writes:** zero. **Never-auto floor:** rules / Cloud Functions / auth / tenant-claims / new collections / migrations / any `tatillife_south` write — none expected in this run; if any block drifts into them, HALT and report.
- **Rules in force:** 10 (brief landed via docs-PR before dispatch), 15 (post-push SHA-match), 16 (post-merge fill, size caps), 17 (source-verify at Phase 0 — no path/line asserted from this brief), 19 (CC never merges/deploys), 20 (PR report names feature-branch HEAD SHA), 21 (Gemini poll + disposition, 15-min window), 22 (≥1 named gap per PR report), 23 (falsification-before-banking on any locked finding).
- **Halt language:** only "STOP and wait for dispatcher" / "STOP IMMEDIATELY". Two-strike system live (same friction twice → halt).
- **Branches:** file-disjoint so CONTEXT.md rows don't collide. #9 and #11 touch different surfaces; #5 is read-only.
- **Build order (by execution, not block number):** Block 1 (#9, small build) → Block 4 (a11y sweep, small verify-and-fix) → Block 3 (#5 recon, read-only) → Block 5 (empty-state recon, read-only) → Block 2 (#11, large build-and-hold). #11 last so a context-budget cutoff lands on the held block, not the quick wins.

---

## Block 1 — #9 Auto-distribute (Game Plan, Step 3 / Monthly Plan)
**Lane:** autonomous build → PR-open → HOLD (glance-merge-ready). Agent-facing plan math, so it holds — but pre-digested.

### Phase 0 — source-verify (HARD STOP on miss)
1. Locate the auto-distribute handler and the Step-3 monthly-plan state. Report: component path(s), the handler, and how the 12 months are represented in state.
2. Confirm current behavior: it spreads the remainder across future months and **excludes the current month** (the reported defect). If current behavior differs, STOP and report — the fix below assumes that starting point.
3. Confirm the annual target source the button reads from.

### Decision (locked)
- **Preserve typed months, where "typed" = any month with a value > 0** (non-zero heuristic — no new state field, no schema change).
- Auto-distribute computes `remainder = annualTarget − Σ(non-zero months)` and spreads `remainder` **evenly across the months currently at 0**, **including the current month**.
- Accepted v1 consequences (do not engineer around them): (a) an intentional TT$0 month cannot be represented — a 0 reads as empty and gets a share; (b) the button is effectively one-shot — once empty months are filled they read as typed, so a second click redistributes nothing until months are cleared back to 0.

### Build
- Implement the distribution as a **pure function** (annualTarget, monthsArray, currentMonthIndex) → newMonthsArray, so it is unit-testable in isolation.
- **Button copy must be honest about the behavior** — label/helper text states it distributes across empty months (exact wording: CC's call, but it must not imply it re-spreads everything).
- No schema/write/validation/aggregator change. Presentation + client compute only.

### Tests (value-asserting — this is the gate, not "it rendered")
Unit tests on the pure function, asserting exact resulting arrays:
- All-empty: annual spreads evenly across 12 incl. current.
- Some typed: remainder = annual − Σtyped; spread only across the zeros; typed months untouched.
- Σtyped ≥ annual: remainder ≤ 0 → zeros stay 0 (define and assert the clamp; remainder must not go negative into months).
- Rounding: assert the remainder reconciles (no lost/created cents across the 12 — state the rounding rule and assert the sum equals the intended distributable).
- Current-month inclusion: current month receives a share when it is at 0.

Plus the standard **production smoke** (setupBypassSession): log in with the **agent** smoke credential from `.env.local`, open Game Plan Step 3, click auto-distribute, assert the resulting month values match the expected array (real write-read-verify, not selector-only).

### Gates
lint / test / build green · both-theme · axe NO-NEW (delta vs main baseline) · hex-grep empty.

### Close
PR-open, HOLD. Rule 20 HEAD SHA in the report. Rule 21 Gemini poll + disposition. **CC self-review pass:** review own diff as a reviewer, confirm the smoke asserts the *right numbers*, bank a written "what I'd flag" summary in the PR body. Rule 22: name ≥1 gap.

---

## Block 2 — #11 Role-aware shortcut (absorbs #10 pencil removal)
**Lane:** build → PR-open → HOLD, **flagged for close review** (large cross-cutting nav rewire, both dashboards, role-gated). Not glance-merge.

### Phase 0 — source-verify (HARD STOP on miss)
1. Locate the floating pencil (DailyFAB or equivalent). Confirm it renders on **both** mobile and desktop. Report path(s).
2. Confirm the **mobile bottom-bar Submit** button exists and its component.
3. Confirm each per-role target flow **exists** before wiring a menu item to it — weekly report, new-policy/policy-ledger entry, WAR entry, recruiting-activity entry, add-team-member. **If any role's target flow does not exist, STOP and report** rather than wire a dead menu item (do not invent destinations).

### Spec (locked)
- **Mobile:** remove the floating pencil. The existing bottom-bar **Submit** button becomes a **speed-dial fan-out** into the current role's actions.
- **Desktop:** the floating pencil is **replaced** by the same shortcut, surfaced as a menu from that anchor.
- One anchor per platform, **shared action logic** (single source for the role→actions map; the two anchors render it).
- Per-role action map:
  - **Agent:** weekly report · new policy (· daily entry, if that flow is the live daily-capture surface — confirm at Phase 0).
  - **Unit / Branch Manager:** the agent actions **+ WAR + recruiting activity**.
  - **Sales Manager / Tenant Admin:** **add team member** (intentionally thin — confirmed map, not an omission).
- Daily-entry reachability on mobile must survive the pencil removal (the fan-out or another path must reach it). Confirm and preserve.

### Tests / smoke
- Unit/component tests on the role→actions resolver: each role yields the correct action set.
- **Production smoke** — enumerate the smoke credentials in `.env.local`, determine which roles they cover, and assert the shortcut renders the correct action set for **each available role**, on **mobile viewport and desktop** (use the viewport-aware login routine; the desktop sidebar selector is CSS-hidden at 390×844). If a credential's login fails (deleted/auth 400), STOP and report rather than silently skipping.
- **Named gap (Rule 22):** any role with **no** credential in `.env.local` is covered by the resolver unit test only, not an end-to-end smoke — list exactly which roles fell into that bucket.

### Gates
lint / test / build · both-theme · axe NO-NEW · hex-grep empty.

### Close
PR-open, HOLD (close review). Rule 20 HEAD SHA. Rule 21 Gemini. CC self-review pass + banked review. Rule 22 gap named.

---

## Block 3 — #5 Money Needs feed-map + reorg (RECON ONLY)
**Lane:** read-only. **No branch, no code, no PR.** Produces a proposal reported inline for dispatcher → operator review. The build is a separate supervised step after sign-off.

The agent feedback: the **sub-calculators are the source of truth**, the budget worksheet **duplicates** entries the sub-calculators already capture, and worksheet lines should **pull from** the sub-calculator answers instead of re-asking. Locked design decision for the eventual build: pulled worksheet lines are **prefilled-but-editable** (agent can override), not hard-locked.

### Recon (read-only — report inline, then STOP)
1. **Sub-calculators:** enumerate every Money Needs sub-calculator (car, business, insurance-industry, loans/debt, and any others). For each, list its **output fields** and where each currently feeds (which budget line today, if any). Component path(s).
2. **Budget worksheet:** report the full structure — the expense groups (Living expenses / Business expenses / Savings & accumulation, or as actually built) and **every line item** under each.
3. **Duplicate map:** for each worksheet line item, identify whether a sub-calculator already captures the same quantity. Output a table: `worksheet line → sub-calculator source field (or "no source")`.
4. **Already-wired vs gaps:** mark which feeds already exist (e.g. car 33/67 split → Living/Business; insurance-industry → Business) and which are gaps (e.g. Loans & Debt currently feeds nothing).
5. **Reorg note:** flag where worksheet line ordering/grouping would no longer flow logically once lines are pulled from sub-calculators, and propose a reordered structure.

Read-only. No writes of any kind. Report the five outputs inline and **STOP** — dispatcher turns this into the feed-map + reorg proposal for operator sign-off, then a build brief.

---

## Block 4 — a11y + empty-state verify-and-fix sweep
**Lane:** small autonomous build → PR-open → HOLD (glance-merge). Verify-then-fix: each item produces a fix **only if** the defect is real; otherwise a clean report. If all three verify clean, no PR — report and move on.

Three independent checks. Source-verify each at Phase 0 (the contrast census closed Finds A–F via #636/#637, so some of these may already be resolved — confirm before touching anything):

1. **GapAnalysisPanel contrast.** Flagged baseline: `text-white/75` and `text-white/60` failing AA. Verify against current code; if still failing, swap to a token/utility that meets AA both themes. Pure presentational, axe-verifiable. If already fixed in the census closure, report that and skip.
2. **MyPointsCard missing-doc empty state.** Confirm the card renders the clean zero state on a **missing** leaderboard doc (a never-submitted account), not just a zeroed one — `getLeaderboardPoints` handles missing → 0, but the card's own empty state on a truly absent doc is what's unverified. Add a guard + test only if it renders wrong (blank/error) on a missing doc.
3. **1.89:1 banner.** Confirm the separately-banked 1.89:1 contrast banner was actually closed with the D6 follow-up and isn't still live. If still open, token/utility fix to AA.

If any item produces a fix: one combined PR. Gates: lint/test/build · both-theme · **axe NO-NEW** (delta vs main baseline) · hex-grep empty. HOLD at PR-open, glance-merge-ready, CC self-review pass, Rule 20/21/22.

---

## Block 5 — New-agent empty-state polish (RECON ONLY)
**Lane:** read-only. No branch, no code, no PR. Produces a proposal reported inline for dispatcher → operator review. The build is a separate step after sign-off.

The signal: a brand-new pilot agent (no submissions yet) lands on the dashboard "Submit your first report" card, and it reads as *broken / old version* rather than *fresh account, here's your first step* — this is what triggered the #1 "stale version" false alarm. Worth making the first impression unmistakably "new account, start here."

### Recon (read-only — report inline, then STOP)
1. Locate the new-agent dashboard empty-state component(s) — the card a zero-submission agent sees. Confirm it is **distinct** from the removed onboarding wizard (#660/#667) so we polish the right surface. Report path(s).
2. Report the current empty-state copy, structure, and any CTA it shows.
3. Note what data/context is available at that point (e.g. agent name, whether a Game Plan / goal exists yet) that a better first-impression state could use.
4. Propose 2–3 concrete improvement directions (copy + light visual), each scoped as display-only with no schema/write change.

Read-only. Report and **STOP** — dispatcher turns this into a polish proposal for operator sign-off, then a build brief.

---

## Dispatch
1. Download this file to `~/Downloads/`.
2. Run: `/land-and-dispatch feedback-run-9-11-5recon.md`

The brief header is the control surface — channel (HOLD all), per-block lane, gates, and the CC-self-review + value-asserting-smoke gate are baked in above.
