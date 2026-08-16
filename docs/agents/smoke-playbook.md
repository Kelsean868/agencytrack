# Smoke walk playbook — helper APIs, locator patterns, waiver carve-outs

Moved out of CLAUDE.md (§ Banked patterns, original lines 772–782 and 792–802) on the
router split.

CLAUDE.md keeps the binding mandate in one consolidated statement: smoke walks MUST
include a real write-read-verify cycle, smoke is CC's default (absence of an explicit
brief waiver = CC runs the walk), and standing per-surface smokes are catalogued in
`scripts/verification/SMOKES.md`. This file carries the mechanics.

All helpers referenced here live in `scripts/verification/lib/walk-helpers.mjs`.

## The mandate, in the original wording (both bullets, pre-consolidation)

**Smoke standard, reinforced:** Walks MUST include a real write-read-verify cycle. Selector-only checks miss permission/rules/index bugs. The shakedown design follows this principle — every category does at least one real Firestore write through the rule layer.

- **Smoke is CC's default, not Kyron's manual check.** CC runs production smoke autonomously for every PR via `setupBypassSession` from `scripts/verification/lib/walk-helpers.mjs`. The default is RUN. Waiver is only acceptable when changes are clearly outside any user-visible behavior path (pure docs commits, pure type changes, internal refactors with no UI surface). Even rendering/a11y/timing changes get a smoke walk — RTL covers component logic, but smoke covers real-DOM + real-timer behavior under real Firebase backoff that RTL can't simulate. Brief authors must justify a smoke waiver explicitly; absence of waiver = CC runs the walk. Banked from PR #151 (Wizard R2-R5 polish) where brief waived smoke for pure-rendering changes and Kyron retroactively flagged this as too permissive a default.

## Waiver carve-out — static CSS verification

- **Static CSS verification as smoke replacement for utility-alias and config-binding refactors.** When smoke is genuinely waived per the "internal refactor, no user-visible behavior" carve-out, CSS-only changes verify deterministically by inspecting the compiled bundle: fetch `dist/assets/index-*.css` (post-build) or the Vercel preview's served bundle, grep for expected utility classes, confirm rules emit with expected `var(--*)` resolution. Stronger than human spot-check (deterministic), cheaper than full smoke (no auth or navigation). Validated in PR #155 (arbitrary CSS-var-syntax → named-utility sweep — verified target utilities present in preview bundle, source patterns tree-shaken) and PR #156 (border-border resolution — verified `.border-border` rule emission in compiled bundle BEFORE smoke measured computed colors). For genuinely-waivable CSS-only refactors, this is the load-bearing verification.

## Mobile viewport smokes

- **Mobile-viewport smokes need viewport-aware login routines.** `setupBypassSession` in `walk-helpers.mjs` currently waits on a sidebar nav selector (`nav[aria-label="Primary navigation"]`) that is CSS-hidden at mobile (390×844). Mobile-viewport smokes must either use a mobile-friendly selector for login confirmation (e.g., `waitForFunction(() => document.body.textContent.length > 100)`) or briefs must call out the workaround explicitly. Future improvement: make `setupBypassSession` viewport-aware. Banked from PR #153 smoke debug.

- **Mobile bottom nav "More" drawer pattern.** On 390×844 mobile viewport, ManagerDashboard sidebar-only tabs (any item NOT in `BOTTOM_NAV`) are accessible only via the "More" button in the bottom nav, which opens a slide-up drawer (`MobileNavDrawer`). Smokes navigating to sidebar-only tabs on mobile must click the "More" button first (`getByRole('button', { name: /^more$/i })`), wait 500ms for the drawer to animate, then click the target nav item. Tabs in `BOTTOM_NAV` (Dashboard, Team, Reports, Campaigns, Profile) are directly clickable without opening the drawer. Banked from I1.2 PR #256 smoke fix.

## Preview environment data gaps

- **Preview env data gaps can force smoke skips.** When a smoke step needs data behind a Firestore state (submission history, settled awards, etc.) and the preview env has no seed data for it, the smoke MUST skip-not-fail with an explicit note in output. Briefs should anticipate this by either providing a seed path or accepting code-inspection-derived findings + manual production verification. Banked from PR #153 where P1-2 History row smoke verification skipped due to no submission data in preview.

## Playwright + React 19 patterns

- **React 19 controlled-select automation in smokes.** Use `selectReactOption(page, locator, value)` from `walk-helpers.mjs`. Playwright's `selectOption()` fires a trusted Chromium change event that React 19 handles correctly. Do NOT layer an extra `dispatchEvent('change')` with a generic `Event` after `selectOption()` — the extra dispatch can interact badly with React's synthetic event system and may leave the select appearing blank on subsequent reads. Banked from PR #248 smoke debugging.

- **Overflow-container visibility in smokes.** Use `domTextCount(page, selector, text)` from `walk-helpers.mjs` for "is this data rendered anywhere in the DOM" checks inside `overflow-auto` containers (modals, drawers, scrollable lists). Playwright's `waitFor({ state: 'visible' })` treats elements scrolled off-screen within an overflow container as not visible — correct for viewport/UX checks, wrong for data-rendering checks. Use `isVisible()` only when the human-visible viewport is what you're asserting. Banked from PR #248.

- **REST-write vs SDK-read in smokes.** The canonical smoke pattern is end-to-end via the UI path (write via SDK in the app → hard-reload → observe via SDK). Smokes that write via Firestore REST in a fresh context cannot reliably observe their own write via the same context's SDK — the SDK may cache or see a pending state. REST reads of the same doc are the correct diagnostic path; SDK observation in the same context is not. Banked from PR #248 (`6b3c252` reverted wrong `getDocsFromServer` production code change).

- **Console/network capture in smokes.** Call `captureConsoleAndNetwork(page)` from `walk-helpers.mjs` immediately after `context.newPage()` and before any `goto()`. Returns `{ consoleMessages, networkFailures }` accumulating across the page's lifetime. Call `formatCaptureReport(capture)` before smoke exit to print the summary block. Static-asset noise (`.map`, `.ico`) is filtered inside the helper — per-feature smokes need no extra filter. Banked from PR #238 post-merge (ad-hoc supplemental script pattern, now canonical).

## Diagnosing smoke failures — locator specificity before waits

- **Smoke locator specificity — diagnose with screenshots before adding waits.** When a smoke step fails with a timeout, take a screenshot immediately after the timeout fires. If the expected element is **already visible** in that screenshot, the issue is locator breadth, not timing — do not add a wait. `locator('div').filter({ hasText }).first()` resolves to the outermost ancestor `<div>` containing the text (often `<div id="root">`), making any chained `locator('text=')` on it unreliable. Fix pattern: scope to the semantic container class (`.card` for policy cards in `PolicyLedgerPanel.jsx`, `.modal` for modals, etc.) and use chained `.filter({ hasText })` instead of `.locator('text=')` on a `first()` element. `filter({ hasText })` checks whether the matched element itself contains the text; `locator('text=')` searches descendants and can match unexpectedly wide ancestors. Banked from PR #358 (`4167af9`, 2026-05-27) — leg3-reload-settled was 47/48 for three consecutive runs; screenshots showed the "Settled" badge clearly present while the test had already failed.
