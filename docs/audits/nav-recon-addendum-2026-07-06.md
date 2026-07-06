# Nav Recon ADDENDUM — Shell-mockup re-check vs the Tier-1 verdict

**Date:** 2026-07-06 · **Branch:** `recon/nav-shell-addendum` · **Mode:** READ-ONLY recon (one file write, no source edits, no deploy, no merge) · **Scope:** pure frontend (functions/ not read) · **Predecessor:** [nav-recon #822](nav-recon-2026-07-06.md)

Closes the two gaps #822 flagged by inspecting the two shell mockups it could not reach:
- `docs/design-system/ui_kits/nexus/shell.jsx` (desktop + mobile DS UI-kit shell)
- `docs/design-system/screens-v2/planner-scheduler-handoff/mockups/app-mobile.jsx` (mobile app screens)

---

## VERDICT — **CONFIRMED TIER 1 (reskin). The tier does not move.**

Neither file bumps the nav change above Tier 1. Driving findings:

1. **Higher-role gap is NOT closed, but nothing in either file reveals a *different* role-visibility model or a new global-nav approach for the higher roles.** shell.jsx is **agent-only** (hardcoded `side-role` "Agent · My Book", [shell.jsx:189](../design-system/ui_kits/nexus/shell.jsx); `roles: ['agent']`, [:207](../design-system/ui_kits/nexus/shell.jsx)). app-mobile.jsx shows an agent dashboard and a **branch-manager** dashboard/master-sheet, but those manager screens **reuse the identical agent bottom nav** ([app-mobile.jsx:531,622](../design-system/screens-v2/planner-scheduler-handoff/mockups/app-mobile.jsx)). **No Sales Manager / Tenant Admin / Platform Admin nav is depicted anywhere.** Absence of higher-role content ⟹ no *new* structural requirement surfaced for those roles ⟹ no Tier-3 driver.

2. **app-mobile.jsx CONFIRMS the mobile model and the exact small Tier-2 residue #822 already recorded — it adds nothing new.** Bottom nav = 5 slots **Home · History · Submit (center FAB) · Ranks · More** ([app-mobile.jsx:55-62](../design-system/screens-v2/planner-scheduler-handoff/mockups/app-mobile.jsx)), identical to the canonical `AgencyTrack Mobile Nav.html` #822 cited. The only deltas vs the shipped app are the two #822 already flagged (FAB slot-2 → center slot-3; Profile folded into More). No third delta appears.

3. **shell.jsx's two novel affordances (⌘K command palette + drag-reorder) are DS-UI-kit component demos, not the app's locked nav spec.** They are wired from `window.AgencyTrackDesignSystem_ad1cd7` — the `_ds` bundle the reference index explicitly says **not to import into the app** ([Reference Index.md:9-10,82-86](../design-system/screens-v2/AgencyTrack%20-%20Claude%20Code%20Reference%20Index.md)). shell.jsx even **diverges from the locked app spec** (it drops the ★ Pinned sidebar zone in favor of drag-reorder — see below), which marks it as a component showcase, not the app prescription. The decision-locked app-facing nav (`Nav & Quick Actions`, "Pinned + groups") has neither a command palette nor drag-reorder, and the shipped app implements *that*. So porting the locked nav — the change being classified — stays Tier 1. Adopting ⌘K or drag-reorder would be **separate, optional net-new feature work** (see Rule 23 below), not part of the reskin.

**Bottom line:** #822's TIER 1 verdict holds unchanged, and the contained Tier-2 mobile-bottom-nav residue is re-confirmed (not enlarged). Two *optional* enhancements (⌘K palette, drag-reorder) are newly surfaced and explicitly out-of-scope of the reskin.

---

## Per-file findings

### A. `docs/design-system/ui_kits/nexus/shell.jsx` — desktop + mobile DS UI-kit shell

**What it is:** a UI-kit *sample* that "Rebuilds the portal chrome on the 2026 redesign nav components" ([:1-5](../design-system/ui_kits/nexus/shell.jsx)), consuming DS components from the `_ds` bundle: `SideNavSections, MobileTab, MobileMore, MobileCreateSheet, CommandPalette` ([:8-11](../design-system/ui_kits/nexus/shell.jsx)). It is a single-role (**agent**) demonstration, not a per-role app spec.

**Desktop sidebar nav it depicts** (`BASE_SECTIONS`, [:15-20](../design-system/ui_kits/nexus/shell.jsx)):

| Section | Items |
|---|---|
| Overview | Dashboard · Weekly Report · History |
| Planning | Game Plan · Money Needs · Goals |
| Tools | Commission · Persistency · Policy Ledger · Prospect Prep |
| Recognition | Awards · Career Portal |

vs **shipped agent nav** (#822: Today / Planning / Tools / Recognition; navConfig.js `AGENT_NAV`). Differences are all **simplifications** of the sample, not new IA: section 1 is labeled "Overview" not "Today"; no Daily Log, no Planner-SOON, no Financing, no Production Report; Recognition omits Leaderboard. This is a reduced/older sample item set, reinforcing "kit showcase, not spec."

**Nav mechanisms in shell.jsx (cited):**
- **Sectioned sidebar** rendered by `SideNavSections` with **drag-reorder**, persisted to `localStorage['nexus-kit-navorder']` ([:120,133,191](../design-system/ui_kits/nexus/shell.jsx)) — the personalization mechanism here is drag-reorder, **not** a ★ Pinned zone.
- **Pins + frequent-visit items exist but are surfaced only in the mobile `MobileMore` drawer, not the desktop sidebar** ([:122-124,174-176](../design-system/ui_kits/nexus/shell.jsx)). ⟹ shell.jsx's desktop treatment **diverges from both the shipped app and the locked `Nav & Quick Actions` spec**, which put a ★ Pinned zone in the sidebar. Another sign this is a component demo, not the canonical app nav.
- **⌘K CommandPalette** — full search+jump and a `create` mode, keyboard-bound ([:9,116,137-142,199-200,207-208](../design-system/ui_kits/nexus/shell.jsx)); header shows a "Search screens… ⌘K" button ([:86-90](../design-system/ui_kits/nexus/shell.jsx)) and a separate `quick-create` ＋ button ([:97](../design-system/ui_kits/nexus/shell.jsx)). **Not present in the shipped app** (#822 confirmed no command palette in `src`).
- **Collapse** toggle (local state only, not persisted here) ([:111,193-195](../design-system/ui_kits/nexus/shell.jsx)).
- **Role:** hardcoded agent — `side-role` "Agent · My Book" ([:189](../design-system/ui_kits/nexus/shell.jsx)); `roles={['agent']}` and agent-only `QUICK_ACTIONS` ([:22-27,207](../design-system/ui_kits/nexus/shell.jsx)). **No role switch, no higher-role nav.**

### B. `docs/design-system/screens-v2/planner-scheduler-handoff/mockups/app-mobile.jsx` — mobile app screens

**What it is:** five 390×844 mobile screen mockups (Agent Dashboard, Looking Ahead, Money Needs, Manager Dashboard, Master Sheet) sharing one bottom-nav component.

**Mobile bottom-nav model** (`MNav`, [:55-62](../design-system/screens-v2/planner-scheduler-handoff/mockups/app-mobile.jsx)):

| Slot | 1 | 2 | 3 (center) | 4 | 5 |
|---|---|---|---|---|---|
| Item | Home | History | **Submit (elevated FAB)** | Ranks | More |

- FAB is **dead-center** (position 3 of 5), teal gradient, `marginTop:-32` elevation, label "Submit" ([:79-93](../design-system/screens-v2/planner-scheduler-handoff/mockups/app-mobile.jsx)).
- The **same `MNav`** renders on agent screens (`active="home"`, [:252](../design-system/screens-v2/planner-scheduler-handoff/mockups/app-mobile.jsx)) **and** on the **manager** screens (`MManagerDashboard` [:531](../design-system/screens-v2/planner-scheduler-handoff/mockups/app-mobile.jsx); `MMasterSheet` [:622](../design-system/screens-v2/planner-scheduler-handoff/mockups/app-mobile.jsx)) — i.e. the manager screens **reuse the agent bottom nav** (Home/History/Submit/Ranks/More), a mockup simplification, not a manager nav prescription.
- **No More-drawer contents** are depicted here (the "More" slot is a stub in this file; the drawer catalog lives in shell.jsx `MobileMore` and in `AgencyTrack Mobile Nav.html`).

**vs shipped mobile** (#822): shipped agent bottom nav = Home · **Create(fab, slot 2)** · History · Ranks · Profile (+ auto-appended More = 6 items). app-mobile.jsx confirms the spec target (center FAB, 5 slots, Profile folded into More) — i.e. **exactly the Tier-2 residue #822 already flagged**. FAB label here is "Submit"; #822 already noted `Nav & Quick Actions` supersedes this with a "Create"/quick-add sheet — no change to that reasoning.

---

## Higher-role answer (the key gap #822 raised)

**Do these files reveal Sales Manager / Tenant Admin / Platform Admin nav that differs structurally from the shipped role-based nav? — NO. They do not depict those roles at all.**

- shell.jsx: agent-only ([:189,207](../design-system/ui_kits/nexus/shell.jsx)).
- app-mobile.jsx: agent + **branch-manager** screens only; branch-manager reuses the agent bottom nav ([:531,622](../design-system/screens-v2/planner-scheduler-handoff/mockups/app-mobile.jsx)). No SM/TA/PA.

Therefore: the higher-role gap **remains open** (still no committed mockup for SM/TA/PA nav), but — and this is what matters for the tier — **nothing here introduces a new section set, a changed visibility model, or a different global-nav approach for those roles.** The shipped app keeps SM/PA on `ManagerDashboard`'s inline role-filtered `NAV_ITEMS` and TA on `TenantAdminDashboard`'s inline `NAV_ITEMS` (#822 Task 1c). No evidence here contradicts continuing that. The gap is an **absence of new requirements**, not evidence of a larger change.

---

## Updated DECISIONS-NEEDED (tier did not move; #822's five decisions stand)

The addendum adds no new tier-driving decision. It refines two items and re-confirms the rest:

1. **Ratify CONFIRMED TIER 1** for the locked-nav port, with the Tier-2 mobile-bottom-nav residue unchanged from #822 (center the FAB; fold Profile into More). *(Recommended.)*
2. **⌘K command palette — adopt or shelve? (NEW, optional, out-of-scope of the reskin.)** shell.jsx wires a full ⌘K palette; the shipped app has none and the decision-locked `Nav & Quick Actions` spec does not include one. If desired, scope it as **separate net-new feature work** (it is a new global-nav element — Tier-3-class on its own), not part of this nav pass. *(Recommended: shelve for the reskin; bank as a follow-up idea.)*
3. **Drag-reorder sidebar/tabs — adopt or shelve? (NEW, optional.)** shell.jsx uses drag-reorder as its personalization mechanism instead of the shipped ★ Pinned zone. The app + the locked spec use ★-pin. Keep ★-pin for the reskin; treat drag-reorder as an optional later enhancement. *(Recommended: keep ★-pin; shelve drag-reorder.)*
4. **SM / TA / PA nav (still-open gap):** confirm the shipped inline/role-filtered nav is retained for these roles (recommended — reskin only). No committed mockup prescribes otherwise; do not invent one.
5. #822 decisions 2–3 (mobile reorder now-vs-defer; nav-vs-Planner sequencing) are unchanged.

---

## Known gaps (Rule 22)

1. **SM / TA / PA nav is STILL not depicted in any committed mockup** — not in #822's sources, not in these two shell files. Their new-design nav intent remains unverified by design source; this recon can only report that no committed mockup contradicts retaining today's inline role-filtered nav.
2. **shell.jsx is an agent-only, simplified sample** (older/reduced item set, drag-reorder instead of ★-pin). It cannot be read as the canonical desktop nav spec; the canonical app-facing spec remains `Nav & Quick Actions - 2 Options.html` (#822). If a *role-aware* version of this DS shell exists elsewhere in the `ui_kits/` or handoff subtrees, it was not located in this pass.
3. **app-mobile.jsx does not depict the More-drawer contents** (the "More" slot is a stub); the drawer catalog was read from shell.jsx `MobileMore` + `AgencyTrack Mobile Nav.html`, not from this file.
4. **shell.jsx's manager/higher-role behavior is untestable here** because it hardcodes a single agent role; whether `SideNavSections`/`CommandPalette` were *intended* to be role-parameterized (they accept `roles`/`sections` props) is design-inferable but not demonstrated for non-agent roles.

## Rule 23 — what in these files WOULD have bumped the tier, and whether it is present

| Potential Tier-mover | Present in these files? | Effect on the tier |
|---|---|---|
| A committed SM/TA/PA nav with **new sections or a changed visibility model** | **ABSENT** — no higher-role nav depicted | Would be Tier-3 if present; not present ⟹ no move |
| A **different global-nav approach** for the app (e.g. top-nav, or a role-switcher) | **ABSENT** — desktop is the same sidebar-shell model | No move |
| A **command palette adopted as the app's primary nav** | **PRESENT as a DS-kit demo only** (from the do-not-import `_ds` bundle), absent from the locked app spec and shipped app | Not part of the reskin ⟹ no move; adopting it later = separate Tier-3-class feature |
| **Drag-reorder replacing ★-pin** in the app | **PRESENT as a DS-kit demo only**; app + locked spec use ★-pin | Not part of the reskin ⟹ no move; optional later enhancement |
| A **third mobile-bottom-nav delta** beyond #822's FAB-center + Profile→More | **ABSENT** — app-mobile.jsx matches #822's residue exactly | No move; Tier-2 residue unchanged |

**Conclusion:** every finding is either an absence (higher-role nav) or a DS-kit-only affordance explicitly excluded from the locked nav port. **The Tier-1 verdict is confirmed.**
