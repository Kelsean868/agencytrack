# Methodology batch: Rule 15 + FU-G + FU-H — kickoff brief

**Status:** Methodology PR. Banks one canonical rule (Rule 15: direct-to-main push verification), two new FUs (FU-G operational env vars + FU-H Phase 4 fill scope), and backfills CONTEXT.md stale top-table state surfaced during this PR's own audit.
**Sizing:** S (~1.5–2 hours: 1 rule + 2 FUs + CONTEXT.md backfill + standard docs updates).
**Strike count opens at:** 0/2.
**Methodology queue:** 0 prior to this PR; Rule 15 is itself the queue item being closed.

---

## Context

Today's session (2026-05-17) surfaced **two methodology gaps** in the post-merge placeholder-fill sequence:

1. **Silent push failure mode** — PR #176's post-merge sequence yesterday committed the placeholder fill (`148c15c`) but never reached `origin/main`. The gap was invisible until today's Phase 0 gate of the next PR caught the divergence. Manual verification recovered the state, but only because the dispatcher knew to check.
2. **Phase 4 fill completeness gap** — Even after today's clean PR #178 post-merge sequence, CONTEXT.md's top table (`Current main HEAD`, `Active track`, `Next track`) remains pinned to a pre-#178 state. The placeholder-fill commit only updates `#TBD`/`{TBD}` literals; non-placeholder per-PR state (top table, "Where we left off" prose) gets stale unless the work brief's Phase 4 explicitly mandates the update.

The 2026-05-17 audit-only dispatch confirmed both gaps and locked design judgments for Rule 15. CC's audit also surfaced a **terminology collision** worth recording: many existing briefs use "Rule 4" as shorthand for the post-merge sequence, but canonical CLAUDE.md Rule 4 is the env-listing credential-safety rule (SendGrid leak prevention). The shorthand has no canonical anchor and creates a footgun. Rule 15's text uses canonical anchor language (Session Protocol step 9 + § Post-merge local cleanup); future briefs should follow suit.

Adjacent items this PR also lands:

- **FU-G banking** — PREVIEW_HOST + CLEANUP_ALLOWED_TENANTS + TENANT_ID are operational env vars used heavily in `scripts/verification/**` and `scripts/cleanup/**` but absent from `.env.example`. They belong in script-local READMEs, not the canonical credential doc. Pre-banked at `fu-d-fu-e-env-example-cleanup-kickoff.md:179`.
- **FU-H banking (NEW, methodology)** — Phase 4 fill scope methodology gap (defer rule design to a future methodology PR).
- **CONTEXT.md backfill** — Update stale top-table fields to current state. Demonstrates the gap Rule 15 + FU-H together address.

---

## Phase 0 — Gate

1. Confirm `git status` working tree clean.
2. Confirm current branch is `main`. If not, `git checkout main`.
3. `git fetch origin && git pull origin main`. Confirm main is at the fresh HEAD (this brief's commit PR should already have shipped).
4. **Rule 15 dogfood gate:** After step 3, run `git log origin/main --oneline -1` and `git rev-parse HEAD`. Confirm the SHAs match. This is the verification cadence Rule 15 will codify — practicing it before banking.
5. `git checkout -b chore/methodology-rule-15-fu-g-fu-h` — fresh branch, never reuse.

If Phase 0 fails at any step: **STOP and wait for dispatcher.**

---

## Phase 1 — Re-verify audit findings still hold

1. Re-read `docs/CLAUDE.md` around the Methodology requirements section. Confirm:
   - Section header is at line ~357
   - Lead-in paragraph at line ~359 lists banking dates per rule cohort
   - Rule 14 ends at line ~491
   - `---` separator at line ~493
   - (Line numbers may have shifted slightly since the audit; the structural landmarks are what matter.)
2. Re-confirm CONTEXT.md's stale state. Compare line 16 (`Current main HEAD: <SHA>`) with actual `git log origin/main --oneline -1` output. Expect mismatch (stale).
3. Re-confirm `scripts/verification/README.md` exists and `scripts/cleanup/README.md` does NOT exist. (Latter is created in a later FU-G execution PR, not this one — this PR only banks FU-G.)
4. `git grep -n "process.env.TENANT_ID"` — confirm at least one hit in `scripts/` (validates FU-G's TENANT_ID fold-in).
5. `git grep -n "PREVIEW_HOST"` — confirm hits in `scripts/verification/**`.
6. `git grep -n "CLEANUP_ALLOWED_TENANTS"` — confirm hits in `scripts/cleanup/**`.

If any premise has shifted: **STOP and wait for dispatcher.**

---

## Phase 2 — Edits to `docs/CLAUDE.md`

### Edit 1 — Append Rule 15 after Rule 14, before `---` separator

Insert this block. Match the formatting style of existing rules (heading level, blank lines between body paragraphs, banking-date trailer).

```markdown
### 15. Direct-to-main pushes require origin verification

For any commit that lands on `main` outside the squash-merge-PR path — including the post-merge placeholder-fill commit (per Session Protocol step 9 and § Post-merge local cleanup), authorized hotfixes, and any other dispatcher-authorized direct push — CC MUST run `git fetch origin && git log origin/main --oneline -1` immediately after the push, and confirm the SHA matches `git rev-parse HEAD` on local `main`.

If the SHA does not match: the push has not reached origin. **STOP and wait for dispatcher** — do not retry, do not amend, do not exit the sequence. Push-failure modes are non-obvious (auth re-prompt, upstream rejection, network blip, malformed commit) and each warrants dispatcher review rather than autonomous retry.

CC's sequence summary MUST include an explicit line stating the commit was pushed to `origin/main` and the verification SHA matched. "Committed" alone is not equivalent to "pushed and verified" — the verification step is not complete until both have been confirmed in the report.

Why: on 2026-05-17 a silent push failure from the previous day's post-merge sequence was caught only when the next PR's Phase 0 gate detected a divergence between local `main` and `origin/main`. PR #176's placeholder-fill commit (`148c15c`) had been committed locally but never reached origin; the failure was invisible because the post-merge summary described the commit without claiming verification. Same shape as the "preview verified + merged via UI is not proof of shipping" learning already in memory: execution reports don't equal verification.

Note on terminology: This rule anchors to canonical CLAUDE.md sections (Session Protocol step 9 + § Post-merge local cleanup), not to "Rule 4." Some prior briefs use "Rule 4" as shorthand for the post-merge placeholder-fill sequence; that shorthand collides with canonical Rule 4 (env-listing credential safety) and should not be carried forward in new briefs.

Banked from session #PR-15-TBD (2026-05-17, methodology batch).
```

Replace `#PR-15-TBD` with `#TBD` literal — the Rule 4 (canonical, env-listing) — wait, scratch that, terminology collision risk. Use `#TBD` as a literal placeholder for the post-merge sequence to fill. Match the placeholder convention used in Rule 14's banking trailer.

### Edit 2 — Update Methodology requirements lead-in paragraph (line ~359)

Currently lists banking dates per rule cohort (rules 1–8 / 9 / 10–13 / 14). Append rule 15's provenance in the same format. Exact phrasing to match existing convention — read the current paragraph and mirror its structure.

### Edit 3 — One-line cross-reference in § Post-merge local cleanup (line ~327–344)

Inside the existing § Post-merge local cleanup subsection in CLAUDE.md, add a single sentence noting that Rule 15 governs the push-verification step for any commit produced by this sequence. Placement: at the end of the subsection, after the existing cleanup steps. Exact wording suggestion (refine to match local style):

> Rule 15 governs the origin-verification step for any commit produced by this sequence.

This closes the cross-reference loop without restating the rule itself.

---

## Phase 3 — Edits to `docs/FOLLOW_UPS.md`

### Edit 4 — Bank FU-G (LOW)

Add under the Active LOW section. Format matches existing LOW FU entries.

```markdown
### FU-G — Document operational env vars in script-local READMEs (LOW)

**Banked from:** 2026-05-17 env-credentials propagation audit Layer 3 (originating PR #178 brief deferred this). 2026-05-17 methodology batch audit confirmed scope.

**Scope:** Three operational env vars are read in `scripts/verification/**` and `scripts/cleanup/**` but absent from `.env.example`. They are orchestration knobs (not credentials or Firebase client config), so they belong in script-local READMEs, not the canonical credential doc.

- **PREVIEW_HOST** — read in ~16 verification smoke/walk scripts in `scripts/verification/**` plus `scripts/verification/lib/walk-helpers.mjs:118`. Existing `scripts/verification/README.md` documents VERCEL_BYPASS_TOKEN + A11Y_AGENT_PASSWORD but not PREVIEW_HOST. Extend the existing Environment requirements section.
- **CLEANUP_ALLOWED_TENANTS** — read in `scripts/cleanup/wipe-test-data-sweep.mjs:90` + `scripts/cleanup/preview-test-data-sweep.mjs:71` + consumer/orchestrator sites in `scripts/verification/pr-f-bulk-test-data-smoke.mjs` and `scripts/verification/shakedown/**`. `scripts/cleanup/README.md` does NOT exist — FU-G creates it.
- **TENANT_ID** — read in cleanup + shakedown scripts; default `tatillife_south` in some scripts. Same shape and same omission as the above two. Folded into FU-G scope at banking time.

**Sub-finding (worth noting in FU-G's execution brief, not blocking):** PREVIEW_HOST consumption is inconsistent — some scripts hardcode the host string (e.g. `e1-slice-2b-walk.mjs:53`, `e2-walk.mjs:48`), others read `process.env.PREVIEW_HOST` with a fallback. Documentation alone won't unify the pattern. Consolidation is out of FU-G's scope; flag in the README that the env var is the preferred path and that the hardcoded sites are pre-existing drift.

**Closure criteria:**
- `scripts/verification/README.md` Environment requirements section gains PREVIEW_HOST entry with example value, fallback behavior, and a one-line note about the hardcoded-host drift.
- `scripts/cleanup/README.md` is created with CLEANUP_ALLOWED_TENANTS + TENANT_ID documentation, abort-guard semantics, and a cross-reference to `docs/runbooks/test-data-lifecycle.md`.
- `.env.example` remains untouched (these are not credential-doc material per Rule 14).

**Severity:** LOW — operationally important but no security or correctness risk; current state works because either env vars are set in operator shells or fallbacks apply.
```

### Edit 5 — Bank FU-H (LOW, methodology)

Add under the Active LOW section. Format matches existing methodology-class FU entries.

```markdown
### FU-H — Phase 4 fill scope methodology (LOW, methodology)

**Banked from:** 2026-05-17 methodology batch audit. Surfaced as the second failure mode adjacent to Rule 15.

**Scope:** The post-merge placeholder-fill sequence currently updates only `#TBD`/`{TBD}` literal placeholders in CONTEXT.md and FOLLOW_UPS.md. Non-placeholder per-PR state in CONTEXT.md — `Current main HEAD`, `Active track`, `Next track`, and the "Where we left off" prose — does NOT get updated unless the work brief's Phase 4 explicitly mandates it. As a result these fields go stale within hours of any PR landing.

Evidence at banking time: even after PR #178's clean post-merge fill (`3e3afc0`), CONTEXT.md's top-table `Current main HEAD` was pinned to a pre-#178 SHA until this methodology PR's Phase 4 backfilled the state.

**Open design question (deferred to FU-H's execution PR):** Resolution options include —
- Amend § Post-merge local cleanup in CLAUDE.md to mandate top-table + "Where we left off" updates as part of every post-merge sequence, regardless of whether the work brief specified them.
- Add a canonical Phase 4 spec section to CLAUDE.md that all work briefs must inherit (so individual briefs don't need to re-specify the fill surface every time).
- Promote the post-merge placeholder-fill sequence to its own numbered canonical rule (resolves both this gap and the "Rule 4 shorthand" terminology drift simultaneously).

**Closure criteria:** Design judgment locked in a future methodology PR; canonical Phase 4 fill scope is unambiguous and enforceable; CONTEXT.md top-table state stays current automatically after every post-merge sequence.

**Severity:** LOW (methodology) — doesn't break shipping, but causes CONTEXT.md drift that erodes the doc's value as an at-a-glance state reference.
```

---

## Phase 4 — Edits to `docs/CONTEXT.md`

### Edit 6 — Backfill stale top-table state (demonstration of FU-H gap)

The top table is currently pinned to a pre-PR-#178 state. Update to reflect:

- **Current main HEAD:** the SHA captured at Phase 0 step 3 (post-pull, post-rule-15-dogfood-verification). This will shift again after this PR merges + Rule 4 fill — that final SHA gets filled via `#TBD`/`{TBD}` placeholder in the recently-shipped row below.
- **Active track:** Update to reflect the current shipping context (methodology batch PR in flight; FU completion arc post-pilot).
- **Next track:** Drop FU-D/E (now resolved). Surface FU-B (MEDIUM, A11Y env var consolidation) as next, with FU-C / FU-G / FU-H / FU-F behind it.

### Edit 7 — Update "Where we left off" section

Currently pinned to PR #176 (FU-A closure). Advance to PR #178 (FU-D + FU-E closure) and note today's session arc: PR #178 shipped clean, Rule 4 silent-push gap caught and recovered, methodology batch banking Rule 15 + FU-G + FU-H as the closing PR of the session.

Keep the section concise — match the existing prose length (1–2 short paragraphs). Don't expand into a session retrospective; that's covered in the recently-shipped table.

### Edit 8 — Recently-shipped table

1. Drop the oldest row (which is now `#170` after PR #178's row landed — confirm at Phase 1 by reading current table state).
2. Add new placeholder row at top:
   ```
   | #TBD | {TBD} | Methodology batch: Rule 15 (push verification) + FU-G/H banking + CONTEXT.md backfill |
   ```
3. Maintain 5-row contract.

---

## Phase 5 — Verification

1. `git diff main -- docs/CLAUDE.md` — sanity-read. Expect: 1 new rule section (~25 lines), 1 lead-in paragraph amendment (1–2 lines), 1 cross-reference sentence in § Post-merge local cleanup (1 line).
2. `git diff main -- docs/FOLLOW_UPS.md` — sanity-read. Expect: 2 new FU sections added under Active LOW (FU-G + FU-H), no other changes.
3. `git diff main -- docs/CONTEXT.md` — sanity-read. Expect: top-table 3-field update, "Where we left off" prose rewrite, recently-shipped 1 row dropped + 1 placeholder added.
4. `git grep -n '### 15\.' docs/CLAUDE.md` — must return exactly one hit (Rule 15 heading).
5. `git grep -n '### FU-G' docs/FOLLOW_UPS.md` — must return exactly one hit.
6. `git grep -n '### FU-H' docs/FOLLOW_UPS.md` — must return exactly one hit.
7. `git grep -n '"Rule 4 sequence"' docs/CLAUDE.md` — must return zero hits (we are NOT introducing this terminology in canonical CLAUDE.md).
8. `npm run lint` — must report 0 problems.
9. `npm run build` — must complete clean.

**Smoke waiver:** Pure docs change. Zero runtime surface. Waiver justified inline in PR body per Rule 9.

If lint regresses, build fails, or any grep check fails: **STOP and wait for dispatcher.**

---

## Phase 6 — Commit, push, open PR

1. `git add docs/CLAUDE.md docs/FOLLOW_UPS.md docs/CONTEXT.md`
2. Commit message:
   ```
   docs(methodology): bank Rule 15 (push verification) + FU-G + FU-H

   Rule 15 codifies the direct-to-main push verification gate surfaced by
   today's recovery of PR #176's silent push failure (148c15c committed
   locally but never reached origin/main). Mandates git fetch + log check
   + explicit "pushed and verified" reporting line, hard-stop on mismatch.

   FU-G banks PREVIEW_HOST + CLEANUP_ALLOWED_TENANTS + TENANT_ID for
   script-local README documentation (operational env vars, not credentials).

   FU-H banks Phase 4 fill scope as a methodology FU — the post-merge
   placeholder-fill sequence currently leaves CONTEXT.md top-table fields
   stale because they don't use #TBD/{TBD} literals. Design judgment
   deferred to a future methodology PR.

   CONTEXT.md top-table state backfilled as a one-time correction
   demonstrating the FU-H gap.

   Smoke waived (pure docs, no runtime surface).
   ```
3. `git push -u origin chore/methodology-rule-15-fu-g-fu-h`
4. **Rule 15 dogfood at push time:** Immediately after the push, run `git fetch origin && git log origin/chore/methodology-rule-15-fu-g-fu-h --oneline -1` and verify the SHA matches local HEAD. This is feature-branch verification (not main), but the same discipline. If mismatch: **STOP and wait for dispatcher.**
5. Open PR via `gh pr create` with title:
   `docs(methodology): bank Rule 15 (push verification) + FU-G + FU-H`
   PR body should reference today's recovery as the originating incident, link to PR #176 + the recovery in PR #178's session, and inline-justify the smoke waiver.
6. **STOP and wait for dispatcher.** Do not merge. Surface the PR URL.

---

## Acceptance criteria

- `docs/CLAUDE.md` gains Rule 15 inserted between Rule 14 and the `---` separator, with the structure described in Edit 1
- CLAUDE.md Methodology requirements lead-in paragraph (line ~359) updated to acknowledge Rule 15's banking
- CLAUDE.md § Post-merge local cleanup gains one-line cross-reference to Rule 15
- Rule 15 text uses canonical anchor language (Session Protocol step 9 + § Post-merge local cleanup); no "Rule 4 sequence" terminology
- `docs/FOLLOW_UPS.md` gains FU-G section under Active LOW (3 vars: PREVIEW_HOST + CLEANUP_ALLOWED_TENANTS + TENANT_ID; closure criteria target both `scripts/verification/README.md` extension AND `scripts/cleanup/README.md` creation)
- `docs/FOLLOW_UPS.md` gains FU-H section under Active LOW (methodology; design judgment deferred)
- `docs/CONTEXT.md` top-table fields (`Current main HEAD`, `Active track`, `Next track`) reflect current state, not stale pre-#178 state
- `docs/CONTEXT.md` "Where we left off" advanced from PR #176 to PR #178 + today's recovery + this methodology batch
- `docs/CONTEXT.md` recently-shipped table at exactly 5 rows; oldest dropped, new placeholder row at top with `#TBD`/`{TBD}` literals
- Lint 0 problems; build clean
- Smoke waiver justified inline in PR body
- No source files modified (only 3 docs files)

---

## Out of scope

- **FU-G execution** — this PR banks FU-G only. The README writes (extend `scripts/verification/README.md`, create `scripts/cleanup/README.md`) happen in a future execution PR, sequenced behind FU-B per the handoff backlog.
- **FU-H execution / design resolution** — banking only. Resolution (whether to amend § Post-merge local cleanup, add a canonical Phase 4 spec, or promote post-merge to its own numbered rule) is deferred to a future methodology PR.
- **Retroactively fixing "Rule 4" shorthand in committed briefs** — impossible (committed history). Self-correct going forward; new briefs use canonical anchor language.
- **PREVIEW_HOST consumption unification** — sub-finding only; flag in FU-G's README content, don't unify in this PR.
- **Promoting the post-merge placeholder-fill sequence to its own canonical numbered rule (Sub-option B from the audit)** — deferred. Considered if shorthand drift continues to surface.

---

## Standing rule reminders

- **Rule 1** (single-branch PR): fresh branch `chore/methodology-rule-15-fu-g-fu-h`, never reuse.
- **Rule 2** (fetch before branching): Phase 0 step 3 enforces.
- **Rule 9** (smoke default): waiver allowed for pure docs changes; justify inline.
- **Rule 10** (briefs commit before dispatch): this brief ships via small docs PR before the work dispatch fires.
- **Rule 11** (FU body re-audit before first work): Phase 1 enforces.
- **Rule 12** (canonical hard-stop): every hard stop in this brief uses the literal phrase **"STOP and wait for dispatcher"**.
- **Rule 14** (`.env.example` as canonical credential doc): drove the FU-G banking decision (operational env vars do NOT belong in `.env.example`).
- **Rule 15 (this PR)** — applies to the post-merge sequence AFTER this PR merges. The post-merge fill commit for this PR will be the first formal Rule 15 dogfood. Manual verification still required from the dispatcher as belt-and-suspenders until the discipline is proven.

---

## Post-merge expectations (Rule 4 placeholder pattern + Rule 15 verification)

After merge, the post-merge placeholder-fill sequence will fill the `#PR-15-TBD` literal in Rule 15's banking trailer (Edit 1), the `#TBD`/`{TBD}` placeholders in CONTEXT.md's recently-shipped row, and any other placeholders introduced by this brief's edits. Per **Rule 15 itself**, CC must then run `git fetch origin && git log origin/main --oneline -1` after the push, confirm the SHA matches local main HEAD, and report the verification explicitly. This will be the first formal application of the rule the PR banks.
