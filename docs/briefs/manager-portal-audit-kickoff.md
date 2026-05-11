# Manager portal UX/UI audit — kickoff brief

**Status:** Ready to execute. Design task — produces audit + recommendations + visual mocks.
**Estimated CC effort:** 2–3 sessions across multiple phases. Single deliverable PR at the end.
**Two-strike counter:** 0/2 (fresh session).
**Type:** Design phase, not implementation. No source code changes. No production smoke required.

---

## Context

The agent portal received significant UX/UI investment during Track B v2 (May 2026) — `mocks/concept-4-complete.html` was produced using the **ui/ux pro max** Claude Code skill, then implemented across B1–B5 PRs (Award medals, BadgeGrid, Saving Pie, KPI Pulse Pills, etc.). The result: a coherent, visually polished agent experience built on the Nexus warm theme.

**The manager portal did not receive the same treatment.** Manager screens evolved organically, role-by-role, without a unified design pass. Touch-target compliance and basic mobile coverage landed in PR #90 (Mobile FU#1), but the **visual language, information architecture, and interaction patterns** were not redesigned. The result: a manager portal that works but doesn't feel as cohesive or as enjoyable as the agent side.

**Goal:** apply the same design method that produced the agent portal redesign — the **ui/ux pro max** skill — to audit the manager portal and produce a detailed recommendation document for all manager-accessible screens across all roles. Implementation comes later as discrete PRs (the same B1–B5 pattern).

**Important distinction from prior briefs:** the "do not redesign — implement the mock faithfully" rule from Track B applied to *implementation phases*. This is the *design phase* — new design thinking is exactly what's expected here. The ui/ux pro max skill produces fresh recommendations, the way it did for the agent portal. The output is the basis for future implementation work, not implementation itself.

---

## Scope decisions (pre-approved)

These were agreed before kickoff — don't re-litigate:

1. **Roles in scope:** branch_manager is the primary canvas (most screens accessible to this role). Call out where **unit_manager**, **sales_manager**, **tenant_admin** views differ. **platform_admin** (Kyron-only, cross-tenant) deferred entirely.

2. **Viewports:** **desktop primary** (managers predominantly work on laptops/monitors). **Mobile secondary** — ensure the new design language carries through to 390px viewport per PR #90's foundation work.

3. **Timing:** **runs in parallel with pilot launch.** Pilot is not blocked on this audit; pilot feedback informs implementation priorities post-audit.

4. **Deliverable format:** three files, all committed in a single PR:
   - `mocks/manager-portal-concepts.html` — visual reference for key screens (the analog to `concept-4-complete.html`)
   - `docs/design/manager-portal-audit.md` — current-state inventory + gap analysis vs. agent portal design language
   - `docs/design/manager-portal-recommendations.md` — per-screen recommendations across roles (the primary actionable output)

---

## Phase 1 — Sync + worktree + skill loading

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -3`. HEAD should include PR #99 (final pre-pilot housekeeping) at top.
4. Confirm clean state: `git worktree list` shows only main; `git branch` shows only `main`.
5. Create worktree at `.claude/worktrees/design-manager-portal-audit` on branch `design/manager-portal-audit`.
6. `cd` into the worktree.
7. **Load the ui/ux pro max skill explicitly** — this is the same skill that produced the agent portal redesign (`mocks/concept-4-complete.html`). The skill should inform design judgment throughout this audit, not just at code-writing time. Use whatever invocation pattern the skill expects (typically `/uxui pro max` or reading the SKILL.md from the local skills directory).

If the skill cannot be loaded for any reason, STOP and surface — the audit's value depends on consistent design methodology with the prior agent portal work.

---

## Phase 2 — Discovery

This is a longer discovery phase than usual. Take time. The audit quality depends on understanding what exists before recommending changes.

### 2a — Current design language deep dive

Read in full (existing agent portal design context):

1. `mocks/concept-4-complete.html` — the canonical agent portal redesign reference. **This is the design language to extend, not replace.** The manager portal recommendations must visually cohere with this.
2. `src/index.css` — design tokens (Nexus warm theme), CSS variables, component class definitions.
3. `tailwind.config.js` — utility tokens (`bg-surface`, `bg-card`, `bg-card-raised`, etc.) and the project's `--color-*` token system.
4. `CLAUDE.md` design section — Nexus theme conventions, 44px touch targets, font stack (Satoshi + Cabinet Grotesk), light/dark mode rules.
5. `docs/design/` — read every file present. Capture any prior design documentation that informs the system.

Document in the audit:
- Current design language summary (colors, typography, spacing, component patterns)
- What "feels good" about the agent portal post-Track B v2 (concept-4-complete patterns: medal badges, saving pie, KPI pulse pills, goal carousel, donut hero, etc.)
- The specific design tokens and patterns the manager portal MUST adhere to (not optional — cohesion is the point)

### 2b — Manager portal current-state inventory

Identify every screen in the manager portal. Per memory and PR #90's audit, the catalog is approximately:

1. Overview / Manager Dashboard (landing)
2. Team (user management)
3. Campaigns
4. Production Report (now with unit name fix from PR #97)
5. Awards
6. Master Sheet
7. Compliance
8. Persistency (manager view — with the lock-by-manager mechanism)
9. Goals (with sub-tabs: My Production, My Unit)
10. Settlements
11. Leaderboard
12. Agent of Month
13. Kiosk
14. Profile

For each screen:
- **Take a fresh production screenshot** at desktop (1440x900) and mobile (390x844), light AND dark mode. Use the canonical bypass pattern + `walk-helpers.mjs` from PR #95. Sign in as branch_manager. Some screens require multiple states (e.g., empty state, populated state, modal open).
- **Identify the source file(s)** for the screen's primary component(s).
- **Map role visibility:** for each screen, which roles can access it? Note where the view differs by role.
- **Catalog the screen's primary interactions:** what does the user DO on this screen? (Read data? Enter data? Trigger workflows? Drill down?)

Save screenshots to `verification/manager-portal-audit/` (gitignored — not for the PR; for analysis only).

### 2c — Comparison against agent portal design language

For each manager screen, evaluate against the agent portal patterns:

- **Color usage:** does it use the Nexus token palette (teal accent, warm beige/dark, semantic tokens), or older hardcoded colors?
- **Typography:** Satoshi + Cabinet Grotesk hierarchy applied? Or default sans?
- **Information density:** comparable to agent screens, or notably busier/sparser?
- **Component patterns:** does it use the same card/section patterns as the agent portal? Or different patterns that feel disconnected?
- **Interaction patterns:** smooth (matched to agent portal) or jagged (different conventions)?
- **Empty states:** thoughtfully designed (like the agent portal) or generic?
- **Hover/focus states:** present and polished, or missing/inconsistent?
- **Mobile experience:** carries the design language faithfully, or feels like an afterthought?

This comparison is the core analytical output. Each screen gets a brief rating + notes.

---

## Phase 3 — Audit surface (STOP HERE for Kelsean's review)

Output a single structured summary in chat. This is the main approval gate before recommendations and mocks are produced.

Use this template:

```
DISCOVERY — Manager portal UX/UI audit

DESIGN LANGUAGE SUMMARY (existing):
- Colors: <tokens, palette description>
- Typography: <fonts, scale>
- Component patterns: <cards, headers, tabs, etc.>
- Interaction patterns: <hover, focus, transitions>
- Key "wins" in the agent portal: <list of patterns to extend>

MANAGER PORTAL CURRENT STATE — per screen:

OVERVIEW / MANAGER DASHBOARD
  - Source file: <path>
  - Roles: branch_manager (primary), unit_manager, sales_manager, tenant_admin
  - Primary interactions: <list>
  - Design language cohesion: <rating + notes>
  - Top gaps vs agent portal: <list>
  - Screenshot reference: verification/manager-portal-audit/overview-*.png

TEAM
  - [same template]

[... 12 more screens ...]

CROSS-CUTTING OBSERVATIONS:
- Patterns that work well across the manager portal: <list>
- Patterns that hurt cohesion: <list>
- Information architecture issues: <e.g., "data hierarchy unclear on Production Report">
- Notable role-specific differences worth highlighting: <list>

RECOMMENDATION DIRECTION (high-level — full per-screen recs follow approval):
- Approach: <e.g., "treat manager portal as 'agent portal for orchestrators' — same design language, denser information, action-oriented controls">
- Top 5 highest-impact changes (if you had to pick 5): <ranked list>
- Estimated implementation scope (rough — for planning): <e.g., "12-15 PRs across 2-3 months for full revamp; or 3-4 PRs for hottest screens">

OPEN QUESTIONS FOR KELSEAN:
- <list of design judgment calls that need a real-human decision>
- <e.g., "Does the manager portal need its own landing hero, like the agent portal has, or is the current dashboard layout right?">
- <e.g., "Should the role-specific views share screens with conditional sections, or have distinct routes?">
```

**STOP here.** Wait for Kelsean's response. Kelsean will:
- Confirm or adjust the recommendation direction
- Answer the open questions
- Re-prioritize if needed (which screens are highest priority)
- Greenlight Phase 4

---

## Phase 4 — Produce deliverables (only after Phase 3 approval)

After Phase 3 approval, produce all three deliverables. CC may run end-to-end through Phases 4 + 5 without intermediate stops — the design direction is now locked by Phase 3.

### 4a — `docs/design/manager-portal-audit.md`

Formal version of the Phase 3 output. Same per-screen structure but polished as a reference document, not a session report. Include:
- Executive summary (1 page) — what the audit found, top observations
- Per-screen audit (the detailed catalog from Phase 3)
- Cross-cutting observations section
- Information architecture analysis
- Mobile-secondary audit notes (with reference to Mobile FU#1's foundation)

### 4b — `docs/design/manager-portal-recommendations.md`

The primary actionable output. Per-screen recommendations across roles. Structure:

- **Per screen section:**
  - Recommended approach (what the new design does differently)
  - Specific changes (information density, component swaps, interaction improvements)
  - Role-specific variations (where branch_manager / unit_manager / sales_manager / tenant_admin differ)
  - Implementation considerations (which existing components can be reused, which need new variants)
  - Priority bucket (P0 highest impact, P1 important, P2 polish)
  - Effort estimate (rough — small/medium/large)

- **Cross-cutting recommendations:**
  - Shared component additions (e.g., new card types, new navigation patterns)
  - Token additions (if any new design tokens are needed beyond what exists)
  - Information architecture changes (sidebar reorg, breadcrumbs, etc.)

- **Suggested implementation sequence:**
  - Order of operations for future PRs (which screens to tackle first based on dependencies + impact)
  - Estimated total scope (in PR-count terms)

### 4c — `mocks/manager-portal-concepts.html`

Visual reference, same role as `mocks/concept-4-complete.html` plays for the agent portal. Self-contained HTML file showing:
- 3–5 key manager screens in their proposed redesign (highest-impact ones per the recommendations)
- Both light and dark modes (toggle or side-by-side)
- Both desktop and mobile renderings (toggle or stacked)
- Uses the actual Nexus design tokens (not approximations)
- No external dependencies beyond what concept-4-complete.html uses

Focus the mock on the screens that demonstrate the new design language most clearly — probably:
- Manager Dashboard / Overview (sets the visual tone)
- One data-heavy screen (Production Report or Master Sheet)
- One interactive screen (Goals or Persistency)
- One role-specific variation (e.g., how the sales_manager view differs from branch_manager)

The mock doesn't need to cover every screen — recommendations.md does that. The mock proves the design works visually for the most representative cases.

---

## Phase 5 — Verify, commit, push, PR

1. Verify all three deliverables are present and consistent with each other (audit findings → recommendations match; recommendations → mocks show the proposed patterns).
2. `npm run lint` → 0 errors (HTML file at `mocks/` should be unaffected by ESLint; docs are markdown).
3. Markdown sanity check — tables, lists, code blocks render cleanly. HTML mock renders in a browser without errors.
4. Commit (one commit per deliverable, OR a single commit if logically inseparable):
   - `docs(design): manager portal UX/UI audit`
   - `docs(design): manager portal redesign recommendations`
   - `mocks(design): manager portal visual reference (manager-portal-concepts.html)`
5. Push, open PR titled: `docs(design): manager portal UX/UI audit + recommendations + mocks`
6. PR description MUST include:
   - High-level audit summary (1 paragraph)
   - Top 5 recommendations (with priority + effort markers)
   - Reference to the implementation sequence
   - Reference to the mock HTML file with a brief note on how to view it
   - Implementation roadmap timeline estimate
7. **STOP.** Do not merge. Kelsean reviews all three deliverables before merge.

---

## Hard stops

- ui/ux pro max skill cannot be loaded → STOP and surface
- Phase 2 reveals a design-language artifact (e.g., concept-4-complete.html) is missing or has been heavily modified → STOP and surface
- Phase 3 audit suggests fundamental architectural changes are needed (e.g., role system needs to be redesigned, not just UX) → STOP and surface; that's outside this audit's scope
- Scope balloons to >20 screens or requires implementation choices → STOP and re-scope
- Two strikes hit → STOP

---

## Out of scope

- Implementation of any recommendations (separate PRs, post-pilot)
- Source code changes (`src/` is read-only for this PR)
- Rules changes
- Platform admin (cross-tenant) screens
- Adding new features (this is a redesign of existing functionality, not feature work)
- Real-device testing on iOS/Android (mocks live in browser; real-device passes happen during implementation PRs)
- Brand identity changes (logo, color palette beyond what Nexus already defines)
- Marketing/landing pages (manager portal only)
- Touching `docs/FOLLOW_UPS.md` (closures/additions handled by future housekeeping)
- Updating CLAUDE.md (design system documentation update can be a follow-up after recommendations are accepted)

---

## What success looks like

A reviewer can open this PR and answer all three questions in under 5 minutes:

1. **What's wrong with the manager portal today?** (Audit doc summarizes clearly.)
2. **What should we change, in what order?** (Recommendations doc gives prioritized roadmap.)
3. **What will the new design look like?** (Mock HTML provides visual proof.)

Implementation PRs derived from this audit should be small and discrete (the same B1–B5 pattern from agent portal Track B v2): one PR per recommendation cluster, each translating mock + recommendation into code faithfully.
