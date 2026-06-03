# Smoke-harness extraction — Kickoff brief

- **Status:** FINAL — decisions locked.
- **Channel:** HUMAN-MERGE + pre-review.
- **Scope class:** Verification-infra refactor. Extract the screen-agnostic helpers from the #426 smoke into shared `scripts/verification/lib/`, and refactor the #426 smoke to import them. **No test-behavior change** — the #426 smoke must reproduce its result identically.
- **Smoke:** the validation *is* re-running the refactored #426 smoke (Phase 3); it must reproduce the known-good 24/24 baseline.
- **Branch:** off `origin/main` (current HEAD `68f7c28`).
- **Rules in force:** Rule 12, Rule 15, Rule 17, Rule 19, Rule 20.

---

## 0. Why

The #426 smoke re-derived hard-won lessons by hand mid-debugging — the `agencytrack-dark='1'` theme value, the truncated per-branch Vercel preview URL, the `data-loading` wait, the both-themes loop. Future per-screen smokes (Game Plan, Commission, Policy Ledger, Settings) must not re-derive them. Extract the generic helpers into the shared lib so every smoke imports them and the lessons live in one place. This is a **pure structural refactor** — the daily smoke's assertions and result do not change.

## 1. Extraction targets — Phase 0 confirms exact boundaries against the full file

Source: `scripts/verification/daily-capture-v2-smoke.mjs` (485 lines) + sibling `scripts/verification/lib/walk-helpers.mjs`. The split below is from the read-only audit map (line numbers approximate — **Phase 0 reads the full file and confirms; STOP if boundaries differ materially**).

**Generic → extract to the shared lib:**
- **Preview-URL resolution** (~line 65, currently a hardcoded truncated alias + `SMOKE_PREVIEW_URL` override). Generalize to: read `SMOKE_PREVIEW_URL` (required for preview runs) with a production fallback, and **drop the hardcoded per-branch alias** — it is branch-specific and cannot generalize. Encodes the lesson: *preview URLs are truncated-aliased per branch; pass the URL via `SMOKE_PREVIEW_URL`.*
- **`setTheme(page, theme)`** (~218–226): writes `localStorage 'agencytrack-dark'='1'` for dark, removes it for light. (Encodes the `'1'`-not-`'true'` lesson.)
- **`runBothThemes(page, perThemeFn)`** (~237–358): generalize the existing `runTheme` loop into a runner that executes a per-screen body in light then dark.
- **`waitForLoaded(page, testid)`** (~180–189 pattern): waits for `[data-testid="<testid>"][data-loading="false"]`.
- **Login / `setupBypassSession`** — already in `lib/walk-helpers.mjs`. Confirm and **reuse — do not duplicate**.

**Screen-specific → stays in `daily-capture-v2-smoke.mjs`:**
- `openDailyCapture` (navigates to Daily Capture), `readChips` (count-strip-specific), the count-strip live-read assertion (~261–279), the aggregation regression (~410–456), and the daily clean/seed `deleteWeekDocs`/`seedSecondDay` (~121–162; week-doc-specific — leave for now, generalize only when a second screen needs the pattern).

## 2. Lib placement (decide in Phase 1)

Extend the existing `scripts/verification/lib/walk-helpers.mjs` (natural home — login already lives there) **vs** a new `scripts/verification/lib/smoke-harness.mjs`. Prefer extending walk-helpers unless a separate file keeps concerns meaningfully cleaner. State the choice + rationale in the PR body.

## 3. Phases

### Phase 0 — Audit (NO writes)
1. Read the **full** `scripts/verification/daily-capture-v2-smoke.mjs` and `lib/walk-helpers.mjs`. Confirm the §1 generic-vs-specific split against the actual code, and confirm `setupBypassSession`/login is already shared. **If the boundaries differ materially from §1 → STOP and wait for dispatcher.**
2. Confirm Daily Capture v2 is live on `main` (merged via #426) so the refactored smoke can validate against a fresh preview.

### Phase 1 — Design
- Finalize the extracted helper signatures (`resolvePreviewUrl`, `setTheme(page, theme)`, `runBothThemes(page, fn)`, `waitForLoaded(page, testid)`) and the lib file choice (§2).

### Phase 2 — Extract + refactor (structure only, NO behavior change)
- Move the generic helpers into the chosen lib file. Refactor `daily-capture-v2-smoke.mjs` to import them. Assertions, seeded data, and the result must be byte-for-byte equivalent in behavior — this changes *how* the smoke is assembled, not *what* it tests.

### Phase 3 — Validation (the gate)
- Re-run the refactored `daily-capture-v2-smoke.mjs` against the **harness PR's fresh Vercel preview** (set `SMOKE_PREVIEW_URL` to the PR's preview alias from the Vercel bot comment; `VERCEL_BYPASS_TOKEN` from `.env.local`). It MUST reproduce the known-good baseline: **24/24 PASS**, both themes, count-strip live read, aggregation regression — identical to #426. **If the result is anything other than 24/24 → STOP and wait for dispatcher** (the refactor changed behavior, which it must not).
- `npm run lint` / `npm run build` green.

### Phase 4 — Docs (with placeholders)
- `docs/CONTEXT.md` Recently-shipped row + Rule 16 top-of-file refresh (`#TBD/{TBD}`).
- If a smoke/verification runbook exists, add a one-line pointer to the new shared helpers (Phase 0 notes whether one exists). No port-ledger change.

### Phase 5 — Commit / push / PR
- Conventional commit; push; `gh pr create` (body: the §1 split as-built, lib-file choice + rationale, the 24/24 re-validation evidence).
- **STOP. Do not merge / deploy (Rule 19).**
- Report PR URL + the **24/24 re-validation result** + lint/build + the feature-branch HEAD SHA (Rule 20).

### Phase 6 — Post-merge
- `/post-merge <pr-number>`.

---

## 4. Acceptance criteria
- The generic helpers (`SMOKE_PREVIEW_URL`-based URL resolution with no hardcoded alias, `setTheme`, `runBothThemes`, `waitForLoaded`) live in the shared lib; `daily-capture-v2-smoke.mjs` imports them; login reused, not duplicated.
- The refactored #426 smoke **reproduces 24/24 identically** (Phase 3) — proven, not assumed.
- No app code touched (`src/`, `functions/`, rules, indexes untouched); no per-branch alias hardcoded; lint/build green.
