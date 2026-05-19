# PR brief — Rule 17 source-verification sub-bullet

**Sized:** XS (pure docs, single source file + CONTEXT.md)
**Branch:** `docs/rule-17-source-verification-subbullet`
**Type:** Methodology refinement.

## Outcome

Append a sub-bullet to Rule 17 in `CLAUDE.md` formalizing the Phase 1 source-verification pattern that caught four brief-authoring assertion drifts during the 2026-05-19 dispatcher arc. Codifies what was previously informal practice and codifies CC's correct Rule 9 judgment in PR #221.

## Decisions locked

- Motivating catches: PR #217 (CLAUDE.md path), PR #217 (.gitignore scope), PR #219 (AgentReportDocument path), PR #221 (per-token sub-counts)
- Sub-bullet body wording is exact text in Phase 2 — CC must not redraft
- Strikes do NOT accrue for inline verification of unguarded source-derived assertions, nor for Rule 9 scope extension when the corrected detail doesn't change PR surface area / scope / risk
- Rule 17 main body remains unchanged — only a sub-bullet is appended

## Out of scope

- Modifying Rule 17 main body (only adding sub-bullet)
- Modifying any other methodology rules
- Backfilling prior briefs with the verification pattern
- Updating the audit-only dispatch template (separate concern, separate PR if needed)
- `FOLLOW_UPS.md` changes (no FU to close — this is methodology bank, not closure)

## Phase 0 — gate

Standard. STOP on divergence.

## Phase 1 — sanity checks (Rule 17 source-verify)

1. Read `CLAUDE.md` and confirm Rule 17 still exists at its expected position (last numbered methodology rule, currently with body ending near line 538 per CONTEXT.md historical record — re-verify against current state).

2. Identify exact insertion point for the new sub-bullet: after Rule 17's existing body, before the next rule heading or `---` separator. Surface the line number.

3. Confirm `CLAUDE.md` has NO existing sub-bullet under Rule 17 with a similar heading. Grep:
Select-String -Path CLAUDE.md -Pattern "Source-verification sub-bullet|paired Phase 1 verification command|source-derived claims"
   Expected: zero matches.

4. Confirm the four motivating PRs and their squash SHAs are accurate:
   - PR #217: `d84a752`
   - PR #219: `0b3f058`
   - PR #221: `e074b50`
   Verify via `git log origin/main --oneline | Select-String "(#217|#219|#221)"`. If any SHA mismatches, STOP and wait for dispatcher.

If any premise has shifted: STOP and wait for dispatcher.

## Phase 2 — edits

### Edit 1 — Append sub-bullet to Rule 17 in `CLAUDE.md`

Insert at the line identified in Phase 1 step 2. Match the formatting style of surrounding rule content (heading depth, blank lines, banking-trailer convention).

Use this exact body (CC must NOT rewrite the wording):

```markdown
**Source-verification sub-bullet: paired Phase 1 commands for source-derived claims.**

Brief authoring frequently makes assertions about source state beyond mere file existence — file paths in specific directories, grep counts, line numbers, gitignore reachability, per-token sub-counts. Each such source-derived claim must be paired with a Phase 1 verification command that CC can execute against current source, not just asserted in the brief body.

Common patterns:

- File paths in specific directories: `git ls-files | Select-String "<filename>"` (catches wrong-directory assertions)
- Grep counts: `git grep -c "<pattern>"` (catches drift from prior audit)
- Gitignore reachability when adding new file paths: `git check-ignore -v "<path>"` (catches negation-pattern gaps when introducing files into ignored parent directories)
- Per-token / per-rule sub-counts: explicit grep with token isolation (catches commit-message-template drift)

If a brief asserts a source-derived fact without a paired Phase 1 verification command, CC may verify inline as part of Phase 1 before relying on it. Strikes do NOT accrue for inline verification of unguarded source-derived assertions, nor for inline correction via Rule 9 scope extension when the corrected detail does not change the PR's surface area, scope, or risk profile.

Banked from PR #TBD ({TBD}). Motivating catches: PR #217 (`d84a752`, CLAUDE.md path), PR #217 (`d84a752`, .gitignore scope), PR #219 (`0b3f058`, AgentReportDocument path), PR #221 (`e074b50`, per-token sub-counts).
```

### Edit 2 — Update `docs/CONTEXT.md`

1. Drop oldest row in Recently-shipped table.
2. Add new row at top with `#TBD` / `{TBD}` placeholders. Description: "Rule 17 source-verification sub-bullet — formalizes Phase 1 paired verification commands for source-derived claims. Banks four-catch pattern from PR #217/#219/#221 cycles. Codifies CC's correct Rule 9 judgment on per-token count handling."
3. Update `Current main HEAD` field to `{TBD}`.
4. Update `Active track` field to "Rule 17 source-verification sub-bullet — docs/rule-17-source-verification-subbullet in flight."
5. Update `Next track` field to "Pending: 7 untracked verification scripts cleanup (audit dispatch next), Resend invite mail/ swap (#215), Resend invite audit log (#215)."
6. Update "Where we left off" prose: 1–2 short paragraphs noting this PR banks the source-verification sub-bullet on Rule 17 after four catches in the 2026-05-19 dispatcher arc; methodology refinement now in effect for future briefs in this session and beyond.

## Phase 3 — verification

1. `npm run lint` → expect clean (no source files touched). If lint surfaces an error, STOP and wait for dispatcher.

2. Markdown structural check on `CLAUDE.md`: confirm Rule 17's sub-bullet structure is preserved, no stray heading levels introduced, banking-trailer renders correctly.

3. Confirm the new sub-bullet appears within Rule 17's body (between Rule 17 heading and the next rule/separator):
Select-String -Path CLAUDE.md -Pattern "Source-verification sub-bullet" -Context 2,2
   Should show Rule 17 context above and below.

## Phase 4 — smoke

**Waived.** Justification: pure docs change to `CLAUDE.md` (methodology rule sub-bullet) + `CONTEXT.md` (state placeholder row). No source code, no Firestore rules, no user-visible surface, no runtime behavior change.

## Phase 5 — commit, push, open PR

1. Fresh branch off Phase 0 SHA: `git checkout -b docs/rule-17-source-verification-subbullet` (Rule 1).
2. Stage `CLAUDE.md` + `docs/CONTEXT.md`.
3. Commit message:
docs(methodology): Rule 17 source-verification sub-bullet
Formalizes Phase 1 paired-verification pattern for source-derived brief
assertions (file paths, grep counts, line numbers, gitignore reachability,
per-token sub-counts).
Motivating catches across the 2026-05-19 dispatcher arc:

PR #217 (d84a752): wrong CLAUDE.md path (docs/CLAUDE.md vs CLAUDE.md root)
PR #217 (d84a752): wrong .gitignore pattern scope (.claude/commands literal
vs .claude/ broader directory exclusion)
PR #219 (0b3f058): wrong AgentReportDocument.jsx path (components/reports/
vs components/profile/)
PR #221 (e074b50): per-token sub-counts inverted in commit message template
(total count and structural shape correct, sub-counts wrong)

Codifies CC's correct Rule 9 judgment in PR #221: strikes do not accrue for
inline verification of unguarded source-derived assertions, nor for Rule 9
inline corrections when the detail doesn't change PR surface area / scope /
risk.
Smoke waived: pure docs change, no runtime surface.

4. Push: `git push -u origin docs/rule-17-source-verification-subbullet`.
5. Open PR via `gh pr create` or GitHub UI. Title: `docs(methodology): Rule 17 source-verification sub-bullet`.
6. Surface PR URL.

## Phase 6 — held

Standard. Dispatcher invokes `/post-merge <pr-number>` after squash merge. Per documented dual-surface gap at `cb18914`: if CLI shows slash command as "unrecognized" but CC begins executing, that's the expected display behavior — wait for execution.
