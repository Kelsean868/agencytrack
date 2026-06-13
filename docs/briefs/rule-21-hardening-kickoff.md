# Rule 21 Hardening — Kickoff brief

- **Status:** Part A FINAL (timing backstop — implemented this PR). Part B is a laid-out decision + banked follow-up (reviewer replacement), NOT implemented here.
- **Channel:** HUMAN-MERGE + pre-review (touches CLAUDE.md Rule 21).
- **Scope class:** Docs only — `CLAUDE.md` (Rule 21) + `.claude/commands/dispatch.md` + `.claude/commands/post-merge.md`. No app code, rules, or CF.
- **Smoke:** WAIVED per Rule 9 (pure docs). `npm run build && npm run lint` + visual diff stands in.
- **Branch:** docs branch via `/land-brief rule-21-hardening`; then feature-branch off `origin/main` for implementation via `/dispatch`.
- **Rules in force:** Rule 10, Rule 12, Rule 15, Rule 17, Rule 19, Rule 20, Rule 21, Rule 22 (self-critique — now live), Rule 24 (currency — facts below were web-verified 2026-06-13).

## 0. Why
PR #605 merged with **two un-dispositioned Gemini comments**: the bot posted its review ~16 min after PR open, *after* CC's 10-minute pre-merge poll closed. CC correctly reported "absent, proceeding per Rule 21" — but the gate then failed open, because nothing re-checks after the window. Separately, the consumer Gemini Code Assist bot Rule 21 depends on is being sunset (verified: deprecated 2026-06-18 / shut down 2026-07-17; enterprise version unaffected). So Rule 21 needs (A) a timing-robust backstop now, and (B) a reviewer replacement before 2026-07-17.

## Phase 0 — Read order + state verification
Read: `CLAUDE.md` § Methodology Rule 21; `.claude/commands/dispatch.md` § Phase 5 enforcement; `.claude/commands/post-merge.md`.
Verify: `git fetch origin && git status && git log origin/main --oneline -3` — tree clean; HEAD matches CONTEXT § Current main HEAD. Else **STOP** (Rule 12).

## Phase 1 — Audit / findings hard-stop
1. Confirm Rule 21 is still numbered **21** and capture its exact current wording (discipline-gates appended 22–24 after it; confirm no renumber).
2. Confirm `dispatch.md` § Phase 5 enforcement references the "up to 10 min" poll window — capture the exact sentence for amendment.
3. Confirm `post-merge.md` step numbering (the re-poll step inserts before the step-10 summary).

**STOP. Paste findings — Rule 21 number/wording, the dispatch.md poll sentence, post-merge.md step count — back to dispatcher for lock before Phase 2 (Rule 12).**

## Phase 2 — Implement Part A (after Phase 1 lock)
**`CLAUDE.md` Rule 21 — amend, additive (do not rewrite the existing taxonomy):**
- Bump the pre-merge poll to **15 min** (best-effort; the backstop, not the window, is the guarantee).
- Append a backstop clause:
  > **Post-merge backstop.** A pre-merge "absent" is provisional. `/post-merge` re-polls for the Gemini review; any comment that arrived after the pre-merge window is dispositioned in the post-merge report under the same taxonomy — IMPLEMENT → banked as a follow-up (the PR is already merged) · DISAGREE → recorded · OUT-OF-SCOPE → follow-up. The gate is not satisfied by a pre-merge "absent" alone.

**`.claude/commands/dispatch.md` § Phase 5 enforcement — amend:** change the window to 15 min and add "a pre-merge 'absent' is provisional pending the `/post-merge` re-poll (Rule 21 backstop)."

**`.claude/commands/post-merge.md` — add a step** before the step-10 summary:
  > **Re-poll Gemini (Rule 21 backstop).** Check for a gemini-code-assist[bot] review that landed after the pre-merge window. Disposition any not-yet-covered comments as follow-ups under the Rule 21 taxonomy.
  And extend the step-10 summary to report the backstop result.

**Part B is NOT implemented** — see § Part B; bank the follow-up only.

## Phase 3 — Verification
- `npm run build && npm run lint` green.
- Visual diff all three files; confirm Rule 21 is still #21 and the existing taxonomy text is unchanged (additive only).

## Phase 4 — Docs-with-placeholders
- Standard Rule 10 `#{TBD}` trailer only; filled at Phase 6.

## Phase 5 — Commit / push / PR
- `docs:` commit; push feature branch; open PR.
- PR body: scope, file-count breakdown, verification, smoke-waiver justification, open follow-ups (incl. the Part B reviewer-replacement FU), and **known gaps (Rule 22)**.
- Poll Gemini per the *new* Rule 21 (15 min); disposition or note absent.
- **STOP. Do not merge / deploy (Rule 19).** Report PR URL + lint/build + feature-branch HEAD SHA (Rule 20).

## Phase 6 — Post-merge
- `/post-merge <pr#>` — and this is the **first run of the new backstop**: it must re-poll Gemini and disposition any late review on this very PR.

---

## Part B — Reviewer replacement (decision + banked FU, not implemented here)

**Verified facts (2026-06-13, Google docs):** consumer Gemini Code Assist on GitHub — deprecated 2026-06-18 (no new installs), shut down 2026-07-17 (all code review ends). Existing install keeps working until 2026-07-17. Enterprise version unaffected. → ~5 weeks runway; Part A covers the interim.

**Options:**
- **B1 — Enterprise Gemini Code Assist (Google Cloud).** Most drop-in: same bot, same disposition taxonomy. Requires a GCP project (you have one — `agencytrack-2a610`), roles via gcloud (`Service Usage Admin` + `geminicodeassistmanagement.scmConnectionAdmin`), and an SCM connection. **OPEN — must verify first:** the docs emphasize GitHub Enterprise Cloud/Server; confirm it supports a standard github.com personal/public repo (`Kelsean868/agencytrack`) before committing. Possible cost.
- **B2 — Different review bot** (e.g., GitHub Copilot code review — repo is already on GitHub — or CodeRabbit). Independent review; new integration + a different disposition surface.
- **B3 — CC self-disposition for all PRs.** Extend the existing auto-merge-lane self-disposition (already in Rule 21) to every PR. Free, zero external dependency; weaker — the author reviews its own diff, no independent second opinion.

**Recommendation:** make **B3 the always-on floor** so Rule 21 degrades gracefully and never fully fails when a reviewer is down or gone — then add **B1 (if eligibility verifies) or B2** as the independent layer on top. The cost-vs-independence call is yours.

**Banked FU:** *Rule 21 reviewer replacement — choose and install before 2026-07-17. First step: verify B1 eligibility for a github.com personal repo; if no, decide B2 vs. B3-only.*

## Acceptance criteria
- Rule 21 carries the post-merge backstop clause; window value updated; existing taxonomy unchanged.
- `dispatch.md` and `post-merge.md` updated consistently (window + re-poll step).
- Part B reviewer-replacement FU banked in `docs/FOLLOW_UPS.md` / CONTEXT.md.
- Build/lint green; no app code touched.

---

## Known gaps in THIS brief (self-critique — Rule 22)
1. **Enterprise GCA eligibility for a standard github.com repo is UNVERIFIED** — flagged as the first step of the Part B FU, deliberately not resolved here. The B1 recommendation is conditional on it.
2. The **15-min window is a tuning knob, not verified-optimal** — the post-merge backstop is the actual guarantee; the value can be revisited without re-litigating the design.
3. Rule 21's current wording was taken from the file uploaded this session, not re-read from live `origin/main` at authoring — Phase 1 #1 re-confirms.
4. **Part B closes no risk by itself** — it's options-only. The July 17 exposure remains open until a reviewer is chosen; this brief only closes the timing gap (Part A).
