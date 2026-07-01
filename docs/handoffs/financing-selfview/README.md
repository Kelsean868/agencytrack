# Handoff: Track K — Financing Self-View (K9) + Unit Financing (Unit Manager)

## Overview

Two new subject-and-unit financing surfaces for the **New-Agent Financing & Bonus Tracker (Track K)**:

1. **Financing Self-View (K9)** — a **read-only, subject-facing** view of a financed person's *own* financing picture. **One component, two audiences:** an Agent, and a financed **Unit Manager viewing their own financing** under "My Production." Same layout for both.
2. **Unit Financing (Unit Manager)** — the branch-manager financing **roster + termination-risk monitor**, scoped to a Unit Manager's own unit, rendered in **view + escalate** mode (no confirm/override, no Sales-Admin notify — those stay with the Branch Manager).

Both are part of the existing Track K set and must be built in the **same v2 language** (Nexus tokens, Cabinet Grotesk / Satoshi / JetBrains Mono, light + dark, 44px touch targets) as the rest of `design_handoff_track_k/`. The authoritative rules live in `_reference/track-k-financing-new-agent-design-SPEC.md`.

## About the Design Files

The `.html` files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, **not production code to copy directly.** The task is to **recreate these designs in the target codebase's existing environment** (the app is React + Tailwind + Nexus design tokens) using its established components and patterns. Where a piece is net-new, build it in the repo's conventions. Reuse the shipped primitives named below rather than re-implementing them.

**Build order:** the Self-View (K9) depends only on existing data + the shipped `basisBadge` and `TakeHomeWaterfall`. The Unit Financing view is a **role-gated reuse** of the branch-manager roster (K7+K8) — build/confirm that surface exists first, then add the `roleGate` + read-only rendering.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, and component structure. Recreate the UI pixel-accurately using the codebase's existing libraries. Every dollar figure shown (`$37,500` gate, `$8,000` financing, `6×` ceiling, `25%` tax, `95%` persistency) is a **configurable ruleset placeholder** (2017-vintage) — never a hardcoded constant. Read them from `config`. Currency **TTD**; dates **DD-MM-YYYY**.

---

## SCREEN 1 — Financing Self-View (K9)

**File:** `Track K Financing Self-View - Build.html`
**Audiences:** Agent · financed Unit Manager (own). Identical component; only identity + nav context differ.
**Mode:** Read-only. No writes, no manager controls.

### The hierarchy decision (locked: Option A)

The hero answers a financed person's standing question — *"when am I free of this?"* So:

- **HERO (motivational, forward-looking, large):** the **paydown arc** — `runningBalance` trending to zero — plus the **wind-down clocks** (months to 12-month waiver; months to term) and the `financingStatus` badge.
- **SECONDARY HERO:** **"What you keep"** (take-home framing) and the relabelled **"Financing this month / Your draw."**
- **UTILITARIAN (compact, secondary):** statement ledger, terms, reconciliation, status timeline.

> Option B (take-home as the primary hero) is drawn in the sheet as the annotated alternative. **A is the build target** unless product overrides. (Open flag — see below.)

### Layout (desktop)

App shell: left sidebar (152px, "My Production" group) + main canvas (`flex:1`, `gap:13px`). Canvas stack, top to bottom:

1. **Hero (glass)** — `FinancingPaydownHero`. One glass card per screen (Nexus Glass tier). Contains: status badge (top-left) + effective date (top-right); eyebrow + headline; the **paydown arc** (SVG); a row of 3 wind-down **clock** chips.
2. **`BonusQualificationCard`** (full width) — "Your next bonus — the lever on your balance." Two gate tracks + a gold payoff band. (See bonus section.)
3. **2-col grid:** `DrawThisMonthCard` (relabelled) | `WhatYouKeepCard`.
4. **2-col grid:** `StatementFacts` (ledger) | `TermsFacts`.
5. **2-col grid:** `YearEndReconProjection` | `StatusTimeline`.

### Layout (mobile, mobile-first)

Single column inside a phone frame. Order: hero (whole — badge, arc, both clocks) → compact bonus card → "What you keep" (one big number; the full waterfall expands on tap) → "Financing this month" (proration + draw) → statement (collapsed facts) → terms / reconciliation / status history stacked below. 44px min touch targets. Nothing is tappable-to-edit (read-only).

### The paydown arc (hero centerpiece)

SVG line chart, `viewBox="0 0 560 150"` desktop (`0 0 300 96` mobile), `preserveAspectRatio="none"`:
- Dashed zero baseline at `y=132`.
- **Solid teal polyline** (`#01696F`, width 2.5) = actual `runningBalance` month 1 → now, with a translucent teal area fill (`rgba(1,105,111,0.12)`) under it.
- **Dashed lighter-teal polyline** (`#018A91`, width 2.5, dash `5 5`) = projected balance from now → clear.
- **Now-dot:** filled teal circle r=5.5, white stroke, at the actual line's end.
- **Clear-dot:** green circle (`#2D7A4F`) r=4.5 at the zero crossing.
- A **negative balance crosses below the baseline = surplus**, NOT an error.
- Caption row under it: effective date · NOW (month + balance) · projected clear.

### Fields shown (all owner-locked; every one must appear)

| Field | Where it renders | Notes |
|---|---|---|
| `runningBalance` | Hero arc + clock chip + statement total | negative = surplus owed to subject |
| `financingPaid` | Statement; "what you keep" (− your draw) | **relabel:** never "Manager Financing" |
| `netCommission` | Statement; "what you keep" | |
| `bonusOffset` | Statement; "what you keep" | the −50% bonus repayment |
| `validatingAPI` | Draw card; statement; terms | full-financing denominator |
| `actualAPI` | Draw card; statement | proration numerator |
| `basisSource` | Basis badge on every figure | see badge below |
| `agreedMonthlyFinancing` | Terms | the ceiling |
| `currentMonthlyFinancing` | Terms; draw card | |
| `effectiveDate` | Hero; terms | DD-MM-YYYY |
| `financingStatus` | Hero badge; terms; 5-state machine | see state machine |
| Reconciliation set | Reconciliation card + reconciled-state example | `totalFinancingDrawn`, `totalOffsets`, `closingBalance`, `reconciledPosition`, `surplusPaid`, `waiverApplied`, `outcome`, `serviceMet`, `serviceMonths`, `garnishStarted` |
| **Relabelled draw** | Draw card header | confirmed monthly draw → "Financing this month" / "Your draw" |
| `statusHistory` | Status timeline | render `{from → to, date}` **ONLY** |

### Fields that must NOT render (owner-ruled PRIVATE — enforce a field allow-list, do not fetch-then-hide)

`adjustmentPct` (the 5.3 termination-trigger ratio) · `suggestedFinancing` · manager notes · all audit metadata (`enteredBy` / `reconciledBy` / `*ByName` / `*At` / `createdBy` / `updatedBy`) · all K7 risk/miss verdicts · the `byName` / `role` / `note` inside each `statusHistory` entry.

> The same `adjustmentPct` IS visible to a manager on Screen 2 — **role decides visibility, the field is the same.** On the self-view it must be unreachable.

### Bonus qualification module (compact)

Lives on the self-view because qualifying is the **lever that clears the financing** — a qualifying quarter posts the ~50% `bonusOffset` and pulls the arc's clear-date earlier. **The full quarterly tracker stays on the K8 Validation Dashboard; this links to it, doesn't duplicate it.**

- **Gate 1:** Gross New Settled API vs the **TTD 37,500/qtr** gate (lead with "validated API").
- **Gate 2:** Persistency vs the **95%** line (Year 1) / **90%** (Year 2).
- Both render as tick-marked progress tracks; subtext shows "TTD X short" or "✓ met."
- **Gold payoff band:** translates qualifying into financing impact — "clears ~TTD 3,750 off your balance · moves clear date month N → N−1."
- Qualifying **resolves on the manager-confirmed settled basis** — never off the live projection.

(Bonus thresholds, from SPEC §4: quarterly gate = Gross ≥ TTD 37,500 **and** persistency ≥ 95% Yr1 / 90% Yr2. Q1 exception: 37,500 *submitted*, no persistency test. Consistency bonus = 15% of Net-for-Production; Production = 15% Yr1 / 20% Yr2.)

### States

- **Loading** — skeleton shimmer (hero block + fact rows).
- **Not on financing (empty)** — `financingStatus == not_on_financing` or no terms doc. **Neutral, not an error.** "You're on straight commission — no draw, no ceiling, no balance to clear."
- **Error** — record unreachable. Show only what resolved; never imply a complete picture from a partial read. A balance is never shown without its `basisSource`.

---

## SCREEN 2 — Unit Financing (Unit Manager)

**File:** `Track K Unit Financing - Unit Manager Build.html`
**Audience:** Unit Manager, viewing their own unit's financed agents.
**Authority model (locked: Option A — view + escalate).**

### The authority line

| The Unit Manager CAN (view + escalate) | Reserved for the Branch Manager (BM-only) |
|---|---|
| See the full unit roster (status, term, miss count, confirmed draw, balance vs ceiling, `adjustmentPct`) | Confirm / override the monthly draw — write `managerFinancing` (→ `adjustmentPct`) |
| See the risk flags (consecutive-miss monitor; >10% downward-adjustment flag) | Notify Sales Admin on a >10% cut (clause 5.3 notify-by-the-1st duty) |
| Coach an agent (note + read-only detail) | Set the `financingStatus` (5-state machine) |
| Escalate / flag an agent to the Branch Manager | Run the reconciliation event (waiver, surplus payout, garnish start) |

This is the **same** `FinancingRoster` + `ConsecutiveMissMonitor` + `DownwardAdjustFlag` as the branch-manager dashboard (`_reference/Track K Validation Dashboard - Manager Build.html`), filtered to `unitId == thisUM` and rendered in a read-only role via a `roleGate(role, action)` policy. **Do not rebuild it — gate it.**

### Layout (desktop; responsive reflow, no dedicated phone frame)

Sidebar ("My Production" + "My Unit" groups; "Unit Financing" active) + canvas:
1. **Topbar** with a read-only tag ("🔒 Read-only · confirm & notify with your BM").
2. **Reality strip** — unit-scoped aggregates: # on financing, total drawn (unit), confirmed this month, at-risk count, ≥2-misses count, ">10% adj · with BM" count.
3. **Risk monitor (2-col):** `ConsecutiveMissMonitor` (read-only + Coach/Flag actions) | `DownwardAdjustFlag` shown as **status** ("with Branch Manager"), not a button + a Coach action.
4. **Roster** — one row per unit agent: rank, avatar + name + status chip, term progress + miss count, **confirmed draw (locked, "BM")**, balance vs ceiling mini-bar, `adjustmentPct` (locked), action (Coach / View).
5. **Read-only detail drawer** — the override drawer minus the input: proration calc, **locked confirmed value** ("set by your Branch Manager · date"), `adjustmentPct` readout, and a foot with **Flag to BM** + **Add coaching note**.

### Key behaviors

- **Override → locked readout.** The confirmed draw and `adjustmentPct` show with a lock + "set by your Branch Manager." No `managerFinancing` write path exists for this role.
- **>10% flag is status, not action.** The 5.3 notify is the BM's; the UM sees "Notify Sales Admin · with Branch Manager" (disabled/locked pill), plus a Coach action.
- **Miss counter unchanged.** 0→3 advances only on **settled-confirmed** quarters; provisional quarters show but never count. The UM cannot confirm to make one count.
- **The UM's two write paths:** `CoachNote` (managers-only note) + `EscalateToBM` (tracked escalation).
- **Surplus rows** (negative balance) render in success green = "owed to agent," ceiling bar near empty — not an error.
- **Fan-out** = per-agent GETs (Compliance-v2 pattern), filtered to the unit. On partial failure: show resolved rows only; never compute a unit total or a trigger from a partial read.

### States

Loading (fan-out skeleton) · Empty (none in unit on financing) · Error (partial fan-out → show resolved rows only).

---

## Status state machine (both screens)

`financingStatus` is a **manager-set, forward-only** machine that gates every financing module:

```
not_on_financing → on_financing → reconciling → { post_financing_repayment | cleared }
```

- `not_on_financing` — declined financing; straight commission (Self-View empty state).
- `on_financing` (months 1–12) — receives draws; 50% of net bonuses + commissions offset; balance may cross into credit.
- `reconciling` — month-12 / early-exit event; waiver applied; debit-or-surplus computed.
- `post_financing_repayment` — 6.2 garnish (10% commissions + 50% net bonuses + incentives) until cleared.
- `cleared` — repaid, or surplus paid out.

The Self-View renders the badge per state; `statusHistory` is rendered `{from → to, date}` only (no `byName`/`role`/`note`).

## The basis badge (REUSE — shipped)

`basisBadge(basisSource)` renders three states; same component on every Track K surface (source in `_reference/Track K Validation Dashboard - Agent Build.html`):

| Badge | `basisSource` | Tone | Meaning |
|---|---|---|---|
| Settled — confirmed | `settled-confirmed` | teal | Month 4+, BM-confirmed. Determination-grade. |
| Submitted — final | `submitted-final` | success green | Months 1–3 — operative, no later settle-up. |
| Submitted — provisional | `submitted-provisional` | amber (+ring) | Month 4+ pre-confirm. Projection only; trues up to settled. |

---

## Design tokens (Nexus — light theme; assert dark parity per existing tokens)

```css
/* surfaces */
--bg:#F7F6F2; --surface:#FFFFFF; --surfaceRaised:#FAFAF8; --surfaceSoft:#F4F2EC; --surfaceMute:#F0EFE9;
/* ink scale */
--ink:#28251D; --inkMute:#6B6560; --inkFaint:#A8A39C; --inkDim:#CFCBC2;
--rule:#E5E2DB; --ruleStrong:#CFCBC2;
/* brand + semantic */
--teal:#01696F; --tealLight:#018A91; --tealDark:#014E52; --tealTint:#E6F4F4;
--gold:#B07D1A; --goldTint:#FAEFD3; --goldInk:#8A6010;
--success:#2D7A4F; --successTint:#E8F5EE;
--warning:#B45309; --warningTint:#FEF3E2;
--danger:#C0392B; --dangerTint:#FDE8E7;
/* Nexus Glass — light hero recipe (opacity floor → AA) */
--glass-base:rgba(255,255,255,0.62);
--glass-tint-teal:rgba(1,138,145,0.10);
--glass-border:rgba(1,105,111,0.16);
--glass-hi:rgba(255,255,255,0.65);
--glass-shadow:0 8px 28px rgba(38,35,28,.10);
```

**Type:** display `Cabinet Grotesk` (700/800), body `Satoshi` (400/500/700), mono `JetBrains Mono` (400/500/700).
- Page h1: Cabinet Grotesk 800, ~31px, letter-spacing −.025em.
- Card title (`.ct`): Cabinet Grotesk 800, ~14.5px.
- Big numbers (balances, "in your pocket"): Cabinet Grotesk 800, 17–34px, letter-spacing ~−.02em.
- Labels/eyebrows/field-keys: JetBrains Mono 700, 8–11px, letter-spacing .04–.18em, often uppercase.
- Body: Satoshi, 12–14.5px, line-height 1.5, `text-wrap: pretty`.

**Radii:** cards 13–18px, chips/pills 99px, small tiles 8–11px. **Shadows:** glass `0 8px 28px rgba(38,35,28,.10)`; app frame `0 14px 40px rgba(38,35,28,.10)`. **Touch targets:** ≥44px on actions.

**Glass tier:** exactly **one** glass card per screen — the Self-View hero. Everything else is flat/opaque per the census.

## Components to build

**Self-View (K9):** `FinancingPaydownHero` (glass; arc + clocks + status badge) · `WindDownClocks` · `BonusQualificationCard` (compact; links to K8) · `DrawThisMonthCard` (relabelled) · `WhatYouKeepCard` (reuses `TakeHomeWaterfall` on tap) · `StatementFacts` · `TermsFacts` · `YearEndReconProjection` · `StatusTimeline` (strips private fields) · `basisBadge` (REUSE).

**Unit Financing (UM):** `FinancingRoster` (REUSE, unit-filtered, read-only) · `AgentDetailDrawer` (read-only) · `ConsecutiveMissMonitor` (REUSE) · `DownwardAdjustFlag` (status variant) · `CoachNote` · `EscalateToBM` · `roleGate(role, action)`.

## Open items to confirm at build (drawn one way, your call)

**Self-View:**
1. **Hero choice** — Option A (paydown arc, built) vs B (take-home). A is the target.
2. **Pre-emptive projection** — whether the year-end surplus/waiver shows while still `on_financing` (drawn yes, labelled PROJECTED).
3. **Agent vs UM-own** — confirmed identical; no manager affordances bleed into the UM's own self-view.

**Unit Financing:**
4. **`adjustmentPct` visibility** — drawn visible read-only to the UM (manager-of-record). If BM-only, it drops to "with BM" like the notify.
5. **"Flag to BM"** — tracked escalation record (who/when/ack) vs. a nudge? Drawn as tracked.
6. **Coaching notes** — confirm managers-only, never on the agent's self-view.
7. **Unit scope key** — confirm `unitId` filter vs. a reporting-line lookup.

All threshold numbers (37,500 · 95%/90% · 6× · 25%) are **ruleset placeholders** — confirm current-year values before seeding (SPEC §11).

## Files in this bundle

- `Track K Financing Self-View - Build.html` — **Screen 1** build-annotation sheet (desktop + mobile, hierarchy A/B, all fields, privacy boundary, states, 5-state machine, component list).
- `Track K Unit Financing - Unit Manager Build.html` — **Screen 2** build-annotation sheet (authority split, read-only roster + monitor, drawer, states, component list).
- `_reference/Track K Validation Dashboard - Agent Build.html` — source of `basisBadge`, `TakeHomeWaterfall`, the full quarterly bonus tracker (K8).
- `_reference/Track K Validation Dashboard - Manager Build.html` — source of `FinancingRoster`, `ConsecutiveMissMonitor`, `DownwardAdjustFlag`, the override drawer (K7+K8) that Screen 2 role-gates.
- `_reference/Track K Take-Home Waterfall - Component.html` — the `TakeHomeWaterfall` component spec (K4).
- `_reference/track-k-financing-new-agent-design-SPEC.md` — the locked design spec (rule source; clause references).

Open any `.html` in a browser; everything is inline (fonts via Fontshare/Google). Resize below 1040px to see the responsive reflow.
