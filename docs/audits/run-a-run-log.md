# RUN A — Waves 1–3 · Run Log

**Orchestrator:** Claude Opus 4.8 · **Started:** 2026-07-24
**Brief:** [`docs/briefs/run-a-waves1-3-kickoff.md`](../briefs/run-a-waves1-3-kickoff.md) (landed `60dbf1c2`, sole authority)
**Merge authority:** NONE — CC executes to PR-open and HOLDS. Kyron merges + promotes.
**Branch flow:** feature branches → PRs into `staging` → ONE human staging→prod promotion after the window.
**Phase 0 report:** [`docs/audits/run-a-phase0-anchor-report.md`](run-a-phase0-anchor-report.md) — 10/10 anchors verified; D1–D4 divergences resolved by dispatcher (2026-07-24).

---

## Standing rails observed this run

- **Per-tier drift check (dispatcher-added):** before cutting each tier's branch off `origin/staging`, diff that tier's touch-set between `origin/staging` and `origin/main`. Byte-identical → proceed; any drift → STOP with file list. Recorded per tier below.
- **Promotion note (logged, no action):** `docs/CONTEXT.md` and `docs/FOLLOW_UPS.md` are expected to conflict at the end-of-window staging→main promotion (#864 fill on main vs the Tier 1 sweep on staging). Dispatcher resolves at promotion; not a run defect.
- **HOLD at each PR-open.** CodeRabbit is the sole reviewer and rate-limits on the free tier; if CodeRabbit has not posted, the PR is not review-complete — rate-limit silence = wait, logged (never treated as approval).
- **CC never merges, never deploys, never touches `firestore.rules` or `functions/` runtime.**

---

## TIER 1 — Hygiene + verification substrate

**Branch:** `run-a-tier1-hygiene` (cut off `origin/staging` @ `a31d52d7`)
**PR target:** `staging`

### Per-tier drift check (Tier 1 touch-set: staging vs main)
12 files in the touch-set diffed `origin/staging` vs `origin/main`: **10 byte-identical**; only `docs/CONTEXT.md` and `docs/FOLLOW_UPS.md` differ (staging lacks the #864 fill `53a65faa`). The specific stale strings Tier 1 sweeps were re-confirmed present in the **staging** copies of both. Phase 0 evidence (gathered vs main) transfers. **Proceeded.** The CONTEXT.md/FOLLOW_UPS.md divergence is the expected promotion-time conflict noted above.

### Disposition table

| # | Item | Disposition | Evidence |
|---|------|-------------|----------|
| — | Phase 0 report (first commit) | **DONE** | `8d08eef7` |
| 1 | jointCalls fixtures (D1: jointCalls only; campaigns + settled policies pre-existing) | **DONE** | `scripts/staging/seed-fixtures.mjs` § A14 — 5 obs on agent a1 (4 UM-authored incl. 1 archived + 1 BM-authored; 2 prep-linked). `node --check` OK; key-free `--dry-run` clean (exit 0, manifest line renders). Live `--apply` is operator/staging (key-gated). |
| 2 | Net-vs-Gross value-level assertion (D2: assertion only; pin direction + cause) | **DONE** | `src/lib/__tests__/policiesDerivation.test.js` — Net (as-seeded) < Gross (lapsed status flipped) by exactly `vhfix-pol-a2-lapsed`'s settledAPI (4500); non-vacuity control (no-lapse ⇒ Net===Gross). 2/2 pass. |
| 3 | Hard-pin `portal.agencytrack.app` in verification lib | **DONE** | `scripts/verification/lib/walk-helpers.mjs` — `PROD_URL` pinned + `assertProductionHost` loud guard; `resolvePreviewUrl` fallback repointed; doc example fixed. Runtime-verified: prod paths → `portal.agencytrack.app`; guard rejects `*.vercel.app`; caller-supplied preview aliases still pass. Stray-deployment FU already logged (FOLLOW_UPS). **Resolves the "hard-pin portal.agencytrack.app" FU → post-merge closure.** |
| 4 | Register six Run-9 smokes in SMOKES.md | **DONE** | `scripts/verification/SMOKES.md` — 6 rows (a1-undo/a2-shortcuts/a3-conflicts/a4-templates/a5-bulk/f3e-series) with accurate run-mode + source columns; table boundary intact. |
| 5 | Stale-doc sweep | **DONE** | See sub-table below. |
| 6 | CI action bumps + delete gemini-review.yml | **DONE (CI-verify BLOCKED — see conflict)** | `ci.yml`: `checkout@v4→v5`, `setup-node@v4→v6` (both jobs; `node-version: 20` unchanged — project runtime). `gemini-review.yml` deleted. |
| 7 | BranchKPIStrip `%` fix + delete ManagerHeroSection orphan | **DONE** | `KPICard.jsx` `isPercent` prop + `React` import; `BranchKPIStrip.jsx` compliance `isPercent: true`. `ManagerHeroSection.jsx` + test deleted (zero real imports); 2 deletion-forced test refs cleaned (guard-list entry, dead `vi.mock`). KPICard+BranchKPIStrip tests 19/19. |

### Item 5 stale-doc sweep detail

| Target | Action |
|--------|--------|
| `docs/track-j-port-ledger.md` | Supersession banner (port-status column; "18 of 34" stale; points to 2026-07-07 recon + CONTEXT.md). |
| `docs/audits/trackj-recon-2026-07-07.md` | Supersession banner (SHIPPED/PARTIAL/**12-PENDING** counts are a 2026-07-07 snapshot, pre-Run-9/pre-Run-A). |
| `docs/CONTEXT.md` | "J2 is next" prose corrected → Track J ~2/3 shipped; Run A conformance closeout is current work. |
| `docs/design-system/screens-v2/…Reference Index.md` | "planner gated / CRO not routed" corrected → **both stale**: planner un-gated & shipped (`COMING_SOON_TABS` empty); CRO routed (`App.jsx:131`). Team Planner also flipped to SHIPPED. |
| `docs/FOLLOW_UPS.md` (index only) | Removed 2 stale index rows (`t1-compliance-scope` RESOLVED; `planner recurrence — edit-this-and-all-future` body RESOLVED `d0e74c12`). **No body dispositions changed.** |
| "Medal trio" stale FU claim (per ruling) | Recorded: recon `trackj-recon-2026-07-07.md:63` "Medal trio orphaned (cleanup FU)" annotated STALE — no confirmable 3-file trio; `MedalCoin.jsx` LIVE (`ChampionsPanel`, `ProductionLeaderboardSurface`). Cleanup FU retired. |

### ✅ RESOLVED — CI + CodeRabbit now run on staging PRs (Option A, dispatcher-authorized 2026-07-24)

The staging-PR-bypasses-both-gates conflict (below) was resolved by **Option A** (commit `8e93b588`):
- `ci.yml` `pull_request.branches` → `[main, staging]` → **CI now fires on #865 and went GREEN** (`lint-and-build` SUCCESS + `functions-tests` SUCCESS with the v5/v6 actions) — item 6's CI-green acceptance criterion is **closed**.
- `.coderabbit.yaml` `reviews.auto_review.base_branches` → `[main, staging]` (ONLY that key; `path_filters` untouched) → CodeRabbit auto-reviews staging PRs going forward (Tier 2/3 need no manual trigger).

**Reviewer disposition (Rule 21) — CodeRabbit review on #865 (3 actionable + 1 nitpick):**
| Finding | Disposition | Action |
|---|---|---|
| `ci.yml` checkout — `persist-credentials: false` | **IMPLEMENT** | Applied both jobs (`d64b0105`) — CI does no authenticated git after checkout. |
| `walk-helpers.mjs` — `assertProductionHost` should parse origin, allow only the exact prod origin | **IMPLEMENT** | Rewrote to URL-origin allowlist (`https://portal.agencytrack.app` only) — robust vs query/fragment/port + rejects spoofed subdomains & unparseable input (`d64b0105`). |
| `KPICard.test.jsx` — strengthen currency-precedence to value-level | **IMPLEMENT** | Now asserts exact `TTD 44,000` + rejects `44000%`/`44,000%`/`TTD 44,000%` (`d64b0105`). |
| Nitpick: bump to `checkout@v7`/`setup-node@v7` | **DISAGREE** | Dispatcher ruled v5/v6 (verified current 2026-07-24); recorded ruling outranks the bot. Flagged for dispatcher awareness (bot claims v7 exists). |
| Gemini | **OBSOLETE** | Consumer version sunset — "all code review activity has officially ceased." Confirms the `gemini-review.yml` deletion. |

**Amended PR HEAD (Rule 20): `d64b0105`** (was `7f6698dd` at first PR-ready report; `8e93b588` Option A; `d64b0105` CodeRabbit fixes). CI re-running on `d64b0105`.

<details><summary>Original surfaced conflict (kept for the record)</summary>

#### CI does not run on `staging` PRs (blocked the item-6 CI-green gate) — RESOLVED above

`.github/workflows/ci.yml` triggers on `on: pull_request: branches: [main]`. A PR from `run-a-tier1-hygiene` → **`staging`** does NOT match, so **neither `lint-and-build` nor `functions-tests` will run on any Run A PR into staging.** Consequences:
- The dispatcher's item-6 acceptance ("CI green = acceptance") **cannot be observed on the Tier 1 PR** — the bumped actions only execute when a PR targets `main` (i.e. the eventual staging→prod promotion PR).
- The CLAUDE.md procedural merge gate ("PR's `lint-and-build` + `functions-tests` checks show SUCCESS") is unsatisfiable on staging PRs as configured.

**Not resolved unilaterally** (per escalation rule + Rule 1). Two resolution options for the dispatcher:
1. **Add `staging` to the ci.yml `pull_request.branches` list** so CI runs on staging PRs (behavioral CI change beyond "action version bumps" — needs authorization; would let the bumps be CI-verified now).
2. **Waive CI-on-PR for staging PRs** (Rule 13): Run A staging PRs verify via LOCAL lint+test+build only; CI (incl. the bumped actions) is exercised at the staging→prod promotion PR (targets main). Bank a deferred-verification note.

**Recommendation:** Option 1 (it makes the brief's whole staging-PR flow actually gated), but it is the dispatcher's call. Local lint+test+build green stands as this run's verification substrate regardless. → **Dispatcher chose Option A (extended); resolved above.**

</details>

### Verification (local — CI-parity)
- **Lint:** ✅ clean (`npm run lint`, 0 errors / 0 warnings).
- **Full suite (`.env.local` moved aside = CI parity, VITE_FIREBASE_* unset):** ✅ **357 files / 5565 tests passed** (`npx vitest run`, 253.85s). Matches CI's env-unset baseline. New tests included: `policiesDerivation.test.js` (2), `KPICard.test.jsx` (4), `BranchKPIStrip.test.jsx` (+1).
- **Build (`npm run build`):** ✅ built in 4.44s (chunk-size >700kB warning is pre-existing/informational; PWA generated).
- **Smoke:** feature-branch preview cannot live-verify Firebase Auth (authorized-domains); auth-dependent flows verify against staging post-merge. jointCalls fixtures + Net-vs-Gross are covered by the seeded staging VH suite + the CI-gated unit test respectively. Seeder live `--apply` is operator/staging. No new user-visible runtime surface in Tier 1 warrants a preview smoke (docs / seeder / verification-lib / CI / one % formatter fix locked by unit tests).

### Rule 15 paste-backs (Tier 1)
- **Phase 0 report commit:** `8d08eef7` (docs(run-a): Phase 0 anchor verification report + dispatcher rulings).
- **Tier 1 work commit — pushed + verified:** local HEAD `989d4933e69f4adc27e88ca7bf0dde87c6fe64b2` == `origin/run-a-tier1-hygiene` `989d4933` (`git log origin/run-a-tier1-hygiene --oneline -1` → `989d4933 Run A Tier 1 — hygiene + verification substrate`).
- **Run-log fill commit:** recorded at the run-log update push (this entry).

---

## TIER 2 — Planner E1–E5

**Design authority:** Phase-0-verified [`docs/design-system/proposals/planner-scheduler-v2/README.md`](../design-system/proposals/planner-scheduler-v2/README.md) ONLY. Build order E1 → E5 → E2 → E4 → E3.

### Re-base + drift check (dispatcher ruling) — ✅ PASS
After Tier 1 PR #865 merged into `staging` (squash `4e7a287b`), the Tier 2 branch was **re-cut off the updated `origin/staging`** and the drift check re-run on **14 files** (8 planner + the 6 `smoke-run9-*.mjs`) vs `origin/main`: **ALL 14 byte-identical, 0 drift.** `useIsDesktop.js` carried forward as the first commit.

### E1/Run-9 smoke conflict → Option 1 (dispatcher ruling)
E1's desktop board (renders at `lg`≥1024) would replace the single-column views the 6 Run-9 smokes drive at their 1280px default. Resolution: pin the 6 smokes to **900×800** (sidebar rail ≥768 keeps `agent-tab-planner` nav; <1024 keeps the single-column layer) + a **drift guard** (`assertSingleColumnPlanner`: view pill present + `planner-desktop-board` absent) so a breakpoint move fails loudly. E1 board root testid locked = `planner-desktop-board`.

### Commits (branch `run-a-tier2-planner`)
| # | SHA | What |
|---|-----|------|
| 1 | `e32a7f24` | `useIsDesktop` hook (matchMedia, `lg`, jsdom-safe) |
| 2 | `2885f781` | Option A: 6 Run-9 smokes → 900×800 + drift guard + SMOKES.md note |
| 3 | `43f1e5f4` | **E1 + E5**: `PlannerDesktopBoard.jsx` (Day/3-day/Week/Follow-ups toggle, fluid columns, `dense` week cards) · `AgentPlannerPanel` `isDesktop` branch (board vs mobile views) + `renderCard` render-prop (churn/select preserved) + shared `followupsList` (desktop keeps Follow-ups) + **E5** `max-w-none` on desktop · `smoke-e1-desktop-board.mjs` acceptance smoke (1280×800, write-read-verify) + SMOKES.md row |

**E1 verification:** lint 0 · build ✓ · `PlannerDesktopBoard.test.jsx` 9/9 · `AgentPlannerPanel.test.jsx` 68/68 (66 existing + 2 desktop-switch). Full suite: two runs each failed **one different** `AgentPlannerPanel` A5-bulk test under heavy local parallel load (R6-cap, then per-op undo-entry); the A5 cluster passes **15/15 ×3** and the file **68/68 ×3** in isolation → pre-existing pattern-2 timing flake (E1 is inert in the jsdom mobile path A5 runs in). Annotated on the existing MEDIUM CI-vs-local FU (`FOLLOW_UPS.md`). **CI on PR-open is the authoritative full-suite gate.**

**E1 acceptance smoke — deferred-to-staging (not a waiver).** `smoke-e1-desktop-board.mjs` is auth-dependent (real login), so it runs against **staging after merge**, not on the feature preview (preview can't clear the Firebase authorized-domains allowlist — intended per the brief's VERIFICATION STANDARD). RTL covers the board's component logic (11 tests); the smoke is the real-DOM + real-Firestore write-read-verify, run post-merge.

**E2 — drag-drop reschedule (committed).** Board cards are draggable (grip affordance, retired cards excluded); dragging reveals drop targets — day **columns** (drop = change DAY, keep time) and per-day **gap slots** (drop = change TIME to the hole after the prior card, `computeDayGaps`). On drop, `AgentPlannerPanel.handleReschedule` calls the **EXISTING `postponeWithRebook`** (mirrors the churn Postpone path's history entry + `undoPostpone` inverse — **no propagation reimplement**, per ruling). A series instance moves just itself (single-doc rebook) and the card's existing "Only this one moved · series stays" note shows. The churn dialog stays the tap path + keyboard-accessible reschedule alternative (drag zones carry a justified `jsx-a11y` disable citing it). Column drop handler is always-attached + reads a synchronous ref, so HTML5 DnD works without a re-render race. **Verify:** lint 0 (1 justified a11y-disable) · build ✓ · `PlannerDesktopBoard.test.jsx` 13/13 (+4 E2) · `AgentPlannerPanel.test.jsx` 69/69 (+1 E2 drop→postponeWithRebook) · `planner.helpers.test.js` 36/36 (+6 gap/time-math) · `smoke-e2-drag-reschedule.mjs` acceptance smoke (1280×800, DnD write-read-verify) + SMOKES.md row.

**E4 — per-appointment notes thread (committed; Option-1 ruling, this-week scope, deploy-free).**

**D3 precondition evidence (firestore.rules, read-only — never edited):**

| Concern | Finding |
|---|---|
| **Notes storage** (appointment-scoped `notes[]` field) | `validApptWrite()` (rules:1529–1552) uses `hasAll([...])`, **not `hasOnly`** → an extra `notes[]` field is permitted (documented coarse-validation design). `allow update` (1559–1562) gates on `resource.data.agentId == request.auth.uid`. **No rules edit needed.** `updateAppointment`'s allowlist doesn't cover `notes`, so E4 uses a dedicated `addAppointmentNote` (`arrayUnion`; note `at` = client ISO string, never `serverTimestamp()` inside an array). |
| **Own-scope `prospectId` read** | `allow list` arm #1 (rules:1574–1576) = `resource.data.agentId == request.auth.uid`. **Owner field = `agentId`.** A `where('agentId','==',uid) where('prospectId','==',pid)` query is permitted (own-scoped; no cross-agent). This-week scope uses loaded data (no query); cross-time (query + `(agentId,prospectId)` index + deploy) → MEDIUM FU. |
| **Cross-agent** | Not built (D3: cross-agent = NEEDS-HUMAN-REVIEW). The read is `agentId`-scoped. |

**Build:** `addAppointmentNote` service (`arrayUnion`, client ISO `at`, `during` "THIS MEETING" flag) · `readNoteThread` (legacy `note` surfaced as first thread entry on migrate-read) · `prospectNoteHistory` (this-week own-scope) · `appointmentIsActive` · `NotesThread.jsx` (thread + add-note + "This meeting" tag, read-only when no `onAdd`) · `AppointmentSheet` renders the editable thread (plain edit only) + read-only prospect-history · `AgentPlannerPanel.handleAddNote` (during from `appointmentIsActive`; reload). **No rules edit, no index, no deploy.** **Verify:** lint 0 · build ✓ · `planner.helpers.test.js` 45/45 (+9 E4) · `NotesThread.test.jsx` 5/5 · `AppointmentSheet.test.jsx` 13/13 (+3 E4) · `AgentPlannerPanel.test.jsx` 70/70 (+1 add-note→addAppointmentNote) · `smoke-e4-notes-thread.mjs` (900×800 write-read-verify + prospect surfacing) + SMOKES.md row. Cross-time history banked MEDIUM FU (`FOLLOW_UPS.md`). **PR-body limitation:** pre-this-week notes don't surface until the FU ships.

**E3 — running-late cascade (committed; last E-feature).** Pure gap-smart math in `planner.helpers.js`: `findRunningLate` (earliest un-churned today appt past its end vs a client tick) + `computeLateCascade(appts, lateAppt, pushMin, scope)` (affected/unaffected + `gapAfterNextMin` → `recommendedScope`: "next" when the gap absorbs the push, else "all"). UI: `RunningLateSheet` (what-moves radios, +10/+20/+30, live cascade preview old→new struck, actions Push/Keep/Wrap-Kept). **Notify is D4-compliant DISPLAY-ONLY:** `tel:` / `wa.me` deep-links (only when the prospect has a phone) + copy-to-clipboard prepared message — **no CF, no API, no send path.** Surfacing: an auto **banner** (client tick, TT-local) when an appt overran + a churn "Running late" action (deterministic). `handlePushLate` batches the shifts through the EXISTING `bulkUpdateAppointments` (undo restores prior startTimes) — no new mutation path. **Verify:** lint 0 · build ✓ · `planner.helpers.test.js` 52/52 (+7 E3) · `RunningLateSheet.test.jsx` 6/6 · `AgentPlannerPanel.test.jsx` 71/71 (+1 churn→sheet→push→bulkUpdate) · `smoke-e3-running-late.mjs` (900×800 write-read-verify) + SMOKES.md row.

**TIER 2 COMPLETE — E1 · E5 · E2 · E4 · E3 all committed on `run-a-tier2-planner`.** Opening the Tier 2 PR into `staging`; HOLD at PR-open (CodeRabbit auto-fires via the Option-A base_branches).

## TIER 3 — Track J conformance closeout
_Pending. Requires Tier 1 fixtures on the run's staging lineage._

---

## Self-critique (Rule 22) — Tier 1 known gaps
- **Seeder fixtures not live-executed.** The jointCalls `jc()` block and the seeder's `--apply` path are verified by `node --check` + key-free `--dry-run` only; the actual write + the VH meeting-leg read are staging/operator-gated (no staging SA key in a feature worktree, and writing staging is a real side effect). Live fixture consumption is verified post-merge on staging.
- **CI-trigger conflict is unresolved by design** (surfaced above) — the item-6 bumps are locally sound but not CI-exercised until a main-targeting PR.
- **Net-vs-Gross assertion is a value-level CI stand-in**, not a live staging integration read; it mirrors the seeded a2 fixtures by value (Rule 17 provenance) but does not itself query staging.
- **Doc-sweep banners are judgment-framed.** The recon banner scopes staleness to "port-status counts" while asserting the classification "remains valid"; if any per-screen classification has also drifted post-Run-9, the banner under-claims (the medal-trio cell was the one such drift found and corrected).
