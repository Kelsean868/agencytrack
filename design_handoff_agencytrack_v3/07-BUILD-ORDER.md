# 07 — Build order

Ordered by **agent daily use first** — the surfaces an agent touches every day — with
each phase leaving a genuinely usable product. Effort is S (≤1 day) / M (2–4 days) /
L (a week+) for one developer working in an existing React codebase.

---

## Phase 0 — Foundations  *(nothing ships without these)*

| # | Item | Effort | Notes |
|---|---|---|---|
| 0.1 | **`ACTIVITY_METADATA` as the single source of truth** | S | Codes, families, flags (`icon`, `mgr`, `dev`, prep-capable). Every classifier reads it. Adding a code must require zero other edits. |
| 0.2 | **Store + business-action boundary** | M | Collections, `commit()` seam for optimistic writes, `log()` activity feed. Screens call named actions only. |
| 0.3 | **Task ↔ Event as one entity in two states** | S | `scheduleTask` converts. Do not model as separate tables. |
| 0.4 | **Derived-vs-declared contract** | S | Pure functions: `loggedFor`, `declaredFor`, `pcBreakdown`, `weekTotals`. Property-test monotonicity. |
| 0.5 | **Contrast sweep in CI** | S | Both themes, including `:focus-visible` and `:disabled`. Would have caught 5 defects. |
| 0.6 | **Icons** — add `play` `pause` `grip` `chevron` `alert` `upload` to the DS set | S | And make the `Icon` fallback throw in dev. |

---

## Phase 1 — The daily loop  *(the minimum that replaces a spreadsheet)*

| # | Item | Effort | Depends on |
|---|---|---|---|
| 1.1 | **Shell** — routing, collapsed sidebar, topbar, keyboard | M | 0.2 |
| 1.2 | **Planner — Day** — 96px rows, family hues, `layoutSlots` overlap resolution, tombstones | L | 0.1, 0.3 |
| 1.3 | **Action-plan rail** + drag-to-schedule | M | 1.2 |
| 1.4 | **Planner — Week** | M | 1.2 |
| 1.5 | **Dialer** — queue, `tel:` + WhatsApp, live notes, dispositions, typed wrap-up | L | 0.2 |
| 1.6 | **The cross-module rules** — callback→task, appointment→task, 3-strike archive, block auto-complete | M | 1.3, 1.5 |
| 1.7 | **Lead Entry** | S | 0.2 |
| 1.8 | **Activities** — unified list, `KIND_OF` derived, each row closes as its own type | M | 0.1, 1.6 |

**Ship gate** — an agent can plan a day, work a queue, and have the follow-ups appear
without typing them. This is the product's whole claim; everything after is leverage.

---

## Phase 2 — Trust and the numbers

| # | Item | Effort | Depends on |
|---|---|---|---|
| 2.1 | **Weekly Numbers ledger** — evidenced / declared / counted vs floor | L | 0.4, 1.6 |
| 2.2 | **PC derivation per block** + the monotonicity test | M | 2.1 |
| 2.3 | **Smart compression** as a modifier on both scales | M | 1.2, 1.4 |
| 2.4 | **Customise** — 12 prefs, `RECORDS` group, per-row reset | S | 1.1 |
| 2.5 | **Prep as a property** — 4-item checklist on AI/FFI/CI/JC overlays | S | 1.2 |

**Ship gate** — the numbers a manager sees are derived, labelled, and monotonic.
Do not expose the ledger to managers before 2.2 passes its property test.

---

## Phase 3 — Volume and the pipeline

| # | Item | Effort | Depends on |
|---|---|---|---|
| 3.1 | **Bulk import** — parse · guess header · alias-map · validate · distribute · commit · undo | L | 1.7 |
| 3.2 | **Pipeline** — 6 stages, `newPolicy()` factory on delivery/conversion | M | 0.2 |
| 3.3 | **Phone normalisation module** (locale-configurable) | S | 3.1 |

Bulk import is where a new unit's existing lists enter the system, so it gates
adoption more than its size suggests. The distribution modes (round-robin, balance by
open load) are what make a manager willing to hand over their list.

---

## Phase 4 — Money at risk

| # | Item | Effort | Depends on |
|---|---|---|---|
| 4.1 | **The Book** — delivery register · clawback clock · persistency, with the two-list intersection | L | 3.2 |
| 4.2 | **`chasePremium` → `COLL` block** | S | 4.1, 1.3 |
| 4.3 | **Commission reconciliation** — computed expected, 4 verdicts incl. `UNMATCHED` | L | 3.2 |
| 4.4 | **Queries as records** | M | 4.3 |
| 4.5 | **Tenant settings** — commission rates, clawback window, floors, thresholds | M | 4.1, 4.3 |

4.3 is the feature that makes this not a CRM. 4.5 must land with it — shipping
hardcoded rates to a second tenant is a migration, not a config change.

---

## Phase 5 — Manager and development

| # | Item | Effort | Depends on |
|---|---|---|---|
| 5.1 | **Unit Desk** — per-agent evidenced %, activity vs floor, risk rows | L | 2.1 |
| 5.2 | **Three-way hours split** — own / manager / development from `mgr`+`dev` flags | M | 0.1, 5.1 |
| 5.3 | **Joint calls** — escalate, book, answer, all emitting `JC` | M | 5.2 |
| 5.4 | **Recruit ladder** + Career interview → `RI` block | M | 0.2 |
| 5.5 | **Who Sees What** → real authorisation | M | 5.1 |

**Do not ship 5.1 before 2.2.** A manager-facing accusation driven by a derivation bug
is the most damaging failure mode this product has, and it happened twice in
prototyping.

---

## Phase 6 — Mobile

| # | Item | Effort | Depends on |
|---|---|---|---|
| 6.1 | **Mobile shell** — `MobileTab` (More in slot 5), `MobileMore`, safe-area padding, token inheritance | M | 1.1 |
| 6.2 | **Mobile dialer** — full screen, 52px `tel:` | M | 1.5, 6.1 |
| 6.3 | **Mobile Day / Pipeline / Book** | M | 6.1 |
| 6.4 | Desktop-only screens labelled `desktop` in More | S | 6.1 |

---

## Phase 7 — Print

Not started in the prototype. Weekly WAR · Agent Report · Master Sheet · Production
Report. All data exists in the store after Phase 5. Build these as **print-owning
documents from the start** (a paged-document component), not as screen views with
print CSS bolted on — the earlier `.print-hide` approach in the existing app is a
workaround, not a design.

| # | Item | Effort |
|---|---|---|
| 7.1 | Weekly WAR | M |
| 7.2 | Agent Report | M |
| 7.3 | Master Sheet | M |
| 7.4 | Production Report | M |

---

## Two things worth doing out of order

- **0.5 (contrast sweep in CI)** — one day of work that would have prevented five
  defects, one of which shipped in a keyboard-only state.
- **0.4 + 2.2 (the derivation contract and its property test)** — the two worst bugs
  in this build were both monotonicity violations in derived counts, and both reported
  false facts about a named agent to their manager. Write the property test before the
  ledger UI.
