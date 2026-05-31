# Track J — P6: Nav swap — production leaderboard → primary nav; points board retires

**Sized:** S–M (small code, **high-stakes** — primary nav)
**Branch:** `redesign/leaderboard-nav-swap` (off main)
**Type:** Nav-config + routing change. **Human-merge + dispatcher pre-review.** Merge is the dispatcher's GitHub-UI action (Rule 19) — CC opens the PR and stops.

## Outcome

The production leaderboard (the P3/P4 surface, currently behind the `?tab=production-leaderboard` temp route) becomes a real primary-nav item. The points-based leaderboard retires from primary nav. Gamification (BadgeGrid, Career Portal) and WeeklyChampionsBanner survive.

## Decisions baked in (do not re-litigate)

- **Atomic swap:** add the production-leaderboard nav item AND remove the points-leaderboard nav item **in the same change** — there is never an intermediate state where the slot is empty or both are present.
- **Remove the temp route:** delete the `?tab=production-leaderboard` URL-query effect from P3 (the surface now mounts via the real nav item). The render block stays; only the temp entry point goes.
- **Do NOT delete the points-leaderboard component file in this PR.** Remove its nav entry only; if Phase 1 confirms the component is now fully unreferenced, bank an FU to delete it later. Deleting a component is not worth the risk inside a high-stakes nav PR.
- **Gamification survives:** BadgeGrid + Career Portal are independent of the points-leaderboard nav entry — confirm, don't assume.
- **WeeklyChampionsBanner survives** (production-based) — confirm it doesn't depend on the points board.
- **Role visibility:** the leaderboard nav item shows for everyone who can read a leaderboard (agents + managers).

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

## Phase 2 — build

- Add the production-leaderboard `NAV_ITEMS` entry (icon/label/route per Phase 1); ensure the nav route renders the existing podium surface.
- Remove the points-leaderboard `NAV_ITEMS` entry (same change — atomic).
- Remove the P3 temp-route URL-query effect.
- No data change; no gamification/Career Portal/WeeklyChampions edits beyond what Phase 1 proves is required.

## Phase 3 — gates

- **3a hex-grep** empty.
- **3b scope (FINAL diff, terminal):** the nav config + the surface's nav wiring + temp-route removal + tests + brief + CONTEXT + FOLLOW_UPS (+ smoke). No unrelated `src/`, no `functions/`.
- **3c lint / test / build** green (verbatim).
- **3d axe baseline-delta** both themes; NO-NEW serious/critical (Rule 9 carve-out only; contrast nodes already FU-tracked).
- **3e nav unit test:** `NAV_ITEMS` contains the production-leaderboard item and NOT the points-leaderboard item; the leaderboard route resolves to the podium surface.
- **3f LIVE smoke (both themes):** test agent logs in → the primary nav shows the production-leaderboard item; clicking it renders the podium surface reading the live aggregate; the points-leaderboard nav item is ABSENT; BadgeGrid + Career Portal nav items still present; WeeklyChampionsBanner still renders; 0 console errors. Preview; prod in Phase 6.

## Phase 4 — docs + FUs

- CONTEXT.md row (`#{TBD}`/`{TBD}`): the leaderboard is now primary nav; temp route retired.
- Bank FU: delete the orphaned points-leaderboard component if Phase 1 confirmed it's now unreferenced.

## Phase 5 — PR + STOP for pre-review

Open PR; paste gate results. **STOP — do not merge (Rule 19; merge is the dispatcher's UI action).** I pre-review: the atomic swap (item added + removed, no gap), no orphaned links to the retired board, gamification + WeeklyChampions intact, and the surface reachable via the real nav.

## Phase 6 — post-merge (after the dispatcher merges in the UI)

Sync, fill, push direct to main, Rule 15 verbatim; prod smoke (nav item present + points item absent + surface renders + gamification intact, both themes) verbatim.

## Acceptance criteria

- Production leaderboard is a real primary-nav item reachable without the temp route; points-leaderboard retired from primary nav via an atomic swap (no gap, no orphaned links); gamification + WeeklyChampionsBanner intact; temp URL-query effect removed; gates green; final-diff scope clean.

## Out of scope

Deleting the points-leaderboard component (FU if unreferenced). Role-scope toggle (P5). App-wide contrast pass (FU). Any gamification/points data change.

## Rule references

Rule 9, 10, 11, 12, 15, 16, 17, 19.
