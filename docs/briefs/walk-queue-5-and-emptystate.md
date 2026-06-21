# Walk Queue — #5 Money Needs reconciliation + New-agent empty-state

## Run model (unattended ~2h window — keep CC working)
- Two **independent**, file-disjoint blocks. Both build to PR-open, **HOLD all** for the operator's return. No auto-merge (both agent-facing).
- **Sequence:** Block A (#5) first — it's the priority and deserves fresh context. Then Block B (empty-state).
- **Skip rule (important):** if Block A hits its Phase 0 HARD STOP (the live summation/schema/override reality doesn't match the design), do **NOT** halt the session. Bank the Phase 0 finding for the dispatcher, **skip the rest of Block A**, and proceed to Block B. Block B shares no files with Block A and has no dependency on it. The only true session-halt is a safety or scope breach — a Block A Phase 0 mismatch is an informational finding, not a halt.
- Manage context with `/compact` at the A→B boundary so both fit. If context fills mid-block, report what's done and HOLD; Block B is the lower-priority bonus.
- **Rules in force:** 10, 15, 16, 17, 19, 20, 21, 22, 23. No deploys. Halt language "STOP and wait for dispatcher" reserved for true safety/scope breaches only (see skip rule).

---

## Block A — #5 Money Needs feed-map + double-count reconciliation
**Lane:** build → PR-open → HOLD. Agent-facing money math on a **LIVE** surface (Money Needs is un-gated). Correctness fix.

### Phase 0 — source-verify (HARD STOP → invoke the skip rule, do not halt)
The fix hinges on how totals currently sum. Establish before any code:
1. **Double-add mechanism.** Confirm group total currently = `Σ(manual lines) + Σ(subCalculatorRefs feeding that group)` — the sub-calc total added on top of the manual lines is the double-count. Report the exact summation site/shape.
2. **Saved-worksheet schema.** How are line values + refs persisted per agent? Governs migration. Report the document shape.
3. **Override mechanism.** Does a per-line override / edit-tracking state exist (needed for prefilled-but-editable)? If not, the build adds one — flag it.
4. **Sub-calc outputs.** Confirm CarExpenses → `annualTotalPersonal` (33.3%), `annualTotalBusiness` (66.7%), split total **excludes** the loan; InsuranceIndustry → `annualTotal`; LoansDebt → `annualTotal`.
5. **Line inventory** per group, to confirm the rename/drop/add list below matches live state.

Surfaces (confirm, don't trust — Rule 17): `src/components/agent/MoneyNeedsPanel.jsx`, `src/services/moneyNeedsService.js` (seed ~:178-256), sub-calcs InsuranceIndustry ~:464 / CarExpenses ~:530 / LoansDebt ~:617.

If summation/schema/override reality differs from what the design rests on → **skip rule** (bank finding, go to Block B).

### Decisions locked (surface any deviation)
**Core fix — count once.** Each sub-calc value **prefills its named worksheet line** (prefilled-but-editable); the separate ref add-on for that amount is **removed**. Group total becomes `Σ(line items incl. the now-prefilled calc-fed lines)`, no separate ref add-on.

**Prefilled-but-editable behavior.** Line defaults to the calculator's value and stays synced; an explicit agent edit becomes a stored **override** (with a "reset to calculator value" affordance); if the calc has no value, the line behaves as normal manual entry (pre-existing manual value persists as override).

**Migration / back-compat (LIVE — no data loss).** Preserve every existing manual line value as an override. The double-add removal corrects only the inflated totals of agents who had both a sub-calc value and the duplicate manual line — their total drops to the correct figure (the fix, not a regression). New prefill applies where a calc value exists and no manual override is present. If existing data can't be preserved cleanly → skip rule.

**Feed-map (all prefilled-but-editable):**
| Sub-calc amount | Worksheet line | Section |
|---|---|---|
| Car personal (33.3%) | "Car expenses, nonbusiness" | Living |
| Car business (66.7%) | "Business car expenses" (renamed from "Business travel, car expense") | Business |
| Insurance-industry total | "Professional/industry expenses" (new) | Business |
| Loans & Debt total | "Debt reduction (non-mortgage)" | Savings & Accumulation |

**Line changes:**
- **Drop** "Car insurance" (Fixed) — now inside the car calc split.
- **Drop** "Trade association dues" (Business) — subsumed by the insurance-industry calc.
- **Add** "Other business travel" (Business, manual) — non-car business travel (flights, accommodation, taxis), separate from the prefilled "Business car expenses".
- **Add** "Professional/industry expenses" (Business, calc-fed).
- **Rename** "Business travel, car expense" → "Business car expenses".

**Car calculator changes:**
- **Remove** the editable "Vehicle Loan" line — the car loan lives solely in Loans & Debt.
- **Add** a **read-only reference** "Car loan (from Loans & Debt): $X" — displays the value for cost-of-ownership; **not** part of the car total and **not** split 33.3/66.7.
- Insurance stays inside the car calc (part of the split total).

**Deferred (do not build):** the vehicle-loan-interest deduction (66.7% → Travel expenses). Banked as a separate future feature.

**Reorg.** In each section, group calc-fed lines under a "From your calculators" header (prefilled, editable, distinct), manual lines below. Final sections:
- *Living:* calc-fed "Car expenses, nonbusiness"; manual Food, Clothing, Laundry/tailoring, Entertainment, Medical, Household, Other.
- *Business:* calc-fed "Business car expenses", "Professional/industry expenses"; manual "Other business travel", Sales promotion/advertising, Telephone/computer/stationery, Secretarial & banking, Business entertainment, Other.
- *Savings & Accumulation:* calc-fed "Debt reduction (non-mortgage)"; manual Life insurance, Savings account, Investments, Slush fund, Other.
- *Fixed:* (Car insurance removed) Rent/mortgage, Utilities, Disability income insurance, Homeowners insurance, Property taxes, Other.
- *Miscellaneous:* unchanged.

**Worksheet intro lede (lifestyle reframe).** At the top of the worksheet, before the sections, add a compact, **always-visible** intro lede (no new state — not first-time-only, not dismissible). It reframes the worksheet's purpose from survival-budgeting to lifestyle design, since agents are commission-only with no income ceiling.
- Heading: "Design the life you want"
- Body: "You set your own income — there's no ceiling. So don't just plan to get by. Map out the life you actually want, and see exactly what you'll need to earn to make it real."
- Style: a compact styled callout reusing Nexus tokens (subtle tint/border), no new hex, both themes, non-interactive.
- Operator confirms/swaps the copy on return — display-only, cheap to adjust. Build it with the copy above as the placeholder.

**Output total reframe.** Reframe the worksheet's **own** grand-total label from a survival/"need" framing to a lifestyle framing, so the number reads as a consequence of the agent's choices, not a fixed cost of living. **Label change only — do not touch the value or any downstream feed (Send to Playground / Year Plan get the same number).**
- Total label: "The income your lifestyle requires"
- Optional one-line subtext under it: "Everything above is your choice — this is the annual income it takes to fund it."
- **Scope guard:** change only the worksheet's own output label. If the same total is echoed in the Game Plan hub rung or the Playground hand-off, **note those sites for a follow-up — do not edit them this run** (keeps Block A on the worksheet surface).
- Confirm the total is annual + TTD-formatted (it should be). Operator confirms copy on return; build with the placeholder above.

### Tests & smoke (value-asserting)
- **Reconciliation (headline):** a worksheet with a sub-calc value AND its prefilled line totals the amount **once**, not twice — assert group total + grand total.
- Prefill populates; edit stores override; reset reverts.
- Dropped lines absent; renamed line present; new lines present.
- Car-loan reference is read-only, excluded from the car total/split; removing it doesn't alter the 33.3/66.7 split of remaining running costs.
- Migration fixture: existing manual values preserved as overrides; a double-counted total corrects downward.
- **Production smoke** (setupBypassSession, agent credential from `.env.local`): open Money Needs, enter a car-calc value, confirm Living/Business prefilled lines populate, grand total counts it **once** (write → reload → assert persisted), car-loan reference read-only.

Gates: lint/test/build · both-theme · axe NO-NEW · hex-grep empty. HOLD. Rule 20/21/22/23.

---

## Block B — New-agent empty-state polish
**Lane:** small **display-only** build → PR-open → HOLD (glance-merge). No schema/write/role/route change.

### Phase 0 — soft confirm (adapt if it differs; do NOT stop)
- Confirm the empty-state hero in `AgentDashboard.jsx` (~:560-577 per recon) — the card shown when `allSubmissions.length === 0`. Confirm it's distinct from the removed OnboardingWizard (#660/#667) so we polish the right surface.
- Confirm in-scope context: agent first name (`userProfile`/`displayName`), `personalAnnualAPI` (whether a goal exists), and the existing CTA (`setShowWizard(true)`).

### Design (locked — dispatcher's synthesis of the recon's 3 directions; operator confirms wording on return — display-only, cheap to adjust)
Replace the generic "Welcome to AgencyTrack" splash with a personalized, oriented, path-previewing empty state:
- **Heading:** "Welcome, {firstName} — your account's ready." Use the agent's first name; if unavailable, fall back to "Welcome — your account's ready." (Signals an active account, not a pre-login splash — this is what made it read as "broken/old".)
- **Subtext (context-aware):** if `personalAnnualAPI > 0` → "Your TTD {personalAnnualAPI, formatted} goal is set. Log your first week to start tracking." else → "Submit your first weekly report to start tracking your goal progress."
- **Path preview:** a small, non-interactive 3-step row beneath the CTA — "Submit a weekly report → See your goal progress → Climb the leaderboard." Previews the value loop.
- **CTA:** keep "Submit your first report" → `setShowWizard(true)` (unchanged behavior).

Style: reuse the existing `.role-hero` teal card + Nexus tokens. No new colors/hex (hex-grep stays empty). Both themes. TTD formatting via the existing currency helper.

### Tests & smoke
- Component test: personalized heading renders with a first name; graceful fallback when name absent; goal-set subtext when `personalAnnualAPI > 0`, default subtext when 0; CTA still opens the wizard; path-preview renders.
- **Smoke / gap note (Rule 22):** the empty state only renders for a **zero-submission** agent. If the `.env.local` smoke agent already has submissions, the prod smoke can't reach it — assert via the component test and **state the coverage gap explicitly**, or seed/confirm a zero-state agent if one exists.

Gates: lint/test/build · both-theme · axe NO-NEW · hex-grep empty. HOLD. Rule 20/21/22.

---

## Dispatch
1. Download to `~/Downloads/`.
2. `/land-and-dispatch walk-queue-5-and-emptystate.md`

Both blocks HOLD at PR-open for your return. Block A is the priority; Block B runs after it (or instead of it, if A's Phase 0 invokes the skip rule).
