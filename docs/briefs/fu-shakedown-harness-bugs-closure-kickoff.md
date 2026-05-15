# FU Closure Kickoff — Shakedown bugs 001/003/004/006 (test harness navigator + assertion fixes)

**Type:** Mixed code (test harness) + docs closure PR (S)
**Shape:** HIGH#6 / PR #160 closure pattern
**Strike count opens at:** 0/2
**Smoke:** Waived (shakedown harness scripts only, no application source touched). CI lint + build mandatory.

---

## Audit findings (from batched 4-FU audit, 2026-05-15)

Four bugs in the shakedown harness, two require code change, one is direct closure, one auto-closes via the first fix:

- **Bug 001 — `scripts/verification/shakedown/cat02-role-agent.mjs` T2A.03 (lines 67–97):** Original FU diagnosis was **incorrect**. FU said "regex adjustment only" but the real root cause is an **off-by-one navigator**. The 5-iteration Next-click loop starts at the date pre-screen (not wizard step 1), so the body-text check `/summary|review|submit|total/i` runs on step 4 instead of step 5. The regex itself is fine — the loop needs to advance past the date screen first.
- **Bug 003 — `cat04-form-validation.mjs` T4.02 (lines 72–90):** Currently a soft WARN (`_log('WARN...')`), not a hard fail. Body-text check uses wrong keywords (`/sunday|invalid.*date|must be sunday/i`) — text that won't appear if validation is silent. **Fix locked in:** replace with a navigation-blocking assertion (verify wizard did NOT advance after Next-click on invalid date).
- **Bug 004 — `cat04-form-validation.mjs` T4.03 (lines 105–117):** **STALE — direct closure.** Current test already does the correct "assert absence of invalid input" pattern using `inputValue()` directly. No code change required.
- **Bug 006 — `cat08-screenshot-dossier.mjs` T8.ALL (lines 249–268):** Same off-by-one as Bug 001 — cat08's independent wizard walk (lines 86–100) starts at date pre-screen too, producing 79 of 80 screenshots. Phase 1 must confirm this hypothesis before Phase 2 applies the fix.

## Phase 0 — Gate

1. Confirm on `main`, working tree clean. `git fetch origin && git pull origin main`.
2. Create fresh branch off freshly-fetched main: `chore/close-fu-shakedown-bugs-001-003-004-006`
3. Confirm CLAUDE.md Phase 0 gate checks pass.

## Phase 1 — Locate sources & validate audit hypotheses

1. Read `docs/FOLLOW_UPS.md` and locate the "Shakedown harness — LOW opportunistic follow-ups (banked 2026-05-14)" section. Quote all four bug entries verbatim.
2. Read `scripts/verification/shakedown/cat02-role-agent.mjs` lines 60–100. Confirm T2A.02 ends with the wizard on the date pre-screen (not step 1). Confirm T2A.03's 5-iteration loop starts immediately after, without a pre-loop advance click.
3. Read `scripts/verification/shakedown/cat04-form-validation.mjs` lines 70–120. Confirm:
   - T4.02 currently uses `_log('WARN...')` (soft warn) and the wrong body-text regex
   - T4.03 already uses `inputValue()` check correctly (Bug 004 stale verification)
4. Read `scripts/verification/shakedown/cat08-screenshot-dossier.mjs` lines 80–105 and 245–270. Confirm cat08's wizard walk uses the same `getByRole('button', { name: /next|continue/i })` loop pattern AND starts from the date pre-screen. **Hard stop if NOT confirmed** — Bug 006 needs different scope analysis.
5. Read `src/components/wizard/WizardForm.jsx` SCREENS array (lines 29–64) to confirm: step 5 = "Next Week Goals" (Step9Goals); `nextLabel` = "Review" on step 5.

## Phase 2 — Code change

1. **Bug 001 fix (cat02-role-agent.mjs T2A.03):** Add one pre-loop click to advance past the date pre-screen before the 5-iteration loop. Approximate shape (exact code based on Phase 1 source inspection):
   ```js
   // Advance past date pre-screen before counting wizard screens
   await page.getByRole('button', { name: /next|continue/i }).first().click();
   await page.waitForTimeout(200);
   // Then existing 5-iteration loop runs from wizard step 1
   ```
2. **Bug 006 fix (cat08-screenshot-dossier.mjs):** Apply the same pre-loop click pattern to cat08's wizard walk (lines 86–100 per audit). Verify in Phase 3 that screenshot count now reaches ≥80.
3. **Bug 003 fix (cat04-form-validation.mjs T4.02):** Replace the soft WARN + wrong-keyword body-text check with a navigation-blocking assertion. Approximate shape:
   ```js
   // After clicking Next with non-Sunday date selected,
   // verify wizard did NOT advance (still showing date input)
   await page.getByRole('button', { name: /next|continue/i }).click();
   await page.waitForTimeout(400);
   const stillOnDateScreen = await page.locator('input[type="date"], [class*="week-starting"]').count() > 0;
   if (!stillOnDateScreen) {
     throw new Error('T4.02: Wizard advanced past invalid non-Sunday date');
   }
   ```
4. **No changes** to `WizardForm.jsx`, `AgentDashboard.jsx`, or any application source.

## Phase 3 — Verification

1. Re-run shakedown harness scripts in isolation:
   ```bash
   node scripts/verification/shakedown/cat02-role-agent.mjs
   node scripts/verification/shakedown/cat04-form-validation.mjs
   node scripts/verification/shakedown/cat08-screenshot-dossier.mjs
   ```
   (Requires app running + seeded data. **Hard stop** and surface to Kelsean if env setup is missing.)
2. Confirm:
   - T2A.03 passes (screen 5 body now matches the regex)
   - T4.02 passes (navigation block correctly asserted)
   - T4.03 passes (unchanged from baseline)
   - Cat08 captures ≥80 screenshots
3. `npm run lint && npm run build` — 0 errors.
4. Confirm `git status` shows only the three shakedown scripts and `docs/FOLLOW_UPS.md` + `docs/CONTEXT.md` modified.

## Phase 4 — Docs (FOLLOW_UPS.md + CONTEXT.md)

1. Mark Bug 001 RESOLVED with note: "Fixed via off-by-one navigator correction in cat02-role-agent.mjs T2A.03 — added pre-loop click to advance past date pre-screen before 5-iteration loop. **Original FU hypothesis ('regex adjustment only') was incorrect**; the regex was fine, the loop entry state was wrong. Step 5's `nextLabel = 'Review'` already matches the existing regex."
2. Mark Bug 003 RESOLVED with note: "Fixed via navigation-blocking assertion in cat04-form-validation.mjs T4.02 — replaced wrong-keyword body-text check with assertion that the wizard did not advance past the date input after a Next-click on an invalid (non-Sunday) date. Soft WARN replaced with hard fail; assertion now catches real behavior."
3. Mark Bug 004 RESOLVED — direct closure: "STALE. Current test already uses correct `inputValue()` check (assertion of absence of invalid input). No code change required. Verified via audit on 2026-05-15."
4. Mark Bug 006 RESOLVED — auto-closed via Bug 001: "Cat08 wizard walk (lines 86–100) had the same off-by-one navigator as cat02 T2A.03. Fixed in the same PR via the matching pre-loop click. Screenshot count now reaches the ≥80 target."
5. Add a recently-shipped placeholder row in `docs/CONTEXT.md` matching the Rule 4 placeholder pattern.

## Phase 5 — Commit, push, PR

1. `git add scripts/verification/shakedown/cat02-role-agent.mjs scripts/verification/shakedown/cat04-form-validation.mjs scripts/verification/shakedown/cat08-screenshot-dossier.mjs docs/FOLLOW_UPS.md docs/CONTEXT.md`
2. `git commit -m "chore: close shakedown bugs 001/003/004/006 (navigator off-by-one + assertion fixes)"`
3. `git push -u origin chore/close-fu-shakedown-bugs-001-003-004-006`
4. Open PR with body containing:
   - Reference to batched 4-FU audit dispatch (2026-05-15) and per-bug findings
   - **Explicit note** that Bug 001's original FU diagnosis ("regex adjustment only") was incorrect; the true root cause (navigator off-by-one) is documented in the RESOLVED entry
   - **Smoke waiver justification:** "Shakedown harness test scripts only — no application source modified. WizardForm.jsx, AgentDashboard.jsx, and all production components untouched. CI lint + build verified; harness re-runs confirmed pass."
5. Stop after PR is open. Wait for Kelsean to merge.

---

## Acceptance criteria

- `cat02-role-agent.mjs` T2A.03 has a pre-loop click added before the 5-iteration loop
- `cat08-screenshot-dossier.mjs` wizard walk has the matching pre-loop click added (confirmed in Phase 1)
- `cat04-form-validation.mjs` T4.02 uses a navigation-blocking assertion instead of the body-text WARN
- T4.03 unchanged (Bug 004 stale, direct closure)
- All four bugs marked RESOLVED in `FOLLOW_UPS.md` with accurate closure notes (including the Bug 001 diagnosis correction)
- Recently-shipped placeholder row in `CONTEXT.md`
- Shakedown harness scripts pass when re-run (cat02, cat04, cat08)
- No application source modified
- Smoke waiver justified inline

## Hard stops (per CC audit open questions)

- **Phase 1 stop:** If cat08 wizard walk does NOT have the same off-by-one as cat02 T2A.03, scope changes — surface to Kelsean before Phase 2.
- **Phase 1 stop:** If Bug 004 (T4.03) has any subtle difference from CC's "already-fixed" characterization, surface before treating it as stale.
- **Phase 3 stop:** If shakedown harness re-run requires running app + seeded data and env is not set up, surface to Kelsean.

## Out of scope

- Any change to application source (`WizardForm.jsx`, `AgentDashboard.jsx`, validation logic, etc.)
- Any other shakedown bug fixes beyond 001/003/004/006
- Any CLAUDE.md methodology edits (queued — including the new FU-diagnosis-drift candidate surfaced from this audit)
- Mobile FU#2 residual priority downgrade (deferred to separate docs cleanup)

## Standing rule reminders

- Single-branch PR rule applies (fresh branch off freshly-fetched main, never reuse)
- Phase 0 gate fires as usual
- Smoke waiver allowed for changes outside the user-visible surface per banked May 14 rule; justification required inline
- Post-merge sequence (Rule 4) runs automatically after Kelsean merges
