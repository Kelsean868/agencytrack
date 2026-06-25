# Handoff: AgencyTrack — Track K (New-Agent Financing & Bonus Tracker)

> **A Track K set.** These six interactive HTML mockups are **born in the same v2 language** as `design_handoff_v2_app/` and are meant to **join the same port pipeline** as a Track K block behind Track J. Same format (Build-Annotation sheets), same Nexus tokens, same "recreate-in-the-repo, don't paste-the-HTML" contract. Read `design_handoff_v2_app/README.md` first — everything there about the codebase, the token bridge, and the port workflow applies unchanged.

---

## 1. What this is

Track K makes the first-24-months **financing-and-bonus** structure visible, traceable to the Policy Ledger, and forward-looking. The largest recurring failure it targets is **expectation management** — agents misread what a quarterly bonus actually pays once tax and financing repayment come out, and managers have no early-warning view of adjustments or termination triggers.

Source of rules: *New Salesperson's Bonus and Financing Agreement* (TATIL Life, rev. 26/07/2017). **Currency: TTD.** Every dollar figure in these mockups (`$37,500` gate, `$8,000` financing, `25%` tax, `6×` ceiling, `95%` persistency) is a **configurable ruleset placeholder** — never a hardcoded constant. Confirm current-year values before seeding (§11 of the spec).

These are **hi-fi** references. Recreate them in the repo's React + Tailwind + Nexus tokens, in both light and dark, at 44px touch targets, reusing the shipped primitives. Where a surface is net-new, build it in the repo's conventions.

---

## 2. The set (priority order = the order they were drawn)

| # | File | Maps to PR | Surface |
|---|---|---|---|
| 1 ⭐ | `Track K Validation Dashboard - Agent Build.html` | **K8** | New-Agent Validation Dashboard — **agent** (flagship). Status hero + balance-vs-6×-ceiling, quarterly bonus gate, monthly financing projection, embedded take-home waterfall, year-end reconciliation projection, period-scoped ledger slice. |
| 2 | `Track K Validation Dashboard - Manager Build.html` | **K7 + K8** | Manager roster + suggested-vs-confirmed override + `adjustmentPct`; **termination-risk monitor** (consecutive-miss on confirmed basis, >10% downward-adjustment → BM-notify duty). |
| 3 | `Track K Financing Terms Setup - Build.html` | **K1** | Per-agent `financingTerms` form (agreed/current financing, validating API, effective date) + the **manager-set 5-state status machine**, with a badge designed for every state. |
| 4 | `Track K Monthly Statement Entry - Build.html` | **K2** | Manual monthly statement entry; **authoritative stored running balance** (statement wins); skipped-month **reconciliation flag**. |
| 5 | `Track K Take-Home Waterfall - Component.html` | **K4** | The bonus take-home waterfall **component** — Gross → −25% tax → Net → −50% → Take-home; projected + actual; on-financing vs cleared. THE expectation-management surface. |
| 6 | `Track K Reconciliation - Build.html` | **K6** | Month-12 / early-exit reconciliation: drawn vs offsets, service-gated first-3-months waiver, **OWING → garnish** vs **SURPLUS → lump sum**. |

> K3 (bonus engine) and K5 (proration resolution) are **pure modules** with no dedicated surface — their outputs render inside screens 1, 2 and 5. No standalone mockup is needed; they're annotated where they surface.

---

## 3. Design-system reuse — what's new vs what's shipped

Everything is built from the **existing Nexus tokens** (`primary`/teal, `gold`, `ink` scale, `success`/`warning`/`danger`, surfaces, `Cabinet Grotesk` / `Satoshi` / `JetBrains Mono`). **No new hexes.** The one glass surface (the agent dashboard hero) uses the shipped **Nexus Glass** hero recipe — one glass card per screen, per the census; every data table, form, roster and worklist stays flat/opaque.

**The one genuinely shared new primitive is the basis badge.** It **extends** the awards-engine `Confirmed` (teal) / `Estimated` (amber) source-badge pattern with three financing-basis states, off the ledger's `basisSource` enum:

| Badge | `basisSource` | Tone | Meaning |
|---|---|---|---|
| **Settled — confirmed** | `settled-confirmed` | teal (= Confirmed) | Month 4+, BM-confirmed. Determination-grade. |
| **Submitted — final** | `submitted-final` | success green | Months 1–3, submitted basis is operative — no later settle-up. |
| **Submitted — provisional** | `submitted-provisional` | amber (= Estimated) | Month 4+ pre-confirm. Projection only; trues up to settled. Never drives a determination. |

One `basisBadge(basisSource)` helper renders all three. It appears on every screen, so build it first.

---

## 4. Mechanics that are LOCKED (drawn as fact, don't re-litigate)

These come straight from the spec's §2 and are rendered as truth in the mockups:

- **Take-home is net-first**: tax, *then* 50% of the after-tax net (6.1). `takeHome = gross × (1 − taxRate − 0.50)` while owing.
- **Proration is linear, manager-discretion final**, caps at 100% (agreed = ceiling).
- **Proration basis**: submitted for months 1–3, settled from month 4.
- **Real-time projections are provisional**; determinations (adjustment, termination) read the **confirmed basis only** — pending months show but never count.
- **50% is taken unconditionally while on financing**; truing-up happens at reconciliation.
- **Reconciliation** at month-12 or early exit; waiver applied only at 12-mo service; OWING → 6.2 garnish, SURPLUS → clear + lump sum.
- **Running balance is stored from the statement** (authoritative, self-correcting, may be negative = surplus).
- **Financing status is a manager-set, forward-only state machine** that gates every financing module.
- **The >10% downward-adjustment flag is a *notification duty* (notify Sales Admin by the 1st), NOT a termination.**

---

## 5. ⭐ Assumptions I had to make — **lock these before the port**

The spec is detailed, but drawing pixels forced decisions it didn't fully pin down. Each item below is a **design or mechanics assumption baked into the mockups** — confirm or correct each one. Several already exist as open items in spec §10/§11; I've noted which.

### Mechanics / calc

1. **Quarterly bonus base = Net-for-Production** (§10.2, working interp). Both consistency and production bonuses are drawn on the Net-for-Production base. *If 3.3/3.4 resolve to Net-for-Persistency, the projected-bonus figures on Screens 1 & 5 change.*
2. **Persistency gate uses the app's validated figure**, not clause 1.6 literal (§10.1, flagged for veto). The 96.2% sample and the 95% line assume the shipped formula.
3. **Quarterly status flips to `Qualified` only on the confirmed settled basis** at quarter-end — never off the live projection. Assumed symmetric with the miss-counter rule (§2.4). Confirm `At risk → Qualified` can't latch early.
4. **Consecutive-miss counter resets on a qualified quarter** (assumed) vs. counting lifetime misses. The 0→3 dots imply *consecutive*; confirm the reset rule and whether a non-settled (skipped) quarter breaks the streak or is ignored.
5. **`adjustmentPct` is measured against `agreedMonthlyFinancing`** (the full/ceiling amount), not `currentMonthlyFinancing`. The −50% / −14% readouts assume agreed is the denominator. Confirm which the >10% flag compares to.
6. **The take-home "while owing" column applies in BOTH `on_financing` and `post_financing_repayment`** (the 6.2 garnish keeps the 50%-of-net rule running). Assumed from 6.2; confirm the waterfall shows the split during repayment, not just during financing.
7. **Year-end reconciliation projection is waiver-adjusted** (assumes the projection applies the first-3-months waiver if 12-mo service is on track). Confirm whether the agent-facing projection should *show* the waiver pre-emptively or only at the event.
8. **Garnish "incentive payments" (6.2) maps to the awards-engine payouts** the app already tracks (§ Reconciliation flag 2). Confirm the 10%/50% withholding can reach those.

### State machine / data

9. **The status machine is forward-only** with no direct `on_financing → cleared`; `cleared` / `post_financing_repayment` are reachable **only through reconciliation**. Confirm whether any **backward/corrective** move (e.g. `reconciling → on_financing` to undo a mis-set event) is allowed, and with what audit.
10. **A skipped month is flagged, never interpolated** (drawn as locked, but the *resolution path* is assumed): the flag offers **Enter** or **Carry-with-note**. Confirm whether "carry" is permitted at all, and whether an **open flag blocks the month-12 reconciliation** (Screen 6 draws it as a blocking state, pending your call).
11. **Re-entering an existing month overwrites** the stored figures (statement reissued) with a confirm step + history retention. Assumed; confirm the overwrite/version policy.
12. **`currentMonthlyFinancing ≤ agreedMonthlyFinancing` is a hard validation** (Screen 3 blocks save otherwise). Assumed from "agreed = ceiling"; confirm it's enforced at write.

### Surface / UX

13. **Glass is used on exactly one card** — the agent dashboard financing hero — and nowhere else in Track K (per the census). Confirm the hero qualifies for the glass tier (it's a low-density, top-of-screen summary; I judged yes).
14. **The period drill-down is a *reuse* of the shipped Policy Ledger list**, period-scoped, gated on `usesPolicyLedger: true` with a settlements+submissions fallback (§7/§11). Confirm the Track-H list component is live enough to slice (Phase-0 source-verify).
15. **Manager "Notify Sales Admin" rides the existing Compliance-v2 nudge** (bell + email), new recipient/template only. Confirm the obligation is also **logged** (who/when) for the 5.3 paper trail, not just sent.
16. **Roster fan-out semantics on partial failure** = show-resolved + miss-count, never compute a branch total or a trigger from an incomplete read (mirrors Persistency-v2). Confirm this is the desired partial-fan-out behaviour.
17. **Sample figures are internally consistent across the set** (Seepersad: month 7/12, drawn 22,400 vs 48,000 ceiling, Q gross 29,800/37,500, persistency 96.2%, 2 misses; year-end projects to 6,200 owing → matches the Screen 6 worksheet). These are **illustrative placeholders**, not seed data.

### Credit filter (drawn around, not drawn)

18. **The `newBusinessType` credit filter edge cases** (`replacement` difference-only, `spia` 0%, **Staff** policies needing a flag) are **§10.3 open items** — not surfaced in these mockups (they affect the *engine*, not the *screens*). The ledger-slice API figures assume the filter is resolved upstream. Flagged here only so the dependency is visible.

---

## 6. How to view

Each `.html` is a **self-contained Build-Annotation sheet** (not a design-canvas board): a doc header → data-canon scope bar → legend → the live surface inside an app frame → numbered annotation cards → states → flags → component list. Open any file in a browser; everything is inline (fonts via Fontshare/Google). Resize to <1040px to see the responsive (mobile) reflow — the app frame collapses the sidebar to a top rail and the surface stacks.

Light theme is rendered; **dark parity is asserted via tokens** (same as the v2 sheets) — every color is a Nexus token with a `.dark` value, so the port produces both themes from one markup.

---

*Built to the locked design spec `track-k-financing-new-agent-design.md`. Decisions in §5 above are the only things between this set and a clean port — lock them and these drop into the K1→K8 queue.*
