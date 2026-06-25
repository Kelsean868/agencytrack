# Track K — Locked Decisions Addendum

**Date:** 2026-06-06
**Supersedes:** working interpretations in `docs/track-k-financing-new-agent-design.md` §3/§4/§10 where stated below.
**Inputs:** product-owner answers (head-of-sales confirmed, 2026-06-06) + `design_handoff_track_k/README.md` §5 (18 design/mechanics assumptions).
**Status:** all items LOCKED except **A.4 (Staff policies)** — OPEN, gates K3 only.

---

## A. Resolved by product owner

| # | Item | Resolution |
|---|---|---|
| A.1 | 2017 agreement figures current for 2026? | **Yes.** $37,500/qtr gate, $150K/$200K annual tiers, 12% interest stand. Seed as 2026 ruleset values — still configurable, never hardcoded. Closes spec §11 vintage risk. |
| A.2 | Quarterly bonus base | **Includes the 10% LSD + 10% inc-PPP credits** → base = Net New Settled API **for Persistency** (contract 1.4). Supersedes spec §4 working interp (was Net-for-Production / 1.5). The **Annual Bonus Adjustment** qualifying amount remains **Net-for-Production** per contract 1.8 (explicit). Closes spec §10.2 and CD assumption #1. Screens 1 & 5 projected-bonus values shift — placeholders only, no redraw. |
| A.3 | Credit filter: replacement, SPIA | **Both 0% — not counted.** Supersedes the spec's difference-only default for `replacement`; confirms `spia` under the single-premium exclusion. Closes spec §10.3 (two of three) and CD #18 (partial). |
| A.4 | Credit filter: Staff policies | **⚠ OPEN.** Product owner states **counted**; contract 1.2 states **excluded**. Pending explicit confirm. If counted → operative-practice divergence documented, no staff flag needed on the ledger (K3 simplifies). If excluded → staff identification required (new ledger flag, or pilot out-of-scope call). **Gates K3 only.** |
| A.5 | Persistency gate formula | **App's validated formula (E3)** — the official monthly figure managers enter. Contract clause 1.6 literal stays a documented divergence. Closes spec §10.1 / CD #2. Offered for veto three times; none received; mockups assume it. LOCKED. |

## B. Locked at dispatcher review (CD README §5 — vetoable before each consuming PR)

| CD# | Lock |
|---|---|
| 3 | **Qualified latches only on the quarter's operative basis at quarter-close.** Q1 = `submitted-final` (contract 3.3 first-quarter exception); Q2+ = `settled-confirmed`. Never off `submitted-provisional`. `At risk → Qualified` cannot latch early. |
| 4 | **Miss counter is monthly and consecutive** (contract 7.2c). Resets on any month meeting the validation target. A pending (unconfirmed) month neither counts nor resets — the counter holds until the month confirms. |
| 5 | **Two distinct measures.** (a) Monthly proration shortfall (suggested vs agreed) = informational readout. (b) The clause-5.3 **>10% flag + notify-Sales-Admin duty fires on a standing cut**: confirmed financing >10% below `currentMonthlyFinancing` (the amount in effect / new Validation Schedule), denominator = `currentMonthlyFinancing`, not `agreedMonthlyFinancing`. Routine proration does not spam the duty. Manager-screen annotation updates accordingly at port (visual unchanged). |
| 6 | Take-home 50%-of-net split applies in **both** `on_financing` and `post_financing_repayment` (clause 6.2, owner-confirmed). Waterfall shows the split in both states. |
| 7 | Year-end projection is **waiver-adjusted with an explicit labeled waiver line** ("first-3-months waiver — applies at 12 months' service; repayable on earlier exit"). |
| 8 | Garnish "incentive payments" (6.2) = awards-engine **cash** payouts included in the expected-offset computation. The statement remains authoritative; app figures are expected/reconciliation values. |
| 9 | **State machine forward-only.** Legal: `not_on_financing→on_financing`; `on_financing→reconciling`; `reconciling→post_financing_repayment` (OWING) or `reconciling→cleared` (SURPLUS); `post_financing_repayment→cleared`. No manager backward moves. Admin-level corrective transition (with required note + audit) **deferred — banked as FU at K1 Phase 4**. |
| 10 | Skipped month: **Enter** or **Carry-with-note** both permitted. An **open flag (neither resolved) blocks month-12 reconciliation**, as drawn on Screen 6. |
| 11 | Re-entering an existing month **overwrites with a confirm step**; prior values retained in the doc's audit history (statement-reissued case). |
| 12 | `currentMonthlyFinancing ≤ agreedMonthlyFinancing` is a **hard validation** at service + UI (agreed = ceiling, spec §2.2). Enforced from K1. |
| 13 | Glass on **exactly one card** — the agent dashboard financing hero. Everything else flat/opaque per the census. |
| 14 | Period drill-down **reuses the shipped Track H Policy Ledger list**, period-scoped, gated `usesPolicyLedger: true`, settlements+submissions fallback. Component liveness verified at K8 Phase 0/1. |
| 15 | Notify-Sales-Admin rides the existing Compliance-v2 nudge (bell + email, new recipient/template) **and is logged** (who/when/payload) for the 5.3 paper trail. |
| 16 | Roster fan-out on partial failure = **show-resolved + miss-count**; never compute a total or fire a trigger from an incomplete read (Persistency-v2 precedent). |
| 17 | Sample figures (Seepersad set) are illustrative placeholders, not seed data. Noted. |

## C. Gate map

- **K1** — nothing open. Dispatchable.
- **K2** — B.10, B.11 locked. Dispatchable after K1.
- **K3** — **blocked on A.4 (Staff confirm)** only.
- **K4–K8** — all governing decisions locked above.
