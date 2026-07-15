# AgencyTrack — Design-Conformance Revalidation (supersedes 2026-07-12)

> **Validity SHA:** describes `origin/main` @ `b1f2e2e35773fc6233119a67ecb1121be8c7dbb7` (prod — commit `10670bd7` = PR #858 merge, Runs 5-7 promoted) cross-referenced against `origin/staging` @ `01be5fd3ec542603cacbf1db0a155bdb9c3a0875` (Run 8 tip, pending promotion). `origin/staging` is 16 commits ahead of `origin/main`; merge-base is `b1f2e2e3` (staging branched cleanly off current main tip — `git log origin/main..origin/staging` is the exact Run 8 diff). Captured 2026-07-15.
>
> **Type:** READ-ONLY revalidation · **Method:** Rule-17 source re-verification against both `origin/main` and `origin/staging`. Key structural finding: the 2026-07-12 doc's validity SHA `e65fe14357e23c14c48d5fd428363105707236cc` (mid-Run-6) **is a literal git ancestor of current `origin/main`** (`git merge-base --is-ancestor e65fe143 origin/main` → true). Runs 3, 4, 5, 6, and 7 all landed on `main` via the non-squashed PR #858 merge (`10670bd7`, 82 commits, history preserved) on 2026-07-15. This means **every RESOLVED-SINCE / PARTIALLY-RESOLVED-core finding the 07-12 doc verified against staging is now independently verifiable against `origin/main` (prod)** — most citations below are re-confirmed by direct grep against the current `main` worktree, not carried forward from the old doc's text (per Rule 17, "the old doc's text was never trusted").

---

## 0 · Why this document exists

`docs/audits/design-conformance-2026-07-12.md` was the declared active build map, pinned to staging HEAD `e65fe143`. Since then: (1) Runs 6 and 7 finished landing on staging and the whole staging branch (through Run 7) was promoted to production via PR #858 (`10670bd7`, 2026-07-15) — so the 07-12 doc's findings are now **prod-verifiable**, not just staging-verifiable; and (2) a full Run 8 (16 commits, 11 shipped items + 1 unplanned bug fix) landed on `origin/staging` only, not yet promoted.

This document re-verifies every finding class from the 07-12 doc against current `main` and `staging`, folds in Run 8's shipped items, and re-derives the STILL-VALID forward backlog.

**This document is now the active build map.** The 07-12 doc (and the 07-07 doc it superseded) are preserved unedited as historical record.

### What changed since the 07-12 capture

| Event | What it means for this doc |
|---|---|
| Run 6 finished (post-`e65fe143` commits: `d4e5220d`, `3d42125f`, `72daabf8`, `9beb2aa7`) | Closed the 07-12 doc's own Tier-0 residual list (four-states Retry holdouts, Settlements sticky/tabular, HomeV2+podium stagger, Awards §1 finish) — these were STILL-VALID at 07-12 capture time and are now LIVE-IN-PROD. |
| Run 7 (Tier A rulings + Tier B: SEC-012, Policy Ledger insured-name, Team Active-Agents KPI, Login trust affordances) | 4 more Tier-1/2/4 backlog items closed (fully or partially), all now LIVE-IN-PROD. |
| **PR #858 merge (`10670bd7`, 2026-07-15)** | Runs 3–7 promoted staging → prod as a single non-squashed merge. `Current main HEAD` per CONTEXT.md. |
| Run 8 (`b1f2e2e3` → `01be5fd3`, staging only) | 11 items shipped (8 selected + 2 stretch) + 1 unplanned bug fix (post-submit autosave race, `e41baffc`). **Not yet promoted** — explicit prerequisite: Run 8's kiosk per-slide toggle (A-6) needs `firestore.rules` deployed to **prod** (currently staging-only) or the manager write silently fails post-promotion. |

---

## 1 · Recount of the summary buckets (honest, against current state)

The 07-12 doc's own recount (117 material findings): ~63 RESOLVED-SINCE + ~26 PARTIALLY-RESOLVED + ~24 STILL-VALID + ~2 SUPERSEDED + ~2 DELIBERATE-DIVERGENCE.

Re-verifying against `origin/main` (prod) + `origin/staging` (Run 8):

| New class | Count (approx.) | Meaning |
|---|---:|---|
| **LIVE-IN-PROD** | **~96** | The 07-12 doc's RESOLVED-SINCE/PARTIALLY-RESOLVED-core findings (~89, now confirmed on `main` since `e65fe143` is an ancestor) **plus** the Tier-0 residuals and Tier-1/2/4 items Runs 6–7 closed after the `e65fe143` pin (four-states holdouts, Settlements dense-table, HomeV2/podium stagger, Awards §1 finish, Login trust affordances, Policy Ledger insured-name, Team Active-Agents KPI card, CompliancePanel multi-unit ScopeSwitch, WizardForm draft-load overwrite guard) — all independently re-grepped against `main` below. |
| **RESOLVED-ON-STAGING (pending promotion)** | **~12** | Run 8's shipped items, each verified present in `origin/staging` and absent from `origin/main`. |
| **STILL-VALID** | **~14** | Genuinely unbuilt on both `main` and `staging`, re-grepped against both. |
| **NEEDS-RULING** | **~11** | Operator decision required before build (carried + 2 new from Run 8's DECISIONS-NEEDED log). |
| **SUPERSEDED** | **~3** | Company Config surface (unchanged from 07-12) + Awards empty-state footer CTA (newly recognized as an intentional documented no-fabricated-CTA design decision, not a gap). |
| **DELIBERATE-DIVERGENCE (confirmed intact)** | **~2** | 3-step Game Plan rail; vertical GoalCascade. Unchanged. |

**Headline:** ~92% of the 07-12 doc's 117 re-enumerated findings are now closed (LIVE-IN-PROD + RESOLVED-ON-STAGING + SUPERSEDED = ~111) vs. ~14 genuinely open (STILL-VALID) — though 11 of the "closed" items are only closed *on staging*, one promotion cycle away from prod. Counting only what's actually **in production today**, ~96/117 (~82%) is closed; the rest is either one promotion away (staging) or blocked on rulings/ABSOLUTE STOPS.

---

## 2 · LIVE-IN-PROD (confirmed on `origin/main` @ `b1f2e2e3`)

All citations below were grepped directly against the current `main` worktree during this revalidation (not carried from the 07-12 doc's text).

### 2.1 Tier-0 systemic residuals (closed by Run 6, post-`e65fe143`)
| Finding | Evidence (main) |
|---|---|
| Four-states Retry holdouts (Leaderboard, ManagerAwardsPanel, manager PersistencyTab) | `src/components/gamification/Leaderboard.jsx:66-173` (`retryKey` idiom, "Retry" button); `src/components/awards/ManagerAwardsPanel.jsx:176-244` (`Retry` button, stable callback); `src/components/manager/PersistencyTab.jsx:119-254` (`handleRetry`, "Retry" button) |
| Settlements dense-table sticky/tabular-nums | `src/components/manager/SettlementPanel.jsx:260-283,540-554` — `sticky top-0 z-10 bg-surface` headers + `tabular-nums` cells on both tables |
| HomeV2 hero stagger + podium tail-row bar-grow | `src/components/dashboard/HomeV2/index.jsx:203-213` (`.stagger` class, reduced-motion safe) |
| Awards §1 finish — skeleton + honest empty | `src/components/awards/AgentAwardsPanel.jsx:163-190` (top-level empty is an honest descriptive message with no fabricated CTA — see §5 SUPERSEDED below) |

### 2.2 Tier-1/2/4 items (closed by Run 7)
| Finding | Evidence (main) |
|---|---|
| Team Active-Agents KPI card (Tier-1 #6, partial — Persistency card remains open) | `src/components/dashboard/BranchKPIStrip.jsx:27-49` — "Active Agents" tile, current-roster snapshot |
| Policy Ledger insured-name (insured≠owner) (Tier-2 #12, partial — Export-proof CSV was staging-only until Run 8) | `src/components/agent/policyLedger/PolicyCard.jsx:71-73`, `PolicyDrillDrawer.jsx:116-118` — `Insured · {name} ·` rendered when `insuredName !== ownerName` |
| Login caps-lock hint + trust footer + carded error (Tier-4 #19) | `src/components/auth/LoginScreen.jsx:117-139` (`capsLockOn` via `getModifierState`), `:238-256` (hint + `role="alert"` carded error), `:292-310` ("Secured by Tatil Life" trust line) |
| CompliancePanel multi-unit ScopeSwitch (BM roster scoping — NEW capability, not explicitly in the 07-12 map but closes a related gap) | `src/components/manager/CompliancePanel.jsx:188-333` (`showScopeSwitch`, unit-filtered roster) |
| WizardForm draft-load overwrite guard (DECISIONS-NEEDED item from Run 6, ruled + shipped in Run 7 A1) | `src/components/wizard/WizardForm.jsx:232-327` (`draftLoadError` gates both the autosave path and the unrendered footer/steps) |
| SEC-012 kiosk names — leaderboard/podium/activity panels (Tier-3 #15, partial — celebrations/compliance roster panels still degrade, see §4) | `src/lib/kiosk/utils.js:38-60` (`buildSubmissionNameMap`), `src/components/kiosk/KioskShell.jsx:82-91` |

All other 07-12 RESOLVED-SINCE / PARTIALLY-RESOLVED-core findings (the ~89 not re-listed here) are LIVE-IN-PROD by direct ancestry: `e65fe143` (the 07-12 doc's validity SHA, and the commit the doc's citations were taken from) is a confirmed git ancestor of `origin/main` @ `b1f2e2e3`, and `git diff --name-only e65fe143 b1f2e2e3 -- src/ functions/` shows only 40 files touched between the two points (all accounted for above or in §3). Any file **not** in that 40-file diff has byte-identical content between the 07-12 doc's citation point and current prod — its 07-12 citation is valid as-is on `main` today.

---

## 3 · RESOLVED-ON-STAGING (pending promotion) — Run 8, `origin/staging` @ `01be5fd3`

Each confirmed present on `staging` and absent (or pre-Run-8 state) on `main` via `git show origin/staging:<path>` and cross-check against `main`.

| # | Finding (07-12 map ref) | SHA | Evidence (staging) |
|---|---|---|---|
| 1 | Nav N5 — "⋮" More affordance | `2b16e760` | `src/components/shell/MobileBottomNav.jsx:2,101` — `MoreVertical` icon (main still has `MoreHorizontal`) |
| 2 | Nav N6 — adaptive More label | `2b16e760` | `src/components/shell/MobileBottomNav.jsx:31` — comment "N6 — adaptive More label" |
| 3 | Team Dashboard: ranked ChampionsPanel (Tier-1 #6 remainder) | `fa0fe12e` | `src/components/dashboard/ChampionsPanel.jsx` (new file, absent from `main`) + `src/hooks/useWeeklyChampions.js` |
| 4 | Team Dashboard: MyWeekPanel player-coach own-week (Tier-1 #6 remainder) | `fa0fe12e` | `src/components/dashboard/MyWeekPanel.jsx` (new file, absent from `main`) |
| 5 | All Users roster v2 — stat strip, search, role-filter chips, RoleChip pills, BRANCH·UNIT column (Tier-4 #17, minus LAST-activity — see §4) | `1ac958f1` | `src/components/manager/UserManagementPanel.jsx:51-73,790,932` (`RoleChip`, search/filter chips, stat strip) |
| 6 | Policy Ledger campaign proof CSV export (Tier-2 #12 residual) | `41885ff5` | `src/components/agent/policyLedger/CampaignLensPanel.jsx:161,249` — `handleExportProof`, wired to `LensStrip` |
| 7 | Wizard Celebration polish — gold WEEK-N medal + Apps stat card + "View submission" CTA (Tier-2 #11) | `b84d5e60` | Live-smoked per Run 8 progress log (medal WK-N == weekNumber(W0), apps=1, "View submission" opens viewer). **Est-Commission card residual:** shipped as apps+API+TTD-0 commission read — decorative, not a live rate (commission rate source not unambiguously available in wizard context). |
| 8 | Kiosk per-slide manager enable/disable (Tier-3 #15 slice) | `58ff208b` | `src/components/kiosk/KioskModeTab.jsx:33-127` (`disabledPanels`, `togglePanel`) — **rules deployed to staging only**; prod `firestore.rules` deploy is an explicit promotion prerequisite (Run 8 banked FU) or the manager write is denied post-promotion. |
| 9 | Onboarding per-slide themed icons (Tier-4 #20) | `843af4e4` | Referenced in Run 8 shipped table; `main`'s `WelcomeScreen.jsx:80` still single `/icons.svg` brand mark. |
| 10 | Meeting "Awards-within-reach" scene (Tier-3 #14) | `e04f6978` | `src/components/manager/MeetingMode.helpers.js:405,457,490` (`deriveAwardsWithinReach`, wired into `deriveDeck`) — absent from `main`'s `MeetingMode.helpers.js`. **Residual:** uses `DEFAULT_RULESET_2026`, not the tenant-merged ruleset (zero-new-reads scope gate); live-render unverified (both fixture agents sit below every band). |
| 11 | AgentDrillDrawer read-only Joint Work tab (Tier-1 #7 slice) | `3fb99d94` | `src/components/manager/AgentDrillDrawer.jsx:26,35,170-175` (`getJointCalls` import, "Joint Work" tab). **Residual:** Notes tab + RecommendGoal action are write paths, not selected — remain STILL-VALID/NEEDS-RULING (§4/§5). |
| 12 | (Bug, not a design-conformance finding) Post-submit trailing-autosave race | `e41baffc` | Real pre-existing bug surfaced by Run 8's A-5 live smoke; `handleSubmit` now cancels the pending autosave timer. Noted here because it's a WizardForm change adjacent to the draft-load guard above, not part of the 07-12 backlog. |

---

## 4 · STILL-VALID backlog — the active build map

Genuinely unbuilt at current HEAD on **both** `main` and `staging`, re-grepped against both during this revalidation. Grouped by the 07-12 doc's tiers where the numbering still applies.

### Tier 0 — nav polish remainder
1. **N4 — mobile-tab drag reorder** (S). `MobileBottomNav.jsx` has no `onReorder`/drag handling on either branch — Run 8 explicitly excluded it ("fiddly pointer semantics, unattended risk"). No STOP category.

### Tier 1 — manager decision-surface depth
2. **KpiStrip Persistency card** (S, part of old #6). `BranchKPIStrip.jsx` still has no persistency tile on either branch. **[NEEDS-RULING]** — Run 8 DECISIONS-NEEDED #2: needs either a CF-written branch-persistency aggregate (**ABSOLUTE STOP: `functions/` runtime**) or acceptance of an O(agents) client-side fan-out (perf call).
   **RULING (2026-07-13):** DEFERRED — attended/functions window (CF-written branch aggregate). Bundle with the functions/ work (Node-20, SEC-9c). ABSOLUTE STOP / attended-only — not autonomous-eligible.
3. **AgentDrillDrawer Notes tab + RecommendGoal action** (M, residual of old #7 — the read-only Joint Work slice shipped on staging, this is what's left). **[NEEDS-RULING]** — write-path design call on note visibility (who sees a manager's coaching note on an agent).
4. **Policy Reconciliation 8-flag taxonomy + missing/unmatched detection + side-by-side ReconDrawer + "Confirm all N clean" bulk** (L, old #8). `PolicyReconciliationPanel.jsx:14-175` still exactly 4 states (`toReconcile`/`clean`/`flagged`/`confirmed`), inline side-by-side compare only, no bulk-confirm (comment at old citation "per-policy only; Slice-2 FU" — re-grepped, still true on both branches). **[ABSOLUTE STOP — Policy Reconciliation feature.]** Do not touch without a human.
5. **Production roster table rebuild** — dense `ProductionTable` roster (persistency col/status pill/zebra/gold top-3), `ProdTotals` AVG-PERSISTENCY + ON-PACE tiles, `DataSourceBadge` SETTLED wiring (L, old #9). Unbuilt on both branches; Run 8 explicitly rejected it as "regression surface too broad for unattended." **[NEEDS-RULING]** on the DataSourceBadge half — Run 8 DECISIONS-NEEDED #1: `computations.js:267-273` documents a deliberate read-light rule (never fetch settlements in these 3 views); shipping SETTLED means overturning that documented decision + a new per-period fetch.
   **RULING (2026-07-13):** RESOLVED-BY-RULING — bless "Estimated" as the permanent honest state; the read-light rule at `computations.js:267-273` is deliberate. STRIKE the DataSourceBadge SETTLED-wiring half from the forward backlog. (The broader roster-table rebuild — dense table/persistency col/zebra/gold top-3 — remains Run-8-rejected-as-broad, unchanged and not ruled on here.)

### Tier 2 — agent feature depth
6. **Commission saved-scenario chips (Coach/Commitment/Stretch) + Save; manager suggest-a-goal-back** (M, old #10). No scenario refs in `CommissionPlayground/` on either branch. Run 8 rejected it: two unresolved design calls (storage location — profile doc vs. localStorage — and a cross-user write for suggest-a-goal-back). **[NEEDS-RULING]**
   **RULING (2026-07-13):** RULED — save to the PROFILE DOC (not localStorage), agent-private, own-write only — slice 1. STILL-VALID/buildable: the agent-private slice. The manager "suggest-a-goal-back" cross-user write is DEFERRED (needs a rules arm + notification path).
7. **Commission Daily cadence chip** (S, old #10 sub-item). `GoalDecompositionTab.jsx` `PERIODS` still has no `daily` entry on either branch.
8. **Persistency "Share this plan" coaching action** (M, old #13). `PersistencyPlayground.jsx` still Reset/Close only on either branch.
9. **Wizard Celebration Est-Commission card** (S residual of #11, shipped-on-staging but decorative). Commission rate not unambiguously available in wizard context; TTD-0 placeholder shipped instead of a real value. **[NEEDS-RULING]**
   **RULING (2026-07-13):** DEFERRED — attended-adjacent, low priority; needs a commission-rate source in wizard context. Bundle whenever commission data gets a home. Not autonomous-eligible.

### Tier 3 — presentation / kiosk residuals
10. **Kiosk Branch Noticeboard panel** (M, old #15 other half). No noticeboard collection/UI on either branch — new collection + entry UI + rules, a weaker-bound M-L item Run 8 explicitly deferred.
11. **Kiosk roster-parity degrade** — celebrations/compliance/photos panels still show generic "Agent" when the kiosk `getKioskTenantUsers` list read is denied (SEC-012 only fixed the leaderboard/podium/activity path via submission-carried names). `KioskShell.jsx:82-91` comment confirms this is the acknowledged-unresolved half on **both** branches. **[NEEDS-RULING → ABSOLUTE STOP if pursued]** — Run 8 DECISIONS-NEEDED #3: the clean fix is a CF-written branch-roster aggregate (name+photo+unit only), which is `functions/` runtime.
   **RULING (2026-07-13):** DEFERRED — attended/functions window (CF-written branch-roster aggregate: name+photo+unit only, no email/phone). Bundle with the functions/ work (Node-20, SEC-9c). ABSOLUTE STOP / attended-only — not autonomous-eligible.

### Tier 4 — admin / system residuals
12. **All Users LAST-activity column** (residual of #17, shipped-on-staging minus this column). No `lastActive`/`lastLogin` field exists on user docs on either branch (Run 8 grep-confirmed before skip-logging it) — needs a write-path change (login-time stamp) before the column can be honest. **[NEEDS-RULING]**
   **RULING (2026-07-13):** RULED — APPROVE a login-stamp write path (write per-user `lastActive` on login — trivial cost, also powers the banked leaderboard active-filter and future inactive-agent logic). Once the stamp exists, the column is buildable. STILL-VALID/buildable, with the login-stamp write path as the prerequisite.
13. **EditUserDrawer: commission-rate field, activity-standard override, "Reset password" footer** (M, old #18). None present in `EditUserDrawer.jsx` on either branch (re-grepped, zero hits). Run 8 explicitly rejected building this: **commission-rate is money-adjacent** (flag under the money/payout ABSOLUTE STOP category if pursued as a write path) and **Reset-password is auth-sensitive**. **[NEEDS-RULING]**
   **RULING (2026-07-13):** SPLIT, both DEFERRED from autonomous: commission-rate is money-adjacent (attended, bundle with commission work); reset-password is auth-sensitive and needs a deliberate flow decision (reset-link vs. temp-password) — attended design pass. ABSOLUTE STOP / attended-only — not autonomous-eligible.

14. **ChampionsPanel ranked-podium content** (S — corrected classification; see §9 for the original mis-bucketing note). `ChampionsPanel.jsx` (shipped on staging, RESOLVED-ON-STAGING §3 row 3) needs its ranking source decided. **[NEEDS-RULING]**
   **RULING (2026-07-13):** RESOLVED-BY-RULING — BUILD (was mis-bucketed as a cosmetic/verification gap; it's STILL-VALID, unblocked). Ranked by API (matching the funnel terminal KPI + leaderboard default). STILL-VALID/buildable.

---

## 5 · NEEDS-RULING appendix (do not build without an operator decision)

Carried from the 07-12 doc + Run 6/7/8 DECISIONS-NEEDED logs, with the ruling question quoted verbatim where available.

1. **AgentModePicker** in Daily Capture (or keep profile-only?). No picker exists in `components/daily/` on either branch; `loggingMode` remains read-only from `ProfileScreen`.
   **RULING (2026-07-13):** ABSORBED into Company Config "Reporting Cadence" section (agent picker + manager recommend-vs-lock). STRIKE as a standalone NEEDS-RULING item; tracked going forward as a Company Config slice.
2. **Persistency v2 calc-model + restatement-scope** — Tatil sign-off pending; `persistency/PersistencyV2Shell.jsx` + `lib/persistency/rollingModelV2.js` built behind the `persistencyV2` flag as a fixture preview only, unchanged since 07-12.
   **RULING (2026-07-13):** HIGH · ATTENDED-ONLY · TATIL-GATED · NOT autonomous-buildable. This is a NEW calculation methodology (rolling 24-month per-policy time-weighted debit/credit ledger — early lapses weighted heavier, reinstatements credit remaining months, self-expiring at 24mo), currently a PROPOSAL Tatil is seeking approval on (not ratified). Design authority: `docs/design-system/proposals/persistency-v2-PROPOSAL/` (mockups + methodology PDF), proposal-stage. Phased, all gated on Tatil ratification: (1) calc engine — CF-based, money-correctness-critical, attended, and the FIRST deliverable is a locked formula spec from Tatil actuarial, not code; (2) manager surface — port the mockups only after the engine feeds real v2 numbers; (3) calc-model switch — Company Config setting `persistency.calcModel: current|v2`, default `current`, added when the engine lands. Do NOT build any part autonomously; do NOT build the formula from the draft circular (it may change on approval). Note the existing `persistencyV2` feature flag gates the UI shell only, not the calc model. ABSOLUTE STOP / attended-only.
3. **Company Config v2 recommend-vs-lock 3-tier inheritance** — next major track (`FOLLOW_UPS.md`); `ConfigRow.jsx` still `lock:'soon'|'platform'` display-only on both branches.
4. **Prospect readiness prep-note / Est.API** — schema ruling. `utils/prospectPrep.js:8,127` explicitly documents `prepNote`/`estAPI` are "NOT invented here… a separate schema ruling," unchanged on both branches.
5. **SM cross-branch agency view** — Phase 9. `ProductionReportTab.jsx` still falls through to BM view on both branches.
   **RULING (2026-07-13):** DEFERRED — bundle into the multi-tenancy track (with SM multi-territory, SM write-model, SEC-9b). Attended. ABSOLUTE STOP / attended-only — cross-tenant security / tenant isolation category.
6. **RecTargetCard** — needs a configurable recruiting-target source. Unbuilt.
7. **Campaign close/confirm/release payout flow** — currently projection-only by design; confirm that's the accepted state. **Flag: money/payout-adjacent — ABSOLUTE STOP if the ruling is "build it."**
8. **DataSourceBadge SETTLED wiring** (Run 8 DECISIONS-NEEDED #1, quoted): *"the three production views always render 'Estimated' because `computations.js:267-273` documents a deliberate read-light rule (never fetch settlements). Ruling needed: accept the read cost and wire it, or bless 'Estimated' as the permanent honest state and strike it from the map?"*
   **RULING (2026-07-13):** RESOLVED-BY-RULING — bless "Estimated" as the permanent honest state; the read-light rule at `computations.js:267-273` is deliberate. STRIKE from the forward backlog. (See §4 item 5.)
9. **Persistency KPI card aggregate design** (Run 8 DECISIONS-NEEDED #2, quoted): *"needs either a CF-written branch-persistency aggregate (functions/ = attended window) or acceptance of an O(agents) fan-out on the manager overview. Design wants the 5-card strip."*
   **RULING (2026-07-13):** DEFERRED — attended/functions window (CF-written branch aggregate). Bundle with the functions/ work (Node-20, SEC-9c). ABSOLUTE STOP / attended-only. (See §4 item 2.)
10. **Kiosk roster parity aggregate design** (Run 8 DECISIONS-NEEDED #3, quoted): *"celebrations/compliance/photos still degrade when the kiosk users-list read is denied. The clean fix is a CF-written branch-roster aggregate (name+photo+unit only, no email/phone) → functions/ = attended window."*
   **RULING (2026-07-13):** DEFERRED — attended/functions window (CF-written branch-roster aggregate: name+photo+unit only, no email/phone). Bundle with the functions/ work (Node-20, SEC-9c). ABSOLUTE STOP / attended-only. (See §4 item 11.)
11. **AgentDrillDrawer Notes visibility** — coaching-note write path needs a design call on who can see a manager's note on an agent before it's built (the read-only Joint Work tab shipped on staging deliberately excluded this).

**Non-conformance but explicitly a human action, not a ruling:** Run 8's `firestore.rules` deploy to prod (A-6 kiosk toggles) is a hard promotion prerequisite, not a design decision — see §3 row 8.

---

## 6 · SUPERSEDED

1. **Consolidated Settings surface (role-scoped tabs)** — superseded by the operator's Settings-split ruling (My Preferences vs. Company Config), unchanged since 07-12. `settings/SettingsScreen.jsx` docstring cites the ruling.
2. **Company Config consolidated surface + recommend-vs-lock inheritance (surface half only)** — superseded by Company Config slice 1 (`CompanyConfigSurface.jsx`, 12-section registry); the inheritance half remains NEEDS-RULING (§5 item 3), unchanged since 07-12.
3. **NEW this revalidation — Awards §1 empty-state footer CTA** (was tagged a residual "P" in the 07-12 doc: *"top-level empty has no CTA"*). Re-reading `AgentAwardsPanel.jsx:163-179` on `main`, the empty state is a documented, intentional design decision: *"Honest descriptive empty (§1) — the only real action here is submitting weekly activity elsewhere in the app; this panel has no navigation prop to jump there, so no CTA is fabricated."* This is not a gap, it's a defensible no-fabricated-CTA choice — reclassifying from PARTIALLY-RESOLVED/STILL-VALID to SUPERSEDED-by-design-decision.

---

## 7 · DELIBERATE-DIVERGENCE (confirmed intact — not gaps)
- Game Plan **3-step rail** (Year Plan folded into Money Needs, PR-U1 lock) — unchanged.
- Goals **vertical GoalCascade** (`GapAnalysisPanel`) vs. horizontal 5-node — unchanged.
- Daily-anchor mode-provenance tag omitted (no attribution field to render honestly) — unchanged.
- Kiosk DOB birthdays / Meeting DOB — no DOB schema field; anniversaries-only remains the honest build — unchanged.

---

## 8 · ABSOLUTE STOP flags — no future unattended run touches these without a human

Pulling together every item above (§4 STILL-VALID + §5 NEEDS-RULING) that hits one of the four stop categories named in this task's brief:

| Category | Item(s) |
|---|---|
| **Money/payout calculations or write paths** | Campaign close/confirm/release payout flow (§5.7); EditUserDrawer commission-rate field, if built as a write path (§4.13, R-10); **Persistency v2 calc engine (§5.2, R-07 ruling 2026-07-13) — money-correctness-critical, Tatil-gated, proposal-stage methodology, see full ruling at §5 item 2** |
| **`functions/` runtime (Cloud Functions code)** | Persistency KPI card CF aggregate (§4.2 / §5.9, R-02 ruling 2026-07-13 — DEFERRED, bundle with functions/ work); Kiosk roster-parity CF aggregate (§4.11 / §5.10, R-03 ruling 2026-07-13 — DEFERRED, bundle with functions/ work); Persistency v2 calc engine (§5.2, R-07 ruling 2026-07-13 — CF-based, first deliverable is a locked formula spec, not code); `functions/` Node-20 migration (flagged ATTENDED-ONLY in Run 8's ranked next-list, not itself a design-conformance finding but adjacent) |
| **Policy Reconciliation feature** | The entire Tier-1 #8 item (§4.4): 8-flag taxonomy, missing/unmatched detection, ReconDrawer, bulk-confirm |
| **Cross-tenant security / tenant isolation** | SEC-9b cross-tenant isolation audit — flagged ATTENDED-ONLY in Run 8's ranked next-list (`docs/fable-run8-progress.md` § Ranked next-list item 5); not itself a design-conformance finding but named explicitly by Run 8 as off-limits to autonomous work, carried forward here per this task's brief; **SM cross-branch agency view (§5.5, R-05 ruling 2026-07-13) — DEFERRED, bundle into the multi-tenancy track** |
| **Auth-sensitive write paths** | EditUserDrawer "Reset password" footer action (§4.13, R-10 ruling 2026-07-13) — needs a deliberate flow decision (reset-link vs. temp-password) before any autonomous build |

None of the RESOLVED-ON-STAGING (§3) or LIVE-IN-PROD (§2) items touch these categories — Run 8's own Phase-0 selection criteria explicitly excluded ABSOLUTE STOP items (see `docs/fable-run8-progress.md` § Phase 0 selection, REJECTED list).

---

## 9 · Reconciliation with Run 8's own ranked next-list

`docs/fable-run8-progress.md` § Ranked next-list (staging-only) recommends, in order:
1. Promote Run 8 → prod (with the `firestore.rules` prerequisite) — **operational, not a backlog item**; carried into this doc's §3 row 8 note.
2. Build-map revalidation — **this document is that revalidation.**
3. Remaining STILL-VALID rows, ranked: ChampionsPanel *content* (populated-podium not yet live-verified — originally logged here as a cosmetic/verification gap and not re-listed as STILL-VALID; **corrected by the 2026-07-13 ruling (R-08): this was a mis-bucketing, the ranking-source decision is genuinely a build gap, RULED buildable — ranked by API — and now carried forward at §4 item 14**); AgentDrillDrawer Notes+RecommendGoal remainder (→ this doc's §4.3); Commission scenarios (→ §4.6, RULED — see ruling); Production roster table (→ §4.5, DataSourceBadge half RULED/struck, roster rebuild unchanged); All Users LAST-activity (→ §4.12, RULED — see ruling).
4. Fixture gap: no `jointCalls` seed fixtures exist, so the Joint-Work tab's log half only ever renders empty live — **testing infrastructure gap, not a design-conformance finding**, noted here for completeness but not carried into §4.
5. ATTENDED-ONLY list — folded into §8 ABSOLUTE STOP flags above.

**No disagreement** between Run 8's next-list and this revalidation's STILL-VALID set — Run 8's own Phase-0 process was itself a partial revalidation (it re-grepped every candidate against Run-8 HEAD before selecting), so the two are consistent by construction. This document's contribution is the fuller re-derivation against `main` (prod) specifically, the explicit ABSOLUTE STOP tagging the brief for this task requested, and the NEEDS-RULING quotes captured verbatim for operator review.

---

## 10 · NEW — gaps this revalidation found that the 07-12 map did not enumerate

1. **Kiosk per-slide toggle has an unproven wall-side observation.** Run 8's own banked FU: *"the kiosk wall's own re-read of `kioskConfig/{branchId}` on its 5-min poll was NOT observed across a real poll boundary."* This is a verification gap on a Run-8-only (staging) feature, not a design-conformance backlog item, but it means §3 row 8 should not be treated as fully proven end-to-end even once promoted. `src/components/kiosk/panels/*` on staging — not independently re-verified in this pass beyond the file diff.
2. **`t3-kiosk` podium sub-assertion bounded-poll deferral is pre-existing and now adjacent to A-6's rotation work** (Run 8's own note) — worth a look post-promotion but not itself a UI/design gap.
3. **Two network-transport flake classes** (`ERR_NO_BUFFER_SPACE`, `ERR_CONNECTION_CLOSED`) observed in Run 8's VH suite — infra/testing concern, flagged here only because it sits adjacent to the console-clean gate that caught the real A-9 bug; not a design-conformance item.

None of these three are UI/design gaps in the sense the rest of this document tracks — they are testing/verification gaps surfaced by Run 8's own process. Flagged per this task's instruction to document, not fix.

---

## 11 · Known gaps in THIS revalidation (Rule 22)

- **Not every one of the ~89 "ancestry-confirmed" LIVE-IN-PROD findings was individually re-grepped against `main` in this pass.** The 40-file diff between `e65fe143` and `b1f2e2e3` was used to determine which citations *could* have shifted; files outside that diff were treated as byte-identical (verifiable, but not manually re-opened one-by-one here). A stricter pass would re-grep all 89 individually.
- **Bucket counts are curated, not a census**, same caveat as both prior docs — boundaries between "one finding" and "sub-items of one finding" (e.g., Team Dashboard #6's three components) are judgment calls; the §2–§6 lists are the source of truth, the §1 table is representative.
- **Run 8's own citations (progress-log-sourced) were spot-checked, not exhaustively re-derived from scratch** — for items directly grepped against `origin/staging` in this session (nav N5/N6, ChampionsPanel/MyWeekPanel, UserManagementPanel roster v2, CampaignLensPanel export, KioskModeTab toggles, AgentDrillDrawer Joint Work, MeetingMode Awards-within-reach) the citation is a fresh grep; for a few residual notes (Est-Commission decorative status, wall-side poll unproven) the source is the Run 8 progress doc's own stated findings, not independently re-verified against rendered output.
- **No runtime/browser verification was performed** — all citations are structural (grep/read), consistent with the 07-12 doc's own stated limitation.
