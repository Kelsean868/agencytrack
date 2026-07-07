# AgencyTrack — App-Wide Design-Conformance Audit

**Date:** 2026-07-07 · **Branch audited:** `feat/more-sheet-v2` · **Type:** READ-ONLY recon · **Author:** Claude Code (recon executor)

> **What this is.** A *conformance* audit: for every app screen, does the **live** component match the design system's intended **features, sections, controls, states, and behaviors** — not merely "does a component exist and use v2 tokens." Prior recons (#828 Track-J, #822/#823 nav, and the repo-reconciled *DS Audit & Migration Plan v2*) measured component-existence + token adoption and concluded the app is "~80% built, finish the port + build CRO." That framing is **correct at the component altitude and misses the feature altitude.** This audit works the feature altitude: it finds that many screens the prior audits mark **Built/Shipped** are missing substantial *designed* features, whole sub-surfaces, and — most systemically — the four-states / motion / dialog-a11y / dense-table contracts the redesign-addendum makes mandatory.

> **Sources of truth (precedence):** (1) `docs/design-system/guidelines/redesign-addendum.md` (app rules — wins for app surfaces); (2) the `docs/design-system/screens-v2/` mockups (`.html` composed + the richer `.jsx` scene modules with `.intro` intent cards); (3) `docs/design-system/tokens/app.css`. Operator overrides recorded in `CLAUDE.md` / `docs/CONTEXT.md` / `docs/FOLLOW_UPS.md` win over the spec and are flagged **DELIBERATE-DIVERGENCE**, not gaps.

> **Method.** Nav + whole-screen routing + operator-override reconciliation done directly (with source verification of the load-bearing claims). Per-screen feature comparison fanned out to 8 read-only auditor passes (agent-core, agent-planning/money, agent-tools/report, agent-recognition/profile, manager-core, manager-team/recognition, manager-presentation/reports, admin/shell/system), each diffing the live component against its mockup line-by-line. Every row cites a design ref **and** a live `path:line`.

---

## 1 · Executive summary

The design system is genuinely in the repo and most screens render on v2 tokens/primitives — that part of the prior audits holds. But at the feature level the picture is: **a small number of whole surfaces are unbuilt, two marquee presentation screens are still their pre-redesign v1 build, and a set of addendum-mandated cross-cutting contracts (states, motion, dialog-a11y, dense tables) are unmet on a large fraction of screens.** The navigation layer — the brief's priority — is *mostly* built (Pinned zone, role-scoped Quick-Add ＋, workspace toggle, More-sheet-v2 all shipped) but is missing **desktop drag-reorder** (operator-confirmed intent), a **global command palette**, and an **admin ＋/create sheet**.

### Classification counts (material findings in this report)

| Class | Count | What it means |
|---|---:|---|
| **MISSING** | ~92 | A designed feature/section/control/state/behavior with no live equivalent — real gap, should build. |
| **NEEDS-RULING** | ~30 | Valid design element the live app lacks, but building it is a product/scope call (CRM-adjacency, Tatil-pending model, cross-branch Phase-9, net-new surfaces) or a prior decision conflicts. Operator must decide. |
| **DELIBERATE-DIVERGENCE** | ~22 | Live differs from the mockup because of an operator-locked decision or a defensible equal-outcome choice — **not** a gap. |
| **COSMETIC** | ~55 | Styling/polish/label drift; no missing capability. |

Counts are of the rows surfaced in this report (curated to material findings; low-value cosmetic micro-drift is summarized, not enumerated). Treat them as representative, not a census.

### The headline shape

1. **Whole surfaces unbuilt or net-new** (largest gaps): CRO/back-office, Planner (agent) + Team Planner (manager), **Meeting Mode v2**, **Kiosk v2 theatrical scoreboard**, **Settings v2**, the **interactive Agent Report View**, the **Reports PDF deliverables**, the **Policy Ledger campaign-proof lens**, the **Awards provenance system**, the **Financing K8 BM roster / K9 arc hero**, and the **Persistency v2 rolling model** (the last is Tatil-pending → a ruling, not a build).
2. **Cross-cutting contract gaps** (most systemic — repeat on 15+ screens): the addendum §1 **four-states** contract (skeletons-not-spinners, error-**with-Retry**, actionable empties, partial-failure banners), §2 **count-up/stagger motion**, §4 **dialog focus-trap/Escape/return**, and §5 **dense-table** mechanics (sticky header-top, tabular-nums, footer counts, card-scoped scroll).
3. **Navigation** (priority §3): mostly conformant; three real MISSING items + a few small ones (details in §3).

---

## 2 · How this relates to the prior "mostly-built" audits (Rule 23 cross-check)

The repo-reconciled *DS Audit & Migration Plan v2* (`docs/design-system/screens-v2/AgencyTrack App - DS Audit & Migration Plan v2 (Repo-Reconciled).html`, itself marked **superseded** as the authoritative record on 2026-07-07) marks ~30 screens **Built** and one **Net-new** (CRO). That audit is measuring *does the component exist and use the tokens*. **Every MISSING finding below was checked against that "Built" claim and survives it** — e.g. Meeting Mode's `MeetingMode.jsx` exists and is on tokens (so it's "Built"), yet it is the v1 3-slide slideshow, not the v2 14–16-scene run-of-show. The two audits are not in conflict; they measure different altitudes. Where they *appear* to conflict (a "Built" screen with large MISSING rows), the resolution is always: component present, designed features absent.

The whole-screen net-new items (CRO, Planner, Team Planner) that audit *does* flag are corroborated here with routing citations (§6.4).

---

## 3 · Navigation deep-dive (brief priority §3)

Audited: `redesign-addendum.md §3` + the DS nav component intent (`Sidebar.prompt.md`, `MobileTab.prompt.md`, `MobileMore.prompt.md`, `MobileCreateSheet.prompt.md`, `CommandPalette.prompt.md`) vs live `shell/Shell.jsx`, `Sidebar.jsx`, `MobileBottomNav.jsx`, `MobileNavDrawer.jsx`, `QuickAddMenu.jsx`, `navConfig.js`, `navSections.js`, `WorkspaceToggle.jsx`, `TopBar.jsx`, plus the shipped nav-redesign PR-1→PR-4 sequence.

### 3.1 Built and conformant (do not re-flag)

| Addendum §3 feature | Live | Evidence |
|---|---|---|
| 232px sidebar, sections w/ mono-uppercase eyebrow headers, `aria-current="page"` | ✅ | `.shell` `grid-template-columns: 232px 1fr` ([index.css:1146](../../src/index.css)); `.sidebar-section` JetBrains Mono uppercase ([index.css:1186-1194](../../src/index.css)); `Sidebar.jsx:76` |
| ★ Pinned zone, persisted per-role | ✅ | `Sidebar.jsx:147-152`; `usePinnedNav.js` (localStorage-first + Firestore reconcile); seeds in `navConfig.js:239-257` |
| My Work ⇄ My Team workspace organization (producing managers) | ✅ | `WorkspaceToggle.jsx`; `getWorkspaceGroups` `navConfig.js:307-344` (nav-redesign PR-4) |
| Mobile fixed 5-slot bar with center **＋** create shortcut | ✅ | `MobileBottomNav.jsx:39-62` (fab slot); agent `BOTTOM_NAV` `AgentDashboard.jsx:72-77` |
| **More sheet v2** — grouped labelled sections + ★ Pinned row + auto Frequent row + thumb-reach **Done** + focus-trap | ✅ | `MobileNavDrawer.jsx` (sections `groupBySectionLabel`; Pinned :134-140; Frequent :141-147; Done :158-167; `useFocusTrap` :29). Shipped commit `b5bf040b` |
| Create sheet role-scoped (agent/producing-mgr/manager action lists) | ✅ | `QuickAddMenu.jsx` + `quickAddConfig.js` (nav-redesign PR-3) |

**Correction to the brief's premise:** the brief states "the mobile bottom-nav ＋ / Quick-Add menu is absent vs the design." It is **present** — it shipped as nav-redesign PR-3 (`FOLLOW_UPS.md` "PR-3 — Quick-Add SHIPPED (PR #729)"). The center **＋** opens a role-scoped `QuickAddMenu` on mobile and a pencil-FAB popover on desktop. This is conformant, not a gap.

### 3.2 Navigation — real MISSING items

| Addendum §3 / DS intent | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| "Sidebar items are **drag-reorderable** (pointer + long-press touch fallback), persisted" (`redesign-addendum.md:96-97`) | `Sidebar.jsx:56-118` renders static rows; **zero** DnD anywhere (`grep draggable\|onDragStart\|useSortable\|dnd-kit` = 0 hits in `src`) | Desktop sidebar drag-reorder does not exist and is **not** a tracked follow-up. The nav-redesign shipped **Pinned** as the first personalization increment; full reorder was never in PR-1→4 scope. Brief confirms this is operator-real intent. | **MISSING** | M |
| Global **⌘K / "/" command palette** — search-and-jump to any screen + role-scoped quick create, focus-trapped (`CommandPalette.prompt.md`; DS ships `components/app/CommandPalette.jsx`) | No live command palette (`grep CommandPalette\|cmdk` = 0 in `src`); TopBar search is a **deliberate no-op** placeholder (`TopBar.jsx:36-43`, "no-op per PRD Q7") | The design ships a full command palette; the app ships a dead search box. | **MISSING** / NEEDS-RULING | M |
| "Create sheet … role-scoped (… **admin: branch / user**)" (`redesign-addendum.md:110-112`; `MobileCreateSheet.prompt.md`) | `TenantAdminDashboard.jsx:56` `BOTTOM_NAV` has **no fab**; no `QuickAddMenu` mount; `quickAddConfig.js` has no admin branch/user create list | Tenant-admin has no ＋ / create sheet at all — the design specifies admin create actions (branch, user). | **MISSING** | M |
| Mobile-tab **drag reorder** — `MobileTab`'s `onReorder` "enables drag" (`MobileTab.prompt.md`) | `MobileBottomNav.jsx` has no reorder handler | Mobile bottom-tab reordering absent (companion to desktop drag). | MISSING | S |
| More slot carries a **vertical ⋮ affordance beside the icon** "so it always reads as opens-a-menu" (`redesign-addendum.md:99-101`; `MobileTab.prompt.md`) | `MobileBottomNav.jsx:84-92` uses `MoreHorizontal` (⋯), no ⋮ affordance | Wrong menu affordance glyph; reads less as "opens a menu." | COSMETIC | S |
| More slot **adaptively shows the current deep-screen's name** (keeps ⋮) (`redesign-addendum.md:100-102`; `MobileTab.prompt.md` `current` prop) | `MobileBottomNav.jsx:91` static label "More" | No adaptive deep-screen label. | MISSING | S |

### 3.3 Navigation — already-banked follow-ups (KNOWN, not new)

These are real gaps but already tracked — listed so they aren't double-counted as new work:

- **Mobile pin edit-mode** — `MobileNavDrawer` renders Pinned read-only; long-press/edit-toggle to pin on a phone deferred (`FOLLOW_UPS.md:689-691`).
- **QuickAddMenu mobile sheet has no visible close/back button** (dismisses via backdrop/Escape only) — LOW a11y-parity (`FOLLOW_UPS.md:54-56`).
- **Manager/Admin static topbar `<h1>`** ("Welcome back, {name}" identical on all 16 manager / 5 admin screens) — dynamic per-screen title deferred pending a greeting-placement product call (`FOLLOW_UPS.md:42`).
- **Producing-manager "MINE" surfaces** (mp-dashboard / mp-persistency / mp-production-report / mp-awards / manager-career) dropped from the workspace partition as no-route (`FOLLOW_UPS.md:706-716`).

### 3.4 Navigation — DELIBERATE-DIVERGENCE (operator overrides, not gaps)

- **Mobile sign-out lives in Profile**, not the More drawer, and desktop sign-out in the sidebar foot (`TopBar.jsx:11` "Sign-out lives in the sidebar foot, NOT here (locked decision)"; `ProfileScreen.jsx` sign-out). The design's placement differs; the operator decision wins.
- **Profile reached via the sidebar-foot avatar**, not a nav row (both agent + producing-manager configs) — intentional (`navConfig.js:86`).

---

## 4 · Cross-cutting systemic gaps (the most repeated findings)

These recur across most screens and are the single most valuable body of work. They are addendum-mandated contracts, not per-screen polish.

### 4.1 §1 Four-states — the biggest systemic gap

The addendum requires every data surface to render loading → **skeleton (never spinner)**, empty → **actionable CTA (never "No data")**, error → **persistent inline card with Retry (never a toast/silent)**, and partial-failure → **inline warning banner with count**. The app has a `PanelSkeleton` kit (PR #832) and a handful of reference-grade implementations, but the contract is unmet on a large fraction of screens:

- **No Retry affordance** on error cards across: Leaderboard, Awards, Persistency, Policy Ledger, Production Report (×3 views), Team Dashboard, WARs, Recruiting, Compliance-adjacent older panels, Branches, Company Config (×4 panels), Financing self-view, Settlements. Many correctly avoid toasts but stop at a message.
- **Silent-swallow failures** (worst class): `TenantAdminDashboard.jsx:102-133` (all 3 fetches `console.error` only, tiles stuck at `—`); `CampaignPanel.jsx:505-516` (load catch → `console.error`, no UI); Production views `.catch(() => [])` (`AgentProductionView.jsx:69-70` et al.) masking partial failures with no banner — the same class as the 10-day-masked D3 rules bug (`FOLLOW_UPS.md:3277`).
- **Spinners/text instead of skeletons**: Daily Capture (`DailyCaptureV2.jsx:746-758`), Wizard load gates (`WizardForm.jsx:683-691`), Persistency, Production views, admin panels (`AwardsRulesetPanel.jsx:624`, `PlanCatalogModal.jsx:239`), Branches bulk-import.
- **"No data" dead-end empties** (no CTA): History, Awards, Production tables (`ProductionTable.jsx:12-18`, `RankedLeaderboard.jsx:24-30`), Recruiting, Campaigns, AOM.

**Reference-grade implementations to copy** (prove the app already has the patterns): `UserManagementPanel.jsx:577-594` (skeleton + Retry), `CompliancePanel.jsx:348-372`, `TeamPlansRoster.jsx:110-149`, `AgentPlanDrawer.jsx`, `PolicyReconciliationPanel.jsx:245-274`, and both bulk-import modals' **partial-failure** FailureList + "Download error report."

### 4.2 §2 Motion — count-up & staggered assemble largely absent

No live hero/KPI numeral counts up on load (`HeroCard.jsx:41-49`, `PlanAnchorStrip.jsx:91`, `CommissionAnchorStrip.jsx:204`, `DerivedIncomePanel.jsx:155`, Leaderboard podium, wizard Celebration). Staggered-assemble (transform-only per §2) is present on the dashboards' `screen-enter` wrapper but absent on most non-dashboard screens (Leaderboard, Awards, Career, Persistency, Policy Ledger, Production, Prospect, Meeting). The wizard/daily celebrations also drop the designed count-up.

### 4.3 §4 Dialog a11y — focus-trap/Escape/return missing on several modals

Sibling modals do it right (`BranchEditorModal.jsx`, `EditConfigModal.jsx`, `ActivityStandardsModal.jsx`; `useFocusTrap` exists), but these declare `role="dialog"` yet omit the focus machinery: `DeactivateBranchConfirmDialog.jsx:15-93` (no role/aria-modal/trap/Escape, 32px close), `PlanCatalogModal.jsx:185-206`, `WelcomeScreen.jsx:56` (onboarding tour), `PolicyDrillDrawer.jsx:60-97` (Escape only), `PersistencyPlayground.jsx:99-106`, `EditUserDrawer.jsx` (no trap/return), `MeetingMode.jsx:366` (fullscreen overlay, Esc only), `QuickAddMenu` (no visible close — banked).

### 4.4 §5 Dense operational tables — mechanics incomplete

The addendum requires scroll-**inside-the-card**, sticky header (`top:0`) **and** sticky first column (`left:0`), right-aligned `tabular-nums`, a live footer count, and ellipsis-with-`title`. Findings:

- **MasterSheet** (`MasterSheet.jsx`): first two columns **are** sticky-left ✅ (`:333`) and a footer count **is** present ✅ (`:399-405`), but the **header row is not `sticky top-0`**, the card is `overflow-x-auto` only so **vertical scroll is page-level**, and `tdBase` (`:259`) has no `tabular-nums`/right-align (numeric cells render left-aligned proportional). *(Independently verified.)*
- **ProductionTable / RankedLeaderboard**: no sticky header/first-col, no footer count, `truncate` without `title`, no tabular-nums.
- **All Users / Branches**: rendered as spaced **card-lists**, not tables — no sticky, no zebra, no footer count, no status pills, no tabular-nums (`UserManagementPanel.jsx:603`, `BranchesPanel.jsx:243-312`).

### 4.5 44px touch targets

Persistency controls sit at 36–40px (`PersistencyPlayground.jsx:119-126` close `h-9`; footer/Tab CTAs `h-10`) — under the field-agent 44px floor (CLAUDE.md UI rule + addendum §4).

---

## 5 · Per-screen conformance — gap tables

Format: `Design ref | Live path:line | Gap | Class | Size`. Conformant screens/rows are summarized. Cross-cutting §1/§2/§4/§5 rows already covered in §4 are not repeated per-screen except where the screen-specific instance is load-bearing.

### 5.1 Agent surfaces

#### Agent Dashboard — `app-dashboard-v2.jsx` → `dashboard/AgentDashboard.jsx` + `HomeV2/*`
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| DeliveryStripCard — "Policies to deliver" + 30-day clawback clock + per-policy days-left | `HomeV2/DeliveryStripCard.jsx:17-19` returns `null` | Whole "Policies to deliver" section stubbed out | MISSING | M |
| Hero count-up + staggered block assemble | `HomeV2/HeroCard.jsx:41-49`, `index.jsx:198-250` | Static numeral; no per-block stagger (§2) | MISSING | S |
| Hero YoY "+18% vs LY" chip; goal end-label amount | `HeroCard.jsx:50-52,84-87` | Deferred by code comment (LOW FU) | DELIBERATE-DIVERGENCE | S |
| PulseStrip 6-col fixed | `PulseStrip.jsx:79` responsive 2/3/6 | Responsive collapse (arguably better) | DELIBERATE-DIVERGENCE | S |

Strong: HeroCard, PulseStrip (chips/tones/aria), StandardDetail drawer (dialog+trap, richer than mock), error banner.

#### Daily Capture — `dailycap-*.jsx` → `daily/DailyCaptureV2.jsx`
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| DailyCelebration — streak-milestone takeover (flame medal, confetti, "N days in a row", stat cards) | none (flame count only `DailyCaptureV2.jsx:706-715`) | Whole streak-milestone recognition moment absent | MISSING | M |
| DailyAnchorStrip — week-to-date API-vs-target progress bar + mode-provenance tag | `DailyCaptureV2.jsx:694-742` (count strip only) | No WTD API progress bar; no "your choice / locked by mgr" provenance | MISSING | M |
| AgentModePicker — daily/weekly/hybrid picker w/ manager lock | not in Daily components (`loggingMode` read-only from profile) | Agent-facing reporting-mode picker absent from this surface | NEEDS-RULING | M |
| §1 error → inline card w/ Retry | `DailyCaptureV2.jsx:1047-1051` (role=alert text, no Retry) | — | MISSING | S |

Note: `DailyEntryModal.jsx` appears to be a secondary/legacy modal (`NumericField` cards) vs the in-use `DailyCaptureV2` — confirm it's still routed (NEEDS-RULING).

#### Weekly Report Wizard — `wizard-v2-*.jsx` → `wizard/WizardForm.jsx` + `v2steps/` + `v2chrome/`
*Closest-to-conformance screen.* 12 steps/4 phases, `PhaseProgress`, `AutosaveChip`, `WeekSoFarPanel`, `ReviewSubmit` all map 1:1.
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| Celebration — gold WEEK-N badge medal + 3-card count-up stats (API/Apps/Est. Commission) + "View submission" CTA | `v2chrome/Celebration.jsx:50-174` (check-halo + API/points, single CTA) | Partial: no gold week medal, no Apps/Est-Commission cards, no count-up, no secondary CTA | MISSING (partial) | M |
| Mobile WeekSoFar collapsed strip **expands to a sheet** | `v2chrome/WeekSoFarPanel.jsx:280-327` (strip only; LOW FU noted) | Expand-to-sheet interaction absent | MISSING | S |
| Wizard is a take-over modal over a dimmed/blurred AppShell | `WizardForm.jsx:522-529` plain full-screen | Framing divergence (no dimmed shell/scrim/floating card) | COSMETIC | S |

#### History — `history-v2-*.jsx` → `submissions/HistoryTab.jsx` + `SubmissionViewer.jsx`
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| HistoryDrillContent — week-anchored eyebrow/title/note + hero KPI-with-deltas + **status-driven footer CTA** (Download PDF / Continue editing / Edit+resubmit) | `SubmissionViewer.jsx:57-197` (generic "Submission Details", 2-col dump, **no footer CTA**) | Drill drawer never reskinned; no action-oriented footer | MISSING | M |
| Draft/unlocked WeekCard "CONTINUE / OPEN TO EDIT" leads to editing | `HistoryTab.jsx:362-436` → `onView` → read-only viewer | Behavioral gap: edit chips open read-only viewer, not the wizard | MISSING | M |
| HistoryFilterRow — Year + Month dropdowns + "★ Award weeks" toggle + Search | `HistoryTab.jsx:280-309` (status segmented only) | Four filter controls missing | MISSING | M |
| YearHeatmap — award-eligible gold dot, best-week ring, current-week pulse, longest-streak underline/callout | `HistoryTab.jsx:189-277` (grid+intensity+draft/unlocked only) | Four heatmap enrichments missing | MISSING | M |
| WeekCard best-week/award badges + note; delta chips show magnitude | `HistoryTab.jsx:368-411` (arrow-only deltas, no badges) | — | COSMETIC | S |

### 5.2 Agent planning / money

#### Game Plan — `gameplan-*.jsx` → `dashboard/GamePlanV2/`
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| HubBody cascade → `AllocationBar` (segmented line-split) + `MiniMonthStrip` (12 mini bars) | `PlanCascade.jsx:71-170` (numeric-only rungs) | Cascade visualizations absent | MISSING | M |
| HubBody inline "Review & Commit" card + "Before you commit" checklist | `index.jsx:399-410` (commit only in modal) | No inline commit card/checklist; single-column | MISSING | M |
| `PlanManagerBanner` + managerView — manager review of the shared plan (health checklist + "Suggest a change") | no managerView (`PlanSuggestionsCard` is agent-side receiver only) | Manager-facing plan-review UI absent (write path exists) | MISSING | L |
| 4-step rail (Money Needs · Year Plan · Monthly · Review) | `StepRail.jsx:115-144` (3 steps) | Year Plan folded into Money Needs | DELIBERATE-DIVERGENCE (PR-U1 locked) | S |

#### Money Needs (merged) — `mn-merge*.jsx`/`gameplan-money.jsx` → `agent/MoneyNeeds*.jsx`
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| Option-C 3-level disclosure (compact group-subtotals + Compact/Edit toggle + first-run adaptivity) | `MoneyNeedsPanel.jsx:203` (full accordion always) | Progressive disclosure tier absent | MISSING | M |
| CompositionBar — 5-group segmented composition spine + % chips | none | No "where the money goes" glance | MISSING | M |
| Monthly variance suggestion chips ("Book 2 more FFIs", "Convert the 3 open quotes") | `MonthlyPlanModal.jsx:318-411` (numeric tiles only) | Textual "to finish the month" chips absent | MISSING | M |
| ProductDrill BALANCED/OVER/UNDER pill + segmented sum-bar | `MoneyNeedsAllocator.jsx:100-216` (distribute-evenly + text only) | Balance viz absent | MISSING | S |
| Pre-send itemized confirm sheet | `MoneyNeedsAllocator.jsx:636-663` (writes then acks) | No confirm step | MISSING | S |
| Allocator API-first slider | commission-first (`:219-327`) | Inverted primary, same outcome | DELIBERATE-DIVERGENCE | S |

#### Goals — `goals-v2-*.jsx` → `manager/GoalsPanel.jsx` + `goals/*`
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| Goals-page celebration takeovers (annual/streak/quarter) | none (only wizard Celebration) | No Goals-surface "you hit it" moments | MISSING | L |
| Horizontal 5-node GoalCascade (Personal→Unit→Branch→SM→Company, per-node YTD bar) | `GoalsPanel.jsx:1149` renders vertical `GapAnalysisPanel` | Different cascade IA | DELIBERATE-DIVERGENCE | M |
| MinimumsStrip — persistent company-floors strip above roster | only inside `RecommendLockDrawer.jsx:198-203` | Not persistent on Agents tab | MISSING | S |
| TierGoalForm optional FFI/CI/Dials activity targets | `GoalsPanel` tier forms (API/Apps/Persistency) | Activity targets absent (medium confidence) | NEEDS-RULING | S |

Strong: recommend-vs-lock grammar, Above/Below/Not-set chips, tenure floors, sub-tabs.

#### Commission — `commission-v2-*.jsx` → `goals/CommissionPlayground/` + anchors
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| Saved scenario chips ("Coach goal / My commitment / Stretch") + Save scenario | none | No scenario save/switch | MISSING | M |
| Manager-viewing-agent "suggest a goal back" flow | `index.jsx:11` (`isManagerSelf` only) | Manager suggest-back absent | MISSING | M |
| Cadence chips include **Daily**; default weekly | `GoalDecompositionTab.jsx:15-21` (5 periods, no Day; default annual) | Daily cadence missing | MISSING | S |
| Distinct "API to settle (× settlement%)" stage | `GoalDecompositionTab.jsx:136-159` (folded into connector) | Settlement stage not first-class | MISSING | S |

Strong: `CommissionAnchorStrip` (tracks design AnchorStrip), ratio badges, "Set as my goal" confirm, `CashFlowChart`.

### 5.3 Agent tools / report / recognition / profile

#### Persistency — `persistency-v2-*.jsx` / `persistency-lab.jsx` → `agent/PersistencyTab.jsx` + `persistency/PersistencyPlayground.jsx`
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| v2 rolling/per-policy model (24-mo self-expiry, per-policy weighting, v1⇄v2 engine) | `PersistencyPlayground.jsx:11,72-89` (v1 aggregate only) | Entire v2 model unbuilt — **Tatil sign-off pending** | NEEDS-RULING | L |
| Per-policy at-risk lever list w/ reinstate toggles | `Playground:17-34` (two abstract TTD sliders) | Header states intentional "two levers per D2" | DELIBERATE-DIVERGENCE | L |
| Tenant-admin persistency-model + restatement-scope toggles | none (no Settings surface) | Unbuilt | NEEDS-RULING | L |
| "Share this plan with {agent}" coaching recommend action | `Playground:266-283` (Reset/Close only) | Manager coaching dead-end | MISSING | M |
| Focus-trap/Esc/return on Playground modal; 44px targets | `Playground:99-106,119-126` | §4 + 44px | MISSING/COSMETIC | S |

#### Policy Ledger — `app-policy-v2.jsx` → `agent/PolicyLedgerPanel.jsx` + `policyLedger/*`
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| Lens/Campaign mode — `CampaignProgressStrip`, `ContributionBadge` (COUNTS/PENDING/EXCLUDED), lens filter chips, "Export proof" (4 of 6 artboards) | `PolicyLedgerPanel.jsx:294-297` (`PipelineStrip` only, no lens) | Whole campaign-proof surface absent | NEEDS-RULING | L |
| Insured name shown when insured ≠ owner | `PolicyCard.jsx:71`, `PolicyDrillDrawer.jsx:119` | Third-party-insured name never displayed (data-visibility miss) | MISSING | S |
| Card API sub-label `API · {premium}/{freq}`; drawer WRITTEN date cell | `PolicyCard.jsx:83`, `PolicyDrillDrawer.jsx:181-186` | Premium/frequency + written-date dropped | MISSING | S |
| PolicyDrillDrawer focus-trap + initial focus + return | `PolicyDrillDrawer.jsx:60-97` (Esc only) | §4 | MISSING | M |
| History timeline (connector/dots/pills/copy) | `PolicyDrillDrawer.jsx:189-206` (plain text list) | Reduced | COSMETIC | M |

#### Production Report + Agent Report View — `prodreport-v2-*.jsx` + `agentreport-v2.jsx` → `productionReport/*` + `profile/AgentReportDocument.jsx`
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| Interactive Agent Report View (in-app report; "Report" tab in coaching drawer / Meeting Mode) | none (`grep AgentReportView` = 0) | Only a download-only PDF exists | MISSING | L |
| Designed dense `ProductionTable` (#·AGENT/UNIT avatar·APPS·NEW API mini-bar·PERSISTENCY·STATUS pill·gold top-3·zebra) | `ProductionTable.jsx` is an unrelated NB/PPP/LMPS financial breakdown | Core roster table not implemented | MISSING | L |
| "Download report" button in every role view | Agent/Unit/Branch views — none | Tab's central CTA absent; PDF only via a separate dashboard modal | MISSING | M |
| DataSourceBadge period-driven (PROVISIONAL vs SETTLED·SYNCED + dot + timestamp) | `AgentProductionView.jsx:148` hardcoded `source="estimated"` | Static "Estimated" always | MISSING | M |
| ProdTotals AVG PERSISTENCY + ON-PACE tiles | Unit `:126-142`, Branch `:136-156` | Operational-health tiles omitted | MISSING | M |
| §5 sticky header/first col + footer count on roster tables | `ProductionTable.jsx:25`, `RankedLeaderboard.jsx:40` | Not implemented | MISSING | S |

`AgentReportDocument.jsx` (react-pdf, hex-only, EXEMPT from token rules) — structure only: no header status/flag pill, no coaching-note block vs `agentreport-v2.jsx` (NEEDS-RULING; reasonable for print).

#### Prospect Prep — `prospect-*.jsx` → `agent/ProspectInfoPanel.jsx` + `manager/ProspectInfoTab.jsx` + `JointCallsTab.jsx`
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| Agent **Prospect Prep** tab | `AgentDashboard.jsx:761` renders `<ComingSoonPanel label="Prospect Prep" />`; `prospect-info` in `COMING_SOON_TABS` | Agent surface is a coming-soon stub (component exists but not wired for agents) | NEEDS-RULING | M |
| Objection **rehearsal aid** — expanded ObjectionChip (label + meaning + counter) "REHEARSE THE OBJECTIONS" | `ProspectInfoPanel.jsx:157-165` (bare label pills) | Design centerpiece absent (agent + manager views); copy is data-derivable | MISSING | L |
| NextCallHero (soonest call as hero) + ApptBadge countdown (TODAY/TOMORROW/IN N DAYS, amber-imminent) | `ProspectInfoPanel.jsx:116-128` (uniform flat cards, raw date) | No hero/countdown | MISSING | M |
| Prep list sorted soonest-first | `prospectInfoService.js:203,206` `orderBy('intendedAppointmentDate','desc')` | **Behavioral bug: desc sort buries the imminent call** (desc baked into the composite index too). *Verified.* | MISSING | M |
| Readiness "✓ Prepped / Needs prep" + prep note + Est. API + PPManagerBanner + convert-moment celebration | `ProspectInfoPanel.jsx` / `prospectInfoService.js:96-135` | Multiple fields/states absent (some CRM-adjacent → ruling) | MISSING / NEEDS-RULING | M |

#### Leaderboard — `app-leaderboard.jsx` → `gamification/Leaderboard.jsx` + `leaderboard/*` — *high conformance*
Podium (`[#2,#1,#3]`, gold champion, medal coins), period chips (tablist/aria), AroundMe cluster, MovementChip, scope control, Weekly Champions banner all present/exceed mock. Gaps: error card no Retry (`ProductionLeaderboardSurface.jsx:433-446`, MISSING S); generic pulse loading not podium-shaped (COSMETIC S); no podium stagger/bar-grow/count-up (COSMETIC M).

#### Awards — `app-awards-v2.jsx` → `awards/AgentAwardsPanel.jsx` + `awardPrimitives.jsx`
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| Provenance system — `ContributionBar` (base vs campaign), `LedgerSourceChip` ("LIVE FROM POLICY LEDGER · SYNCED"), `AwardProvenancePanel` (COUNTS / STANDALONE / pending-settlement / "how calculated") | no equivalent in `awardPrimitives.jsx`/`AgentAwardsPanel.jsx` | Whole ledger-provenance / campaign-attribution story absent (data-dependent → ruling) | MISSING / NEEDS-RULING | L |
| Pace narrative — hero "~1 week at your current pace · avg TTD 22K/wk"; drawer "YOUR PACE" block | `awardPrimitives.jsx:133-144,332-393` (gap chip only) | Pace-to-qualify narrative absent | MISSING | M |
| Loading skeleton; empty CTA; error Retry; drawer footer CTA + qualifying-window line | `AgentAwardsPanel.jsx:63-143`, drawer `:388-393` | §1 + missing footer CTA | MISSING | M |

Strong: 3-tier hero + grouped grid + drill, AwardDonut, ratio sparklines, correct gold-split.

#### Career Portal — `app-career-v2.jsx` → `profile/CareerPortal.jsx` — *high conformance*
7-level ladder (coin states, connector, drill drawer, commitment scorecards, 8-quarter trajectory) + kiosk-style `BadgeGrid` medals all present. Gaps: ladder-node dates/"N months in" absent (COSMETIC S); badges "X of Y earned · 14 in catalogue" caption absent (COSMETIC S); no stagger/bar-grow/pulse motion (COSMETIC M).

#### Settings / Profile — `profile-v2.jsx` + `settings-v2.jsx` → `profile/ProfileScreen.jsx`
Profile (`ProfileScreen.jsx`) is high-conformance (avatar+upload, edit, logging-mode+reminder, account info, sign-out; mobile sign-out here = operator-locked). **Settings v2 does not exist as a surface:**
| Design ref | Live | Gap | Class | Size |
|---|---|---|---|---|
| Consolidated Settings surface (role-scoped tabs My Preferences / Team Defaults / Account) | none | Net-new product surface | NEEDS-RULING | L |
| My Preferences → Theme + **Density**; View Defaults (default period/KPI-detail/master-sheet preset/scope); Meeting-Mode + Notifications toggles | theme = scattered toggle; density/view-defaults/notification prefs absent | Multiple prefs unbuilt | MISSING | M |
| Team Defaults → **recommend-vs-lock inheritance** cascade (Company→SM→Branch→Unit→Agent) w/ "locked from above" provenance | none | Cascade model unbuilt | NEEDS-RULING | L |

### 5.4 Manager surfaces

#### Team Dashboard — `manager-v2-*.jsx` → `dashboard/ManagerOverviewTab.jsx` + `ManagerHeroSection.jsx` + `BranchKPIStrip.jsx` + `TeamMedalsPanel.jsx`
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| **`ExceptionList` "★ Needs attention"** — exception-first triage as the **lead content** (per-agent rows: avatar, exception detail, sparkline, typed tag Below-floor/Off-pace/Gone-quiet/Persistency/Report-late, chevron→drill) | `ManagerOverviewTab.jsx:34-49` (hero→KPI→activity/medals) | The design's single most important surface is absent; nothing names at-risk agents | MISSING | L |
| `AgentDrill` coaching drawer (5 tabs Overview/Weekly/Goals/Notes/Joint-Work + `RecommendGoal`) from the dashboard | none (coaching only via MasterSheet/Compliance modal) | No dashboard drill / "recommend target" / "nudge" | MISSING | L |
| `AnchorStrip` goal **cascade bar** (FLOOR + SM markers + GOAL) + weekly pulse (API/APPS/FFI) + on-pace/attention counters + ScopeSwitch | `ManagerHeroSection.jsx:25-68` (GoalDonut + single annual bar) | Cascade story, pulse trio, counters, scope switch absent | MISSING | L |
| `KpiStrip` incl. **Active Agents** + **Persistency** cards | `BranchKPIStrip.jsx:4-9` (Compliance/API/Apps/FFI) | 2 cards missing; FFI substituted | MISSING (2) | S |
| `MyWeekPanel` (player-coach own week, "not in unit totals") | absent | No My-Week panel on dashboard | MISSING | M |
| `ChampionsPanel` ranked weekly champions (rank/initials/API) | `TeamMedalsPanel.jsx:18-65` (badge grid by count) | Champions **ranking** absent (only tally analog) | MISSING | M |

#### Master Sheet — `mastersheet-v2-*.jsx` → `manager/MasterSheet.jsx`
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| `MasterReality` bar — period/scope + inline team stats (YTD SETTLED API · THIS WEEK · ON PACE · EXCEPTIONS) | `MasterSheet.jsx:282-315` (week select + search + export) | No reality/anchor bar | MISSING | M |
| `MasterActionBar` column presets (All/Production/Recruiting/Compliance/Persistency) + "Show only exceptions" toggle | none (fixed 25-col set) | No preset/exception controls | MISSING | M |
| Rank # + gold top-3 + avatars + unit/level identity; exception-flag STATUS pill | `MasterSheet.jsx:180-205` (text name; Submitted/Draft only) | No rank/avatars/exception semantics | MISSING | M |
| §5 sticky header-top + card-scoped vertical scroll + right-aligned tabular-nums | `MasterSheet.jsx:257-259,324` | Header not `top-0`; page-level vertical scroll; non-tabular numerals (first-col sticky + footer count DO conform) | MISSING (§5) | M |

#### Compliance — `compliance-v2-*.jsx` → `manager/CompliancePanel.jsx` — *strongest-conforming; meets + exceeds*
Reality bar, exception-first not-in list + per-row Nudge + "Nudge all" (w/ cooldown + confirm), filing roster w/ StatusPill/streak, full §1 four-states (skeleton + Retry + actionable empty) all present; live **adds** a Filing⇄Plan-adoption lens, CBTT license section, unlock/view. Only gaps: no explicit ScopeSwitch (NEEDS-RULING S); coaching via notes modal not the 5-tab drill (DELIBERATE-DIVERGENCE S).

#### Policy Reconciliation — `reconcile-v2-*.jsx` → `manager/PolicyReconciliationPanel.jsx`
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| **Discrepancy taxonomy** — 8 typed flags (clean/amount/partial/status/period/duplicate/**missing**/**unmatched**) each w/ badge + tailored blurb | `PolicyReconciliationPanel.jsx:187-196` (4 states; reads ledger only, never Tatil-settled-without-ledger) | Cannot surface missing/unmatched; no typed classification | MISSING | L |
| `ReconDrawer` — side-by-side Submitted\|Tatil compare (API/Premium/Status/Period), downstream-impact ("feeds MDRT/Christmas"), actions Confirm/Dispute/Add/Match/Escalate/Resolve-with-note | `PolicyReconciliationPanel.jsx:346-421` (inline single-field confirm) | No drawer; only Confirm (+ Lapse) | MISSING | L |
| "Confirm all N clean" bulk action | none (per-policy only; Slice-2 FU noted) | No bulk confirm | MISSING (deferred) | M |

Conformant: skeleton + Retry + empty (`:245-274`); Lapse tab (beyond design). At-risk-delta hero deliberately shows pending ledger value instead (DELIBERATE-DIVERGENCE, in-code rationale).

#### Weekly WARs — `war-v2-*.jsx` → `manager/ManagerWarTab.jsx` + `TeamWarsTab.jsx` + `ManagerWarDetail.jsx`
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| `WarHeaderStrip` team stat strip (FILED x/y · TO REVIEW · NOT FILED, "due Monday 9 AM") | `TeamWarsTab.jsx:83-98` (title + week select) | No at-a-glance filed/pending counts | MISSING | M |
| `CompletionRing` (% KPIs met) on My WAR + every team row + drill | none | Core "how complete" glance absent | MISSING | M |
| `StreakDots` 8-week filing consistency; My-WAR production block (API/apps + gold FILING STREAK) | `TeamWarsTab.jsx:138-170`, `ManagerWarTab.jsx:216-315` | Consistency history + player-coach production absent | MISSING | M |
| Drill reviewer workflow: **Approve WAR / Request changes** + Leader's note | `ManagerWarDetail.jsx:61-72` (override modal only) | No approve/request-changes review | NEEDS-RULING | M |
| `WarKpiChip` actual/target progress bar + met-dot | `ManagerWarTab.jsx:384-412` (bare numbers) | KPIs render as plain numbers | COSMETIC | M |

#### Monthly Recruiting — `recruiting-v2-*.jsx` → `manager/MonthlyRecruitingTab.jsx`
Design is an 8-stage per-candidate kanban CRM; live is a 2-number monthly aggregate (candidatesAssessed + agentsContracted). Almost certainly the **no-CRM guardrail** (CLAUDE.md).
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| 8-stage pipeline board + per-candidate cards + `RecDrillDrawer` (StageTimeline, advance/log-touch) | `MonthlyRecruitingTab.jsx:177-220` (aggregate form) | Whole CRM pipeline model absent | NEEDS-RULING | L |
| `RecTargetCard` (quarterly/monthly target, CompletionRing, "1 licensed/quarter" guidance) + funnel stats strip (IN PIPELINE/NEAR HIRE/STALLED/HIRED) | none | No target/funnel surfacing | MISSING | M |

#### Campaigns — `campaigns-v2-*.jsx` → `campaigns/CampaignPanel.jsx` + `CampaignCard.jsx`
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| **Persistency gate** (≥90/85-89/80-84/<80 multiplier scaling every payout) | absent | The "quality gates the prize" mechanic unbuilt | NEEDS-RULING | L |
| Prize **tier ladder** (Bronze/Silver/Gold: API+apps min, cash+voucher) + **placement podium** (1st/2nd/3rd) | `CampaignPanel.jsx:176-182` (flat thresholds, free-text prize) | Tiers/placement/cash-voucher structure absent | MISSING | L |
| `StandingsTable` (ranked, persistency+gate pill, tier, **projected payout**) + `AwardWinners` close→**Confirm & release** flow | `CampaignPanel.jsx:40-101` (progress bars); no close flow | No ranked standings/payout/winner-confirmation | MISSING | L |
| "Counts toward annual awards" / Standalone + kiosk/meeting visibility toggles | none | No awards-rollup linkage / broadcast controls | MISSING | M |
| Rank badges use gold recognition token | `CampaignCard.jsx:42-44` hardcoded `bg-amber-500`/`bg-slate-400` | Non-token palette (gold-rule) | COSMETIC | S |

#### Team Plans + AOM
`TeamPlansRoster.jsx` (Money-Needs coaching, PR-GPM1) is a **different feature** than the `planner-manager-handoff` mockups (Planner/Scheduler team surface: booked-vs-min, kept-rate, stalled, coaching packs, escalation, capacity) — separate roadmap tracks (NEEDS-RULING, L; the Planner track is unbuilt — see §6.4). `TeamPlansRoster`/`AgentPlanDrawer`/`ManagerAwardsPanel`/`BmAtRiskPanel` are reference-grade on §1/§4. AOM: winners styled `bg-primary/10 text-primary` teal instead of **gold** recognition (`AOMCategorySection.jsx:30-44`) — gold-rule COSMETIC S; no dedicated AOM mockup exists.

### 5.5 Manager presentation + reports + money-ops

#### Meeting Mode — `meeting-v2-*.jsx` → `manager/MeetingMode.jsx` — **still v1; REDESIGN-class**
Live is the pre-redesign 3-slide slideshow (summary → per-agent 3×3 → closing). The mockup is a 14–16-step guided, exception-first stand-up. Representative MISSING rows (all L unless noted):
| Design ref | Live | Gap | Class |
|---|---|---|---|
| Phased **run of show** (14–16 steps, `MEETING_ORDER`) | `MeetingMode.jsx:168` (summary + N agents + close) | No phased deck | MISSING |
| Branch scorecard scene (WTD/MTD/QTD/YTD × API/Apps/Persistency) | absent | Missing scene | MISSING |
| Units scene (3 units side-by-side, goal bars) | absent | Missing scene | MISSING |
| Activity + Production master-sheet scenes (dense tables, floor benchmarks, BRANCH TOTAL) | absent | Missing scenes | MISSING |
| Recognition podium scene + Celebrations (birthdays/anniversaries) + Awards-within-reach | absent | Missing scenes | MISSING |
| Campaign meeting scene (projection leaderboard, qualify/placement) | absent | Missing scene | MISSING |
| Agent step: activity KPIs **vs company floor** (met/at/below tiles) + hero API 6-wk sparkline + flag taxonomy | `MeetingMode.jsx:221-321` (raw 3×3 counts, Submitted/Draft badge) | Analytical core absent | MISSING |
| Agenda rail + presenter notes/quick-actions (Leave note/Recommend/Nudge) | absent | Presenter chrome absent | MISSING (M) |
| Mobile presenter remote (on-screen-now/note/up-next/transport) | absent | No phone remote | MISSING |
| Overlay dialog semantics (role=dialog/aria-modal/focus-trap) | `MeetingMode.jsx:366` (Esc only) | §4 | MISSING (M) |

#### Kiosk Mode — `kiosk-*.jsx` → `kiosk/KioskShell.jsx` + `panels/*` (always presentation-dark)
Rotation/count-up/stagger mechanics are conformant (richer than the demo). Gaps are the theatrical surface, podium IA, and three whole panels:
| Design ref | Live | Gap | Class | Size |
|---|---|---|---|---|
| Theatrical `#0E0B07` surface + blob field + vignette + glass cards | `KioskShell.jsx:110` (app `.dark` `#1a1612`, flat `bg-card`) | Renders ordinary dark dashboard, not a scoreboard | DELIBERATE-DIVERGENCE / MISSING | L |
| Unified leaderboard **hero 3-up podium** (elevated champion, medal coins, halos, labels) + WK/MTD/QTD/YTD chip selector | `PeriodLeaderboardsPanel.jsx:53-73` + `TVRankedLeaderboard.jsx:85-116` (two flat lists) | No podium centerpiece | MISSING | L |
| **Campaign leaderboard panels** (design's headline new feature) + "Show on kiosk" toggle | not in `PANEL_COMPONENTS` (`KioskShell.jsx:24-38`) | Whole panel + config absent | MISSING | L |
| Birthdays/Anniversaries panel; Branch Noticeboard panel(s) | absent | Two whole panels absent | MISSING | L/M |
| Per-slide enable/disable manager config; empty-panel skip; position/chapter overlay | `kioskConfig.js:18-32` (static); `KioskShell.jsx:78-85` (no skip) | Config/skip/overlay absent | MISSING | M |
| Gradient coin medals; AOM per-category identity; branch-overview progress bar + context | flat Lucide icons; generic `text-primary`; 4 flat KPI cards | Recognition theming thin | MISSING/COSMETIC | M |

Functional note: `KioskShell.jsx:51-59` degrades `getKioskTenantUsers`→`[]` on the un-granted list rule, so names fall back to "Agent" and photos drop across the whole kiosk (banked in SEC-012 FUs).

#### Reports — `prodreport-v2-*.jsx` + `pdf-*.jsx` → `productionReport/*` + `ui/ReportRangeModal.jsx`
Agent in-app view is strong; every downstream **deliverable** is missing:
| Design ref | Live | Gap | Class | Size |
|---|---|---|---|---|
| Refined **Agent PDF** (cover + 3 pages: snapshot / activity-vs-floor / trajectory / career-awards-coaching) | `AgentReportDocument.jsx` (old 2-page) | Unrefined | MISSING | L |
| **Branch PDF** (cover, branch totals, unit rollup, roster, compliance/top/at-risk) | `exportService.js:65` `exportBranchCSV` (raw 15-col CSV) | Still the CSV the design replaces; no PDF | MISSING | L |
| **Unit PDF** | none | Absent | MISSING | L |
| "Download report" button in every role view | none | Tab's central CTA absent | MISSING | M |
| Dense ranked roster table (persistency col, per-row API bar, status pill, zebra) | `RankedLeaderboard.jsx` (simple list) | Not implemented | MISSING (DIVERGED) | L |
| Four-states + partial-failure banner; DataSourceBadge period-driven; ProdTotals persistency/on-pace | see §4.1; `DataSourceBadge` hardcoded | §1 unmet; swallowed failures | MISSING | M |
| SM cross-branch agency view | `ProductionReportTab.jsx:6-14` (SM → Branch view) | No agency view (Phase 9) | NEEDS-RULING | L |

#### Settlements + Financing (Track K) — most conformant in the batch
K4 waterfall, K10a unit roster, K6 reconciliation, K1 terms machine, K7 miss-monitor, K10b escalation all strongly built. Gaps:
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| K9 self-view glass **`PaydownArcHero`** (running-balance SVG arc-to-zero: actual solid + projected dashed, now/clear dots) — locked Option-A centerpiece | `FinancingSelfView.jsx:261-275` (plain terms Card; no glass, no arc) | The one thing the screen exists to give (trajectory + end date) is absent | MISSING | L |
| K8 Agent Validation Dashboard (FinancingStatusHero, QuarterlyBonusTracker, MonthlyFinancingCard, embedded waterfall) | none (never built) | Whole agent-facing dashboard missing | MISSING | L |
| **K7 BM financing roster** (fan-out, per-agent status chips, aggregate cards, override table) | `FinancingRiskPanel.jsx:246-273` (single-agent dropdown; comment concedes it) | No BM "who's at risk in my branch" view | MISSING | L |
| K9 BonusQualificationCard progress tracks + gold payoff band; DrawThisMonth proration card; WhatYouKeep hero; in-flight YearEndReconProjection | `FinancingSelfView.jsx:277-400` (boolean pills; recon gated on reconciled status) | Forward-looking money framing thin | MISSING | M |
| Settlements dense-table conventions (sticky, tabular-nums, live count) | `SettlementPanel.jsx:506-565` | Pre-v2 table | COSMETIC | M |

### 5.6 Admin / shell / system

#### Admin Dashboard — `TenantAdminDashboard.jsx` + `admin/RoleDistributionCard.jsx` + `BranchHealthCards.jsx`
No admin-specific mockup; judged against App-Layout rules + §1. StatCard is a compact scorecard (conforms). Gaps: all 3 fetches `console.error`-only, no inline error/Retry, no skeleton (tiles stuck at `—`) (`TenantAdminDashboard.jsx:102-193`, MISSING M); RoleDistribution/BranchHealth loading = text not skeleton (COSMETIC/MISSING S); no exception-lead block (App-Layout "needs-attention leads home" — NEEDS-RULING M, admin may be exempt).

#### Branches — `admin/BranchesPanel.jsx` + modals
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| §4 `DeactivateBranchConfirmDialog` dialog semantics | `DeactivateBranchConfirmDialog.jsx:15-93` (no role/aria-modal/trap/Escape/return; 32px close) | The one modal with zero dialog a11y (siblings do it right) | MISSING | M |
| §5 dense sticky table + footer stat count | `BranchesPanel.jsx:243-337` (card-list, non-sticky, no count) | Not a table | MISSING | M |
| §1 error Retry (reload exists unwired at `:83`) | `BranchesPanel.jsx:219-241` | No Retry; error+empty render together on load fail | MISSING | S |

Positive: `BranchEditorModal.jsx` is a reference dialog; both bulk-import modals implement the §1 **partial-failure** contract well.

#### All Users — `usermgmt-v2.jsx` → `manager/UserManagementPanel.jsx` + `EditUserDrawer.jsx`
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| Dense zebra roster table (scroll-in-card, sticky header/first col) | `UserManagementPanel.jsx:603-623` (card-list) | Not a table | MISSING | L |
| USERS/ACTIVE/INACTIVE stat strip + **search box** + **role filter chips** (All/Agents/Managers/CRO) | `:536-548` (mono header + binary inactive toggle) | Stat block/search/role-filter absent | MISSING | M |
| RoleChip color pills; BRANCH·UNIT column; STATUS pill; LAST-activity relative time; avatar status dot | `:604-637` (plain role text; no branch/unit; "Joined" not last-active) | Roster identity columns absent | MISSING | M |
| Drawer: commission-rate field; activity-standard override; "Reset password" footer; focus-trap/return | `EditUserDrawer.jsx:518-618,881-893` | Fields + §4 machinery absent | MISSING | M |

Positive: `UserManagementPanel` is the one admin surface with reference-grade §1 (skeleton + Retry, `:577-594`); intentional extras (typed-confirm, invite menu, bulk-import) beyond mock.

#### Company Config suite — `settings-v2.jsx` → `admin/CompanyConfigPanel.jsx` + panels/modals
| Design ref | Live | Gap | Class | Size |
|---|---|---|---|---|
| Consolidated tabbed Settings surface + **recommend-vs-lock inheritance** (`LockChip` "LOCKED BY X") | 6 separate panels/modals; no provenance model | settings-v2's core idea entirely absent | NEEDS-RULING | L |
| §4 `PlanCatalogModal` focus machinery + tab semantics + focus rings | `PlanCatalogModal.jsx:185-229` | Dialog a11y absent (siblings do it) | MISSING | M |
| §1 skeleton (not spinner) + error Retry across CompanyConfig/ActivityStandards/AwardsRuleset/PlanCatalog | `AwardsRulesetPanel.jsx:624`, `PlanCatalogModal.jsx:239`, etc. | Spinners/em-dash loads; no Retry | MISSING | M |
| Persistency calc-model (v1/v2) + restatement-scope controls | `CompanyConfigPanel.jsx:90-96` (display-only floor) | Model controls absent | NEEDS-RULING | M |

Positive: `EditConfigModal`/`ActivityStandardsModal` full §4 contract; AwardsRuleset footer counts + accordions.

#### Login / System states / Onboarding — `auth-v2.jsx` + `System Screens.html` → `auth/LoginScreen.jsx`, `App.jsx`, `onboarding/*`
| Design ref | Live path:line | Gap | Class | Size |
|---|---|---|---|---|
| Onboarding wizard steps (Identity/Profile/Goals/MoneyNeeds/GamePlan) | **no container renders them**; no importer of `onboarding/steps` (verified) | Step components **built but apparently unwired** | NEEDS-RULING | M |
| Login: Caps-Lock warning; help footer "Contact your manager" + "Secured by Tatil Life" trust line; carded error | `LoginScreen.jsx:198-259` | Trust/help affordances + carded error absent | MISSING/COSMETIC | S |
| Onboarding tour dialog a11y + per-slide themed icons | `WelcomeScreen.jsx:56-75` (no dialog/trap; same logo all slides) | §4 + iconography | MISSING | M |
| Offline banner; 404 state | `App.jsx` (none; app not route-based) | Also absent from mockup | NEEDS-RULING | S |

Strong: animated login backdrop + glass card + eye-toggle (44px); `ChunkLoadErrorBoundary` (themed Reload, `role="alert"` — load-failure done right); `ReloadPrompt` (persistent update banner, `aria-live`, 44px); `PlatformAdminStubScreen`/`ProvisioningScreen` actionable.

Emails (`functions/email-templates/*`) are server-rendered HTML, **out of this frontend audit's scope** (and the brief bars touching `functions/`); the migration plan tracks them as "Port/verify."

---

## 6 · Prioritized MISSING backlog

Grouped by impact; sized S/M/L. NEEDS-RULING items are decisions (§7), not sequenced here. Suggested sequence favors **pilot-critical operator/manager flows and the systemic contract debt** before net-new surfaces.

### Tier 0 — Systemic contract debt (do FIRST; touches most screens, cheapest per-screen, biggest reliability win)
1. **§1 four-states sweep** (L, phased) — add Retry to every error card; replace spinners/text with `PanelSkeleton`; replace "No data" with actionable empties; add partial-failure banners; **kill the silent `console.error`/`.catch(()=>[])` swallows** (TenantAdminDashboard, CampaignPanel, Production views) — these mask production bugs. Copy the reference implementations (UserManagementPanel, CompliancePanel, bulk-import). *Highest reliability ROI.*
2. **§4 dialog-a11y fixes** (M) — apply `useFocusTrap` + Escape + focus-return to DeactivateBranchConfirmDialog, PlanCatalogModal, WelcomeScreen, PolicyDrillDrawer, PersistencyPlayground, EditUserDrawer, MeetingMode overlay.
3. **§5 dense-table pass** (M) — sticky header-top + card-scoped vertical scroll + right-aligned tabular-nums + footer counts on MasterSheet, ProductionTable/RankedLeaderboard; convert All-Users + Branches from card-lists to tables.
4. **§2 count-up/stagger** (S–M) — count-up on hero/KPI numerals; stagger non-dashboard screens.
5. **Prospect Prep sort bug** (S) — `orderBy('intendedAppointmentDate','asc')` so the imminent call surfaces (needs the composite index flipped to asc — deploy-gated).

### Tier 1 — Nav (priority) + core manager decision surfaces
6. **Desktop sidebar drag-reorder** (M) — operator-confirmed; the last unbuilt §3 personalization increment (pointer + long-press, persist via existing `usePinnedNav`-style storage).
7. **Admin ＋/create sheet** (M) — wire `QuickAddMenu` for tenant-admin with branch/user create actions.
8. **Team Dashboard exception-first lead + agent-drill** (L) — the design's most important manager surface (Needs-attention list + coaching drawer); today managers can't see/route to at-risk agents from home.
9. **Master Sheet control layer** (M) — reality bar + column presets + exceptions toggle + exception-status pills.
10. **Weekly WARs completion/consistency layer** (M) — completion ring + filing-streak + team stat strip.

### Tier 2 — Missing deliverables & feature depth (pilot-visible)
11. **Reports PDF deliverables + Download buttons** (L) — refined Agent PDF, Branch/Unit PDFs, per-view Download; the artifacts managers hand upline.
12. **History drill reskin + edit path** (M) — action-oriented drawer; draft/unlocked → wizard.
13. **History filters + heatmap enrichments** (M).
14. **Awards pace narrative** (M) + provenance system (L, data-dependent → ruling).
15. **DeliveryStripCard** (M) — un-stub "Policies to deliver" + clawback clock (pairs with CRO clawback model).
16. **Financing K9 PaydownArcHero + K7 BM roster** (L) — the self-view centerpiece + branch-level risk view.

### Tier 3 — Net-new / REDESIGN-class surfaces (largest; several are decisions)
17. **CRO / back-office** (L, net-new) — route the role + Delivery Register + 30-day clawback clock.
18. **Planner (agent)** + **Team Planner (manager)** (L, net-new) — un-gate + build.
19. **Meeting Mode v2** (L, REDESIGN-class) — the 14–16-scene run-of-show.
20. **Kiosk v2 theatrical scoreboard + podium + campaign/birthday/noticeboard panels** (L, REDESIGN-class).
21. **Settings v2 consolidated surface** (L, mostly a ruling).
22. **Interactive Agent Report View** + **Policy Ledger campaign-proof lens** (L each, data-dependent → rulings).

---

## 7 · NEEDS-RULING list (operator decisions)

These are valid design elements the app lacks, but building them is a scope/product/architecture call — surface, don't assume:

1. **Command palette (⌘K)** — build the DS `CommandPalette`, or is the deliberate no-op search the accepted state? (§3.2)
2. **Persistency v2 rolling/per-policy model** — Tatil sign-off pending; the entire v2 engine + tenant-admin model toggle is gated on that (§5.3).
3. **Policy Ledger campaign-proof lens** (4 of 6 artboards) + **Awards provenance system** — both depend on campaign-attribution data; build now or defer? (§5.3, §5.3-Awards)
4. **Interactive Agent Report View** — build the in-app report / coaching-drawer "Report" tab, or keep download-only PDF? (§5.3)
5. **Settings v2 consolidated surface + recommend-vs-lock team-defaults cascade** — net-new product surface; in-scope for pre-pilot? (§5.3, §5.6)
6. **Monthly Recruiting kanban CRM** — the design is a per-candidate pipeline; live is an aggregate. Confirm this is the **no-CRM guardrail** (CLAUDE.md) and the aggregate is intentional. (§5.4)
7. **Campaigns persistency-gate + prize-tier + winner-confirm/payout model** — money-adjacent; how much of the Christmas-Campaign mechanic to build? (§5.4)
8. **WARs reviewer workflow** (Approve / Request changes) — build a review gate, or is the override modal the intended model? (§5.4)
9. **Team Planner (manager) vs live Team Plans (Money Needs)** — the `planner-manager` mockups are a *different* track than the shipped consent-shared Money-Needs reader; confirm both are intended as separate surfaces. (§5.4)
10. **Agent Prospect Prep tab** — currently coming-soon-gated (`ComingSoonPanel`) though `ProspectInfoPanel` exists; un-gate for agents, or keep the manager-side Joint-Call Prep only? (§5.3)
11. **Onboarding wizard steps built-but-unwired** — verify whether `WizardIdentity/Profile/Goals/MoneyNeeds/GamePlan` are intended (dead code to remove, or a flow to wire)? (§5.6)
12. **SM cross-branch views** (Reports agency view, Meeting/Kiosk cross-branch) — deferred to Phase 9 per CLAUDE.md; confirm still post-pilot. (§5.5)
13. **Kiosk theatrical surface** — adopt the `#0E0B07` scoreboard treatment, or keep the app-`.dark` look (a defensible divergence given the shared token system)? (§5.5)
14. **Admin exception-lead home** — does the App-Layout "needs-attention leads home" rule apply to the tenant-admin dashboard, or is admin exempt? (§5.6)

---

## 8 · Rule 23 — design evidence for the top-3 MISSING gaps (false-positive check)

For each, the concrete design evidence that establishes it as **intended** (so a wrong call can be caught):

1. **Desktop sidebar drag-reorder is intended.** `redesign-addendum.md:96-97` states verbatim: "Sidebar items are **drag-reorderable** (pointer + long-press touch fallback), persisted." The addendum is the highest-precedence app-rules source ("this file wins for app surfaces"). The brief independently records it as operator-confirmed real intent. *Falsifier:* if the operator says Pinned + workspace-toggle was accepted **in lieu of** reorder, this drops to DELIBERATE-DIVERGENCE. (The shipped nav-redesign PR-1→4 never scoped reorder, so it is not "done differently" — it is simply not built.)

2. **The four-states contract is intended on every data surface.** `redesign-addendum.md:40-65` §1 makes loading/empty/error/partial mandatory ("No screen may assume happy-path data. Every surface that fetches renders through four states"), and §6 lists "No spinners where a skeleton fits · No 'No data' dead ends · No error toasts for load failures" as hard anti-patterns. The Master Build Reference + repo-reconciled plan both repeat "Loading/empty/error present" in the per-screen definition-of-done. The app *already* ships reference implementations (UserManagementPanel, CompliancePanel, bulk-import), proving the contract is real and achievable — the gaps are omissions, not a different design. *Falsifier:* none plausible; this is a written hard rule with in-repo exemplars.

3. **Team Dashboard's exception-first "Needs attention" lead is intended.** `manager-v2-shared.jsx` defines `ExceptionList` with the typed-tag taxonomy (Below floor / Off pace / Gone quiet / Persistency / Report late) and `manager-v2-scenes.jsx:40-60` composes the manager home as **exception-lead (1.55fr) | my-week+champions (1fr)** with the greeting "N agents need attention before stand-up"; `manager-v2-drill.jsx` defines the `AgentDrill` coaching drawer + `RecommendGoal` the exceptions route into. This is the scene's headline composition, not an optional widget. *Falsifier:* if the operator has deliberately moved triage to Compliance/MasterSheet (where nudge/coaching partially live today) and wants the dashboard to stay a summary, this becomes a DELIBERATE-DIVERGENCE — worth confirming, since Compliance *does* already carry an exception-first nudge list.

---

## 9 · Known gaps in this audit (Rule 22)

This recon is bounded; the following were not fully covered and should temper confidence:

- **`.html` composed mockups were largely not opened** — the auditors read the richer `.jsx` scene modules (which carry the `.intro` intent, per the Track-J method). Where an `.html` mockup diverges from its `.jsx` sibling, that delta is uncaptured.
- **`src/index.css` utility internals not read** — a few "not mono / not tabular / not `--skeleton`" cosmetic calls are inferred from JSX class usage and soften if the CSS supplies the styling. (The load-bearing structural findings — sticky header, card-scoped scroll, missing sections/controls/states — were read from source and several independently verified.)
- **Onboarding wizard "unwired" is a strong claim on a targeted grep** — `<WizardIdentity>` etc. and any `OnboardingWizard`/`OnboardingFlow` container returned 0 hits, and no file imports `onboarding/steps`, but a differently-named render path is conceivable. Marked NEEDS-RULING (verify) rather than asserted dead.
- **Mobile scene parity** was audited at the scene-wrapper level for several screens (Game Plan, Commission, Goals, Recruiting, Campaigns mobile), not per-widget reflow.
- **Motion conformance judged from class usage** (`a-fade-up`/`screen-enter`/count-up greps), not runtime rendering — a screen may inherit `screen-enter` from a content wrapper even where per-block stagger/count-up are absent.
- **Emails and `functions/`** were intentionally out of scope (pure-frontend audit; brief bars `functions/`). The migration plan tracks emails separately as "Port/verify."
- **AOM, JointCallsTab, Settlements** have **no dedicated 1:1 mockup** — judged against the recognition-grammar / dense-table / four-states rules, not a screen-specific diff, so those rows are rubric-based rather than mockup-diffed.
- **Classification counts are curated, not a census** — low-value cosmetic micro-drift is summarized; the ~counts are representative of material findings in this report.
- **`DailyEntryModal.jsx`** may be a legacy secondary path; its routed status was not confirmed (NEEDS-RULING).
