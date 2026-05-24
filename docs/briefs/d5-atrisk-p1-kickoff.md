# Track D — BM At-Risk View (D5, Phase-1-FIRST kickoff)

**Track:** D, final management piece of the awards arc. The D3 scoping verify (session 07d702a8) already mapped this; D4 (#291) has since changed ManagerDashboard/ManagerAwardsPanel, so this is a FOCUSED re-verify off post-D4 main to confirm the deltas + lock the design. Build on D3's findings (confirm still true, don't re-discover): host = ManagerDashboard Awards tab (~:229-236); BM+ gate pattern (~ManagerDashboard:174); getAllYTDSubmissions at managerService.js:47; engine is 2-state (eligible/inContention); precedents = AccountabilityFlagPanel/computeMissedActivities, floorStatus green/amber/red, AwardMedalCard 3-state, GapBadge.
**Type:** Feature (new manager panel + new engine computation + ruleset interaction). **Size:** L. **Risk:** Medium-High — new engine state + a ruleset-schema change that touches the editor we just shipped.

**PHASE-1-FIRST.** Source-verify, report, STOP — no code. The dispatcher locks the at-risk definition + atRiskPct placement before any build.

---

## Phase 0 — clean main
git checkout main
git fetch origin
git pull --ff-only origin main
git status
Untracked scripts/verification/ + scripts/seed/ expected — ignore. Do NOT create a branch (read-only).
Hard stops (Rule 12): not on main, dirty tree beyond known untracked, pull conflict -> `STOP and wait for dispatcher`.

---

## Phase 1 — source-verify, then HARD-STOP

Report with file:line + short quotes. Pair grep with `git ls-files`. Then emit `STOP and wait for dispatcher`.

1. **Post-D4 ManagerDashboard delta.** D4 added a newAdvisors derivation + agentIds in the getTenantUsers useEffect. Quote ManagerDashboard's current data-loading (the useEffect, agentIds, newAdvisors, which user-profile fields are in hand). D5 adds the at-risk data load here — state what is ALREADY loaded vs what at-risk needs (per-agent YTD submissions via getAllYTDSubmissions; profile fields monthsInIndustry/monthsAtTatil/isBdoDso for eligibility gates).

2. **At-risk engine gap.** Quote computeAgentAwards' per-award return shape (eligible, inContention, criteria[], progress). Confirm there is NO "at risk of losing" state. Specify exactly what a 4th state needs: a pace projection (YTD value / weeks-elapsed x weeks-remaining vs threshold) and/or a persistency-trend check. Recommend a new pure function computeAtRiskStatus(award, ctx) vs extending the engine return shape.

3. **CRITICAL — the atRiskPct <-> editor interaction. Verify against the SHIPPED D2a/D2b editor code.** If we add an `atRiskPct` top-level field to DEFAULT_RULESET_2026 and the ruleset doc:
   a. Quote AwardsRulesetPanel `buildPayload`: does it deep-clone loadedRuleset (so an unknown-to-the-schema top-level field like atRiskPct is CARRIED THROUGH on an editor save), or does it reconstruct only the known SCALAR_GROUPS + ARRAY_GROUPS and thereby DROP atRiskPct?
   b. Quote setAwardsRuleset's completeness guard (REQUIRED_GROUPS): does it REJECT a ruleset that contains an extra atRiskPct key, or only assert the 16 award groups are present (extras allowed)?
   c. Does validateNumericFields now (post-D2b, recursing all fields) validate a top-level scalar atRiskPct as finite/non-negative?
   Report a crisp verdict: can atRiskPct safely live in the ruleset doc (carried through, not rejected, validated), or must it live elsewhere? THIS GATES THE DESIGN — if the editor would drop or reject it, say so.

4. **Host + data + precedent (confirm post-D4):** the Awards-tab host + BM+ gate still as D3 found; getAllYTDSubmissions signature; AccountabilityFlagPanel as the per-agent-flag UI precedent (quote its row/flag shape); floorStatus thresholds; AwardMedalCard state rendering.

5. **Constraints.** The terminated-flag feature is DEFERRED (not built). Note that D5's at-risk list operates on the CURRENT roster for now and will need a terminated filter LATER when that feature lands — flag this as a known follow-up, do not build it. Nexus tokens, 44px, getAwardsRuleset as the threshold source, parseFloat, loading/error/empty states.

---

## Phase 1 Recommendations (report, do not implement)
- **At-risk definition (the design-lock):** propose the precise rule for each of 4 states — "close to achieving" (!eligible && progress >= atRiskPct), "just achieved" (eligible), "at risk of losing" (eligible but pace-projection below threshold and/or persistency trending below gate — give the formula + which award periods it applies to), "not eligible". Recommend whether v1 includes the pace-projection or ships simpler.
- **atRiskPct placement:** per item 3 — ruleset field (default 80%) if the editor carries it safely; otherwise a separate config doc or a constant. Recommend, and note whether it should be exposed in the editor now or as a follow-up.
- **Panel:** new sub-section in the Awards tab, BM+ gated; shape (per-agent list, 4-state badges, filter pills by period/award/unit); derive-from-loaded vs a new eager query (prefer derive where possible; flag any new read/index).
- **Tests + smoke** outline (4-state classification unit tests at boundaries; panel renders for BM, hidden for UM).

**STOP and wait for dispatcher.**
