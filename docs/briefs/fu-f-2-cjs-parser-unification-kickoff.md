# FU-F-2: `.cjs` parser unification — sibling helper + 5 inline-parser migrations

**Type:** Implementation PR (LOW housekeeping, audit-locked, Part 2 of 2)
**Shape:** S, 9-file commit (1 new `.cjs` helper + 5 `.cjs` migrations + 3 docs files including FU-N banking).
**Reference shape:** Mirrors FU-F-1 (PR #198) but smaller. Audit decisions inherited from FU-F-1; same architectural pattern; CommonJS instead of ES modules.
**Banking origin:** FU-F-2 referenced as "Part 2 of 2" in FU-F-1 PR #198 close. Audit decisions retrievable from this chat (PR #198 brief authoring + FU-F audit re-run). Sequencing constraint resolved via FU-M close (PR #202) which removed `multi-role-smoke.cjs` from migration target population.

---

## Architectural decision (locked — inherited from FU-F-1 / PR #198 audit)

**`.cjs` sibling helper + 5 inline-parser migrations + FU-N banking in Phase 4.** Justification per FU-F-1's locked decisions, applied to CommonJS:

**Decision 1: Helper location** — `scripts/lib/loadEnv.cjs` (sibling to `scripts/lib/loadEnv.mjs` shipped FU-F-1).
- Same `scripts/lib/` home.
- Parallel maintenance with cross-reference comment at the top of both helpers.

**Decision 2: API surface** — `loadEnv(path?)`, identical signature to `.mjs` sibling.
- Pure functional, returns frozen dict, no `process.env` mutation.
- Module-scoped singleton cache per resolved path.
- Default path: `resolve(process.cwd(), '.env.local')` when arg omitted.
- Migrated `.cjs` consumers add explicit `Object.assign(process.env, loadEnv(...))` to preserve the legacy mutation contract (since downstream code reads `process.env.X` directly).

**Decision 3: Parser semantics** — Strict, no opt-out, identical to `.mjs` sibling.
- `^[A-Z_][A-Z0-9_]*=` filter (Rule 4 alignment).
- Embedded-key detection preserved (TOOLING-N safety).
- Pattern H sites GAIN embedded-key detection — safety upgrade (Pattern H scripts previously had only simple parsing; now strict with embedded-key defense). Not a regression.

**Decision 4: Migration sequencing** — All 5 sites in one PR.
- S-bucket scope (5 migrations + 1 new helper). Smaller than FU-F-1 (19 migrations).
- No further sub-PR split needed at this size.

**Decision 5: `.cjs` interop** — `.cjs` sibling helper duplicates parser logic in ~70 lines. Parallel-maintenance cost is bounded; both helpers carry sync-with-sibling comments.

---

## Source-verified state (at brief authoring time, 2026-05-18)

Confirmed against repo HEAD `64df95c` (post-FU-M Phase 6 fill).

- **Audit decisions** retrievable in this chat from FU-F-1 PR #198 brief authoring + FU-F audit re-run (2026-05-18). All five architectural decisions above derive from that audit.
- **`scripts/lib/loadEnv.mjs`** exists (shipped FU-F-1 PR #198) as the `.mjs` canonical. `.cjs` sibling will mirror its semantics.
- **5 `.cjs` migration targets** all tracked, in `scripts/`:
  - Pattern G (3 sites, with embedded-key detection):
    - `scripts/a11y-axe-scan.cjs`
    - `scripts/a11y-axe-scan-manager.cjs`
    - `scripts/exploration-walk.cjs`
  - Pattern H (2 sites, simple mutate-only — multi-role-smoke.cjs removed via FU-M):
    - `scripts/manager-audit-screenshots.cjs`
    - `scripts/manager-audit-screenshots-mobile.cjs`
- **`mgr-mobile-audit.cjs`** UNTRACKED (lives only in working tree, not in `git ls-files` output). Out of FU-F-2 scope per FU-F-1 Decision 4 + existing 2026-05-13 banked untracked-cleanup FU.
- **Auth-helpers.mjs** canonical `.mjs` parser unchanged (out of FU-F arc scope per FU-F-1 Decision 1).
- **Rule 11 corrected diagnosis (preserve):** Dispatcher's FU-M closure paragraph (PR #202, line in FOLLOW_UPS.md FU-M RESOLVED block) claimed "actual tracked `.cjs` count is 6." **Actual is 5.** Arithmetic miscount: audit's 7 minus 1 untracked (`mgr-mobile-audit.cjs`) minus 1 excluded (`multi-role-smoke.cjs`) = 5, not 6. The "6" figure in FU-M closure was wrong by one. This corrected diagnosis lands in FU-F-2 RESOLVED block per Rule 11 drift-trail principle.

---

## Phase 0 — pre-flight (Rule 9 gate)

1. `git fetch origin`
2. `git checkout main && git pull --ff-only origin main`
3. `git log origin/main --oneline -1` — capture verbatim. Expected: this brief's docs PR squash.
4. `git checkout -b chore/fu-f-2-cjs-parser-unification`
5. Any failure or drift → **STOP and wait for dispatcher.**

## Phase 1 — re-verify state (Rule 11 + Rule 17, with `git ls-files` pairing per FU-N anticipated discipline)

1. Confirm `scripts/lib/loadEnv.mjs` exists (canonical `.mjs` sibling from FU-F-1, PR #198):
   ```bash
   git ls-files scripts/lib/loadEnv.mjs
   ```
   Expected: returns the path. If empty → **STOP and wait for dispatcher.**

2. Confirm `scripts/lib/loadEnv.cjs` does NOT yet exist:
   ```bash
   git ls-files scripts/lib/loadEnv.cjs
   Test-Path scripts/lib/loadEnv.cjs
   ```
   Expected: both empty/False. If exists → **STOP and wait for dispatcher.**

3. **`git ls-files` enumeration of all `.cjs` migration targets (FU-N discipline applied):**
   ```bash
   git ls-files 'scripts/*.cjs'
   ```
   Expected output (exactly 5 paths, alphabetized):
   ```
   scripts/a11y-axe-scan-manager.cjs
   scripts/a11y-axe-scan.cjs
   scripts/exploration-walk.cjs
   scripts/manager-audit-screenshots-mobile.cjs
   scripts/manager-audit-screenshots.cjs
   ```
   If any extra `.cjs` path appears (e.g., a new `.cjs` script added since audit, or `multi-role-smoke.cjs` somehow back) → **STOP and wait for dispatcher.**
   If `mgr-mobile-audit.cjs` appears in `git ls-files` output (it should be untracked) → **STOP and wait for dispatcher.**
   If `multi-role-smoke.cjs` appears in `git ls-files` output (it was deleted in FU-M, PR #202) → **STOP and wait for dispatcher.**
   If fewer than 5 expected `.cjs` files appear → **STOP and wait for dispatcher.**

4. Sample-read 1 Pattern G file (`scripts/a11y-axe-scan.cjs`) and 1 Pattern H file (`scripts/manager-audit-screenshots.cjs`) to confirm:
   - Pattern G has `loadDotEnvLocal()` function with embedded-key detection in body.
   - Pattern H has `loadDotEnvLocal()` function without embedded-key detection.
   - Both mutate `process.env` and call the function at module top-level (IIFE or direct call).
   - TOOLING-N comment at top in Pattern G files.
   - If any deviation from audit's pattern characterization → **STOP and wait for dispatcher.**

5. Any divergence from brief's source-verified state → **STOP and wait for dispatcher.**

## Phase 2 — execute

### 2a. Create `scripts/lib/loadEnv.cjs`

Mirror `scripts/lib/loadEnv.mjs` semantics in CommonJS form. Match the JSDoc cadence of `.mjs` sibling.

```javascript
/**
 * Shared `.env.local` parser (CommonJS sibling) — FU-F-2.
 *
 * CommonJS twin of `scripts/lib/loadEnv.mjs` (shipped in FU-F-1, PR #198).
 * Maintain in parallel: if you change one parser, change both.
 *
 * Strict parser preserving the embedded-key detection from `auth-helpers.mjs`
 * (TOOLING-N safety, banked from the SEC-9 autonomous-run incident).
 *
 * USAGE
 *   const { loadEnv } = require('./lib/loadEnv.cjs');
 *   const env = loadEnv();                                            // default: cwd/.env.local
 *   const env = loadEnv(require('path').resolve(__dirname, '../.env.local')); // explicit path
 *
 *   // To preserve legacy process.env-mutation contract:
 *   Object.assign(process.env, loadEnv(/* path */));
 *
 * SEMANTICS (identical to .mjs sibling)
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

const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const _cache = new Map();

function loadEnv(path) {
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

module.exports = { loadEnv };
```

### 2b. Migrate 5 `.cjs` inline-parser sites

**Pattern G (3 sites)** — strict parser already, plus embedded-key detection. Migration replaces inline parser with shared helper; functionality identical.

**Pattern H (2 sites)** — simple parser, gains embedded-key detection as safety upgrade. Same migration shape.

All 5 follow this exact mechanical pattern:

**Before (representative — Pattern G with embedded-key detection):**
```javascript
const fs = require('fs');
const path = require('path');

function loadDotEnvLocal() {
  // ... 20-30 lines of inline parser body ...
  // (Pattern G: includes embedded-key detection comment + logic)
  // (Pattern H: lacks embedded-key detection)
  // Mutates process.env directly
}
loadDotEnvLocal();   // or wrapped in IIFE

// downstream code uses process.env.VAR_NAME directly
```

**After (all 5 files identical shape):**
```javascript
const path = require('path');
const { loadEnv } = require('./lib/loadEnv.cjs');

Object.assign(process.env, loadEnv(path.resolve(__dirname, '../.env.local')));

// downstream code uses process.env.VAR_NAME directly (UNCHANGED)
```

Mechanical steps per file:
1. Add `const { loadEnv } = require('./lib/loadEnv.cjs');` near top (after existing requires).
2. Remove the inline `function loadDotEnvLocal() { ... }` definition entirely (or IIFE form if wrapped).
3. Remove the standalone `loadDotEnvLocal();` invocation line (or IIFE wrapper).
4. Replace with single line: `Object.assign(process.env, loadEnv(path.resolve(__dirname, '../.env.local')));`
5. Keep `const path = require('path');` (needed for `path.resolve`).
6. Remove `const fs = require('fs');` if it was only used by the inline parser. If used elsewhere, leave.
7. For Pattern G files: remove the TOOLING-N comment block (now lives in the shared helper's JSDoc).
8. All other functionality unchanged — downstream code continues to read `process.env.X` directly.

**Batched execution:** apply migrations in 2 batches:
- Batch 1: Pattern G files (3): `a11y-axe-scan.cjs`, `a11y-axe-scan-manager.cjs`, `exploration-walk.cjs`.
- Batch 2: Pattern H files (2): `manager-audit-screenshots.cjs`, `manager-audit-screenshots-mobile.cjs`.
- Between batches: `git diff --stat` to confirm consistent shape.

## Phase 3 — verify

1. `git diff --stat HEAD` shows exactly 9 changed entries: `A scripts/lib/loadEnv.cjs`, 5 `M scripts/*.cjs`, `M docs/FOLLOW_UPS.md`, `M docs/CONTEXT.md`. Anything else → **STOP and wait for dispatcher.**
2. `git diff main..HEAD -- .env.example` returns empty (Rule 14 carve-out).
3. Read `scripts/lib/loadEnv.cjs` end-to-end. Confirm:
   - JSDoc with USAGE / SEMANTICS / RETURNS sections + cross-reference to `.mjs` sibling.
   - Parser body matches `.mjs` sibling semantics line-by-line.
   - `module.exports = { loadEnv };` at bottom.
4. For each migrated file (5 total), `node --check <path>` to verify syntax + require resolution. Capture pass/fail per file. **Any failure → STOP and wait for dispatcher.**
5. Sample-read 2 migrated files end-to-end (1 Pattern G: `scripts/a11y-axe-scan.cjs`, 1 Pattern H: `scripts/manager-audit-screenshots.cjs`). Confirm:
   - Inline `loadDotEnvLocal()` function removed.
   - `require('./lib/loadEnv.cjs')` present near top.
   - `Object.assign(process.env, loadEnv(path.resolve(__dirname, '../.env.local')));` line present.
   - Other functionality unchanged.
6. Run `npm run lint`. Expect 0 problems.
7. Run `npm run build`. Expect clean.

**Smoke waiver per Rule 27:** scripts-only refactor, identical-shape parser to canonical `.mjs` sibling, no app runtime impact. Pattern H sites gain embedded-key detection as safety upgrade (not regression). `node --check` on all 5 migrated files verifies syntax + require resolution. Production smoke walk waived.

## Phase 4 — docs placeholder fill + banking (in same commit as Phase 2)

### 4a. FU-F RESOLVED block — append Part 2 closure

1. Update FU-F heading from:
   ```
   ### FU-F: Unify .env.local parsing strategy (LOW, RESOLVED 2026-05-18 — Part 1 of 2)
   ```
   to:
   ```
   ### FU-F: Unify .env.local parsing strategy (LOW, RESOLVED 2026-05-18)
   ```
   (Removed "— Part 1 of 2" marker since both parts now closed.)

2. Preserve the existing body + the existing Part 1 closure paragraph verbatim — drift trail.

3. Append a new Part 2 closure paragraph after the Part 1 closure:

   ```
   **Part 2 resolved in PR #{TBD}** (`{TBD}`, 2026-05-18). Created `scripts/lib/loadEnv.cjs` (CommonJS sibling to `scripts/lib/loadEnv.mjs` shipped in FU-F-1 / PR #198) preserving identical strict parser semantics including TOOLING-N embedded-key detection. Migrated 5 tracked `.cjs` inline-parser sites: `a11y-axe-scan.cjs`, `a11y-axe-scan-manager.cjs`, `exploration-walk.cjs` (Pattern G — embedded-key detection preserved); `manager-audit-screenshots.cjs`, `manager-audit-screenshots-mobile.cjs` (Pattern H — gains embedded-key detection as safety upgrade). `Object.assign(process.env, loadEnv(...))` preserves caller-side mutation contract. **Rule 11 corrected diagnosis (knock-on from FU-M closure):** Dispatcher's FU-M closure paragraph (PR #202) claimed actual tracked `.cjs` count was 6; correct count is 5 (audit's 7 minus 1 untracked `mgr-mobile-audit.cjs` minus 1 excluded `multi-role-smoke.cjs`). Arithmetic miscount preserved here as drift trail per Rule 11. **FU-N banked in same Phase 4** (audit-methodology refinement: pair `grep` with `git ls-files` for future audit enumerations). Both Parts 1 + 2 of FU-F now complete; entire script parser unification effort closed end-to-end across two PRs.
   ```

### 4b. Bank FU-N — audit-methodology refinement

Add NEW FU entry to `docs/FOLLOW_UPS.md` after FU-M (active-FUs section):

```markdown
### FU-N — Audit enumeration: pair `grep` with `git ls-files` to distinguish tracked/untracked/excluded (LOW, methodology, banked 2026-05-18)

**Surfaced:** FU-M execution Phase 1 (PR #202, 2026-05-18). FU-F audit (2026-05-17 + 2026-05-18 re-run) enumerated `.cjs` parser sites via `grep -rn` alone, treating all matches as tracked migration targets. CC's Phase 1 source-verification caught `scripts/multi-role-smoke.cjs` was excluded-not-tracked via `.git/info/exclude` (personal exclude file, not repo-shared `.gitignore`). Additional dispatcher miscount in FU-M closure (claimed "6"; actual 5 — fixed in FU-F-2 Phase 4a closure paragraph per Rule 11).

**Mechanism:** `grep -rn` matches all files on filesystem regardless of git-tracked status. Audit consumers (brief authors) downstream assume tracked = migration target. Discrepancy creates phantom migration targets + dispatcher miscounts.

**Proposed fix:** future audit dispatches pair enumeration with `git ls-files` to filter to tracked-only files. Alternatively: use `git grep` which only searches index/tracked content. Update CLAUDE.md Rule 17 bullet list to add a "tracked-status verification" discipline OR bank as a Methodology Patterns note.

**Severity:** LOW (methodology refinement). Doesn't break shipping; causes audit downstream inefficiency + dispatcher miscounts. Phase 1 safety net catches the discrepancy (as proven in FU-M PR #202), but caught-at-authoring-time is preferred per Rule 17.

**Sequencing:** XS work PR — opportunistic. Could pair with future methodology batch (similar to PR #168) or stand alone.
```

### 4c. Add CONTEXT.md recently-shipped row

Insert at top of CONTEXT.md recently-shipped table:

```
| #{TBD} | `{TBD}` | FU-F-2 `.cjs` parser unification (LOW housekeeping closure, Part 2 of 2): created `scripts/lib/loadEnv.cjs` (CommonJS sibling to `.mjs` from FU-F-1); migrated 5 tracked `.cjs` inline parsers (Pattern G ×3 + Pattern H ×2). Pattern H sites gain embedded-key detection (safety upgrade). FU-F arc complete end-to-end. Rule 11 corrected diagnosis: actual tracked `.cjs` count is 5, not 6 (FU-M closure miscount). FU-N banked (audit-methodology refinement: pair `grep` with `git ls-files`). |
```

Drop oldest row if recently-shipped exceeds 5 entries.

### 4d. Top-table updates are Phase 6 (Rule 16)

Per Rule 16, the post-merge fill cycle handles top-table fields. Do NOT update those in Phase 4.

## Phase 5 — commit, push, open PR

1. `git add scripts/lib/loadEnv.cjs scripts/*.cjs docs/FOLLOW_UPS.md docs/CONTEXT.md`
   (NOT `git add -A` — 14 pre-existing untracked files remain outside FU-F-2's scope; mgr-mobile-audit.cjs is one of them.)
2. Commit message: `chore(scripts): FU-F-2 .cjs parser unification — sibling helper + 5 migrations`
3. `git push -u origin chore/fu-f-2-cjs-parser-unification`
4. Open PR against main. Title: `chore(scripts): FU-F-2 .cjs parser unification — Part 2 of 2 (FU-F)`. Body must include:
   - Reference to this brief at `docs/briefs/fu-f-2-cjs-parser-unification-kickoff.md`.
   - Reference to FU-F entry in FOLLOW_UPS.md (now fully RESOLVED 2026-05-18).
   - Note: "Completes the FU-F arc end-to-end (Part 1 = FU-F-1 PR #198; Part 2 = this PR). Rule 11 corrected diagnosis: actual tracked .cjs count is 5, not 6 (FU-M closure paragraph miscount preserved here). FU-N banked in same Phase 4 — audit-methodology refinement candidate."
   - Phase 1 `git ls-files` enumeration output (verbatim, showing 5 expected paths).
   - `node --check` pass/fail per migrated file (5 lines, one per file).
   - Smoke waiver justification.
5. Report PR URL + branch HEAD SHA to dispatcher.

## Phase 6 — post-merge cleanup (ninth canonical Rule 16 application)

Standard sequence per Session Protocol step 9 + § Post-merge local cleanup + Rule 16.

1. `git checkout main && git fetch origin && git pull --ff-only origin main`
2. Capture work PR squash SHA: `git log origin/main --oneline -1` — paste verbatim.
3. **Rule 16 fill scope (mandatory):**
   - `docs/CONTEXT.md` recently-shipped row: replace `#{TBD}` and `{TBD}` with actual PR number + squash SHA.
   - `docs/CONTEXT.md` top-table `Current main HEAD` → work PR squash SHA.
   - `docs/CONTEXT.md` top-table `Active track` → "FU-F-2 shipped (PR #{N}, squash {SHA}). FU-F arc complete end-to-end (Parts 1 + 2). `.cjs` sibling helper + 5 migrations landed."
   - `docs/CONTEXT.md` top-table `Next track` → "Session backlog: FU-N (audit-methodology refinement, banked 2026-05-18 — XS, opportunistic); FU-I post-pilot (TENANT_ID parameterization); BEH-1 blocked on slide copy. Mobile FU#4 cosmetics + react-hooks ×3 + shakedown bugs available as smaller follow-ups."
   - `docs/CONTEXT.md` top-table `Where we left off` → update prose covering: FU-F arc closes end-to-end across two PRs; Parts 1+2 ship same day; net code reduction across arc (~280 lines DRY-out); FU-N banked as audit-methodology refinement (audit enumeration should pair `grep` with `git ls-files`); Rule 11 corrected diagnosis preserved (5 vs 6 `.cjs` count); strike count holds 0/2 across the now-20+ commits in the two-day arc.
   - `docs/CONTEXT.md` top-table `Last updated` → ISO date of fill commit.
   - `docs/FOLLOW_UPS.md` FU-F Part 2 closure paragraph: replace `#{TBD}` and `{TBD}` with actual PR number + squash SHA.
4. `git add docs/CONTEXT.md docs/FOLLOW_UPS.md`
5. Commit: `docs: fill PR #{N} placeholders (FU-F-2 closure) — ninth Rule 16 application`
6. `git push origin main`
7. **Rule 15 verification (mandatory):**
   - `git fetch origin && git log origin/main --oneline -1` — paste verbatim.
   - `git rev-parse HEAD && git rev-parse origin/main` — paste verbatim.
   - Confirm: local HEAD == origin/main, fill commit on top, work PR squash directly below.
   - Report "pushed and verified" with all SHAs visible.
   - Any mismatch → **STOP and wait for dispatcher.** Hard-stop.
8. Worktree cleanup deferred to operator decision.

---

## Acceptance criteria

- `scripts/lib/loadEnv.cjs` exists with semantics identical to `.mjs` sibling (strict, embedded-key detection, quote-stripping, comment-skipping, frozen return, module-scoped cache, missing-file safe).
- 5 `.cjs` inline-parser sites migrated to import shared helper with `Object.assign(process.env, loadEnv(...))` integration.
- `git diff main..HEAD --stat` shows exactly 9 entries: 1 added + 8 modified.
- `git diff main..HEAD -- .env.example` returns empty.
- `node --check` passes on all 5 migrated `.cjs` files.
- `npm run lint` returns 0 problems.
- `npm run build` completes clean.
- FU-F entry in FOLLOW_UPS.md has Part 2 closure paragraph with Rule 11 corrected diagnosis (5 vs 6 miscount preservation).
- FU-N new entry added with banked-2026-05-18 status.
- CONTEXT.md recently-shipped row added.

## Out of scope

- **`.mjs` parsers** — out of scope (FU-F-1 territory, already shipped).
- **`mgr-mobile-audit.cjs`** untracked — belongs to existing 2026-05-13 banked untracked-cleanup FU.
- **Auth-helpers.mjs canonical parser** + 6 importers — out of FU-F arc per FU-F-1 Decision 1.
- **Cloud Functions** (`functions/**`) — zero env-loading consumers.
- **Updating CLAUDE.md Rule 17** with `git ls-files` discipline — banked as FU-N for future methodology PR; do NOT modify CLAUDE.md in this PR.
- **`.env.example` edit** — Rule 14 carve-out (no credential touch).

## Rule references

- **Rule 9** — Phase 0 git fetch + branch-off-main gate.
- **Rule 10** — Brief commits to `docs/briefs/` via small docs PR BEFORE CC dispatch.
- **Rule 11** — Two corrected diagnoses preserved: (a) FU-F body's "Two parsers / dotenv used by most" claims (already preserved in Part 1 closure from FU-F-1); (b) dispatcher's FU-M closure miscount ("6" actual was 5). Both drift trails intact in FU-F RESOLVED block.
- **Rule 12** — Hard-stop language used throughout.
- **Rule 14** — `.env.example` not touched.
- **Rule 15** — Phase 6 step 7 origin verification.
- **Rule 16** — Phase 6 fill scope. Ninth canonical application.
- **Rule 17** — Source-verification at authoring time. Phase 1 step 3 explicitly uses `git ls-files` (the discipline FU-N would canonize) to enumerate tracked `.cjs` targets — proactively applying the methodology refinement that FU-N would bank.
- **Rule 27** — Smoke default waived; Phase 3 node --check + identical-shape parser semantics + Pattern H safety upgrade = sufficient runtime verification.
