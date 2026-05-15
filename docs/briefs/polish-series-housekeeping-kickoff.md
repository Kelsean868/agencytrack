# Pilot Polish housekeeping — kickoff brief

**Status:** Ready to execute. Closes the Pilot Polish series in FOLLOW_UPS.
**Estimated CC effort:** 1–2 hours. Single small PR.
**Two-strike counter:** 0/2 (fresh session).

---

## Context

Three Pilot Polish PRs have shipped (#88 Wizard UX hardening, #90 Mobile FU#1 mgr-mobile, #92 Login logo + UX-N + BUG-N2). Three follow-up entries are now resolved and need closure in `docs/FOLLOW_UPS.md`. One new entry surfaced during the Mobile FU#1 audit (BUG-N3) needs adding. This PR closes them out and runs a final production verification.

**Closures (resolved by recent PRs):**
- **UX-N** (resolved by PR #92): empty-state copy on Persistency tab improved
- **BUG-N2** (resolved by PR #92): sales_manager added to unitGoals write rule
- **FU#5** (resolved by PR #90): mobile NAV_GAP closed via "More" drawer (Option C)

**New entry to add:**
- **BUG-N3** (LOW, post-pilot): Production Report shows raw Firestore UID (e.g. `XQhG6awVgaYkCFX7gnd1...`) where unit name should be. Branch managers see this when opening Production Report. Visible but not blocking; tracked for post-pilot data-display fix. Discovered during PR #90 mgr-mobile audit.

**No source code changes in this PR. Docs + verification only.**

---

## Phase 1 — Cleanup + sync + worktree

1. Clean up any idle worktrees from previous sessions:
   ```
   git worktree list
   ```
   If any non-main worktrees exist, remove them with `git worktree remove <path>` and `git branch -D <branch>` if they have no unique commits. Don't remove anything with unique commits — surface instead.
2. `git fetch origin --prune`
3. `git checkout main && git pull origin main`
4. Confirm: `git log origin/main --oneline -5`. Top entry should be the PR #92 squash commit (pilot-polish-batch).
5. Create worktree at `.claude/worktrees/chore-polish-series-housekeeping` on branch `chore/polish-series-housekeeping`.
6. `cd` into the worktree.

---

## Phase 2 — Confirm production is live

`curl -I https://agencytrack.vercel.app` returns 200. Move on (no manual UI check — Kelsean already verified post-merge smokes for all 3 polish PRs).

---

## Phase 3 — Run the E3 walk against production

Run `scripts/verification/e3-persistency-walk.mjs` (or `scripts/exploration-walk.cjs`, whichever is appropriate for current pre-WALK-1 tooling) against `https://agencytrack.vercel.app`. Use the canonical bypass pattern from prior sessions (URL parameter, `x-vercel-set-bypass-cookie=samesitenone`, `waitUntil: 'domcontentloaded'`, never log the token).

Run from the main worktree (where `.env.local` lives) with `PREVIEW_HOST` env override pointing at production.

**Gates:**
- 18/18 → proceed
- 14–17/18 → note failures in PR description, proceed (informational; walk caveats per WALK-1)
- <14/18 → STOP and surface (production regression suspected)

Walk output saved to a worktree-local file (gitignored). Reference summary numbers in PR description.

---

## Phase 4 — Run a real write-read-verify smoke against production (THE critical verification)

Apply the smoke standard. This is the third post-merge automated smoke in this arc; you've run it twice successfully (PR #86 housekeeping initial attempt + WizardForm.test smoke + Mobile FU#1 smoke). Same pattern.

**Procedure (Playwright):**

1. Load `VERCEL_BYPASS_TOKEN` via `dotenv` from `C:\Projects\AgencyTrack\.env.local`. **NEVER log the token. NEVER read the file via cat/echo/grep.**
2. Navigate to `https://agencytrack.vercel.app` (production, no bypass token needed — production is not SSO-gated).
3. Sign in as test agent (`kelsean@gmail.com` / `<TEST_AGENT_PASSWORD>` from `.env.local`, UID `J0j4uBqzTPcfm1IlGCPyDzo27RP2`).
4. Click **Persistency** in the left nav.
5. Click **Enter** in the SELF-ENTRY section. Wait for dialog.
6. Fill 6 fields with clearly-test values:
   - businessPlaced: `1.00`
   - notTakens: `0`
   - incPPPs: `0`
   - lumpsums100: `0`
   - lapses: `0`
   - reinstatements: `0`
7. Click **Save**. Wait for dialog to close.
8. **Hard reload:** `page.reload({ waitUntil: 'domcontentloaded' })` (NOT `networkidle` — Firebase keeps long-polls open).
9. Re-navigate to Persistency tab.
10. **Verify the value persisted from Firestore.** Look for the saved persistency value (likely 100.0% / Award-eligible) on the page.

Note: an existing test persistency doc for `kelsean@gmail.com / 2026_05` may already exist from prior smokes (PR #86 etc.). This smoke either updates it (writes to same path) or creates anew if it was purged. Either way, the persisted value should be visible after the hard reload.

**Capture screenshots** at: post-login, persistency-tab-loaded, entry-form-filled, post-save, post-hard-reload, post-verify.

**Hard stops:**
- Save fails with permission error → STOP and surface (rules regression)
- Value doesn't appear after hard reload → STOP and surface
- Login fails → STOP and check `.env.local` credentials (`kelsean@gmail.com` / `<TEST_AGENT_PASSWORD>`)

---

## Phase 5 — Update `docs/FOLLOW_UPS.md`

1. Read the full current `docs/FOLLOW_UPS.md`. Match the existing format conventions for closures and additions.

2. **Close three entries** (reference resolving PRs in whatever style the file uses for closed items):
   - **UX-N** — resolved by **PR #92** (login logo + UX-N + BUG-N2 batch)
   - **BUG-N2** — resolved by **PR #92** (sales_manager added to unitGoals write rule)
   - **FU#5** (NAV_GAP) — resolved by **PR #90** (mobile "More" drawer / MobileNavDrawer component)

3. **Add ONE new entry** at the appropriate priority section in the file:

   - **BUG-N3 (LOW, post-pilot)** — Production Report shows raw Firestore UID where unit name should be. Branch managers see strings like `XQhG6awVgaYkCFX7gnd1...` as the unit identifier on the Production Report screen. Functional but unpolished. Discovered during PR #90 mgr-mobile audit (visible in `verification/mgr-mobile-audit/production-report.png` reference). Data display bug — likely a missing join between persistency docs and unit-name lookup, or a render-time fallback that's incorrectly using the ID field. Pilot-launch acceptable; fix in dedicated PR before broader rollout.

4. Do NOT touch any unrelated entries. No bonus closures, no rephrasing, no reordering. If anything else looks stale, surface in chat — don't fix here.

---

## Phase 6 — Verify, commit, push, PR

1. `git diff docs/FOLLOW_UPS.md` — review. Should be: 3 closures + 1 addition. Nothing else.
2. Markdown sanity check — tables, lists, fenced blocks render cleanly.
3. `npm run lint` → 0 errors (docs-only change, should be untouched).
4. Commit:
   ```
   chore(polish-series): close UX-N + BUG-N2 + FU#5, add BUG-N3, production smoke verified
   
   Closures (resolved by recent PRs):
   - UX-N: Persistency empty-state copy improved (PR #92)
   - BUG-N2: sales_manager added to unitGoals write rule (PR #92)
   - FU#5: Mobile NAV_GAP closed via MobileNavDrawer Option C (PR #90)
   
   New follow-up added:
   - BUG-N3 (LOW): Production Report shows raw Firestore UID instead of unit name
   
   Production verification (new smoke standard):
   - E3 walk against production: <X>/18 passing (informational per WALK-1 caveat)
   - Real write-read-verify smoke: PASS (test agent, persistency tab, businessPlaced=1.00 test write, hard reload, value persisted from Firestore)
   ```
5. `git push -u origin chore/polish-series-housekeeping`
6. Open PR titled: `chore(polish-series): close UX-N + BUG-N2 + FU#5 + add BUG-N3 + production smoke`
7. PR body MUST include:
   - Summary of closures (3 items by name with resolving PRs)
   - The BUG-N3 entry verbatim
   - Production walk result (X/18) + WALK-1 caveat
   - Production real write-read-verify smoke result (PASS + brief narrative + reference to local screenshots)
   - One-line note about the test persistency doc residual: `kelsean@gmail.com / 2026_05` exists from this smoke and prior — Kelsean may purge via Firebase Console if desired.
8. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Phase 3 walk pass rate <14/18 → STOP and surface (regression suspected)
- Phase 4 write-read-verify smoke fails (save errors, value doesn't persist, any permission error) → STOP immediately, surface (production regression takes priority over docs)
- `docs/FOLLOW_UPS.md` diff has more than 1 added entry OR closures of unintended items → STOP and confirm
- Any change needed outside `docs/FOLLOW_UPS.md` and gitignored local files → STOP
- CI gate fails on the PR → STOP and fix before requesting review
- Two strikes hit → STOP

---

## Out of scope

- Walk script modifications (WALK-1, next PR — DO NOT touch walk scripts in this PR)
- Any source code changes
- Any rule changes
- Closing follow-ups unrelated to PR #88/#90/#92
- Fixing BUG-N3 (separate PR after WALK-1)
- Cleaning up the test persistency doc residue from Firestore (Kelsean handles via Console if desired)
- Worktree audit (already done, state should be clean — but Phase 1 cleanup catches any drift)
