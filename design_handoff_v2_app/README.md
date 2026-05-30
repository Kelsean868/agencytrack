# Handoff: AgencyTrack v2 App Redesign

> **Read this first.** This bundle documents how to apply the v2 app redesigns to the **existing** `Kelsean868/agencytrack` codebase. The good news: the repo *already* runs the same design system these mockups were drawn in. This is a **port-the-redesign** job, not a build-from-scratch job — and **not** a paste-the-HTML job.

---

## 1. Overview

AgencyTrack is an insurance sales activity-tracking SaaS for **Tatil Life (Trinidad & Tobago)**. Agents log weekly activity; managers coach against a company floor; a back office (CRO) reconciles settlements; recognition (awards, campaigns, kiosk, meeting) runs off one reconciled ledger.

This handoff covers the **v2 app screens** (agent, manager, CRO/back-office, kiosk & meeting surfaces, system screens, and transactional emails). It does **not** cover the marketing website (separate artifact).

The files in `mockups/` are **design references created in HTML** — pixel-accurate prototypes of the intended look + behavior. They are **not** production code to copy. The task is to **recreate each mockup inside the existing React codebase**, using its established components, tokens, and patterns. Where a mockup shows a surface that doesn't exist yet, build it in the repo's conventions (don't fork a new styling approach).

---

## 2. Fidelity: **High-fidelity**

Every mockup is hi-fi — final colors, type, spacing, and interactions. Recreate the UI faithfully using the codebase's existing primitives. Do not approximate spacing/typography; match it. When the mockup and an existing component disagree, the **mockup is the target** (it's the newer design) — update the component.

---

## 3. The target codebase (confirmed by repo analysis)

| Aspect | Value |
|---|---|
| Framework | **React 19** (function components + hooks) |
| Build | **Vite 8** |
| Styling | **Tailwind CSS 3.4** (`darkMode: 'class'`) + a small `@layer components` set in `src/index.css` |
| Icons | **lucide-react** (`import { TrendingUp } from 'lucide-react'`) |
| Charts | **recharts** (sparklines, donuts, bars) |
| PDF | **@react-pdf/renderer** + **jspdf / jspdf-autotable** |
| CSV | **papaparse** |
| Backend | **Firebase** (Auth, Firestore, Cloud Functions, Storage), multi-tenant (`tenants/{tenantId}/…`) |
| Hosting | **Vercel** (app) + Firebase (functions) · PWA via `vite-plugin-pwa` |
| Tests | **Vitest** + Testing Library + Playwright + `@axe-core/playwright` (a11y gate) |
| Lint | ESLint (incl. `eslint-plugin-jsx-a11y`) + Prettier |

**Routing** is role-based in `src/App.jsx` (no router lib): `loading → LoginScreen → role switch`. Roles: `agent`, `unit_manager` / `branch_manager` / `sales_manager` / `platform_admin` (share `ManagerDashboard`), `tenant_admin` (own dashboard). Each dashboard owns its `activeTab` state and renders tab content inside the `Shell` (sidebar + topbar + mobile bottom-nav). The **CRO / back-office role is not yet a routed surface** — see §7.

**Read these in the repo before starting:** `CLAUDE.md` (engineering methodology + a11y rules), `APP_MANUAL.md` (phase-by-phase feature/file inventory), `docs/CONTEXT.md`, and `src/index.css` (the entire design system lives here in `:root` / `.dark`).

---

## 4. ⭐ The design system already exists — use it, don't reinvent it

The mockups and the repo share **one** design language. The repo's tokens in `src/index.css` + `tailwind.config.js` are a 1:1 match for the CSS variables in the mockups (the repo even cites `mocks/concept-4-complete.html` as the canonical source). **Map every raw value in a mockup to the existing token.** Never introduce a new hex.

### Color token bridge

| Mockup CSS var (raw) | Light hex | Repo token → Tailwind class |
|---|---|---|
| `--teal` | `#01696F` | `primary` → `bg-primary` `text-primary` `ring-primary` |
| `--teal-deep` | `#014E52` | `primary-dark` → `bg-primary-dark` |
| `--teal-bright` / light | `#018A91` | `primary-light` → `text-primary-light` |
| `--teal-tint` | `#E6F4F4` | `primary/10` or `bg-primary-tint` (`primary.tint`) |
| `--cream` (page bg) | `#F7F6F2` | `surface` → `bg-surface` (alias of `--color-bg`) |
| `--paper` (cards) | `#FFFFFF` | `card` → `bg-card` |
| `--ink` (text) | `#28251D` | `ink` → `text-ink` |
| `--ink-mute` | `#6B6560` | `ink-muted` → `text-ink-muted` |
| `--ink-faint` | `#A8A39C` | `ink-faint` → `text-ink-faint` |
| `--rule` (border) | `#E5E2DB` | `border` → `border-border` |
| `--gold` (achievement) | `#B07D1A` | `gold` → `text-gold` `bg-gold-tint` |
| success / warning / danger | `#2D7A4F` / `#B4530A` / `#C0392B` | `success` / `warning` / `danger` (+ `*-tint`) |
| dark presentation surface (Kiosk / Meeting bg) | `#1A1612` | `presentation` → `bg-presentation` `text-presentation-text` `text-presentation-accent` |
| medal gradients (rank 1/2/3 …) | `#fde68a→#f59e0b→#b45309`, etc. | `.medal-1 … .medal-8` (+ `.glow`) in `index.css` — **reuse the class, don't re-author the gradient** |

> The mockups' marketing-teal `--teal-bright:#36BDB9` is a *website-only* brightness; in-app, bright teal is `primary-light` (`#018A91` light / `#4ab5b8` dark). Use the token, not the hex.

**Dark mode is real and shipped.** Every token has a `.dark` value in `index.css`; `primary` lifts to `#4ab5b8`, surfaces go warm-dark. Build each screen so it works in both themes by using tokens only. The `presentation` surface is intentionally theme-independent (always dark) — that's why Kiosk/Meeting look the same in both modes.

### Type, spacing, radius, shadow

- **Fonts:** `font-display` = Cabinet Grotesk (headings, big numbers), `font-sans` = Satoshi (body), `font-mono` = JetBrains Mono (labels/eyebrows/figures). Already imported in `index.css`.
- **Radius:** Tailwind `rounded-lg` (.75rem) / `rounded-xl` (1rem) / `rounded-2xl` (1.5rem). Cards use `rounded-xl`.
- **Shadow:** `shadow-sm/md/lg` map to the warm-toned `--shadow-*` tokens.
- **Hit targets:** `min-h-[44px]` on interactive controls (already baked into `.btn-primary`, `.input`).

### Ready-made component utilities (in `src/index.css @layer components`)

Reach for these before writing bespoke classes: `.card`, `.btn-primary`, `.btn-secondary`, `.input`, `.label`. Plus rich primitives already authored: `.role-hero` (gradient role banner), `.goal-carousel` + `.hero-donut` (animated goal donut), `.badge-grid` / `.badge-medal` / `.medal-N` (achievement coins), `.activity-list` / `.activity-item` (activity feed), `.shell` / `.sidebar` / `.topbar` / `.bottom-nav` (app shell), `.config-tile-grid` (tenant-admin tiles). **If a mockup shows one of these patterns, the CSS is already done — wire the markup to it.**

---

## 5. Reusable React primitives (don't rebuild these)

| Need | Component |
|---|---|
| App frame (sidebar + topbar + bottom-nav) | `src/components/shell/Shell.jsx` (+ `Sidebar`, `TopBar`, `MobileBottomNav`, `MobileNavDrawer`) |
| KPI stat card w/ sparkline + delta | `src/components/dashboard/KPICard.jsx` |
| Tab pills | `src/components/ui/TabPills.jsx` |
| Status chip | `src/components/ui/StatusPill.jsx` |
| Avatar (initials + photo fallback) | `src/components/ui/Avatar.jsx` (also `kiosk/Avatar.jsx`) |
| Confirm dialog | `src/components/ui/ConfirmDialog.jsx` |
| Toasts | `src/components/ui/ToastProvider.jsx` + `Toast.jsx` (`useToast`) |
| Notifications | `src/components/ui/NotificationBell.jsx` + `NotificationDrawer.jsx` |
| Right-side detail drawer | `src/components/submissions/SubmissionViewer.jsx` (pattern to copy) |
| Award medal | `src/components/awards/AwardMedal.jsx` / `AwardMedalCard.jsx` (+ `awardIconMap.js`) |
| Currency / number formatting | `src/utils/formatters.js` (`formatCurrency` → `TTD 5,000`) |
| Field schema normalisation | `src/utils/extractFields.js` (handles the wizard's flat + nested schemas) |

---

## 6. Screen → component map (all 34 mockups)

Paths are the existing files to **update** (or the folder to add to). "★ new" marks a surface with no obvious existing component — build it in-pattern.

### Agent
| Mockup | Target component(s) |
|---|---|
| Agent Dashboard v2 | `dashboard/AgentDashboard.jsx` + `KPICard`, `GoalCarousel`/`GoalDonut`, `ActivityFeed`, `WeeklyStandardCard` |
| Weekly Report Wizard v2 | `wizard/WizardForm.jsx` + `wizard/steps/*` + `CardStack`/`NumericField`/`CurrencyField` |
| Daily Capture v2 | `daily/DailyEntryModal.jsx` |
| Game Plan v2 | `agent/MoneyNeedsPanel.jsx` + `goals/GapAnalysisPanel.jsx` |
| Goals v2 | `manager/GoalsPanel.jsx` (cascade) + wizard `steps/Step9Goals.jsx` (agent target) |
| Policy Ledger v2 | `agent/PolicyLedgerPanel.jsx` |
| Persistency v2 | `agent/PersistencyTab.jsx` (agent) · `manager/PersistencyTab.jsx`+`PersistencyEntryForm`+`PersistencyAgentRow` (manager entry) |
| Prospect Prep v2 | `agent/ProspectInfoPanel.jsx` + `manager/JointCallsTab.jsx` (joint-call prep) |
| Commission v2 | `goals/CommissionPlayground/` |
| Agent Awards v2 | `awards/AgentAwardsPanel.jsx` + `AwardMedal`/`AwardMedalCard`/`awardIconMap` |
| Career Portal v2 | `profile/CareerPortal.jsx` |
| History v2 | `submissions/SubmissionViewer.jsx` + AgentDashboard "History" tab |
| Agent Report View v2 | `profile/AgentReportDocument.jsx` (react-pdf) + `productionReport/AgentProductionView.jsx` |
| Settings v2 | `profile/ProfileScreen.jsx` (+ `EmailUpdateModal`) |

### Manager
| Mockup | Target component(s) |
|---|---|
| Manager Dashboard v2 | `dashboard/ManagerDashboard.jsx` + `ManagerHeroSection`, `ManagerOverviewTab`, `BranchKPIStrip`, `TeamMedalsPanel`, `BranchActivityFeed` |
| Master Sheet v2 | `manager/MasterSheet.jsx` (23-col sticky table) |
| Compliance v2 | `manager/CompliancePanel.jsx` |
| Weekly WARs | `manager/ManagerWarTab.jsx` + `ManagerWarDetail.jsx` + `TeamWarsTab.jsx` |
| Monthly Recruiting | `manager/MonthlyRecruitingTab.jsx` |
| Campaigns | `campaigns/CampaignPanel.jsx` + `CampaignCard.jsx` |
| Manager Reports / Branch Report / Reports | `productionReport/*` (`ProductionReportTab`, `ProductionTable`, `BranchManagerProductionView`, `UnitManagerProductionView`, `RankedLeaderboard`, `TimePeriodToggle`) + `ui/ReportRangeModal` |
| Leaderboard | `gamification/Leaderboard.jsx` + `WeeklyChampionsBanner` + `productionReport/RankedLeaderboard` |
| Manager Awards (within Agent Awards mockup) | `awards/ManagerAwardsPanel.jsx` + `awards/BmAtRiskPanel.jsx` |

### CRO / back-office  ★ (role not yet routed — see §7)
| Mockup | Target component(s) |
|---|---|
| CRO | `manager/PolicyReconciliationPanel.jsx` + `manager/SettlementPanel.jsx` + `productionReport/*` + **★ Delivery Register / 30-day clawback clock (new)** |
| Policy Reconciliation | `manager/PolicyReconciliationPanel.jsx` |
| Production Report v2 | `productionReport/ProductionReportTab.jsx` (+ table/views above) |

### Presentation surfaces (always-dark `presentation` tokens)
| Mockup | Target component(s) |
|---|---|
| Kiosk Mode | `kiosk/KioskShell.jsx`, `KioskModeTab.jsx`, `KioskRoute.jsx`, `kiosk/panels/*`, `kiosk/Avatar.jsx`, `FullscreenButton.jsx` |
| Meeting Mode v2 | `manager/MeetingMode.jsx` (Group + 1-on-1) |

### Shell / system / cross-cutting
| Mockup | Target component(s) |
|---|---|
| App Layout | `shell/Shell.jsx` + `Sidebar.jsx` + `TopBar.jsx` (+ `.shell`/`.sidebar`/`.topbar` in `index.css`) |
| App Mobile / Mobile Nav | `shell/MobileBottomNav.jsx` + `MobileNavDrawer.jsx` (+ mobile `@media` rules in `index.css`) |
| System Screens | `auth/LoginScreen.jsx`, the `App.jsx` states (Loading/Provisioning/Stub), `onboarding/*`, `ui/Toast`, `ConfirmDialog`, `NotificationDrawer` (empty/error/loading states) |
| Emails | `functions/email-templates/*.html` (`monday-nudge`, `sunday-nudge`, `password-reset`) — server-rendered transactional HTML, **not** React. See §8. |

> Some labels (Branch Report vs Manager Reports vs Reports) overlap the same `productionReport/*` suite at different scopes (agent / unit / branch / cross-branch). Open each mockup to confirm the exact scope before editing.

---

## 7. Notes on the bigger / trickier ports

- **App shell first.** Land `App Layout` + `App Mobile` before screen work — every screen renders inside `Shell`. Nav item lists, the collapse toggle (`localStorage.agencytrack-sidebar-collapsed`), and the `<768px` bottom-nav are already wired; match the mockup's nav grouping, icons (lucide), and active states.
- **CRO / back-office role.** `App.jsx` has no CRO branch today. Decide: add a `cro` role + dedicated dashboard (mirroring `TenantAdminDashboard`), or surface CRO tools inside `ManagerDashboard` gated by `canConfirmSettlements`. The **Delivery Register + 30-day clawback clock** is the one genuinely new surface — model it on `SettlementPanel`/`PolicyReconciliationPanel` (same table + status-pill + drawer patterns, Firestore-backed).
- **Master Sheet** is a 23-column sticky table (`border-separate border-spacing-0`, sticky first two columns). Keep the column set and the API/closing-ratio color bands from `APP_MANUAL.md`; restyle only what the mockup changes.
- **Meeting Mode & Kiosk** use the `presentation` (always-dark) tokens and the `.medal-N` coin classes + podium. Drive any "live" rotation off real data, not timers-for-show; the repo already has `kiosk-fade` / `count-up` keyframes in `tailwind.config.js`.
- **Wizard** is 9 steps with debounced Firestore autosave and the shared `CardStack` field components — restyle the chrome/progress, but preserve the autosave + schema (`submissionService`, `extractFields`).
- **Charts**: use recharts with `stroke="var(--color-primary)"` and `isAnimationActive={false}` (see `KPICard.jsx`) so theme + reduced-motion behave.

---

## 8. Emails (`functions/email-templates/`)

The "Emails" mockup maps to **server-rendered HTML emails** sent by Cloud Functions (`functions/index.js`, `functions/utils/email.js`), not React. Port the visual design into the existing `.html` templates (`monday-nudge.html`, `sunday-nudge.html`, `password-reset.html`) using **inline styles / table layout** (email clients don't support the app's CSS or Tailwind). Keep brand teal `#01696F`, Cabinet Grotesk/Satoshi with web-safe fallbacks, and the existing template variables. There is a matching `.txt` part for each — keep them in sync.

---

## 9. State, data & behavior (applies app-wide)

- **Auth/role** from `useAuth()` (`src/context/AuthContext`); never hardcode role.
- **Data** is Firestore under `tenants/{tenantId}/…` via the `src/services/*` layer (`managerService`, `persistencyService`, `settlementService`, `submissionService`, …). Reuse services; don't query Firestore from components directly.
- **Every panel needs loading / empty / error states** (skeleton rows, friendly empty copy, error card) — the repo treats these as required, not optional.
- **Accessibility is gated in CI** (`@axe-core/playwright`, `eslint-plugin-jsx-a11y`): semantic landmarks (single `<main>` lives in `Shell`), labelled controls, `focus-visible` rings (`ring-2 ring-primary`), 44px targets, and `prefers-reduced-motion` guards on all transitions/animations (follow the `@media (prefers-reduced-motion: no-preference)` pattern already in `index.css`).

---

## 10. Recommended workflow with Claude Code

1. **Open the repo in Claude Code** and read `CLAUDE.md` + `APP_MANUAL.md` + `src/index.css` so it internalises the conventions and a11y gate.
2. **Point it at this bundle.** Drop `design_handoff_v2_app/` into the repo (or reference its path) so the mockups + this README are in context.
3. **Work one screen at a time**, in this order: `App Layout/Mobile` (shell) → Agent suite → Manager suite → CRO/back-office → Kiosk/Meeting → System screens → Emails.
4. For each screen: open the mockup HTML side-by-side with the mapped component, **diff the visual deltas**, and port them using existing tokens/primitives. Replace raw hex/px with tokens (§4). Don't touch data/services logic unless the redesign requires it.
5. **Verify before moving on:** `npm run lint`, `npm test` (Vitest), and the Playwright/axe a11y checks; eyeball light **and** dark mode. Match the mockup, then commit per-screen with a clear message.
6. Branch per area (e.g. `redesign/agent-dashboard`), small PRs, mirror the repo's existing commit style.

A suggested kickoff prompt for Claude Code is in **`CLAUDE_CODE_PROMPT.md`**.

---

## 11. Bundle contents

- `README.md` — this document.
- `CLAUDE_CODE_PROMPT.md` — ready-to-paste kickoff prompt.
- `mockups/` — 34 hi-fi HTML design references **plus their shared `.jsx`/`.js` modules** (tokens, motion, shell, design-canvas, per-screen scenes). The `.html` files are the source of truth.

### How to view the mockups
Each `.html` is an **interactive design-canvas board**, not a single flat screen — it holds several artboards per screen (e.g. desktop + mobile + a drilled-down state) with annotation cards explaining intent. To use them:
- Open the `.html` in a browser (or `npx serve` the `mockups/` folder so the sibling `.jsx` modules load).
- **Pan** = drag the canvas · **Zoom** = ⌘/Ctrl-scroll (or trackpad pinch).
- Click an artboard's **Focus** button (or press it then use **← / →**) to view a single screen fullscreen; **Esc** exits.
- Read the annotation card on each board first — it lists the design intent and the interaction model for that screen.

> Flat PNG screenshots were intentionally not bundled: these boards carry multiple artboards + annotations each, so a single image misrepresents them. Open the board for the real, inspectable design (devtools gives exact px/colors). Ask if you'd like flat exports of specific priority screens.

## 12. Out of scope / deferred (do NOT build unless asked)
- The marketing website.
- The Tenant Admin configuration suite (Dashboard, Branches, Company Config, Awards Ruleset, Plan Catalog, Bulk Imports) — the repo already implements these under `components/admin/`; the v2 mockups intentionally exclude them.

---

*Assets: profile/team imagery in some mockups uses placeholder Unsplash URLs for humanisation only — swap for licensed or first-party photography before production. Brand mark is the inline teal shield SVG used in the shell/sidebar.*
