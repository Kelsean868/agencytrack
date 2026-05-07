# AgencyTrack — Design System v2 PRD

> **What this is:** Product requirements for the "Concept 4 Complete" visual redesign. The canonical *what* and *why*. Companion implementation plan lives at [`docs/design-v2-implementation.md`](./design-v2-implementation.md).
>
> **Visual source of truth:** [`mocks/concept-4-complete.html`](../mocks/concept-4-complete.html) — every implementation decision should produce visual parity with this mock at 1440px desktop and 390px mobile, in both light and dark mode.
>
> **Status:** Approved by Kyron · Ready for phased implementation
> **Date approved:** 2026-05-06

---

## 1. Why this redesign

The current AgencyTrack UI is functional but visually flat. It reads as generic SaaS — competent, but not memorable, not motivating, and not pre-pilot-ready for a Tatil Life demo.

Three problems we are solving with this design:

1. **No visible gamification.** Field agents are motivated by ranks, streaks, and recognition. The current dashboard buries this — current rank is a number, badges are flat tiles, there's no activity feed reinforcing progress. Agents log in, submit, log out. We want them to *want* to log in.
2. **Manager dashboards do not differentiate by role.** Today, every manager (Unit, Branch, Sales, Tenant Admin) lands on the same `ManagerDashboard.jsx` (415 lines). This redesign gives each role a tailored surface scoped to what they own (unit / branch / region / company).
3. **Visual identity is undifferentiated.** The warm Nexus theme is in place but underused. The redesign leans into the warm teal palette, adds a polished medallion-based badge system, and introduces motion (carousel, hover interactions) that signals quality without slipping into mobile-game aesthetics.

The design must not feel like AI slop, must not use emojis as structural icons, and must hold up under the scrutiny of an insurance-industry audience.

---

## 2. What "done" looks like

Each of the 5 roles sees a tailored dashboard at both **mobile (≤768px, bottom nav)** and **desktop (≥1024px, left sidebar shell)** breakpoints. The current monolithic `AgentDashboard` and `ManagerDashboard` are wrapped in a sidebar shell. The manager dashboard is split per role (or branched cleanly inside `ManagerDashboard` until P9 lands the Sales Manager work).

Every interactive element honors the warm-teal palette in light mode and the cool-teal palette in dark mode. Every data-bound surface has an empty state. The redesign ships across 5 small PRs (B1–B5) — never as one monolithic change.

**Visual parity with [`mocks/concept-4-complete.html`](../mocks/concept-4-complete.html) is the bar.** When a question arises that the PRD or implementation doesn't answer, the mock is the source of truth.

---

## 3. In scope — by surface

### 3.1 Cross-cutting (all roles, all devices)

- Sidebar nav shell with role-specific items (desktop ≥1024px)
- Top bar with breadcrumb, search, notifications bell, primary CTA
- Mobile bottom nav with role-specific icons + labels (≤768px)
- Theme toggle persists (already shipped — keep as-is, may move to top bar)
- Empty states for every data-bound surface (no data, loading, error)
- Touch targets ≥ 44×44px on mobile

### 3.2 Agent role

| Surface | Detail |
|---|---|
| **Goal carousel hero** | 4 tabs: Week / Month / Quarter / YTD. Each tab shows period label, current API value, target, % to goal, status text, and a glossy donut SVG visualization. Auto-rotates every 6s, pauses on hover, click any tab to pin. |
| **Rank card** | Current branch rank (e.g., #3), gap to next position in dollars, current career tier pill ("Associate", "Senior", etc.). |
| **4-stat grid** | API, FFI, CI, Apps Sold. Each tile shows current value + week-over-week trend delta + small icon. |
| **Activity feed** | Last 7 days of events: report submissions, badge unlocks, rank changes, applications sold. Each entry has a categorized colored icon, title, subtitle, meta pills (status + rarity), and timestamp. |
| **Achievements grid** | 8 medal badges (mixed earned/locked). New medallion design with gradients + tier pips. Bottom progress bar shows X of 8 earned. |
| **Branch leaderboard mini** | Top 5 in branch, current user row highlighted. Ranks 1–3 use medal-coloured badges. |

### 3.3 Unit Manager role

| Surface | Detail |
|---|---|
| **4 stats** | Unit API total · goal progress % · reports in (X / N) · avg persistency. |
| **Weekly compliance table** | Agent list with submission status (submitted / pending / overdue). "Send reminder" action. |
| **Goal cascade card** | Unit total + per-agent personal commitments. Visualises whether agent commitments roll up to unit target. |
| **Master sheet table** | Full unit, this week. Columns: agent, calls, quotes, FFI, CI, apps, API. Sortable, exportable. |
| **Start Meeting CTA** | Links to existing `MeetingMode.jsx`. |

### 3.4 Branch Manager role

| Surface | Detail |
|---|---|
| **4 stats** | Branch API · YTD goal % · active campaigns · total agents. |
| **Units comparison** | Card grid (one per unit) with rank pill, total API, % to unit goal, progress bar. |
| **Recent settlements table** | Confirmed production, last 30 days. Status pill per row (Confirmed / Adjustments / Pending). |
| **Active campaigns sidebar** | Campaign cards with progress bar, days remaining, % on-track. "Create campaign" CTA. |
| **Persistency line chart** | 6-month branch trend, with "Apr: 93.4%" pill and "Goal ≥ 90%" reference line. Recharts. |

### 3.5 Sales Manager role *(P9 — schedule alignment)*

| Surface | Detail |
|---|---|
| **4 stats** | Region API · branches · top performer · YoY growth. |
| **Branch comparison cards** | One card per branch (3 in current spec) with rank pill, total API, YoY %, % to target. |
| **Region top-10 leaderboard** | Cross-branch ranking by YTD API. Each row: medal #, agent, branch · unit, YTD API. |
| **Region YTD trend** | Bar chart with actual months + projected months (lower opacity). Legend + month labels. |

### 3.6 Tenant Admin role

| Surface | Detail |
|---|---|
| **4 stats** | Total API YTD · active users (X/Y) · active branches (X/Y) · system health %. |
| **Company configuration grid** | 6 tiles: company min API per agent (editable), currency (display), fiscal year (display), persistency floor (editable), week start day (display), self-registration (toggle). |
| **Users by role** | Distribution bars: Agents, Unit Mgrs, Branch Mgrs, Sales Mgrs, Tenant Admins. |
| **Recent audit events** | Activity-feed-style log of admin actions (user.create, config.update, permissions.update, campaign.create). **DEFERRED — see §6.** |
| **Branch overview** | Cards per branch with health status pill, agent count, % to YTD goal, last sync time. |

### 3.7 Medal badge system

The single most-visible visual change in the redesign. Drops into the existing `BadgeGrid.jsx` component without changing its API.

| Property | Spec |
|---|---|
| **Shape** | Circular medallion, 52px desktop / 46px mobile. |
| **Surface** | Radial gradient (light center → mid tone → deep edge) for "polished metal" depth. 8 distinct palettes. |
| **Highlight** | Inner white blur in upper-left corner for sphere/coin 3D illusion. Pure CSS, no images. |
| **Glow** | Earned medals have a colored drop shadow matching their hue (e.g., gold medals glow gold). |
| **Tier pips** | 1–5 dots below medal indicating rarity. Common (1), Uncommon (2), Rare (3), Epic (4), Legendary (5). |
| **Locked state** | Neutral grayscale gradient + small lock pin in bottom-right corner. Card stays full opacity — aspirational, not depressing. |
| **Hover** | Earned medals lift 2px translateY and tilt -4° rotate. Card gets `box-shadow: var(--shadow-md)`. |
| **Icon set** | Lucide React (already in app). Filled style preferred for boldness against gradient. |
| **Reuse at smaller sizes** | Same medal asset rendered at 32–36px in activity feed entries when a badge is unlocked. |

#### Gradient palette mapping (semantic)

| Medal class | Gradient | Use case |
|---|---|---|
| `medal-1` | Amber → Gold → Bronze | Sales mastery (Closer Pro, Sharpshooter) |
| `medal-2` | Peach → Orange → Crimson | Hot streaks (On Fire, Big Week) |
| `medal-3` | Cyan → Teal → Deep Teal | Consistency (Streak ×4, Streak ×8) |
| `medal-4` | Cream → Gold → Burnt Amber | Major milestones (MDRT Qualified, MDRT Pace) |
| `medal-5` | Lavender → Purple → Royal | Volume milestones (Century Dials, MDRT Bound) |
| `medal-6` | Silver → Slate → Graphite | Top performer status (Elite, Dial King) |
| `medal-7` | Mint → Emerald → Forest | Excellence (Perfect Month, Untouchable) |
| `medal-8` | Pink → Violet → Deep Purple | Mythic status (Legend, Consistent — 12 mo) |

Mapping each existing badge in `BADGES` dict (`src/components/gamification/BadgeGrid.jsx`) to one of these is part of PR B1. See implementation plan.

---

## 4. Out of scope (this design pass)

| Item | Why out |
|---|---|
| Audit Log infrastructure | New Firestore collection + Cloud Function triggers. Park as future "P11 Compliance" work. UI shell may stub the surface but data wiring deferred. |
| Self-registration / signup flow | Existing decision: managers create all accounts. Not changing. |
| Custom branding per tenant | Multi-tenancy work (P10). Out of scope for visual redesign. |
| Notifications drawer redesign | Drawer content stays as-is; only the topbar bell visual updates. |
| Wizard form redesign | 5-screen wizard is intentionally untouched (per CLAUDE.md "never modify Step1–Step9"). |
| New role types | Visual redesign uses existing 5 roles (agent, unit_manager, branch_manager, sales_manager, tenant_admin). |
| Charts beyond what's specified | No new chart types beyond the persistency line chart (Branch) and region YTD bar chart (Sales). |

---

## 5. Success criteria

A PR is "done" when **all** of these pass:

- ✅ Visual parity with `mocks/concept-4-complete.html` at 1440px, 1024px, 768px, and 390px breakpoints
- ✅ Both light and dark mode pass visual review (no contrast regressions)
- ✅ All 5 role logins render their dashboard without errors
- ✅ `npm run lint` exits 0 (matches existing CI gate per CLAUDE.md)
- ✅ `npm run build` succeeds
- ✅ Lighthouse accessibility score ≥ 95 on AgentDashboard
- ✅ All interactive elements ≥ 44×44px touch target on mobile
- ✅ No emojis used as structural icons (per existing project policy)
- ✅ No hardcoded hex outside CSS variables (except `AgentReportDocument.jsx` per existing exception)
- ✅ Vercel preview URL passes incognito smoke test (per CLAUDE.md workflow)
- ✅ Zero regressions in existing flows (wizard submission, manager review, settlement entry, etc.)

A PR that introduces a **new** Firestore field or migration must additionally:
- ✅ Pass schema diff review (no unrelated `schema.rb`-equivalent drift)
- ✅ Include a backfill script if the field is required on existing docs

---

## 6. Constraints — non-negotiable

These come from existing project policy in `CLAUDE.md` and `docs/CONTEXT.md`. Restating here so this PRD is self-contained.

### Code constraints
- Keep `AgentReportDocument.jsx` HEX-only (react-pdf cannot resolve CSS variables).
- Do **not** modify `src/components/wizard/steps/Step1.jsx` through `Step9.jsx`. The 5-screen wizard groups them via `WizardForm.jsx` only.
- All numeric writes to Firestore must remain `parseFloat()` enforced.
- Currency stays TTD via `formatCurrency()` from `src/utils/formatters.js`.
- All submission field reads must go through `extractFields()` in `src/utils/extractFields.js`.
- Lucide React only for iconography. No emojis as structural icons.

### Workflow constraints
- Single-branch PR rule: one PR per phase (B1, B2, B3, B4, B5). No bundling.
- Always pull main before branching: `git fetch origin && git pull origin main`.
- Never push directly to `main`. Worktree branch → PR → preview-verified → human merge.
- `npm run lint && npm run build` must both pass before pushing.
- Vercel preview URL must be smoke-tested in incognito before merge.
- 60-second production smoke test after merge (per CLAUDE.md).

### Theme constraints
- Add new CSS variables to **both** `:root` and `.dark` in `src/index.css`. Light + dark must be designed together.
- Do not modify existing theme tokens (`--color-bg`, `--color-surface`, `--color-primary`, etc.). Only add new ones.
- Tailwind utilities should resolve through `var(--color-*)`. Avoid arbitrary `bg-[#hex]` values in component code.

### Data constraints
- No new Firestore collections in PR B1, B2, B3 (visual changes only).
- PR B4 may introduce empty stub routes for surfaces that don't have data yet.
- PR B5 reads/writes `config/companyMinimums` only — no new collections.
- Audit Log infrastructure is **deferred** to a future ticket — surface may be stubbed but no Cloud Function triggers in this redesign.

---

## 7. Open questions — answer before implementation begins

These need explicit decisions from Kyron before the relevant PR starts. Each PR's "what to do first" step should re-surface these.

| # | Question | Affects PR | Default if no answer |
|---|---|---|---|
| Q1 | Should the goal carousel auto-rotate be a user setting (toggle in profile)? | B2 | Auto-rotate ON by default, no setting (matches mock) |
| Q2 | For locked badges, should hover briefly preview the colored gradient? | B1 | No — keep grayscale on hover, simpler |
| Q3 | Activity feed: max items shown? Pagination strategy? | B3 | 7-day window, capped at 25 items, "View all" link to history |
| Q4 | Should the rank stripe show a sparkline of rank-over-time? | B2 | No — adds complexity, cut for v1 |
| Q5 | Tenant Admin: which audit event types are MVP? Which are nice-to-have? | (Deferred) | Defer all audit log work to P11 |
| Q6 | Sidebar collapsed width (72px) at 768–1023px — keep, or hide entirely? | B4 | Keep collapsed; mock matches this |
| Q7 | Where does the theme toggle live after sidebar lands? Topbar or remain in dashboard header? | B4 | Move to topbar (right side, before notifications bell) |
| Q8 | Should manager bottom nav items differ per role on mobile? | B4 | Yes — match the mock's per-role bottom nav |

---

## 8. Reference

- Visual mock: [`mocks/concept-4-complete.html`](../mocks/concept-4-complete.html)
- Original concepts: [`mocks/concept-1-clarity.html`](../mocks/concept-1-clarity.html), [`mocks/concept-3-momentum.html`](../mocks/concept-3-momentum.html), [`mocks/concept-4-hybrid.html`](../mocks/concept-4-hybrid.html)
- Implementation plan: [`docs/design-v2-implementation.md`](./design-v2-implementation.md)
- Project rulebook: [`CLAUDE.md`](../CLAUDE.md)
- Project state: [`docs/CONTEXT.md`](./CONTEXT.md)
- Kickoff template: [`docs/kickoff-template.md`](./kickoff-template.md)
