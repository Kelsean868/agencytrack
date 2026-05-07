# AgencyTrack Session Kickoff — Design v2 PR B3 (Activity Feed + BadgeGrid Surface + Cleanup)

> **For Kyron:** This is the prompt to paste into a fresh Claude Code session to start PR B3. Copy from the line below all the way down. The prompt is self-contained — Claude Code will read the right files and produce a plan before writing any code.
>
> When B3 ships, duplicate this file (`design-v2-B4-kickoff.md`) and adjust §Session scope, §Files to read, and §Decisions locked for the next PR. Note B4 is the largest structural change in the series (sidebar shell wraps every dashboard) — its kickoff will need extra care around the all-roles preview matrix. §Hard rules and §Discipline gates stay the same.

---

## ✂ COPY FROM HERE ✂

# AgencyTrack Session Kickoff — Design v2 PR B3 (Activity Feed + BadgeGrid Surface + Cleanup)

## Step 0 — Read these in order, do not skip
1. `CLAUDE.md` — static project rules (code style, domain rules, theme system, workflow).
2. `docs/CONTEXT.md` — current state, locked decisions, active follow-ups. **CONTEXT.md overrides CLAUDE.md where they differ — it's newer.**
3. `docs/design-v2-PRD.md` — product requirements for this redesign. Read fully. Pay attention to § 3.2 Agent role (Activity feed) and any open questions touching the feed surface.
4. `docs/design-v2-implementation.md` — phased PR plan. Focus on the **PR B3** section.
5. `mocks/concept-4-complete.html` — canonical visual source of truth. Locate the activity feed section (search `activity-list` / `activity-item` / `activity-icon`) and the BadgeGrid placement on the AgentDashboard surface (search the agent dashboard markup around the hero, `mocks/concept-4-complete.html:1141` per the B1 retrospective callout in `design-v2-implementation.md`).
6. `docs/PR-44-retrospective` notes inline in `design-v2-implementation.md` § PR B1 (B1 follow-up callout) and the audit corrections table at top of § PR B2 — both encode lessons that apply directly to B3.

## Step 1 — Tree state verification (do this before anything else)

```bash
git fetch origin
git status
git log origin/main --oneline -3
git worktree list
```

Working tree must be clean. `origin/main` HEAD must match the SHA in `docs/CONTEXT.md` § Current main HEAD. If either fails: STOP, surface in chat, do not absorb the discrepancy. (Per the audit-on-arrival safeguard introduced in PR #42 — B1 caught CONTEXT.md drift this way, B2 caught nothing because B1 had already corrected the protocol. B3 still runs the check; the protocol is the value, not the find.)

## Session scope

**In scope (PR B3 only):**
- **Activity feed on AgentDashboard.** Primary scope per PRD § 3.2. Reverse-chronological list of recent submissions with status, week starting, and key metrics. Mock canonical reference: `mocks/concept-4-complete.html` activity feed section. Event surface (submissions only vs. submissions + badges + rank + applications per `design-v2-implementation.md` § B3 Step "Event derivation") is **audit-confirmed against the mock** — see Decisions locked.
- **Surface `<BadgeGrid />` on AgentDashboard.** Deferred B1 follow-up (`design-v2-implementation.md` § B1 trailing callout). Place per mock structure — below hero, alongside or near the activity feed. Exact layout (column / row / sibling-of-feed) confirmed by the mock-vs-code audit, not assumed up front.
- **Delete orphaned `src/components/dashboard/MotivationalCarousel.jsx`.** Orphaned by B2's S3 resolution (B2 removed the import + render in `AgentDashboard.jsx` and intentionally left the file in place for a follow-up cleanup). Audit confirms no consumer remains via grep before deletion.
- **Update `scripts/exploration-walk.cjs`.** Drop the stale `text=YTD API` assertion that has been generating an expected SKIP since B2 replaced the YTD API hero. Replace with an assertion against an element B3 introduces (activity feed item, `aria-label` on the feed, or the BadgeGrid heading on AgentDashboard — pick the most stable selector after audit).

**Out of scope (do not expand into):**
- Sidebar shell — B4 (structural; do not touch `App.jsx` or dashboard chrome layout)
- Tenant Admin config — B5
- Rank card / 4-stat grid / leaderboard mini described in PRD § 3.2 — audit confirms whether B2 addressed any of these. If still outstanding, they belong in a later PR, **not** B3.
- Manager dashboards (`ManagerDashboard.jsx`, all `src/components/manager/*`)
- New Firestore collections, queries, or schema changes (event derivation must happen client-side from already-loaded data, per `design-v2-implementation.md` § B3)
- Routing changes
- Wizard or Step files (per CLAUDE.md, never touched)
- Goal carousel / donut behavior (B2-locked)
- Medal badge tokens or gradient classes (B1-locked) — B3 reuses them, does not modify them

**Files Claude Code should read for the audit (starting points only — the actual change set comes from the audit, not from `docs/design-v2-implementation.md` § B3 Files):**
- `src/components/dashboard/AgentDashboard.jsx` — locate where B2 wired in `<GoalCarousel />`. Identify clean insertion point for the activity feed and BadgeGrid surfacing. Confirm what remaining KPI/section structure exists below the hero post-B2.
- `src/components/gamification/BadgeGrid.jsx` — confirm the post-B1 prop signature (`submissions` etc.) so the AgentDashboard surfacing call matches the existing CareerPortal call site.
- `src/components/profile/CareerPortal.jsx` — confirm the existing `<BadgeGrid />` consumer pattern at `:468` (per `design-v2-implementation.md` § B1) so AgentDashboard surfacing mirrors it consistently.
- `src/components/dashboard/MotivationalCarousel.jsx` — confirm the file exists, is unconsumed (`grep -rn "MotivationalCarousel" src/` returns 0 matches outside the file itself), and that no test/storybook references it. If anything imports it, surprise-stop.
- `src/utils/extractFields.js` — verify the field shape for activity-feed item rendering. Confirm `apiSold`, `ffi`, `ci`, `applications`, `weekStarting`, `status` are reliably exposed across all three schema variants. (B2's audit corrections table is the authoritative reference here.)
- `src/hooks/useSubmissions.js` and `src/hooks/useAgentMetrics.js` — confirm what's already loaded on AgentDashboard. The activity feed must derive from already-loaded data — no new fetches.
- `src/index.css` — locate `:root` and `.dark` blocks for any token additions, locate end of file for new class block (B1 added the medal block at the bottom, B2 added the carousel block — follow the pattern).
- `tailwind.config.js` — confirm any utilities the activity feed or BadgeGrid surfacing needs aren't purged.
- `mocks/concept-4-complete.html` — lift the activity-feed CSS verbatim (`.activity-list`, `.activity-item`, `.activity-icon`, `.ai-success/gold/primary/ink` classes). Confirm the BadgeGrid placement on the agent surface (`mocks/concept-4-complete.html:1141`).
- `scripts/exploration-walk.cjs` — locate the stale `text=YTD API` assertion (search `YTD API` literally). Confirm what surrounding assertions look like so the replacement matches the script's existing assertion style.

> **B1 + B2 retrospective audit lesson — apply here:** `docs/design-v2-implementation.md` § B3 lists `ActivityFeed.jsx`, `buildActivityEvents.js`, `AgentDashboard.jsx`, and `src/index.css` as files to create/modify, plus a four-event-type derivation (submission / badge / rank / application). Treat all of this as **starting hypotheses, not directives.** Audit the actual current state and the mock's actual feed content, then produce an honest change set in the plan. B1 corrected `AgentAwardsPanel.jsx` / `ManagerAwardsPanel.jsx` listings (PR #45). B2 corrected `personalCommitment` → `personalAnnualAPI` and `extractFields.api` → `extractFields.apiSold` (kickoff S1, S2). B3's equivalent correction may surface in event-type scope or BadgeGrid placement — the audit is the deliverable.

> **B1 + B2 retrospective surface-gap lesson — apply here:** Confirm the mock's activity-feed and BadgeGrid surfaces actually exist on `AgentDashboard.jsx` post-B2. If the mock places the feed somewhere structurally inconsistent with the live dashboard (e.g., the mock has a 2-column layout below the hero but the live dashboard is single-column), surface as a surprise-stop and ask whether B3 absorbs the layout shift or defers it to B4 (sidebar shell already touches dashboard layout).

> **Mock-vs-implementation-plan reconciliation:** The implementation plan's § B3 event derivation includes badge events, rank events, and application events as well as submissions. The user-supplied B3 brief calls out **submissions only** as the primary scope. **The mock is the tiebreaker.** If the mock's activity feed shows badge / rank / application events, surface for plan-level decision (in or out of B3?) before coding. If the mock shows submissions only, drop the other event types from scope with a one-line justification in the plan.

## Decisions locked — do not re-litigate

These are settled before the session starts. If the audit surfaces a reason to revisit, treat it as a surprise-stop trigger — do not unilaterally override.

### Activity feed behavior
- **Reverse-chronological** by event timestamp (most recent first).
- **Cap at 25 items in the last 7 days** per `design-v2-implementation.md` § B3 Acceptance criteria. Items beyond that window or count are not shown — no "View all" link in B3 unless the mock has one (audit confirms).
- **Derives entirely from already-loaded data.** No new Firestore reads. No N+1.
- **Memoized** via `useMemo` keyed on `submissions.length` (and `earnedBadgeKeys.size` if badge events are in scope post-audit).

### BadgeGrid surfacing
- **Reuses existing `<BadgeGrid />` component verbatim.** No prop changes. No new variants. Same call shape as CareerPortal.
- **Placement per mock.** Audit confirms the exact slot (below hero, beside feed, etc.). The plan must call out the chosen layout structure explicitly.
- **Empty / unearned state** is the existing component behavior — B3 does not change BadgeGrid internals.

### MotivationalCarousel deletion
- **File deletion only.** No replacement. No revival of the component on any surface.
- **Audit gate:** `grep -rn "MotivationalCarousel" src/` must return zero matches outside the file itself before deletion. If anything imports it (test, storybook, dead branch in another component), surprise-stop and surface for triage.

### exploration-walk.cjs update
- **Replace, do not just remove.** The stale `text=YTD API` assertion gets swapped for an assertion against a B3-introduced element so the walkthrough script regains coverage of the AgentDashboard hero region.
- **Stable selector preferred** — heading text (BadgeGrid section heading or activity feed heading) over class name; `aria-label` over text node where the text is dynamic.
- **No structural changes to the script** beyond the assertion swap. Argument shape, exit codes, label flag all stay as-is.

### Token naming
- **All new CSS variables (if any) use the `--color-*` prefix** (B1/B2 retrospective — locked). E.g., `--color-activity-success-bg`, `--color-activity-icon-fg`. No `--activity-*` / `--feed-*` style names.
- **Add tokens to BOTH `:root` and `.dark` blocks** in `src/index.css` (project policy). Light + dark designed together.
- **Reuse existing semantic tokens where possible:** `--color-success`, `--color-primary`, `--color-warning`, `--color-text-muted`. Only add new tokens for surfaces that don't fit existing roles.
- **Reuse medal tokens** from B1 for badge-event mini-medals if badge events are in scope post-audit. `--color-medal-*` is the locked precedent — do not introduce a parallel namespace.

### A11y — bake in from the start (B1/B2 retrospective lesson)
- **Semantic markup:** activity feed renders as `<ol>` (ordered list — chronological order is meaningful) with `<li>` items. **Not** `<div>` soup.
- **Per-item structure:**
  - `<time dateTime={ISO string}>` for the timestamp — both human-readable (`"3 days ago"`) and machine-parseable.
  - Status text is screen-reader-friendly: e.g., `<span className="sr-only">Status:</span> Submitted` or via `aria-label` on the pill, not relying on color alone.
  - Icon is decorative (`aria-hidden="true"`) when title text already conveys the event type; `role="img"` + `aria-label` if the icon is the only signal.
- **List labelling:** `<ol aria-label="Recent activity">` or wrap in `<section aria-labelledby="activity-feed-heading"><h2 id="activity-feed-heading">Recent activity</h2><ol>...</ol></section>`.
- **BadgeGrid section labelling on AgentDashboard:** the surfaced `<BadgeGrid />` must sit inside a labelled section, mirroring the activity feed pattern. Pattern: `<section aria-labelledby="badges-heading"><h2 id="badges-heading">Achievements</h2><BadgeGrid ... /></section>`. Confirm CareerPortal's existing heading text in the audit and reuse it for consistency — if CareerPortal uses "Achievement Badges," AgentDashboard uses the same; do not invent a new label.
- **Color contrast:** event-type pills (success / gold / primary / ink) must hold ≥ 4.5:1 against pill background in both light and dark mode. Audit dark-mode pill backgrounds against `--color-surface` and `--color-surface-raised`.
- **Reduced-motion guards** on any animations the mock introduces (slide-in on new items, hover lifts on items, etc.). Wrap in `@media (prefers-reduced-motion: no-preference)`.
- **Keyboard:** activity items themselves are not interactive in B3 (no per-item drill-down link unless the mock shows one — audit confirms). If the mock adds a "View all" link or per-item link, it must be a `<button>` or `<a>` with visible focus ring.
- **Lucide React for any icon needs.** No emojis. No raw SVG paths in JSX (except B2's donut, which is owned by B2).

### Project-wide policy (recap)
- Lucide React for icons.
- No hardcoded hex outside CSS variables (except `AgentReportDocument.jsx`).
- Both light and dark mode tested before opening PR.
- All numeric writes to Firestore stay `parseFloat`-enforced (n/a for B3 — no writes).

Plus everything in `docs/CONTEXT.md` § Locked decisions.

## What to do first

**Option A — Plan first (use this for B3):**

> Do not write code yet. Produce a work plan in chat covering:
> 1. **Audit current state vs scope.** Read the files listed in §Session scope. Confirm:
>    - Where the post-B2 AgentDashboard hero sits and what's currently directly below it (the activity feed's insertion point).
>    - Whether `MotivationalCarousel.jsx` is fully orphaned (zero non-self imports). Surface the grep output.
>    - Mock-vs-code event-type scope: does the mock's activity feed show submissions only, or also badge/rank/application events? Surface a recommendation with one-line justification.
>    - Mock-vs-code BadgeGrid placement: where does the mock place the BadgeGrid relative to the activity feed on AgentDashboard? Single column, two columns, side-by-side?
>    - Whether `extractFields()` reliably exposes `apiSold`, `ffi`, `ci`, `applications`, `weekStarting`, `status` across all three schema variants (B2's audit corrections table is the authoritative reference; reconfirm specifically for the activity feed's display fields).
>    - Whether `useSubmissions` / `useAgentMetrics` already deliver everything the feed needs, or if a new selector / `useMemo` is needed in `AgentDashboard.jsx`.
>    - **Heading hierarchy across the post-B3 dashboard.** Where does `h1` sit on AgentDashboard today? Are existing sections (Goal Carousel, Goals, Submit) labelled at `h2`? Where will Activity Feed and BadgeGrid surface headings sit? No skipped levels — `h1` → `h2` → `h3` only. If the audit surfaces a missing or misplaced `h1`, that's a surprise-stop, not silent absorption.
>    - Any naming collisions for `ActivityFeed.jsx`, `buildActivityEvents.js`.
>    - The exact `text=YTD API` assertion line(s) in `scripts/exploration-walk.cjs` and what surrounding assertions look like (so the replacement matches existing style).
> 2. **Mock-vs-code parity check.** Confirm the mock's activity feed surface and BadgeGrid placement match the post-B2 `AgentDashboard.jsx` structure. If they disagree, surface a structural decision (absorb into B3? defer layout shift to B4 sidebar shell?).
> 3. **File-by-file change map** with risk assessment per file. Distinguish "additive" (new files: `ActivityFeed.jsx`, `buildActivityEvents.js`, new tokens, new CSS class block) from "structural" (modifying `AgentDashboard.jsx` JSX) from "deletion" (`MotivationalCarousel.jsx`) from "tooling" (`exploration-walk.cjs`). For any file in the implementation plan's B3 list that the audit shows is unrelated, drop it from the change set with a one-line justification.
> 4. **Empty-state + edge-case plan.** Zero submissions in the last 7 days, exactly 1 submission, 25+ submissions, submissions spanning a year boundary, missing optional fields on legacy submissions (e.g., `ffi` undefined), badge events on a freshly-onboarded agent (zero earned).
> 5. **A11y verification plan.** Screen-reader output for one feed item. Keyboard tab order across the dashboard post-B3. Reduced-motion check. Pill contrast verification at light + dark. Heading hierarchy across the dashboard (no skipped levels — `h1` → `h2` → `h3`).
> 6. **`exploration-walk.cjs` selector decision.** Propose the new assertion (element + selector style + expected text or attribute) with justification for stability. Confirm the assertion will not flake on legitimate empty-state renders.
> 7. **Open questions for me to answer before code starts.** Especially: event-type scope (submissions only vs. all four), BadgeGrid placement structure (column / row / sibling), MotivationalCarousel deletion gate (any unexpected consumers?), and any others surfaced by the audit.
>
> I'll review and approve before any code is written.

## Autonomous scope — what Claude Code can do without further check-in (after plan approval)

> 1. Sync main: `git fetch origin && git pull origin main` (per locked feedback memory).
> 2. Create worktree branch off `origin/main` HEAD (verify SHA against `docs/CONTEXT.md`).
> 3. **First commit on the branch must be the CONTEXT.md SHA bump** (per B1/B2 protocol: bump `Current main HEAD` and `Recently shipped` to reflect the latest merged PR before B3 work begins).
> 4. Implement changes per the approved plan.
> 5. `npm run lint && npm run build` — must both pass.
> 6. Commit (conventional commits, per CLAUDE.md). Suggested sequence: CONTEXT.md bump → token additions (if any) → `buildActivityEvents` util → `ActivityFeed` component → AgentDashboard wire-up (feed + BadgeGrid surface) → MotivationalCarousel deletion → exploration-walk assertion swap.
> 7. Push to feature branch.
> 8. Open PR titled `feat(design-v2-b3): activity feed + BadgeGrid surface + cleanup` with description covering: scope, file count breakdown, mock parity verification per breakpoint (1440px / 1024px / 768px / 390px), dark-mode verification, empty-state / edge-case verification, a11y verification, MotivationalCarousel deletion gate result, exploration-walk assertion swap before/after, open follow-ups for B4.
> 9. Wait for Vercel preview Ready via `scripts/wait-vercel-ready.sh <sha> --target preview --pr <PR#>`.
> 10. Run preview walkthrough via `scripts/exploration-walk.cjs --url=<preview> --label=design-v2-b3`. The new assertion (replacing the stale `text=YTD API`) must pass — that's the verification that the swap is correct.
> 11. Post walkthrough summary in PR comments. Include: feed item rendering at all 4 breakpoints, dark-mode pill contrast confirmation, BadgeGrid surfacing alignment with mock, empty-state confirmation if test agent has no recent submissions, reduced-motion check, screen-reader transcript for one feed item (manual if needed).
> 12. **STOP at preview-verified.** No merge. I merge manually.

## Hard rules — non-negotiable, applies every session

- **Worktree branch only.** Never push directly to `main`. Branch off `origin/main` HEAD.
- **Always pull main before branching:** `git fetch origin && git pull origin main` (per existing feedback memory — burned us on PR #31).
- **No auto-merge.** Push → PR → preview Ready → walkthrough → STOP for human merge.
- **Post-merge verification:** `git fetch origin && git log origin/main --oneline -5` to confirm squash SHA, then production walkthrough via `scripts/exploration-walk.cjs --url=https://agencytrack.vercel.app --label=design-v2-b3_production`. The walkthrough should now pass the swapped assertion on production too — that's the second proof the swap was correct.
- **Worktree teardown after merge.** `git worktree remove <path>` then `git worktree prune`. Local branch should auto-delete via the GitHub "Automatically delete head branches" setting — confirm with `git branch -vv` and prune any stragglers.
- **Never echo `.env.local` values** to chat output, PR comments, logs, or screenshots. Reference by env var name only.
- **Verification artifacts stay local.** Logs, screenshots, one-off verification scripts — never commit.
- **No emojis as structural icons.** Lucide React only.
- **No hardcoded hex outside CSS variables** (except `AgentReportDocument.jsx` per CLAUDE.md exception).
- **All new tokens use `--color-*` prefix** (B1/B2 retrospective — locked).
- **Implement the mock faithfully — do not redesign.** Activity-feed CSS is lifted verbatim from `mocks/concept-4-complete.html` and refactored only to swap mock tokens for project `--color-*` tokens. If the mock and live tokens collide on a value with no equivalent, surface as a surprise-stop. The only design decisions this session are token-name mappings and event-scope reconciliation.
- **Both light + dark mode tested** before opening PR.
- **A11y is not a follow-up.** Semantic `<ol>` / `<li>` / `<time>`, pill labelling, reduced-motion guards, screen-reader-friendly status text — all ship in the PR. (B1/B2 retrospective lesson.)
- **No new Firestore reads.** Activity feed must derive from already-loaded data. If the audit surfaces a case that genuinely needs a new query (e.g., rank events require leaderboard data not currently on AgentDashboard), surface as a surprise-stop and decide whether to drop that event type from scope.

## Discipline gates — surface in chat, do not absorb unilaterally

**Two-strike stop:** If you hit the same kind of unexpected friction twice in a row on this session — two unrelated bugs surface, two retries on the same step, two dark-mode contrast issues, two ambiguous mock-vs-code disagreements — STOP and wait for me, regardless of progress. Counter resets at the start of each new session.

**Surprise-stop:** If anything mid-execution surprises the plan — `MotivationalCarousel` has an unexpected consumer, `extractFields()` doesn't expose a field the feed needs, the mock's activity feed contains an event type that requires data not currently on AgentDashboard, the implementation plan's B3 file list points at a file the audit shows is unrelated, BadgeGrid placement requires a structural layout shift bigger than B3 should absorb, the `exploration-walk.cjs` script structure doesn't accommodate the assertion swap as written, the BadgeGrid component prop signature has drifted from the post-B1 contract, dark-mode contrast falls below threshold on any new pill — STOP and write the concern in chat. Do not try to fix unilaterally. Do not absorb the surprise into the plan.

Both gates are the value of this workflow. They're not friction — they're catching bugs before they ship. B1 caught two surface-gap surprises (CONTEXT.md drift + AgentDashboard-vs-CareerPortal mismatch). B2 caught two field-name drifts (`personalCommitment`, `extractFields.api`) before any code was written. B3's equivalent surprises will most likely cluster around the activity feed event scope or the post-B2 AgentDashboard layout.

## Stash / pending state from prior sessions

Read `docs/CONTEXT.md` § Pending operational state. Surface anything notable in chat before starting B3. Known carry-overs as of B2 close:

- **Untracked legacy doc** at `docs/PR-3-Claude-Code-Brief.md` — stale, intentionally untracked across multiple PRs. Decide separately (archive or delete) — not B3 scope.
- **`MotivationalCarousel.jsx` orphaned by B2** — B3 deletes it (see §Session scope). Confirm orphaned status via grep before deletion.
- **`exploration-walk.cjs` has a stale `text=YTD API` assertion generating an expected SKIP since B2** — B3 swaps it (see §Session scope).
- **B2 follow-ups not in B3 scope:** anything else B2 left in the FOLLOW_UPS doc or in the B2 PR description that doesn't fit activity-feed / BadgeGrid-surface / cleanup. Surface, do not absorb.
- **GitHub "Automatically delete head branches" is ON.** Worktree teardown should be clean.

## Final stop condition

End the session when:
- PR B3 is open with Vercel preview verified at 1440px desktop, 1024px tablet, 768px tablet-portrait, and 390px mobile in both light and dark mode
- Walkthrough confirms: activity feed renders the expected event types per audit-confirmed scope, items are reverse-chronological, items respect the 25-item / 7-day cap, BadgeGrid surfaces on AgentDashboard at the mock-confirmed placement, MotivationalCarousel.jsx is gone, `exploration-walk.cjs`'s swapped assertion passes against the preview
- Empty-state behavior verified for an agent with zero recent submissions
- Reduced-motion behavior verified (manually via DevTools simulate, or via report)
- Pill contrast verified for every event-type variant in both light and dark mode: ≥ 4.5:1 for text-on-pill-bg (WCAG AA text contrast); ≥ 3:1 for the pill background against the surrounding surface (WCAG AA non-text contrast for color-only indicators). If a pill has both text and a color-only indicator role, both thresholds apply.
- Screen-reader pass on one feed item — confirms the `<time>` element, status label, and event title all announce coherently
- All open questions for me are listed at the end of the plan / PR description
- `npm run lint` and `npm run build` both green on the feature branch
- Two-strike counter is at 0 or surfaced if not

Post a summary in chat with: tree state, PR link, what's done (feed + surface + cleanup + script swap), what's blocked on me, two-strike counter status, and a one-line readiness check for PR B4 (sidebar shell — note the all-roles preview matrix B4 will require).

## ✂ COPY ENDS HERE ✂

---

## Notes for Kyron

- **Bigger than B2 by design, smaller than B4.** B3 has four distinct deliverables (feed, BadgeGrid surface, MotivationalCarousel deletion, exploration-walk swap) but each is bounded and additive. B4 is the structural one.
- **Three retrospective lessons baked in** — speculative-file-listing posture (B1+B2), mock-vs-code surface check (B1), event-scope reconciliation (B3-specific — the implementation plan and the user brief disagree on event types, so the mock arbitrates).
- **MotivationalCarousel cleanup is part of B3, not a follow-up.** B2 explicitly left the file in place expecting a follow-up cleanup; B3 is that follow-up. If the audit shows an unexpected consumer, the deletion drops out of B3 — the rest of the PR proceeds.
- **`exploration-walk.cjs` swap is the smallest deliverable but the most boring.** Easy to forget. It's listed in §Session scope explicitly so the audit picks it up; the swapped assertion is a real verification artifact, not just script hygiene.
- **CONTEXT.md SHA bump remains B-series protocol.** First commit of every B-series feature branch bumps `Current main HEAD` to the latest merged PR. B3's first commit will bump to `657d25b` (PR #47) or whatever's HEAD when you launch B3.
- **B4 is the next big one.** When you draft B4's kickoff, scope it carefully — sidebar shell wraps every dashboard, touches `App.jsx`, and needs all 5 role logins verified on preview before merge. The B4 kickoff will be larger than B1/B2/B3's because of that preview matrix.
