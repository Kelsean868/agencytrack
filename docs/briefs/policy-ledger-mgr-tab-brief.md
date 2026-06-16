# Policy Ledger — Promote to a Producing-Manager Tab

**Sized:** S–M
**Type:** Producing managers log policies routinely, so promote `PolicyLedgerPanel` from its nested spot (Goals → Self, stacked below the other self-panels) to its **own dedicated tab/entry** in the producing-manager nav — parity with how agents reach their ledger. Remove it from Goals → Self to avoid duplication.
**Channel:** **TIER-B** — frontend nav/UI only; the rule is already live; reuses the self-scoped panel.
**Model:** Sonnet.
**Persona review:** light — findings below.
**Sequencing:** After branch-scoped views.

---

## Persona review (light)
- **Operator-legibility:** match the agent's ledger entry (label, icon, placement pattern) so producing managers get the same recognizable experience, not a second-class nested panel.
- **Role-scoping:** the tab appears **only for producing managers** (`isProducing` = BM/UM). sales_manager / tenant_admin / platform_admin don't see it (they don't produce). Data access stays self-scoped — the panel sources the viewing user's own policies and the live rule enforces self-only.
- **a11y:** tab keyboard-accessible; both themes.

---

## Phase 1 — recon
1. **How agents reach the ledger** — the exact nav mechanism (which tab in the agent dashboard tab set, its label, icon, ordering). This is the pattern to mirror. (No router in this app — navigation is tab state — so confirm the agent tab implementation.)
2. **The producing-manager nav/tab structure** — where producing managers navigate (the ManagerDashboard tab set?), how tabs are conditionally rendered, and the `isProducing` gate already in use (Slice 2 / the catch-up).
3. Confirm `PolicyLedgerPanel` is self-scoped (sources the viewing user's own policies) — established in Slice 2.

## Phase 2 — build
1. Add a dedicated **Policy Ledger** tab/entry to the producing-manager nav, gated `isProducing` (BM/UM only), mounting the self-scoped `PolicyLedgerPanel`. Match the agent's label/icon/pattern for parity.
2. **Remove** `PolicyLedgerPanel` from the Goals → Self stack (de-dup). The other self-panels (derived income, awards reach, MDRT) stay in Goals → Self — only the ledger moves out.

## Phase 3 — smoke (live rule, both themes, resettable producing-manager account)
- Producing manager sees the **Policy Ledger** tab → reaches their own ledger → logs a policy → persists.
- The ledger panel **no longer appears** in Goals → Self (moved, not duplicated).
- A non-producing role (e.g. tenant_admin) does **not** see the tab.
- Both themes.

## Phase 4–5
Docs; Tier-B gates → auto-merge → prod smoke; report after.

---

## Cross-cutting
- Same self-scoped panel + live rule — no data-access change, purely navigation/prominence.
- Parity with agents is the goal: the same recognizable entry, not a nested scroll-down.
