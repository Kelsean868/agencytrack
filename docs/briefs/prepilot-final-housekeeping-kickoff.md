# Pre-pilot final housekeeping — kickoff brief

**Status:** Ready to execute. Final state-cleaning PR before pilot launch.
**Estimated CC effort:** 30–45 minutes (5 minutes docs + 20 minutes walk runs + commit/PR overhead).
**Two-strike counter:** 0/2 (fresh session).

---

## Context

The pre-pilot polish series is complete. Six PRs shipped end-to-end:

- PR #88: Wizard UX + A11y hardening
- PR #90: Mobile FU#1 mgr-mobile
- PR #92: Login logo + UX-N + BUG-N2
- PR #94: Polish-series housekeeping (closed UX-N, BUG-N2, FU#5; added BUG-N3)
- PR #95: WALK-1 walk script hardening (added WALK-2 follow-up to PR description, never to FOLLOW_UPS.md)
- PR #97: BUG-N3 Production Report unit names

Two follow-up entries are now resolved and need closure in `docs/FOLLOW_UPS.md`. One new follow-up (WALK-2) surfaced during PR #95 needs adding to the file (it was only captured in the PR description).

**This PR also serves as the final pre-pilot verification sweep** — runs both hardened walks (now including real write-read-verify cycles per WALK-1) against production to confirm the entire system is in known-good state before onboarding real agents.

**No source code changes. Docs + final verification only.**

---

## Phase 1 — Cleanup + sync + worktree

1. Check for stale worktrees: `git worktree list`. Remove any non-main worktrees with no unique commits (`git worktree remove <path>` then `git branch -D <branch>`). If any has unique commits, surface — don't delete blindly.
2. `git fetch origin --prune`
3. `git checkout main && git pull origin main`
4. Confirm: `git log origin/main --oneline -5`. Top entries should include PR #97 (BUG-N3 fix), PR #95 (WALK-1), and earlier polish PRs.
5. Confirm clean state: `git worktree list` shows only main; `git branch` shows only `main`.
6. Create worktree at `.claude/worktrees/chore-prepilot-final-housekeeping` on branch `chore/prepilot-final-housekeeping`.
7. `cd` into the worktree.

---

## Phase 2 — Run hardened walks against production (final verification sweep)

Both walks were hardened in PR #95 with real write-read-verify cycles. Running them now gives a final clean-state signal before pilot launch.

Run from the main worktree (where `.env.local` lives) with `PREVIEW_HOST` env override pointing at production:

1. **`scripts/verification/e3-persistency-walk.mjs`** — should pass 21/21 (18 original + 09b + 09c + 11b additions).
2. **`scripts/exploration-walk.cjs` for agent role** — should pass 30/30 (29 original + step 26b wizard write-read-verify).

Capture pass counts. Save outputs to a worktree-local gitignored directory. Reference in PR description.

**Gates:**
- Both at expected pass counts (21/21, 30/30) → proceed
- Any check failures → STOP and surface. This would be a real production regression in the final pre-pilot sweep, takes priority over housekeeping.
- Pass rate within 90% (e.g., 19/21 or 27/30) → note specifics in PR description, proceed (likely environmental drift, not regression)

Note: the e3 walk's check 09b/09c writes to the test agent's persistency doc as branch manager. The doc may already exist from prior walks; the cycle re-writes it. This is by design.

---

## Phase 3 — Update `docs/FOLLOW_UPS.md`

1. Read the full current `docs/FOLLOW_UPS.md`. Match the file's existing format conventions.

2. **Close two entries** (reference resolving PRs in whatever style adjacent closed items use):
   - **WALK-1** — resolved by **PR #95** (`feat(walks): harden walk scripts with real write-read-verify cycles + 4 banked lessons`)
   - **BUG-N3** — resolved by **PR #97** (`fix(bug-n3): Production Report — render unit names instead of raw Firestore UIDs`)

3. **Add ONE new entry** at the appropriate priority section in the file:

   - **WALK-2 (LOW, post-pilot)** — Agent self-write path coverage for persistency walks. The persistency lock-by-manager mechanism (PersistencyTab.jsx:77-79, `lockedByManager` flag) makes the agent self-write path unreachable for the canonical test agent (`kelsean@gmail.com`) once a manager doc exists for the current month — which it does, persistently, after PR #94 and PR #95 smokes. The WALK-1 e3-persistency-walk.mjs cycle covers the manager-write + agent-read path (checks 09b/09c/11b), which exercises the full rules + claims + indexes chain. The agent self-write path is currently uncovered by automation. Future work: provision a dedicated smoke-only test agent (e.g., `smoke-agent-1@agencytrack-test.dev`) reserved for write-path verification, never written to via the manager path. Alternative: Admin-SDK-backed pre-cycle state reset. Pilot-launch acceptable; real pilot agents exercise the agent self-write path daily, surfacing any regressions through actual use.

4. Do NOT touch any unrelated entries. No bonus closures, no rephrasing, no reordering. If anything else looks stale, surface in chat — don't fix here.

---

## Phase 4 — Verify, commit, push, PR

1. `git diff docs/FOLLOW_UPS.md` — review. Should be: 2 closures + 1 addition. Nothing else.
2. Markdown sanity check — tables, lists, fenced blocks render cleanly.
3. `npm run lint` → 0 errors (docs-only change, should be untouched).
4. Commit:
   ```
   chore(prepilot): final housekeeping — close WALK-1 + BUG-N3, add WALK-2, final verification sweep
   
   Closures (resolved by recent PRs):
   - WALK-1: walk script hardening with write-read-verify cycles (PR #95)
   - BUG-N3: Production Report unit names rendered correctly (PR #97)
   
   New follow-up added:
   - WALK-2 (LOW, post-pilot): Agent self-write path coverage for persistency walks
   
   Final pre-pilot production verification (hardened walks):
   - e3-persistency-walk.mjs: <X>/21 passing
   - exploration-walk.cjs (agent role): <X>/30 passing
   - All cycles include real Firestore write + hard-reload + read-verify
   
   Pilot launch is unblocked after this lands.
   ```
5. `git push -u origin chore/prepilot-final-housekeeping`
6. Open PR titled: `chore(prepilot): final housekeeping — close WALK-1 + BUG-N3 + add WALK-2 + final verification sweep`
7. PR body MUST include:
   - Summary of closures (2 items by name with resolving PRs)
   - The WALK-2 entry verbatim
   - Both walk results (X/21 and X/30) with brief narrative
   - One-line signal: "Pre-pilot polish series complete. Pilot launch unblocked."
8. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Phase 2 walk failures suggesting production regression → STOP and surface (final-sweep failure takes priority over housekeeping)
- `docs/FOLLOW_UPS.md` diff has more than 1 added entry OR closures of unintended items → STOP and confirm
- Any change needed outside `docs/FOLLOW_UPS.md` and gitignored local files → STOP
- CI gate fails on the PR → STOP and fix before requesting review
- Two strikes hit → STOP

---

## Out of scope

- Any source code changes
- Any rule changes
- Walk script changes (WALK-1 is done; this PR uses the existing helpers)
- Closing follow-ups other than WALK-1 and BUG-N3
- Adding follow-ups other than WALK-2
- Cleaning up the test persistency doc residue from Firestore (Kelsean handles via Console if desired)
- Any pilot-readiness changes (account provisioning, feature toggles — separate concern, not housekeeping scope)
