# Kickoff — Track J overnight queue (flake pin + 4 green-channel restyle ports)

**Type:** sequential multi-item queue · **Operator:** away ~5h · **Mode:** unattended
**Items:** 0) wizard-flake pin · 1) Settings v2 · 2) Compliance v2 · 3) Monthly Recruiting v2 · 4) Campaigns v2

---

## STANDING NIGHT RULES (govern every item)

1. **Sequential, independent.** Execute items 0→4 in order. Each item gets a FRESH branch cut
   off freshly-fetched `origin/main` — NEVER off a prior item's branch. Open the item's PR,
   then proceed to the next item WITHOUT waiting for any merge.
2. **Rule 19 absolute.** No merges, no deploys, under any circumstances.
3. **Park-on-stop.** Any STOP condition (Rule-17 premise failure, redesign-class Phase-0
   finding, gate failure you cannot fix within the item's own scope): push the branch, open a
   DRAFT PR titled `[PARKED-STOP] <item>`, put the full stop report in the PR body, then MOVE
   ON to the next item. A correct park is not a strike. Do not improvise scope to unblock.
4. **No docs edits in queue PRs.** Phase 4 is SKIPPED for every item (parallel-PR conflict
   avoidance on CONTEXT.md / FOLLOW_UPS.md / port-ledger). INSTEAD: every PR body must
   include, ready-to-paste: (a) its CONTEXT.md Recently-shipped row text, (b) its
   port-ledger row-flip text (PENDING → PORTED with PR# placeholder), (c) any FU lines.
   These get applied at the operator's sequential morning `/post-merge` fills.
5. **Green-channel self-checks per port (items 1–4):** hex-grep empty (Nexus tokens only) ·
   `git diff --stat` == the item's scope-locked files only · lint 0 errors · full suite green
   (the 2 known wizard flakes passing in isolation remain an acceptable baseline IF item 0
   parked) · axe NO-NEW serious/critical vs main baseline · both-themes smoke PASS on the
   item's Vercel preview · no feature/nav/route/role/token-definition/data-flow change.
6. **End-of-night report:** one final summary listing every item → PR URL → HEAD SHA →
   status (READY-FOR-REVIEW / PARKED-STOP + one-line reason), per Rule 20. Then stop.

---

## ITEM 0 — Pin the flaky wizard test (test-infra only)

**Branch:** `fix/wizard-test-parallel-flake` · **Scope lock:** the ONE wizard test file that
times out at `openWizard()` under parallel full-suite load (the R2-retirement value-level
test identified in PR #445's run — 2 failures, passes 2/2 in isolation). NO `src/` changes.
NO other test files.

- Diagnose the parallel-load timeout (wait budget vs CPU contention is the likely class).
- Fix minimally INSIDE the test file: harden waits / extend the file's timeout budget /
  per-file sequential annotation if vitest supports it in-file. Behavior assertions must
  remain identical — this pins timing, it must not weaken what the test proves.
- **Proof:** 5 consecutive full-suite runs green (or the file green in all 5 under full
  parallel load).
- **Timebox:** if not proven after a bounded effort (~40 min), `git restore` to clean, PARK
  with findings per night-rule 3, move to item 1. Items 1–4 then use the known-flake
  baseline from night-rule 5.

## ITEM 1 — Settings v2 restyle (port-ledger row 17)

**Branch:** `feat/track-j-settings-v2` · **Scope lock:** `src/components/profile/ProfileScreen.jsx`,
`src/components/profile/EmailUpdateModal.jsx`, + new `scripts/verification/settings-v2-smoke.mjs`.

- **Phase 0 diff-lock:** identify the Settings mockup in `design_handoff_v2_app/mockups/`
  (use the README §6 inventory), run a structural mockup-vs-component comparison. TRUE
  RESTYLE only — if the mockup adds/removes data, composition, flows, or fields the shipped
  component lacks, PARK per night-rule 3. Cosmetic chrome/token/spacing/typography deltas
  proceed.
- Restyle to the mockup using existing Nexus tokens only (`bg-surface` / `bg-card` /
  `bg-card-raised`, documented `dark:` patterns incl. `dark:bg-primary-dark` on primary
  buttons), ≥44px touch targets, both themes. Preserve all existing behavior, props, data
  flow, loading/error/empty states.
- **Smoke:** walk-helpers pattern; A11Y agent login; navigate to Settings/Profile; assert
  the restyled surface renders (stable testids), email-update modal opens/closes; axe both
  themes; 0 console errors. Run against the PR's Vercel preview.

## ITEM 2 — Compliance v2 restyle (row 20)

**Branch:** `feat/track-j-compliance-v2` · **Scope lock:**
`src/components/manager/CompliancePanel.jsx` + new `scripts/verification/compliance-v2-smoke.mjs`.

- Same Phase-0 diff-lock, same restyle rules, same park trigger as item 1.
- **Smoke:** A11Y Branch Manager login; navigate to the Compliance tab; render + axe both
  themes; 0 console errors.

## ITEM 3 — Monthly Recruiting v2 restyle (row 22)

**Branch:** `feat/track-j-monthly-recruiting-v2` · **Scope lock:**
`src/components/manager/MonthlyRecruitingTab.jsx` + new
`scripts/verification/monthly-recruiting-v2-smoke.mjs`.

- Same Phase-0 diff-lock and rules. NOTE: this surface has existing functional coverage
  (Track-I era) — existing tests/smokes for it must stay green untouched; restyle is
  presentation-only.
- **Smoke:** BM login; Monthly Recruiting tab; render + axe both themes; 0 console errors.

## ITEM 4 — Campaigns v2 restyle (row 23)

**Branch:** `feat/track-j-campaigns-v2` · **Scope lock:**
`src/components/campaigns/CampaignPanel.jsx`, `src/components/campaigns/CampaignCard.jsx`,
+ new `scripts/verification/campaigns-v2-smoke.mjs`.

- Same Phase-0 diff-lock and rules.
- **Smoke:** BM login; Campaigns surface; panel + at least one card render; axe both themes;
  0 console errors.

---

## ACCEPTANCE (queue level)

- Items attempted strictly in order; every item ends as exactly one of: open PR
  (ready-for-review) or `[PARKED-STOP]` draft PR with a complete stop report.
- Zero edits to CONTEXT.md / FOLLOW_UPS.md / track-j-port-ledger.md in any night PR; every
  PR body carries its ready-to-paste morning fill text (night-rule 4).
- If all items complete with time remaining: STOP. Do not start unqueued work.
- Rules 12/15/18/19/20 in force throughout; smoke boxes per item (waived only on item 0,
  justification: test-infra only, full-suite proof is the verification).
