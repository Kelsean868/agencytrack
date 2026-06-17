# AgencyTrack — 10-Hour Autonomous Run Queue (v2)

**Mode:** build + **discretionary merge** (live pilot). **Timing-logged.**
**Prime directive:** do a lot of real, app-improving work. Known queue up front, then an **open-ended bug-hunt that absorbs all remaining time** — do not idle. Last run used ~10% of the budget; that was overestimation, not lack of work. Fill the 10 hours.

---

## Timing log — MANDATORY (this is the calibration instrument)

- **First action of the run:** record `RUN_START = (Get-Date).ToString("o")`. Write it at the top of the run log.
- **Per task:** record `start` before recon and `end` after the PR is opened/merged; log the duration in minutes.
- **Last action of the run:** record `RUN_END`, compute `TOTAL = RUN_END − RUN_START`, and report it.
- The final report MUST include the per-task duration table and the total wall-clock. This is the whole point — we're measuring real durations so estimates stop being 10x off.

---

## Run contract — holds for the full 10 hours

1. **Smokes are REAL this run.** Block 0 configures the auth emulator, so every write-read-verify smoke runs a true log-in → write → reload → assert cycle **against the emulator** (seeded smoke agent on an isolated test branch). Frontend/axe against a local build. **Zero writes to the production tenant `tatillife_south`.**
2. **Merge discretion (operator-granted) — exercised as:**
   - **Auto-merge OK** — bug fixes, cleanup, hardening, accessibility, internal refactors: changes that *fix or harden without altering intended product behavior/UX*, that are low-blast-radius, and that pass ALL gates (real emulator smoke green, both-theme axe no-new-serious, CI green, Gemini dispositioned clean).
   - **HOLD for review** — anything an agent would *see or do differently* (new features, changed flows, added/removed UI), and anything touching auth / Firestore rules / Cloud Functions / money/financial calc / migrations / new collections. Build to PR-open, hold, flag. These are product or safety calls.
   - **When in doubt → HOLD.** Discretion means "merge the clearly-safe, hold the rest," not "merge aggressively."
3. **Post-merge per auto-merge:** Rule 15 SHA verify + Rule 16 CONTEXT.md fill + a **read-only** production exploration confirm (no writes). If the exploration shows anything off, STOP.
4. **Hard-stops — stop the RUN:** same friction twice (two-strike); an item needs a decision its spec doesn't answer; a Tier-C surface appears mid-build that wasn't scoped; a Rule 15 SHA mismatch. Halt language only: "STOP and wait for dispatcher."
5. **Per-PR:** Rule 21 (poll + disposition Gemini, and after any late fix **re-run the affected tests + confirm CI green before marking review-ready** — don't report on "CI re-checking"), Rule 22 (≥1 gap), Rule 23 (falsification note), Rule 20 (name the branch HEAD SHA).
6. **Branching:** independent branches off main where files don't overlap; group same-surface items into one PR; flag any unavoidable stack.

---

## Block 0 — Session start + recon + auth emulator (do FIRST)

1. **Stamp `RUN_START`.**
2. Read `CLAUDE.md`, `CONTEXT.md`, `FOLLOW_UPS.md`; `git fetch origin && git log origin/main --oneline -15`. Skip any queued item already landed; log SKIP + reason.
3. **Configure the auth emulator** — add the auth emulator to `firebase.json` (alongside Firestore), seed a dedicated smoke agent on an isolated test branch in the emulator, and confirm a full log-in → write → reload → assert cycle runs green against it. This is the enabler for every smoke below. The `firebase.json` change is a low-risk dev-infra PR — auto-merge OK once the emulator round-trip is proven.
4. Log the confirmed queue and proceed.

---

## Block 1 — #9 auto-distribute (build → HOLD)

**Spec (locked):** the existing "auto distribute" button on Game Plan step 3 splits the **outstanding** annual API **evenly across the remaining months** — "remaining" = current month forward (don't overwrite elapsed months), and **preserve any month already typed into** (distribute only across the untouched remaining months).
**Recon:** locate the existing auto-distribute button + the month-field model + how the annual API and per-month values are held. Confirm whether the button is currently wired to anything.
**Build:** wire it to the even-split-over-remaining logic above; round sensibly so the months sum back to the target (handle the remainder cents/units).
**Smoke (emulator):** set an annual API, type a value into one month, click auto-distribute → assert the untouched remaining months fill evenly, the typed month is preserved, elapsed months untouched, and the total reconciles. Both-theme axe.
**Merge:** **HOLD** — visible product change.
**Gap-gate:** ≥1 gap (e.g. behavior when all remaining months are already typed, or when the target < number of remaining months).

---

## Block 2 — #11 role-aware shortcut (build per brief → HOLD)

**Spec:** build per `docs/briefs/role-aware-shortcut-brief.md` (mobile bottom-bar Submit fans out, pencil removed; desktop pencil replaced; role→action map as specified, SM/TA = single "Add team member").
**Recon HARD-STOP:** if any target flow in the role→action map doesn't exist (recruiting-activity is the likely gap), STOP and report — don't invent it.
**Smoke (emulator/navigation):** per role, open the shortcut on mobile fan-out + desktop, assert the right actions render and route to the right flows; pencil gone on mobile.
**Merge:** **HOLD** — visible product change.
**Gap-gate:** per the brief.

---

## Block 3 — Banked quick-wins + hardening sweep

Each its own branch; **auto-merge the clearly-safe**, hold/report the rest. Recon-first (verify current state — some may already be resolved).

1. **Remove stale `scripts/verification/smoke-647-onboarding-wizard.mjs`** (the wizard it smokes was removed in #660). Auto-merge.
2. **Remove the orphaned `OnboardingWizard` component + its test** (no importers after #660 — confirm via grep first). Auto-merge.
3. **Null-name guard on `seed-first-tenant-admin.cjs`** — refuse `--apply` when the resolved name is null/empty with a clear message. Auto-merge.
4. **Awards default check (read-only)** — confirm the code-default `awardsRuleset_2026` values match `AgencyTrack_2026_Incentives.md`. If they match: log clean, no PR. If they **diverge**: do NOT silently change award logic — report the specific mismatches and STOP that item for dispatcher review (award values are a product/money call).
5. **Stale local `.cjs` admin scripts referencing a service-account key** — if any tracked script still references the removed key file, clean the reference. Recon-confirm before touching; auto-merge if purely mechanical.
6. **`graph.json` / `graphify-out` 100MB push-limit** — investigate and propose (likely `.gitignore` the artifact + document regeneration). This is a path *decision* — build the gitignore/cleanup PR but **HOLD** with the recommendation rather than auto-merging, since it changes repo tooling assumptions.

*(Not in this run: `kyronmarchan+tenant` name backfill is a one-off production data write — leave it as an operator task, not autonomous. The Tier-C email/CF hardening banks are excluded — supervised session only.)*

---

## Block 4 — FOLLOW_UPS.md remaining Tier-A/B sweep

Read `FOLLOW_UPS.md`; the last run already cleared several, so pick the **remaining** items that are Tier-A/B, self-contained, machine-verifiable, and not auth/rules/CF/money/migration. Each its own branch → real smoke → auto-merge the clearly-safe, hold the rest. SKIP and log anything Tier-C or needing a scope decision (the 5 aspirational badges → SKIP, needs a decision). Don't invent scope.

---

## Block 5 — Open-ended bug-hunt + squash (FILLS ALL REMAINING TIME)

Run this until `RUN_END − RUN_START` approaches 10h or the backlog is genuinely exhausted (it won't be). Check elapsed against `RUN_START` periodically. Work the passes below in order; each fix is its own branch → real smoke → auto-merge clearly-safe fixes, HOLD anything behavior-changing or uncertain. Log every fix with timing.

1. **Static health:** `npm run lint`, typecheck, `npm run build` — fix every warning/error. Grep and clear stray `console.log/error/warn`, `debugger`, `TODO/FIXME/HACK`, dead commented-out blocks.
2. **State-handling audit:** the project rule is every component handles loading, error, and empty. Walk the major screens/components; find any missing a state and add it.
3. **Domain invariants:** `parseFloat()` enforced on all numeric writes; TTD currency formatting consistent; all date parsing routed through `parseDateOnlyTT()` / `getTodayTT()` (Trinidad-local); week-starts-Sunday validated. Find violations, fix.
4. **Defensive coding:** null/undefined guards where Firestore data may be absent (the `color-mix` undefined-value class of bug); optional chaining on possibly-missing fields.
5. **Accessibility:** axe-sweep screens not previously covered; fix new serious/critical; 44px touch targets; focus-visible states; aria-labels on icon-only buttons.
6. **Broken handlers / dead ends:** no-op onClick handlers, dead routes, unhandled promise rejections, missing error boundaries on async surfaces.
7. **Runtime errors:** load each major screen in the local build, capture console errors/warnings, fix.
8. **Cheap test coverage:** add tests for any uncovered critical path where it's cheap and self-contained.
9. **Performance hygiene:** `useMemo`/`useCallback` on expensive calcs per the project rule; obvious unnecessary re-renders.

If a pass surfaces something that's actually a product/UX or Tier-C change, build-to-PR-and-HOLD and keep moving — don't merge it.

---

## Final — Session close

1. **Stamp `RUN_END`; compute `TOTAL`.**
2. Report the run log table: per task → branch, PR#, **start / end / duration**, smoke result, Gemini disposition, gap, MERGED/HELD.
3. Report **TOTAL wall-clock** and a one-line read on where time actually went vs. where it was expected (the calibration takeaway).
4. List every HELD PR (the morning review set) and every SKIP with reason.

**On wake, expect:** a stack of merged clearly-safe fixes (each real-smoke-gated), a set of HELD product/UX PRs (#9, #11, anything behavior-changing) for review, and — most importantly — a true duration table so the next run is sized honestly.
