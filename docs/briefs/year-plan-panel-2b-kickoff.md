# Year Plan Panel — Slice 2b Kickoff Brief

**Track:** Game Plan Hub — Step 2 (Year Plan)
**Slice:** 2b — Award Strip + Manager licenseProfile Override
**Depends on:** Slice 2a merged (PR #576) — `yearPlan/{year}` collection live, `YearPlanModal` with gated flag

---

## Phase-1 Recon Findings (awardsRuleset_2026)

_Verified against `src/config/awardsRuleset/2026.js` at banking time._

### Annual-API-ranked awards (agent)

The ruleset supports clean ranking by `lines.life.targetAPI` from the Year Plan (Life line only):

| Award | API Threshold | In-Contention | Extra gates |
|-------|--------------|---------------|-------------|
| Persistency Silver | 250 000 | 125 000 | 92% persist |
| Persistency Gold | 250 000 | 125 000 | 95% persist |
| New Business Advisor | 250 000 | 125 000 | ≤18 months at Tatil, 52 apps, 95% persist |
| Rookie of the Year | 325 000 | 162 500 | ≤18 months in industry, 52 apps, 95% persist |
| MDRT | 500 000 | 250 000 | none |
| Club — Bronze L3 | 250 000–350 000 | 125 000 | 50 apps, 90% persist |
| Club — Bronze L2 | 350 000–450 000 | 175 000 | 50 apps, 90% persist |
| Club — Bronze L1 | 450 000–550 000 | 225 000 | 50 apps, 90% persist |
| Club — Silver | 550 000–650 000 | 275 000 | 50 apps, 90% persist |
| Club — Gold | 650 000+ | 325 000 | 50 apps, 90% persist |
| Agent of the Year | 1 000 000 | 500 000 | 50 apps, 90% persist, excl. BDO/DSO |

### Key structural observations

- **Club tiers are the natural backbone** of the strip — they tile the API range 250k–650k+ continuously with clear boundaries.
- **MDRT** (500k) sits inside Silver Club territory — it should display as a distinct overlay on the strip.
- **Persistency Silver/Gold** overlap with the lower club range. They add a persist-gate note, not a separate API position.
- **Conditional awards** (Rookie, New Business Advisor) should only render if `agentProfile.monthsInIndustry ≤ 18` / `monthsAtTatil ≤ 18` respectively.
- **No ranking concept exists today** for "best performer among all agents" — all awards are individual threshold/tier gates. No leaderboard integration needed for Slice 2b.
- **App-count axis**: centurionAward (100 apps) and all award app gates can be projected from `derivedApps` (lifeTargetAPI ÷ avgPolicy 12 000). No separate apps input needed.

### Computation basis — Life line only

The strip projects off **`lines.life.targetAPI`** (the Life line allocation from the saved year plan), NOT `totalEnabledAPI`.

**Why Life only:** In the Life-only pilot, only Life is submittable — Life is the honest "what you'll be credited" number. A&H / Property / Motor lines are visible in the allocator (with §7.7 "doesn't count toward awards" disclaimer per existing Slice 2a design) but excluded from projection. If non-Life lines become submittable in future, the projection input and `awardsEngine.js` will need per-line filter logic (FU banked in FOLLOW_UPS.md).

### awardsEngine.js discrepancy (banked, DO NOT modify)

`awardsEngine.js` has no per-line filter — it aggregates `totalEnabledAPI` across all lines when computing award eligibility from confirmed settlements. For the Life-only pilot this is moot (only Life submissions exist). Slice 2b does NOT modify `awardsEngine.js`. FU tracked if non-Life ever becomes submittable.

---

## What Slice 2b builds

### Part A — AwardProjectionStrip component

A horizontal strip (or compact list on mobile) rendered **below the allocator footer** inside `YearPlanModal` (in the allocating phase only) showing which annual awards the agent's current Life-line plan puts them on track for.

**Display states per award:**

| State | Meaning | Visual |
|-------|---------|--------|
| `on-track` | lifeTargetAPI ≥ threshold | Teal badge, ✓ |
| `in-contention` | lifeTargetAPI ≥ inContention AND < threshold | Amber badge, ⟳ |
| `not-yet` | lifeTargetAPI < inContention | Muted badge, — |
| `n/a` | Profile gate fails (BDO/DSO, experience) | Hidden entirely |

**Awards shown in strip (ordered by threshold, lowest first):**
1. Persistency Silver / Gold (250k, grouped as one pill if both thresholds met or near)
2. Club tier — the highest tier the plan's lifeTargetAPI falls into (one pill, not all five)
3. MDRT (500k) — standalone pill when lifeTargetAPI ≥ 250k
4. Rookie / New Business Advisor — only when experience gate passes
5. Agent of the Year (1M) — shown at bottom when lifeTargetAPI ≥ 500k

**§7.7 cue:** A&H / Property / Motor lines already display a "doesn't count toward awards" note (Slice 2a). The strip is additive — no change to that cue.

**Computation:**
- Input: `lines.life.targetAPI` (from live allocator state — Life line value only)
- Persist gate: `ASSUMED_PERSIST_DEFAULT = 90` — strip shows "assumes ≥90% persistency" disclaimer
- Apps: derived as `Math.round(lifeTargetAPI / 12000)` — strip shows projected apps count
- No Firestore reads — purely derived from allocator state
- Strip updates live as the agent adjusts Life-line allocation (reactive, not on-save)

**File:** `src/components/agent/AwardProjectionStrip.jsx`
**Tests:** unit (pure projection logic in `src/lib/yearPlanProjection.js`) + RTL for strip render states

### Part B — Manager licenseProfile Override (LOCKED — Option B)

Manager can update `licenseProfile` on the agent's user doc from a dropdown in `EditUserDrawer`.

**Why Option B:** Agent doc is already manager-writable; no new Firestore rules change required. The `ProfileChip` agent-self-edit surface already exists. Manager version adds a dropdown listing the 3 profiles (`composite` / `life_only` / `general_only`) to the existing edit-user form.

**Implementation:**
- Add licenseProfile dropdown to `EditUserDrawer.jsx` (existing manager edit-user form)
- Wire save through the existing user-doc update path (same path used for other fields in EditUserDrawer)
- Display current profile value (read from user doc)
- No new Firestore collection, no rules change, no CF change

---

## Decisions locked

- Strip is **purely derived** — no new Firestore read, no new collection
- Awards shown filtered by `agentProfile.monthsInIndustry` / `isBdoDso` (passed as props from `useAuth` user doc)
- Persist gate assumed at 90 for projection display (disclaimer shown)
- Club tier: show only the **single highest tier** the plan reaches (not all five simultaneously)
- Strip renders **only in allocating phase** — not visible in profile-prompt or no-seed states
- Unit tests live in `src/lib/yearPlanProjection.js` (pure function, same pattern as `yearPlanAllocation.js`)
- **Computation basis: `lines.life.targetAPI` only** (not totalEnabledAPI)
- **No `awardsEngine.js` modification** — strip projection is a new pure function; engine stays unchanged
- **Part B = Option B** — licenseProfile dropdown in EditUserDrawer only; no rules change; no new collection
- Green-channel eligible (flag-gated frontend + existing-field user-doc update; dormant on merge unless `VITE_YEAR_PLAN_ENABLED` is set)

---

## Out of scope for Slice 2b

- Actual award eligibility computation from confirmed settlements (already done by `awardsEngine.js` / `AgentAwardsPanel`)
- MDRT tracking / submission
- Quarterly / monthly award projections (strip is annual only)
- Award notification triggers
- `awardsEngine.js` per-line filter (moot in Life-only pilot — FU banked)
- Manager read of agent's yearPlan doc (deferred to a later slice)

---

## File inventory

| File | Action |
|------|--------|
| `src/lib/yearPlanProjection.js` | NEW — pure projection helpers: `projectAwards(lifeTargetAPI, derivedApps, agentProfile, ruleset)` |
| `src/lib/__tests__/yearPlanProjection.test.js` | NEW — unit tests |
| `src/components/agent/AwardProjectionStrip.jsx` | NEW — strip component |
| `src/components/agent/__tests__/AwardProjectionStrip.test.jsx` | NEW — RTL tests |
| `src/components/agent/YearPlanModal.jsx` | MODIFY — mount strip in allocating phase, below summary card |
| `src/components/manager/EditUserDrawer.jsx` | MODIFY — add licenseProfile dropdown |
| `src/components/manager/__tests__/EditUserDrawer.test.jsx` | MODIFY — add licenseProfile test coverage |

---

## Methodology

- Rule 1 applies throughout: CC must STOP and wait for dispatcher before decisions not listed above
- Smoke deferred — feature remains gated behind `VITE_YEAR_PLAN_ENABLED`
- No Firestore rules changes
- Green-channel eligible: flag-gated frontend + existing-field user-doc update (no new aesthetic UI judgment beyond Slice 2a)
- Both-themes render smoke of YearPlanModal (light + dark) once strip is mounted
