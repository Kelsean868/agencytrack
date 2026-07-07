# Pop-in All-Roles Sweep + Prefetch Map

**Date:** 2026-07-07
**Branch:** `recon/popin-allroles` (off `main` @ `753d9f2b`)
**Role:** READ-ONLY recon. No source touched. One report file written; no merge, no deploy.
**Tool:** `scripts/verification/motion-verifier.mjs --sweep` (reload-isolated cold measurement of every nav tab per role) + `lib/motion_analyze.py`. Target: **production** `https://portal.agencytrack.app` (the real ground truth; READ-ONLY navigation + CDP screencast, no Firestore writes).
**Predecessors:** `docs/design/motion-popin-systemic-fix.md` (#830 conclusion — skeletons are the fix, prefetch for worst first-open), `docs/audits/motion-recon-2026-07-06.md` (motion substrate), the shipped POCs #826 (data-gated whole-screen entrance) + #829 (game-plan prefetch).

---

## Summary

- **The pop-in is a mount-fetch loading-state defect, app-wide.** `onSnapshot` appears in **exactly one** service — `gamePlanPrefetch.js`, the #829 POC ([grep: 41/42 services use one-time `getDoc`/`getDocs` only](src/services/)). Every screen fetches on mount (`loading=true → getX() → setLoading(false)`) and renders real content **after** the dashboard's 320ms `screen-enter` fade. Roughly **half of all data-backed tabs across every reachable role pop.**
- **The #826+#829 POC works — and is the proof.** Agent **Game Plan is now clean** (cold PASS, gap **0.0ms**, 0 late DOM; was ~36% before). The data-gated entrance + 3 warm year-doc listeners eliminated the pop **without a skeleton**. This is the reference case for the PREFETCH class. ([AgentDashboard.jsx:236-241](src/components/dashboard/AgentDashboard.jsx) wires it on `requestIdleCallback`.)
- **The manager producer surface was NOT covered by the POC.** `mp-game-plan` still FAILs for branch_manager (218ms/30%) and unit_manager (145ms/16%) — the #829 prefetch lives in `AgentDashboard` only. Extending it to the manager `mp-*` surface is the single cleanest PREFETCH win left.
- **The worst offenders are SHARED panels reused across roles** — `production-report` (agent+BM+SM, 38–47% late), `compliance` (BM+SM, 55%), `leaderboard` (all 4 roles, 18–30%), `awards` (BM+SM, 50%), `policy-ledger`/`mp-policies` (agent+BM+UM, 43%). One shared fix hits every role at once.
- **Skeleton alone is NOT always sufficient — the swap matters (Rule 23 evidence).** `policy-ledger` **already ships a skeleton** ([PolicyLedgerPanel.jsx:261-265](src/components/agent/PolicyLedgerPanel.jsx), `ledger-loading` + `animate-pulse`) and **still FAILs (248ms/43%)** because the skeleton→`ledger-empty` swap is a hard structural cut. Skeleton structure + a gentle reveal (S2) + footprint-matching is what kills the pop, not a skeleton shape by itself.
- **PREFETCH ≠ SKELETON, and the split is driven by the read primitive.** Single-doc `getDoc` on a known, warmable path (game-plan year-docs, `leaderboards/{branchId}`, `financingTerms`, current-month persistency) → **PREFETCH-amenable** (warm on dashboard idle, game-plan model). List/aggregate `getDocs` (roster, policies, campaigns, production aggregates) → **SKELETON** (you cannot cheaply warm a whole query via a doc listener; and lists benefit most from a footprint-reserving skeleton).
- **Pinned-nav seeds are a WEAK targeting signal for prefetch.** The per-role `PINNED_SEEDS` ([navConfig.js:239-243](src/components/shell/navConfig.js)) are mostly actions (`daily-log`, `wizard`), SOON items (`planner`), or list-panels (`policy-ledger`, `mastersheet`, `monthly-recruiting`) — i.e. skeleton-class, not prefetch-class. The highest-pop screens (compliance, persistency, production-report) are **not** in the default pins. A **curated per-role prefetch-on-idle set** (from this sweep's data) targets far better than pinned-tab prefetch. Usage-tracking is a later refinement, not needed to start.
- **Listener budget is trivially safe.** A curated prefetch set warms ~1–6 single-doc listeners per session per role — well inside Firestore's safe range (soft guidance is hundreds of listeners per client; each warm listener bills at most one document read that the tab would have read anyway).

---

## Methodology

- **Measurement:** `--sweep` reloads to the role's default view before each tab, clicks the tab, screencasts the switch (CDP, 2500ms settle cap), and measures the gap between the `screen-enter` animation end (a green→red beacon at the top 6px) and the content-region pixel-settle. **Thresholds** (`motion_analyze.py:24-25`, calibrated 2026-07-06): FAIL = `popinGapMs > 75` **AND** `lateChangePct > 3%`; WARN = dropped-frame ratio > 0.20; ERROR = beacon window never seen (no `screen-enter` fired). The `lateDom` sample names the exact DOM nodes added **after** the animation ended — that's how each screen is classified skeleton-vs-prefetch.
- **Coverage caveats** (details in Known Gaps): landing tabs (dashboard / overview / mp-report) register as ERROR because a reload-then-click-the-same-tab produces no switch — their *initial-load* entrance is a separate concern (the #826 lever), not measured here. Action items (`daily-log`, `wizard`, `meetings`, `kiosk`) and SOON items (`planner`, `prospect-info`) are excluded from the sweep by design. `unit_manager` landed in the **"My Work" workspace** so only its 10 producer tabs enumerated; its team-side tabs are covered by `branch_manager` (same `PRODUCING_MANAGER_NAV` → same components). `platform_admin` is **unreachable** (creds present-but-empty).
- **Verdict interpretation:** verdicts below are the tool's; the **classification** column is this recon's judgment, combining verdict + late-DOM signature + the traced read primitive.

---

## Task 1 — Screen inventory by role

Source of truth: [navConfig.js](src/components/shell/navConfig.js) (agent, UM, BM) + inline nav in `ManagerDashboard` (SM) / `TenantAdminDashboard` (TA).

| Role | Nav source | Top-level data tabs (measured) | Shared with |
|---|---|---|---|
| **agent** | `AGENT_NAV` | dashboard·, history, game-plan, money-needs, goals, commission, persistency, policy-ledger, financing, production-report, leaderboard, awards, career (13). Actions: daily-log, wizard. SOON: planner, prospect-info. | production-report, leaderboard, goals, awards, persistency, policy-ledger shared w/ managers |
| **unit_manager** | `PRODUCING_MANAGER_NAV` (My-Work workspace) | mp-report·, mp-commission, mp-policies, my-war, mp-history, financing, mp-game-plan, mp-money-needs, mp-goals, leaderboard (10). **Team tabs hidden behind workspace toggle** → covered by BM. | all `mp-*` + team tabs shared w/ BM |
| **branch_manager** | `PRODUCING_MANAGER_NAV` (full/pinned layout) | 26: producer `mp-*` set + overview·, team, mastersheet, team-wars, goals, team-game-plans, persistency, compliance, campaigns, production-report, awards, team-perf, settlements, policy-reconciliation, agent-of-month, leaderboard. | superset of UM; team half shared w/ SM |
| **sales_manager** | inline `ManagerDashboard` nav | 18: overview·, my-war, team-wars, monthly-recruiting, team, campaigns, production-report, awards, mastersheet, compliance, team-perf, goals, settlements, financing, policy-reconciliation, leaderboard, agent-of-month, profile. | team surfaces shared w/ BM |
| **tenant_admin** | inline `TenantAdminDashboard` nav | 6: dashboard·, branches, users, config, campaigns, profile. | campaigns shared w/ managers |
| **platform_admin** | (unreachable) | — | UNCLASSIFIED (no creds) |

`·` = default landing tab (registers ERROR under the tab-switch method; see Known Gaps).

**Role-specificity:** the producing-manager `mp-*` surfaces (UM+BM) and the team surfaces (BM+SM) are the two big shared clusters. `production-report`, `leaderboard`, `goals`, `awards`, `compliance`, `campaigns`, `policy-ledger` are the individual components reused across ≥2 roles — the leverage points.

---

## Task 2 — Pop-in measurement per screen + classification

**Classification key:** **SKELETON** = pops from a list/aggregate loading-state structurally different from final (S1 kit ± S2 reveal). **PREFETCH** = single-doc critical path, warmable on idle (game-plan model). **BOTH** = single-doc-amenable *and* still benefits from a skeleton for the cold/cache-miss case. **FINE** = no meaningful pop. **N/A** = landing/action/soon (not a tab-switch). Numbers are cold-load `gap ms` / `late %` from the sweeps.

### agent (run `07-04-11`)
| screen | gap | late% | verdict | what pops in (late DOM) | primitive | class | why |
|---|---|---|---|---|---|---|---|
| game-plan | 0.0 | 0.0 | PASS | none | 3× warm `onSnapshot` (POC) | **FINE (fixed)** | #826 gate + #829 prefetch — reference case |
| production-report | 245.5 | 47.1 | FAIL | scorecards + `where-you-rank-panel` | getDocs aggregate | **SKELETON** | shared agent+BM+SM; highest agent late% |
| policy-ledger | 248.4 | 42.9 | FAIL | `ledger-empty` | `policiesService` getDocs | **SKELETON + S2** | already has skeleton → still pops (swap cut) |
| commission | 266.4 | 36.1 | FAIL | `commission-anchor-strip` | derived from submissions | **SKELETON** | anchor-strip computes on mount |
| leaderboard | 233.4 | 29.7 | FAIL | `★ Top of the board` | `useLeaderboard` getDoc(`leaderboards/{branchId}`) | **BOTH** | single-doc → prefetch; skeleton for cold |
| persistency | 237.9 | 13.9 | FAIL | month option + "no record" | agent single-month getDoc | **BOTH** | small single-doc; prefetch + skeleton |
| financing | **1410.2** | 4.0 | FAIL | "You're not on financing" | `financingService` getDoc (single) | **BOTH** | **1.4s** single-doc — worst agent gap |
| history / goals / awards / career | 0.0 | 0.0 | PASS | none / count-up only | — | **FINE** | sync-ish render |
| dashboard | — | — | ERROR | — (landing) | — | **N/A** | initial-load entrance = #826 lever |
| money-needs | — | — | ERROR | content loads, no beacon | getDoc | **N/A (anomaly)** | renders outside `screen-enter` wrapper (mp-money-needs PASS) — see gaps |

### branch_manager (run `07-06-14`)
| screen | gap | late% | verdict | what pops in | primitive | class |
|---|---|---|---|---|---|---|
| persistency | **958.2** | 47.1 | FAIL | `pers-month-selector`, scope buttons, branch bar | `getPersistencyForBranch` getDocs | **SKELETON** (worst gap) |
| compliance | 354.3 | 55.3 | FAIL | `compliance-reality-bar`, `-roster`, `-exception-list` | `useTeamRoster` getDocs batch | **SKELETON** |
| awards | 296.1 | 50.5 | FAIL | `monthly-bonus-hero`, award groups, `bm-at-risk-panel` | getDocs | **SKELETON** |
| team-game-plans | 477.5 | 4.0 | FAIL | `team-plans-table` | getDocs | **SKELETON** |
| mp-game-plan | 218.1 | 30.2 | FAIL | `game-plan-anchor/-rail/-cascade`, `suggested-week-card` | getDoc year-docs | **PREFETCH** (extend #829) |
| mp-policies | 189.0 | 42.9 | FAIL | `ledger-empty` | getDocs | **SKELETON + S2** |
| policy-reconciliation | 195.7 | 35.0 | FAIL | `reconcil-empty` | getDocs | **SKELETON** |
| campaigns | 180.7 | 38.0 | FAIL | Campaigns header/tabs/empty | `campaignService` getDocs | **SKELETON** |
| goals | 162.9 | 18.3 | FAIL | Goal Cascade, `floor-row` | getDoc hierarchy | **SKELETON** |
| mastersheet | 149.5 | 5.1 | FAIL | roster rows | getDocs | **SKELETON** |
| leaderboard | 131.2 | 25.8 | FAIL | (podium) | getDoc single | **BOTH** |
| production-report | (WARN) | 0.0 | WARN | branch aggregate + unit leaderboard | getDocs aggregate | **SKELETON** |
| settlements | 460.5 | 1.0 | PASS | 1 row (below fold) | getDocs | FINE (borderline) |
| mp-*/my-war/team/team-wars/team-perf/agent-of-month/monthly-recruiting/financing | 0–93 | ≤2 | PASS | — | — | **FINE** |
| mp-report / overview | — | — | ERROR | (landings) | — | **N/A** |

### unit_manager (run `07-10-31`, My-Work workspace)
| screen | gap | late% | verdict | primitive | class |
|---|---|---|---|---|---|
| leaderboard | **686.1** | 23.5 | FAIL | getDoc(`leaderboards/{branchId}`) | **BOTH** |
| mp-game-plan | 145.4 | 15.9 | FAIL | getDoc year-docs | **PREFETCH** (extend #829) |
| mp-policies | 129.4 | 23.8 | FAIL | getDocs | **SKELETON + S2** |
| mp-commission/mp-goals/mp-history/mp-money-needs/my-war/financing | 0 | ~0 | PASS | — | **FINE** |
| mp-report | — | — | ERROR | — | **N/A** (landing) |
| *team tabs* | — | — | — | (workspace-hidden) | **covered by BM** |

### sales_manager (run `07-12-38`)
| screen | gap | late% | verdict | what pops in | primitive | class |
|---|---|---|---|---|---|---|
| agent-of-month | **703.9** | 4.5 | FAIL | `API Champion` card | `agentOfMonthService` getDoc + list | **SKELETON** |
| goals | 580.4 | 18.3 | FAIL | Goal Cascade | getDoc hierarchy | **SKELETON** |
| leaderboard | 402.1 | 18.6 | FAIL | podium | getDoc single | **BOTH** |
| production-report | 246.4 | 38.9 | FAIL | aggregate + unit leaderboard | getDocs | **SKELETON** |
| compliance | 236.3 | 55.3 | FAIL | roster/reality-bar | `useTeamRoster` getDocs | **SKELETON** |
| awards | 241.5 | 50.3 | FAIL | bonus-hero + groups | getDocs | **SKELETON** |
| campaigns | 148.9 | 20.5 | FAIL | Campaigns list | getDocs | **SKELETON** |
| team-perf | 0.0 (settle) | 0 | PASS | 28 roster rows **+2027ms below fold** | `useTeamRoster` getDocs | **SKELETON** (below-fold) |
| mastersheet/monthly-recruiting | 125–155 | ≤3 | PASS | — | getDocs | FINE (borderline) |
| my-war/team/team-wars/settlements/financing/profile/policy-reconciliation | 0 | 0 | PASS | — | — | **FINE** |
| overview | — | — | ERROR | — | — | **N/A** (landing) |

### tenant_admin (run `07-15-06`)
| screen | gap | late% | verdict | what pops in | primitive | class |
|---|---|---|---|---|---|---|
| branches | 200.6 | 3.9 | FAIL | branch table header + rows | `branchService` getDocs | **SKELETON** |
| campaigns | 149.7 | 38.0 | FAIL | Campaigns list | getDocs | **SKELETON** |
| users | 0.0 | 0.0 | PASS | — (small test tenant) | `getTenantUsers` getDocs | **SKELETON at scale** (prior doc: 3-row skeleton → 14 rows jump; borderline here) |
| config / profile | 0 | ~1 | PASS | — | — | **FINE** |
| dashboard | — | — | ERROR | — | — | **N/A** (landing) |

### Shared-panel roll-up (the leverage points, worst-first)
| Panel (tabId) | Roles that pop | worst late% | class | one fix reaches |
|---|---|---|---|---|
| `production-report` | agent, BM, SM | 47% | SKELETON | 3 roles |
| `compliance` | BM, SM | 55% | SKELETON | 2 roles |
| `persistency` (manager) | BM (+SM via team) | 47% / 958ms | SKELETON | 2 roles |
| `leaderboard` | agent, UM, BM, SM | 30% | BOTH | **4 roles** |
| `awards` (manager) | BM, SM | 50% | SKELETON | 2 roles |
| `policy-ledger`/`mp-policies` | agent, BM, UM | 43% | SKELETON + S2 | 3 roles |
| `goals` (team cascade) | BM, SM | 18% | SKELETON | 2 roles |
| `campaigns` | BM, SM, TA | 38% | SKELETON | 3 roles |
| `mp-game-plan` | BM, UM | 30% | PREFETCH | 2 roles (extend #829) |
| `agent-of-month`, `team-game-plans`, `policy-reconciliation`, `mastersheet`, `branches`, agent `commission`, agent `financing` | 1 role each | 4–47% | mixed | per-role |

---

## Task 3 — Prefetch-candidate map per role

**Model:** the shipped #829 pattern — on `requestIdleCallback` after the dashboard mounts, attach a lightweight `onSnapshot` on each critical **single doc** so a later `getDoc` for the same doc resolves from cache without a round-trip ([gamePlanPrefetch.js:35-51](src/services/gamePlanPrefetch.js)). Prefetch is only worthwhile where the critical path is a **small number of known single docs** (not a collection query).

### Pinned-nav cross-reference (why pins are a weak signal)
Per-role default pins ([navConfig.js:239-243](src/components/shell/navConfig.js)):
- **agent:** `daily-log`(action), `wizard`(action), `policy-ledger`(getDocs→skeleton), `goals`(getDoc-amenable), `planner`(SOON).
- **producingManager:** `mp-report`(landing/takeover), `mastersheet`(getDocs→skeleton), `monthly-recruiting`(getDocs→skeleton), `mp-goals`(getDoc, but PASS/fast), `planner`(SOON).
- **manager:** `[]`.

Only **1 of 5** agent pins and **1 of 5** manager pins are single-doc prefetch-amenable, and neither is a top popper. **Conclusion:** naïve "prefetch every pinned tab" would warm mostly list-panels (architecturally awkward for a doc listener) and miss the worst poppers. Target by **pop severity ∩ single-doc-amenable**, not by pins.

### Recommended prefetch-on-dashboard-idle set (per role)
| Role | Prefetch (single-doc, warm on idle) | Docs | Notes |
|---|---|---|---|
| **agent** | game-plan year-docs *(shipped)* + `leaderboards/{branchId}` + `financingTerms/{uid}` + current-month persistency | 3 + 3 | financing is the 1.4s outlier; leaderboard reaches 4 roles' component |
| **unit_manager / branch_manager** | `mp-*` game-plan year-docs *(extend #829 to manager surface)* + `leaderboards/{branchId}` | 3 + 1 | mp-game-plan is the cleanest remaining PREFETCH win |
| **sales_manager** | `leaderboards/{branchId}` | 1 | most SM pops are list-aggregates → skeleton, not prefetch |
| **tenant_admin** | *(none)* | 0 | branches/campaigns/users are all list reads → skeleton |
| **platform_admin** | *(unknown)* | — | unreachable |

Everything else on the FAIL list is a **SKELETON** target (S1 kit), because it reads a collection/aggregate, not a warmable single doc.

---

## Task 4 — Fetch-pattern confirmation

- **`onSnapshot` count across `src/services/`: 1** — only `gamePlanPrefetch.js` (the POC). All 41 other services are one-time `getDoc`/`getDocs`. The app has **no live-listener data layer**; every panel is fetch-on-mount. This is the root-cause substrate.
- **Single-doc (prefetch-amenable) reads confirmed:**
  - `useLeaderboard.js:57` → `getDoc(ref)` on `leaderboards/{branchId}` — one doc. ✅
  - `financingService.js` → 9× `getDoc` (single financing docs). ✅ (agent self-view = 1 doc on the hot path)
  - `moneyNeedsService`/`yearPlanService`/`monthlyPlanService` → 3× `getDoc` each, single year-docs — already prefetched for game-plan. ✅
  - `goalsService.js` → 8× `getDoc` (hierarchy = a few single docs). ✅ amenable
- **List/aggregate (skeleton, not prefetch) reads confirmed:**
  - **`useTeamRoster.js` (spot-check of #830-flagged file — VERIFIED, not trusted):** `loading` state at [useTeamRoster.js:34](src/hooks/useTeamRoster.js); effect at :41-107 fires `getTenantUsers` + `getAllYTDSubmissions` + `getSettlementsForUnit` + `getPersistencyFor{Unit,Branch,Tenant}` + `getGoalsForAgents` in `Promise.all` — **all `getDocs` list reads on mount.** Backs compliance / team-perf / mastersheet. Not warmable via a doc listener → **SKELETON**.
  - **`PersistencyTab.jsx` (spot-check of #830-flagged file — VERIFIED):** exists in BOTH `src/components/agent/PersistencyTab.jsx` (self-view, single-month getDoc → prefetch-amenable) **and** `src/components/manager/PersistencyTab.jsx` (team, `getPersistencyForBranch/Tenant` getDocs → skeleton). The 958ms BM pop is the manager list variant.
  - `policiesService` (getDocs), `campaignService` (getDocs), `managerService` (7× getDocs), `branchService` (getDocs), `settlementService` (getDocs), `agentManagementService` (getDocs). → all **SKELETON**.
- **Per-panel listener count if prefetched (game-plan model):** game-plan = **3** listeners (moneyNeeds, yearPlan, monthlyPlan). leaderboard = **1**. agent financing = **1**. agent persistency = **1**. mp-game-plan = **3**.

---

## Task 5 — Listener budget

Warm listeners live for the dashboard's lifetime (unsubscribed on unmount). With the **curated** prefetch-on-idle set above:

| Role | Warm listeners/session | Detail |
|---|---|---|
| agent | **~6** | 3 game-plan (shipped) + leaderboard + financing + persistency |
| unit_manager / branch_manager | **~4** | 3 mp-game-plan + leaderboard |
| sales_manager | **~1** | leaderboard |
| tenant_admin | **0** | (none prefetch-amenable) |

**Verdict: safely within Firestore's range.** There is no hard per-client active-listener cap that ~6 approaches (practical guidance is hundreds of concurrent listeners per client; the real cost is the initial document read, which is billed **once** and is a read the tab would have performed anyway on open — net-zero extra reads if the tab is visited, one warmed read if not). By contrast, **naïve pinned-tab prefetch** would attempt to warm list-panels (policy-ledger, mastersheet) whose data is a collection query — architecturally these don't map to a single doc listener, so pinned-tab prefetch is both worse-targeted *and* awkward to implement. Curated wins on both counts.

---

## DECISIONS-NEEDED

**1. Skeleton vs prefetch vs both — the split.**
- **SKELETON (S1 kit, the bulk):** production-report, compliance, persistency(manager), awards(manager), policy-ledger/mp-policies *(+S2)*, goals(team), campaigns, mastersheet, agent-of-month, team-game-plans, policy-reconciliation, branches, users(at scale), agent commission, team-perf(below-fold).
- **PREFETCH (extend #829):** mp-game-plan (BM+UM) — apply the shipped pattern to the manager producer surface.
- **BOTH (single-doc prefetch + skeleton for cold):** leaderboard (all 4 roles), agent financing (1.4s), agent persistency.
- **FINE (leave alone):** game-plan(fixed), history, goals(agent), awards(agent), career, config, profile, and all the PASS `mp-*`/team/my-war tabs.
- *Recommendation:* build the **S1 skeleton kit first** (highest impact, hits the shared panels), then extend #829 to `mp-game-plan`, then add the single-doc prefetches (leaderboard, financing) as they each also want a skeleton anyway.

**2. Per-role prefetch-on-idle set:** as in Task 3 — agent {game-plan✓, leaderboard, financing, persistency}; UM/BM {mp-game-plan, leaderboard}; SM {leaderboard}; TA {none}. Confirm the set, especially whether agent `financing` (1.4s, but empty-state for most agents) is worth a listener or is better left to a skeleton-only fix.

**3. Pinned-tab-prefetch vs usage-tracking.** *Recommendation:* **neither as the driver — use the curated per-role set from this sweep.** Pinned seeds mis-target (mostly actions/SOON/list-panels; worst poppers unpinned). Usage-tracking would sharpen targeting but is **a later option, not needed now** — the sweep already names the high-traffic-heavy poppers. Flag usage-tracking as a follow-up only if per-user pin patterns later diverge sharply from these defaults.

**4. Rollout order (worst-first, shared-first):**
1. **S1 skeleton kit** (shared module) — prove on **production-report** (agent+BM+SM, 47%).
2. **compliance** (BM+SM, 55%) — reuses the `useTeamRoster` skeleton shape.
3. **persistency(manager)** (BM 958ms — worst single gap).
4. **mp-game-plan PREFETCH** (extend #829 — cheapest, highest-confidence win; BM+UM).
5. **leaderboard BOTH** (widest reach, 4 roles; single-doc prefetch + skeleton).
6. **awards(manager)** (BM+SM, 50%), **policy-ledger/mp-policies +S2** (agent+BM+UM, 43% — the skeleton-already-pops case).
7. **goals(team), campaigns, agent commission, agent financing(BOTH), branches, agent-of-month, team-game-plans, reconciliation, mastersheet, team-perf** — long tail, each measured before/after with `motion-verifier.mjs --target <testid>`.

---

## UNCLASSIFIED

| Screen(s) | Reason |
|---|---|
| **platform_admin — ALL tabs** | Unreachable. `A11Y_PLATFORM_ADMIN_EMAIL`/`_PASSWORD` are **present-but-empty** in `.env.local` (`defined: true, nonEmpty: false`). Cannot log in → cannot measure. The PA surface (likely a cross-tenant admin view) is unmeasured. |
| **agent `money-needs`** | ERROR: content loads but **no `screen-enter` beacon** fired — it appears to render outside the animated tab wrapper (the manager `mp-money-needs` PASSes cleanly). Not a screen-enter pop; flagged as a wrapper anomaly worth a 1-line source check before any fix. |
| **Landing tabs** (agent dashboard, UM/BM `mp-report`, BM/SM `overview`, TA `dashboard`) | N/A to the tab-switch method (a reload-then-same-tab click yields no switch → ERROR). Their **initial page-load** entrance is the #826 whole-screen-gated-entrance lever, not per-tab skeleton/prefetch — measure separately. |
| **UM team-side tabs** | Not enumerated — UM defaulted to the "My Work" workspace, hiding team tabs behind the toggle. **Covered indirectly** by branch_manager (identical `PRODUCING_MANAGER_NAV` components; only data scope differs). Direct UM-scoped measurement deferred. |

---

## Known gaps (Rule 22)

- **platform_admin entirely unmeasured** (empty creds) — the one role with zero coverage. If the PA dashboard reuses `TenantAdminDashboard`-style inline nav, its branches/campaigns/users pops likely mirror TA; unverified.
- **Single production run per role, no repeat.** Field-network variance is real (agent `financing` 1.4s vs BM `financing` 0ms same component — data-state difference, but timing also varies run-to-run). Gaps within ~50ms of the 75ms threshold (e.g. SM mastersheet 155ms/2% PASS, BM my-war 93ms/2% PASS) are borderline and could flip on a slower network. Numbers are directional, not gate-precise.
- **Below-fold pops undercounted.** The analyzer measures a viewport-height content box, so late content **below the fold** (SM `team-perf`: 28 roster rows at +2027ms) scores PASS on pixels while the late-DOM sample shows a real late mount. On shorter viewports / mobile these would surface as visible pops. Mobile viewport was not swept.
- **Test-tenant data volume is small.** `users` (TA) PASSed here but the prior doc measured a 3-row-skeleton→14-row jump; at real Tatil scale the list-panel pops grow. Skeleton right-sizing matters more at production data volumes than this smoke tenant shows.
- **`commission` read primitive not fully traced** — the grep on `CommissionPlayground/` found no direct read; the anchor-strip derives from submissions passed in or a hook. Classified SKELETON on the late-DOM signature; exact source unconfirmed.
- **money-needs ERROR anomaly** unexplained (see UNCLASSIFIED) — worth a source check, not a blocker.

## Rule 23 — what would overturn "skeleton is the fix"

The proposal's core claim is *skeletons (S1) are the primary fix*. **Falsifying evidence found in this very sweep:** `policy-ledger` **already ships a skeleton** ([PolicyLedgerPanel.jsx:261-265](src/components/agent/PolicyLedgerPanel.jsx)) and **still FAILs at 248ms/43%** — because the skeleton→`ledger-empty` swap is an instant structural cut. This proves **a skeleton's *presence* is not sufficient**; the pop survives when (a) the skeleton footprint doesn't match the final state (list-skeleton → empty-state card), or (b) the loading→data swap is a hard snap with no crossfade. So the fix is not "add a skeleton" but "**footprint-matching skeleton + S2 gentle reveal**". More broadly, the claim would be **fully overturned** by any screen that pops **with a perfect, footprint-matched skeleton AND an S2 crossfade** — in that case the residual pop is a paint/layout-thrash or a fetch-latency problem (→ prefetch), not a loading-state problem, and S3 (readiness-coupled entrance) or prefetch becomes the real lever. The game-plan result is the mirror-image confirmation: prefetch+gate killed the pop with **no** skeleton, which means for single-doc panels the loading-state framing is secondary to the round-trip. The skeleton-first recommendation holds for the **list/aggregate majority**, but is explicitly *not* universal — the split in DECISION #1 encodes exactly where it does and doesn't apply.
