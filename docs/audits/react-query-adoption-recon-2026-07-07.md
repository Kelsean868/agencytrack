# Recon — React Query (TanStack Query) adoption: fetch-pattern map + recommendation

**Status:** recon complete (read-only) · **Date:** 2026-07-07 · **Branch:** `recon/react-query-adoption`
**Scope:** classify every data-fetching panel's read pattern, quantify listener cost, assess React Query fit, recommend ADOPT / DON'T-ADOPT for the systemic pop-in rollout.
**Related:** [motion-popin-systemic-fix.md](../design/motion-popin-systemic-fix.md) · PR #829 (`gamePlanPrefetch`) · PR #826 (data-gated entrance)
**Method:** direct source reads + one classification subagent. React Query is **NOT installed** (`package.json` has no `@tanstack/*`) — adoption is a net-new foundational dependency.

---

## Summary — verdict: **DON'T-ADOPT (now)**

**One-line why:** the pop-in is a *loading-state* defect (skeletons fix the visible symptom, per the motion doc), not a *caching* defect — so React Query would be powering an **optional latency-polish layer**, and adding a foundational dependency + cache-invalidation mental model to a solo non-dev's pre-pilot codebase is poor cost/benefit *right now*. Crucially, **deferral is cheap**: the app already routes ~95% of reads through a uniform `src/services/` layer, so React Query can slot in later panel-by-panel with zero rework the moment a *real* caching need appears.

**This is a timing/justification call, not a fit rejection.** On the read-pattern axis React Query is actually a **clean fit** — the app is overwhelmingly one-time `getDoc`/`getDocs` (only **3** live `onSnapshot` surfaces in the entire non-test tree), and `useQuery(key, serviceFn)` would wrap existing service functions verbatim. If the dispatcher weights the maintainability win (deleting duplicated `loading/error/cancelled` boilerplate across ~15 panels) above the churn, a **scoped, incremental ADOPT** is defensible — the conditional plan is in §6.

**What to do instead (recommended path):**
1. Ship the **S1 shared skeleton kit** (motion doc's own #1) — this is the actual pop fix, and it's caching-agnostic.
2. Generalize #829's prefetch into **one tiny shared helper** (zero deps) for the ~3 worst *first-open* panels only, where measured.
3. **Do not** adopt React Query for the pop rollout. Revisit as a *separate* decision when caching becomes load-bearing (see §Recommendation triggers).

---

## Task 1 — Fetch-pattern inventory

**Primitive legend:** `getDoc`/`getDocs` = one-time read (clean React Query fit) · `onSnapshot` = live listener (already a cache; React Query would double-manage).

| panel | read fn(s) | primitive | doc / collection path | fires on mount? | cite |
|---|---|---|---|---|---|
| **Game Plan** (agent) | `getMoneyNeeds`, `getYearPlan`, `getMonthlyPlan` | **getDoc** ×3 | `users/{uid}/{moneyNeeds\|yearPlan\|monthlyPlan}/{year}` | Yes (screen mount); **also warmed by #829 prefetch** | [moneyNeedsService.js:560](../../src/services/moneyNeedsService.js#L560), [yearPlanService.js:82](../../src/services/yearPlanService.js#L82), [monthlyPlanService.js:61](../../src/services/monthlyPlanService.js#L61) |
| **Production Report** | `getAgentSubmissions` / `getRecentSubmissions` | **getDocs** | `tenants/{tid}/submissions` (where agentId==uid) | Yes — dashboard `loadCoreData` | [submissionService.js:196](../../src/services/submissionService.js#L196), [AgentDashboard.jsx:200](../../src/components/dashboard/AgentDashboard.jsx#L200) |
| **Commission** | `getOwnPolicies` | **getDocs** | `tenants/{tid}/policies` (where agentId==uid) | **Lazy** — only on first Commission-tab visit | [AgentDashboard.jsx:282-297](../../src/components/dashboard/AgentDashboard.jsx#L282) |
| **Policy Ledger** | `getOwnPolicies` (+ `getPolicyPlans`) | **getDocs** | `tenants/{tid}/policies` | Yes — panel mount effect | PolicyLedgerPanel.jsx:114-128; policiesService.js:84 |
| **Compliance** (mgr) | `getWeeklySubmissions`×8 + `getTenantUsers` | **getDocs** | `submissions`, `users` | Yes — `loadData()` mount effect | CompliancePanel.jsx:128; managerService.js:16/26/35/53 |
| **Goals** (gap analysis) | `getGoalHierarchy` → fans out 6 reads | **getDoc** ×6 | `config/companyMinimums`, `branchGoals/{yr}`, `unitGoals/{unit}_{yr}`, `goals/{agent}`, `users/{agent}`, `salesManagerGoals/{sm}_{yr}` | Yes — `GoalsPanel` mount effect (`GapAnalysisPanel` is props-only) | GoalsPanel.jsx:1105; goalsService.js:323-333 |
| **Team Perf** roster | `useTeamRoster` → users + YTD subs + settlements + persistency + goals | **getDocs** + per-agent **getDoc** fan-out | `submissions`, `users`, `settlements`, `persistency`, `goals` | Yes — hook mount effect | useTeamRoster.js:41; managerService.js:59-100; persistencyService.js:89/103 |
| **All Users** | `getAllUsers` | **getDocs** | `tenants/{tid}/users` | Yes — mount effect | UserManagementPanel.jsx:395; agentManagementService.js:61 |
| **Branches** | `listBranches` + `getBranchManagers` + `getAllUsers` | **getDocs** | `branches`, `users` | Yes — mount effect | BranchesPanel.jsx:103; branchService.js:79 |
| **Financing Risk** | `getTenantUsers` (mount); ledger reads on agent-select | **getDocs** + **getDoc** | `users` (mount); `financing` + notify-record (on-action) | **Split** — users on mount, ledger lazy | FinancingRiskPanel.jsx:150 (mount) / 153-185 (lazy); financingService.js:296 |
| **Persistency** | `getAvailableMonths` → `getTenantUsers` + per-agent persistency | **getDocs** + per-agent **getDoc** fan-out | `persistency`, `users` | Yes — mount effects | PersistencyTab.jsx:77/117; persistencyService.js:103/146 |
| **Leaderboard — plural** (production podium) | `useLeaderboard` | **getDoc** (one doc, all 4 periods) | `tenants/{tid}/leaderboards/{branchId}` | Yes — hook mount effect; chip-switch = no refetch | [useLeaderboard.js:57](../../src/hooks/useLeaderboard.js#L57) |
| **Leaderboard — singular** (gamification points) | inline query | **onSnapshot** ⚠️ (+2 inline `getDocs`) | `tenants/{tid}/leaderboard` (orderBy points) | Yes — tab mount; live for tab lifetime | [Leaderboard.jsx:78](../../src/components/gamification/Leaderboard.jsx#L78) |
| **My Points card** | inline doc listener | **onSnapshot** ⚠️ | `tenants/{tid}/leaderboard/{uid}` | Yes — card mount; live for dashboard lifetime | [MyPointsCard.jsx:179](../../src/components/gamification/MyPointsCard.jsx#L179) |
| **Notifications** (app-level) | context listener | **onSnapshot** ⚠️ | `tenants/{tid}/notifications` (where userId==uid, limit 30) | Yes — provider mount; **live for whole session** | [NotificationContext.jsx:35](../../src/context/NotificationContext.jsx#L35) |

**Split:** **12 one-time-read panels** (clean React Query fits) vs **3 live-listener surfaces** (Notifications, gamification Leaderboard, My Points). The 3 live surfaces are all **gamification/points/notifications** — the only genuinely real-time-flavored data in the app (points recompute as submissions process; the bell badge must update live).

---

## Task 2 — Listener-lifetime cost

### Live `onSnapshot` listeners today (per user / session)

| listener | count | lifetime | cite |
|---|---|---|---|
| Notifications | 1 | **whole authenticated session** (provider above dashboards) | NotificationContext.jsx:35 |
| My Points | 1 | agent-dashboard lifetime | MyPointsCard.jsx:179 |
| Leaderboard (singular) | 1 | only while gamification-leaderboard tab mounted | Leaderboard.jsx:78 |
| #829 Game Plan prefetch | **3** | dashboard-idle → agent-dashboard lifetime (agent only) | gamePlanPrefetch.js:44 |

**Agent-dashboard steady state today ≈ 5–6 concurrent listeners** (1 notifications + 1 my-points + 3 prefetch, +1 transient when the gamification leaderboard tab is open).

### If the hand-rolled prefetch is rolled to *all* pop panels

The #829 pattern holds warm `onSnapshot` listeners open **for the dashboard lifetime** (it must, per the getDoc-prefers-server nuance in [gamePlanPrefetch.js:9-16](../../src/services/gamePlanPrefetch.js#L9)). Extending that to every pop panel:

| dashboard | added warm listeners (speculative) | rough total |
|---|---|---|
| **Agent** | game-plan 3 (exists) + production-report 1 + policy-ledger 1 + commission 1 (shares policies) + goals ~5 (hierarchy fan-out) | **~11** + notif/points ≈ **~13** |
| **Manager** | + compliance + goals + **team-perf roster per-agent fan-out** (persistency + goals are **per-agent `getDoc`**, N agents) | **~20–40** for a 10–15-agent unit |

### Is this a concern?

- **Read cost: no.** Firestore reads are ~4% of free quota (Jul 2026 billing); listeners bill only on delta after the initial snapshot. Cost is not the axis.
- **Connections: no.** All listeners multiplex over a single WebChannel/gRPC stream — not N sockets.
- **Memory / architecture: mild smell, not a wall.** Each listener retains its query snapshot + registers a server-side target, and the hand-rolled model warms panels the user **may never open** (speculative retain-cost for zero benefit). The number stays inside Firestore's safe range (dozens fine; hundreds degrade) even fully rolled out — but the **trend is the tell**: every new pop panel adds *permanent* speculative listeners, and the manager roster's per-agent fan-out is where "warm everything" stops scaling.
- **The contrast that matters:** React Query's `prefetchQuery` achieves the *same first-open warm* with **zero persistent listeners** — it runs the `getDoc` **once** during idle and caches the *result* (a plain JS object), so the panel's later `useQuery` reads from React Query's in-memory cache with no round-trip and no live target. On the listener-count axis, React Query is strictly better. **But** the count today is low enough that this axis *alone* does not force adoption.

---

## Task 3 — Service-layer shape

**Uniform, and already the right seam for React Query.** ~40 service files under `src/services/` expose async read functions returning plain data (`getMoneyNeeds`, `getAgentSubmissions`, `getGoalHierarchy`, `getOwnPolicies`, …). Each maps to a React Query `queryFn` **verbatim**: `useQuery({ queryKey: ['moneyNeeds', tid, uid, year], queryFn: () => getMoneyNeeds(tid, uid, year) })`. No service rewrite required.

**Inline exceptions (few, and self-selecting):** the only reads that bypass the service layer are the **3 live-listener components** (Leaderboard.jsx inline `onSnapshot`+`getDocs`, MyPointsCard inline `onSnapshot`, NotificationContext inline `onSnapshot`) and the `useLeaderboard` hook (inline `getDoc`, but already hook-encapsulated). These are exactly the surfaces you'd **leave untouched** in any React Query adoption — so the inline-fetch exceptions never need wrapping. Adoption effort on the one-time-read panels is therefore low: wrap existing service fns, delete each panel's bespoke `useState(loading/error) + useEffect + cancelled-flag + try/catch/finally` boilerplate (the exact shape seen in [useLeaderboard.js:39-77](../../src/hooks/useLeaderboard.js#L39)).

---

## Task 4 — React Query fit assessment

| axis | finding |
|---|---|
| **One-time vs live split** | **12 one-time-read panels : 3 live listeners.** By *read call sites* the split is ~95% one-time (the 3 listeners are 3 sites among ~40+ service read fns). |
| **Clean fits** | All 12 one-time panels. `queryFn` = existing service fn; cache + dedup + retry come free. |
| **Needs special handling** | The 3 live surfaces (Notifications, gamification Leaderboard, My Points). |
| **Recommended handling of the 3** | **Leave on `onSnapshot`.** They are few, already working, and genuinely want live semantics. React Query *can* bridge subscriptions (`onSnapshot` → `queryClient.setQueryData`), but with only 3 it adds complexity for no benefit. Do not migrate them. |

**Bottom line:** the app is **mostly one-time reads → React Query is a clean win on the dominant pattern**, and the live-listener minority is small enough to leave outside React Query entirely. There is no double-management risk because the double-managed surfaces are opt-out by count.

---

## Task 5 — Deep-link / fast-tap coverage

The #829 hand-rolled prefetch fires on **dashboard idle** (`requestIdleCallback` / 400ms fallback, [AgentDashboard.jsx:230-248](../../src/components/dashboard/AgentDashboard.jsx#L230)). It structurally **cannot** cover:

- **Deep-links** — a user routed straight to a panel (not via dashboard idle) never triggers the prefetch.
- **Fast-taps** — a tap within <400ms of dashboard mount beats the prefetch; the tap and the prefetch then fire as **two independent `getDoc`s** (double round-trip), and the panel's own fetch cannot see the prefetch's in-flight state.

**Does React Query close the gap?** Partially, and better than hand-rolled:

| gap | React Query behavior |
|---|---|
| **Deep-link** | **Closed** by prefetching on **login/auth-ready** into the shared `QueryClient` instead of on dashboard idle — the cache is warm regardless of entry path/route. (Hand-rolled is bound to the dashboard being the entry point.) |
| **Fast-tap** | **Narrowed, not eliminated.** React Query **dedups by query key**: a fast-tap's `useQuery` latches onto the *same in-flight promise* as the prefetch rather than firing a second `getDoc`. First paint may still show a loading state if data hasn't resolved — but that state is now the S1 skeleton (layout-stable), so it no longer reads as a pop. |

**Key synthesis:** React Query and the S1 skeleton kit are **complementary, not competing**. React Query removes the round-trip on revisit, dedups fast-taps, and enables clean prefetch-on-login for deep-links; **S1 skeletons make the unavoidable first-load state not read as a pop.** Neither replaces the other — and since S1 is the piece that actually kills the visible pop, it is the piece that must ship regardless of the caching decision.

---

## Recommendation — DON'T-ADOPT (now); revisit on a real caching trigger

**Reasoning chain:**
1. **The pop is a loading-state problem, not a caching problem.** S1 skeletons fix the visible pop on *every* panel independent of how data is cached. Caching (React Query *or* hand-rolled prefetch) is an **optional first-open latency polish** layered on top — not the defect fix.
2. **Post-skeletons, the marginal value of any prefetch drops sharply** — the pop is already gone; caching only makes fast panels feel instant. That's polish.
3. **For an optional polish layer, a foundational dependency is hard to justify now** for a solo non-dev maintainer, pre-pilot, whose explicit goal is minimal rework.
4. **Deferral is cheap and reversible.** Because reads are already isolated behind `src/services/`, React Query can be adopted later **panel-by-panel with zero service rewrite** — there is no architectural penalty for waiting, and no "we should have built for it" trap.
5. **The listener-cost argument for React Query is real but not yet binding** — counts stay in Firestore's safe range even fully hand-rolled, and reads are ~4% of quota.

**Adopt React Query when caching becomes load-bearing** (any one of these flips the call — see Rule 23 below):
- Cross-panel **shared data** read by many surfaces (e.g. company minimums, user roster) starts refetching redundantly and staleness diverges.
- A **mutation → stale-read** bug appears (write in panel A not reflected in panel B without a manual refetch) — React Query's `invalidateQueries` is the clean fix.
- **Listener/refetch sprawl** crosses ~dozens concurrent, or the manager roster fan-out becomes a measured perf problem.

**Until then:** (a) ship S1 skeletons; (b) fold the 3 `gamePlanPrefetch` listeners' *intent* into one tiny shared `prefetchYearDocs`-style helper only for the ~3 worst first-open panels where the verifier still measures a pop after skeletons; (c) keep the 3 live listeners as-is.

---

## §6 — Scoped adoption plan (if the dispatcher chooses ADOPT instead)

Provided so the path is ready — an incremental, low-risk adoption that never touches the live listeners or the service layer's read contracts.

**Provider setup**
- `npm i @tanstack/react-query` (+ optionally `@tanstack/react-query-devtools` dev-only).
- One `QueryClient` (defaults: `staleTime: 5min`, `gcTime: 30min`, `refetchOnWindowFocus: false` — field agents on flaky networks; avoid surprise refetches). Wrap `<App>` in `<QueryClientProvider>` above the auth context.

**Service fns → queryFns (no service edits)**
- `useQuery({ queryKey: [collection, tenantId, uid, ...args], queryFn: () => existingServiceFn(...) })`. Query keys are tuples of `[domain, tenantId, ...scope]` so tenant isolation is visible in the key.

**onSnapshot panels** — **leave on `onSnapshot`.** Do not migrate Notifications / gamification Leaderboard / My Points. (If ever wanted, bridge via `onSnapshot(ref, snap => queryClient.setQueryData(key, snap.data()))` — but not in scope.)

**#829 Game Plan prefetch** — **migrate to `queryClient.prefetchQuery`.** Replace the 3 dashboard-lifetime `onSnapshot` listeners with 3 idle `prefetchQuery` calls (one `getDoc` each, result cached, **zero persistent listeners**). Game Plan panel then reads via `useQuery` and gets the prefetched result instantly. This is the single cleanest win and the reference migration.

**Incremental rollout order** (each an independently-reviewable `src/` PR, human-merge, verified before/after with `motion-verifier.mjs`):
1. **Game Plan** — migrate #829 prefetch → `prefetchQuery` + `useQuery` (proves the pattern on the worst offender; deletes the listener-warming hack).
2. **Production Report** + **Policy Ledger** + **Commission** — agent one-time panels; Commission stays lazy via `enabled: activeTab === 'commission'`.
3. **All Users** + **Branches** — tenant-admin list panels.
4. **Manager panels** (Compliance, Goals, Team-Perf, Persistency, Financing) — do these last; **fix the per-agent `getDoc` N+1 fan-outs** (Persistency, Team-Perf roster) at the same time, either as one batched query or N parallel `useQuery`s under a shared key prefix.

**Guardrails:** never migrate the 3 live listeners · keep money/rules/settlement read *contracts* unchanged (React Query wraps, never rewrites, the service fn) · one panel per PR.

---

## Known gaps (Rule 22)

1. **No runtime measurement in this recon.** The listener-count figures are derived from source fan-out analysis, not observed in a live session (DevTools/network). A real agent/manager session with the panels warmed would confirm the ~13 / ~20–40 estimates — I did not run it (read-only recon; no smoke).
2. **Manager-dashboard panels were classified from the subagent's read, not read line-by-line by me** for every one (Compliance, Team-Perf, Financing, Persistency). Cites are the subagent's; I verified the agent-side + live-listener + game-plan surfaces personally. A spot-check of `useTeamRoster.js` and `PersistencyTab.jsx` line numbers before any adoption PR is prudent (Rule 17).
3. **The N+1 per-agent `getDoc` fan-outs** (Persistency, Team-Perf roster persistency leg) are a pre-existing perf pattern *orthogonal* to the React Query question — flagged here because they'd shape the manager-panel adoption step, but they're their own optimization regardless of the verdict.
4. **Kiosk surfaces** (`src/components/kiosk/`, `kioskServices.js`) were out of the pop-analysis scope and not classified — they fetch on mount too and would be a later adoption tranche if React Query is ever chosen.

## Rule 23 — what would flip the DON'T-ADOPT verdict

- **Flips to ADOPT** if any of: a mutation→stale-read bug surfaces across panels; a shared dataset (company minimums / roster) is measured refetching redundantly on most navigations; concurrent listeners/refetches cross ~dozens; or the team decides the maintainability win (deleting ~15 panels' fetch boilerplate) outweighs the migration churn *before* a functional trigger appears.
- **Strengthens DON'T-ADOPT** if: S1 skeletons alone drop the verifier's late-repaint rate to near-zero (making *any* caching layer unnecessary polish), or the hand-rolled `prefetchQuery`-free helper covers the ~3 first-open panels that still measure a pop after skeletons.
- **Evidence I'd trust most:** a `motion-verifier.mjs` sweep *after* S1 skeletons land — if the pop is gone, the caching-layer decision is deferred indefinitely on merit, not preference.

---

## DECISIONS-NEEDED

1. **Adopt React Query vs continue hand-rolled?** — Recon recommends **neither for the pop**: ship S1 skeletons (the real fix) + a tiny shared prefetch helper for the worst first-open panels. Adopt React Query only on a caching trigger (§Recommendation).
2. **If adopt — how are the 3 `onSnapshot` panels handled?** — Recommend **leave as-is** (don't migrate Notifications / gamification Leaderboard / My Points).
3. **Is #829's Game Plan prefetch migrated or kept?** — If React Query is adopted, **migrate** it to `prefetchQuery` (removes 3 persistent listeners; reference migration). If not adopted, **keep** it and generalize the pattern into one shared helper.
4. **Rollout order (if adopt):** Game Plan → agent one-time panels → admin list panels → manager panels (fixing the N+1 fan-outs there).
