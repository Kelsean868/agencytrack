# Brief — Fix computePoints field-reading bug (gamification scoring) [RECON-FIRST]

**Suggested branch:** `fix/computepoints-field-reading`
**Size:** M–L (the audit + fix-approach ruling set the true scope)
**Type:** CF change → **deploy required**. Human-merge + pre-review (Rule 19).

---

## Context

The weekly-summary recon surfaced a live correctness bug. `computePoints` (`functions/lib/computePoints.js`) reads **flat** field names (`applicationsSold ?? appsSold`, `apiSold`); `sanitize()` (`submissionService.js`) writes **nested** `newBusiness: { apps, api }`. So on every v2 submission, applications — the single highest weight at **25 points** — and API (1 pt / 1,000) score **zero**. The gamification leaderboard totals, MyPointsCard, and the apps/big-week badges are all wrong, and have been since the v2 schema shipped. The same gap is in the badge detector (`functions/index.js` — `top_apps_week`, `big_week` never fire). This corrupts the scoring scale we shipped and blocks the weekly-summary feature (which would showcase the wrong numbers).

## Goal

`computePoints` and the badge detector read the correct field shape, so every scored activity — especially applications and API — counts correctly. Proven by a corrected-scoring test showing apps/API now score, and a post-deploy write-read smoke showing a real submission's leaderboard total reflects them.

---

## THE FIX-APPROACH FORK — Phase 1 crux (gated on the field audit)

- **Minimal:** patch `computePoints` (+ the badge detector) to read the correct paths (nested `newBusiness.apps`, with a flat `applicationsSold`/`appsSold` fallback for v1 legacy) for the diverging fields. Smaller. Risk: the CF's field-reading stays separate from `extractFields` and can drift from the real schema again — which is exactly how this bug arose.
- **Root:** the CF cannot import `src/utils/extractFields.js` (module boundary — `functions/` bundles only its own subtree). So the root fix duplicates the needed `extractFields` reads CJS-side (`functions/lib/`) and routes `computePoints` (+ badge detector) through them, with a parity cross-check against `src/utils/extractFields.js` — the established duplicate-CJS+ESM + cross-check convention (precedent: config, `rankingLogic`). Bigger, but single-source field-reading → this class of bug can't recur silently.

**Leaning root in principle** — it's the banked `extractFields` cleanup and it prevents recurrence — **but gated on the CJS-duplication being clean** (Phase 1 item 2). If duplicating the needed reads is heavy, the minimal patch is the pragmatic call. Phase 1 audits + recommends; dispatcher rules.

---

## Phase 1 — recon (HARD STOP)

1. **FULL FIELD AUDIT.** For every field `computePoints` reads (~20) *and* every field the badge detector reads, compare the name/path the CF expects against what `sanitize()` actually writes to a v2 doc. Produce the complete divergence map — apps/API are confirmed; **find any others.** This is what decides minimal vs root.
2. **extractFields CJS feasibility.** How large is the relevant `extractFields` reading logic, and can the needed subset be cleanly duplicated CJS-side with a cross-check (precedent: config / `rankingLogic`)? This is the gate on the root fix.
3. **BACKFILL VOLUME.** Count real (non-test) historical submissions carrying apps/API — how undercounted are existing leaderboard totals? Given the test-data cleanup, likely minimal. Report the count so we decide recompute vs fix-forward (levels/badges are downstream of the cumulative total, so they self-correct once it's right).
4. **PRODUCTION-SIDE CHECK.** Confirm whether the production API computation (`newBusinessAPI` etc.) reads the nested shape correctly (probably — it's a separate system) or shares the bug. Scope stays gamification unless production is also broken.

Report the divergence map + a fix-approach recommendation + the backfill count. Hard stop for dispatcher ruling before Phase 2.

---

## Phase 2 — fix (approach confirmed at the ruling)

1. Correct the field-reading in `computePoints` + the badge detector per the ruled approach (minimal patch or `extractFields` routing).
2. Handle **both** v2-nested and v1-legacy shapes (the existing `applicationsSold ?? appsSold` fallback implies legacy docs exist).
3. Backfill per the ruling — recompute historical totals, or fix-forward + reset the few existing test totals.

---

## Phase 3 — verify

1. **Corrected-scoring test:** a v2-shaped submission fixture with apps + API now scores them (apps × 25, API / 1,000) — directly proving the bug is fixed. Include a v1-legacy fixture if such docs exist (the fallback path).
2. **Full-field regression fixture:** all ~20 scored fields score correctly against the written shape.
3. **Badge detector:** `top_apps_week` / `big_week` fire on the right inputs.
4. If root fix: the `extractFields` CJS↔ESM parity cross-check.
5. Lint / Vitest / build green.

---

## Phase 4 — docs (with placeholders)

Record the bug + the fix. Close the banked `computePoints` flat-schema / `extractFields` FU. Note the backfill decision. Note that the weekly-summary feature can now resume on correct points. SHA placeholders for Phase 5.

---

## Phase 5 — commit / push / PR

Human-merge + pre-review (CF change). Rule 20 HEAD SHA; Rule 21 Gemini disposition. After merge: `firebase deploy --only functions` gated on "Deploy complete!", then a **post-deploy write-read smoke** — submit a v2 report with apps/API via the canary agent (`kyron.marchan@tatil.co.tt`) and confirm the leaderboard total reflects the apps/API points. CF/scoring smokes are always post-merge-and-deploy.

---

## Boundary

- A scoring **correctness** fix — no weight, threshold, or level changes, and no new scored fields. The scale stays exactly as ruled; this makes it *count* correctly.
- No weekly-summary work — that resumes after, on the corrected CF.
- If the audit finds the production-side reading is also broken, **surface it** — don't silently expand scope to fix it here.
- If the audit reveals the divergence is broad (many fields, not just apps/API), that's a signal the root fix is warranted — flag it at the hard stop rather than minimally patching a wide problem.
