# Manager Portal Revamp — M5: WeeklyChampionsBanner upgrade — kickoff brief

**Status:** Ready to execute. Final M-series PR. Closes audit's top-5 recommendations.
**Estimated CC effort:** Half-day. Single PR.
**Two-strike counter:** 0/2 (fresh session).
**Project carry-in:** 0/2 (clean state).

---

## Context

Per the manager portal audit (recommendation #5, P1/small): "WeeklyChampionsBanner upgrade — mock shows medal-3 (bronze) coins for top-3 weekly performers, name + delta caption. Current renders count cards."

**The visual problem:** WeeklyChampionsBanner currently renders count cards (numeric tiles) for the week's top performers. The mock shows medal coins (matching the M3 award medals + agent BadgeGrid family) with performer name + delta caption. Visual paradigm should match the medal language established in M3.

**Pre-approved design decision** (from audit Phase 3): medal-3 (bronze) for all 3 positions per the mock — or tiered (gold/silver/bronze) if the mock shows that. Phase 3 surface should confirm from the mock.

**Closures expected in PR description** (not in FOLLOW_UPS.md — housekeeping handles):
- Resolves audit recommendation #5 (WeeklyChampionsBanner upgrade)
- **Closes the M-series — all 5 audit recommendations addressed**

**What stays unchanged:**
- Data sourcing (whatever computes the weekly top performers stays as-is)
- Banner placement in the dashboard
- Delta calculation logic

**M5 does NOT add:**
- New performer categories (current "top 3" preserved)
- Animation/celebration effects (out of scope; future polish)
- Historical weekly champions browsing (out of scope)

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -5`. HEAD should include the M4 squash commit at top.
4. Confirm clean state: `git worktree list` shows only main; surface-before-act for any stale worktrees.
5. Create worktree at `.claude/worktrees/feat-m5-weekly-champions-medals` on branch `feat/m5-weekly-champions-medals`.
6. `cd` into the worktree.

---

## Phase 2 — Discovery

Short, focused discovery. Most of the pattern is established by M3.

### 2a — Source-of-truth documents

1. `docs/design/manager-portal-recommendations.md` — re-read the WeeklyChampionsBanner section
2. `mocks/manager-portal-concepts.html` — open in browser, find the WeeklyChampions section. **Confirm:**
   - Medal palette per position (all medal-3 bronze? or medal-1/2/3 tiered?)
   - Banner layout shape
   - Name + delta caption placement
   - Empty state visuals (no champions data for this week)

### 2b — Current implementation

1. Find `WeeklyChampionsBanner.jsx` — read in full. Capture:
   - Props/API
   - Current count-card rendering
   - Data shape passed in
   - Loading/error/empty state handling
2. Find where it renders — likely ManagerDashboard.jsx or a parent component. Note the placement.
3. Find the data source — likely a service function computing top-3 performers from submissions. Note the file/function.

### 2c — Medal CSS reference

Confirm the existing medal CSS in `src/index.css` already includes `.medal-3` (bronze) — should be there from BadgeGrid. If not, surface in Phase 3.

---

## Phase 3 — Design + scope surface (STOP HERE — brief approval gate)

Output a compact surface:

```
DISCOVERY — M5 WeeklyChampionsBanner upgrade

CURRENT STATE:
- File: src/components/<path>/WeeklyChampionsBanner.jsx (~<N> lines)
- Renders: <description of current count-card layout>
- Props: <API>
- Data source: <service function>
- Placement: <parent component>

MEDAL MAPPING (from mock):
- Position 1 (top): medal-<X> [.glow]
- Position 2: medal-<Y> [.glow]
- Position 3: medal-<Z> [.glow]
- All-bronze vs tiered: <decision based on mock>

PROPOSED REWORK:
- Replace count cards with .badge-medal coins (reuse existing CSS, same pattern as M3's AwardMedalCard)
- Below each medal: performer name + delta caption (e.g., "+$5,200 vs last week" or "+12 apps")
- Layout: 3-up grid (matches mock)
- Empty state: <description>

NEW / MODIFIED COMPONENTS:
- WeeklyChampionsBanner.jsx — heavy modification (count cards → medals)
- WeeklyChampionsBanner.test.jsx — new tests OR extended tests
- No new component files unless a ChampionMedal sub-component improves cohesion

REUSE FROM M3:
- .badge-medal CSS classes (direct reuse, no changes)
- Optional: AwardMedal.jsx component if its API fits the use case (props: state, icon, label) — likely yes

SCOPE ESTIMATE:
- Files modified: <count, target ≤4>
- New files: <count, likely 0-1>
- Risk: LOW (visual swap, same data flow, established M3 pattern)

OPEN QUESTIONS FOR KELSEAN:
- Medal palette per position confirmed from mock?
- Empty state copy?
- Delta caption format (e.g., "+$5,200" vs "+12% vs last week")?
- Reuse AwardMedal component vs new ChampionMedal?
```

**STOP at end of Phase 3.** Wait for Kelsean to:
- Lock the medal mapping
- Approve delta caption format
- Decide on component reuse vs new
- Greenlight Phase 4

---

## Phase 4 — Implement (only after Phase 3 approval)

Build per locked design. Order:

1. **ChampionMedal sub-component (if needed as new)** OR reuse AwardMedal from M3
2. **WeeklyChampionsBanner refactor** — swap count cards for medal display
3. **Empty state** — per Phase 3 decision
4. **Delta caption styling** — match mock's typography

**Constraints (carry over):**
- Use M1 primitives where applicable
- Use existing Nexus tokens — no new ones
- 44px touch targets if any interactive elements (likely none — banner is read-only)
- Dark mode parity throughout
- `prefers-reduced-motion` respected for any new visual elements

**Zero data layer change.** Same service, same props shape, same computation. Only visual representation changes.

---

## Phase 5 — Tests

If `WeeklyChampionsBanner.test.jsx` exists, extend with assertions for medal rendering:
- 3 medals render when 3 champions present
- Medal class matches Phase 3 locked mapping
- Performer name + delta caption render correctly
- Empty state renders when no champions data

If no existing test file, create one following M3's AwardMedalCard test pattern.

`npm test` must remain 100% passing.

---

## Phase 6 — Production smoke (CC EXECUTES — non-negotiable per project standard)

Use `scripts/verification/lib/walk-helpers.mjs` setupBypassSession pattern.

### Smoke scope

1. **WeeklyChampionsBanner visual verification:**
   - Sign in as branch_manager (use A11Y_SALES_MANAGER_EMAIL or properly-roled account)
   - Navigate to the screen where banner renders (likely Overview or Dashboard)
   - Banner renders with 3 medal coins (or fewer if real data has <3 champions this week)
   - Capture screenshots at desktop (1440x900) and mobile (390x844), light + dark
   - Programmatic check: `.badge-medal` class present in banner DOM; no count-card hex strings in inline styles

2. **Other manager screens regression sweep:**
   - Overview (M2 hero), Awards (M3 medals), Goals (M4 IA), Persistency — quick desktop-light pass

3. **Agent portal regression** — confirm BadgeGrid still renders (medal CSS is shared)

### Smoke gates

- Banner shows medals, not count cards
- Names + deltas render correctly
- Dark mode parity
- No console errors
- No regression on M2/M3/M4 surfaces

---

## Phase 7 — Verify, commit, push, PR

1. `npm run lint` → 0 errors
2. `npm run build` → green
3. `npm test` → 100% passing
4. Commit organization:
   - `feat(manager-revamp): M5 — WeeklyChampionsBanner medal upgrade`
   - `test(manager-revamp): RTL coverage for WeeklyChampionsBanner medals`
5. Push, open PR titled: `feat(manager-revamp): M5 — WeeklyChampionsBanner upgrade (M-series complete)`
6. PR description MUST include:
   - **Summary:** count cards → medal coins; visual paradigm now consistent with M3 Awards + agent BadgeGrid
   - **Closes:** audit recommendation #5
   - **Closes the M-series** — all 5 audit recommendations addressed
   - **Medal mapping** locked in Phase 3 (verbatim)
   - **Smoke results** from Phase 6 — screenshots embedded
   - **Visual cohesion note:** Manager Awards + WeeklyChampions + Agent BadgeGrid now use the same medal visual language across the entire product
7. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Phase 2 reveals banner data source is more complex than expected (e.g., real-time subscription with complex aggregation) → STOP and surface (might need data layer changes, expanding scope)
- Phase 3 medal mapping doesn't match mock or existing palette → STOP and surface
- Any source code changes outside the banner + tests → STOP
- Test suite regression → STOP
- CI gate fails → STOP and fix before requesting review
- ANY token appearance in any artifact → IMMEDIATE STOP
- Two strikes hit → STOP

---

## Out of scope

- New performer categories beyond top-3
- Animation/celebration effects (future polish)
- Historical weekly champions view
- Data source changes (banner data computation stays as-is)
- Other manager portal screens (M-series complete after M5)
- Updating `docs/FOLLOW_UPS.md` (housekeeping handles closures)
- Modifications to medal CSS (use `.medal-3` and family as-is from M3)

---

## What success looks like

After this PR merges:

1. WeeklyChampionsBanner shows medal coins instead of count cards
2. Visual paradigm consistent across Manager Awards + WeeklyChampions + Agent BadgeGrid
3. **M-series complete:** all 5 audit recommendations closed
4. The product has one unified medal-based visual language for recognition

After M5: the manager portal revamp arc closes. Post-pilot backlog triage becomes the next priority queue.
