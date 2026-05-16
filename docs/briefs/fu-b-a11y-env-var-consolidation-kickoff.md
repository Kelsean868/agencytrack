# FU-B — A11Y env var consolidation + Rule 14 banking-note re-baseline — kickoff brief

**Status:** Execution PR for FU-B (MEDIUM, banked PR #174). A11Y_MANAGER_* (legacy ambiguous) → A11Y_BRANCH_MANAGER_* rename across 2 scripts; .env.example expanded from 2 to 6 documented role flavors; Rule 14 banking-note rewritten to pattern-based framing with frozen forensic counts.
**Sizing:** S (26 line edits across 5 files; no logic changes; smoke waived).
**Strike count opens at:** 0/2.
**Audit:** 2026-05-17 FU-B + Rule 14 re-baseline audit (inline dispatch, no docs/briefs/ commit) confirmed scope and surfaced two scope refinements which are locked in this brief.

---

## Context

FU-B was banked via PR #174 (CLAUDE.md Rule 14 banking PR) as MEDIUM — "Consolidate A11Y env var naming (A11Y_MANAGER_* → A11Y_BRANCH_MANAGER_* migration completion; document all 5 role flavors in .env.example)."

The 2026-05-17 audit surfaced two corrections to the originating FU body:

1. **The "5 role flavors" claim was incomplete.** Ground truth at audit time: 7 distinct A11Y_* role flavors actively read in tracked source (AGENT, MANAGER-legacy, UNIT_MANAGER, BRANCH_MANAGER, SALES_MANAGER, TENANT_ADMIN, PLATFORM_ADMIN). After legacy MANAGER rename, the canonical count is 6 role flavors. FU-B body lines 1582 and 1589 both omitted SALES_MANAGER from their enumeration.
2. **The Rule 14 banking-note "5 actively read / 2 documented" count never matched ground truth** under any consistent counting method. The 2026-05-16 audit pass appears to have been rough; today's audit is exhaustive.

Per Rule 11 (FU body re-audit before first work), the corrected diagnosis lands in the FU-B Resolved closure note (Phase 5), not as an in-place edit to the Active body.

Per the methodology batch arc (PR #180), Rule 14's banking note is rewritten in this PR to pattern-based framing — banking notes describe patterns and originating incidents, not snapshot counts that drift on every adjacent FU close. The locked rewrite is in Phase 4 Edit 4.

Touch surface confirmed at audit:

- **2 scripts** carry legacy A11Y_MANAGER_* reads (a11y-axe-scan-manager.cjs primary consumer + e1-slice-2b-walk.mjs fallback-chain consumer)
- **.env.example** documents 2 role flavors of 6; needs 5 new role pairs (10 var declarations) + comment-block refresh + 2-line legacy removal
- **CLAUDE.md** Rule 14 banking note revised
- **CONTEXT.md** placeholder row + top-table backfill (FU-H gap demonstration carries forward from PR #180)
- **FOLLOW_UPS.md** FU-B status flipped Active → Resolved with closure note including corrected diagnosis

---

## Phase 0 — Gate

1. Confirm `git status` working tree clean (note: ~15 pre-existing untracked files are tracked by an Untracked legacy cleanup FU; ignore them — do NOT stage them).
2. Confirm current branch is `main`. If not, `git checkout main`.
3. `git fetch origin && git pull origin main`. Confirm main is at the fresh HEAD.
4. **Rule 15 dogfood gate** (per CLAUDE.md Rule 15 banked in PR #180): Run `git log origin/main --oneline -1` and `git rev-parse HEAD`. Confirm the SHAs match. If they do not match: **STOP and wait for dispatcher.**
5. `git checkout -b chore/fu-b-a11y-env-var-consolidation` — fresh branch, never reuse.

---

## Phase 1 — Re-verify audit findings still hold

1. `git grep -n "A11Y_MANAGER_"` — must surface exactly 2 consumer sites:
   - `scripts/a11y-axe-scan-manager.cjs` (5 hits: docstring + 2 env reads + error message)
   - `scripts/verification/e1-slice-2b-walk.mjs` (fallback chain + docstring + error messages)
   If any additional consumer site has appeared: **STOP and wait for dispatcher.**
2. `git grep -n "A11Y_BRANCH_MANAGER_"` — must surface ~17 consumer sites across scripts/verification/** (canonical name already widespread).
3. `git grep -n "A11Y_SALES_MANAGER_"` — must surface ~6 consumer sites (validates SALES_MANAGER scope addition).
4. Read `.env.example` lines 15–25 and confirm:
   - Lines 22–23 contain `A11Y_MANAGER_EMAIL=` and `A11Y_MANAGER_PASSWORD=` (removal targets)
   - Comment block (lines 15–19) references `a11y-axe-scan.cjs` and `a11y-axe-scan-manager.cjs` specifically
5. Read `CLAUDE.md` line 487 area and confirm the current banking-note text matches the audit's verbatim quote ("Surfaced via 2026-05-16 credential propagation audit: 5 A11Y role keys actively read, only 2 documented; VITE_TENANT_ID documented as deprecated but post-SEC-11 has no live reader.")

If any premise has shifted: **STOP and wait for dispatcher.**

---

## Phase 2 — Script renames (2 files)

### Edit 1 — `scripts/a11y-axe-scan-manager.cjs`

Replace all 5 occurrences of `A11Y_MANAGER_` with `A11Y_BRANCH_MANAGER_`:

- Line ~13 docstring: `A11Y_MANAGER_EMAIL, A11Y_MANAGER_PASSWORD` → `A11Y_BRANCH_MANAGER_EMAIL, A11Y_BRANCH_MANAGER_PASSWORD`
- Lines 71–72 env reads: `process.env.A11Y_MANAGER_EMAIL` → `process.env.A11Y_BRANCH_MANAGER_EMAIL`; same for `_PASSWORD`
- Line ~80 error message: `'Missing A11Y_MANAGER_EMAIL / A11Y_MANAGER_PASSWORD in .env.local'` → `'Missing A11Y_BRANCH_MANAGER_EMAIL / A11Y_BRANCH_MANAGER_PASSWORD in .env.local'`

No logic changes — pure rename. Confirm with `git diff scripts/a11y-axe-scan-manager.cjs` after editing: expect exactly 5 lines changed, all rename-only.

### Edit 2 — `scripts/verification/e1-slice-2b-walk.mjs`

Drop the fallback chain and any A11Y_MANAGER_* references entirely:

- Line ~11 docstring: remove the `A11Y_MANAGER_EMAIL / A11Y_MANAGER_PASSWORD` mention; if the docstring lists both canonical and legacy names, keep only the canonical (`A11Y_BRANCH_MANAGER_EMAIL / A11Y_BRANCH_MANAGER_PASSWORD`).
- Lines 49–50 env reads: simplify `env.A11Y_BRANCH_MANAGER_EMAIL ?? env.A11Y_MANAGER_EMAIL` to `env.A11Y_BRANCH_MANAGER_EMAIL`. Same simplification for `_PASSWORD`.
- Lines 57–58 error messages: `'A11Y_MANAGER_EMAIL not found'` / `'A11Y_MANAGER_PASSWORD not found'` → reference the canonical name.

Confirm with `git diff scripts/verification/e1-slice-2b-walk.mjs` after editing: expect ~6 lines changed, all rename/simplification only, no behavior change.

---

## Phase 3 — `.env.example` updates

### Edit 3 — Remove legacy A11Y_MANAGER_* lines

Delete lines 22 (`A11Y_MANAGER_EMAIL=`) and 23 (`A11Y_MANAGER_PASSWORD=`). Verify the surrounding comment block (lines 15–19) and the next entries (lines 24+) still flow logically after deletion.

### Edit 4 — Add 5 new role pairs

In place of the deleted legacy lines (and possibly extending below), add these 10 declarations in this exact order, matching the existing entry style (`KEY=` with no value):

```
A11Y_UNIT_MANAGER_EMAIL=
A11Y_UNIT_MANAGER_PASSWORD=
A11Y_BRANCH_MANAGER_EMAIL=
A11Y_BRANCH_MANAGER_PASSWORD=
A11Y_SALES_MANAGER_EMAIL=
A11Y_SALES_MANAGER_PASSWORD=
A11Y_TENANT_ADMIN_EMAIL=
A11Y_TENANT_ADMIN_PASSWORD=
A11Y_PLATFORM_ADMIN_EMAIL=
A11Y_PLATFORM_ADMIN_PASSWORD=
```

Role order is bottom-up per the hierarchy (Agent already documented above; Unit Manager → Branch Manager → Sales Manager → Tenant Admin → Platform Admin matches CLAUDE.md § Roles & Permissions ordering).

### Edit 5 — Refresh the A11Y comment block (lines 15–19)

Current text references `a11y-axe-scan.cjs` and `a11y-axe-scan-manager.cjs` specifically and says "Manager account: dedicated branch_manager-tier scan account preferred." That framing is now stale — A11Y_* credentials are consumed broadly across `scripts/verification/**` walks and shakedown harness, not just two named scripts.

Replace with multi-role guidance. Proposed text (refine to match the existing comment-block voice in `.env.example`):

```
# A11Y test credentials — consumed across scripts/verification/** walks and
# shakedown harness. Each role flavor maps 1:1 to the org hierarchy in
# CLAUDE.md § Roles & Permissions. Only set the role flavors you need locally;
# scripts gracefully skip checks when credentials are absent. Agent + Branch
# Manager are the minimum for standard smoke walks.
```

Match the existing comment-block formatting style (em-dash banner padding, ~78 char hard wrap).

---

## Phase 4 — `CLAUDE.md` Rule 14 banking-note rewrite

### Edit 6 — Replace Rule 14 banking note (line ~487)

Locate the current text:
> Surfaced via 2026-05-16 credential propagation audit: 5 A11Y role keys actively read, only 2 documented; VITE_TENANT_ID documented as deprecated but post-SEC-11 has no live reader.

Replace with the locked rewrite (pattern-based, count-frozen at audit time):

> Surfaced via 2026-05-16 env-credentials propagation audit: A11Y_* test credentials for multiple role tiers were partly documented in .env.example, partly drifting in script env reads (later quantified in the 2026-05-17 FU-B audit: 7 role flavors actively read, 2 documented at banking time). VITE_TENANT_ID was documented as deprecated despite having no live reader post-SEC-11. Rule 14 canonicalizes .env.example as the credential doc.

Format the replacement to preserve any surrounding paragraph structure in Rule 14. No other Rule 14 text changes.

---

## Phase 5 — `FOLLOW_UPS.md` FU-B → Resolved

### Edit 7 — Mark FU-B as Resolved with closure note

Flip FU-B's status from Active to Resolved. Append closure note that includes the corrected diagnosis from the audit. Use this closure-note template (refine to match existing Resolved-FU formatting):

```
**Resolved in PR #TBD** ({TBD}, 2026-05-17). A11Y env var naming consolidated:
legacy A11Y_MANAGER_* renamed to A11Y_BRANCH_MANAGER_* across 2 consumer sites
(scripts/a11y-axe-scan-manager.cjs primary + scripts/verification/e1-slice-2b-walk.mjs
fallback chain — simplified, dual-name bridge removed). .env.example expanded from
2 documented A11Y_* role flavors (AGENT + legacy MANAGER) to 6 (AGENT, UNIT_MANAGER,
BRANCH_MANAGER, SALES_MANAGER, TENANT_ADMIN, PLATFORM_ADMIN). CLAUDE.md Rule 14
banking note rewritten to pattern-based framing with the 2026-05-17 audit's frozen
counts (7 role flavors actively read, 2 documented at banking time).

Corrected diagnosis vs the originating FU body: the 2026-05-16 audit's "5 role
flavors actively read, only 2 documented" understated the count. Ground truth at
the 2026-05-17 audit was 7 role flavors (the 5 referenced plus SALES_MANAGER and a
second role flavor not enumerated in the original). FU-B body lines 1582 and 1589
both omitted SALES_MANAGER from the enumeration. Post-rename canonical count is 6
role flavors (no MANAGER-legacy).
```

Leave `#TBD` / `{TBD}` placeholders as literals — post-merge sequence fills them per Rule 15 verification.

---

## Phase 6 — `CONTEXT.md` updates

### Edit 8 — Recently-shipped table

1. Drop the oldest row (which is currently `#172` after PR #180's row landed — confirm at Phase 1 by reading current table state).
2. Add new placeholder row at top:
   ```
   | #TBD | {TBD} | FU-B closure: A11Y env var consolidation + Rule 14 banking-note re-baseline |
   ```
3. Maintain 5-row contract.

### Edit 9 — Top-table backfill (FU-H gap demonstration, same pattern as PR #180)

The top table's `Current main HEAD`, `Active track`, and `Next track` fields go stale on every PR merge because the post-merge sequence only fills `#TBD`/`{TBD}` literals (FU-H methodology gap, banked PR #180). Backfill manually in this PR:

- **Current main HEAD** — set to the SHA captured at Phase 0 step 4 (post-pull, post-Rule-15-dogfood). Will go stale again after this PR merges; that's the FU-H gap.
- **Active track** — update to reflect current shipping context (FU completion arc post-pilot; methodology rule discipline established).
- **Next track** — drop FU-B (now resolved). Surface FU-C (MEDIUM, super_admin script removal) as next, with FU-G execution / FU-F / FU-H design resolution / FU-I behind it.

### Edit 10 — "Where we left off" prose update

Currently pinned to PR #180 (methodology batch). Advance to PR #TBD (FU-B closure) and reflect today's session arc: FU-B execution shipped clean, Rule 14 banking note rewritten to pattern-based framing, dispatcher discipline (memory #30) practiced via Rule 15 dogfoods at Phase 0 and Phase 8.

Keep concise (1–2 short paragraphs). Match existing prose length.

---

## Phase 7 — Verification

1. `git diff main -- scripts/a11y-axe-scan-manager.cjs` — sanity-read. Expect 5 lines changed, all rename.
2. `git diff main -- scripts/verification/e1-slice-2b-walk.mjs` — sanity-read. Expect ~6 lines changed, rename + fallback-chain simplification.
3. `git diff main -- .env.example` — sanity-read. Expect −2 (legacy MANAGER lines) / +10 (5 new role pairs) / comment-block refresh diff.
4. `git diff main -- docs/CLAUDE.md` — sanity-read. Expect 1 paragraph replaced in Rule 14 banking note, no other changes.
5. `git diff main -- docs/FOLLOW_UPS.md` — sanity-read. Expect FU-B section flipped to Resolved with closure note appended.
6. `git diff main -- docs/CONTEXT.md` — sanity-read. Expect top-table 3-field update + "Where we left off" prose rewrite + recently-shipped 1 row dropped + 1 placeholder added.
7. `git grep -n "A11Y_MANAGER_" -- scripts/` — must return zero hits (rename complete). If any hit: **STOP and wait for dispatcher.**
8. `git grep -c "A11Y_MANAGER_EMAIL" .env.example` — must return 0 (legacy removed).
9. `git grep -c "A11Y_BRANCH_MANAGER_EMAIL" .env.example` — must return 1.
10. `git grep -c "A11Y_SALES_MANAGER_EMAIL" .env.example` — must return 1.
11. `git grep -c "A11Y_TENANT_ADMIN_EMAIL" .env.example` — must return 1.
12. `git grep -c "A11Y_PLATFORM_ADMIN_EMAIL" .env.example` — must return 1.
13. `git grep -c "A11Y_UNIT_MANAGER_EMAIL" .env.example` — must return 1.
14. `npm run lint` — must report 0 problems.
15. `npm run build` — must complete clean.

**Smoke waiver:** Pure rename + docs changes. Two scripts touched are dev/CI a11y audit tools with zero production runtime surface. No source files in `src/` or `functions/` modified. Memory #27's smoke default explicitly carves out "changes clearly outside user-visible behavior." Waiver justified inline in PR body.

If lint regresses, build fails, or any grep check fails: **STOP and wait for dispatcher.**

---

## Phase 8 — Commit, push, dogfood, open PR

1. `git add scripts/a11y-axe-scan-manager.cjs scripts/verification/e1-slice-2b-walk.mjs .env.example docs/CLAUDE.md docs/FOLLOW_UPS.md docs/CONTEXT.md`
2. Confirm no untracked files staged inadvertently (the ~15 pre-existing untracked files are NOT this PR's surface).
3. Commit message:
   ```
   chore(a11y): consolidate A11Y env var naming + document all 6 role flavors

   Closes FU-B (MEDIUM). Renames legacy A11Y_MANAGER_* to canonical
   A11Y_BRANCH_MANAGER_* across 2 consumer sites (a11y-axe-scan-manager.cjs
   primary + e1-slice-2b-walk.mjs fallback chain). .env.example expanded
   from 2 documented role flavors to 6 (AGENT, UNIT_MANAGER, BRANCH_MANAGER,
   SALES_MANAGER, TENANT_ADMIN, PLATFORM_ADMIN).

   CLAUDE.md Rule 14 banking note rewritten to pattern-based framing with
   the 2026-05-17 audit's frozen counts. Original note's "5 actively read /
   2 documented" never matched ground truth under any consistent counting
   method; rewrite uses pattern-based framing to prevent recursive staleness
   on every adjacent FU close.

   Operator action required post-merge: rename A11Y_MANAGER_EMAIL /
   _PASSWORD keys in .env.local to A11Y_BRANCH_MANAGER_* (same logical
   credential, just the new name). Optional: add credentials for the 4
   newly-documented role flavors if running multi-role smoke walks locally.

   Smoke waived (rename + docs only, no production runtime surface).
   ```
4. `git push -u origin chore/fu-b-a11y-env-var-consolidation`
5. **Rule 15 dogfood at push time:** Run `git fetch origin && git log origin/chore/fu-b-a11y-env-var-consolidation --oneline -1` and verify the SHA matches local HEAD. Report explicit "pushed to origin/chore/fu-b-a11y-env-var-consolidation, verified" line. If mismatch: **STOP and wait for dispatcher.**
6. Open PR via `gh pr create` with title:
   `chore(a11y): consolidate A11Y env var naming + document all 6 role flavors (FU-B)`
   PR body should reference FU-B closure, the 2026-05-17 audit, the Rule 14 banking-note rewrite rationale, the operator action required, and inline-justify the smoke waiver.
7. **STOP and wait for dispatcher.** Do not merge. Surface the PR URL for Kelsean's review.

---

## Acceptance criteria

- `scripts/a11y-axe-scan-manager.cjs` references `A11Y_BRANCH_MANAGER_*` only (zero `A11Y_MANAGER_*` hits)
- `scripts/verification/e1-slice-2b-walk.mjs` fallback chain removed; canonical name only
- `.env.example` contains exactly 6 A11Y role flavor pairs in role-hierarchy order (Agent already present + 5 new), legacy `A11Y_MANAGER_*` removed
- `.env.example` A11Y comment block refreshed to multi-role guidance
- `CLAUDE.md` Rule 14 banking note replaced with pattern-based, count-frozen wording
- `FOLLOW_UPS.md` FU-B status flipped Active → Resolved with closure note including corrected diagnosis (SALES_MANAGER addition + count correction)
- `CONTEXT.md` top-table 3 fields backfilled, "Where we left off" advanced, recently-shipped 5-row contract maintained with new placeholder at top
- Phase 7 grep checks all pass
- Lint 0 problems, build clean
- Smoke waiver justified inline in PR body
- Operator action required called out explicitly in PR body
- No source files modified (only 2 scripts + .env.example + 3 docs)

---

## Out of scope

- **Compact-login fallback convention in mobile-fu4-cosmetics-smoke.mjs** (Agent_login, Branch_Manager_login). Separate naming drift; flagged in audit Layer 2 but not FU-B's responsibility. Bank as new FU only if dispatcher wants to track.
- **m4/m5 briefs using A11Y_SALES_MANAGER_EMAIL as stand-in for branch_manager** in test guidance. Operational workaround in committed briefs; not a code or env-var issue.
- **A11Y_BASE_URL documentation location.** Already canonical in .env.example. Shape parallel to PREVIEW_HOST is noted but A11Y_BASE_URL stays where it is.
- **15 pre-existing untracked files** in the working tree (old briefs in docs/briefs/, old smoke scripts in scripts/verification/, mgr-mobile-audit.cjs). Covered by separate Untracked legacy cleanup tracking; do NOT stage them in this PR.
- **FU-F (parser unification)** unblocked by FU-B but is its own LOW PR, sequenced after.

---

## Standing rule reminders

- **Rule 1** (single-branch PR): fresh branch `chore/fu-b-a11y-env-var-consolidation`, never reuse.
- **Rule 2** (fetch before branching): Phase 0 step 3 enforces.
- **Rule 9** (smoke default): waiver allowed for changes outside user-visible behavior; justify inline.
- **Rule 11** (FU body re-audit before first work): audit found FU-B body count errors; corrected diagnosis lands in Phase 5 closure note (not as in-place body edit).
- **Rule 12** (canonical hard-stop): every hard stop uses literal phrase **"STOP and wait for dispatcher"**.
- **Rule 14** (`.env.example` as canonical credential doc): this PR demonstrates Rule 14 by completing the A11Y documentation gap that motivated the rule's banking.
- **Rule 15** (push verification): dogfooded at Phase 0 step 4 (pre-branch) and Phase 8 step 5 (post-push). Post-merge sequence will run Rule 15 again on the placeholder-fill commit.

---

## Post-merge expectations

After Kelsean merges, the post-merge placeholder-fill sequence fills:
- `#TBD` / `{TBD}` literals in FOLLOW_UPS.md FU-B closure note
- `#TBD` / `{TBD}` literals in CONTEXT.md recently-shipped row

Per Rule 15, CC must verify the placeholder-fill commit reaches origin/main and report explicitly. Operator (Kelsean) verifies with verbatim `git log origin/main --oneline -3` paste-back per memory #30 dispatcher discipline.

CONTEXT.md top-table fields will go stale again after merge (FU-H gap — banked methodology FU, not in this PR's scope to fix). Future methodology PR resolves FU-H's design judgment.
