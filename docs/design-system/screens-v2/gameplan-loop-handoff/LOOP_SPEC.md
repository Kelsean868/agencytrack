# AgencyTrack — The Game Plan Loop (master build spec)

> This is the **connective spec** for the whole loop. Each surface in `mockups/` already exists as an interactive design (open any `.html` in a browser). What this document adds is the **spine that joins them**: the canonical data model, the read/write contract at each stage, the shared engines, and the build order. Read this first, then the per-surface designs.

---

## 1. What the loop is

One self-reinforcing cycle that turns a life goal into daily activity and feeds results back:

```
   ┌──────────────────────────────────────────────────────────────────────────┐
   │                                                                            │
   ▼                                                                            │
① GOAL / MONEY NEEDS  →  ② ALLOCATOR  →  ③ GAME PLAN (commit)  →  ④ PLAYGROUND  │
   life budget → income      API targets      the agreed plan        API → weekly │
   → required commission      per line/product  (Game Plan hub)        activity     │
                                                                          │         │
                                                                          ▼         │
                                              ⑦ POLICY LEDGER  ◀── ⑥ DAILY CAPTURE ◀── ⑤ PLANNER + HIT-LIST
                                              Written→Submitted     log the activity     book the week from
                                              →Settled              that happened         campaigns / prospects
                                                  │
                                                  ▼
                                              ⑧ AWARDS + PERSISTENCY  ──────────────────┘
                                              tier clears, payout gate,  → re-solve ① / ④
                                              settled production flows back
```

**The throughline the whole app rests on:** there is *one number* that everything is a transformation of. Life budget → required first-year commission → API targets → apps → weekly activity (P.C / A.I / F.F.I / C.I) → booked appointments → logged activity → written/settled policies → settled API → award tier → (re-solve). Every surface is a different view onto, or a different transformation of, that same chain. **Never let two surfaces compute the same step with different math.**

---

## 2. The canonical data model (single source of truth)

Everything below lives under `tenants/{tenantId}/…` (multi-tenant) and is keyed per agent. The **bold** objects are the spine; each stage reads upstream and writes its own object only.

```
profile
  licenseClass: 'life' | 'general' | 'composite'      // drives allocator lines
  avgPolicySize                                         // THE apps divisor — one value, used everywhere

moneyNeeds                                              // ① — SHIPPED (#738), reuse moneyNeedsService
  expenseGroups[groupKey].lineItems[]  {id,label,amount,frequency,annualizedAmount,calcKey?}
  subCalculators  {insuranceIndustry, carExpenses(33% personal/67% business), loansDebt}
  totalAnnualAfterTax / totalAnnualPreTax              // PAYE gross-up
  estimatedRenewalIncome
  → requiredFirstYearCommission = totalAnnualPreTax − estimatedRenewalIncome

yearPlan                                               // ② allocator output
  lines.life    {api, eligible:true,  products:[{name,api}]}   // ≤4 named products  ⚑ schema
  lines.ah      {api, eligible:false}                          // own line, all classes
  lines.general {api, eligible:false, products:[{name,api}]}
  → totalApi, derived apps per line = api / avgPolicySize

gamePlan                                               // ③ the committed plan (the hub)
  committedAt, periodStart, periodEnd
  snapshot of yearPlan + moneyNeeds at commit
  playgroundRatios {ciToSale, ffiToCI, aiToFFI, dialsToAI}      // editable; goalsService.playground*

weeklyTargets                                          // ④ playground decomposition (DERIVED, not stored twice)
  perWeek {pc, ai, ffi, ci, sales}    // back-solved from Life API ÷ avgPolicy ÷ weeksLeft ÷ ratios
  recomputed by the ON-TRACK ENGINE as weeksLeft and settled production change

campaign                                               // seeded by manager OR agent
  tiers[] {name, apiThreshold, appsThreshold, cash, voucher}
  seededBy: 'manager' | 'agent'
  christmasCampaign etc.

hitList / prospects[]                                  // ⑤ the targeted call list
  {id, name, why, line, est api, product, premium, freq, status, campaignId?}

plannerEvents[]                                        // ⑤ booked week
  {id, date, time, code(PC/AI/FFI/CI/1-on-1/unit-mtg/joint-work/training), prospectId?, kept}

activityLog[]                                          // ⑥ daily capture — what actually happened
  {date, code, count, prospectId?}    // feeds back to weeklyTargets progress

policies[]                                             // ⑦ policy ledger
  {id, client, product, type(Ordinary/Replacement/SPIA/Increase),
   premium, freq, api, countsApps, status:'written'|'submitted'|'settled',
   policyNo, apptId?, campaignId?}
  // one client may write MULTIPLE applications; policyNo optional until settled

awards / persistency                                   // ⑧ the gate + re-solve trigger
  settledApi (Life only) → tier reached
  persistencyPct → payout multiplier (e.g. 88% → 50% payout)
```

**Two hard invariants:**
1. **Apps = API ÷ `avgPolicySize`** — one divisor, defined once on `profile`, used by the allocator, the playground, the on-track engine, and every report. No second math path.
2. **Only Life API drives awards.** A&H + General decompose into activity but are award-neutral everywhere.

---

## 3. Stage-by-stage — surface, files, and the read/write contract

| # | Stage | Surface (HTML) | Key files | Reads | Writes |
|---|---|---|---|---|---|
| ① | Goal / **Money Needs + Allocator** | `Money Needs Merged.html` | `mn-merge-core.jsx`, `mn-merge.jsx` (+ `Money Needs Merged - Build Notes.html`) | `moneyNeeds`, `profile.licenseClass` | `yearPlan.lines[].api`, per-product targets → **writes Playground key, `onOpenTab('game-plan')`** |
| ① | Goals (hub view) | `AgencyTrack Goals v2.html` | `goals-v2-*.jsx`, `manager-v2-*.jsx`, `mastersheet-v2-shared.jsx` | `yearPlan`, `gamePlan` | goal edits |
| ③ | **Game Plan hub** (commit) | `AgencyTrack Game Plan v2.html` | `gameplan-shared/pages/money/commit/scenes.jsx` | `moneyNeeds`, `yearPlan` | `gamePlan` (committed snapshot + ratios) |
| ④ | **On-Track engine** (re-solve) | `AgencyTrack On-Track Engine.html` | `ontrack-shared/screens/app.jsx` (+ `planner-*`, `campaigns-v2-shared`) | `gamePlan`, `policies` (settled), `weeksLeft` | `weeklyTargets` (recomputed) |
| ⑤ | Campaigns / Hit-list | `AgencyTrack Campaigns.html` | `campaigns-v2-*.jsx`, `manager-v2-shared.jsx` | `campaign`, `policies` (progress) | `campaign`, `hitList` |
| ⑤ | Prospect Prep (hit-list → book) | `AgencyTrack Prospect Prep v2.html` | `prospect-*.jsx`, `dailycap-celebrate.jsx` | `hitList`, `prospects` | `plannerEvents` (booked) |
| ⑤ | **Planner & Scheduler** | `AgencyTrack Planner & Scheduler v2.html` | `planner-shared/mobile-a/mobile-b/states/desktop/desktop-screens.jsx` | `weeklyTargets`, `hitList` | `plannerEvents` |
| ⑤ | Planner — Manager surfaces | `AgencyTrack Planner - Manager Surfaces.html` | `planner-manager-*.jsx` | manager team data | manager `plannerEvents` (1-on-1, unit mtg, joint work, training) |
| ⑥ | Daily Capture | `AgencyTrack Daily Capture v2.html` | `dailycap-*.jsx` | `plannerEvents`, `weeklyTargets` | `activityLog`, → opens sale-log |
| ⑦ | **Policy Ledger** | `AgencyTrack Policy Ledger v2.html` | `app-policy-v2.jsx` | `activityLog` (sale made), `campaign` | `policies` (Written→Submitted→Settled) |
| ⑧ | Persistency gate | `AgencyTrack Persistency v2.html` | `persistency-v2-*.jsx`, `manager/mastersheet shared` | `policies` | `persistency` payout multiplier |
| ⑧ | Awards | (in Goals / Game Plan) | `goals-v2-*`, award strip in `mn-merge` | `policies` (settled Life API) | award tier reached → re-solve ④ |
| — | **The whole loop, interactive** | `AgencyTrack Loop Prototype.html` | `loop-proto.jsx` (+ `app-tokens/motion/mobile`) | — | a stateful end-to-end walkthrough of ①→⑧ |

> **Start here to understand the loop:** open `AgencyTrack Loop Prototype.html` — it's the one-phone, fully-stateful walkthrough where you drive the entire cycle and watch state propagate (goal → prescription → hit-list → book → sale Written→Submitted→Settled → tier clears → re-solve). Every other surface is the production-grade version of one stage in it.

---

## 4. The engines (shared logic — build once, call everywhere)

1. **`goalDecomposition` (API → activity).** `apps = lifeApi / avgPolicySize`; `salesNeeded = apps`; then divide by `weeksLeft` and walk the funnel ratios (close → C.I → F.F.I → A.I → P.C). Used by the Playground, On-Track, the Loop, and the planner's "this week" prescription. **One implementation.**
2. **On-Track engine (time-aware).** Targets are **not static** — they re-solve as `weeksLeft` shrinks and as settled production lands. Falling behind raises the weekly ask; getting ahead lowers it. Lives in `ontrack-*.jsx`. This is the answer to "do activity targets adjust to time left?" → **yes**.
3. **Award engine (Life-only).** Reads settled Life API → highest tier reached / next-tier gap / top-tier; never invents a higher award. For tiered campaigns (e.g. Christmas), the engine shows **progress toward the next tier as business is submitted** — the agent does not pre-select a tier.
4. **Persistency gate.** `persistencyPct` → payout multiplier on award prizes; surfaces a "reinstate X to bank the full prize" nudge. Does not change API math, only payout.
5. **Sale capture → ledger.** From a kept appointment, "Sale written" pre-fills the log; **one client → multiple applications**; **policy # optional** (Pending # until settled). Status flow is **Written → Submitted → Settled** (Written = written-but-not-yet-submitted, the deliberate default). The ledger's pipeline header doubles as the status filter.

---

## 5. Cross-cutting conventions (every surface honors these)

- **Nexus tokens are CSS variables** (`--primary`, `--ink`, `--surface-raised`, `--surface-muted`, `--border`, `--gold`, `--success`, `--warning`, `--accent`), light + dark. Never a raw hex.
- **Type:** Satoshi body · **Cabinet Grotesk** (display) for values/headlines · JetBrains Mono for labels/numerics.
- **Lucide icons only.** ≥44px touch targets. `:focus-visible` rings. Currency **TTD**. No gradient buttons.
- **Navigation is tab-state, not a router** — the app uses `onOpenTab(tabKey)` / `setActiveTab`, no breadcrumb/back chrome. Hand-offs between stages (e.g. allocator → Game Plan) write to the destination's storage/state then `onOpenTab(...)`.
- **Mobile primary**, with desktop/tablet for the week-booking and manager surfaces. Both light + dark for every screen.
- **Roles:** agents sell; **branch managers and unit managers also sell and recruit** — they get their own personal planner (with 1-on-1, unit meeting, joint work, training event types) *plus* their team surfaces.

---

## 6. Consolidated design-around flags (resolve in PRD — built as if supported)

- **A · Per-product schema.** `yearPlan` stores per-*line* today; named per-product targets `{name, api}` (≤4, Life + General) are a schema change.
- **B · Per-product apps divisor.** Blended `avgPolicySize` vs per-product is open; UI shows derived apps with a visible note, never hard-asserts.
- **C · A&H placement (`ahSide`).** Rendered as its own line to sidestep "which side does A&H sit on." If product confirms, drop `ahSide`.
- **D · Campaign seeding.** Campaigns can be **manager-seeded or agent-seeded**; the agent hit-list and the manager campaigns module share `campaign` — confirm the merge so one isn't a copy of the other.
- **E · Playground payload.** `PLAYGROUND_INCOME_GOAL_KEY` currently carries an income number; extend it to carry the per-line/product API so the allocator hand-off is lossless.

---

## 7. Build order (each stage verifies in light + dark; run lint / tests / axe)

1. **Confirm the data spine** (§2) against the repo — especially `moneyNeedsService`, `goalsService.playground*`, `avgPolicySize`, and the `policies` status enum. Reuse; do not duplicate.
2. **① Money Needs + Allocator** — already specified in full (`mockups/Money Needs Merged - Build Notes.html`). The merge reuses the shipped worksheet and replaces the flat targets panel with the license-aware allocator.
3. **③ Game Plan hub** — consume the allocator output; commit the snapshot + ratios; this is the tab the allocator's Send lands on.
4. **④ On-Track engine + Playground** — the decomposition + time-aware re-solve (the one `goalDecomposition`).
5. **⑤ Planner + Campaigns/Hit-list + Prospect** — book the week from the prescription and the targeted list; manager personal planner with its event types.
6. **⑥ Daily Capture → ⑦ Policy Ledger** — log activity; sale → Written → Submitted → Settled; multi-application; optional policy #.
7. **⑧ Awards + Persistency** — the Life-only tier engine and the payout gate; settled production re-solves ④.
8. **Walk the Loop Prototype** end-to-end as the acceptance test for "the whole thing connects."

> The `.jsx` files are **design reference, not production code** — recreate in the repo's React/Tailwind, lifting exact tokens/spacing/tone. Ask before adding any field or screen the spec doesn't call for.
