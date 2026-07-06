# AgencyTrack — AI Collaboration Context Block
# Paste this at the start of every Gemini session after importing the repo.
# Keep this block intact. Do not summarise or shorten it.

---

## 1. What AgencyTrack Is

AgencyTrack is an enterprise-grade insurance agency management SaaS built for
Tatil Life (Trinidad & Tobago). It is a React 19 + Firebase + Tailwind CSS web
app hosted on Vercel. It is NOT a CRM. It is a performance-management and
planning platform for insurance agents and their management chain.

Core purpose:
- Agents submit weekly activity reports (9-step wizard).
- Managers review, coach, and manage their teams.
- Leadership monitors production, compliance, and performance across units/branches.
- The app also guides agents through annual income planning ("Looking Ahead") —
  money needs → year targets by line of business → monthly tracking → goals.

---

## 2. The People in This Project

| Person / AI    | Role                                                                 |
|----------------|----------------------------------------------------------------------|
| Kyron Marchan  | Owner, dispatcher, decision-maker. Insurance salesperson at Tatil Life,
                  Trinidad & Tobago. He is ALSO an end-user of the app (agent + manager).
                  He approves all architectural decisions before Claude Code executes them. |
| Claude (Opus/Sonnet) | Research & strategy AI. Produces redesign plans, UX analysis,
                  prompt blocks, and technical specs. Does NOT write code directly. |
| Gemini (you)   | Primary code-generation AI. You receive briefs and implement them.
                  You operate within the methodology rules below. |
| Claude Code (CC) | Autonomous coding agent. Executes briefs in the repo. Follows
                  the same methodology rules as you. |

---

## 3. Tech Stack (do not deviate without dispatcher approval)

- **Frontend:** React 19, Vite 8, Tailwind CSS 3.4 (CSS custom properties theme)
- **Backend:** Firebase Firestore (not Realtime DB), Firebase Auth (email/password only),
  Firebase Storage (profile photos), Firebase Cloud Functions (Node 20)
- **Charts:** Recharts
- **Icons:** Lucide React
- **PDFs:** react-pdf/renderer ONLY (html2canvas removed permanently)
- **PWA:** vite-plugin-pwa / Workbox
- **Hosting:** Vercel (main branch auto-deploys to production)
- **Testing:** Vitest, Testing Library, Playwright (a11y)

---

## 4. Theme System (Nexus Warm — never hardcode hex in components)

All colours resolve through CSS custom properties. Use Tailwind utility classes only.

**Light mode (`:root`):**
- `bg-surface` → `var(--color-bg)` warm beige `#f7f6f2`
- `bg-card` → `var(--color-surface)` white `#ffffff`
- `bg-card-raised` → `var(--color-surface-raised)` `#fafaf8`
- `text-ink` → `var(--color-text)` `#28251d`
- `text-ink-muted` → `var(--color-text-muted)` `#6b6560`
- `text-primary` / `bg-primary` → teal `#01696f`

**Dark mode (`.dark` class on `<html>`):**
- Warm near-black surfaces, lifted teal for legibility.
- Toggled via `localStorage['agencytrack-dark']`, restored before React mounts (no FOUC).

**Fonts:** Satoshi (body) + Cabinet Grotesk (display) — Fontshare CDN.

**Rules:**
- NO gradient buttons. NO inline styles. ALL styling via Tailwind + CSS variables.
- `AgentReportDocument.jsx` is the ONLY file allowed hardcoded hex (react-pdf cannot
  resolve CSS variables).
- Minimum 44px touch targets on all interactive elements (field agents use phones).

---

## 5. Role Hierarchy (lowest → highest)
agent → unitmanager → branchmanager → salesmanager → tenantadmin → platformadmin

text

- **agent** — own data only, mobile-first, 9-step weekly wizard.
- **unitmanager** — own unit + personal selling; "player-coach" UX.
- **branchmanager** — full branch; creates accounts across all units.
- **salesmanager** — cross-branch visibility; company-wide campaigns (P9, partially built).
- **tenantadmin** — all access within one tenant; system config.
- **platformadmin** — Kyron only; cross-tenant; no Firestore user doc.

Role stored in Firebase custom claims AND in Firestore `tenants/{id}/users/{uid}.role`.

---

## 6. UX Goals & Design Principles

These are the agreed UX direction for all refactors and new features.

### 6a. Global UX principles
1. **Progressive reveal:** Show 5–7 decision-driving data points first; let users expand
   for more. Never dump all detail at once.
2. **Exception-first hierarchy:** Action-required states (below floor, compliance issue,
   missing submission) get strong visual emphasis. Neutral data uses neutral surfaces.
3. **Consistent page anatomy:** Every major screen follows:
   page title + context switcher → KPI summary strip → action bar → filters/search →
   main content → optional right-side drawer for drill-in.
4. **Task-oriented home screens:** Each role's dashboard leads with "what needs doing
   today" before analytics.
5. **Reduce modal fatigue:** Modals for focused create/edit. Side drawers for record
   inspection. Full pages for complex multi-step flows.
6. **No CRM features:** AgencyTrack is NOT a CRM. Client/prospect data fields are kept
   minimal and scoped to specific tools (ProspectInfoPanel, PolicyLedger). Do not build
   lead/opportunity pipelines or contact management workflows.

### 6b. Role-specific UX
- **Agent (mobile-first):** FAB for "Submit Report". Grid-cols-2 compressed KPI cards
  above the fold. Wizard touch targets ≥ 44px. No circular gauges on mobile.
- **Unit Manager:** Prominent segmented toggle "View Personal / View Unit". 2px coloured
  top border on shell when viewing aggregated team data.
- **Branch/Sales Manager:** Compact scorecards (big number + label + trend) not circular
  gauges. "View As" dropdown to simulate another branch manager's view. Kiosk mode for
  TV leaderboards (no chrome, text-6xl, auto-scroll).
- **Tenant Admin:** Vertical tab layout for CompanyConfig (not one giant scroll page).
  Explicit "Save Changes" button — auto-save forbidden on config screens.

### 6c. Looking Ahead (income planning flow)
The app guides agents through an annual income planning journey that mirrors a physical
worksheet:
1. Money Needs (personal budget → commission gap)
2. Year Plan by line of business (Life / A&H / Property / Motor targets)
3. Monthly Plan (actuals vs targets)
4. Self-improvement / Goals
5. Business expense tracking (category-level, not per-receipt)

This is an agent-centric planning tool, not a reporting tool. Keep it feeling like a
guided conversation, not a spreadsheet.

### 6d. MasterSheet rules
- Sticky first column (agent name) during horizontal scroll.
- Zebra striping `even:bg-neutral-800/30 hover:bg-neutral-800/80`.
- Currency/percentage columns right-aligned (decimal alignment).
- Exception highlighting via coloured pills/badges, never plain text.
- Virtualise rows (TanStack Virtual or react-window) when agent count > 50.

---

## 7. Architecture Rules (never break without dispatcher approval)

- `extractFields.js` is the ONLY way to read submission fields. Never access raw
  Firestore fields directly.
- Wizard `Step1–Step9` files are NEVER modified. WizardForm.jsx groups them into 5
  screens. To revert to 9 steps: one `git revert` on WizardForm.jsx only.
- Currency is always TTD. Use `formatCurrency` from `formatters.js`.
- API (Annual Premium Income) is the primary production metric. Always numeric.
- All numeric fields: `parseFloat` enforced before saving to Firestore.
- Week Starting date must always be a Sunday. Use `validateSundayDate` from
  `validators.js`.
- No self-registration. Managers create all accounts.
- Never store numeric values as strings in Firestore.
- `react-hook-form` for all forms (not raw `useState` per-field).
- React Query (`@tanstack/react-query`) for component-level data fetching (not
  God-Dashboard prop-drilling).
- Skeleton loaders (`animate-pulse bg-neutral-800 rounded`) — never generic spinners.

---

## 8. Git / Deployment Workflow

- **Never push directly to `main`.** Production auto-deploys from main on every merge.
- One worktree branch = one PR. Never extend an open PR with unrelated work.
- Always `git fetch origin && git pull origin main` before branching.
- Smoke-test the Vercel preview URL in incognito before merging.
- After merge: 60-second smoke test on production.
- Firestore rules / indexes: additive changes may deploy pre-merge. Modifications
  deploy post-merge only.

---

## 9. Methodology Rules (apply on every implementation task)

1. Surface architectural decisions before executing — do not solve unilaterally.
2. Phase 1 audits enumerate ALL data paths, not just the ones mentioned in the brief.
3. Phase 3 verification must include a real invocation (not just import resolution).
4. Data quality checks verify both structural integrity AND assignment completeness.
5. New Firestore collections require: rules block + write surface + read surface +
   composite indexes + smoke verification — all in the same PR.
6. Active follow-ups table: remove rows when CLOSED. Audit trail lives in git log.
7. Brief drafts from FOLLOWUPS.md must verify codebase state first (grep/git log).
8. Acceptance-criteria waiver: requires explicit waiver note in PR body + deferred FU
   banked in FOLLOWUPS.md in the same merge cycle.
9. Dispatcher Phase-5 scope-extension: surface as "out-of-scope per brief", wait for
   authorisation before applying.
10. Kickoff briefs commit to `docs/briefs/` via a small standalone docs PR BEFORE
    Claude Code is dispatched against it.

---

## 10. What to Do With This Block

When you receive a task brief:
1. Read this block in full first.
2. Confirm you understand the role hierarchy, theme system, and no-CRM guardrail.
3. Ask one clarifying question if any requirement is ambiguous — then proceed.
4. Follow the UX principles in §6 for any UI work.
5. Follow the architecture rules in §7 for any data/service work.
6. Follow the git workflow in §8 before opening any PR.
7. Surface (do not solve) any decision not listed in the brief's "Decisions locked"
   section.

---