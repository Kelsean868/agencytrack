# AgencyTrack — 10-Hour Autonomous Run Queue

**Mode:** build-and-hold (live pilot — agents are in the app)
**Authored:** dispatcher, for unsupervised execution
**Deliverable on wake:** a stack of green, self-reviewed PRs. Nothing merged. Operator gates every production deploy.

---

## Run contract — holds for the full 10 hours

1. **Scope.** Work the blocks below in order. No freelancing, no pulling unlisted work. If a block turns out already done or obsolete, skip it and log why.
2. **Merge policy.** Build-and-hold. Every item goes to PR-open and stops there. **Nothing merges.** (No Tier-A carve-out this run unless the operator says otherwise — production stays frozen overnight.)
3. **Smoke per item — EMULATOR ONLY, never production.** Real write-read-verify cycle (log in → perform the action → reload → assert persisted/rendered) + both-theme axe, no NEW serious/critical vs the current main baseline. **All write-read-verify smokes run against the Firebase emulator** seeded with a dedicated smoke agent on an isolated test branch — **never against the production tenant `tatillife_south`, because real agents are live on it.** Frontend/axe smokes run against a local build of the feature branch. **Zero writes to the production tenant during this run.** If a block genuinely can't be verified without a production write, mark it BLOCKED and hold — do not write to prod. Green emulator smoke is what marks a PR review-ready; if it won't go green in 2 attempts, leave the PR open, log the failure, move on. (Operator does the production verification at morning merge time — the overnight smokes are emulator-only by design.) **All smoke writes obey the hygiene rules below — the live tenant must be as clean in the morning as it is now.**
4. **Hard-stops — stop the RUN, not just the item:**
   - Same friction twice (two-strike).
   - Any item needs a scope or design decision its block doesn't answer.
   - Anything touches auth / rules / Cloud Functions / money / migration beyond what the block scoped.
   - A required-field situation in Block 2 (see there).
   Halt language only: "STOP and wait for dispatcher."
5. **Per-PR discipline.** Rule 21 (poll + disposition Gemini), Rule 22 (name ≥1 self-critique gap), Rule 23 (falsification note before banking any finding), Rule 20 (report names the feature-branch HEAD SHA).
6. **Branching.** Independent branches off main where files don't overlap → clean morning merges, no rebase chains. Group same-surface items into one PR. Flag any unavoidable stack in the log.
7. **Run log.** Maintain one table — item | branch | PR# | smoke result | Gemini disposition | gap | HELD/blocked. The morning review should be a single read.

## Smoke hygiene — LIVE PILOT, non-negotiable

The tenant `tatillife_south` was just cleaned of all test data. This run must not re-pollute it. The old smoke account (`kelsean@gmail.com`) was deleted — do not improvise a replacement onto a real account or a real branch.

Priority order for any smoke that writes Firestore:

1. **Emulator-backed first.** Run the write-read-verify against the Firebase emulator (local app pointed at the emulator, or direct). Zero production touch. Preferred for everything that writes — especially Block 1 (#6 persistence) and Block 2 (#2 profile state).
2. **If a real-production write is genuinely unavoidable:** use a dedicated smoke account on a NON-real branch (recreate one explicitly for the run — never a real agent/manager account, never Cyril's branch `ljbBHP1g7lbZXvHlpcDn`, never Kendell's branch). The smoke MUST delete every doc it writes immediately after asserting. Self-clean, every time.
3. **If neither is achievable for an item:** run a non-writing verification (render/selector/axe checks), mark the persistence claim "needs manual verify" in the log, and do NOT write to production.

**Never** write smoke data under a real account or onto a real branch. **Log every production write made and confirm it was cleaned** — the morning review must be able to verify the tenant is still pristine. If a self-clean delete fails, that is a hard-stop: STOP and wait for dispatcher rather than leave residue.

Note: several blocks don't need writes at all — #8 (styling/axe), #4 (handler re-invoke), Block 4 (axe only). Those carry no hygiene risk.

---



**Objective:** ground the queue in the actual current repo before building anything.

1. Read `CLAUDE.md` (rules), `CONTEXT.md` (current main HEAD + live state), `FOLLOW_UPS.md` (queue).
2. `git fetch origin && git log origin/main --oneline -15` — see what's landed since the last dispatcher read.
3. For each block below, confirm it's still needed and locate its surfaces. If any is already resolved, mark it SKIP in the log with the reason.
4. Confirm the contrast-debt census state (Block 4) and enumerate the FOLLOW_UPS Tier-A/B candidates (Block 5).
5. Log the confirmed queue, then proceed. No dispatcher is awake to confirm — self-confirm and continue.
6. **Emulator setup:** confirm the Firebase emulator is available and seeded with a dedicated smoke agent on an isolated test branch (seed it if not). This is where every write-read-verify smoke in Blocks 1–5 runs — the production tenant `tatillife_south` is never written to during this run.

---

## Block 1 — #6 Game Plan stage save + #8 bold monthly (~1.5h)

**Objective:** (a) a saved Game Plan stage reflects in the UI immediately — no tab-switch required; (b) on step 3 (monthly screen), the monthly amount renders **bold**.

**Recon:** locate the Game Plan component(s), the stage-save handler, and the step-3 monthly-amount render. Confirm the #6 signature: the Firestore write succeeds but local state isn't refreshed/optimistically updated, so the saved stage only appears after remount (the tab-switch).

**Build:**
- #6: after a successful stage save, update local state optimistically (or re-trigger the read/listener) so the saved stage renders immediately. Do **not** optimistically show a stage whose write failed — reconcile on the write result.
- #8: apply bold styling to the monthly amount on step 3 via the existing token/utility classes (no inline styles).

**Verify (smoke):** log in as a producing agent → open Game Plan → save a stage → **without switching tabs**, assert the saved stage is visible → reload → assert it persists. Assert the step-3 monthly amount carries the bold styling. Both-theme axe, no new serious/critical.

**Tier:** B. **Merge:** hold.
**Gap-gate:** name ≥1 gap (e.g., behaviour when the save fails mid-flight).

---

## Block 2 — #2 remove first-time wizard (~1.5h) — CONDITIONAL HOLD

**Objective:** remove the first-time / onboarding wizard shown on first sign-in.

**Recon — this is the gate:** locate the wizard component, its trigger (the "first-time" flag/condition), and **everything it sets**. Determine whether it writes any **required** profile field (e.g. `contractDate`, targets, role-related fields) that nothing else sets.

**Branch on recon:**
- **No required field set →** clean removal: remove the component + the trigger gate so new users land directly on the dashboard. Build → smoke → PR-open → hold.
- **Required field(s) set →** do NOT auto-design the replacement. Build the removal, document exactly which required fields it was responsible for and a proposed default-handling approach, open the PR, and **flag HELD-FOR-REVIEW prominently in the log.** Operator decided: hold, do not ship silent defaults.

**Verify (smoke):** drive a first-time user (or a user carrying the first-time flag) → assert they land on the dashboard with no wizard → assert no required field is left unset (or, if held, the log documents precisely which fields are unresolved). Both-theme axe.

**Tier:** B if clean; C-hold if required fields. **Merge:** hold either way.
**Gap-gate:** gap.

---

## Block 3 — #4 pull-to-refresh (~2h)

**Objective:** add pull-to-refresh on the **data-feed screens only**: agent dashboard, manager dashboard / MasterSheet, leaderboard, policy ledger, notifications. **Explicitly exclude** the weekly wizard, daily report, and Game Plan — an accidental pull mid-entry could wipe unsaved input. Principle: PTR where it refreshes data, never where it could lose data.

**Recon:** identify the scroll-container architecture (single app scroll vs per-screen) and each target screen's data-fetch hook. Choose a PTR approach compatible with React 19 + the mobile/PWA context (lightweight pattern or a vetted library).

**Build:** wire PTR on the five target screens to re-invoke each screen's data fetch. Guard to touch/mobile only; exclude the form screens explicitly. Any spinner/indicator uses Nexus tokens; keep 44px targets; no gradient elements. Watch for conflict with the browser/PWA native pull-to-refresh (avoid double-refresh).

**Verify (smoke):** handler-level — assert the refresh handler re-invokes the data fetch on each target screen (the gesture itself isn't automatable). Both-theme axe. **Log a note: manual gesture verification required by operator in the morning.**

**Tier:** B. **Merge:** hold.
**Gap-gate:** gap (call out the native-PWA-pull interaction explicitly).

---

## Block 4 — Contrast-debt census + banked axe finds (~2.5h)

**Objective:** resolve the D6 contrast-debt census and the 5 banked axe finds, including the 1.89:1 banner. Bring failing pairs to the AA 4.5:1 floor — but **operator legibility is the gate**: adjust tokens to pass AA while keeping the warm-theme aesthetic legible, both themes.

**Recon:** locate the D6 census list and the 5 banked finds. Confirm each failing pair and the token(s) behind it.

**Build:** adjust the offending color tokens / usages to meet AA in both themes. No gradient buttons; keep 44px targets. If a fix would pass AA but harm legibility, log it and choose the legible option per the standing rule (AA is the floor, legibility is the gate).

**Verify (smoke):** axe on each affected screen, both themes — assert the specific finds are cleared and no NEW serious/critical vs main baseline.

**Tier:** B. **Merge:** hold.
**Gap-gate:** gap.

---

## Block 5 — FOLLOW_UPS Tier-A/B sweep (remaining ~2h)

**Objective:** work the Tier-A/B items already specified in `FOLLOW_UPS.md`, priority order, for the remaining time.

**Recon:** read `FOLLOW_UPS.md`. Select **only** items that are (a) Tier-A or Tier-B, (b) self-contained with a clear existing spec, and (c) machine-verifiable. **SKIP and log** anything Tier-C (auth/rules/CF/money/migration), anything needing a scope decision, and anything you'd have to invent scope for.

**Build:** each selected item on its own branch → build → smoke → PR-open → hold.

**Constraint:** do not invent scope. If unsure whether an item qualifies, skip it and log "skipped — needs dispatcher."

**Verify (smoke):** per item — write-read-verify + axe as applicable.

**Tier:** A/B only. **Merge:** hold.
**Gap-gate:** per item.

---

## Run-log template

| Block | Item | Branch | PR# | Smoke | Gemini | Gap noted | Status |
|-------|------|--------|-----|-------|--------|-----------|--------|
| 0 | start-recon | — | — | — | — | — | confirmed queue logged |
| 1 | #6 + #8 | | | | | | |
| 2 | #2 wizard | | | | | | HELD? |
| 3 | #4 PTR | | | | | | manual gesture check pending |
| 4 | contrast-debt | | | | | | |
| 5 | FOLLOW_UPS … | | | | | | |

**On wake, expect:** merged = none; review-ready PRs = the green ones; HELD = Block 2 if it hit required fields, plus anything whose smoke wouldn't pass. Start the morning review at the log table.
