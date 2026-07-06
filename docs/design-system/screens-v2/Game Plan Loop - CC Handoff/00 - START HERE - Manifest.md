# Game Plan → Goals Loop — Build Handoff Package

**AgencyTrack · Tatil Life · Nexus warm theme**
**Compiled 23 Jun 2026 · for Claude Code (CC)**

This package contains every build-annotation sheet for the **planning loop** —
the agent's path from budgeting their life to committing a real annual target,
and where that target lands in Goals. Read this manifest first, then the sheets
in numbered order.

---

## The loop, end to end

```
Game Plan hub  →  Money Needs  →  Year Plan  →  Monthly Plan  →  Review & Commit  →  lands in: Goals tab
  (StepRail)      (Step 1)        (Step 2)       (Step 3)         (Step 4 · WRITES)     (Hierarchy + Derived Income)
```

- **Money Needs** turns the agent's chosen lifestyle budget into a 1st-year commission *need* per product line.
- **Year Plan** splits that need into an annual **API** target per line (Life / A&H / Property / Motor).
- **Monthly Plan** breaks the annual target into 12 months + tracks actual-vs-target pace.
- **Review & Commit** is the *only* step that writes real data: it commits the **Personal Commitment** into Goals and flips the plan `draft → committed`.
- **Goals tab** is where the loop lands — the committed goal vs the 5 floors above it, plus the derived income it earns.

---

## Files in this package (build order)

| # | File | Surface | Status vs live repo |
|---|------|---------|---------------------|
| 01 | `01 - Game Plan Hub - Slice 1.html` | Hub: StepRail + PlanCascade shell | Build sheet |
| 02a | `02a - Money Needs - Slice 1 (base, SHIPPED).html` | Money Needs worksheet — full base spec | **Already shipped** — reference only |
| 02b | `02b - Money Needs - UX Round 2 (PENDING).html` | Interactive mockup of the 3 pending UX fixes | **PENDING — build this** |
| 02c | `02c - Money Needs - Fix README (rev 5).md` | Written spec for the calc-row + UX fixes (rev 5: + boxed fields + Send→Game Plan flow) | **rev 1–3 shipped · rev 4–5 PENDING** |
| 03 | `03 - Year Plan - Slice 2.html` | Per-line API allocator + award ladder + edge states | Build sheet |
| 04 | `04 - Monthly Plan - Step 3.html` | 12-month target-vs-actual + pace | Build sheet |
| 05 | `05 - Review & Commit - Step 4.html` | Review recap + commit moment + done state | Build sheet |
| 06 | `06 - Agent Goals - Goal Hierarchy.html` | 5-layer cascade vs YTD (GapAnalysisPanel) | Build sheet |
| 07 | `07 - Agent Goals - Derived Income.html` | "Your goal → what it earns" (v3.1) | Build sheet |
| 08 | `08 - Manager Goals - Goal Setting.html` | Manager target-setting + Commission Playground | Build sheet |
| 09 | `09 - Loop Coverage Audit.html` | The whole-loop map: built / deferred / untouched | Orientation |

> **Each `.html` build sheet is a self-contained, annotated spec** — open it in a browser. It shows the
> designed surface(s) with numbered callouts mapping every element to the component, CSS-var token,
> Lucide icon, state, and data field CC needs. They are read-only references, not app code.

---

## ⚠️ Money Needs — read this before touching it

The live `src/components/agent/MoneyNeedsPanel.jsx` has **already shipped** the earlier rounds of
Money Needs work. **Do not rebuild what's there.** Confirmed already live:

- Calc-fed cards (`CalcFedLineRow`) — teal "Build with calculator →" CTA, Recalculate, Reset
- Responsive `LineItemRow` (label stacks above the numeric row on mobile)
- Mobile-stacked accordion header (full group label on line 1, count+total on line 2)
- `FloatingCalcModal` lifted to panel level with focus trap + body-scroll lock
- The "From your calculators" / "Your entries" split

**The ONLY pending Money Needs work is README rev 4–5 (file 02c) — five fixes, all in `MoneyNeedsPanel.jsx`, all presentation/state, no data-model change:**

1. **Done button on every sub-calculator.** `FloatingCalcModal` has only an `X`. Add a sticky `shrink-0` footer: live **annual total** (left) + primary **"Done — use this figure"** (right, calls existing `onClose`; the blur flushes the existing on-blur `save()`), and a quiet "saved automatically as you type" line. Saving already works — this just makes it *visible* so agents trust it.
2. **Single-open accordion.** Lift `open` state out of `ExpenseGroupAccordion` up to `MoneyNeedsPanel` (`openGroup` / `setOpenGroup`); opening one group collapses the others. Add a subtle `shadow` lift on the open card. Kills the endless-scroll.
3. **Per-field separation.** Wrap each group in a `FieldSection` with a **tinted header band** (teal `bg-primary/8` for calc-fed, neutral `bg-surface-mute` for entries; Lucide `Sparkles` / `Pencil`), AND make each **manual** `LineItemRow` its own bordered card with the name input styled as a heading — matching the calc-fed cards. This is what kills the "wall of inputs" feel; the bands alone weren't enough.
4. **Every field in its own box (rev 5, extends #3).** Reinforce: *every* line item — calc-fed and manual, panel and sub-calculator — is a discrete bordered card with a hairline shadow and its name as the heading. No flush rows anywhere.
5. **Send → acknowledge → Game Plan (rev 5).** Replace the silent 1.5s "Sent!" with a real **acknowledgement** card ("Target sent — saved to your {year} plan") + a **"Continue to Game Plan →"** that navigates to the hub landing at **Step 2 · Year Plan**. Rename the button "Send to Game Plan". The `localStorage` playground write is unchanged.

See file 02c for the exact Tailwind classes and the component-by-component change list. File 02b is the interactive mockup — toggle desktop/mobile + light/dark to see the target.

---

## Shared conventions (apply to every sheet)

- **Nexus warm theme.** Light: teal `#01696f` / beige `#f7f6f2`. Dark: warm `#1a1612` + lifted teal `#4ab5b8`. **No hardcoded hex — tokens via CSS vars only** (`--primary`, `--ink`, `--ink-muted`, `--surface`, `--surface-raised`, `--surface-mute`, `--border`, `--gold`, `--success`). Surfaces: `bg-surface` / `bg-card` / `bg-card-raised`.
- **Type.** Satoshi (body) + Cabinet Grotesk (`font-display`, headlines/values). JetBrains Mono for labels/numerics where the sheets show it.
- **Icons.** Lucide only.
- **Targets.** ≥44px on every input/control. No gradient buttons.
- **Currency.** Always **TTD**. **Trinidad time (AST)** for any dates/timestamps.
- **Honest-data doctrine.** Never fabricate. Unset → "Set in your plan". Honest empty / loading / error / "coming" states — every sheet documents its states.
- **Structural template.** Each step modal follows the Money Needs modal pattern; all use GamePlanV2 patterns + `statusToken` roles. Step 4 is the first to use the terminal `committed` / `done` state for real.
- **Apps math.** Apps = Annual API ÷ the agent's own average policy size (the same avg-policy source the weekly planner / `goalDecomposition` already uses). Single source — no second math.
- **Everything stays behind the planning-loop flag** until the whole loop un-gates together (Step 4 committing taking the hub to 4/4 · 100% is the trigger).

---

## Data model touched by the loop

- **Reads:** `moneyNeeds/{year}.firstYearCommissionsTargets`, `user.commissionRate`, `user.licenseProfile` (absent = composite), `awardsRuleset_{year}`, the shared avg-policy figure, submissions (actual-by-month).
- **Writes:**
  - `yearPlan/{year}` — per-line `{targetAPI, pct, derivedApps, derivedCommission, enabled}` + `licenseProfile` snapshot + `status`.
  - Monthly targets — either `monthlyPlan/{year}` (12 targets + status) mirroring yearPlan, or nested under yearPlan (sheet 04 designs against both). Actuals-by-month are **read**, never stored.
  - **Commit (Step 4)** — atomic transactional write: set the Goals **Personal Commitment** (annual API target) and flip `yearPlan/{year}.status` + `monthlyPlan/{year}.status` → `committed` together, so the loop is never half-committed.
  - `user.licenseProfile` — agent self-set or manager override (a `licenseProfile` select added to the existing edit-user drawer; see sheet 03).

> Exact Goals field names for the Personal Commitment write are reconciled against the live Goals
> schema at brief time — design against "writes the agent's annual API commitment."

---

## Goals — the 5-layer cascade (sheets 06–08)

Top → bottom: **Company Floor → Sales Manager → Branch → Unit → Personal Commitment.**
Personal Commitment is the destination the Step-4 Commit writes into.
Per layer: Annual API (TTD), Annual Apps, Persistency %. Company floor: API 200,000 · Apps 42 (flat) · Persistency 90%; tenure-scaled API floors L1–L6: 200 / 250 / 350 / 450 / 600 / 800 K.

---

## Known gaps (NOT in this package — see sheet 09)

These are intentionally **out of scope** for this build — flagged so CC doesn't expect them:

1. **Agent · Awards reach** — which awards the committed plan puts in range. *Not started* (deferred by the Derived Income sheet).
2. **Agent · MDRT / COT / TOT progress** — production-credit track. *Not started* (same deferral).
3. **Manager review / suggest of a shared plan** — canvas exploration only, *no build sheet yet*.
4. **Self-Improvement step** — keep-or-drop product decision still open.

The loop's spine (Money Needs → Commit) and its landing (Goal Hierarchy + Derived Income) are fully
specced and ready to build. The four items above are the next design cycle, not this handoff.

---

## Suggested build sequence for CC

1. **Money Needs rev 4** (02b/02c) — smallest, unblocks nothing but improves the live screen.
2. **Hub (01) → Year Plan (03) → Monthly (04) → Review & Commit (05)** — the spine, in order; Step 4's commit is the last piece that lets the whole loop un-gate.
3. **Goals landing (06, 07)** — so the committed target visibly lands somewhere; then **Manager Goals (08)**.

Build sheets are independent specs — but this order matches the data dependencies (each step reads the prior step's write) and gets the un-gate trigger in last.
