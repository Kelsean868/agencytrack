# FR fit-any-width — every agent screen works at every window size (kickoff brief)

**Status:** ready for dispatch · **Author:** Claude-web (architect) · **Date:** 30-09-2026
**Source:** Kyron, 30-09-2026. The installed desktop app (PWA) at a ~1300 px window shows jumbled layouts, for example the Policy ledger header ("HEAD OFFICE LIST AS OF 15 SEP 2026" wraps one word per line, the title is cut off) and the Advisor-of-the-Month card (its Settled / Submitted columns are squeezed to a few pixels). Kyron wants the app to adjust to **any** size the window is resized to before agents use it. **This is a pilot blocker.**
**Channel:** `human-merge`. One slice = one branch = one PR, each cut fresh from `origin/main`.
**Delegation (CLAUDE.md):** Opus 5.5 keeps diagnosis, layout decisions and review. Haiku 4.5 runs sweeps, reads logs and counts failures. Sonnet 5.5 does fixes that the main model has specified exactly.

## 0. Root cause (verified at authoring time)

- The harness walk (`scripts/verification/fr-harness-walk.mjs`) renders FR views **without the app shell** at three widths: desktop 1440, tablet 900, phone 390. A "desktop" scene therefore gets the full 1440 px.
- In the real app the sidebar takes about 275 px, so on a 1280–1366 px window a view gets roughly 1000–1100 px. That width is never tested.
- The FR layouts switch on **viewport** breakpoints (Tailwind `lg:` and similar). `git grep -n "@container\|container-type" -- src` returns **0 hits**. A card that is laid out for "desktop" when the window is wide, but only has 1000 px beside the sidebar, has no way to know and breaks.
- The v3 non-negotiables in CLAUDE.md (rules 7–9) already name the fixes: rows that gather children wrap, name the part that shrinks, and never let a figure or time be crushed.

## 1. Decisions locked

1. **Layout follows the space a component actually has, not the window.** Page-level regions (header, hero row, card grids, toolbars) use CSS container queries (`container-type: inline-size` on the region, Tailwind `@container` / `@[..]:` variants, adding `@tailwindcss/container-queries` if the Tailwind version needs it). Viewport breakpoints stay only for the shell itself (sidebar vs phone tab bar).
2. **No crushed text.** A heading, eyebrow or figure must never wrap into a column of single words. Flexible labels get `min-width: 0` plus ellipsis and a `title`; figures and dates are `flex: 0 0 auto`; toolbars and chip rows `flex-wrap: wrap` with a row gap (CLAUDE.md v3 rules 7–9).
3. **Nothing is lost at any width.** Content may stack, wrap or move under a heading. It may not be hidden, cut or overlapped. Charts (donuts, bars, lines) keep their labels readable: below a set width the legend moves under the chart instead of beside it.
4. **Visual design stays as approved.** At 1440+ the screens must look as they do today. This is a layout-robustness pass, not a redesign. No data, service, rules or money change.

## 2. Slices — run in order

| # | Slice | Model / effort |
|---|---|---|
| W-1 | Width sweep + breakage detector (tooling only) | Opus 5.5 / medium |
| W-2 | Fix every screen W-1 flags, in batches | Opus 5.5 / medium |
| W-3 | Real-app sweep on the staging build | Opus 5.5 / medium |

### W-1 — width sweep + breakage detector
- Add a **shell frame** to the harness. Each scene can render inside a frame that has the real sidebar width (desktop) or tab bar (phone), so the view gets the width it gets in the app. Keep the old frameless mode for existing checks.
- Add a `--sweep` mode to `fr-harness-walk.mjs`. It covers these **window** widths: 360, 390, 430, 600, 768, 900, 1024, 1180, 1280, 1366, 1440, 1600 and 1920. Use height 900, or 844 for phone. Test both themes. The shell switches to the phone layout at the app's own breakpoint.
- **Breakage probes.** Each finding reports the scene, width, theme, the element's selector and its text:
  1. **Crushed text.** A text element (heading, eyebrow, label, figure) whose rendered line count is more than 2 while its width is under 12 ch, or whose words stack one per line.
  2. **Overflow.** Any element that is not a scroll container and has `scrollWidth > clientWidth + 1`, and any page-level sideways scroll.
  3. **Overlap.** Visible sibling boxes that intersect by more than 2 px.
  4. **Clipped figure.** A figure element that uses `text-overflow: ellipsis` and whose text is truncated.
  5. **Tiny chart.** An SVG chart narrower than 120 px, or a donut legend that overlaps its ring.
- Output a markdown table grouped by screen, plus the screenshots. Commit the tool and a baseline report under `docs/audits/fr-width-sweep-<date>.md` (the report only, never the screenshots).
- **Acceptance:** the sweep reproduces Kyron's two cases (the ledger header and the AOTM card) at 1280 and 1366. If it does not, the probes are wrong: fix them before W-2.

### W-2 — fix every flagged screen
- Work from the W-1 report, one screen group per commit: Today; Focus/Week/Pipeline; Numbers/Ledger; Money (all tabs); Compete (Leaderboard, Campaign, Awards, Trophy room); Me/Career/Connections; shared chrome (page headers, toolbars, chip rows, Chart cards).
- Fix shared pieces first. The page header, the toolbar and `ChartCard` legends cause most failures, so one fix there clears many screens.
- Use the Decisions above only. For a finding that needs a design judgement (for example, which column to drop from a table on a narrow window): **STOP and wait for dispatcher** for that item only, park it in the PR body with before and after screenshots, and continue with the rest.
- **Gates for each PR:**
  - the full sweep shows **0 findings**, or only parked items;
  - the existing harness walk is still green, with no new axe, tap-target, glide or swipe failures;
  - lint 0, the full `npm test` suite, and build;
  - a screenshot pair (before and after) for every fixed screen at 1280 and 1024, light theme, in the PR body.
- Split into several PRs if the diff gets large. Keep each PR under about 25 files.

### W-3 — real-app sweep (staging)
- Build with `npm run build -- --mode staging`. Confirm the bundle carries `agencytrack-staging` and **zero** `agencytrack-2a610` (CLAUDE.md), then serve it locally.
- Sign in with the staging A11Y agent account (`A11Y_*` env vars, via `setupBypassSession` rules; never echo values). Visit every agent route, and the FR look for each, at 1024, 1280, 1366, 1440 and 390 widths. Run the same probes. The sweep is **read-only**: no writes, no forms submitted.
- Anything found here but not in the harness gets fixed, and its scene is added to the harness so it stays tested.
- **Report:** the route × width table, all green, and the screenshots reviewed.

## 3. Named rituals
1. Phase 1: paste the output of `git grep -n "@container\|container-type" -- src` and the list of viewport breakpoints used in `src/components/fr/**` in the PR body.
2. Before and after sweep tables in every W-2 PR body.
3. CI green (one re-run for a named known flake). `@coderabbitai review`, and the Rule 21 table.
4. A PR-ready report with the HEAD SHA (Rule 20) and gaps (Rule 22).

## 4. Stops
- Any change to data, services, rules, money math or copy meaning: **STOP and wait for dispatcher**.
- A visual change at 1440+ beyond a wrap/spacing fix: **STOP and wait for dispatcher**. Park that item and continue.
- Any production sign-in or write: **STOP IMMEDIATELY**. Use staging only.
