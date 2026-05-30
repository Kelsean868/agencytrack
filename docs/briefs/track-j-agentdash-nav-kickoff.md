# Track J — V2 Redesign · Agent Dashboard, PR 1 of 2: Nav IA Rewrite (J-AD-nav)

**Branch:** `redesign/agentdash-nav`
**Base:** `main` @ `a67743e`
**Channel:** GATED — human merge + dispatcher pre-review. **Auto-merge does NOT apply.**
**Smoke:** REQUIRED (user-visible nav change).
**References:** `design_handoff_v2_app/README.md` §4/§6, `mockups/app-shell.jsx` (grouped nav), `mockups/AgencyTrack Agent Dashboard v2.html`. Operating contract: `docs/briefs/track-j-shell-kickoff.md`.

This is PR 1 of 2 for the Agent Dashboard. PR 1 = the **nav IA** (sidebar grouping + the tab homes the new items point at). PR 2 (`J-AD-home`, separate brief) = the dashboard home-body rework. **PR 1 does NOT touch the dashboard home content.**

---

## Confirmed decisions (encode exactly)
- **Production Report — KEPT.** Add to the TOOLS group (deliberate deviation from the mockup, which omits it — we don't strand agent access).
- **Leaderboard — KEPT.** Add to RECOGNITION group; retain the mobile "Ranks" bottom-nav slot (deliberate deviation).
- **Goals — basic tab now.** New `goals` tab renders the existing `GapAnalysisPanel` (the 5-layer hierarchy IS the goals view). Full v2 Goals visual treatment is a later screen / Phase 9.
- **Commission — new tab → existing `CommissionPlayground`.** This **resolves the #389 agent-access FU** (mark it RESOLVED in Phase 4).
- **Profile — removed from the sidebar list → footer-avatar click.** Wire the Shell footer avatar (PR #388) to navigate to the profile tab.
- **Game Plan — DEFERRED** to its own screen. Money Needs stays a top-level PLANNING item this PR; it re-nests under Game Plan when that ships.

## Dispatcher-level decisions (no further input)
- Token gaps: `surfaceSoft` → `var(--color-surface-muted)`; `inkDim` → `var(--color-border-strong)` (only if touched); `#fff` CTA text → `text-white`. **No new tokens.**
- `DeliveryStripCard` + the dashboard home rework belong to PR 2 — out of scope here.

---

## Target nav structure (agent sidebar, v2)
Ungrouped (no header): **Dashboard** (Home), **Weekly Report** (Lucide `NotebookPen`; action → `setShowWizard(true)`, NOT a tabId — mirror the Submit-FAB action pattern), **History** (History).
**PLANNING** (mono header): **Money Needs** (Wallet; existing `money-needs` tab), **Goals** (Target; new `goals` tab → `GapAnalysisPanel`).
**TOOLS** (mono header): **Commission** (Zap; new `commission` tab → `CommissionPlayground`), **Persistency** (Repeat; existing), **Policy Ledger** (BookOpen; existing), **Prospect Prep** (Search; existing `prospect-info` tab — **rename label only** from "Joint-Call Prep"), **Production Report** (BarChart2; existing, KEPT).
**RECOGNITION** (mono header): **Awards** (Medal; existing), **Career Portal** (Shield; existing), **Leaderboard** (Star; existing, KEPT).

**Profile:** remove from `NAV_ITEMS`; footer avatar (Shell) becomes a labelled button → profile tab.
**Mobile `BOTTOM_NAV`:** UNCHANGED — home / Submit FAB / history / Ranks (leaderboard) / profile. (Mobile keeps Profile + Ranks reachable since the sidebar is hidden < 768px.)

The Shell (PR #388) already styles mono section headers and child items; this PR feeds the grouped data and renders the headers — it does not restyle the Shell.

---

## Phase 0 — clean-base gate
```
git checkout main && git fetch origin && git pull --ff-only origin main && git rev-parse HEAD
```
Expect `a67743e…`. Untracked verification artifacts → ignore. Branch `redesign/agentdash-nav` off fresh main. This brief is commit 1.

## Phase 1 — source-verify (read-only; STOP on any miss)
1. `src/components/dashboard/AgentDashboard.jsx` — confirm current `NAV_ITEMS` + `BOTTOM_NAV` shape, the tab-render switch, and how the home computes the props it passes to `GapAnalysisPanel` (`hierarchy`, `ytdTotals`, `loading`, `error`) — the `goals` tab reuses that same computed data.
2. `CommissionPlayground` props signature (`submissions`, `agentId`, `tenantId`) — confirm what AgentDashboard already has on hand to pass.
3. `Sidebar.jsx` (PR #388) — confirm the section-header + child-item styling hooks exist, and the footer avatar element to make clickable.
4. Read `mockups/app-shell.jsx` + `Agent Dashboard v2.html` — confirm the grouping/labels/icons match this brief. **If the mockup shows Game Plan as non-deferrable (e.g., Money Needs only renders inside a Game Plan shell), STOP and wait for dispatcher.**
5. Confirm every target nav item resolves to a real home. Any item with no home → **STOP and wait for dispatcher.**

## Phase 2 — implement
- `AgentDashboard.jsx`: restructure `NAV_ITEMS` into the grouped shape above (add `group`/section metadata the Sidebar reads); add the Weekly Report **action** item; add `commission` + `goals` tab renders (thin wrappers over existing `CommissionPlayground` / `GapAnalysisPanel`, reusing existing computed props + loading/empty/error states); rename the Prospect Prep label; update icons; remove Profile from `NAV_ITEMS`; leave `BOTTOM_NAV` as-is.
- `Sidebar.jsx`: render mono group headers for grouped `NAV_ITEMS` (using the #388 styling); make the footer avatar a labelled `<button>` (`aria-label="Open profile"`) wired via a callback to select the profile tab.
- `Shell.jsx`: only if needed to pass the profile-select callback through to the footer.
- Tokens only; no service/rule/index/CF change (if any seems required → **STOP and wait for dispatcher**).

## Phase 3 — verify
`npm run lint` (0) · `npm test` (green) · axe (0 serious/critical) · `npm run build` (clean). Light AND dark. Confirm: every nav item navigates to a real home; Commission + Goals render; Prospect Prep label; Production Report + Leaderboard reachable; Profile opens via the footer avatar; mobile bottom-nav intact (Ranks + Profile present).

## Phase 4 — docs (placeholders)
- `docs/CONTEXT.md`: Recently-shipped row for this PR (`#TBD`/`{TBD}`).
- `docs/FOLLOW_UPS.md`: mark the **#389 CommissionPlayground-agent-access FU RESOLVED** (new Commission tab restores agent access); bank a LOW FU: "Game Plan v2 screen deferred — when it ships, add the Game Plan PLANNING item and re-nest Money Needs under it."

## Phase 5 — commit, push, open PR — then STOP
Commit; push `redesign/agentdash-nav`; open the PR into `main` (smoke box unchecked). **Do NOT merge. Do NOT deploy.** Report verbatim: `gh pr diff <n> --name-only`, lint/test/build/axe results, both-themes notes. Then **STOP and wait for dispatcher.**

## Phase 6 — post-merge smoke (separate dispatch, after dispatcher merges)
Prod smoke via `setupBypassSession` as the test agent, light + dark: walk EVERY nav item → its real home; confirm group headers render; Commission + Goals load; Prospect Prep label; Production Report + Leaderboard reachable; Profile opens from the footer avatar; mobile bottom-nav (Ranks + Profile) intact. No rules/indexes/CF — no live-rule check. Then fill the `#TBD`/`{TBD}` docs placeholders with the squash SHA, push direct to main, verify Rule 15 (BOTH full 40-char SHAs, HEAD == origin/main). Report verbatim and STOP.

## STOP conditions (Rule 12)
- Phase 0 HEAD mismatch.
- Game Plan proves non-deferrable, or any nav item has no resolvable home.
- A new token / rule / index / CF / route would be required.
- Any a11y gate would go red or a control would drop below 44px.
- The work would touch the dashboard home body (that's PR 2).
Any of these → **STOP and wait for dispatcher.**
