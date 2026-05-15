# Kickoff Brief — CLAUDE.md Rule 14 + bank 5 FUs from credential-propagation audit

**Type:** Pure docs PR (S size)
**Shape:** HIGH#6 / PR #160 closure pattern
**Strike count opens at:** 0/2
**Smoke:** Waived (pure docs change to `docs/CLAUDE.md` + `docs/FOLLOW_UPS.md` + `docs/CONTEXT.md`; sets policy + banks FUs, no runtime effect)

---

## Audit findings (from env-credentials propagation audit, 2026-05-16)

CC's audit surfaced 1 methodology rule candidate + 6 follow-up items (1 HIGH + 2 MEDIUM + 3 LOW). FU-A ships separately in PR B (bank-as-Resolved); the remaining 5 FUs are banked Active in this PR for future treatment.

## Decisions locked

1. **Rule 14: standalone, not folded into Rule 4** — Rule 4 is echo-prevention (regex); Rule 14 is doc-sync (env.example currency). Different concerns
2. **5 FUs banked as Active** (FU-B through FU-F) — FU-A handled separately in PR B (no ordering dependency between PR A and PR B)
3. **Rule 14 applies forward only** — no backfilling existing scripts/docs
4. **Methodology queue closes** — queue 1 → 0 after this PR ships

## Phase 0 — Gate

1. Confirm on `main`, working tree clean. `git fetch origin && git pull origin main`.
2. Create fresh branch off freshly-fetched main: `docs/claude-md-rule-14-plus-fu-banking`
3. Confirm CLAUDE.md Phase 0 gate checks pass.

## Phase 1 — Locate sources & verify state

1. Read `docs/CLAUDE.md`. Confirm:
   - `## Methodology requirements` section exists with `### 10.` through `### 13.` (from PR #168)
   - Header comment line currently includes "rules 10-13 added 2026-05-15"
2. Read `docs/FOLLOW_UPS.md`. Confirm Active section structure and identify insertion point.
3. Read `docs/CONTEXT.md`. Confirm Recently shipped table state and top-table line numbers.

**Hard stops (Rule 12 canonical):**
- If any quoted section text has drifted from audit surface: **STOP and wait for dispatcher**

## Phase 2 — Apply edits

### Edit 1 — CLAUDE.md: update Methodology header comment

Replace the existing header comment with one that includes rule 14:

```
(originally 8 from pilot prep 2026-05-14; rule 9 added 2026-05-15 from FU#4 → border-border arc; rules 10–13 added 2026-05-15 from CLAUDE.md methodology batch — firestore-indexes + brief-discipline arc; rule 14 added 2026-05-16 from env-credentials propagation audit closure)
```

### Edit 2 — CLAUDE.md: append Rule 14

Append after Rule 13 in `## Methodology requirements`:

```
### 14. .env.example is canonical credential documentation

Every `process.env.X`, `import.meta.env.X`, or post-`loadEnv` env read site must reference a key documented in `.env.example`. When a new credential is introduced:

- Add the key + a one-line purpose comment to `.env.example` in the same PR as the first read site.
- If the credential is deprecated, REMOVE it from `.env.example` in the same PR as the reader removal. Do NOT leave deprecated keys with explanatory comments — they accumulate as bait.

Why: drift between `.env.example` and live read sites creates onboarding gaps (new contributors don't know what to set) and stale-bait risk (deprecated vars get re-populated by anyone copying the template). Surfaced via 2026-05-16 credential propagation audit: 5 A11Y role keys actively read, only 2 documented; `VITE_TENANT_ID` documented as deprecated but post-SEC-11 has no live reader.

How to apply: Before opening a PR that adds or removes a credential read site, grep `.env.example` for the key name. If new, add it. If the last reader was removed, delete the entry. Brief Phase 1 audits for any work touching credential-reading scripts MUST scan both `.env.example` and live `process.env.X` reads as part of the enumeration.

Banked from PR #XXX (env-credentials propagation audit closure).
```

### Edit 3 — FOLLOW_UPS.md: bank 5 new Active FUs

Append to the Active section. Use the template structure consistent with existing Active FUs.

**FU-B (MEDIUM):**
```
### FU-B: Consolidate A11Y env var naming (MEDIUM, banked 2026-05-16)

**Surface:** Two distinct names for the same logical credential exist. `A11Y_MANAGER_*` (legacy, documented in `.env.example`) and `A11Y_BRANCH_MANAGER_*` (current, used in most scripts). The dual-name fallback at `scripts/verification/e1-slice-2b-walk.mjs:49` is direct evidence of partial migration. Three other role flavors (`A11Y_UNIT_MANAGER_*`, `A11Y_TENANT_ADMIN_*`, `A11Y_PLATFORM_ADMIN_*`) are actively read but not documented in `.env.example`.

**Failure mode:** Contributors copying `.env.example` populate the legacy name; verification scripts using the new name silently fail with "credentials not found."

**Fix shape:**
1. Pick canonical name: `A11Y_BRANCH_MANAGER_*` (more widely used)
2. Retire `A11Y_MANAGER_*` everywhere
3. Update `.env.example` to list all 5 role flavors (agent, unit_manager, branch_manager, tenant_admin, platform_admin) with consistent naming
4. Remove the dual-name fallback at `e1-slice-2b-walk.mjs:49` once migration completes

**Touch surface:** ~10 files, mostly env-name find-replace.

**Surfaced from:** Section 3 Drift #1 of env-credentials propagation audit (2026-05-16).
```

**FU-C (MEDIUM):**
```
### FU-C: Remove tracked historical super_admin scripts (MEDIUM, banked 2026-05-16)

**Surface:** `functions/set-super-admin.cjs` and `functions/seed-super-admin-user.cjs` are tracked in git despite being listed in `.gitignore:27-28`. The `super_admin` role was retired in PR-3; these scripts are vestigial. `functions/seed-super-admin-user.cjs:30` also writes Kyron's work email literal.

**Failure mode:** CLAUDE.md's "Sensitive Files — Never Commit" section claims "All four are confirmed in `.gitignore`" — true in letter, false in effect (files added before gitignore took effect).

**Fix shape:**
1. **Phase 1 sanity check (mandatory):** grep `src/`, `docs/`, runbooks for any live references to these scripts. If found: STOP and wait for dispatcher.
2. `git rm functions/set-super-admin.cjs functions/seed-super-admin-user.cjs`
3. Update CLAUDE.md "Sensitive Files" section: change "confirmed in `.gitignore`" to "confirmed absent from git tree"

**Surfaced from:** Section 3 Drift #4 + Section 4 Exposure #2/#3 of env-credentials propagation audit (2026-05-16).
```

**FU-D (LOW):**
```
### FU-D: Remove VITE_TENANT_ID from .env.example (LOW, banked 2026-05-16)

**Surface:** `.env.example:5-9` carries a SEC-11 deprecation comment for `VITE_TENANT_ID`. SEC-11 closed in PR #26; no live `import.meta.env.VITE_TENANT_ID` reader exists in `src/`.

**Failure mode:** Var sits as bait — anyone copying the template populates a value nothing reads. Comment is factually wrong post-SEC-11.

**Fix shape:** Remove the var + comment block from `.env.example`. Trivial single-edit.

**Bundle candidate:** can ship with FU-E in one `.env.example` cleanup PR.

**Surfaced from:** Section 3 Drift #2 of env-credentials propagation audit (2026-05-16).
```

**FU-E (LOW):**
```
### FU-E: Document VITE_VALIDATE_KIOSK_TOKEN_URL in .env.example (LOW, banked 2026-05-16)

**Surface:** `src/lib/kiosk/kioskConfig.js:39` reads `VITE_VALIDATE_KIOSK_TOKEN_URL` with a hardcoded production fallback. Not documented in `.env.example`.

**Failure mode:** Knowledge silo — new contributors won't discover this knob exists.

**Fix shape:** Add `VITE_VALIDATE_KIOSK_TOKEN_URL` to `.env.example` with a comment explaining it's optional (defaults to deployed CF endpoint, only set for non-prod kiosk testing).

**Bundle candidate:** can ship with FU-D in one `.env.example` cleanup PR.

**Surfaced from:** Section 3 Drift #3 of env-credentials propagation audit (2026-05-16).
```

**FU-F (LOW, depends on FU-B):**
```
### FU-F: Unify .env.local parsing strategy (LOW, depends on FU-B, banked 2026-05-16)

**Surface:** Two separate `.env.local` parsers exist in the repo. `dotenv` (npm package) used by most scripts. Custom `loadEnv()` in `scripts/verification/shakedown/auth-helpers.mjs:75` — bespoke parser with defensive `[A-Z_][A-Z0-9_]*=` line filter (Rule 4 alignment).

**Risk:** Parser behavior divergence (quote handling, multi-line values, embedded-key detection). Custom parser is stricter; scripts using dotenv get less protection. Low-impact today (no observed mismatch) but a future contributor could write a script using dotenv that trips an edge case the shakedown parser would catch.

**Fix shape:** Extract `loadEnv()` from `shakedown/auth-helpers.mjs` into a shared helper at `scripts/lib/loadEnv.mjs`. Migrate all script readers from `dotenv` to the shared helper.

**Sequencing:** Ship after FU-B (which already touches most A11Y-reading scripts; FU-F can reuse that touch surface).

**Surfaced from:** Section 3 Drift #5 of env-credentials propagation audit (2026-05-16).
```

### Edit 4 — CONTEXT.md: Recently shipped placeholder

Add a placeholder row at top of the Recently shipped table for this PR. Drop oldest to maintain 5-row contract.

## Phase 3 — Verification

1. `npm run lint` — must preserve PR #172's 0-warning baseline.
2. `npm run build` — clean build.
3. Confirm `git status` shows only `docs/CLAUDE.md`, `docs/FOLLOW_UPS.md`, `docs/CONTEXT.md` modified.

**Hard stops (Rule 12 canonical):**
- If lint regresses from 0 problems: **STOP and wait for dispatcher**
- If build fails: **STOP and wait for dispatcher**
- If any non-docs file is modified: **STOP and wait for dispatcher**

## Phase 4 — Docs maintenance (post-edit verification)

This PR IS the docs work. Phase 4 verifies the docs themselves:

1. Confirm Rule 14 wording reads cleanly in context (no markdown parse issues, no broken cross-references)
2. Confirm all 5 FU entries are formatted consistently with existing Active FUs
3. Confirm CONTEXT.md table has exactly 5 rows after addition + oldest drop

## Phase 5 — Commit, push, PR

1. `git add docs/CLAUDE.md docs/FOLLOW_UPS.md docs/CONTEXT.md`
2. `git commit -m "docs: bank Rule 14 (.env.example canonical doc) + 5 new FUs from credential-propagation audit"`
3. `git push -u origin docs/claude-md-rule-14-plus-fu-banking`
4. Open PR with body containing:
   - Reference to env-credentials propagation audit (2026-05-16)
   - Summary: Rule 14 added, 5 FUs banked (FU-B/C MEDIUM, FU-D/E/F LOW)
   - Note that FU-A (HIGH) ships separately in parallel PR
   - **Smoke waiver justification:** "Pure docs change to CLAUDE.md, FOLLOW_UPS.md, and CONTEXT.md. Sets policy + banks FUs for future work. No source, no config, no runtime effect."
5. Stop after PR is open. Wait for Kelsean to merge.

---

## Acceptance criteria

- CLAUDE.md: Rule 14 appended verbatim per Phase 2 wording; header comment updated
- FOLLOW_UPS.md: 5 new Active FUs added (FU-B/C MEDIUM, FU-D/E/F LOW)
- CONTEXT.md: placeholder row added; oldest dropped to maintain 5-row contract
- Lint preserved at 0 problems
- Build clean
- Smoke waiver justified inline

## Out of scope

- FU-A (HIGH) — ships in parallel PR B (no ordering dependency)
- Any code changes
- Any of the FU work itself (this PR banks, doesn't fix)
- Vercel-side env audit (different scope)
- CLAUDE.md "Sensitive Files" section correction (handled in FU-C's eventual PR)

## Standing rule reminders

- Single-branch PR rule
- Phase 0 gate
- Smoke waiver justified inline
- Post-merge sequence (Rule 4) runs automatically
- All hard stops use Rule 12 canonical phrasing
