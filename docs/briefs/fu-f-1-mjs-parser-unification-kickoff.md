# FU-F-1: `.mjs` parser unification — shared `loadEnv` helper + 19 inline-parser migrations

**Type:** Implementation PR (LOW housekeeping, audit-locked)
**Shape:** M, 20-file commit (1 new helper + 19 `.mjs` migrations) plus FOLLOW_UPS.md + CONTEXT.md edits = 22-file Phase 5 diff.
**Reference shape:** Similar to FU-K's implementation PR shape (new script + Phase 4 banks) but voluminous mechanical edits across 19 sibling files.
**Banking origin:** FU-F banked 2026-05-16 (env-credentials propagation audit, FOLLOW_UPS.md:1662–1672). Audit re-run 2026-05-18 (this session) against `40cd5d6` — five architectural decisions re-derived. FU-F body still stale on parser-count + dotenv-prevalence claims (line 1664); Rule 11 corrected-diagnosis preserved in Phase 4a RESOLVED block.

---

## Architectural decisions (locked at brief authoring time, per re-run audit 2026-05-18)

**Decision 1: Helper location** — `scripts/lib/loadEnv.mjs` (new `scripts/lib/` directory).
- Accessible to both `.mjs` walks (`scripts/verification/**`) and future `.cjs` audit scripts.
- Doesn't pollute Playwright-specific `walk-helpers.mjs` (separation of concerns).
- `scripts/verification/shakedown/auth-helpers.mjs` keeps its self-contained `loadEnv` for transitional simplicity (FU-F-1 does NOT touch it or its 6 canonical importers). A future cleanup PR can re-export from the shared helper if migration-cost matters.

**Decision 2: API surface** — `loadEnv(path?)`, pure functional, returns frozen dict, no `process.env` mutation, module-scoped singleton cache per path.
- Optional `path` arg. Default: `resolve(process.cwd(), '.env.local')` when omitted.
- For migrated scripts: prefer **explicit path** via `loadEnv(resolve(__dir, '../../.env.local'))` for invocation-independence.
- Returns `Object.freeze({...})` to prevent downstream mutation.

**Decision 3: Parser semantics** — Strict, no opt-out.
- Filter: `^[A-Z_][A-Z0-9_]*=` (Rule 4 alignment surface).
- Embedded-key detection preserved (TOOLING-N safety from SEC-9 autonomous-run incident).
- Quote-stripping for `"..."` and `'...'` values.
- Comment skipping (`#` prefix) and blank-line skipping.
- Multi-line values NOT supported (matches canonical `auth-helpers.mjs:83–109`).
- Lower-case keys silently dropped (consistent with existing strict behavior — see Out of scope re: `multi-role-smoke.cjs`).

**Decision 4: Migration sequencing** — Two PRs total. **FU-F-1 today: `.mjs` helper + `.mjs` migrations only.** FU-F-2 deferred: `.cjs` sibling helper + `.cjs` migrations.
- FU-F-1 = M bucket (20 file changes today).
- FU-F-2 = S bucket (~6 file changes once `mgr-mobile-audit.cjs` untracked and `multi-role-smoke.cjs` defunct are resolved).
- Audit decisions persist in this chat for FU-F-2 retrieval; can also be re-derived in FU-F-2's own brief authoring per Rule 17.

**Decision 5: `.cjs` interop** — Deferred to FU-F-2. Will ship a `.cjs` sibling helper at `scripts/lib/loadEnv.cjs` (~30 lines, parallel maintenance with cross-reference comment). NOT in FU-F-1's scope.

---

## Source-verified state (at brief authoring time, 2026-05-18)

Confirmed against repo HEAD `40cd5d6` (post-FU-K Phase 6 + FU-H stale-row sweep + FU-H/FU-C closures).

- **FU-F body** at `docs/FOLLOW_UPS.md:1662–1672`. Body still contains original 2026-05-16 framing: "Two separate `.env.local` parsers exist" (line 1664) and "dotenv (npm package) used by most scripts" (line 1664). **Both stale.** Reality verified by audit: 30 inline-parser sites in `scripts/**` (8 distinct shapes, 5 semantic patterns), zero dotenv source consumers. Rule 11 corrected diagnosis lands in Phase 4a RESOLVED block; body itself is NOT amended in-place (drift trail preservation).
- **Canonical strict parser** at `scripts/verification/shakedown/auth-helpers.mjs:75–110`. 6 importers (`high6-ytd-smoke.mjs`, `shakedown/cat02-role-tenant-admin.mjs`, `shakedown/cat02-role-platform-admin.mjs`, `shakedown/cat04-form-validation.mjs`, `shakedown/cat07-a11y.mjs`, `shakedown/cat08-screenshot-dossier.mjs`) + 1 self-call at `auth-helpers.mjs:154`. **Out of FU-F-1 scope** (already on canonical path).
- **30 inline-parser sites** enumerated (23 `.mjs` + 7 `.cjs`). FU-F-1 targets 19 `.mjs` after exclusions (see Scope below). 4 `.mjs` excluded (untracked, separate banked FU). 7 `.cjs` deferred to FU-F-2.
- **`scripts/lib/`** does NOT yet exist (verified). FU-F-1 creates the directory + helper.
- **TOOLING-N references** found in source comments at 3 `.cjs` sites only (`a11y-axe-scan.cjs:38`, `a11y-axe-scan-manager.cjs:38`, `exploration-walk.cjs:57`) — banked justification for embedded-key detection. Zero references in CLAUDE.md / CONTEXT.md / FOLLOW_UPS.md.
- **`functions/**`** zero env-reading consumers. Cloud Functions out of scope.
- **`src/**`** Vite `import.meta.env`, not script-style env loading. Out of scope.
- **FU-B PR #182** (closed 2026-05-17) touched 34 `A11Y_*`-reading scripts. All 19 FU-F-1 migration targets are within FU-B's recent touch surface.

---

## Scope

**FU-F-1 in-scope (19 `.mjs` migrations + 1 new helper):**

Pattern A — rest-args dict-return (16 tracked files):
1. `scripts/verification/e1-slice-2b-walk.mjs`
2. `scripts/verification/e2-walk.mjs`
3. `scripts/verification/e3-persistency-walk.mjs`
4. `scripts/verification/e4-walk.mjs`
5. `scripts/verification/e5-walk.mjs`
6. `scripts/verification/e5-1-walk.mjs`
7. `scripts/verification/e6-aom-walk.mjs`
8. `scripts/verification/e6-walk.mjs`
9. `scripts/verification/fu3-channel-split-smoke.mjs`
10. `scripts/verification/m3-manager-awards-smoke.mjs`
11. `scripts/verification/m4-goals-ia-flatten-smoke.mjs`
12. `scripts/verification/m5-weekly-champions-medals-smoke.mjs`
13. `scripts/verification/polish-1-smoke.mjs`
14. `scripts/verification/polish-2-toast-sweep-smoke.mjs`
15. `scripts/verification/pr4-edit-user-flows-smoke.mjs`
16. `scripts/verification/pr4b-role-branch-edits-smoke.mjs`

Pattern B — single-arg dict-return (2 tracked files):
17. `scripts/verification/bug-n3-smoke.mjs`
18. `scripts/verification/r1-saved-offline-smoke.mjs`

Pattern D — minimal-sanitization induced-failure test (1 tracked file):
19. `scripts/verification/walk-3-induced-failure-test.mjs`

New file:
- `scripts/lib/loadEnv.mjs`

**FU-F-1 out-of-scope (verified at brief authoring time):**

- 5 untracked `.mjs` smokes belong to existing 2026-05-13 banked "Untracked legacy briefs + verification scripts cleanup" FU:
  - `mobile-fu2-tap-targets-smoke.mjs` (Pattern A)
  - `mobile-fu4-cosmetics-smoke.mjs` (Pattern B)
  - `pr-d-email-smoke.mjs` (Pattern B)
  - `border-border-smoke.mjs` (Pattern C — only Pattern C member; Pattern C effectively unhandled in FU-F-1)
  - `high6-ytd-smoke.mjs` (already on canonical path; not a migration target regardless)
- `auth-helpers.mjs` + its 6 importers (already on canonical path).
- All 7 `.cjs` sites (FU-F-2 deferred to later session).
- Cloud Functions, `src/`, tests, seed/migrations/backfill/maintenance/cleanup scripts (verified zero env-loading consumers).

---

## Phase 0 — pre-flight (Rule 9 gate)

1. `git fetch origin`
2. `git checkout main && git pull --ff-only origin main`
3. `git log origin/main --oneline -1` — capture verbatim. Expected: this brief's docs PR squash (per Rule 10).
4. `git checkout -b chore/fu-f-1-mjs-parser-unification`
5. Any failure or drift → **STOP and wait for dispatcher.**

## Phase 0a — FU-F body source-verification documentation (Rule 11)

Quote FU-F body verbatim from `docs/FOLLOW_UPS.md:1662–1672` and document the stale claims for Phase 4a's RESOLVED block:

1. Read FU-F entry. Capture the exact "Surface" paragraph verbatim — note specifically the wording "Two separate `.env.local` parsers" and "dotenv (npm package) used by most scripts."
2. Confirm both claims remain unchanged from banking (no in-place body correction has shipped between banking and brief authoring).
3. The corrected diagnosis (8 parser shapes / 5 semantic patterns / zero dotenv consumers) lands in Phase 4a's RESOLVED closure paragraph per Rule 11's drift-trail principle. Do NOT amend the body in-place during Phase 2.

## Phase 1 — re-verify audit findings

1. Confirm `scripts/lib/` does NOT yet exist: `Test-Path scripts/lib` returns `False`. If it exists → **STOP and wait for dispatcher** (concurrent work may be in flight).
2. Confirm canonical parser at `scripts/verification/shakedown/auth-helpers.mjs:75–110` unchanged from audit capture.
3. Sample-verify 3 Pattern A files (e.g., `e2-walk.mjs`, `polish-1-smoke.mjs`, `m3-manager-awards-smoke.mjs`) — confirm each contains the rest-args `loadEnv` inline definition matching audit Pattern A shape.
4. Sample-verify 1 Pattern B file (`bug-n3-smoke.mjs`) — single-arg shape.
5. Verify `walk-3-induced-failure-test.mjs` minimal-sanitization shape.
6. Re-confirm 5 untracked smokes still in `git status` Untracked Files list. If any has been committed since the audit, **STOP and wait for dispatcher** — scope changes need re-evaluation.
7. Any divergence from audit findings → **STOP and wait for dispatcher.**

## Phase 2 — execute

### 2a. Create `scripts/lib/loadEnv.mjs`

Create directory if needed (`mkdir scripts/lib`). Then create the helper with the following content. Match `auth-helpers.mjs:83–109` parser semantics verbatim per Decision 3.

```javascript
/**
 * Shared `.env.local` parser — FU-F-1.
 *
 * Strict parser preserving the embedded-key detection from `auth-helpers.mjs`
 * (TOOLING-N safety, banked from the SEC-9 autonomous-run incident).
 *
 * USAGE
 *   import { loadEnv } from '<relative-path>/lib/loadEnv.mjs';
 *   const env = loadEnv();                                  // default: cwd/.env.local
 *   const env = loadEnv(resolve(__dir, '../../.env.local')); // explicit path (preferred for scripts)
 *
 * SEMANTICS
 *   - Filter: ^[A-Z_][A-Z0-9_]*= (Rule 4 alignment). Lower-case keys silently dropped.
 *   - Embedded-key detection: if a line's value contains another `[A-Z_]+=` token,
 *     the value is truncated at that token (TOOLING-N defense).
 *   - Quote-stripping: `"..."` and `'...'` wrappers removed.
 *   - Comments (`#`-prefixed lines) and blank lines skipped.
 *   - Multi-line values NOT supported.
 *   - Missing file returns frozen empty object (no throw).
 *
 * RETURNS
 *   Object.freeze({...}) — frozen dict, no `process.env` mutation. Module-scoped
 *   singleton cache keyed by resolved path.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const _cache = new Map();

export function loadEnv(path) {
  const resolved = resolve(path ?? resolve(process.cwd(), '.env.local'));
  if (_cache.has(resolved)) return _cache.get(resolved);

  const env = {};
  if (!existsSync(resolved)) {
    const frozen = Object.freeze(env);
    _cache.set(resolved, frozen);
    return frozen;
  }

  const content = readFileSync(resolved, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2];

    // Embedded-key detection (TOOLING-N)
    const embeddedMatch = value.match(/\s+[A-Z_][A-Z0-9_]*=/);
    if (embeddedMatch) value = value.slice(0, embeddedMatch.index);

    // Quote stripping
    value = value.trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  const frozen = Object.freeze(env);
  _cache.set(resolved, frozen);
  return frozen;
}
```

### 2b. Migrate 19 `.mjs` inline-parser sites

For each of the 19 files in Scope's in-scope list, perform the migration shape below. **All 19 follow this exact mechanical pattern** — confirm via `git diff` after each batch of 4–5 that the diffs are consistent.

**Before (representative Pattern A):**
```javascript
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

function loadEnv(...paths) {
  const env = {};
  // ... 15-25 lines of inline parser body ...
  return env;
}

const env = loadEnv(resolve(__dir, '../../.env.local'));
```

**After:**
```javascript
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from '../lib/loadEnv.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));

const env = loadEnv(resolve(__dir, '../../.env.local'));
```

Mechanical steps per file:
1. Add `import { loadEnv } from '../lib/loadEnv.mjs';` near top (after other imports).
2. Remove the inline `function loadEnv(...) { ... }` definition entirely.
3. Remove the `import { readFileSync } from 'fs';` if it was only used by the inline parser. If used elsewhere in the file, leave intact.
4. Preserve the `__dir` + `fileURLToPath` boilerplate (still needed for the explicit path argument).
5. Verify the `loadEnv(...)` call site at the bottom continues to work — Pattern A's `loadEnv(resolve(__dir, '../../.env.local'))` and Pattern B's `loadEnv(path)` both work with the new helper's `loadEnv(path?)` signature.

**Pattern D special note (walk-3-induced-failure-test.mjs):**
- Per Decision sign-off (Kyron 2026-05-18), migrate normally. Test asserts on `error.message` format, not on inline-parser behavior, so migrating to the shared (strict) helper is semantically equivalent.
- If Phase 1 step 5 reveals the file's test logic actually depends on the minimal-sanitization behavior, **STOP and wait for dispatcher.**

**Per-file batching:** apply migrations in batches of 4–5 files, then `git diff --stat` to confirm consistent shape, then continue. Catch any anomalies early rather than at Phase 3.

## Phase 3 — verify

1. `git diff --stat HEAD` shows exactly 21 changed entries: `A scripts/lib/loadEnv.mjs`, 19 `M scripts/verification/<file>.mjs`, `M docs/FOLLOW_UPS.md`, `M docs/CONTEXT.md`. (Total 22 with the 2 docs files in Phase 4 — but Phase 3 confirms Phase 2 in isolation; rerun this check after Phase 4 as well.)
2. `git diff main..HEAD -- .env.example` returns empty (Rule 14 carve-out).
3. Read `scripts/lib/loadEnv.mjs` end-to-end. Confirm:
   - JSDoc with USAGE, SEMANTICS, RETURNS sections.
   - Strict parser body matches `auth-helpers.mjs:83–109` semantics (embedded-key detection, quote-stripping, comment-skipping, line filter).
   - `Object.freeze` + module-scoped singleton cache.
   - Default path = `resolve(process.cwd(), '.env.local')` when arg omitted.
4. For each migrated file (19 total), `node --check <path>` to verify syntax + import resolution. Capture pass/fail per file. **Any failure → STOP and wait for dispatcher.**
5. Sample-read 3 migrated files end-to-end (e.g., `e2-walk.mjs`, `polish-1-smoke.mjs`, `bug-n3-smoke.mjs`). Confirm:
   - Inline `function loadEnv` removed.
   - `import { loadEnv } from '../lib/loadEnv.mjs';` present near top.
   - `loadEnv(...)` call site preserved with same arguments.
   - Other functionality unchanged.
6. Run `npm run lint`. Expect 0 problems. **Any new lint error → STOP and wait for dispatcher.**
7. Run `npm run build`. Expect clean.

**Smoke waiver justification (per Rule 27):** FU-F-1 is a scripts-only refactor of verification scaffolding. Helper parser is functionally identical to canonical `auth-helpers.mjs` parser (verified mechanically in Phase 3.3). No runtime behavior change to the app. `node --check` on all 19 migrated files (Phase 3.4) verifies import resolution and syntax. Production smoke walk waived; mechanical-refactor + node-check is sufficient.

## Phase 4 — docs placeholder fill + banking (in same commit as Phase 2)

### 4a. FU-F RESOLVED block (with Rule 11 corrected-diagnosis paragraph)

Match FU-G/FU-J/FU-K closure pattern at `docs/FOLLOW_UPS.md` (line ~1694 for FU-G template).

1. Update FU-F heading from:
   ```
   ### FU-F: Unify .env.local parsing strategy (LOW, depends on FU-B, banked 2026-05-16)
   ```
   to:
   ```
   ### FU-F: Unify .env.local parsing strategy (LOW, RESOLVED 2026-05-18 — Part 1 of 2)
   ```
2. Preserve the existing body (Surface, Risk, Fix shape, Sequencing, Surfaced from sections) verbatim — Rule 11 drift trail.
3. Append a new closure paragraph after the existing "Surfaced from" line:

   ```
   **Part 1 resolved in PR #{TBD}** (`{TBD}`, 2026-05-18). Created `scripts/lib/loadEnv.mjs` (strict parser preserving TOOLING-N embedded-key detection, frozen dict return, module-scoped cache, optional path arg with cwd-default). Migrated 19 of 23 `.mjs` inline-parser sites (Pattern A ×16 + Pattern B ×2 + Pattern D ×1; 4 untracked sites excluded per existing 2026-05-13 banked untracked-cleanup FU). FU-B PR #182 sequencing constraint satisfied — all 19 migration targets within FU-B's touch surface. **Rule 11 corrected diagnosis:** FU-F body's "Two separate .env.local parsers" claim was operationally stale; actual landscape at audit time (2026-05-18, repo HEAD `40cd5d6`) was 8 distinct parser shapes consolidating to 5 semantic patterns across 30 inline-parser sites (23 `.mjs` + 7 `.cjs`). FU body's "dotenv (npm package) used by most scripts" claim was also stale; zero dotenv consumers in source (verified). Corrected diagnosis preserved here per Rule 11 drift-trail principle. **Part 2 (FU-F-2)** deferred — `.cjs` sibling helper at `scripts/lib/loadEnv.cjs` + 7 `.cjs` migrations (audit-locked at 2026-05-18; decisions retrievable via this PR's chat context). Second canonical Rule 17 in-the-wild application during brief authoring (after FU-K's `git branch --merged main` mechanism, FU-J PR #194).
   ```

### 4b. Add CONTEXT.md recently-shipped row

Insert at top of CONTEXT.md recently-shipped table:

```
| #{TBD} | `{TBD}` | FU-F-1 `.mjs` parser unification (LOW housekeeping, Part 1 of 2): created `scripts/lib/loadEnv.mjs` (strict, frozen, cached, TOOLING-N embedded-key detection preserved); migrated 19 of 23 `.mjs` inline parsers (Pattern A ×16 + B ×2 + D ×1). 4 untracked `.mjs` excluded per existing 2026-05-13 untracked-cleanup FU. FU-F-2 (`.cjs` sibling + 7 migrations) deferred. Rule 11 corrected-diagnosis preserved in FU-F RESOLVED block. Second canonical Rule 17 in-the-wild application during brief authoring. |
```

Drop oldest row if recently-shipped exceeds 5 entries.

### 4c. Bank FU-L (worktree-attached branch script gap)

Add a NEW FU entry to `docs/FOLLOW_UPS.md` (in the active-FUs section, before existing entries or in chronological order — match the existing structural cadence). Heading + body:

```markdown
### FU-L — `prune-merged-branches.mjs` skip worktree-attached branches (LOW, housekeeping, banked 2026-05-18)

**Surfaced:** dogfood `--execute` run 2026-05-18 (post-FU-K PR #194 + FU-H PR #196 close). Script reported `error: cannot delete branch 'chore/fu-h-stale-row-sweep' used by worktree at 'C:/Projects/AgencyTrack-fu-h-sweep'`. Failed-1 OK-1, exit reflected partial failure cleanly.

**Mechanism:** `git branch -D` refuses to delete branches checked out in ANY worktree (not just current). Script's hard exclusion list covers `main` + current branch only. Worktree attachments invisible to the script.

**Proposed fix:** before classifying `[gone]`-upstream branches into stale list, parse `git worktree list --porcelain` to identify worktree-attached branches; move into skipped list with marker `(attached to worktree at <path>)`. Print operator guidance: use `git worktree remove <path>` to detach before sweeping.

**Rule 17 dogfood signal:** brief authoring (PR #194) mentally simulated the script's first invocation but didn't query `git worktree list` at the simulation step. Second canonical Rule 17 in-the-wild surfacing (after FU-K body's `git branch --merged main` mechanism in PR #194 brief drafting). Source-verification at authoring time would have caught this gap.

**Severity:** LOW. Script reports failure cleanly, doesn't crash; operator can manually `git worktree remove <path>` then re-run.

**Sequencing:** XS work PR. Open opportunistically — could pair with FU-F-2 in same session.
```

### 4d. Bank new defunct-script FU for `multi-role-smoke.cjs`

Add a NEW FU entry to `docs/FOLLOW_UPS.md` (same section as FU-L). Use the next sequential letter (FU-M):

```markdown
### FU-M — `multi-role-smoke.cjs` likely defunct: triage + remove or update (LOW, housekeeping, banked 2026-05-18)

**Surfaced:** FU-F audit re-run 2026-05-18 Section 7 finding #1. The script at `scripts/multi-role-smoke.cjs` reads legacy `Super_admin_login` / `Branch_Manager_login` / `Unit_Manager_login` env vars in non-canonical Title_Case naming, references the retired `super_admin` role (closed in user-mgmt PR-3, PR #28/#29). Not in `.env.example`.

**Failure mode (latent):** script would not execute correctly under current auth model (super_admin role retired post-May-5 refactor). Maintenance dead weight; risks confusion for future contributors.

**Proposed fix:** triage with Kyron — three options:
- (a) Update to canonical `A11Y_*` naming + use non-retired roles (Sales Manager / Branch Manager / Unit Manager / Agent / Tenant Admin).
- (b) Delete the script entirely (preferred if functionality is unused).
- (c) Confirm operational relevance with Kyron first; defer decision.

**Sequencing:** Triage XS, then either delete-PR or update-PR. Out of FU-F-2 scope (audit explicitly excluded). If decision is (b) delete, FU-F-2 `.cjs` migration target drops from 7 → 6.

**Severity:** LOW. Doesn't break shipping; just risks confusion + represents likely-dead code.
```

### 4e. Top-table / "Where we left off" updates are Phase 6 (Rule 16)

Per Rule 16, the post-merge fill cycle handles top-table fields. Do NOT update those in Phase 4.

## Phase 5 — commit, push, open PR

1. `git add scripts/lib/loadEnv.mjs scripts/verification/*.mjs docs/FOLLOW_UPS.md docs/CONTEXT.md`
   (Important: do NOT `git add -A` — the working tree has 14 pre-existing untracked files outside FU-F-1's scope.)
2. Commit message: `chore(scripts): FU-F-1 .mjs parser unification — shared loadEnv helper + 19 migrations`
3. `git push -u origin chore/fu-f-1-mjs-parser-unification`
4. Open PR against main. Title: `chore(scripts): FU-F-1 .mjs parser unification — Part 1 of 2 (FU-F)`. Body must include:
   - Reference to this brief at `docs/briefs/fu-f-1-mjs-parser-unification-kickoff.md`.
   - Reference to FU-F entry in FOLLOW_UPS.md (now RESOLVED 2026-05-18 — Part 1 of 2).
   - Note on Rule 11 corrected-diagnosis preservation: "FU-F body's 'Two separate parsers' and 'dotenv used by most scripts' claims were operationally stale; actual landscape (audit 2026-05-18, repo HEAD `40cd5d6`) was 30 inline-parser sites across 8 distinct shapes. Corrected diagnosis preserved in FU-F RESOLVED closure paragraph."
   - Rule 17 in-the-wild signal: "Second canonical Rule 17 in-the-wild application during brief authoring (after FU-K's `git branch --merged main` mechanism)."
   - Smoke waiver justification (mechanical refactor + node-check verification).
   - Phase 4 banking: FU-L (worktree-attached gap) + FU-M (`multi-role-smoke.cjs` defunct triage).
   - Phase 1 findings: if any divergences caught, list here.
5. Report PR URL + branch HEAD SHA to dispatcher.

## Phase 6 — post-merge cleanup (sixth canonical Rule 16 application)

Standard sequence per Session Protocol step 9 + § Post-merge local cleanup + Rule 16.

1. `git checkout main && git fetch origin && git pull --ff-only origin main`
2. Capture work PR squash SHA: `git log origin/main --oneline -1` — paste verbatim to dispatcher.
3. **Rule 16 fill scope (mandatory):**
   - `docs/CONTEXT.md` recently-shipped row: replace `#{TBD}` and `{TBD}` with actual PR number + squash SHA.
   - `docs/CONTEXT.md` top-table `Current main HEAD` → work PR squash SHA (per Rule 16 — anchors on work-PR squash, NOT fill commit).
   - `docs/CONTEXT.md` top-table `Active track` → "FU-F-1 `.mjs` parser unification shipped (PR #{N}, squash {SHA}). Part 1 of 2 — FU-F-2 (`.cjs` migrations) deferred to later session."
   - `docs/CONTEXT.md` top-table `Next track` → "Session backlog: FU-F-2 (`.cjs` sibling helper + 6 `.cjs` migrations, S-bucket; audit-locked at 2026-05-18); FU-L worktree-attached branch script gap (XS, banked 2026-05-18); FU-M `multi-role-smoke.cjs` defunct triage (XS, banked 2026-05-18); FU-I post-pilot (TENANT_ID parameterization); BEH-1 blocked on slide copy."
   - `docs/CONTEXT.md` top-table `Where we left off` → updated prose covering FU-F-1 ship, Rule 11 corrected-diagnosis story, second Rule 17 in-the-wild application, helper landed at `scripts/lib/loadEnv.mjs`, 19 mechanical migrations.
   - `docs/CONTEXT.md` top-table `Last updated` → ISO date of fill commit.
   - `docs/FOLLOW_UPS.md` FU-F RESOLVED closure paragraph: replace `#{TBD}` and `{TBD}` with actual PR number + squash SHA.
4. `git add docs/CONTEXT.md docs/FOLLOW_UPS.md`
5. Commit: `docs: fill PR #{N} placeholders (FU-F-1 closure) — sixth Rule 16 application`
6. `git push origin main`
7. **Rule 15 verification (mandatory):**
   - `git fetch origin && git log origin/main --oneline -1` — paste verbatim.
   - `git rev-parse HEAD && git rev-parse origin/main` — paste verbatim.
   - Confirm: local HEAD == origin/main, fill commit on top, work PR squash directly below.
   - Report "pushed and verified" with all SHAs visible.
   - Any mismatch → **STOP and wait for dispatcher.** Hard-stop.
8. Worktree cleanup: do NOT run `scripts/maintenance/prune-merged-branches.mjs --execute` during Phase 6. Operator decision after.

---

## Acceptance criteria

- `scripts/lib/loadEnv.mjs` exists with strict parser semantics matching Decision 3 (filter, embedded-key detection, quote-stripping, comment/blank skipping, no multi-line, missing-file safe).
- 19 `.mjs` inline-parser sites migrated to import the shared helper. Pattern of edit consistent across all 19.
- `auth-helpers.mjs` + 6 canonical importers UNCHANGED (out of FU-F-1 scope).
- `git diff main..HEAD --stat` shows 22 changed entries: 1 added (helper), 19 modified `.mjs`, 1 modified FOLLOW_UPS.md, 1 modified CONTEXT.md.
- `git diff main..HEAD -- .env.example` returns empty.
- `node --check` passes on all 19 migrated `.mjs` files.
- `npm run lint` returns 0 problems.
- `npm run build` completes clean.
- FU-F entry in FOLLOW_UPS.md has `RESOLVED 2026-05-18 — Part 1 of 2` heading suffix, banking body preserved verbatim, closure paragraph contains the Rule 11 corrected-diagnosis text.
- FU-L and FU-M entries added to FOLLOW_UPS.md with banked-2026-05-18 status.
- CONTEXT.md recently-shipped table has new row at top.
- Phase 6 post-merge fill executes Rule 16 successfully — all five top-table fields updated + placeholders filled.

## Out of scope

- **5 untracked `.mjs` smokes** (`mobile-fu2-tap-targets-smoke.mjs`, `mobile-fu4-cosmetics-smoke.mjs`, `pr-d-email-smoke.mjs`, `border-border-smoke.mjs`, `high6-ytd-smoke.mjs`) — belong to existing 2026-05-13 banked untracked-cleanup FU. Will be migrated (if/when) by a follow-up after that FU triggers.
- **All 7 `.cjs` sites** — deferred to FU-F-2 (later session). Audit decisions retrievable via this chat.
- **`auth-helpers.mjs` self-contained parser** + 6 canonical importers — out of scope per Decision 1 transitional simplicity.
- **`multi-role-smoke.cjs` triage** — banked as FU-M in Phase 4d. Separate XS triage PR.
- **`mgr-mobile-audit.cjs`** (untracked `.cjs`) — belongs to existing untracked-cleanup FU.
- **Cloud Functions** (`functions/**`) — zero env-loading consumers (verified).
- **`src/**`** — Vite `import.meta.env`, not script-style env loading.
- **`scripts/seed/**`, `scripts/migrations/**`, `scripts/backfill/**`, `scripts/maintenance/**`, `scripts/cleanup/**`** — zero env-loading consumers (verified).
- **Smoke walk** — waived per Phase 3 justification (mechanical refactor + node-check sufficient).

## Rule references

- **Rule 4** — Strict parser semantics align with Rule 4's variable-naming discipline.
- **Rule 9** — Phase 0 git fetch + branch-off-main gate.
- **Rule 10** — Brief commits to `docs/briefs/` via small docs PR BEFORE CC dispatch.
- **Rule 11** — FU-F body's stale claims preserved via corrected-diagnosis paragraph in Phase 4a RESOLVED block. Drift trail intact.
- **Rule 12** — Hard-stop language used throughout.
- **Rule 14** — `.env.example` not touched (Rule 14 carve-out).
- **Rule 15** — Phase 6 step 7 origin verification.
- **Rule 16** — Phase 6 fill scope. Sixth canonical application.
- **Rule 17** — Source-verification at brief-authoring time. Audit re-run 2026-05-18 caught FU-F body staleness BEFORE work began. Five architectural decisions re-derived against current source. Second canonical Rule 17 in-the-wild application (after FU-K body's `git branch --merged main` mechanism in PR #194).
- **Rule 27** — Smoke default waived with justification (mechanical refactor; node-check verifies import resolution; no runtime behavior change).
