# FU-D + FU-E — .env.example cleanup — kickoff brief

**Status:** Bundled LOW-severity closure PR. Demonstrates CLAUDE.md Rule 14 (.env.example is canonical credential doc) in practice: removes a deprecated stale key and adds an undocumented active key in the same diff.
**Sizing:** XS (~1 hour: sequential edits to .env.example + standard docs updates).
**Strike count opens at:** 0/2.
**Methodology queue:** 0 (this is FU-completion work, not methodology).

---

## Context

Two LOW-severity FUs banked via PR #174 (Rule 14 demonstration arc, from the 2026-05-16 env-credentials propagation audit):

- **FU-D** — `VITE_TENANT_ID` is stale in `.env.example`. SEC-11 closed the tenantId-from-claims migration (PR #16); SEC-9b removed the runtime tenantId setter (PR #139). The `.env.example` block is bait — operators reading it would assume a runtime tenant override exists when none does.
- **FU-E** — `VITE_VALIDATE_KIOSK_TOKEN_URL` is read at `src/lib/kiosk/kioskConfig.js:39` (with a hardcoded prod fallback) but missing from `.env.example`. Fresh-clone onboarding would silently use the prod fallback when a non-default Cloud Functions deployment is intended.

**Audit confirmation (2026-05-17 audit-only dispatch):**

- FU-D grep: zero tracked source readers. All remaining references are docs/history (CLAUDE.md, CONTEXT.md, FOLLOW_UPS.md, docs/briefs/*). Safe to remove.
- FU-E grep: confirmed source read at `src/lib/kiosk/kioskConfig.js:39`, zero hits in `.env.example`. Both premises hold.
- Layer 3 sanity sweep surfaced 4 adjacent findings (A11Y_BRANCH_MANAGER_* pair, PREVIEW_HOST, CLEANUP_ALLOWED_TENANTS). Dispatcher decided: **A11Y_BRANCH_MANAGER_*** belongs to FU-B (already queued, MEDIUM); PREVIEW_HOST and CLEANUP_ALLOWED_TENANTS belong in script-local READMEs, not `.env.example`. Out of scope for this PR. See "Out of scope" below for FU-G banking note.

---

## Phase 0 — Gate

1. Confirm `git status` working tree clean.
2. Confirm current branch is `main`. If not, `git checkout main`.
3. `git fetch origin && git pull origin main`. Confirm main is at the fresh HEAD (brief commit PR should already have shipped).
4. `git checkout -b chore/env-example-fu-d-fu-e-cleanup` — fresh branch, never reuse.

If Phase 0 fails at any step: **STOP and wait for dispatcher.**

---

## Phase 1 — Re-verify audit findings still hold

1. `git grep -n "VITE_TENANT_ID"` — confirm zero hits in `src/`, `functions/`, `scripts/`, `tests/`, `vite.config.*`. Only `.env.example` + docs.
2. `git grep -n "VITE_VALIDATE_KIOSK_TOKEN_URL"` — confirm at least one hit in `src/` (specifically `src/lib/kiosk/kioskConfig.js`) and zero hits in `.env.example`.
3. Read `.env.example` and confirm lines 5–9 still match the audited block (4-line comment header + `VITE_TENANT_ID=`).

If any check fails (source reader appeared, var moved, or premise broke): **STOP and wait for dispatcher.**

---

## Phase 2 — Edits (sequential, two changes to `.env.example`)

### Edit 1 — Remove FU-D block (lines 5–9 inclusive)

Delete this contiguous 5-line block:

```
# VITE_TENANT_ID is BOOTSTRAP-ONLY — read solely at src/context/AuthContext.jsx
# super_admin auto-promotion path. Runtime tenant scoping flows from auth
# claims (claims.tenantId) set server-side by Cloud Functions. Tracked: SEC-11
# (replace bootstrap with an explicit one-time setup script and drop this var).
VITE_TENANT_ID=
```

After deletion, line 4 (section banner `# ── Vite / Firebase client config ───…`) sits directly above the next entry (`VITE_FIREBASE_API_KEY=`). Do not add a replacement comment — the section banner is sufficient context for the entries that follow.

### Edit 2 — Append FU-E section to end of file

After the last line (currently `TEST_AGENT_PASSWORD=`), append a blank line then this new section:

```

# ── Kiosk overrides ───────────────────────────────────────────────────────────
# Optional: override the validateKioskToken Cloud Function endpoint. The kiosk
# config (src/lib/kiosk/kioskConfig.js) falls back to the production endpoint
# when this is unset. Set only when targeting a non-default Cloud Functions
# deployment (e.g., a staging project or local emulator).
VITE_VALIDATE_KIOSK_TOKEN_URL=
```

Match the existing section banner style: `# ── <title> ───…` padded out to ~80 chars with em-dashes. Match the existing comment style: hard-wrap around 78 chars, no trailing periods on the last comment line.

---

## Phase 3 — Verification

1. `git grep -n "VITE_TENANT_ID" -- .env.example` — must return zero hits.
2. `git grep -n "VITE_VALIDATE_KIOSK_TOKEN_URL" -- .env.example` — must return exactly one hit (the new line).
3. `git diff main -- .env.example` — sanity-read the diff. Expect one removal hunk (5 lines) + one addition hunk (7 lines including blank line). Total: −5 / +7.
4. `npm run lint` — must report 0 problems (baseline is 0 per PR #172).
5. `npm run build` — must complete clean.

**Smoke waiver:** Pure docs change to `.env.example`. Zero runtime surface — no source files modified, no Firestore writes, no auth changes. Waiver justified inline in PR body per Rule 9.

If lint regresses or build fails: **STOP and wait for dispatcher.**

---

## Phase 4 — Docs updates (Rule 4 placeholder pattern)

### `docs/CONTEXT.md`

1. In the "Recently shipped" table: drop the oldest row to maintain the 5-row contract.
2. Add a new placeholder row at the top:
   ```
   | #TBD | {TBD} | FU-D + FU-E .env.example cleanup (Rule 14 demonstration) |
   ```
   (Exact column shape matches existing rows — preserve whatever formatting is currently in the table.)
3. Do NOT update "Where we left off" — that's owned by the post-merge Rule 4 sequence.

### `docs/FOLLOW_UPS.md`

Mark both FUs as Resolved using the bank-as-Resolved pattern (same shape as PR #172's SEC-9b residual closure):

**FU-D** — change status from Active to Resolved. Append closure note:

```
**Resolved in PR #TBD** ({TBD}, 2026-05-17). Removed the 5-line VITE_TENANT_ID
block (4-line comment header + var declaration) from .env.example. Audit
(2026-05-17) confirmed zero tracked source readers post-SEC-11/SEC-9b — all
remaining references are docs/history only. Section banner "Vite / Firebase
client config" preserved; next entry (VITE_FIREBASE_API_KEY) sits directly
below.
```

**FU-E** — change status from Active to Resolved. Append closure note:

```
**Resolved in PR #TBD** ({TBD}, 2026-05-17). Added VITE_VALIDATE_KIOSK_TOKEN_URL
to .env.example under a new "Kiosk overrides" section. Comment block explains
the prod-fallback default in src/lib/kiosk/kioskConfig.js and when an operator
should set the override. Fresh-clone onboarding now surfaces the option.
```

Leave `#TBD` / `{TBD}` placeholders as literals — Rule 4 post-merge sequence fills them.

---

## Phase 5 — Commit, push, open PR

1. `git add .env.example docs/CONTEXT.md docs/FOLLOW_UPS.md`
2. Commit message:
   ```
   chore(env): remove stale VITE_TENANT_ID, document VITE_VALIDATE_KIOSK_TOKEN_URL

   Closes FU-D + FU-E (LOW). Demonstrates CLAUDE.md Rule 14: .env.example
   as canonical credential doc — removes a deprecated key with no live reader
   and documents an active key that was previously undocumented.

   - Remove VITE_TENANT_ID block (5 lines): post-SEC-11/SEC-9b, no tracked
     source reader exists. Audit 2026-05-17 confirmed.
   - Add VITE_VALIDATE_KIOSK_TOKEN_URL under new "Kiosk overrides" section:
     read at src/lib/kiosk/kioskConfig.js:39 with prod fallback.

   No runtime surface. Smoke waived (pure docs change to .env.example).
   ```
3. `git push -u origin chore/env-example-fu-d-fu-e-cleanup`
4. Open PR via `gh pr create` with title:
   `chore(env): remove stale VITE_TENANT_ID + document VITE_VALIDATE_KIOSK_TOKEN_URL`
   Body should reference FU-D + FU-E closures, the 2026-05-17 audit, and inline-justify the smoke waiver.
5. **STOP and wait for dispatcher.** Do not merge. Surface the PR URL for Kelsean's review.

---

## Acceptance criteria

- `.env.example` lines 5–9 (the VITE_TENANT_ID block) removed in full
- `.env.example` gains a new "Kiosk overrides" section appended after Admin script credentials, containing `VITE_VALIDATE_KIOSK_TOKEN_URL=` with a 4-line comment block
- Section banners match existing style (em-dash padding, ~80 chars)
- `git grep -n "VITE_TENANT_ID" -- .env.example` returns zero hits
- `git grep -n "VITE_VALIDATE_KIOSK_TOKEN_URL" -- .env.example` returns one hit
- `docs/CONTEXT.md` Recently shipped table at exactly 5 rows, new placeholder row at top
- `docs/FOLLOW_UPS.md` FU-D and FU-E both marked Resolved with closure notes using `#TBD` / `{TBD}` placeholders
- Lint 0 problems
- Build clean
- Smoke waiver justified inline in PR body
- No source files modified (only `.env.example` + 2 docs files)

---

## Out of scope

- **A11Y_BRANCH_MANAGER_EMAIL / A11Y_BRANCH_MANAGER_PASSWORD documentation** — belongs to FU-B (MEDIUM, queued). FU-B covers naming migration + full 5-role-flavor documentation as one consolidated unit. Partial documentation here would fragment the audit trail.
- **PREVIEW_HOST and CLEANUP_ALLOWED_TENANTS documentation** — these are script orchestration knobs, not credentials/Firebase config. They belong in script-local READMEs, not `.env.example`. Bank as **FU-G (LOW): document operational env vars in script-local READMEs** in a future banking pass (not this PR).
- **CLAUDE.md Rule 14 count re-baselining** — Rule 14 banking note says "5 A11Y role keys, only 2 documented" but current state is 4 documented + 2 missing = 6 total. Slight count drift. FU-B brief should re-baseline when it ships; not a blocker now.
- **Layer 3 broader undocumented-env-var sweep beyond what's already surfaced** — out of scope for this PR. The XS bundle is the goal.

---

## Standing rule reminders

- **Rule 1** (single-branch PR): fresh branch `chore/env-example-fu-d-fu-e-cleanup`, never reuse.
- **Rule 2** (fetch before branching): Phase 0 step 3 enforces.
- **Rule 4** (post-merge sequence): runs automatically after Kelsean merges. CC fills `#TBD` / `{TBD}` placeholders in CONTEXT.md and FOLLOW_UPS.md from the squash SHA.
- **Rule 9** (smoke default): waiver allowed for pure docs changes; justify inline.
- **Rule 10** (briefs commit before dispatch): this brief ships via small docs PR before the work dispatch fires.
- **Rule 11** (FU body re-audit before first work): Phase 1 enforces.
- **Rule 12** (canonical hard-stop): every hard stop in this brief uses the literal phrase **"STOP and wait for dispatcher"**.
- **Rule 14** (`.env.example` as canonical credential doc): this PR is the demonstration arc — practice what the rule preaches.
