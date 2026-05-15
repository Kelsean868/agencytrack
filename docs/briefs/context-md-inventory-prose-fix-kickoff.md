# Kickoff Brief — CONTEXT.md inventory-prose-instability closure (5 drift candidates)

**Type:** Pure docs PR (XS size)
**Shape:** HIGH#6 / PR #160 closure pattern
**Strike count opens at:** 0/2
**Smoke:** Waived (pure docs change to `docs/CONTEXT.md`; no source, no config, no runtime effect)

---

## Audit findings (from inventory-prose-instability audit, 2026-05-16)

CC's audit surfaced 5 drift candidates in CONTEXT.md. Originating context was the L139 verification-script count; the audit found the broader pattern. All 5 candidates ship in one PR (same root cause, same fix shape, shared verification surface).

## Decisions locked

1. **All 5 drift candidates fixed in this PR** — same root cause (count-specific prose), same fix shape (count-agnostic phrasing). Single semantic operation, not split across micro-PRs.
2. **Per-candidate phrasing: Option A** for all 5 candidates (CC's recommended option each time)
3. **L122 header drop + #159 row drop** — restore the 5-row maintenance contract concurrently
4. **L174 maintenance rule stays** — that's the intentional convention, not drift-prone prose
5. **Out of scope:** L139 path duplication (scripts/ vs scripts/verification/), FOLLOW_UPS.md "Worktree + branch audit" FU body re-audit, L17 stable historical snapshot

## Phase 0 — Gate

1. Confirm on `main`, working tree clean. `git fetch origin && git pull origin main`.
2. Create fresh branch off freshly-fetched main: `docs/context-md-inventory-prose-fix`
3. Confirm CLAUDE.md Phase 0 gate checks pass (no uncommitted work, no stale worktree).

## Phase 1 — Re-verify drift targets

For each of the 5 drift candidates, re-verify CONTEXT.md's current prose matches the audit's quotes. The audit was conducted 2026-05-16; minor drift unlikely but possible if other docs commits landed in between.

1. **L122 (approximate):** confirm header reads `## Recently shipped (last 5 PRs)`
2. **L139 area:** confirm top-line bullet `**Untracked legacy docs + scripts** — \`git status\` shows 14 untracked files left over from shipped work:`
3. **L139 sub-counts:** confirm `8 Track-E/PR-D kickoff briefs under \`docs/briefs/\`...` and `5 verification scripts (\`scripts/mgr-mobile-audit.cjs\`...)`
4. **L144 (approximate):** confirm bullet `**6 worktrees + ~15 stale local branches** — all attached to merged feature branches.`

**Hard stops (Rule 12 canonical):**
- If any quoted prose has substantively changed since audit: **STOP and wait for dispatcher**
- If any NEW count-specific prose has appeared since audit (Rule 11 — FU-body re-audit, scoped to CONTEXT.md): **STOP and wait for dispatcher**

## Phase 2 — Apply edits

Apply in this order. Each replacement uses the audit's locked Option A phrasing.

### Edit 1 — L122 header (drift candidate #1)

Replace:
```
## Recently shipped (last 5 PRs)
```
with:
```
## Recently shipped
```

### Edit 2 — L122 table row drop (Q1/Q5 decision)

Locate the table row for PR #159 (oldest row in the current 6-row table). Delete the entire row. After this edit, the table contains 5 rows (#168, #166, #164, #162, #160) — restoring the L174 maintenance contract.

### Edit 3 — L139 top-line (drift candidate #2)

Replace:
```
**Untracked legacy docs + scripts** — `git status` shows 14 untracked files left over from shipped work:
```
with:
```
**Untracked legacy docs + scripts** — `git status` shows untracked files left over from shipped work, across three categories:
```

### Edit 4 — L139 briefs sub-count (drift candidate #3)

Replace:
```
8 Track-E/PR-D kickoff briefs under `docs/briefs/` (all features shipped — E1 #68–#70, E4 #72, E5 #73/#74, E6 daily #71, E6 AOM #76, PR-D #133)
```
with:
```
Track-E/PR-D kickoff briefs under `docs/briefs/` (E1 #68–#70, E4 #72, E5 #73/#74, E6 daily #71, E6 AOM #76, PR-D #133)
```

### Edit 5 — L139 scripts sub-count (drift candidate #4 — canonical instance)

Replace:
```
5 verification scripts (`scripts/mgr-mobile-audit.cjs` from Mobile FU#1 #90, `scripts/verification/pr-d-email-smoke.mjs` from PR-D #133, `scripts/verification/mobile-fu2-tap-targets-smoke.mjs` from Mobile FU#2 #153, `scripts/verification/mobile-fu4-cosmetics-smoke.mjs` from Mobile FU#4 #154, `scripts/verification/border-border-smoke.mjs` from border-border #156)
```
with:
```
verification scripts under `scripts/` and `scripts/verification/` from Mobile FU#1 (#90), PR-D (#133), Mobile FU#2 (#153), Mobile FU#4 (#154), and border-border (#156)
```

### Edit 6 — L144 worktrees bullet (drift candidate #5)

Replace:
```
**6 worktrees + ~15 stale local branches** — all attached to merged feature branches.
```
with:
```
**Worktrees + stale local branches** — multiple worktrees and ~15 stale local branches attached to merged feature branches.
```

## Phase 3 — Verification

1. **Grep checks** — confirm no count-specific patterns remain in target sections:
   - L139 bullet area: `grep -n '\b\(14\|8\|5\)\s\+\(untracked\|verification\|kickoff\|brief\)' docs/CONTEXT.md` returns no matches
   - L144 bullet: `grep -n '\b\d\+\s\+worktrees\?' docs/CONTEXT.md` returns no matches
   - L122 header: `grep -n 'last \d\+ PRs' docs/CONTEXT.md` returns no matches
2. **PR-number spot-check** — confirm enumerated numbers in rewritten prose match `git log --oneline` output:
   - L139 briefs: E1 #68–70, E4 #72, E5 #73/74, E6 #71/76, PR-D #133 — all should exist as merge commits
   - L139 scripts: Mobile FU#1 #90, PR-D #133, Mobile FU#2 #153, Mobile FU#4 #154, border-border #156 — all should exist as merge commits
3. Confirm `git status` shows only `docs/CONTEXT.md` modified.
4. `npm run lint && npm run build` — trivial pass expected (no JS touched).

**Hard stops (Rule 12 canonical):**
- If grep finds residual count-specific prose in target sections: **STOP and wait for dispatcher**
- If PR-number spot-check reveals enumerated numbers don't match git log: **STOP and wait for dispatcher**
- If lint or build fails (should not — docs only): **STOP and wait for dispatcher**

## Phase 4 — Docs (CONTEXT.md self-maintenance)

This PR IS a CONTEXT.md edit, so the recently-shipped row addition + main HEAD update happen in the same file. Per Rule 4 placeholder pattern:

1. Add a new recently-shipped placeholder row at the top of the now-5-row table (this PR becomes the new top row; the previously-dropped #159 makes room — net table size remains 5).
2. Update top-table `Current main HEAD` placeholder (post-merge SHA fill).
3. Per Rule 8, scan Active follow-ups section for stale "PR open"/"in progress" claims; reconcile if found (none expected).

## Phase 5 — Commit, push, PR

1. `git add docs/CONTEXT.md`
2. `git commit -m "docs(CONTEXT): inventory-prose-instability fix — 5 drift candidates rephrased to count-agnostic prose"`
3. `git push -u origin docs/context-md-inventory-prose-fix`
4. Open PR with body containing:
   - Reference to inventory-prose-instability audit (2026-05-16)
   - Summary of 5 edits applied (L122 header + #159 row drop, L139 three sub-edits, L144 worktrees bullet)
   - Note that L174 maintenance rule retained (intentional convention, not drift-prone prose)
   - Note that L17 historical snapshot retained (stable, not drift-prone)
   - **Smoke waiver justification:** "Pure docs change to `docs/CONTEXT.md` only — no source, no config, no rules. Rewrites count-specific prose to count-agnostic phrasing per inventory-prose-instability audit. Lint + build verified."
5. Stop after PR is open. Wait for Kelsean to merge.

---

## Acceptance criteria

- L122 header reads `## Recently shipped` (no count)
- Recently shipped table has exactly 5 rows (oldest #159 dropped, this PR added as new top row placeholder)
- L139 top-line uses "across three categories" phrasing; "14 untracked files" gone
- L139 briefs sub-count: "8 " removed; PR-number enumeration preserved
- L139 scripts sub-count rephrased per Edit 5 (the canonical instance)
- L144 bullet uses "multiple worktrees and ~15 stale local branches" phrasing
- L174 maintenance rule UNCHANGED
- L17 stable historical snapshot UNCHANGED
- All grep checks pass (no residual count-specific prose in target sections)
- PR-number spot-checks pass
- Lint + build clean
- Smoke waiver justified inline in PR body

## Out of scope

- L139 path duplication (`scripts/` vs `scripts/verification/`) — separate concern; not banked as FU unless surfaced again
- FOLLOW_UPS.md "Worktree + branch audit" FU body re-audit — different scope
- L17 historical snapshot — stable convention, not drift-prone
- L20 "0/2" strike counter framing — stable convention
- "Where we left off" narrative (L150–165) — all historical snapshots, stable
- L174 maintenance rule — intentional convention

## Standing rule reminders

- Single-branch PR rule applies (fresh branch off freshly-fetched main, never reuse)
- Phase 0 gate fires as usual
- Smoke waiver allowed for pure docs changes; justification required inline
- Post-merge sequence (Rule 4) runs automatically after Kelsean merges
- All hard stops use canonical Rule 12 phrasing ("STOP and wait for dispatcher") — this is the second brief drafted post-Rule-12-banking, practicing the rule
