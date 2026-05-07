# AgencyTrack Session Kickoff — Design v2 PR B2 (Goal Carousel + Donut Hero)

> **For Kyron:** This is the prompt to paste into a fresh Claude Code session to start PR B2. Copy from the line below all the way down. The prompt is self-contained — Claude Code will read the right files and produce a plan before writing any code.
>
> When B2 ships, duplicate this file (`design-v2-B3-kickoff.md`) and adjust §Session scope, §Files to read, and §Decisions locked for the next PR. §Hard rules and §Discipline gates stay the same.

---

## ✂ COPY FROM HERE ✂

# AgencyTrack Session Kickoff — Design v2 PR B2 (Goal Carousel + Donut Hero)

## Step 0 — Read these in order, do not skip
1. `CLAUDE.md` — static project rules (code style, domain rules, theme system, workflow).
2. `docs/CONTEXT.md` — current state, locked decisions, active follow-ups. **CONTEXT.md overrides CLAUDE.md where they differ — it's newer.**
3. `docs/design-v2-PRD.md` — product requirements for this redesign. Read fully. Pay attention to § 3.2 Agent role (Goal carousel hero) and § 7 Open questions Q1 + Q4.
4. `docs/design-v2-implementation.md` — phased PR plan. Focus on the **PR B2** section.
5. `mocks/concept-4-complete.html` — canonical visual source of truth. Find the carousel CSS (search `/* ── Goal carousel (hero card) ──── */`) and the carousel HTML markup (4 tabs Week / Month / Quarter / YTD with donut).

## Step 1 — Tree state verification (do this before anything else)

```bash
git fetch origin
git status
git log origin/main --oneline -3
git worktree list
```

Working tree must be clean. `origin/main` HEAD must match the SHA in `docs/CONTEXT.md` § Current main HEAD. If either fails: STOP, surface in chat, do not absorb the discrepancy. (Per the audit-on-arrival safeguard introduced in PR #42 — and the same drift it caught at B1 kickoff is exactly this class of catch.)

## Session scope

**In scope (PR B2 only):**
- Replace the current AgentDashboard hero KPI section with a 4-tab carousel: Week / Month / Quarter / YTD. Each tab shows period label, current API value, target, % to goal, status text, and a glossy donut SVG.
- Auto-rotate every 6s, pauses on hover **and** focus, click any tab pins.
- Create `src/utils/aggregateAPI.js` — pure function deriving period totals from already-loaded submissions. No new Firestore reads.
- Add carousel + donut CSS to `src/index.css` (light + dark tokens together, `--color-*` prefix).
- Empty state for agents with zero submissions.

**Out of scope (do not expand into):**
- Medal badges — B1, shipped (PR #44)
- Activity feed — B3, separate PR
- Sidebar shell — B4
- Tenant Admin config — B5
- Rank card / 4-stat grid / leaderboard mini described in PRD § 3.2 — those land in B3+ alongside the activity feed
- Surfacing `<BadgeGrid />` on AgentDashboard — deferred B1 follow-up, owned by B3 (or a B1.5 PR)
- New Firestore collections, queries, or schema changes
- Routing changes
- Wizard or Step files (per CLAUDE.md, never touched)
- Any change to `MotivationalCarousel.jsx` unless the audit proves we're orphaning it

**Files Claude Code should read for the audit (starting points only — the actual change set comes from the audit, not from `docs/design-v2-implementation.md` § B2 Files):**
- `src/components/dashboard/AgentDashboard.jsx` — locate the current hero section. Confirm it has a clean replaceable boundary. Check whether the current hero uses `KPICard`, raw markup, or `MotivationalCarousel`.
- `src/components/dashboard/KPICard.jsx` — if hero uses this, confirm it's consumed elsewhere too (don't orphan).
- `src/components/dashboard/MotivationalCarousel.jsx` — separate component per CLAUDE.md src tree; confirm it's not what we're replacing (different surface).
- `src/utils/extractFields.js` — required for reading the `api` field from submissions. Verify it returns `api` as a number; confirm field naming for the three schema variants.
- `src/services/goalsService.js` — confirm it exposes a personal-commitment lookup for the agent. The implementation plan example assumes `user?.personalCommitment` — verify that field exists on the user doc OR that there's a service call that returns it. Surprise-stop if neither.
- `src/context/AuthContext.jsx` and `src/hooks/useAuth.js` — confirm what user-shaped object is available in dashboard render.
- `src/index.css` — locate `:root` and `.dark` blocks for token additions; locate end of file for new class block (B1 added the medal block at the bottom — follow that pattern).
- `tailwind.config.js` — confirm any new utilities the carousel needs aren't purged.
- `mocks/concept-4-complete.html` — lift the carousel CSS and reference the HTML pattern.

> **B1 retrospective audit lesson — apply here:** `docs/design-v2-implementation.md` § B2 lists `AgentDashboard.jsx` and `src/index.css` as files to modify. Treat these as **starting hypotheses, not directives.** Audit the actual current state and produce an honest change set in the plan. The B1 implementation plan listed `AgentAwardsPanel.jsx` and `ManagerAwardsPanel.jsx` as files to modify — both turned out to be unrelated (PR #45 corrected the doc). Same posture for B2.

> **B1 retrospective surface-gap lesson — apply here:** Confirm the carousel's destination surface (`AgentDashboard.jsx`) actually has a hero section that matches the mock's structure. If the mock and the live code disagree about what's at the top of AgentDashboard, surface as a surprise-stop, like B1's "BadgeGrid isn't on AgentDashboard" finding.

## Decisions locked — do not re-litigate

These are settled before the session starts. If the audit surfaces a reason to revisit, treat it as a surprise-stop trigger — do not unilaterally override.

### Carousel behavior
- **4 tabs:** Week / Month / Quarter / YTD. No fewer, no more.
- **Auto-rotate ON by default, 6s per tab, no user-facing toggle.** Resolves PRD § 7 Q1.
- **Pause on hover AND focus** (not hover-only — keyboard users need the same affordance).
- **Click any tab to pin** (stops auto-rotate for that interaction; resumes 6s after blur/mouseleave).
- **No rank-stripe sparkline.** Resolves PRD § 7 Q4.
- **Tab order:** Week (active on first paint) → Month → Quarter → YTD.

### Goal aggregation
- `aggregateAPI` is a **pure function** — no Firestore reads, no side effects. Takes already-loaded submissions array + a current date + the agent's personal commitment.
- Period targets derive by division: `week = personalCommitment / 52`, `month / 12`, `quarter / 4`, `ytd = personalCommitment`.
- Period totals derive by summing `extractFields(s).api` across submissions whose `weekStarting` falls in the period.
- Donut handles edge cases: 0%, 100%, >100% (clamps the visual stroke at 100%, but the displayed % can read >100%).

### Donut SVG
- **Radius 42, viewBox 0 0 100 100, circumference 263.89.**
- `stroke-dashoffset = circumference * (1 - clamp(percent, 0, 100) / 100)`.
- Animate via CSS `transition: stroke-dashoffset 0.5s ease`. **Never inline JS animation.**
- Inner text shows the integer percent.

### Token naming
- **All new CSS variables use the `--color-*` prefix** (B1 retrospective — `--color-medal-*` was the locked precedent). E.g., `--color-goal-donut-bg`, `--color-goal-donut-fg`. No `--medal-*` / `--goal-*` style names.
- **Add tokens to BOTH `:root` and `.dark` blocks** in `src/index.css` (project policy). Light + dark must be designed together.
- Reuse existing semantic tokens where possible: `--color-primary`, `--color-success`, `--color-warning`. Only add new tokens for surfaces that don't fit existing roles.

### A11y — bake in from the start (B1 retrospective lesson)
- **WAI-ARIA tabs pattern:**
  - Tab list wrapper: `role="tablist"`, `aria-label="Goal period"`.
  - Each tab button: `role="tab"`, `aria-selected={active}`, `aria-controls={panelId}`, `id={tabId}`, `tabIndex={active ? 0 : -1}` (single-tabstop pattern).
  - Each tab panel: `role="tabpanel"`, `aria-labelledby={tabId}`, `id={panelId}`, `tabIndex={0}`.
- **Keyboard nav:** Arrow Left / Right move focus between tabs (with wrap). Home / End jump to first / last. Enter or Space activates the focused tab.
- **Donut SVG:** `role="img"` + `aria-label="${percent}% of ${period} goal"` (e.g., "82% of weekly goal"). Internal `<text>` is decorative — `aria-hidden="true"` on it so the SR announces the label, not the duplicated number.
- **Auto-rotate respects `prefers-reduced-motion`:** wrap the rotation `setInterval` setup in a check on `window.matchMedia('(prefers-reduced-motion: reduce)')`. If reduced, no rotation, manual-only.
- **Donut stroke transition** also wrapped in `@media (prefers-reduced-motion: no-preference)` block.
- **`aria-live` on the slide region:** Open question with three viable patterns: (a) `aria-live="off"` — SR announces only on user-initiated tab activation via `aria-selected` change (cleanest, matches WAI-ARIA tabs pattern); (b) small visually-hidden `aria-live="polite"` companion region that announces only "Showing weekly goal" on rotation (not the whole panel content); (c) `aria-live="polite"` on the tabpanel itself (loud, can spam SR users every 6s). Default lean is (a) — surface for confirmation in the plan.
- **Lucide React for any icon needs.** No emojis. No raw SVG paths in JSX (donut is the exception — but the donut is one self-contained component, not scattered SVG).

### Project-wide policy (recap)
- Lucide React for icons.
- No hardcoded hex outside CSS variables (except `AgentReportDocument.jsx`).
- Both light and dark mode tested before opening PR.
- All numeric writes to Firestore stay `parseFloat`-enforced (n/a for B2 — no writes).

Plus everything in `docs/CONTEXT.md` § Locked decisions.

## What to do first

**Option A — Plan first (use this for B2):**

> Do not write code yet. Produce a work plan in chat covering:
> 1. **Audit current state vs scope.** Read the files listed in §Session scope. Confirm:
>    - Where the AgentDashboard hero section actually lives and what's currently in it.
>    - Whether `personalCommitment` is on the user doc or requires a service call (the implementation plan assumed the former — verify).
>    - Whether `extractFields()` returns `api` consistently across the three schema variants.
>    - Whether `MotivationalCarousel.jsx` is on the same surface — it shouldn't be (different concept), but check.
>    - Any naming collisions for `aggregateAPI.js`, `GoalCarousel.jsx`, `GoalDonut.jsx`.
> 2. **Mock-vs-code parity check.** Confirm the mock's carousel surface matches the real AgentDashboard structure. If they disagree (e.g., the mock places it where the current `KPICard` row lives), call out the structural change explicitly.
> 3. **File-by-file change map** with risk assessment per file. Distinguish "additive" (new file, new tokens) from "structural" (replacing JSX in AgentDashboard, removing/orphaning KPICard). For any file in the implementation plan's B2 list that the audit shows is unrelated, drop it from the change set with a one-line justification.
> 4. **Empty-state + edge-case plan.** Zero submissions, missing `personalCommitment`, donut at 0% / 100% / >100%, week boundary at year-end (week starting in Dec, year transition).
> 5. **A11y verification plan.** What screen-reader announcement to confirm. Keyboard navigation flow. Reduced-motion check.
> 6. **Open questions for me to answer before code starts.** Especially: should the slide region use `aria-live="polite"` for auto-rotation announcements? (Default: yes — surface for confirmation.) Any others surfaced by the audit.
>
> I'll review and approve before any code is written.

## Autonomous scope — what Claude Code can do without further check-in (after plan approval)

> 1. Sync main: `git fetch origin && git pull origin main` (per locked feedback memory).
> 2. Create worktree branch off `origin/main` HEAD (verify SHA against `docs/CONTEXT.md`).
> 3. **First commit on the branch must be the CONTEXT.md SHA bump** (per B1 protocol: bump `Current main HEAD` and `Recently shipped` to reflect the latest merged PR before B2 work begins).
> 4. Implement changes per the approved plan.
> 5. `npm run lint && npm run build` — must both pass.
> 6. Commit (conventional commits, per CLAUDE.md). Sequence: CONTEXT.md bump → token additions → aggregateAPI util → component(s) → AgentDashboard wire-up.
> 7. Push to feature branch.
> 8. Open PR titled `feat(design-v2-b2): goal carousel + donut hero` with description covering: scope, file count breakdown, mock parity verification per breakpoint, dark-mode verification, empty-state / edge-case verification, a11y verification, open follow-ups for B3.
> 9. Wait for Vercel preview Ready via `scripts/wait-vercel-ready.sh <sha> --target preview --pr <PR#>`.
> 10. Run preview walkthrough via `scripts/exploration-walk.cjs --url=<preview> --label=design-v2-b2`.
> 11. Post walkthrough summary in PR comments. Include: per-tab visual confirmation, auto-rotate cadence verification, hover/focus pause confirmation, reduced-motion check, screen-reader transcript (if feasible — manual otherwise).
> 12. **STOP at preview-verified.** No merge. I merge manually.

## Hard rules — non-negotiable, applies every session

- **Worktree branch only.** Never push directly to `main`. Branch off `origin/main` HEAD.
- **Always pull main before branching:** `git fetch origin && git pull origin main` (per existing feedback memory — burned us on PR #31).
- **No auto-merge.** Push → PR → preview Ready → walkthrough → STOP for human merge.
- **Post-merge verification:** `git fetch origin && git log origin/main --oneline -5` to confirm squash SHA, then production walkthrough via `scripts/exploration-walk.cjs --url=https://agencytrack.vercel.app --label=design-v2-b2_production`.
- **Worktree teardown after merge.** `git worktree remove <path>` then `git worktree prune`. Local branch should auto-delete via the GitHub "Automatically delete head branches" setting now that it's enabled — confirm with `git branch -vv` and prune any stragglers.
- **Never echo `.env.local` values** to chat output, PR comments, logs, or screenshots. Reference by env var name only.
- **Verification artifacts stay local.** Logs, screenshots, one-off verification scripts — never commit.
- **No emojis as structural icons.** Lucide React only.
- **No hardcoded hex outside CSS variables** (except `AgentReportDocument.jsx` per CLAUDE.md exception).
- **All new tokens use `--color-*` prefix** (B1 retrospective — locked).
- **Implement the mock faithfully — do not redesign.** Carousel and donut CSS is lifted verbatim from `mocks/concept-4-complete.html` and refactored only to swap mock tokens (`--gold`, `--border-2`, etc.) for project `--color-*` tokens. If the mock and live tokens collide on a value with no equivalent, surface as a surprise-stop. The only design decisions this session are token-name mappings.
- **Both light + dark mode tested** before opening PR.
- **A11y is not a follow-up.** Tabs / keyboard / reduced-motion / donut labelling all ship in the PR. (B1 retrospective lesson.)

## Discipline gates — surface in chat, do not absorb unilaterally

**Two-strike stop:** If you hit the same kind of unexpected friction twice in a row on this session — two unrelated bugs surface, two retries on the same step, two dark-mode contrast issues — STOP and wait for me, regardless of progress. Counter resets at the start of each new session.

**Surprise-stop:** If anything mid-execution surprises the plan — an existing carousel call site that isn't `<GoalCarousel />`, `personalCommitment` not on the user doc, `extractFields()` returns inconsistent `api` values across schemas, `aggregateAPI.js` filename already taken, donut SVG breaks at 390px, dark-mode contrast falls below 3:1 on the donut foreground, the implementation plan's B2 file list points at a file the audit shows is unrelated — STOP and write the concern in chat. Do not try to fix unilaterally. Do not absorb the surprise into the plan.

Both gates are the value of this workflow. They're not friction — they're catching bugs before they ship. B1 had two surface-gap surprises (CONTEXT.md drift + AgentDashboard-vs-CareerPortal mismatch) caught cleanly here.

## Stash / pending state from prior sessions

Read `docs/CONTEXT.md` § Pending operational state. Surface anything notable in chat before starting B2. Known carry-overs as of B1 close:

- **Untracked legacy doc** at `docs/PR-3-Claude-Code-Brief.md` — stale, intentionally untracked across multiple PRs. Decide separately (archive or delete) — not B2 scope.
- **B1 follow-up: surface `<BadgeGrid />` on AgentDashboard** — owned by B3, not B2.
- **GitHub "Automatically delete head branches" is now ON.** Worktree teardown should be cleaner this round.

## Final stop condition

End the session when:
- PR B2 is open with Vercel preview verified at 1440px desktop and 390px mobile in both light and dark mode
- Walkthrough confirms: 4 tabs render, auto-rotate cadence ≈ 6s, hover/focus pauses rotation, click pins, donut percent matches `aggregateAPI` output, empty state renders for the test agent if applicable
- Reduced-motion behavior verified (manually via DevTools simulate, or via report)
- Keyboard navigation verified (arrow keys move focus across tabs, Enter activates)
- Dark-mode contrast on donut foreground ≥ 3:1 vs surface
- All open questions for me are listed at the end of the plan / PR description
- `npm run lint` and `npm run build` both green on the feature branch
- Two-strike counter is at 0 or surfaced if not

Post a summary in chat with: tree state, PR link, what's done, what's blocked on me, two-strike counter status, and a one-line readiness check for PR B3.

## ✂ COPY ENDS HERE ✂

---

## Notes for Kyron

- **Smaller than B1 by design.** B1 locked the visual system (warm theme + `--color-*` token discipline + a11y baseline). B2 piggybacks on that foundation.
- **B1 retrospective lessons are baked in** — see the four callouts: speculative-file-listing posture, mock-vs-code surface check, `--color-*` token convention, a11y additions in scope from the start (not deferred).
- **Auto-rotate behavior is locked from PRD Q1.** No re-litigation. If the implementation surfaces a reason to revisit (e.g., users complain in pilot), file a follow-up — don't change it mid-session.
- **CONTEXT.md SHA bump is now B-series protocol.** First commit of every B-series feature branch bumps `Current main HEAD` to the latest merged PR. B2's first commit will bump to `52af738` (PR #45) or whatever's HEAD when you launch B2.
- **B3 is the natural home for the deferred B1 follow-up.** When you draft B3's kickoff, scope it to include surfacing `<BadgeGrid />` on AgentDashboard alongside the activity feed.
