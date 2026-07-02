# FU - Repo-Wide dark:text-primary-dark Text Sweep + Static Guard Extension

run_model: claude-opus-4-8
size: M
track: contrast debt (banked by #773)
rules_change: NONE | data_model_change: NONE | deploy_required: NO

## Intent
#773 fixed the proven commission instance of the anti-pattern; ~24 sites across 13 files
remain latent: dark:text-primary-dark used as TEXT renders un-lifted #01696f in dark mode
(2.3-2.5:1 on dark cards). This FU retires the class of bug: per-site verified sweep + the
static guard so it can't be re-authored.

## The fix shape (same inversion as #773 - do not get this backwards)
Bare text-primary already resolves to the lifted #4ab5b8 in dark (passes). The fix is to
DELETE dark:text-primary-dark from TEXT usages, keeping bare text-primary. NEVER add a dark
variant. NEVER touch dark:bg-primary-dark button backgrounds (D6-legitimate: teal bg +
white text ~6.5:1). NEVER edit --primary-dark-channels in src/index.css.

## Phase 0 - Per-site verification (the debt is "up to 24", not "24 confirmed")
0.1 Fresh repo-wide grep of dark:text-primary-dark (the #773 recon list is the starting
    point: GoalsPanel x7, MonthlyPlanModal x3, RecommendLockDrawer x3,
    AwardProjectionStrip x2, TakeHomeWaterfallView x2, +8 single-site files - re-enumerate
    against current main, GoalDecompositionTab should now be clean).
0.2 For EVERY site, classify: (a) TEXT usage -> candidate; (b) part of a bg-primary
    dark:bg-primary-dark button -> DO NOT TOUCH; (c) anything ambiguous -> surface it.
0.3 For every TEXT candidate, identify its effective dark background and run the
    src/utils/contrast.js math: if #01696f on that background FAILS AA, it's a confirmed
    fix; if it PASSES (lighter background), still normalize it (consistency + the guard
    below will flag it) but record it as pass-anyway. Produce the full site table:
    file:line | background | ratio-before | ratio-after | class.
0.4 Confirm which of the 13 files sit on surfaces with existing dark axe smoke legs
    (compliance-v2, commission-v2, etc.) - those are the runtime-provable subset.

## Phase 2 - The sweep
Apply the deletion to every TEXT site from 0.3. Zero button/bg edits (verify by grep:
dark:bg-primary-dark count unchanged before/after).

## Phase 3 - Static guard extension (lands WITH the sweep, per dispatcher ruling)
Extend the foreign-ink guard (src/utils/__tests__/hero-pane-foreign-ink-guard.test.js or a
new sibling test): scan beyond .glass.hero surfaces and drop the (?!-dark) exemption so
dark:text-primary-dark-as-text fails the suite at authoring time. It must pass on the swept
tree and be demonstrated to FAIL if one removed site is reintroduced (Rule 23 falsifier).
If extending the existing guard is too entangled with its hero-pane semantics, a new
dedicated static test is acceptable - say which and why.

## Phase 5 - Smoke
5.1 Dark axe legs of every smoke-covered surface from 0.4: zero color-contrast violations
    attributable to the swept sites (run against preview).
5.2 Light legs unaffected (text-primary = #01696f on light passes everywhere it did).
5.3 For swept sites with NO smoke coverage, the 0.3 contrast-math table + the static guard
    are the certifiers - state that explicitly in the PR body (Rule 18 honesty).
Full suite + lint + build; the extended guard runs in the suite.

## Standing
HOLD at PR-open (touches manager + agent money-adjacent surfaces). Rule 21 poll +
disposition. Rule 22 >=1 gap (e.g. any 0.2-ambiguous site deferred). Strike 0/2.
