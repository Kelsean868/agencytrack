# Track J — V2 Redesign · Screen 1: App Shell — Kickoff Brief

**Branch:** `redesign/shell`
**Base:** `main` @ `32c4a5d` (PR #387)
**Channel:** GATED (foundational pilot for the track)
**Smoke:** REQUIRED (user-visible UI change)
**References:**
`design_handoff_v2_app/README.md` (§4 token bridge, §5 primitives, §7 shell notes, §9 a11y),
`design_handoff_v2_app/mockups/AgencyTrack App Layout.html`,
`design_handoff_v2_app/mockups/AgencyTrack App Mobile.html`,
`design_handoff_v2_app/mockups/app-shell.jsx`,
`design_handoff_v2_app/mockups/app-mobile.jsx`,
`design_handoff_v2_app/mockups/app-tokens.jsx`

---

## Track J operating contract (read once; applies to every Track J screen)

1. **Port, don't paste.** Mockups are references. Recreate in React using existing components, primitives, and the `src/services/*` layer. Never copy mockup HTML/JS.
2. **Token contract.** Map every raw hex/px to an existing token/utility (`src/index.css` `:root`/`.dark` + `tailwind.config.js`, per README §4). **Never introduce a new hex or new token without an explicit dispatcher decision** logged in the brief. The one decision for this screen: `surfaceSoft` (#F4F2EC) → reuse **`--color-surface-muted`** (no new token).
3. **A11y is a hard gate and overrides the mockup.** Where the mockup's pixel spec would shrink an interactive control below **44px**, keep ≥44px (the glyph may shrink; the hit area does not). Keep semantic landmarks, labelled controls, `focus-visible:ring-2 ring-primary` (or the `outline` equivalent already in `index.css`), and `@media (prefers-reduced-motion: no-preference)` guards on all motion. Keep `npm run lint`, `npm test`, and the axe a11y gate green.
4. **Both themes.** Verify light AND dark using tokens only. Never theme with raw hex.
5. **CC builds to PR-open and STOPS.** Never merge, never deploy. No "merge"/"deploy" actions.
6. **Halt language is exactly** `STOP and wait for dispatcher` or `STOP IMMEDIATELY`.

---

## Screen scope — App Shell

The Shell is shared by `AgentDashboard`, `ManagerDashboard`, and `TenantAdminDashboard`, each passing its own `navItems`. **This PR restyles the Shell chrome and adds new chrome capabilities. It does NOT change nav *content* (which items appear, their grouping, additions/removals/renames) — that defers to the Agent Dashboard screen. Manager/TenantAdmin nav content is untouched; they inherit the new chrome only.**

### IN scope
- **Sidebar container:** width 240px → 232px; padding tightened to match mockup; preserve the CSS-grid shell layout.
- **Brand block:** replace the `bg-primary` "A" square with the teal shield SVG brand mark ported inline from `app-shell.jsx`; brand name → 13.5px / 700; add a **data-driven** subline ("Tenant · Branch", e.g. "Tatil Life · South") sourced from existing auth/tenant context via `useAuth`. **Do NOT hardcode** the tenant/branch strings. If branch name isn't available from existing context, render the tenant name alone and bank a LOW FU — do NOT add a new data-fetch path here.
- **Section-group headers (capability):** restyle to `font-mono`, ~9.5px, 0.14em letter-spacing, tighter top padding. Renders whatever groups the nav config provides; agent nav stays its current single group for now.
- **Nav links:** 13px font; ~9px×12px padding; 17px icons (15px for child items); the new **3px left-bar active indicator** (absolute-positioned inside `position:relative` link); hover tint via existing primary-tint. Keep `aria-current="page"` and `focus-visible` rings.
- **Child/indented item support (capability):** indented child rows (~32px) with tree connector, 12px font, 15px icon. Not used by agent nav yet — built so later screens can use it.
- **Footer:** restyle to the info chip (34px avatar with initial, name 12.5px/700, role subtitle 10.5px). **KEEP a restyled sign-out affordance** (do not ship a sidebar with no desktop sign-out).
- **Collapse button:** **KEEP** it (wired to `localStorage` `agencytrack-sidebar-collapsed` + `main.jsx` pre-mount restore); restyle to match the mockup. Preserve `aria-label`/`aria-expanded`.
- **TopBar:** explicit height 60px; title in `font-display` (Cabinet Grotesk); search box restyle (≈280px, `--color-surface-muted` bg, matching radius). Icon buttons may match the mockup's smaller glyph but keep ≥44px hit area.
- **Mobile bottom-nav:** Submit becomes a **FAB** (floating action button) per the mobile mockup, keeping the existing `action:'submit'` → wizard behavior, ≥44px, `aria-label`, and `aria-current` on the tile items. Keep the "More" drawer.

### OUT of scope (deferred / excluded)
- Agent nav item additions/removals/renames + Planning/Tools/Recognition group assignments → **Agent Dashboard screen**.
- Manager / TenantAdmin nav content.
- The **"VIEW AS" RoleSwitcher** — prototype scaffolding, never ported.
- The **⌘K badge** — implies a command palette that doesn't exist; omit (misleading shortcut hint). Revisit if a palette ships.
- A new `--color-surface-soft` token — reuse `--color-surface-muted`; revisit system-wide later only if it proves pervasive across v2 screens.

---

## Phase 0 — clean-base gate
```
git checkout main && git fetch origin && git pull --ff-only origin main && git rev-parse HEAD
```
Expected HEAD = `32c4a5d` (or the current main tip if later PRs merged — report it). Untracked `scripts/verification/*`, `ui_capture_script.js`, `ui_screenshots/` → ignore. Create branch `redesign/shell` off fresh main; never reuse.
The first commit on this branch is this brief at `docs/briefs/track-j-shell-kickoff.md`.

## Phase 1 — source-verify (read-only, re-confirm on the fresh branch)
1. `git ls-files src/components/shell/` — confirm `Shell.jsx`, `Sidebar.jsx`, `TopBar.jsx`, `MobileBottomNav.jsx`, `MobileNavDrawer.jsx`.
2. `grep -n '\.shell\|\.sidebar\|\.topbar\|\.bottom-nav' src/index.css` — locate the shell CSS block.
3. Confirm `--color-surface-muted` and `--color-primary-tint` exist in `:root` AND `.dark` in `src/index.css`.
4. Read `app-shell.jsx` + `app-mobile.jsx` + the two HTML boards; confirm the deltas in this brief still match. If a delta materially differs from this brief, **STOP and wait for dispatcher**.

## Phase 2 — implement
Restyle, file by file, using tokens only:
- `src/index.css` shell block (`.sidebar*`, `.shell-main`, `.topbar*`, `.shell-content`, `.bottom-nav*`) + the responsive `@media` rules — apply the IN-scope visual deltas; add the `.sidebar-link` left-bar active indicator and the child-item (`.sidebar-link-child` or equivalent) styles.
- `src/components/shell/Sidebar.jsx` — brand block (shield SVG + data-driven subline), mono section headers, child-item rendering capability, restyled footer info chip + kept sign-out, kept restyled collapse button.
- `src/components/shell/TopBar.jsx` — 60px, display-font title, restyled search (no ⌘K), ≥44px icon buttons.
- `src/components/shell/Shell.jsx` — only if layout wiring needs it; preserve the single `<main>` landmark and collapse-state logic.
- `src/components/shell/MobileBottomNav.jsx` (+ `MobileNavDrawer.jsx` if needed) — Submit FAB; keep aria + reduced-motion guard (add the motion guard to the drawer's `transition-colors` while here).
Preserve all data/state/routing logic. No service, rule, index, or CF changes (flag immediately if any seem required → **STOP and wait for dispatcher**).

## Phase 3 — verify
`npm run lint` (0), `npm test` (green), axe a11y gate green, `npm run build` clean. Manually verify **light and dark**. Confirm all three dashboards still render inside the Shell. Confirm sidebar collapse persists across reload.

## Phase 4 — docs (fill with placeholders)
- `docs/CONTEXT.md`: add a Recently-shipped row for **PR #387** (`32c4a5d` — v2 design handoff bundle + eslint exclusion) and a new row for this PR (`#TBD`/`{TBD}`). Register **Track J — V2 Redesign** in the planned/active tracks section (screen-by-screen port of `design_handoff_v2_app/` mockups; Shell first).
- `docs/FOLLOW_UPS.md`: bank any LOW FU surfaced (e.g. branch-name unavailable for subline; `surfaceSoft` system-token revisit) with `#TBD` placeholder.

## Phase 5 — commit, push, open PR — then STOP
Commit the work; push `redesign/shell`; open the PR into `main` with the standard checklist (smoke box stays unchecked until Phase 6 runs). **Do NOT merge. Do NOT deploy.** Report verbatim: `gh pr diff <n> --name-only`, lint/test/build results, and the both-themes smoke notes. Then **STOP and wait for dispatcher**.

## Phase 6 — post-merge smoke (separate dispatch, after dispatcher merges)
Production smoke via `setupBypassSession`: log in as the test agent, verify the new Shell renders in light + dark; collapse the sidebar and reload (state persists); open the mobile bottom-nav + Submit FAB (→ wizard); confirm agent, manager, and tenant-admin surfaces all render inside the Shell. No rules/indexes/CF changed, so no live-rule check needed. Then fill the `#TBD`/`{TBD}` docs placeholders, push direct to main, and verify per Rule 15 (verbatim `git log origin/main --oneline -1` + HEAD==origin SHA match).

---

## STOP conditions (Rule 12)
- Phase 0 HEAD mismatch (and not explained by a later legitimate merge).
- Porting would require a new hex/token beyond the `surfaceSoft → surface-muted` decision.
- The data-driven subline would require a new data-fetch path.
- Any a11y gate would go red, or a control would drop below 44px.
- The work would touch nav *content*, manager/admin nav, services, rules, indexes, or CF.
In any of these: **STOP and wait for dispatcher.**
