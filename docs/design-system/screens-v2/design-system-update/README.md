# Nexus App — Design System Update (v2)

This package captures everything the 2026 AgencyTrack app redesign proved out, so
**you, Claude Design, and Claude Code stay consistent** with what actually shipped
and scored 9.7. It is structured to **drop into the AgencyTrack Nexus design-system
project** — folder names mirror that project.

## What's here

| File | Deliverable | Purpose |
|---|---|---|
| `STYLE-GUIDE.html` | **Living style guide** | One page rendering tokens, type, controls, state design, dense tables, motion + a11y — in both themes. Open it to *see* the system. |
| `guidelines/redesign-addendum.md` | **Rules doc** | The new laws (state, motion, nav, a11y, dense tables) + the token reconciliation table. The written contract. |
| `tokens/app-v2.css` | **Token source** | Canonical `.nexus` tokens with the AA fixes + new motion/focus/state groups. Supersedes `tokens/app.css`. |
| `components/app/nexus-patterns.jsx` | **Reusable code** | Source-of-truth React for `StateLayer`, `SkeletonScreen`, `EmptyState`, `ErrorState`, `useFocusTrap`, `useCountUp`, `useStress`, `usePrefersReducedMotion`. |
| `components/app/nexus-patterns.css` | **Reusable code** | Styles for the above + motion, dense-table, skip-link, row-action, sync-banner. |
| `components/app/nexus-nav.jsx` | **Reusable code** | The nav layer: `SideNavSections` (drag-reorder sidebar), `MobileTab` (adaptive bottom bar + create FAB), `MobileMore` (pinned/frequent/sectioned sheet), `MobileCreateSheet`, `CommandPalette`, `useTouchReorder`. |
| `components/app/nexus-nav.css` | **Reusable code** | Styles for the nav layer + the drag-reorder DOM protocol (`[data-rid]`/`[data-rover]`/`[data-rdrag]`). |
| `components/icons/redesign-icons.js` | **Icons** | 14 new line-icon glyphs (history, wallet, coins, calculator, medal, ladder, map, clipboard, bank, scale, tv, gauge, flag, sliders) so every nav tab has a unique icon. Fold into `components/icons/Icon.jsx`. |

## The one decision you need to know

The design system (`tokens/app.css`) and the shipped prototype had **drifted**.
Resolution, applied throughout this package:

- **DS naming/scope is canonical** — `.nexus` / `.nexus.dark`, camelCase tokens.
  The prototype's `.app-root[data-theme]` kebab names do **not** enter production.
- **DS token values absorb the prototype's AA-contrast fixes** — chiefly
  `--inkFaint` (v1 failed WCAG AA on text) and a new `--inkDim` for non-text use.
- **The DS gains the new systems** — state design, motion tokens, nav affordances,
  dense-table pattern, accessibility rules. These didn't exist in the DS before.

Full mapping + rationale: `guidelines/redesign-addendum.md` §0.

## How to merge into the design-system project

1. **Tokens** — replace `tokens/app.css` with `tokens/app-v2.css` (or diff in the
   changed values). Update `styles.css`'s import if it points at the old file.
2. **Rules** — add `guidelines/redesign-addendum.md` beside the existing
   `readme.md`. Add one line to `readme.md`'s index pointing to it, and note in
   `SKILL.md` that app state/motion/nav/a11y rules live in the addendum.
3. **Components** — drop `nexus-patterns.jsx` + `.css` and `nexus-nav.jsx` + `.css`
   into `components/app/`. Consider splitting into per-component files
   (`StateLayer.jsx`, `SkeletonScreen.jsx`, `MobileTab.jsx`, …) with `.prompt.md`
   siblings to match the existing DS component convention. The nav components
   expect the host to own & persist four bits of per-role state: sidebar order,
   mobile-tab order, pinned items, and frequent-visit counts (see the header
   comment in `nexus-nav.jsx`).
4. **Style guide** — keep `STYLE-GUIDE.html` at the project root (or in
   `guidelines/`) as the living reference. It reads `tokens/app-v2.css` and
   `components/app/nexus-patterns.*` by relative path.
5. **Register** in `_ds_manifest.json` if the project uses it for discovery.

> Cross-project note: this package was authored in the **AgencyTrack App** project
> because the design-system project is read-only from here. Copy these files across;
> nothing else in the DS needs to change.

## Provenance

Every value is lifted from the built, rated prototype (`AgencyTrack Prototype.html`)
— not aspirational. Contrast was verified with a TreeWalker WCAG pass across all
39 app screens in both themes; density verified at 60–120 rows; motion verified to
degrade to visible under throttle/reduced-motion.
