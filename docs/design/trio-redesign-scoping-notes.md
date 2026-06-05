# Trio Redesign — Scoping Notes (canon)

> **Status:** Scoping canon for the agent-facing trio (Goals · Commission · Persistency).
> Fuses the **2026-06-04 trio grounding audit** (Appendix B of the night-queue brief) with
> the **Item-3 CD-flag + feasibility probe** (2026-06-05, this night queue) and the
> **Claude Design v2 inventory** (Appendix A). Produced as Item 4 of `docs/briefs/trio-night-queue-kickoff.md`.
>
> **What this is:** the settled verdict on what each trio screen needs, why, and in what
> order — so the next build starts from facts, not re-discovery. **What this is not:** a
> build brief. Each slice below earns its own kickoff brief (Rule 10) when picked up.
>
> **Companion:** `docs/design/trio-redesign-schema-matrix.md` — every data element classified
> EXISTS / DERIVABLE / NET-NEW with sources.

---

## TL;DR — the three verdicts

| Screen | Verdict | Trio-plan disposition |
|---|---|---|
| **Persistency (agent)** | **COMPLETE** — shipped PR #395 (`f62ea76`), matches v2 1:1 | **No trio work.** Closed. |
| **Goals (agent)** | **RESTYLE / NO-OP** — `GapAnalysisPanel` is read-only by design and already Nexus v2 | **No agent-tab work.** The v2 goal-*setting* affordances are **manager-facing** → manager-program backlog. |
| **Commission (agent)** | **SOLE REDESIGN, and it is a DATA gap before a skin gap** | **The trio's one real build.** Data-first: settled-earnings wiring *before* visuals. |

The trio is **not** three redesigns. It is **one** (Commission), and that one is gated on a
**data-layer decision** (where does YTD earned commission come from), not on design.

---

## 1. PERSISTENCY (agent) — COMPLETE, no work

**Verdict: COMPLETE.** Shipped via PR #395 (`f62ea76`). The agent-side `PersistencyTab.jsx`
matches the v2 mockup 1:1: reality/award-gate banner, gold 90% reference line, tint tokens,
mono eyebrows. 5 RTL tests + 2 smokes (`persistency-prod-smoke`, `persistency-themes-smoke`).

**Item-3 citations that close the loop:**
- `enteredByRole` audit trail written at `persistencyService.js:276` (first entry) / preserved at `:268` (overwrite).
- `lockedByManager` read at `agent/PersistencyTab.jsx:74–79`; edit button gated at `:210`.
- Agent self-entry **PERMITTED** by `firestore.rules:479` (`isAgent() && request.resource.data.agentId == request.auth.uid`).

**Open (NOT trio work):**
- The Persistency **v2 MANAGER scene** (reality bar · at-risk exception book · banded roster ·
  entry-drawer restyle · what-if playground share-as-recommendation) → **manager-program backlog** (§4).
- **MORNING DECISION (product, not fact):** agents *can* self-enter persistency until a manager
  locks the month — is that intended for pilot? Fact is resolved (rules cited above); the
  *intent* is a product call.

---

## 2. GOALS (agent) — RESTYLE / NO-OP

**Verdict: RESTYLE / NO-OP for the agent tab.** `GapAnalysisPanel.jsx` is a **read-only**
5-tier gap-analysis display and is already on Nexus v2 tokens (zero legacy hex, zero TODOs).
The agent Goals tab **cannot set goals** — by design.

**Where agents actually commit goals (Item-3 fact, FACT-RESOLVED):**
- `CareerPortal.jsx` `GoalsSection` → `setGoals(tenantId, uid, {personalAnnualAPI, personalAnnualApps, personalAnnualPersistency}, uid, name)` at `:647–651`.
- Server-side floor enforcement at `goalsService.js:129–151`: tenure-band annual-API floor
  (`resolveAnnualAPIFloor`, 6 bands `tenureFloors.js:16–24`) + flat apps/persistency mins.
- Secondary commit path: Game Plan commit.

**Implication:** any "agent goal-setting" UI in the Goals v2 mockup is **already served** by
CareerPortal — it is not missing, it is **elsewhere**. A trio redesign of the agent Goals tab
would be pure restyle of an already-v2 surface → not worth a slice on its own.

**Open (NOT trio work):**
- The Goals **v2 MANAGER scene** (per-node YTD cascade · exception-first agent roster banded vs
  tenure floor · tier tabs with provenance + recommend-vs-lock · Self tier · recommend-drawer
  reuse) → **manager-program backlog** (§4). This is the substantive Goals v2 work, and it is
  manager-facing.

---

## 3. COMMISSION (agent) — THE SOLE REDESIGN (data-first)

**Verdict: REDESIGN, and the gap is DATA, not skin.** The shipped `CommissionPlayground` is a
**pure client-side calculator** — it reads `submissions` for activity ratios + localStorage for
the income goal, writes assumptions via `setGoals`, and **never reads settled earnings**. The v2
mockup's headline ("Your reality" AnchorStrip: YTD earned · projected run-rate · gap-to-goal ·
4-wk persistency) requires **real settled commission**, which the shipped screen has no path to.

### 3.1 The settlements feasibility finding (Item 3f — the highest-value fact tonight)

**FACT-RESOLVED, and it reshapes the build:**

- **Settlement docs do NOT carry earned commission.** `settlementService.js` writes
  `settledAPI` / `settledApps` / `persistency` only (`:45–64`). There is **no** per-agent
  earned-commission dollar field on settlements.
- **Earned commission lives on POLICY docs.** `policies/{policyId}.earnedCommission`
  (agent-entered at settle time, `policiesService.js:131,141`; rule-validated
  `firestore.rules:329`, `number && >= 0`).
- **No YTD-earned aggregation exists** for any tier (agent/unit/branch/SM). DERIVABLE via a new
  query: `policies where status=='settled' && agentId==uid && <year>` → `sum(earnedCommission)`.
- **Agent read access:**
  - Settlements: agent read is **PERMITTED but tenant-wide** (`firestore.rules:521–529` —
    `getTenantId()==tenantId`, **not** agentId-scoped). ⚠️ See the security flag below.
  - Policies: agents read their own policies (the earnedCommission source) — the AnchorStrip's
    real read path runs through **policies**, not settlements.

> **⚠️ SECURITY FLAG (pre-existing, logged to MORNING DECISIONS — NOT introduced by this work):**
> `firestore.rules:521–529` lets **any** signed-in tenant member read **every** agent's
> settlement docs (no `agentId == request.auth.uid` arm). An agent can read peers' settled API.
> This predates the trio work; flagged for a dispatcher decision (tighten to own-read, or accept
> for the single-branch pilot). It does **not** block the Commission build (which reads policies),
> but it is the kind of thing the AnchorStrip work will sit next to.

### 3.2 The engine is sound and unduplicated (Item 3h — FACT-RESOLVED)

Math duplication census: **NONE.** Three isolated modules, zero duplicated formulas:
- `commissionMath.js` — first-payment commission, reverse calc, mode breakdown, 12-mo cash flow.
- `goalDecomposition.js` — income→API→activity chain (the 7-stage ladder engine).
- `planVariance.js` — pace/variance only.

So "Commission is the engine" holds: the **decomposition ladder** is already `goalDecomposition.js`
and the **cash-flow / mode-mix** is already `commissionMath.js`. The redesign **reskins existing
engines**; it does not need new math. The risk is entirely in the **new data read** (3.1) and the
**new write** ("Set as my goal" → Goals cascade).

### 3.3 Refined slice proposal (data-first)

| Slice | Scope | Gate |
|---|---|---|
| **Commission S1 — Anchor & data** | Wire the real read: YTD earned commission from policies (own-read), projected run-rate, gap-to-goal, 4-wk persistency. Render the AnchorStrip. **No ladder/targeting visual changes yet.** | The run-rate method + gap reference are **MORNING DECISIONS** (§ below) — S1 brief must lock them first. |
| **Commission S2 — Ladder + targeting visuals** | Reskin the 7-stage decomposition ladder (engine = `goalDecomposition.js`, unchanged) + Modal Targeting (mode-mix → API + 12-mo stacked cash-flow, engine = `commissionMath.js`, unchanged). Visual-only over proven math. | Both-themes smoke; characterization tests from Item 5 are the regression net. |
| **Commission S3 — Writes** | "Set as my goal" WRITE → Goals cascade (`setGoals`); manager "suggest-a-goal" via the notifications/`nudges` primitive. | Write-path smoke (write→read→verify); rules review for any new write surface → **HUMAN-MERGE**. |

**Why data-first:** the AnchorStrip is the redesign's reason to exist, and it is the only part
that can be *wrong* (bad read path, wrong aggregation, missing rule). Build the truth first, then
dress it. The visuals (S2) are low-risk reskins of unduplicated, already-tested engines.

---

## 4. Manager-program backlog (NOT the trio plan)

The Goals v2 and Persistency v2 **manager scenes** are real work but belong with the other
manager surfaces (WARs v2, MasterSheet v2, Compliance v2), **not** the agent-facing trio. Routed
here so the trio plan stays scoped to the agent screens.

- **Goals v2 (manager):** per-node YTD cascade · exception-first agent roster banded vs tenure
  floor (expandable targets) · tier tabs with **provenance** + **recommend-vs-lock** · **Self
  tier** (manager's own, excluded from rollups) · recommend-drawer reuse.
- **Persistency v2 (manager):** reality bar · at-risk exception book · banded roster + source
  badge + editedAt · entry-drawer restyle · what-if playground (share-as-recommendation).
- **Parked manager-program questions (NOT tonight's):** lever→pp formula · at-risk sub-states ·
  lock enforcement · Self-tier storage · SM/branch YTD rollup sources (Item 3g: YTD **API**
  rollups EXIST via `useBranchOverview.js`; YTD **earned-commission** rollups ABSENT for all tiers).

---

## 5. Appendix-A flags → Item-3 verdicts

Each Claude Design flag classified **FACT-RESOLVED** (cited, settled) or **TRUE-PRODUCT-JUDGMENT**
(rolls into MORNING DECISIONS — do not resolve tonight).

| Flag | Verdict | Basis |
|---|---|---|
| Run-rate method (linear / trailing-8wk / seasonal) | **PRODUCT-JUDGMENT** | No method exists; pure product call. → MORNING DECISIONS. |
| Gap reference (Goals `personalAnnualAPI` vs playground input) | **PRODUCT-JUDGMENT** | Both sources exist; which to anchor against is a product call. |
| Ladder "Dials" semantics (prospecting 4-sum vs raw dials; daily-source gap) | **PRODUCT-JUDGMENT** | Ratified relabel exists for plan surfaces (#477); ladder semantics still a call. (Item 6 relabels the Game Plan chip; ladder is separate.) |
| Lever→pp formula (persistency what-if) | **PRODUCT-JUDGMENT** | Manager-program; no formula exists. Parked. |
| At-risk sub-states | **FACT-RESOLVED (rich)** | Policy status machine has 7 states (`policyLifecycle.js:12`); persistency has the 90/80 award gate. Sub-state *taxonomy for goals/persistency at-risk* is still a product call. |
| Lock enforcement | **FACT-RESOLVED** | Persistency manager-lock enforced (`PersistencyTab.jsx:74–79`, rules `:479`); goals have **no** recommend-vs-lock mode field (Item 3c: ABSENT). Adding one = manager-program. |
| SM / branch YTD sources | **FACT-RESOLVED** | YTD **API** rollups EXIST (`useBranchOverview.js:84–87`, submissions-based); YTD **earned-commission** rollups ABSENT (DERIVABLE from policies). |
| Self storage (manager's own tier) | **FACT-RESOLVED (absent)** | No Self-tier doc/field exists; cascade tiers are goals/unitGoals/branchGoals/salesManagerGoals. NET-NEW. Manager-program. |
| Persistency by/editedAt | **FACT-RESOLVED** | `enteredBy`/`enteredByRole`/`enteredAt` + `lastEditedBy`/`lastEditedByRole`/`lastEditedAt` all written (`persistencyService.js:259–277`). |
| Tier-goal setBy | **FACT-RESOLVED (partial)** | `setBy`/`setByName` on all tiers; `setByRole` on unit tier only; `setAt`/`updatedAt` present. No `mode`/recommend field (Item 3c). |

---

## 6. MORNING DECISIONS this kit surfaces (log, do not resolve)

- **Commission run-rate method** — linear / trailing-8wk / seasonal (S1 brief must lock).
- **Commission gap-to-goal reference** — Goals `personalAnnualAPI` vs playground input.
- **Settlements read-path consequence (Item 3f):** earned commission is on **policies**, not
  settlements; the AnchorStrip reads policies (own-read OK). Confirm this is the intended source
  vs. a future settlements-side earned-commission denormalization.
- **⚠️ Settlements tenant-wide read** (`firestore.rules:521–529`) — tighten to own-read, or accept
  for single-branch pilot? (Security, pre-existing.)
- **Persistency agent self-entry** intended for pilot? (rules `:479` confirms it is *possible*.)
- **Ladder "Dials" semantics** — prospecting 4-sum vs raw dials; daily-source gap.
- **Trio sequencing:** Commission **S1** is the presumptive next build. Nothing in this kit
  challenges that — it sharpens it (data-first, run-rate/gap decisions front-loaded).
