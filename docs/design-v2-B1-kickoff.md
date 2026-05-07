# AgencyTrack Session Kickoff — Design v2 PR B1 (Medal Badge System)

> **For Kyron:** This is the prompt to paste into a fresh Claude Code session to start PR B1. Copy from the line below all the way down. The prompt is self-contained — Claude Code will read the right files and produce a plan before writing any code.
>
> When B1 ships, duplicate this file (`design-v2-B2-kickoff.md` etc.) and adjust the §Session scope and §Files to read for the next PR.

---

## ✂ COPY FROM HERE ✂

# AgencyTrack Session Kickoff — Design v2 PR B1 (Medal Badges)

## Step 0 — Read these in order, do not skip
1. `CLAUDE.md` — static project rules (code style, domain rules, theme system, workflow).
2. `docs/CONTEXT.md` — current state, locked decisions, active follow-ups. **CONTEXT.md overrides CLAUDE.md where they differ — it's newer.**
3. `docs/design-v2-PRD.md` — product requirements for this redesign. Read fully.
4. `docs/design-v2-implementation.md` — phased PR plan. Focus on the **PR B1** section.
5. `mocks/concept-4-complete.html` — canonical visual source of truth. Find the medal CSS (search `/* ── Achievement badges (Medal v2 — glossy coin) ─────────────── */`) and the medal HTML markup.

## Step 1 — Tree state verification (do this before anything else)

```bash
git fetch origin
git status
git log origin/main --oneline -3
git worktree list
```

Working tree must be clean. `origin/main` HEAD must match the SHA in `docs/CONTEXT.md` § Current main HEAD. If either fails: STOP, surface in chat, do not absorb the discrepancy.

## Session scope

**In scope (PR B1 only):**
- Replace the flat solid-color badge tile design in `src/components/gamification/BadgeGrid.jsx` with the glossy medallion design from the mock.
- Extend the `BADGES` dict with `gradient` and `tier` props (mapping table provided in `docs/design-v2-implementation.md` § PR B1 Step 3).
- Add medal CSS variables and rules to `src/index.css` for both `:root` (light) and `.dark` (dark) modes.
- Verify call sites in `src/components/awards/AgentAwardsPanel.jsx` and `src/components/awards/ManagerAwardsPanel.jsx`. Update if they render badges directly; leave alone if they import `<BadgeGrid />`.

**Out of scope (do not expand into):**
- Goal carousel — that's PR B2, separate PR
- Activity feed — that's PR B3
- Sidebar shell — that's PR B4
- Tenant Admin config — that's PR B5
- Any change to `awardsEngine.js` — verify it doesn't read `gradient`/`tier`, do not modify
- Any change to wizard or its steps — never touched per CLAUDE.md
- Routing changes — none needed for B1

**Files / docs Claude Code should read for this session:**
- `src/components/gamification/BadgeGrid.jsx` — the file being modified. Audit current `BADGES` dict, current rendering loop, current props.
- `src/components/awards/AgentAwardsPanel.jsx` and `src/components/awards/ManagerAwardsPanel.jsx` — verify how they consume badge data.
- `src/utils/awardsEngine.js` — confirm it only reads badge keys, not gradient/tier.
- `src/index.css` — find the existing `:root` and `.dark` blocks for token additions.
- `tailwind.config.js` — confirm gradient utilities aren't purged.
- `mocks/concept-4-complete.html` — lift the medal CSS and reference the markup pattern.

## Decisions locked — do not re-litigate

These are settled before the session starts. If the audit surfaces a reason to revisit any of these, treat it as a surprise-stop trigger — do not unilaterally override.

- Medal shape is **circular**, not hexagonal. Decision documented in mock and PRD.
- Locked badges show **lock pin in corner + grayscale gradient**, not hidden, not heavily faded.
- Tier pips are **5 dots maximum** (Common → Legendary). No tier-6+ tier system.
- Hover micro-interaction: lift 2px translateY + tilt -4° rotate. No bigger animations.
- Gradient palette uses the **8 medal classes** mapped to semantic categories per PRD § 3.7 table.
- Medal sizes: **52px desktop**, **46px mobile**. Activity feed mini-medals at 36px (desktop) / 32px (mobile) — applied in PR B3, not here.
- Lucide React for icons. **No emojis.** No raw SVG paths in JSX (use Lucide imports).
- Add tokens to **both** `:root` and `.dark` in `src/index.css`. Light + dark designed together.
- Open question Q2 in PRD (locked-badge hover preview): default = **No**, keep grayscale on hover.

Plus everything in `docs/CONTEXT.md` § Locked decisions.

## What to do first

**Option A — Plan first (use this for B1):**

> Do not write code yet. Produce a work plan in chat covering:
> 1. **Audit current state vs scope.** Read the files listed above. Confirm the current `BADGES` dict structure, current tile JSX, current call sites. Surface any unexpected uses of badge classes.
> 2. **File-by-file change map** with risk assessment per file. Distinguish "additive token" changes from "structural JSX" changes.
> 3. **Verification strategy.** What you will test in the browser at each breakpoint, in both modes. Lighthouse a11y target (≥ 95 per PRD).
> 4. **Open questions for me to answer before code starts.** Especially around any badge call sites you found that aren't documented in the implementation plan.
>
> I'll review and approve before any code is written.

## Autonomous scope — what Claude Code can do without further check-in (after plan approval)

> 1. Create worktree branch off `origin/main` HEAD (verify SHA first against `docs/CONTEXT.md`).
> 2. Implement changes per the approved plan.
> 3. `npm run lint && npm run build` — must both pass.
> 4. Commit (conventional commits, per CLAUDE.md).
> 5. Push to feature branch.
> 6. Open PR titled `feat(design-v2-b1): medal badge system` with description covering: scope, file count breakdown, mock parity verification per breakpoint, dark-mode verification, open follow-ups for B2.
> 7. Wait for Vercel preview Ready via `scripts/wait-vercel-ready.sh <sha> --target preview --pr <PR#>`.
> 8. Run preview walkthrough via `scripts/exploration-walk.cjs --url=<preview> --label=design-v2-b1`.
> 9. Post walkthrough summary in PR comments.
> 10. **STOP at preview-verified.** No merge. I merge manually.

## Hard rules — non-negotiable, applies every session

- **Worktree branch only.** Never push directly to `main`. Branch off `origin/main` HEAD.
- **Always pull main before branching:** `git fetch origin && git pull origin main` (per existing feedback memory — burned us on PR #31).
- **No auto-merge.** Push → PR → preview Ready → walkthrough → STOP for human merge.
- **Post-merge verification:** `git fetch origin && git log origin/main --oneline -5` to confirm squash SHA, then production walkthrough manually via Vercel dashboard + `scripts/exploration-walk.cjs --url=https://agencytrack.vercel.app --label=design-v2-b1_production`.
- **Worktree teardown after merge.** `git worktree remove <path>` then `git worktree prune`.
- **Never echo `.env.local` values** to chat output, PR comments, logs, or screenshots. Reference by env var name only.
- **Verification artifacts stay local.** Logs, screenshots, one-off verification scripts — never commit.
- **No emojis as structural icons.** Lucide React only.
- **No hardcoded hex outside CSS variables** (except `AgentReportDocument.jsx` per CLAUDE.md exception).
- **Both light + dark mode tested** before opening PR.

## Discipline gates — surface in chat, do not absorb unilaterally

**Two-strike stop:** If you hit the same kind of unexpected friction twice in a row on this session — two unrelated bugs surface, two retries on the same step, two dark-mode contrast issues — STOP and wait for me, regardless of progress. Counter resets at the start of each new session.

**Surprise-stop:** If anything mid-execution surprises the plan — an existing badge call site that isn't `<BadgeGrid />`, `awardsEngine.js` reads `gradient`/`tier` (it shouldn't), tailwind purging strips medal classes, dark-mode contrast falls below 3:1 on any pip — STOP and write the concern in chat. Do not try to fix unilaterally. Do not absorb the surprise into the plan.

Both gates are the value of this workflow. They're not friction — they're catching bugs before they ship.

## Stash / pending state from prior sessions

Read `docs/CONTEXT.md` § Pending operational state. Surface anything notable in chat before starting B1.

## Final stop condition

End the session when:
- PR B1 is open with Vercel preview verified at 1440px desktop and 390px mobile in both light and dark mode
- Walkthrough screenshots posted in PR comments showing the new medals on AgentDashboard and (if applicable) AgentAwardsPanel/ManagerAwardsPanel
- All open questions for me are listed at the end of the plan / PR description
- `npm run lint` and `npm run build` both green on the feature branch
- Two-strike counter is at 0 or surfaced if not

Post a summary in chat with: tree state, PR link, what's done, what's blocked on me, two-strike counter status, and a one-line readiness check for PR B2.

## ✂ COPY ENDS HERE ✂

---

## Notes for Kyron

- This kickoff is intentionally bigger than the template's "fill in the brackets" pattern because B1 is the first of 5 PRs in this series. The locked decisions section locks in the visual system so subsequent PRs (B2-B5) can be smaller and faster.
- After B1 merges, duplicate this file as `design-v2-B2-kickoff.md` and adjust §Session scope + §Files to read. The §Hard rules and §Discipline gates sections stay the same.
- If you want to start with a different PR (e.g., B2 first because the carousel matters more for the demo), say so — the implementation plan supports out-of-order if you accept the trade-off that B4 can't ship before some content exists for the sidebar to navigate to.
