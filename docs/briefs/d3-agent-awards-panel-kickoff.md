# D3 — AgentAwardsPanel Enhancements — Build Lock

**Type:** Feature (closes FOLLOW_UP "D3 agent-panel parity", MEDIUM)
**Branch:** `feat/d3-agent-awards-enhancements`
**Phase 1 verify:** complete (against main `b1a3b98`, conflict scan clean)
**Scope class:** display layer + 3 pure engine helpers. No ruleset, no firestore.rules, no CF.

---

## Goal

Add three agent-facing enhancements to `src/components/awards/AgentAwardsPanel.jsx`, mirroring the management awards arc (D1–D5):

1. **Distance-to-next-tier callout** — "X to go" toward the next threshold/tier.
2. **Per-award pace indicator** — Achieved / On track / At risk / Far off.
3. **Persistency-gate prominence** — when production targets are met and persistency is the *only* thing blocking the award.

## Scope boundary (hard)

- **MUST NOT touch `ManagerAwardsPanel.jsx`.**
- **MUST NOT touch `BmAtRiskPanel.jsx`** (leave its inline `getPeriodCtx`; dedupe is a logged follow-up).
- **MUST NOT add any key to `DEFAULT_RULESET_2026`** (a new key joins `REQUIRED_GROUPS` and breaks `setAwardsRuleset` on pre-existing tenant docs — the D5 lesson).
- No `firestore.rules`, no `functions/`, no new Firestore field.

---

## Decisions (do not re-litigate)

- **`getPeriodCtx`**: lift from `BmAtRiskPanel.jsx:17` to a named export in `src/utils/awardsEngine.js`. Match the existing logic exactly: `(category, currentDate) → { weeksElapsed, periodWeeks }` for monthly / quarterly / annual-or-club. Use the export in AgentAwardsPanel. **Do not modify BmAtRiskPanel.**
- **Leg 3 scoping**: fire only when `award.dataSource === 'confirmed'` AND the persistency criterion is the *sole* unmet criterion. On estimated data the gate is waived (and the "Estimated — pending confirmation" note already shows), so leg 3 must stay silent there.
- **Pure logic lives in the engine** (testable), rendering lives in the panel.
- **GapBadge**: local re-implementation in the panel (reuse the within-20%-of-target amber threshold). No cross-domain import from `goals/`.

---

## Phase 0 — Branch

```
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b feat/d3-agent-awards-enhancements
```

## Phase 2 — Code

### `src/utils/awardsEngine.js` — three pure exports (no ruleset change)

1. **`getPeriodCtx(category, currentDate)`** — lifted verbatim from BmAtRiskPanel's inline helper. Returns `{ weeksElapsed, periodWeeks }`.
2. **`nextTierDistance(annualApi, tiers)`** — given the agent's annual API and the sorted `ruleset.clubAward.tiers` array, return `{ nextTier, distance }` for the tier immediately above the agent's current standing, or `null` if already at the top tier (Gold). `parseFloat` the API. Distance = `nextTier.apiMin - annualApi` (floored at 0).
3. **`isPersistencyOnlyBlock(award)`** — returns `true` iff `award.dataSource === 'confirmed'` and `unmet = award.criteria.filter(c => !c.met)` has `length > 0` and `unmet.every(c => /persistency/i.test(c.label))`.

### `src/components/awards/AgentAwardsPanel.jsx`

- Import `computeAtRiskStatus`, `getPeriodCtx`, `nextTierDistance`, `isPersistencyOnlyBlock` from the engine (it already imports `computeAgentAwards`, `computeRatioTrends`).
- In the existing awards `useMemo` (which already has the full awards map + `ruleset`), per award compute:
  - `paceStatus = computeAtRiskStatus(award, getPeriodCtx(award.category, currentDate))`
  - club awards only: `tierGap = nextTierDistance(annualApi, ruleset.clubAward.tiers)` (derive `annualApi` from the same source the engine uses)
  - `persistencyBlock = isPersistencyOnlyBlock(award)`
- Pass `paceStatus`, `tierGap`, `persistencyBlock` as props to `AwardCard`.
- **`AwardCard` rendering** (Nexus tokens only, no inline styles, 44px targets, `parseFloat` on numerics):
  - **Leg 1**: a "X to go" badge. Club: from `tierGap` (TTD-formatted via the app's existing currency formatter; show the target tier name). Non-club: per unmet criterion, `target - current` ("X to go", with unit). Amber (`bg-warning/15`) when within 20% of target, muted (`bg-border/60 text-ink-muted`) otherwise. Suppress when already achieved / at top tier.
  - **Leg 2**: a pace pill driven by `paceStatus` — Achieved (`bg-success`), On track (`bg-primary`), At risk (`bg-warning`), Far off (muted/`bg-border`). Sensible label per state.
  - **Leg 3**: when `persistencyBlock`, an amber emphasis banner, e.g. "Production targets met — only persistency (X% of Y% required) stands between you and this award." Pull X/Y from the persistency criterion's `current`/`target`.

## Phase 3 — Tests, lint, build

Add to `src/utils/__tests__/awardsEngine.test.js`:
- `getPeriodCtx`: correct `{weeksElapsed, periodWeeks}` for monthly / quarterly / annual at sample dates.
- `nextTierDistance`: mid-ladder → distance to next tier up; below lowest → distance to Bronze L3; at Gold (top) → `null`.
- `isPersistencyOnlyBlock`: confirmed + sole-persistency-unmet → `true`; estimated + sole-persistency-unmet → `false`; confirmed + persistency met → `false`; confirmed + multiple unmet → `false`.

Then full Vitest suite, lint, build — all green.

## Phase 4 — Docs (placeholders, filled post-merge)

- **`docs/CONTEXT.md`**: top table (Last updated, main HEAD `#TBD`, Active track), recently-shipped row: `D3 — AgentAwardsPanel enhancements (distance-to-tier, per-award pace, persistency-gate prominence) — #TBD`. Update "Where we left off".
- **`docs/FOLLOW_UPS.md`**:
  - Mark **"D3 agent-panel parity"** RESOLVED (ref `#TBD`).
  - Add **LOW** — *`submissions[].persistencyRate` is a dead read*: read at `awardsEngine.js:141` + displayed in `SubmissionViewer.jsx:158`, but no wizard step or service ever writes it (always 0 on real docs). Either wire it to a wizard field or remove the dead read.
  - Add **LOW** — *`getPeriodCtx` duplicated*: canonical export now in `awardsEngine.js`; `BmAtRiskPanel.jsx:17` still has the inline copy. Dedupe BmAtRiskPanel to import the export.

## Phase 5 — PR (STOP after)

- Commit: `feat(awards): D3 AgentAwardsPanel — distance-to-tier, pace, persistency prominence`
- Push; Rule 15 verify on the feature branch (full SHAs, HEAD == origin/branch).
- Open PR. **PR checklist per Rule 18**: check `[x]` tests / lint / build / docs / scope (true at creation); leave the **smoke box unchecked** (pending the smoke below).
- **Do NOT merge.**

## Phase 5.5 — Smoke (CC runs; warm desktop, browser MCP + `setupBypassSession`)

Assert **rendered** state, not selectors. On the PR preview, logged in as the test agent (`kelsean@gmail.com`), open the awards view:

1. **Leg 1**: a club award shows a "distance to next tier" badge with a sensible TTD figure + target tier name; a non-club award shows "X to go" on an unmet criterion.
2. **Leg 2**: each award shows a pace pill (Achieved / On track / At risk / Far off) consistent with its progress.
3. **Leg 3 — both directions** (this is the de-risk):
   - **Negative (natural):** on the test agent's estimated awards where persistency reads 0%, the amber persistency banner does **NOT** appear.
   - **Positive (seed if needed):** if no confirmed award with sole-persistency-unmet exists, seed one via Admin SDK (a confirmed settlement for the test agent with API/apps **met** but persistency **< 90%**), reload, confirm the banner appears, then **clean up the fixture** (leave as found).

Report per-leg results + any console errors. Then **edit the PR to set the smoke checkbox to the real result** and annotate. **Do NOT merge.**

---

**End of every CC leg that completes a phase boundary: "STOP and wait for dispatcher."**
