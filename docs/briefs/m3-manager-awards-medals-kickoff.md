# Manager Portal Revamp — M3: Manager Awards medal system — kickoff brief

**Status:** Ready to execute. Third PR in the M-series. Visual cohesion fix — paradigm split eliminated.
**Estimated CC effort:** Half-day to one day. Single PR.
**Two-strike counter:** 0/2 (fresh session).
**Project carry-in:** 2/2 (E5 + C3). Workflow operates at tolerance ceiling — next process violation triggers hard stop.

---

## Context

Per the manager portal audit (recommendation #2): "Manager Awards → medal system — swap AwardCard's color-coded border surface for medal-1/6/2/locked medallions matching BadgeGrid. Aligns 'manager awards' and 'agent achievements' visually, killing the paradigm split."

**The paradigm split:** Currently, agent achievements use glossy radial-gradient medal coins (BadgeGrid: medal-1/6/2/3/4/etc with .glow boxshadow). Manager awards use color-coded card borders (AwardCard: bg-success-tint, bg-warning-tint, etc). Two completely different visual paradigms for what users perceive as "earned recognition." Bringing the manager side onto the medal system creates one unified visual language across both portals.

**Pre-approved design decision** (from audit Phase 3): use medal-1/6/2/locked palette per `mocks/manager-portal-concepts.html`. The mock is the visual target.

**What stays unchanged:**
- Data model — award eligibility computation logic (`computeManagerAwards` or similar) is untouched
- TabPills navigation between Annual/Activity/Recruiting (already on M1's primitive from PR #105)
- StatusPill usage for Qualified/In Contention/Not Yet Eligible labels (already on M1's primitive)
- DataSourceBadge (already shared from M1)
- Monthly Bonus card semantics — confirm in Phase 2 whether visual style stays or also adopts medal pattern

**Closures expected in PR description** (not in FOLLOW_UPS.md — housekeeping handles):
- Resolves audit recommendation #2 (Manager Awards medal system)

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -5`. HEAD should include PR #107 (M2 Manager Overview hero) at top.
4. Confirm clean state: `git worktree list` shows only main; `git branch` shows only `main`. Apply surface-before-act discipline if any stale worktrees exist (check uncommitted state before removing).
5. Create worktree at `.claude/worktrees/feat-m3-manager-awards-medals` on branch `feat/m3-manager-awards-medals`.
6. `cd` into the worktree.

---

## Phase 2 — Discovery

### 2a — Source-of-truth documents

1. `docs/design/manager-portal-recommendations.md` — re-read the Manager Awards recommendation in full
2. `mocks/manager-portal-concepts.html` — **open in browser, study the Manager Awards mock**. This is the visual target. Pay attention to:
   - Medal palette mapping (which palette for which award state)
   - Layout (grid? list? per-tab variation?)
   - Hover/focus states
   - Empty state visuals
   - Monthly Bonus card treatment (does it adopt medals, stay as-is, or become a hybrid?)

### 2b — Existing manager awards surface

1. `src/components/awards/ManagerAwardsPanel.jsx` — read in full. Map out:
   - Current AwardCard rendering structure
   - Bonus card vs award cards distinction
   - TabPills usage (Annual/Activity/Recruiting) post-M1
   - StatusPill usage (Qualified/In Contention/etc) post-M1
   - DataSourceBadge usage (Confirmed/Estimated) post-M1
2. `src/components/awards/AwardCard.jsx` — read in full. Capture:
   - Props/API
   - Visual variants currently supported
   - Hardcoded hex per audit (rank pills using `#f59e0b` / `#94a3b8` / `#b45309` for tier colors instead of medal tokens)
   - Animation/transition handling
3. `src/services/managerService.js` (or wherever `computeManagerAwards` lives) — confirm the eligibility computation returns enough state to drive medal selection (Qualified / In Contention / Not Yet Eligible at minimum)

### 2c — Agent portal medal pattern (reference)

1. `src/components/dashboard/BadgeGrid.jsx` — read in full. Capture:
   - Medal component structure (`.badge-medal`, `.tier-pips`, `.glow`)
   - Earned vs locked state handling
   - Hover/focus interactions
   - Empty state handling
2. `src/index.css` — search for `.badge-medal`, `.medal-1` through `.medal-8`, `.tier-pips`, `.glow`, `.badge-grid` definitions. Confirm:
   - Medal palette gradients
   - Glow shadow variants per palette
   - Locked state styling
3. `BADGES` constant from `src/components/dashboard/BadgeGrid.jsx` (per M2 discovery) — understand the structure used to drive medal rendering

### 2d — Medal-state mapping options

The audit specifies "medal-1/6/2/locked" but doesn't bind each medal to a specific state. Phase 3 surface should propose a concrete mapping based on the mock. Likely:

- **Qualified** (eligibility met) → medal-1 (gold gradient, with .glow)
- **In Contention** (on track but not yet met) → medal-2 (amber gradient, with .glow)
- **Not Yet Eligible** (below threshold) → locked (neutral gradient, no .glow)
- **Achieved** (officially confirmed by award process) → medal-1 with extra emphasis OR medal-6 (silver, premium) — depends on mock

If award tiers exist (e.g., Bronze/Silver/Gold for Club Member per the 2026 Tatil incentives doc per past memory), the medal palette might tier accordingly:
- Bronze tier → medal-2 (amber)
- Silver tier → medal-6 (silver)
- Gold tier → medal-1 (gold)

The mock will show the right mapping. Surface concrete proposals in Phase 3.

---

## Phase 3 — Design + scope surface (STOP HERE)

Smaller scope than M2's Phase 3, but still a real design approval gate. Output a structured surface:

```
DISCOVERY — M3 Manager Awards medal system

CURRENT STATE:
- ManagerAwardsPanel structure: <description>
- AwardCard props/variants: <list>
- Hardcoded hex audit findings:
  - <file:line>: <hex string used instead of token>
  - ...
- StatusPill / DataSourceBadge / TabPills wired correctly (per M1)? <yes/no>

MEDAL-STATE MAPPING (proposed):
- Qualified → medal-X with .glow
- In Contention → medal-Y with .glow
- Not Yet Eligible → locked (no glow)
- Achieved (if distinct) → medal-Z
- Tier handling (if award has Bronze/Silver/Gold variants): <mapping>

NEW/MODIFIED COMPONENTS:
- AwardCard.jsx — replaced inside or rewritten?
- AwardMedal.jsx — new component if medal display needs distinct logic from BadgeGrid?
- ManagerAwardsPanel.jsx — wiring changes
- ManagerMonthlyBonusCard or similar — does the bonus card adopt medals or stay?

LAYOUT:
- Grid shape per tab (annual: 4-up? activity: 3-up? recruiting: 2-up?)
- Responsive behavior at mobile

EMPTY/EDGE STATES:
- Tab with no awards in scope (e.g., recruiting tab for an early-career manager): <render>
- Award where data source is 'estimated' vs 'confirmed': <visual distinction>
- Locked award where the manager hasn't started qualifying: <visual>

SCOPE ESTIMATE:
- Files modified: <count, target ≤6>
- New files: <count, likely 0-2>
- New tests: <count>
- Hardcoded hex strings cleaned up: <count + locations>
- Risk: LOW (visual swap, no data wiring, M1 primitives already in place)

OPEN QUESTIONS FOR KELSEAN:
- <list any decisions that need a human design call>
- <e.g., "Monthly Bonus card — adopt medal system or keep current treatment for visual hierarchy?">
- <e.g., "If an award has tier progression (Bronze/Silver/Gold), should we show one medal at the current tier or all tiers stacked?">
```

**STOP at end of Phase 3.** Wait for Kelsean to:
- Lock the medal-state mapping
- Confirm scope of files touched
- Answer open questions
- Greenlight Phase 4

---

## Phase 4 — Implement (only after Phase 3 approval)

Build per the locked design. Order recommended:

1. **AwardMedal component (if needed as new)** — uses existing `.badge-medal` / `.medal-X` / `.glow` CSS, exposes prop API for state-to-medal mapping
2. **AwardCard refactor** — swap color-coded borders for medal display, preserve title/description/CTA/StatusPill placement per mock
3. **ManagerAwardsPanel wiring** — update consumer to pass correct state to AwardCard
4. **Monthly Bonus card** — apply per Phase 3 decision (adopt medals or leave alone)
5. **Hardcoded hex cleanup** — replace `#f59e0b` / `#94a3b8` / `#b45309` with appropriate `--color-medal-*` tokens (or remove if the medal component owns the gradient)

**Constraints:**
- Use M1 primitives (StatusPill already in use; preserve)
- Reuse `.badge-medal` / `.medal-X` / `.glow` CSS directly — no new CSS unless absolutely required
- 44px touch targets for any interactive elements
- Dark mode parity throughout
- `prefers-reduced-motion` respected for any new animations
- Functional components, useMemo/useCallback if any expensive derivations

**Zero behavior change.** Award eligibility logic stays exactly as-is. Only the visual representation changes. If you find pre-existing bugs in `computeManagerAwards` or similar, log as follow-ups.

---

## Phase 5 — Tests

If `ManagerAwardsPanel.test.jsx` or `AwardCard.test.jsx` exists, extend with assertions for the new medal rendering:
- Qualified award → renders medal-1 with .glow class
- In Contention → renders medal-2 (or whatever Phase 3 locked) with .glow
- Not Yet Eligible → renders locked medal (no .glow)
- Tier-progression awards → renders correct medal per tier

If no existing test files, create one following the WizardFormSaveStatus / MobileNavDrawer scaffold pattern.

`npm test` must remain 100% passing.

---

## Phase 6 — Production smoke (CC EXECUTES, not handed off)

Use `scripts/verification/lib/walk-helpers.mjs` (the WALK-1 hardened helpers).

### Smoke scope

1. **Manager Awards verification (primary):**
   - Sign in as a properly-roled manager account. **Note from M2's smoke:** `branch.manager@tatillife.com` has agent role claims and won't reach ManagerDashboard. Use `A11Y_SALES_MANAGER_EMAIL` or another properly-roled account.
   - Navigate to Awards tab
   - Verify each tab (Annual / Activity / Recruiting) renders medals correctly per state
   - Capture screenshots at desktop (1440x900) and mobile (390x844), light + dark
   - Total ~12 screenshots (3 tabs × 4 viewport/mode combos)
   - **Programmatic checks:**
     - No `#f59e0b` / `#94a3b8` / `#b45309` hex strings in inline styles
     - `.badge-medal` class present in award DOM
     - StatusPill (qualified/contention/not-eligible) labels still render correctly
     - No console errors

2. **Other manager screens regression sweep:**
   - Overview tab (M2 hero still loads correctly)
   - Goals tab (M1 TabPills still work)
   - Persistency tab (M1 Avatar in agent rows still renders)
   - One screenshot per tab at desktop light only — fast pass

3. **Agent portal regression** — sign in as test agent (`kelsean@gmail.com`), confirm Agent Dashboard + BadgeGrid still render normally (M3 changes shouldn't touch agent portal but the medal CSS is shared).

### Smoke gates

- Visual: medal palette matches mock, no hex strings in DOM, no layout shifts
- Functional: tab switching works, no console errors
- Cohesion: side-by-side check of manager Awards vs agent BadgeGrid — they should look like the same family of visuals

If smoke fails:
- **Visual regression on agent portal:** STOP and surface; M3 shouldn't affect agent visuals
- **Medal-state mismatch with Phase 3 approved mapping:** fix in scope, re-smoke
- **Other issues:** standard discipline (fix in scope, document, re-smoke)

---

## Phase 7 — Verify, commit, push, PR

1. `npm run lint` → 0 errors
2. `npm run build` → green
3. `npm test` → 100% passing (existing 459+ new tests must pass)
4. Commit organization (logical chunks):
   - `feat(awards): AwardMedal component (if new) using existing .badge-medal CSS`
   - `refactor(awards): replace AwardCard color-coded borders with medal display`
   - `refactor(awards): clean up hardcoded medal hex strings — use --color-medal-* tokens`
   - `test(awards): RTL tests for medal-state rendering`
5. Push, open PR titled: `feat(manager-revamp): M3 — Manager Awards medal system (paradigm split eliminated)`
6. PR description MUST include:
   - **Summary:** AwardCard color borders → medal display; visual cohesion with agent BadgeGrid achieved
   - **Closes:** audit recommendation #2
   - **Medal-state mapping** locked in Phase 3 (verbatim from approval)
   - **Hex cleanup:** count + file:line of hardcoded values removed
   - **Smoke results** from Phase 6 — screenshots embedded or referenced
   - **Side-by-side comparison note:** "Manager Awards and Agent BadgeGrid now use the same medal visual language"
   - **Test coverage:** count of new tests, total after merge
7. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Phase 2 reveals AwardCard's API is significantly different from what the medal pattern expects (e.g., requires fundamentally different props) → STOP and surface
- Phase 3 medal-state mapping has more than 4 states that don't fit the medal-1/2/6/locked palette → STOP and surface; may need design extension
- Implementing the medal swap requires modifying agent portal BadgeGrid or the shared `.badge-medal` CSS → STOP and surface; shared CSS changes need separate consideration
- Any source code changes outside the awards components + hex cleanup → STOP
- Test suite regression → STOP
- CI gate fails → STOP and fix before requesting review
- Two strikes hit → STOP

---

## Out of scope

- New award types or eligibility logic (M3 is visual only)
- Other manager portal screens (M4 Goals IA next, M5 WeeklyChampionsBanner after)
- Changes to agent portal BadgeGrid (it's the source pattern; don't touch)
- Modifying shared `.badge-medal` CSS — reuse as-is
- Award notifications or workflow changes
- TenantAdminDashboard awards surface (if it exists — separate scope)
- Walk script changes
- Rules changes
- Updating `docs/FOLLOW_UPS.md` (housekeeping handles closures)

---

## What success looks like

After this PR merges:

1. Manager Awards tab shows medals matching the agent portal's BadgeGrid visual language
2. The "color-coded card borders" paradigm is gone — replaced by medal palette
3. Hardcoded hex strings for rank colors are removed; everything uses tokens
4. A user toggling between agent BadgeGrid and Manager Awards sees the same visual family
5. M4 (Goals IA) can build on the cohesion established here

This is the smallest of the visible-redesign M-PRs but arguably has the biggest cross-portal cohesion impact — both surfaces will now feel like one design system instead of two.
