# K4 — bonus take-home calculator + waterfall surface — kickoff brief

**Authored:** post-#751 · dispatcher.
**Baseline:** origin/main `7c1a628` (K3 fill; K3 squash `83a491d`) — **Phase 0 re-verifies exact HEAD.**
**run_model:** `claude-opus-4-8` (money math — judgment-dense).
**Mode:** Autonomous, ONE PR, build to PR-open, then **HOLD**. No merge, no deploy, no green-channel.
**Merge class:** **Human-merge (Rule 19)** — money math + agent-facing. **No rules, no deploy** — K4 writes nothing to Firestore.

## Header

| Field | Value |
|---|---|
| **Type** | Implementation PR — Track K · take-home calc + thin K3 adapter + waterfall surface (the **first agent-facing value spike**) |
| **Shape** | `src/lib/financingTakeHome.js` (pure calc) + `src/lib/financingProjectedBonus.js` (thin per-agent-quarter K3 adapter) + take-home waterfall surface (mockup #5) + ruleset additions + docs |
| **Size** | M |
| **Branch** | `feat/k4-take-home` |
| **Sources** | `docs/track-k-financing-new-agent-design.md` §4 · `docs/design/track-k-locked-decisions.md` B.6 · `design_handoff_track_k/Track K Take-Home Waterfall - Component.html` + `README.md` · **`src/lib/financingBonusEngine.js` (K3 — the engine this consumes; read its JSDoc input contract)** |
| **Risky classification** | **YES (Phase 1 hard-stop)** — K4 is K3's **first consumer**; the adapter's mapping onto K3's input contract is the load-bearing lock (K3 Rule 22 gap: that contract was unverified, no consumer existed). Hard-stop after Phase 1 for dispatcher lock. |
| **Smoke walk** | **Required — render + axe both themes only.** No write-read-verify (K4 writes nothing). Reads run against current prod rules (K1/K2 collections already deployed). |
| **Strike count** | 0/2 |

---

## Context

K3 shipped the bonus engine. K4 turns its gross bonus figures into the **take-home waterfall** — THE expectation-management surface: an agent's $10,000 bonus nets **$3,750** in hand once tax and the 50%-of-net financing repayment come out, and showing that *before* payout is the whole point. K4 is a pure transform + a thin adapter that feeds K3 the selected agent's current-quarter data to produce a projected gross, plus the waterfall display. It **persists nothing** — the authoritative `bonusOffset` stays the K2 manual statement value, and K6 re-derives projections at reconciliation. So K4 needs no ledger write and no rules change.

---

## Architectural decisions (locked at brief authoring)

1. **Take-home calc — status-aware** (`src/lib/financingTakeHome.js`, pure): `(grossBonus, financingStatus, ruleset) → { gross, tax, net, financingPortion, takeHome }`.
   - **While owing** (`on_financing` OR `post_financing_repayment`, addendum B.6): `tax = gross × taxRate`; `net = gross − tax`; `financingPortion = net × financingPortionRate`; `takeHome = net − financingPortion`. One-step equivalent: `takeHome = net × (1 − financingPortionRate)`. The **tax-first sequence is load-bearing** (locked §2.1 / addendum A.1 — net, not gross). $10,000 → tax 2,500 → net 7,500 → financing 3,750 → **take-home 3,750**.
   - **Not owing** (`not_on_financing` OR `cleared`): `financingPortion = 0`; `takeHome = net` (tax only). $10,000 → **7,500**.
   - `grossBonus` floored at 0 already by K3; calc never produces negative take-home.
2. **Ruleset** — add `taxRate` (0.25) + `financingPortionRate` (0.50) to `src/config/financingRuleset/2026.js` (K3's module). Configurable placeholders, never hardcoded in the calc.
3. **Thin K3 adapter** (`src/lib/financingProjectedBonus.js`) — assemble the **selected agent's current quarter** into K3's input contract (policy lines w/ `newBusinessType` + amount + flags, lapses/reinstatements, the app's persistency value, `yearInAgreement` from `effectiveDate`, the Q1 submitted-basis flag) from the existing collections (policy ledger / settlements / persistency / financingTerms), call `computeFinancingBonus`, return the projected gross consistency/production figures. **Per-agent, current-quarter, projected only** — the full multi-period/multi-agent assembly is K8. This is the "thin adapter" the K3 brief deferred.
4. **Waterfall surface** (mockup #5) — in the financing tab: for the selected agent, projected gross → tax → net → financing → take-home descending waterfall, **on-financing vs cleared** contrast, **projected** state always + the **actual** state when an actual paid bonus is recorded/known. Nexus tokens, both themes, 44px, no gradients.
5. **No Firestore writes.** K4 is projection/display. The authoritative `bonusOffset` remains the K2 manually-entered statement value; reconciliation (K6) re-derives the expected offset deterministically from K3 + this calc. **No rules change, no new collection, no deploy.**
6. **Mount** — a third sub-view in the K1 `FinancingTab` segmented control (`Terms · Ledger · Take-Home`), or within the ledger view per the mockup — CC recommends at Phase 1, mirroring the K2 sub-view pattern (zero K1/K2 refactor).

## Out of scope

- Writing `bonusOffset` or any ledger field (K2 manual / K6 reconciliation re-derives) — **K4 persists nothing**
- Proration → **K5** · reconciliation → **K6** · termination monitor → **K7** · full multi-period/multi-agent live dashboard wiring → **K8**
- Any rules / new collection / deploy · any K5 proration field

## Phase 0 — gate

Standard. Fresh branch `feat/k4-take-home` off synced `origin/main` (`7c1a628`). Clean tree. STOP on divergence.

## Phase 1 — source-verify (ends in a hard-stop)

1. `git ls-files src/lib/financingBonusEngine.js src/config/financingRuleset/2026.js "design_handoff_track_k/Track K Take-Home Waterfall - Component.html"` → all tracked. Missing → **STOP and wait for dispatcher**.
2. Greenfield grep: `git grep -rn "financingTakeHome\|financingProjectedBonus" -- src` → 0 hits.
3. **K3 input-contract verification (load-bearing).** Read `financingBonusEngine.js` JSDoc + `computeFinancingBonus`'s expected `input` shape. Map each required field to a real source (policy ledger `newBusinessType`/`proposedAPI`/`settledAPI`/`isSelfOrFamily`/dates; settlements; persistency; `financingTerms.effectiveDate` → `yearInAgreement`; Q1 flag). **If any required engine input has no available source → STOP and wait for dispatcher** (the adapter mapping is the lock).
4. Confirm the take-home figures: hand-check $10,000 at 25%/50% → 3,750 (owing) and 7,500 (not owing); confirm the tax-first sequence against §4.
5. Read the K1 `FinancingTab` + K2 sub-view pattern; recommend the Take-Home mount (file:line).
6. Mockup parity — open the Take-Home Waterfall sheet; confirm projected/actual + on-financing/cleared states; list anything drawn but out of K4 scope.

**Report 1–6 with file:line + the adapter field-mapping table + the recommended mount, then STOP and wait for dispatcher.** No build until the dispatcher locks the adapter mapping and the mount.

## Phase 2 — build (after dispatcher lock)

1. `taxRate` + `financingPortionRate` in the ruleset.
2. `financingTakeHome.js` (Decision 1) + exhaustive tests (all four status branches; the $10K worked cases; boundary/zero).
3. `financingProjectedBonus.js` adapter (Decision 3) + tests (assembles input, calls engine, returns projected gross; mock the collection reads).
4. Take-home waterfall surface at the locked mount.

## Phase 3 — verification

- Lint 0 · build green · full suite green.
- Hex-grep new/changed source → clean. axe on the new surface (no new serious/critical, both themes).
- **Render smoke (both themes):** as BM, open the Take-Home view for the test agent → the waterfall renders the projected breakdown (gross → take-home), the on-financing vs cleared toggle shows 3,750 vs 7,500 on a $10K example, axe clean light + dark. **No write-read-verify** (nothing written).

## Phase 4 — docs (placeholders)

- `docs/CONTEXT.md` — recently-shipped row (`#TBD`), top table → K4 shipped, Where-we-left-off. (Size cap.)
- `docs/FOLLOW_UPS.md` — note the K3 live-wiring FU is **partially resolved** (per-agent current-quarter projection adapter shipped; full multi-period/agent assembly remains K8); carry the rest.

## Phase 5 — commit / push / PR

Conventional commits on `feat/k4-take-home`. Green gates. PR via `gh`: title `feat(k4): bonus take-home calc + waterfall + K3 projection adapter (Track K)`; description = outcome + the worked $10K example + the Phase 1 adapter-mapping result. **Rule 15** paste-back. **Rule 20** — name HEAD SHA. Do NOT merge. Surface PR URL, then **STOP and wait for dispatcher**.

## Phase 6 — held (post-merge)

Human-merge (money + agent-facing). **No deploy** (no rules). `/post-merge <pr#>` (Sonnet). **Rule 21** poll; **Rule 22** name ≥1 gap.

## Strike rules

Session opens 0/2. Hard stops (Rule 12 phrasing only):
- Phase 1 check failing, or an engine input with no source → **STOP and wait for dispatcher**
- Any decision not pre-listed (Rule 1) → **STOP and wait for dispatcher**
- Phase 2 scope expansion — any Firestore write, any rules change, any K5 proration field, any multi-period assembly → **STOP and wait for dispatcher**
- Phase 3 lint/build/suite/axe failure after one fix attempt → **STOP and wait for dispatcher**
