# K6 — reconciliation event + 6.2 garnish + wind-down clocks — kickoff brief

**Authored:** post-#754 · dispatcher.
**Baseline:** origin/main `ffcb129` (K5 fill; K5 squash `12a026c`) — **Phase 0 re-verifies exact HEAD.**
**run_model:** `claude-opus-4-8` (money math + new collection + rules — judgment-dense).
**Mode:** Autonomous, ONE PR, **build straight through to PR-open, then HOLD**. **Unattended-eligible.** No merge, no deploy, no green-channel.
**Merge class:** **Human-merge (Rule 19)** — money math + new collection + status transitions. **+ operator pre-merge:** `firebase deploy --only firestore:rules` (additive carve-out; the seeded write-read-verify is the morning Phase 6).

## Header

| Field | Value |
|---|---|
| **Type** | Implementation PR — Track K · reconciliation event + record + status transitions + 6.2 garnish tracking + wind-down clocks |
| **Shape** | `financingReconciliation/{agentId}_{year}` collection + firestore.rules block + emulator tests + `financingReconciliation.js` (pure calc) + `financingService.js` reconcile method + reconciliation/wind-down surface + docs |
| **Size** | L |
| **Branch** | `feat/k6-reconciliation` |
| **Sources** | `docs/track-k-financing-new-agent-design.md` §5/§6 · `docs/design/track-k-locked-decisions.md` · `design_handoff_track_k/Track K Reconciliation - Build.html` + `README.md` · **the deployed K1 `financingTerms` (status machine + effectiveDate), K2 `financing` ledger, K5 proration** (Phase 1 reads these live) |
| **Risky classification** | **Verify-and-continue Phase 1** (unattended). Hard-stop-and-HOLD ONLY on a contract-math discrepancy vs the spec/addendum, or a required data source that doesn't exist. Otherwise build through. |
| **Smoke walk** | Emulator rules pre-merge + **seeded write-read-verify deferred to morning Phase 6** (operator deploys the additive rules first; reuse `scripts/verification/seed-financing-fixture.mjs`). Offline gates + emulator must be green at PR-open. |
| **Strike count** | 0/2 |

---

## Context

K1–K5 are on main: terms + status machine, monthly ledger + running balance, bonus engine, take-home waterfall, proration. K6 is the **wind-down** — the year-1 reconciliation event (apply the waiver, compute surplus-or-owing), the status transitions out of `on_financing`, the 6.2 post-financing garnish tracking, and the wind-down clocks (24-month term / 12-month service / 3-month waiver). "Year-end stops being a shock." This is the last of the back-office money PRs before K7 (termination monitor) and K8 (dashboard).

---

## Architectural decisions (locked at brief authoring — owner-confirmed this session)

1. **Reconciliation trigger** (owner lock): **auto at month-12 of `effectiveDate`** (the agent reaches 12 months in the agreement) **plus a manual early-election** (contract 6.5b — the agent elects to come off financing before month 12). Both transition `on_financing → reconciling`. Month-index from `effectiveDate` (bare `YYYY-MM-DD`) via the existing K2/K5 month math.
2. **First-3-months waiver** (owner lock, contract 6.6): the first 3 months' financing is waived **only if 12 months' continuous service is met** (i.e. the auto month-12 trigger). On a **manual early-election** (< month 12), the first 3 months are **repayable** — NOT waived. So:
   - `serviceMet = (serviceMonths >= 12)` at the event.
   - `waiverApplied = serviceMet ? sum(financingPaid for months 1–3) : 0`.
3. **Reconciliation math** (pure):
   - `closingBalance` = the running balance at the reconciliation month (authoritative, from the K2 statement; positive = agent owes / debit, negative = surplus owed to agent — K2 sign convention).
   - `reconciledPosition = closingBalance − waiverApplied` (the waiver forgives those draws, reducing what's owed).
   - `outcome = reconciledPosition > 0 ? 'owing' : 'surplus'`.
   - `surplusPaid = outcome === 'surplus' ? abs(reconciledPosition) : 0` (lump-sum to the agent).
   - `garnishStarted = (outcome === 'owing')`.
4. **Status transitions** drive K1's existing forward-only machine via `financingService` (do NOT re-implement the machine): `reconciling → cleared` when `outcome === 'surplus'` (surplus paid, done); `reconciling → post_financing_repayment` when `outcome === 'owing'` (garnish begins). The later `post_financing_repayment → cleared` is **manager-confirmed** when the balance reaches ≤ 0 (K6 surfaces "balance cleared — mark cleared?"; the manager confirms, consistent with the manager-set machine).
5. **6.2 garnish — REPLACES the on-financing 50%** (owner lock): once `post_financing_repayment`, the on-financing 50%-of-net **stops** and the 6.2 garnish begins — **no double-deduction window**. (K4's take-home calc already applies the 50% in the `post_financing_repayment` branch for the bonus portion; that stays consistent.) Garnish components: **10% of commissions + 50% of net bonuses + incentive payments**, monthly until the balance clears.
6. **Garnish tracking scope** (data-availability lock): the garnish **projection** uses the components with a ledger source — **10% × `netCommission` + 50% × net-bonus** (from the K2 statement / K4 take-home). The **incentive-payments component has no ledger source today** — it is **omitted from the projection** and noted as a documented limitation (banked FU: "garnish incentive-payments component needs an incentives ledger source"). The **balance run-down to `cleared` uses the authoritative statement `runningBalance`** (not the projection), so an incomplete projection never corrupts the actual wind-down. K6 does **not** write garnish amounts (statement-driven, K2); it projects + displays + detects the cleared condition.
7. **Wind-down clocks** (the deferred DerivedTermsPanel clocks, derived off `effectiveDate`, display-only): **24-month agreement term**, **12-month service / waiver-earned** status, **first-3-months waiver** window. If the panel surfaces the 6× ceiling for context, it uses **`currentMonthlyFinancing`** (contract 2.4/6.3 — consistent with the K2 ledger indicator; the K1-era agreed-basis FU is already corrected in K2).
8. **Data model** — `financingReconciliation/{agentId}_{year}` (new, flat, one per agent-year): `totalFinancingDrawn`, `totalOffsets`, `closingBalance`, `waiverApplied`, `serviceMet` (bool), `reconciledPosition`, `outcome` (enum), `surplusPaid`, `garnishStarted` (bool), `triggeredBy` (enum: `auto_month12` / `manual_election`), `agentId` (field == ID segment, query symmetry), audit. parseFloat numerics, `Timestamp.now()` for any in-array value.
9. **Rules** — new `financingReconciliation` block, **mirror the deployed K5/K2 single-boundary pattern**: write `[branch_manager, sales_manager, tenant_admin]` same-tenant + `platform_admin` (UM excluded); read `canAccessOwn(tenantId, agentId) || canManage(tenantId)` keyed on stored `agentId`; coarse type/enum validation; **no `hasOnly`/key-allowlist**. K6 owns this additive block + emulator tests + the operator deploy.
10. **Mount** — a new **Reconciliation** sub-view in `FinancingTab` (now `Terms · Ledger · Proration · Take-Home · Reconciliation` = 5), self-contained agent selector, mirroring the established sub-view pattern. CC recommends the exact placement at Phase 1; K1–K5 surfaces untouched.

## Out of scope

- Termination-risk / consecutive-miss / the >10% flag + notify duty → **K7** · the full multi-period dashboard + drill-down → **K8**
- Writing per-month garnish amounts (statement-driven, K2) · the incentive-payments garnish source (banked FU) · auto-firing the `post_financing_repayment → cleared` transition (manager-confirmed)
- Re-implementing the status machine (reuse K1) · re-implementing the credit filter / take-home (reuse K3/K4)

## Phase 0 — gate

Standard. Fresh branch `feat/k6-reconciliation` off synced `origin/main` (`ffcb129`). Clean tree. **Re-verify `git rev-parse --abbrev-ref HEAD` == feat/k6-reconciliation at the top of EVERY phase** (the worktree-switch lesson). STOP on divergence.

## Phase 1 — source-verify (verify-and-continue; hard-stop-and-HOLD only on a surprise)

1. `git ls-files` the sources (spec, addendum, locked-decisions, Reconciliation mockup, `financingService.js`) → tracked. Missing → STOP.
2. Greenfield grep: `financingReconciliation` / reconcile symbols new.
3. **Contract-math verification (load-bearing).** Confirm this brief's Decisions 1–6 (trigger, waiver gating, reconciliation math, garnish-replaces) are consistent with spec §5 + the addendum. **The three owner locks (1, 2, 5) are authoritative for this PR even where the spec is silent or looser** — they do NOT count as a discrepancy. Hard-stop-and-HOLD ONLY if the spec/addendum **contradicts** the math here (e.g. a different waiver formula). 
4. **Data-source check (load-bearing).** Confirm the sources exist: K2 ledger `runningBalance` + per-month `financingPaid` (for closingBalance + the months-1–3 waiver sum); `financingTerms.effectiveDate` (service-months) + status + `currentMonthlyFinancing`; K2 `netCommission` + the net-bonus figure (for the garnish projection). **If `runningBalance` or the months-1–3 `financingPaid` has no source → STOP and HOLD** (these are load-bearing). The **incentives** source is EXPECTED absent — that is pre-handled (Decision 6), NOT a stop.
5. Read the deployed K5/K2 rules block + helpers — confirm the mirror for the new `financingReconciliation` block.
6. Read K1's `financingService` status-transition method — confirm `reconciling`/`post_financing_repayment`/`cleared` transitions are supported (K6 drives, does not re-implement).
7. Mount: read `FinancingTab`; recommend the Reconciliation sub-view placement (file:line).
8. Mockup parity — Reconciliation sheet; confirm surface (trigger, waiver/surplus/owing, garnish projection, clocks); list anything drawn but out of K6 scope (esp. anything that's K7's >10%/notify or K8's dashboard).

**If 1–8 verify clean, CONTINUE to Phase 2 (no stop).** Hard-stop-and-HOLD only on #3 contradiction or #4 missing load-bearing source.

## Phase 2 — build

1. Rules block + emulator tests (mirror K5: agent-write-own→fail, agent-read-own→succeed, agent-read-other→fail, BM-same-tenant-write→succeed, cross-tenant→fail, UM-write→fail, bad-outcome-enum→fail, non-number→fail).
2. `financingReconciliation.js` — pure reconciliation math (Decisions 1–3) + the garnish projection (Decision 6) + the clock derivations (Decision 7) + exhaustive tests (waiver service-met vs early-election; surplus vs owing; the waiver swinging an early-election agent owing; garnish projection with the sourced components; zero/negative edges).
3. `financingService.js` reconcile method (writes the record + drives the status transition via K1's machine).
4. Reconciliation / wind-down surface at the locked mount (trigger control, waiver/surplus/owing readout, garnish projection + months-to-cleared, the clocks). Nexus tokens, both themes, 44px.

## Phase 3 — verification

- Lint 0 · build green · full suite green (+ new emulator rules tests).
- Hex-grep new/changed → clean. axe on the new surface (both themes).
- **Offline + emulator are the PR-open bar.** The seeded write-read-verify is **deferred to morning Phase 6** (deploy-gated, Rule 19): reconcile the seed agent → record persists → status transitions → reload-verified, both themes. Note this clearly in the report.

## Phase 4 — docs (placeholders)

- `docs/CONTEXT.md` — recently-shipped row (`#TBD`), top table → K6 shipped, Where-we-left-off. (Size cap.)
- `docs/FOLLOW_UPS.md` — bank: (a) **garnish incentive-payments component** needs an incentives ledger source; (b) the standalone Terms-screen DerivedTermsPanel (if the clocks should also live on the Terms screen) is optional; carry the K7 dependency (consumes the reconciliation/garnish state).

## Phase 5 — commit / push / PR

Conventional commits on `feat/k6-reconciliation`. Green gates. PR via `gh`: title `feat(k6): reconciliation event + 6.2 garnish + wind-down clocks (Track K)`; description = outcome + the worked surplus/owing examples (one service-met, one early-election) + the Phase 1 contract-math + data-source results + the explicit note that the write-read-verify is deferred to Phase 6. **Rule 15** paste-back. **Rule 20** — HEAD SHA. Do NOT merge. Surface PR URL, then **STOP and wait for dispatcher**.

## Phase 6 — held (morning, operator-gated)

Operator deploys the additive rules pre-merge (`firebase deploy --only firestore:rules` **from the K6 worktree** — the deploy reads the cwd's rules file; verify the live ruleset createTime advances + contains the new block, Rule 23/24). Then CC runs the seeded write-read-verify (reuse `seed-financing-fixture.mjs`; assert reconcile → record persisted, status transitioned, surplus/owing correct), Admin-SDK cleans the seed. Human-merge. `/post-merge <pr#>` (Sonnet) — **no rules re-deploy** (merged main == deployed). **Rule 21** poll; **Rule 22** name ≥1 gap.

## Strike rules

Session opens 0/2. Hard stops (Rule 12 phrasing only):
- Phase 1 #3 contract-math contradiction, or #4 missing load-bearing source (runningBalance / months-1–3 financingPaid) → **STOP and wait for dispatcher** (unattended → HOLD for morning)
- Any decision not pre-listed (Rule 1) → **STOP and wait for dispatcher**
- Phase 2 scope expansion — K7's >10%/notify, K8's dashboard, re-implementing the status machine/credit filter, writing per-month garnish → **STOP and wait for dispatcher**
- Phase 3 lint/build/suite/axe/emulator failure after one fix attempt → **STOP and wait for dispatcher**
- A wrong-worktree or wrong-branch detection at any phase gate → **STOP IMMEDIATELY**
