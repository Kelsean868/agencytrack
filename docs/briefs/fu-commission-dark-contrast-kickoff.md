# FU - Commission Dark-Mode Contrast Fix (GoalDecompositionTab)

run_model: claude-opus-4-8
size: S
track: K-adjacent (commission surface; a11y regression on merged code)
depends_on: PR #771 (the dark-leg smoke trust repair that surfaced this)
rules_change: NONE
data_model_change: NONE
deploy_required: NO

---

## Intent

PR #771's now-trustworthy dark axe legs surfaced a real color-contrast regression on a
merged money-adjacent surface: text spans in the commission GoalDecompositionTab render the
UN-lifted teal #01696f as text on dark card backgrounds (2.33-2.50:1 vs the 4.5:1 / 3:1 AA
requirement). Recon (worktree recon/commission-dark-contrast @ d6368572) proved it is ONE
bug in ONE component, and that the fix is the INVERSE of the naive instinct.

## The fix is to DELETE a dark override, not add one (read carefully)

CSS-var swap (src/index.css) - verified via the repo's own src/utils/contrast.js:
- Dark mode: bare `text-primary` -> #4ab5b8 (lifted teal) -> 6.14-6.61:1 on dark card -> PASS.
- Dark mode: `dark:text-primary-dark` -> #01696f (un-lifted) -> 2.33-2.50:1 -> FAIL.
So the `dark:text-primary-dark` override DOWNGRADES the text to the failing color. Bare
`text-primary` already gives the correct lifted teal in dark AND #01696f in light (6.46:1,
passes). **The fix: remove `dark:text-primary-dark` from the failing TEXT spans; keep bare
`text-primary`.** Do NOT add a new dark variant. Do NOT edit any token.

## Do-not-touch guardrail

`--primary-dark-channels` (= #01696f in dark) is a legitimate BUTTON-BACKGROUND token: the
pattern `bg-primary dark:bg-primary-dark text-white` gives ~6.5:1 (teal bg + white text) and
is CORRECT (GoalDecompositionTab.jsx:370 is an example). This PR touches ONLY
`dark:text-primary-dark` used as TEXT color. It must NOT touch `dark:bg-primary-dark` button
backgrounds, and must NOT edit `--primary-dark-channels` in src/index.css (that would break
the legitimate button contrast - destructive ripple).

## Scope: commission-only minimal. The repo-wide debt is a SEPARATE banked FU.

The same `dark:text-primary-dark`-as-text anti-pattern exists in ~32 sites across 14 files
(GoalsPanel, MonthlyPlanModal, RecommendLockDrawer, AwardProjectionStrip,
TakeHomeWaterfallView, ...). This PR fixes ONLY GoalDecompositionTab (the proven,
smoke-covered regression). The other ~24 sites are unproven debt (their effective
backgrounds may or may not fail) and get a banked sweep FU - do NOT sweep them here.

---

## Phase 0 - Falsification + close the two recon gaps (verify before editing)

0.1 Confirm the failing sites in
  `src/components/goals/CommissionPlayground/tabs/GoalDecompositionTab.jsx`: the
  `dark:text-primary-dark` TEXT occurrences at (recon-cited) :60, :90, :126, :141, :151,
  :359, :360. Grep the file; list every `dark:text-primary-dark` and classify each as TEXT
  (fix) vs part of a `dark:bg-primary-dark` button (do-not-touch). Cite line + classname.
0.2 Confirm CommissionAnchorStrip.jsx has ZERO `text-primary` (recon says it's a red herring
  using --hero-* tokens). One grep. If it DOES carry the failing pattern, surface it - the
  "one component" verdict would change.
0.3 RECON GAP 1 (axe live): the recon computed ratios from contrast.js against source tokens
  but did NOT run axe live. Run the commission dark axe leg against the preview and read
  axe's ACTUAL node targets/failureSummary for the color-contrast violation - confirm the
  failing nodes attribute to GoalDecompositionTab selectors, not the AnchorStrip. This is
  the empirical confirmation the recon flagged as missing.
0.4 RECON GAP 2 (hasHistory): the default-render count is 8 nodes, but the history pill
  (:151) adds a 9th if the seed agent has history. Read the seed/policy state the commission
  smoke uses - determine whether the count is 8 or 9. Component + fix are unchanged either
  way; this is so the smoke assertion uses the right number.
0.5 Confirm the token math independently: `src/utils/contrast.js` gives #4ab5b8 on dark
  bg-card >= 4.5:1 (recon: 6.61) and #01696f on dark bg-card < 4.5:1 (recon: 2.50). Cite the
  values from src/index.css (.dark --primary-channels / --primary-dark-channels).

Paste evidence for 0.1-0.5 before editing.

---

## Phase 1 - The fix
Delete `dark:text-primary-dark` from the TEXT spans in GoalDecompositionTab.jsx (the sites
from 0.1 classified as text). Leave bare `text-primary`. Do not touch any
`dark:bg-primary-dark` button classes. No token edits. No other file.

## Phase 2 - Deterministic unit lock (contrast.test.js)
Add a case to `src/utils/__tests__/contrast.test.js` asserting the dark teal-on-card text
pairing: `contrastRatio([74,181,184],[37,32,25]) >= 4.5` (lifted teal #4ab5b8 on dark
bg-card #252019). This locks the correct pairing independent of the preview, so a future
re-introduction of the override is caught deterministically, not only by a live axe run.
(Confirm the exact bg-card dark RGB from src/index.css in Phase 0; adjust the tuple to the
verified value.)

---

## Phase 5 - Smoke (dark axe, incl. the 3 conditional sites) - NON-WAIVABLE
The default render proves 8 nodes; this PR also touches conditional sites, so prove the
component, not just the default state.
5.1 Re-run the commission dark axe leg (the post-#771 trustworthy leg) against the preview:
  the color-contrast violation on GoalDecompositionTab nodes returns to ZERO
  (dark-axe-no-new = 0). Value-level, both s1 (node count) and s3 (violation count) style.
5.2 CONDITIONAL SITES - add dark axe coverage for the 3 sites the default render doesn't
  exercise:
  - confirm-dialog labels (:359/:360): open the confirm dialog in DARK mode, run axe, assert
    no color-contrast violation on those nodes.
  - history pill (:151): render the has-history state in DARK mode (seed an agent with
    history, or drive the state), run axe, assert clean.
  If a conditional site genuinely cannot be driven from the smoke harness, STOP and surface
  it rather than silently proving only the default 8 - "fixed the component" must mean all
  touched sites, or the residual is named explicitly.
5.3 Light mode unaffected: confirm the light leg still passes (bare text-primary = #01696f
  on light = 6.46:1) - the override removal must not regress light.
Seed to tatillife_smoke (hard _south guard); clean up, 0 orphans.

## Phase 3 - Docs / bank the debt
Bank TWO FOLLOW_UPS entries:
1. Repo-wide sweep: remove `dark:text-primary-dark`-as-text across the other ~24 sites / 13
   files (list from recon: GoalsPanel x7, MonthlyPlanModal x3, RecommendLockDrawer x3,
   AwardProjectionStrip x2, TakeHomeWaterfallView x2, +8 single-site files). Note each needs
   per-site background verification (up-to-24, not 24-confirmed) and must exclude
   dark:bg-primary-dark buttons. Medium.
2. Static guard extension: extend hero-pane-foreign-ink-guard beyond .glass.hero surfaces
   and drop its `(?!-dark)` exemption so `dark:text-primary-dark`-as-text is caught at
   authoring time. Note this would flag all ~32 sites, so it lands WITH or AFTER the sweep,
   not before. Low.

---

## Standing reminders
- Channel: HUMAN-MERGE, not green. Token-class edits on a money-adjacent surface = aesthetic
  /token judgment. Rule 19 HOLD at PR-open. No rules/functions -> no deploy.
- Rule 22: >=1 known gap before PR-ready.
- Rule 23 falsifier: the contrast.test.js case must be capable of failing - show it goes red
  if pointed at #01696f ([1,105,111]) on dark bg-card (should be ~2.5, < 4.5).
- Rule 21: poll Gemini + GLM; disposition each.
- No inline styles; the fix is className-only. Strike 0/2. Build to PR-open and HOLD.

## Self-critique seed (carry into Rule 22)
- If a conditional site (5.2) can't be driven, the PR proves 8 of the touched sites, not all
  - name the residual, don't bury it.
- The repo-wide debt stays open after this PR - the two banked FUs are the disposition, but
  ~24 sites remain latent-failing until the sweep lands; state that plainly.
