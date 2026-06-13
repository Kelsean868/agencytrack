# AgencyTrack — Claude Code Session Kickoff Template

> **How to use this:** Copy the entire block below, fill in the `[BRACKETED]` placeholders for the session, paste into Claude Code. Anything not bracketed stays unchanged across sessions — that's the point.
>
> Keep this file at `docs/kickoff-template.md` in the repo. Update the `[BRACKETED]` content each time, never the structural prose.

---

## Template starts here — copy from this line down

# AgencyTrack Session Kickoff — `[TRACK / TICKET ID]`

## Step 0 — Read these in order, do not skip
1. `CLAUDE.md` — static project rules (code style, domain rules, design system).
2. `docs/CONTEXT.md` — current state, locked decisions, active follow-ups. **CONTEXT.md overrides CLAUDE.md where they differ — it's newer.**
3. Any session-specific docs listed in §Session scope below.

## Step 1 — Tree state verification (do this before anything else)

```bash
git fetch origin
git status
git log origin/main --oneline -3
git worktree list
```

Working tree must be clean. `origin/main` HEAD must match the SHA in `docs/CONTEXT.md` § Current main HEAD. If either fails: STOP, surface in chat, do not absorb the discrepancy.

## Session scope

**In scope:**
- `[ITEM 1]`
- `[ITEM 2]`
- `[ITEM 3]`

**Out of scope (do not expand into):**
- `[ITEM]` — `[REASON]`
- `[ITEM]` — `[REASON]`

**Files / docs Claude Code should read for this session:**
- `[FILE 1]` — `[WHY]`
- `[FILE 2]` — `[WHY]`

## Decisions locked — do not re-litigate

The following are settled. If the audit surfaces a reason to revisit any of these, treat it as a surprise-stop trigger (see Discipline gates below) — do not unilaterally override.

- `[DECISION 1]`
- `[DECISION 2]`
- `[DECISION 3]`

Plus everything in `docs/CONTEXT.md` § Locked decisions.

## What to do first

Choose one — only one — based on session scope:

**Option A — Plan first (default for new tracks):**
> Do not write code yet. Produce a work plan in chat covering:
> 1. Audit current state vs scope (read the files listed above).
> 2. File-by-file change map with risk assessment per file.
> 3. Expected output per stage — for each file in the change map, state the expected post-change state, so drift is detectable when actual ≠ expected at the surprise-stop gate.
> 4. Verification strategy (build, lint, walkthrough, emulator tests as applicable).
> 5. Open questions for me to answer before code starts.
>
> I'll review and approve before any code is written.

**Option B — Implement directly (only when scope is small and unambiguous):**
> Implement per the plan referenced in `[PLAN DOC OR CHAT LINK]`. Use the autonomous mode rules in §Autonomous scope below.

`[PICK A OR B AND DELETE THE OTHER]`

## Autonomous scope — what Claude Code can do without further check-in

`[FILL IN PER SESSION — example below]`

> 1. Create worktree branch off `origin/main` HEAD (verify SHA first).
> 2. Implement changes per the plan.
> 3. `npm run build && npm run lint` — must pass.
> 4. Commit (conventional commits, per CLAUDE.md).
> 5. Push to feature branch.
> 6. Open PR with description covering: scope, file count breakdown, verification plan, open follow-ups, and known gaps (what was not verified / weakest part).
> 7. Wait for Vercel preview Ready via `scripts/wait-vercel-ready.sh <sha> --target preview --pr <PR#>`.
> 8. Run preview walkthrough via `scripts/exploration-walk.cjs --url=<preview> --label=<label>`.
> 9. Post walkthrough summary in PR comments.
> 10. **STOP at preview-verified.** No merge.

## Hard rules — non-negotiable, applies every session

- **Worktree branch only.** Never push directly to `main`. Branch off `origin/main` HEAD.
- **No auto-merge.** Push → PR → preview Ready → walkthrough → STOP for human merge.
- **Post-merge verification:** `git fetch origin && git pull origin main && git log origin/main --oneline -5` to confirm squash SHA, then production walkthrough manually via Vercel dashboard + `scripts/exploration-walk.cjs --url=https://agencytrack.vercel.app --label=<label>_production`. The pull is required so worktree-local tooling matches production — fetch alone leaves the working tree at pre-merge state and verification scripts may run stale.
- **Worktree teardown after merge.** `git worktree remove <path>` then `git worktree prune`.
- **Never echo `.env.local` values** to chat output, PR comments, logs, or screenshots. Reference by env var name only.
- **Verification artifacts stay local.** Logs, screenshots, one-off verification scripts — never commit.

## Discipline gates — surface in chat, do not absorb unilaterally

**Two-strike stop:** If you hit the same kind of unexpected friction twice in a row on this session — two unrelated bugs surface, two retries on the same step — STOP and wait for me, regardless of progress. Counter resets at the start of each new session.

**Surprise-stop:** If anything mid-execution surprises the plan — schema differs from what was audited, additional files surface that weren't in the original scope, a fix is more invasive than analyzed, an architectural decision was made that wasn't in the locked decisions — STOP and write the concern in chat. Do not try to fix unilaterally. Do not absorb the surprise into the plan.

**Audit-on-arrival staleness check.** If Step 0 reading or Step 1 verification reveals state in CLAUDE.md or docs/CONTEXT.md that contradicts actual code (e.g., a "Known Open Item" that's already shipped, a role hierarchy that doesn't match current rules, a referenced file that's been renamed), that's a surprise-stop trigger. Do not proceed past audit until corrected. The fix is its own small docs PR before the planned work begins. This pattern recurred 4-for-4 across Track A PR-1 (CLAUDE.md items 5+6) and the audit immediately after (item 7, role hierarchy, seed-script filename) — assume the docs are stale until proven otherwise.

Both gates are the value of this workflow. They're not friction — they're catching bugs before they ship.

## Stash / pending state from prior sessions

`[FILL IN — example below — read from CONTEXT.md § Pending operational state]`

> - `stash@{0}` (session-handoffs gitignore) — pop and commit alongside this PR if convenient.
> - Empty worktree dir at `.claude/worktrees/sad-meninsky-278312` — cosmetic, ignore.

## Final stop condition

End the session when:
- `[CONDITION 1 — e.g., "PR is open with preview verified, walkthrough posted in PR comments"]`
- `[CONDITION 2 — e.g., "All open questions for me are listed at the end of the plan"]`

Post a summary in chat with: tree state, PR link if applicable, what's done, what's blocked on me, two-strike counter status, and known gaps (per the self-critique gate).

---

## Template ends here

---

## Notes for the human filling this in

- **Session scope** is the most important section — be specific. "Implement user-management PR-1" is good. "Work on user-management" is too vague.
- **Decisions locked** should reference CONTEXT.md instead of duplicating. Only list session-specific overrides here.
- **Files to read** is forcing-function discipline — Claude Code will skip-read CONTEXT.md if you don't make it explicit. List the 2–4 files that materially shape the work.
- **Option A vs Option B** — when in doubt, use A. Plan-first has caught two architectural surprises in this project alone (SEC-9 service consumers, user-management branches schema).
- **Autonomous scope** is the section to tune based on how AFK you'll be. Tighter scope = more check-ins = safer but slower. Wider scope = more done while you're walking, but more risk of stopping on a surprise mid-flight.
