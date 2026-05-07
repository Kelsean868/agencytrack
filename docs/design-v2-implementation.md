# AgencyTrack — Design System v2 Implementation Plan

> **What this is:** Phased PR-by-PR technical plan for shipping the [Design System v2 PRD](./design-v2-PRD.md). Read the PRD first.
>
> **Visual source of truth:** [`mocks/concept-4-complete.html`](../mocks/concept-4-complete.html). When a question arises that this doc doesn't answer, the mock wins.
>
> **Estimated total effort:** 3–4 weeks of focused work, sequenced as 5 small PRs.

---

## Sequencing principle

Five PRs (B1 through B5), each independently mergeable, independently revertible, independently testable. Order matters because **B4 (sidebar shell) is the largest structural change** — earlier PRs validate the visual direction first so we don't restructure `App.jsx` twice if the design needs adjustment.

| PR  | Scope                              | Effort     | Risk    | Blocker for |
|-----|------------------------------------|------------|---------|-------------|
| B1  | Medal badge system                 | 0.5–1 day  | Low     | None        |
| B2  | Goal carousel + donut hero         | 1–2 days   | Low     | None        |
| B3  | Activity feed component            | 2–3 days   | Low     | None        |
| B4  | Desktop sidebar shell              | 3–5 days   | Medium  | Per-role manager dashboards (P9 partial) |
| B5  | Tenant Admin Config surface        | 1–2 days   | Low     | None        |

**Why this order:**
1. B1 is lowest risk and validates the gradient token approach in real Tailwind/Vite builds.
2. B2 builds on B1's token work and replaces a small isolated section (hero only).
3. B3 is purely additive — drops in below the hero with no layout reshuffle.
4. B4 is structural and benefits from having B1–B3 already merged so the visual direction is locked.
5. B5 is the easiest place to introduce role-branched dashboards; piggybacks on existing tenant_admin role.

---

## PR B1 — Medal Badge System

### Goal
Replace flat solid-color badge tiles in `BadgeGrid.jsx` with the glossy medallion design. Pure visual upgrade — same component API, same input data, same call sites.

### Files

**Modify:**
- `src/components/gamification/BadgeGrid.jsx` — replace tile JSX with medallion markup; extend `BADGES` dict with `gradient` and `tier` props
- `src/index.css` — add medal gradient tokens (light + dark) and medal CSS classes

**Verified not modified (B1 retrospective, PR #44):**
- `src/components/awards/AgentAwardsPanel.jsx` — consumes `awardsEngine.js` (production-based awards), does **not** render badges or import `BadgeGrid`. No edit required.
- `src/components/awards/ManagerAwardsPanel.jsx` — same.
- `src/utils/awardsEngine.js` — does not read `gradient` or `tier`. No edit required.
- Only call site for `<BadgeGrid />` is `src/components/profile/CareerPortal.jsx:468`. Component prop signature unchanged → consumer untouched.

**Create:** *(none)*

### Step 1 — Add tokens to `src/index.css`

Add these to **both** `:root` and `.dark` blocks. Light mode values shown; dark mode uses slightly desaturated/lifted variants so contrast stays ≥ 4.5:1 against `--color-surface`.

```css
/* :root — light mode */
--medal-1-light: #fde68a; --medal-1-mid: #f59e0b; --medal-1-deep: #b45309; --medal-1-glow: rgba(245,158,11,.45);
--medal-2-light: #fed7aa; --medal-2-mid: #fb923c; --medal-2-deep: #be123c; --medal-2-glow: rgba(251,113,133,.42);
--medal-3-light: #99f6e4; --medal-3-mid: #14b8a6; --medal-3-deep: #0e7490; --medal-3-glow: rgba(20,184,166,.42);
--medal-4-light: #fef9c3; --medal-4-mid: #fbbf24; --medal-4-deep: #92400e; --medal-4-glow: rgba(251,191,36,.55);
--medal-5-light: #ddd6fe; --medal-5-mid: #a78bfa; --medal-5-deep: #5b21b6; --medal-5-glow: rgba(167,139,250,.45);
--medal-6-light: #f1f5f9; --medal-6-mid: #94a3b8; --medal-6-deep: #475569; --medal-6-glow: rgba(148,163,184,.30);
--medal-7-light: #a7f3d0; --medal-7-mid: #10b981; --medal-7-deep: #047857; --medal-7-glow: rgba(16,185,129,.42);
--medal-8-light: #f5d0fe; --medal-8-mid: #c084fc; --medal-8-deep: #581c87; --medal-8-glow: rgba(192,132,252,.5);

/* .dark — desaturated variants to maintain contrast on dark surface */
--medal-1-light: #facc15; --medal-1-mid: #d97706; --medal-1-deep: #92400e; --medal-1-glow: rgba(217,119,6,.45);
/* ...etc for medal-2 through medal-8, see mock for exact values */
```

### Step 2 — Lift CSS classes from the mock

Open `mocks/concept-4-complete.html`. Find the section commented `/* ── Achievement badges (Medal v2 — glossy coin) ─────────────── */`. Lift these blocks **verbatim** into `src/index.css`:

- `.badge-grid`, `.badge-item`, `.badge-item.earned:hover`, `.badge-item.locked .badge-name`, `.badge-item.locked .badge-sub`
- `.badge-medal`, `.badge-medal::before`, `.badge-medal svg.medal-ico`, `.badge-item.earned:hover .badge-medal`
- `.medal-1` through `.medal-8` (use the new CSS variables instead of inline colors)
- `.medal-1.glow` through `.medal-8.glow` (use `--medal-N-glow` variable)
- `.medal-locked` (light + dark)
- `.lock-pin`, `.lock-pin svg`
- `.tier-pips`, `.tier-pip`, `.tier-pip.dim`, `.dark .tier-pip.dim`

**Refactor the gradients to use the new variables:**

```css
.medal-1 { background: radial-gradient(circle at 32% 28%, var(--medal-1-light) 0%, var(--medal-1-mid) 50%, var(--medal-1-deep) 100%); }
.medal-1.glow { box-shadow: inset 0 -2px 4px rgba(0,0,0,.18), inset 0 2px 4px rgba(255,255,255,.4), 0 4px 16px var(--medal-1-glow); }
```

The mock has these inlined for portability; the app should reference variables for theme correctness.

### Step 3 — Extend the `BADGES` dict

In `src/components/gamification/BadgeGrid.jsx`, the `BADGES` const exports a dict of ~14 badge definitions. Each needs two new props: `gradient` and `tier`.

**Mapping table (use this exactly):**

| Badge key | `gradient` | `tier` | Reason |
|---|---|---|---|
| `first_submission` | `medal-3` | 1 | Common · activity onboarding |
| `streak_4` | `medal-3` | 1 | Common · consistency starter |
| `streak_8` | `medal-3` | 2 | Uncommon · consistency mid |
| `streak_13` | `medal-2` | 3 | Rare · consistency strong |
| `mdrt_pace` | `medal-1` | 3 | Rare · sales mastery on-pace |
| `mdrt_qualified` | `medal-4` | 5 | Legendary · industry credential |
| `top_apps_week` | `medal-3` | 2 | Uncommon · weekly volume |
| `big_week` | `medal-2` | 3 | Rare · standout week |
| `century_dials` | `medal-5` | 2 | Uncommon · activity volume |
| `dial_king` | `medal-6` | 3 | Rare · top-of-unit recognition |
| `sharpshooter` | `medal-1` | 4 | Epic · closing ratio mastery |
| `mdrt_bound` | `medal-5` | 4 | Epic · milestone progress |
| `untouchable` | `medal-7` | 5 | Legendary · 52-week streak |
| `consistent` | `medal-8` | 5 | Legendary · 12-month persistency |

**Updated dict entry example:**
```js
mdrt_qualified: {
  label: 'MDRT Qualified',
  Icon: Trophy,
  desc: 'Achieved MDRT threshold ($500k API)',
  gradient: 'medal-4',
  tier: 5,
},
```

### Step 4 — Replace the tile JSX

The current rendering loop (find it via `BADGE_KEY_ORDER.map`) produces flat tiles. Replace with the medallion structure:

```jsx
import { Lock } from 'lucide-react';

{BADGE_KEY_ORDER.map((key) => {
  const badge = BADGES[key];
  const earned = earnedBadges.has(key);
  const Icon = badge.Icon;
  return (
    <div key={key} className={`badge-item ${earned ? 'earned' : 'locked'}`}>
      <div className={`badge-medal ${earned ? `${badge.gradient} glow` : 'medal-locked'}`}>
        <Icon className="medal-ico" size={26} strokeWidth={2} />
        {!earned && (
          <span className="lock-pin"><Lock size={10} strokeWidth={2.4} /></span>
        )}
      </div>
      <div className="tier-pips">
        {[1,2,3,4,5].map((n) => (
          <span
            key={n}
            className={`tier-pip ${(n > badge.tier || !earned) ? 'dim' : ''}`}
          />
        ))}
      </div>
      <div className="badge-name">{badge.label}</div>
      <div className="badge-sub">{badge.desc}</div>
    </div>
  );
})}
```

Note: `medal-ico` className is required so the CSS sizing rules (`width: calc(var(--medal-size) * .50)`) apply. Lucide accepts `className` for sizing override but will still respect the inline `size` prop as default.

### Step 5 — Verify call sites

Search for any usage of the old badge classes (`ba-gold`, `ba-primary`, `ba-success`, `badge-icon-wrap`):

```bash
grep -rn "ba-gold\|ba-primary\|ba-success\|badge-icon-wrap" src/
```

Update each call site to the new structure or confirm the call site uses `<BadgeGrid />` directly (in which case no change needed).

### Acceptance criteria
- [ ] All 14 entries in `BADGES` have `gradient` and `tier` populated
- [ ] Visual diff matches mock at 1440px (achievements card on **CareerPortal** — the only `<BadgeGrid />` consumer in v1)
- [ ] Visual diff matches mock at 390px (mobile achievements grid on CareerPortal)
- [ ] Dark mode tested — gradients hold contrast, tier pips visible
- [ ] Hover lift + tilt works on earned medals (motion-guarded via `prefers-reduced-motion: no-preference`)
- [ ] Locked medals show lock pin + grayscale gradient
- [ ] `npm run lint && npm run build` exits 0
- [ ] BadgeGrid component prop signature unchanged (`submissions`, etc.)

> **B1 follow-up (deferred to B3 or a B1.5 PR):** Surface `<BadgeGrid />` on `AgentDashboard.jsx` for full mock parity at 1440px. Mock shows badges on the agent dashboard surface (`mocks/concept-4-complete.html:1141`); current code only renders them in CareerPortal. Naturally fits alongside the activity feed in B3.

### Rollback
Single-file revert on `BadgeGrid.jsx` + targeted block revert in `src/index.css`. No data changes, no schema changes, no Cloud Function changes.

---

## PR B2 — Goal Carousel + Donut Hero

### Goal
Replace the current AgentDashboard hero KPI section with a 4-tab carousel showing Week / Month / Quarter / YTD goal progress, each with a glossy donut visualization.

### Files

**Create:**
- `src/components/dashboard/GoalCarousel.jsx`
- `src/components/dashboard/GoalDonut.jsx` *(optional — extract for reuse)*
- `src/utils/aggregateAPI.js`

**Modify:**
- `src/components/dashboard/AgentDashboard.jsx` — replace hero KPI section with `<GoalCarousel data={...} />`
- `src/index.css` — add carousel + donut styles

### Step 1 — Build `aggregateAPI.js`

Pure function. No Firestore reads. Takes the already-loaded submissions array and computes period totals.

```js
// src/utils/aggregateAPI.js
import { extractFields } from './extractFields';

const WEEKLY_TARGET_DEFAULT = 4807; // $250k / 52 weeks (placeholder until personal target lookup)

export function aggregateAPI(submissions, currentDate = new Date(), personalCommitment = 250000) {
  const week = sumPeriod(submissions, currentDate, 'week');
  const month = sumPeriod(submissions, currentDate, 'month');
  const quarter = sumPeriod(submissions, currentDate, 'quarter');
  const ytd = sumPeriod(submissions, currentDate, 'ytd');

  return {
    week:    { current: week,    target: personalCommitment / 52,  /* ... */ },
    month:   { current: month,   target: personalCommitment / 12,  /* ... */ },
    quarter: { current: quarter, target: personalCommitment / 4,   /* ... */ },
    ytd:     { current: ytd,     target: personalCommitment,       /* ... */ },
  };
}

function sumPeriod(submissions, date, period) {
  return submissions
    .filter((s) => isInPeriod(s.weekStarting, date, period))
    .reduce((sum, s) => sum + (extractFields(s).api || 0), 0);
}
```

Each return value should include: `current`, `target`, `percent`, `period` (display label), `status` (string like "On pace · 17 days remaining").

### Step 2 — Build `GoalCarousel.jsx`

Component skeleton:

```jsx
import { useState, useEffect, useRef } from 'react';
import { GoalDonut } from './GoalDonut';
import { ChevronUp, Check, Star } from 'lucide-react';

const TABS = ['Week', 'Month', 'Quarter', 'YTD'];
const AUTO_ROTATE_MS = 6000;

export function GoalCarousel({ data, autoRotate = true }) {
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      if (!pausedRef.current) {
        setActive((prev) => (prev + 1) % TABS.length);
      }
    }, AUTO_ROTATE_MS);
    return () => clearInterval(interval);
  }, [autoRotate]);

  const slides = ['week', 'month', 'quarter', 'ytd'];
  const activeData = data[slides[active]];

  return (
    <div
      className="goal-carousel role-hero"
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
    >
      <div className="goal-tabs" role="tablist">
        {TABS.map((label, i) => (
          <button
            key={label}
            className={`goal-tab ${active === i ? 'active' : ''}`}
            onClick={() => { setActive(i); pausedRef.current = true; }}
            role="tab"
            aria-selected={active === i}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="goal-slide-wrap">
        <div className="goal-slide-track" data-active={active}>
          {slides.map((key) => (
            <GoalSlide key={key} data={data[key]} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Step 3 — Donut SVG

Circumference for r=42: `2 * Math.PI * 42 = 263.89`. Offset = `circumference * (1 - percent/100)`.

```jsx
export function GoalDonut({ percent }) {
  const C = 263.89;
  const offset = C * (1 - Math.min(percent, 100) / 100);
  return (
    <svg className="hero-donut" viewBox="0 0 100 100">
      <circle className="donut-bg" cx="50" cy="50" r="42" />
      <circle
        className="donut-fg"
        cx="50" cy="50" r="42"
        strokeDasharray={C}
        strokeDashoffset={offset}
      />
      <text x="50" y="52" textAnchor="middle" fontSize="22" dominantBaseline="middle">
        {Math.round(percent)}%
      </text>
    </svg>
  );
}
```

### Step 4 — Lift carousel CSS from the mock

From `mocks/concept-4-complete.html`, lift the `/* ── Goal carousel (hero card) ──── */` block into `src/index.css`. No refactoring needed — these styles are self-contained.

### Step 5 — Wire into `AgentDashboard.jsx`

Find the current hero / KPICard section. Replace with:

```jsx
import { GoalCarousel } from './GoalCarousel';
import { aggregateAPI } from '../../utils/aggregateAPI';

// Inside component:
const goalData = useMemo(
  () => aggregateAPI(submissions, new Date(), user?.personalCommitment),
  [submissions, user?.personalCommitment]
);

// In render:
<GoalCarousel data={goalData} />
```

### Empty state
If `submissions.length === 0`, render:
```jsx
<div className="role-hero">
  <h2>Welcome to AgencyTrack</h2>
  <p>Submit your first weekly report to start tracking your goal progress.</p>
  <button className="btn btn-primary">Submit your first report</button>
</div>
```

### Acceptance criteria
- [ ] All 4 tabs render with correct data from `aggregateAPI`
- [ ] Click any tab to pin (stops auto-rotate for that interaction)
- [ ] Auto-rotate resumes 6s after `mouseleave`
- [ ] Donut animates smoothly between tabs (CSS transition on `stroke-dashoffset`)
- [ ] Empty state for new agents (zero submissions)
- [ ] Dark mode tested
- [ ] Donut handles edge cases: 0%, 100%, >100%
- [ ] `npm run lint && npm run build` exits 0

### Rollback
Revert `AgentDashboard.jsx` hero section + delete the new files. CSS additions can stay (unused styles are harmless).

---

## PR B3 — Activity Feed Component

### Goal
New component showing the agent's last 7 days of events, derived from existing data sources. No new collections.

### Files

**Create:**
- `src/components/dashboard/ActivityFeed.jsx`
- `src/utils/buildActivityEvents.js`

**Modify:**
- `src/components/dashboard/AgentDashboard.jsx` — insert `<ActivityFeed events={...} />` below hero
- `src/index.css` — lift activity-feed styles from mock

### Event derivation

`buildActivityEvents(submissions, earnedBadgeKeys, settlements)` produces an array of typed events sorted by timestamp descending, capped at 25 items in the last 7 days.

**Event types:**
```js
[
  {
    type: 'submission',
    title: 'Weekly report submitted',
    sub: '$187,500 in API · 14 FFI · 9 CI · 6 applications',
    timestamp: <Firestore timestamp>,
    icon: 'check', // resolves to Lucide Check
    color: 'success',
    pill: { label: 'Submitted', variant: 'success' },
  },
  {
    type: 'badge',
    title: 'New badge earned: <name>',
    sub: '<badge.desc>',
    timestamp,
    badge: { key, gradient, tier, Icon }, // renders as mini-medal
    pill: { label: `Achievement · ${rarityName(tier)}`, variant: 'gold' },
  },
  {
    type: 'rank',
    title: 'Moved up to #X in branch',
    sub: 'Passed <name> by $X in API',
    timestamp,
    icon: 'trending-up',
    color: 'primary',
    pill: { label: 'Ranking', variant: 'primary' },
  },
  {
    type: 'application',
    title: 'Application sold — <client>',
    sub: '$X API · <product>',
    timestamp,
    icon: 'file-text',
    color: 'ink',
    pill: { label: 'Application', variant: 'ink' },
  },
]
```

### Component pattern

Reuse the `.activity-list`, `.activity-item`, `.activity-icon`, `.ai-success/gold/primary/ink` classes from the mock.

For badge events, render the actual mini-medal:
```jsx
{event.type === 'badge' ? (
  <div className="activity-icon" style={{ background: 'transparent', padding: 0, overflow: 'visible' }}>
    <div className={`badge-medal ${event.badge.gradient} glow`} style={{ '--medal-size': '36px', margin: 0 }}>
      <event.badge.Icon className="medal-ico" size={16} strokeWidth={2.2} />
    </div>
  </div>
) : (
  <div className={`activity-icon ai-${event.color}`}>
    <DynamicIcon name={event.icon} size={16} />
  </div>
)}
```

### Memoization
Use `useMemo` on `buildActivityEvents` keyed on `submissions.length` and `earnedBadgeKeys.size` — don't recompute on every render.

### Acceptance criteria
- [ ] Renders last 7 days of events for current agent
- [ ] Events sorted by timestamp descending
- [ ] Capped at 25 items (paginated or "View all" link to history)
- [ ] Badge events render the mini-medal with correct gradient
- [ ] Empty state: "No activity in the last 7 days — submit a report to get started"
- [ ] Dark mode tested
- [ ] No N+1 reads — derives entirely from already-loaded data
- [ ] `npm run lint && npm run build` exits 0

### Rollback
Delete the new files + revert the `AgentDashboard.jsx` insertion line. No other surface affected.

---

## PR B4 — Desktop Sidebar Shell

### Goal
Add a sidebar navigation shell at desktop breakpoint (≥1024px). Wrap existing dashboards. Mobile keeps bottom nav. Move topbar elements (search, notifications bell, theme toggle) out of individual dashboards into the shell.

### Files

**Create:**
- `src/components/shell/Shell.jsx` — sidebar + topbar wrapper
- `src/components/shell/Sidebar.jsx` — left nav with role-specific items
- `src/components/shell/TopBar.jsx` — breadcrumb + search + actions + theme toggle
- `src/components/shell/MobileBottomNav.jsx` — extracted from existing dashboard mobile nav

**Modify:**
- `src/App.jsx` — wrap `<AgentDashboard />` and `<ManagerDashboard />` in `<Shell role={...}>`
- `src/components/dashboard/AgentDashboard.jsx` — remove top-level nav chrome (now in Shell), keep content + scroll container
- `src/components/dashboard/ManagerDashboard.jsx` — same
- `src/index.css` — lift shell, sidebar, topbar styles from mock

### Sidebar items per role

Mirror the mock exactly. Each item is `{ label, icon, route, badge?, section? }`.

**Agent** (Workspace section): Home · Submit Report · History · Leaderboard · Profile · Commission Calc · Goals
**Unit Mgr** (Manage section): Dashboard · My Team `[8]` · Reports · Goals · Meeting Mode · Compliance `[3]` (Tools section): Notifications · Settings
**Branch Mgr** (Branch section): Dashboard · Units `[4]` · All Agents · Goals (Operations section): Settlements · Persistency · Campaigns `[2]` · Users (Tools section): Settings
**Sales Mgr** (Region section): Overview · Branches `[3]` · Cross-Branch Reports · Region Leaderboard (Programs section): Company Campaigns · Goals · Settings *(stub for P9)*
**Tenant Admin** (Company section): Dashboard · Branches · All Users · Roles & Permissions (Configuration section): Company Config · Campaigns · Audit Log *(deferred-data stub)* · Billing (System section): Settings

### Responsive behavior

```css
@media (min-width: 1024px) { .desktop-content { grid-template-columns: 240px 1fr; } }
@media (max-width: 1023px) and (min-width: 768px) { .desktop-content { grid-template-columns: 72px 1fr; } /* collapsed icon-only */ }
@media (max-width: 767px) { .desktop-content { grid-template-columns: 1fr; } .sidebar { display: none; } .mobile-bottom-nav { display: flex; } }
```

### Routing

The app currently uses simple role branching in `App.jsx` (no React Router). For B4, **do not introduce React Router yet** — keep the role branching pattern. The sidebar items can navigate via `setActiveSection` state on the dashboard for now. If routing becomes painful in B5+, that's a separate ticket.

### Theme toggle relocation

Currently lives in dashboard header. Move to TopBar component (right side, before notifications bell). The existing `localStorage.agencytrack-dark` key + `dark` class on `documentElement` stays unchanged.

### Acceptance criteria
- [ ] Layout matches mock at 1440px, 1024px, 768px, 390px
- [ ] Active nav item highlighted per current section
- [ ] Search field functional (or no-op with placeholder for MVP — Q7 in PRD)
- [ ] Theme toggle works in topbar
- [ ] Notification bell shows unread badge count (use existing notification context)
- [ ] All current dashboards still work; nothing broken
- [ ] All 5 role logins tested on Vercel preview before merge
- [ ] Dark mode tested at all 4 breakpoints
- [ ] `npm run lint && npm run build` exits 0

### Risk mitigation

This PR touches `App.jsx` and every dashboard. Mandatory checks:
1. Test all 5 role logins on Vercel preview before requesting merge
2. Run `scripts/exploration-walk.cjs --url=<preview> --label=design-v2-b4` if the script supports auth
3. 60-second smoke test on production after merge (per CLAUDE.md)

### Rollback
Revert `App.jsx` to direct dashboard rendering. Delete the four new shell files. Restore the previous header markup in `AgentDashboard.jsx` and `ManagerDashboard.jsx`.

---

## PR B5 — Tenant Admin Config Surface

### Goal
Surface `config/companyMinimums` for read/edit. Lays groundwork for future Tenant Admin features. Establishes the role-branched dashboard pattern.

### Files

**Create:**
- `src/components/admin/CompanyConfigPanel.jsx`
- `src/components/admin/EditConfigModal.jsx`
- `src/components/admin/RoleDistributionCard.jsx`
- `src/components/admin/BranchHealthCards.jsx`

**Modify:**
- `src/components/dashboard/ManagerDashboard.jsx` — branch on `role === 'tenant_admin'` to show admin dashboard layout
- *Or* `src/App.jsx` — if branching gets messy, route tenant_admin to a new `<TenantAdminDashboard />` component (new file)

### Config tiles

6 tiles per mock at the same visual rhythm:
1. **Company minimum API per agent** — editable. Reads/writes `config/companyMinimums.minAPI` (already exists per CLAUDE.md "companyMinimums" reference).
2. **Currency** — display only. TTD.
3. **Fiscal year** — display only. Jan–Dec.
4. **Persistency floor** — editable. Reads/writes `config/companyMinimums.persistencyFloor` (verify field name in actual schema).
5. **Week start day** — display only. Sunday.
6. **Self-registration** — toggle. Currently always disabled.

### Edit modal

Each editable tile opens an `<EditConfigModal>` with:
- Field label
- Current value
- New value input (number for currency, percent slider for persistency)
- "Cancel" and "Save Changes" buttons
- Confirmation copy: "This change applies to all agents in your company. Are you sure?"
- Save button disables on click, shows spinner, success toast on completion

### Users by role

Read from `tenants/{tid}/users` collection. Group by `role`. Render distribution bars matching the mock.

### Branch health overview

Read from `tenants/{tid}/meta/branches` (per CONTEXT.md). For each branch, derive:
- Agent count (group by `branchId` in users)
- % to YTD goal (aggregate API across branch agents / branch target)
- Last sync time (max `updatedAt` across submissions)

### Acceptance criteria
- [ ] Tenant admin sees config panel; other roles do not
- [ ] Edits write to `config/companyMinimums` document
- [ ] Confirmation modal before saving
- [ ] Save action disables button + shows spinner
- [ ] Users-by-role bars match counts from Firestore
- [ ] Branch health cards reflect real data
- [ ] Dark mode tested
- [ ] `npm run lint && npm run build` exits 0

### Rollback
Revert `ManagerDashboard.jsx` branch + delete the new admin files.

---

## Cross-PR concerns

### Empty states (mandatory for every data-bound surface)

Every PR must include empty-state copy for:
- No data yet (new user, no submissions, no settlements, etc.)
- Loading (spinner or skeleton, not blank)
- Error (with retry CTA)

### Performance

- Memoize aggregations with `useMemo` — never recompute on every render
- For activity feed, cap at 25 items rendered; use virtualization if dataset exceeds 100
- For role-distribution counts, query once per session, not per render
- Goal carousel donut animation uses CSS `transition: stroke-dashoffset` only — never inline JS animation

### Accessibility checklist (per PR)

- All buttons have visible labels or `aria-label` for icon-only
- All interactive elements have visible focus rings (project policy)
- Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text/icons
- Tab order matches visual order
- Modal escape (B5) — Esc key closes modal, focus restored
- `prefers-reduced-motion` respected: carousel auto-rotate disables, hover lifts disabled

### Dark mode parity

Every PR must visually verify both modes. Common pitfalls:
- Gradients that don't desaturate enough on dark surface (low contrast)
- Hover states that look fine in light but invisible in dark
- Tier pip dim color blending into background

---

## Definition of done (project-level)

A "v2 complete" milestone requires:

- [ ] All 5 PRs (B1 through B5) merged to main
- [ ] Mock parity verified at 1440px, 1024px, 768px, 390px in both light and dark mode
- [ ] All 5 role logins render their dashboard without errors
- [ ] Wizard flow works end-to-end (regression-free)
- [ ] Manager review flow works end-to-end (regression-free)
- [ ] Lint + build green on main
- [ ] Lighthouse a11y ≥ 95 on AgentDashboard
- [ ] Pre-pilot demo on production passes a 5-minute click-through
- [ ] CONTEXT.md updated to reflect "Design v2 shipped"

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Sidebar shell (B4) breaks role-based routing | M | H | Test all 5 role logins on preview before merge; mandatory walkthrough |
| Medal gradients don't degrade on Safari < 15 | L | L | Add `@supports (background: radial-gradient(...))` fallback to solid `--medal-N-mid` |
| Goal aggregation hits Firestore read limits | L | M | Aggregate client-side from already-loaded submissions; no new queries |
| Activity feed performance with many submissions | M | L | Cap at 25 items; virtualize if >100 (`react-window`) |
| Dark mode contrast issues with new gradients | M | M | Run a11y review on every PR; verify against `--color-bg` dark token |
| Tenant admin config edit corrupts data | L | H | Confirmation modal + immutable timestamp on each edit |
| `BADGES` dict change breaks awardsEngine | L | H | `awardsEngine.js` reads keys, not gradient/tier — verify with grep before merge |
| Existing PRs in flight collide with B-series | M | M | Check open PRs before each branch; pull main before branching (per CLAUDE.md) |

---

## Reference

- Product requirements: [`docs/design-v2-PRD.md`](./design-v2-PRD.md)
- Visual mock: [`mocks/concept-4-complete.html`](../mocks/concept-4-complete.html)
- Project rulebook: [`CLAUDE.md`](../CLAUDE.md)
- Project state: [`docs/CONTEXT.md`](./CONTEXT.md)
- Kickoff template: [`docs/kickoff-template.md`](./kickoff-template.md)
- Open follow-ups: [`docs/FOLLOW_UPS.md`](./FOLLOW_UPS.md)
