# Track J — P6: Nav swap — production leaderboard → primary nav; points board retires (AGENT-ONLY)

**Sized:** S–M (small code, **high-stakes** — primary nav)
**Branch:** `redesign/leaderboard-nav-swap` (off main)
**Type:** Nav-config + routing change. **Human-merge + dispatcher pre-review.** Merge is the dispatcher's GitHub-UI action (Rule 19) — CC opens the PR and stops.

> **Phase 1 amendment (dispatcher disposition, 2026-05-31):** Scope narrowed to **AGENT-only** based on Phase 1 audit findings. ManagerDashboard nav swap deferred to **P5** (manager production leaderboard needs role-scope + default-branch resolution that the aggregate doesn't yet carry for SMs — an SM has no single `branchId`; UM/BM would be unscoped without P5). The `WeeklyChampionsBanner` "survives" assumption was disproved by Phase 1 data-path verification (see banner disposition below). **Original outcome text preserved below; updated outcome supersedes.**

## Outcome (updated 2026-05-31)

The production leaderboard (the P3/P4 surface, currently behind the `?tab=production-leaderboard` temp route) becomes a real primary-nav item in **AgentDashboard only**. The points-based leaderboard retires from the AGENT primary nav (its component file stays — still referenced by `ManagerDashboard` until P5). Gamification (BadgeGrid, Career Portal) is independent and survives. WeeklyChampionsBanner re-home is **deferred to a separate data PR** — its data path is agent-denied today (see disposition below).

## Decisions baked in (do not re-litigate)

- **AGENT-ONLY scope** (2026-05-31 amendment): the nav swap applies to `AgentDashboard` only. `ManagerDashboard`'s `leaderboard` nav entry stays as-is; the manager swap belongs in P5 alongside the role-scope + branch-picker work.
- **Atomic swap (agent side):** add the production-leaderboard nav item AND remove the points-leaderboard nav item in the SAME change to `AgentDashboard.jsx` — never an intermediate state where the agent slot is empty or both are present.
- **Remove the temp route:** delete the `?tab=production-leaderboard` URL-query `useEffect` from `AgentDashboard.jsx` (the surface now mounts via the real nav item). The render block stays; only the temp entry point goes. (ManagerDashboard has no temp route — N/A there.)
- **Do NOT delete the points-leaderboard component file in this PR.** It REMAINS referenced by `ManagerDashboard.jsx` import + render → NOT orphaned in this PR → NO deletion FU. Full retirement spans P6 (agent) + P5 (manager).
- **Gamification survives** (Phase 1 confirmed): `BadgeGrid` is mounted via `CareerPortal.jsx:866` (the Career Portal nav item is unchanged). `computeEarnedBadges` utility import is unaffected.
- **WeeklyChampionsBanner re-home — DEFERRED** (Phase 1 amendment): the banner's data path is agent-denied. See "Banner disposition" below; not in this PR.
- **Role visibility (revised):** the production-leaderboard nav item replaces the agent's `leaderboard` slot. Manager visibility lands in P5.

## Banner disposition (Phase 1, 2026-05-31)

Verified the `WeeklyChampionsBanner` data path:

- **(a) `prevSubs` source:** `getDocs(query(collection(db, 'tenants/{tid}/submissions'), where('weekStarting','==',prevSunday), where('status','==','submitted')))` — broad tenant-wide submissions list with no `agentId` filter.
- **(b) Agent-readable?** **NO.** `firestore.rules:221-232` allows agent list of `/submissions` only via `canAccessOwn` (per-doc `agentId == request.auth.uid`). The unfiltered tenant-wide list is rejected by Firestore; `Leaderboard.jsx` silently swallows the permission-denied via `.catch(() => {})` and `prevSubs` stays `[]`.
- **(c) Last-week or current?** Last week (completed). `prevSunday = getLastNSundays(2)[1]` — the Sunday before the most recent one.

Current behavior for agents inside `Leaderboard.jsx`: the banner renders the "No submissions recorded last week" empty state with three "No data yet" locked-medal cards. Re-homing to `ProductionLeaderboardSurface` would yield the same empty rendering — no functional value, no regression.

Re-home is therefore deferred to a separate data PR. Feeding the banner with REAL champions for agents requires either:
- A server-side champions Cloud Function that writes an agent-readable `weeklyChampions/{weekStarting}` doc (preserves last-week-completed semantics), OR
- Re-sourcing the banner from the existing `leaderboards/{branchId}` aggregate's weekly top-N — which changes the semantic from last-week-completed to current-week-in-progress.

That is a data decision (not a nav decision) and is OUT OF SCOPE for P6.

**Status of P6 work pending dispatcher disposition on banner deferral:** STOP — see Phase 1 close.

## Phase 0 — pre-flight

1. `git fetch origin`; sync main; `git log origin/main --oneline -1` verbatim.
2. Move brief → `docs/briefs/track-j-p6-leaderboard-nav-swap-kickoff.md`; branch `redesign/leaderboard-nav-swap`; commit as commit 1.
3. Failure/drift → STOP and wait for dispatcher.

## Phase 1 — source-verify (read frontend SKILL first)

1. Read `/mnt/skills/public/frontend-design/SKILL.md`.
2. Locate the nav config (`NAV_ITEMS` or equivalent): the points-leaderboard entry (icon/label/route) and the P3 temp-route URL-query effect.
3. **grep for every reference** to the points-leaderboard component AND any deep links / other entry points to the points board — surface any that would be orphaned by removing the nav entry.
4. Source-verify the v2 nav design (icon/label for the leaderboard item) if the mockups specify it; otherwise the production board takes the points board's slot (label "Leaderboard", an appropriate Trophy/Award icon).
5. Confirm BadgeGrid + Career Portal + WeeklyChampionsBanner are independent of the points-leaderboard nav entry.
6. Drift/orphaned-link finding → STOP and surface.

## Phase 2 — build (AGENT-ONLY)

- In `src/components/dashboard/AgentDashboard.jsx`:
  - Replace the points-leaderboard `NAV_ITEMS` entry with a production-leaderboard entry (label "Leaderboard", `tabId: 'production-leaderboard'`, Trophy/Award/Star icon per design).
  - Update `BOTTOM_NAV` "Ranks" item's `tabId` from `'leaderboard'` to `'production-leaderboard'` (same atomic change).
  - Remove the `useEffect` that handles `?tab=production-leaderboard` URL-query (the P3 temp route).
  - Remove the import of `Leaderboard from '../gamification/Leaderboard'` (dead after nav removal).
  - Remove the `{activeTab === 'leaderboard' && <Leaderboard />}` render block (dead after nav removal).
  - The existing `{activeTab === 'production-leaderboard' && <ProductionLeaderboardSurface />}` render block stays — now reachable via the real nav.
- **ManagerDashboard is NOT edited in this PR** (deferred to P5).
- Update the verification scripts that hit the temp route (`scripts/verification/around-me-visible-smoke.mjs`, `scripts/verification/production-leaderboard-smoke.mjs`) to navigate via the real nav click instead of the `?tab=production-leaderboard` URL-query.
- No data change; no gamification/Career Portal edits.

## Phase 3 — gates

- **3a hex-grep** empty.
- **3b scope (FINAL diff, terminal):** the nav config + the surface's nav wiring + temp-route removal + tests + brief + CONTEXT + FOLLOW_UPS (+ smoke). No unrelated `src/`, no `functions/`.
- **3c lint / test / build** green (verbatim).
- **3d axe baseline-delta** both themes; NO-NEW serious/critical (Rule 9 carve-out only; contrast nodes already FU-tracked).
- **3e nav unit test:** in `AgentDashboard`, `NAV_ITEMS` contains the production-leaderboard item (`tabId: 'production-leaderboard'`) and the points-leaderboard `tabId: 'leaderboard'` entry is absent; the leaderboard route resolves to `<ProductionLeaderboardSurface />`. ManagerDashboard nav assertions are NOT included (deferred to P5).
- **3f LIVE smoke (both themes):** test agent logs in → AgentDashboard's primary nav shows the production-leaderboard item; clicking it renders the podium surface reading the live aggregate; the points-leaderboard nav `tabId: 'leaderboard'` entry is ABSENT in the agent nav; BadgeGrid + Career Portal still reachable (via the Career Portal nav item); 0 console errors. WeeklyChampionsBanner deferred — NOT asserted in this PR's smoke. Preview; prod in Phase 6.

## Phase 4 — docs + FUs

- CONTEXT.md row (`#{TBD}`/`{TBD}`): the agent leaderboard is now primary nav (production-based); temp route retired; ManagerDashboard nav unchanged (deferred to P5).
- **No deletion FU** for `gamification/Leaderboard.jsx` — it remains referenced by `ManagerDashboard` until P5 retires the manager nav slot. Deletion ships post-P5.
- **Bank FU:** WeeklyChampionsBanner data-source decision (server-side champions CF vs aggregate-derived top-N) — separate from the nav swap, blocks agent-side banner re-home.

## Phase 5 — PR + STOP for pre-review

Open PR; paste gate results. **STOP — do not merge (Rule 19; merge is the dispatcher's UI action).** I pre-review: the atomic swap (item added + removed, no gap), no orphaned links to the retired board, gamification + WeeklyChampions intact, and the surface reachable via the real nav.

## Phase 6 — post-merge (after the dispatcher merges in the UI)

Sync, fill, push direct to main, Rule 15 verbatim; prod smoke (nav item present + points item absent + surface renders + gamification intact, both themes) verbatim.

## Acceptance criteria (updated 2026-05-31)

- The AGENT production leaderboard is a real primary-nav item reachable without the temp route; the AGENT points-leaderboard nav entry retires via an atomic swap (no gap, no orphaned links inside `AgentDashboard`); BadgeGrid + Career Portal still reachable; temp URL-query effect removed; verification scripts updated to the real nav; gates green; final-diff scope clean.
- **ManagerDashboard nav is unchanged** (P5 territory).
- **WeeklyChampionsBanner is NOT re-homed** — its agent-denied data path is documented in the banner-disposition section above; banner data-source decision is a separate FU.

## Out of scope (updated 2026-05-31)

- **ManagerDashboard nav swap** (P5).
- **Deleting the points-leaderboard component file** — still consumed by `ManagerDashboard`; deletion is post-P5.
- **WeeklyChampionsBanner re-home / data-source fix** — separate data PR.
- **Role-scope toggle** (P5). App-wide contrast pass (FU). Any gamification/points data change.

## Rule references

Rule 9, 10, 11, 12, 15, 16, 17, 19.
