# Design-System Folder Catalog

> ## RECONCILED PRECEDENCE RULE (read this first)
>
> - **Top-level `docs/design-system/`** (root `tokens/`, `guidelines/`, `components/`, `ui_kits/`, `templates/`, `assets/`, `readme.md`) = canonical for **token values + rules** (the unpacked DS export).
> - **`screens-v2/*.html` mockups** = canonical for **design INTENT** (the "design source of truth" per the Reference Index).
> - **`.jsx` scene modules / the `_ds` embedded kit / build-handoff bundles** = **REFERENCE** — authoring/render support, not spec sources in their own right.
> - **Staging copies + superseded slices** (DS-audit HTMLs, embedded DS snapshots proven to drift, packaged-then-abandoned handoff wrappers) = **HISTORICAL**.
> - **TIEBREAKER:** if a build-handoff or embedded-kit file disagrees with a `screens-v2/*.html` mockup or the root `tokens/`, **the mockup wins for looks, the root repo wins for schema/values.** Never resolve a disagreement in favor of a `.jsx` scene, an embedded `_ds`/`design-system*` snapshot, or a handoff wrapper.

**Purpose.** `docs/design-system/` mixes generations — the current canonical redesign lives beside superseded migration plans, embedded design-system snapshots, and authoring-only demos. Prior build sessions repeatedly lost time deciding which file was authoritative. This catalog is the **map**: for every file or logical group it records what the thing is and whether a builder should **build toward it (CANONICAL)**, **ignore it as superseded (HISTORICAL)**, **use it as supporting material only (REFERENCE)**, or **ask the operator (UNCLEAR)**.

It is a classification map, **not** a spec read — it does not summarise design intent. For design intent, open the canonical mockups themselves.

> **Precedence (operator-set, original wording).** For **app** surfaces: `guidelines/redesign-addendum.md` wins on rules → the `screens-v2/` per-screen `.html` mockups (+ their `.jsx` scene sources) are the canonical **design intent** → `tokens/*.css` are the canonical **values**. The folder's own [`screens-v2/AgencyTrack - Claude Code Reference Index.md`](screens-v2/AgencyTrack%20-%20Claude%20Code%20Reference%20Index.md) calls the redesigned mockups the *"design source of truth"* (line 39). Pre-2026-redesign material (the `DS Audit & Migration Plan` HTMLs — the v2 self-marks **"⚠ SUPERSEDED"** — and early Zoho/Perplexity/Gemini ideation inputs) is historical. See also [`CLAUDE.md` → Theme System → Canonical sources & precedence]. The reconciled rule above folds this into the four-tier CANONICAL/REFERENCE/HISTORICAL split used by the rest of this catalog and adds the explicit mockup-vs-schema tiebreaker.

**Folder dedupe pass (this catalog revision).** A salvage-then-verify-then-delete pass resolved 4 of the UNCLEAR duplicate pairs below (planner handoffs, Game-Plan-loop handoffs, Track K financing self-view, the embedded `redesign-addendum.md` copy) and surfaced 3 new UNCLEAR items (a stray repo-code snapshot, an unverified second embedded DS bundle, an unverified packed DS bundle). See the UNCLEAR table for disposition of all 7.

**Scale note.** 1,244 tracked files, but most are non-design noise: web-font families under `uploads/**_Complete/`, `assets/fonts/`, and `.woff/.woff2` bundles; plus PNG/JPG screenshots under `screens-v2/{screenshots,mockups,scraps,sh,gen,og}/`. Those are classified by group below, not enumerated per file.

---

## How the folder is organised (two layers)

1. **The Nexus DS bundle** — everything at the `docs/design-system/` **root** (`tokens/`, `guidelines/`, `components/`, `ui_kits/`, `templates/`, `assets/`, `readme.md`, `STYLE-GUIDE.html`, `SKILL.md`, `styles.css`, `_ds_*`). This is the unpacked design-system export — the source of canonical **token values + rules + specimens**.
2. **The redesign mockups project** — everything under `screens-v2/`: the per-screen `.html` mockups, their sibling `.jsx` scene modules, the build-handoff bundles, and **embedded copies** of the DS bundle used only so the mockups render in place (`screens-v2/_ds/`, `screens-v2/design-system/`, `screens-v2/design-system-update/`).

The embedded copies are the main trap: they look like design-system sources but are authoring snapshots. The **root** `tokens/` + `guidelines/` are canonical; the `screens-v2/**` copies are reference snapshots that can drift.

---

## CANONICAL — build toward these

| Path / group | Type | Notes |
|---|---|---|
| `guidelines/redesign-addendum.md` | guideline .md | ★ **Top precedence for app rules** (state design, motion, nav, a11y, dense tables + token-reconciliation table). Cited by CLAUDE.md. Wins over `readme.md` and over any nav shown in the UI-kit demos. |
| `tokens/{app,brand,fonts,glass,marketing}.css` | token .css | Canonical token **values**. `app.css` cited by CLAUDE.md as the v2 reconciliation. |
| `screens-v2/AgencyTrack <Screen> v2.html` (the ~40 per-screen app mockups) | mockup .html | **Canonical design intent** — the "design source of truth." One per app screen (see screen→mockup index below). Excludes the 2 DS-audit HTMLs, the marketing `AgencyTrack Website.html`, and the `- Build Handoff` / `- Master Build Reference` / `- Reference Index` files. |
| `screens-v2/*.jsx` (scene modules: `gameplan-*`, `goals-*`, `meeting-*`, `app-*`, `kiosk-*`, etc.) | scene .jsx | Modular **render source** of the canonical mockups — the `.html` files reference these siblings (+ `doc-page.js`, `image-slot.js`, `theme.jsx`). Only render in place with the embedded `_ds/` bundle. |
| `screens-v2/AgencyTrack Prototype.html` | mockup .html | The composed, navigable prototype wiring the screens together. |
| `readme.md` · `STYLE-GUIDE.html` · `SKILL.md` | guideline / style-guide / skill | Nexus DS foundation: narrative brief, living style guide (both themes), agent-skill entry. Foundational — but `redesign-addendum.md` wins for app rules where they differ. |
| `guidelines/{colors-*,type-*,spacing,radii-elevation,motion,glass,logo,data-conventions}.html` | guideline .html | Foundation **specimen cards** (exact color/type/spacing/motion values). Canonical reference for foundations. |
| `INTEGRATION.md` · `gold-split-audit.md` · `skeleton-kit.md` | decision-record .md | Current integration/decision records; `INTEGRATION.md` + `gold-split-audit.md` are cited by CLAUDE.md. |
| **Build-handoff bundles** (net-new / in-flight surfaces) — `screens-v2/design_handoff_v2_app/`, `screens-v2/design_handoff_track_k/`, `screens-v2/design_handoff_financing_selfview/`, `screens-v2/gameplan-loop-handoff/`, `screens-v2/money-needs-allocator-handoff/`, `screens-v2/nav-quickactions-handoff/`, `screens-v2/agencytrack-planner-handoff/`, `screens-v2/design_handoff_sheet_celebrations_planner/`, `screens-v2/design_handoff_company_config/` | build-handoff (spec + kickoff + mockups) | Current handoffs the Reference Index points to for **net-new / not-yet-routed** builds (CRO, Planner agent + manager, Game-Plan loop, Money-Needs allocator, Nav options, Track K financing). `agencytrack-planner-handoff/` is now the single planner handoff (both tiers, `1-agent-planner/` + `2-manager-planner/`) — `planner-build-package/`, `planner-scheduler-handoff/`, and `planner-manager-handoff/` were confirmed byte-identical duplicates and deleted in the dedupe pass (their 2 unique top-level docs were salvaged in first). `design_handoff_financing_selfview/` is kept alongside `design_handoff_track_k/` per operator direction — see UNCLEAR resolution below. `design_handoff_sheet_celebrations_planner/` (added 2026-07-10) is the **funnel-edition Master Sheet + celebration surfaces + planner recurrence** handoff; for the **Master Sheet surface it supersedes** the `mastersheet-v2-*` set (see HISTORICAL). |
| `screens-v2/AgencyTrack - CRO Build Handoff.html` · `screens-v2/AgencyTrack - Planner & Scheduler Build Handoff.html` · `screens-v2/Planner & Scheduler - Unified Claude Code Kickoff.md` · `screens-v2/Persistency v2 - Model Change Analysis & Spec.html` | build-handoff / spec / prompt | Top-level handoffs + specs for the three real net-new builds + the persistency model-change spec. |

### Screen → mockup index (canonical mockups)

All at `screens-v2/` root, named `AgencyTrack <Screen> v2.html`. Find the mockup by screen, then its repo component via the Master Build Reference (REFERENCE, below).

**Agent surfaces**
| Screen | Mockup file | Repo component (approx) |
|---|---|---|
| Agent dashboard | `AgencyTrack Agent Dashboard v2.html` | `dashboard/AgentDashboard` |
| Daily capture | `AgencyTrack Daily Capture v2.html` | daily-input surface |
| Weekly wizard | `AgencyTrack Weekly Report Wizard v2.html` | `wizard/WizardForm` |
| Game Plan | `AgencyTrack Game Plan v2.html` (+ `gameplan-loop-handoff/`) | planner / Game-Plan loop |
| Goals | `AgencyTrack Goals v2.html` | `goals/GapAnalysisPanel` |
| Commission | `AgencyTrack Commission v2.html` | `goals/CommissionPlayground` |
| Persistency | `AgencyTrack Persistency v2.html` · `AgencyTrack Persistency Playground v1-v2.html` | `manager/PersistencyPanel` |
| Policy ledger | `AgencyTrack Policy Ledger v2.html` | `PolicyLedgerPanel` |
| History | `AgencyTrack History v2.html` | history surface |
| Production report | `AgencyTrack Production Report v2.html` | production report |
| Agent report (PDF view) | `AgencyTrack Agent Report View v2.html` | `profile/AgentReportDocument` |
| Leaderboard | `AgencyTrack Leaderboard.html` | `gamification/Leaderboard` |
| Agent awards | `AgencyTrack Agent Awards v2.html` | `awards/AgentAwardsPanel` |
| Career portal | `AgencyTrack Career Portal v2.html` | `profile/CareerPortal` |
| Prospect prep | `AgencyTrack Prospect Prep v2.html` | prospect prep |
| Settings | `AgencyTrack Settings v2.html` | settings |

**Manager / admin / shell**
| Screen | Mockup file | Repo component (approx) |
|---|---|---|
| Manager dashboard | `AgencyTrack Manager Dashboard v2.html` | `dashboard/ManagerDashboard` |
| Master sheet | `design_handoff_sheet_celebrations_planner/mockups/AgencyTrack Master Sheet Funnel.html` (funnel edition, current) — supersedes `AgencyTrack Master Sheet v2.html` + `mastersheet-v2-{matrix,scenes}.jsx` for this surface | `manager/MasterSheet` |
| Compliance | `AgencyTrack Compliance v2.html` | `manager/CompliancePanel` |
| Policy reconciliation | `AgencyTrack Policy Reconciliation.html` | reconciliation surface |
| Weekly WARs (manager) | `AgencyTrack Weekly WARs.html` | Track-I manager WAR |
| Monthly recruiting | `AgencyTrack Monthly Recruiting.html` | recruiting |
| Campaigns | `AgencyTrack Campaigns.html` | `campaigns/CampaignPanel` |
| Manager reports / Branch / Reports | `AgencyTrack Manager Reports.html` · `AgencyTrack Branch Report.html` · `AgencyTrack Reports.html` | reports/exports |
| Meeting mode | `AgencyTrack Meeting Mode v2.html` | `manager/MeetingMode` |
| Kiosk mode | `AgencyTrack Kiosk Mode.html` | kiosk |
| App layout / mobile / nav | `AgencyTrack App Layout.html` · `AgencyTrack App Mobile.html` · `AgencyTrack Mobile Nav.html` | app shell / mobile nav |
| System screens / Emails | `AgencyTrack System Screens.html` · `AgencyTrack Emails.html` | system / `functions/email-templates` |
| Logo / glass / motion lab | `AgencyTrack Logo - Glass & Motion Lab.html` | logo + glass + motion specimens |

**Net-new builds (not yet routed in the app)**
| Build | Mockup / handoff | Notes |
|---|---|---|
| CRO / back-office | `AgencyTrack CRO.html` + `AgencyTrack - CRO Build Handoff.html` | Role not routed; Delivery Register + 30-day clawback clock are new. |
| Planner (agent) | `agencytrack-planner-handoff/1-agent-planner/` + `Planner & Scheduler Build Handoff.html` | `planner` tab gated coming-soon in `navConfig.js`. Path updated post-dedupe — was `planner-scheduler-handoff/` (deleted, confirmed duplicate). |
| Team Planner (manager) | `agencytrack-planner-handoff/2-manager-planner/` | Coaching tier; trust constraints at the rules layer. Path updated post-dedupe — was `planner-manager-handoff/` (deleted, confirmed duplicate). |
| Track K financing | `design_handoff_track_k/` (+ `design_handoff_financing_selfview/` for the K9 Self-View / Unit Financing narrative) | Financing self-view + terms setup + monthly statement entry. |
| Company Config (tenant admin) | `design_handoff_company_config/` (added 2026-07-11) | Tenant-admin Company Config surface — registry-driven 12-section config with diff-only storage, five-state row grammar, ⌘F palette, audit history. README.md is the spec; `Company Config Prototype.html` + `cc-proto-*.jsx` are the acceptance criteria. **Seeded VALUES in the prototype are fictional** — real defaults come from `docs/audits/company-config-recon-2026-07-11.md` + `docs/audits/tenant-config-audit-2026-07-10.md`. Its `_ds/` embedded render kit is **gitignored** (second token copy; canonical DS is `tokens/`). |

---

## HISTORICAL — superseded, do not build toward

| Path / group | Type | Why historical |
|---|---|---|
| `screens-v2/AgencyTrack App - DS Audit & Migration Plan v2 (Repo-Reconciled).html` | migration-plan | **Self-marked in-file: "⚠ SUPERSEDED as the authoritative plan — retained…"**. The reskin it planned is largely shipped; kept for audit trail only. |
| `screens-v2/AgencyTrack App - DS Audit & Migration Plan.html` | migration-plan | The v1 migration plan (superseded by the v2 above, which is itself superseded). |
| `screens-v2/uploads/*.md` ideation inputs — `Zoho CRM Interface Design Resources*`, `Zoho CRM NextGen Mobile*`, `AgencyTrack UI_UX Recommendations…Zoho Design Philosophy*`, `Perplexity/Perlexity UI Recommendation*`, `agencytrack-gemini-spec.md`, `AgencyTrack Technical Specification…` | research inputs | Pre-2026-redesign ideation/inspiration; superseded by the shipped Nexus v2. Reference for archaeology, not intent. |
| `screens-v2/AgencyTrack Master Sheet v2.html` · `screens-v2/mastersheet-v2-matrix.jsx` · `screens-v2/mastersheet-v2-scenes.jsx` (+ the copies under `design_handoff_v2_app/mockups/`) | mockup + scene .jsx | **Superseded for the Master Sheet surface** (2026-07-10) by the funnel edition in `design_handoff_sheet_celebrations_planner/` (`AgencyTrack Master Sheet Funnel.html` + `mastersheet-funnel-{data,table,scenes}.jsx`). Exception: `mastersheet-v2-shared.jsx` (reality bar, roster, flag pills) stays REFERENCE — the funnel set reuses it as a render dependency and ships its own embedded copy. |

> The two DS-audit HTMLs are the **classic trap**: they sit at `screens-v2/` root beside canonical mockups and are even linked as "start here" from the Reference Index, but the v2 file explicitly self-marks superseded. Do not treat them as the current plan.

---

## REFERENCE — supporting/authoring material, NOT the app spec

| Path / group | Type | Notes |
|---|---|---|
| `screens-v2/AgencyTrack - Master Build Reference.html` | build-index | The live screen→mockup→repo-component→status map (35 Shipped / 8 Verify / 11 Build). **Load-bearing navigation index** — points at the canonical mockups; not itself design intent. |
| `screens-v2/AgencyTrack - Claude Code Reference Index.md` | reference-index | The folder's own read-in-this-order guide. Start here to navigate. |
| `components/{core,app,icons}/*.{jsx,d.ts,prompt.md}` + `*.card.html` | UI-kit component + prompt | DS **authoring** component kit (Button, Card, Scorecard, GlassCard, Sidebar, CommandPalette, MobileMore, …) with per-component `.prompt.md` build prompts. Authoring source — the app styles against `src/index.css`, not these. ⚠ Contains authoring-only nav demos — see TRAPS. |
| `ui_kits/nexus/`, `ui_kits/marketing/` | UI-kit demo | Rendered UI-kit demos (nexus = agent portal on the v2 nav; marketing = homepage recreation). ⚠ `ui_kits/nexus/` shows the drag-reorder sidebar + ⌘K palette demo — authoring-only, see TRAPS. |
| `templates/{marketing-page,nexus-portal}/` | template | Starting-point scaffolds (relocated marketing screen; portal shell). |
| `screens-v2/_ds/agencytrack-design-system-<uuid>/` | DS bundle (embedded, packed) | Embedded packed copy of the DS bundle so mockups render in place. **"For reference, not for import into the app"** (Reference Index line 82). |
| `screens-v2/design-system-update/` | DS snapshot (embedded) | Embedded DS snapshot. **Verified this pass:** `guidelines/redesign-addendum.md` is byte-identical to the root copy; `tokens/app-v2.css`'s AA-fix values (`--inkFaint`/`--inkDim`/`--heroFaint`) are identical to the live `tokens/app.css` (only cosmetic `/* @kind other */` comment annotations differ in the live file). No drift — confirmed reference-only, kept in place (not deleted) since mockups render against it in place. |
| `screens-v2/design-system/` | DS snapshot (embedded, unverified vs. `design-system-update/`) | A **second, distinct** embedded DS snapshot (`app/tokens.css`, `marketing/tokens.css`, `reference/`). **Spot-checked this pass:** its `app/tokens.css` is the **pre-AA-fix v1** token set (lacks the `--inkFaint`/`--inkDim` split and the motion/focus token groups) — genuinely stale vs. the live `tokens/app.css`, unlike `design-system-update/` which matched. Not deleted (out of this pass's scope — flagged, not verified against every embedded mockup dependency). See UNCLEAR. |
| `screens-v2/deploy/` | marketing site | The **marketing website** deploy artifact (`index.html` title = "…Insurance Agency Management…for the Caribbean", legal/adoption pages). Marketing surface, **not** app design intent. |
| `screens-v2/AgencyTrack Website.html` | mockup (marketing) | Marketing homepage mockup — light-only marketing surface, not an app screen. |
| `screens-v2/src/` | repo-source snapshot | Embedded copy of repo components (`components/wizard/*`) for authoring reference — **not** the live source (that's the repo root `src/`). ⚠ **`screens-v2/src/components/wizard/`** specifically is a **delete-candidate** — see UNCLEAR (confirmed diverged from live `src/components/wizard/`, not a safe auto-delete). |
| `screens-v2/{screenshots,mockups,scraps,sh,gen}/` | screenshot / render capture | PNG/JPG screen captures + render helpers. Visual reference only. |
| `screens-v2/og/`, `uploads/og-image.png`, `assets/og-image.png` | OG image | Open-graph image sources. |
| `uploads/{Satoshi,GeneralSans,CabinetGrotesk}_Complete/`, `assets/fonts/`, `screens-v2/_ds/**/assets/fonts/` | font assets | Web-font families (`.woff/.woff2/.ttf/.otf`). Asset payload; font policy lives in `readme.md` "Font status". |
| `uploads/{logo-shield.svg,favicon.svg}`, `assets/{logo-shield.svg,favicon.svg}`, `screens-v2/agencytrack-logo.svg` | brand asset | Logo/favicon sources. |
| `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`, `styles.css` (root) + same under `screens-v2/_ds/**` | DS bundle machinery | The DS export's build/lint/manifest/entry files. Machinery, not read for design intent. |
| `*.prompt.md`, `CLAUDE_CODE_PROMPT.md`, `START-HERE.md`, `README.md` (inside handoff bundles) | build prompt | Paste-ready build prompts + bundle READMEs. Instructions to a builder, paired with the CANONICAL mockups they ship with. |

---

## UNCLEAR — flag for operator (generation/authority can't be settled from name+location)

7 items tracked across this catalog's lifetime. 4 were resolved in this revision's salvage-then-verify-then-delete dedupe pass (dispositions below); 3 are newly surfaced and remain open.

### Resolved this pass

| Path(s) | What was ambiguous | Verification performed | Disposition |
|---|---|---|---|
| `screens-v2/planner-build-package/` **vs** `screens-v2/agencytrack-planner-handoff/` | Near-duplicate: 28 shared files (`1-agent-planner/mockups/*`, `2-manager-planner/mockups/*`). | `diff -rq` on both shared subtrees: byte-identical. `planner-build-package/`'s 2 unique top-level docs (`Unified Claude Code Kickoff.md`, `Planner & Scheduler Build Handoff.html`) salvaged into `agencytrack-planner-handoff/` first. | **Salvaged then deleted.** `planner-build-package/` removed. `START-HERE.md` (a self-referential index of `planner-build-package/`'s own now-dissolved structure) was intentionally NOT salvaged — its content described a layout that no longer exists. |
| `screens-v2/planner-scheduler-handoff/` **vs** `agencytrack-planner-handoff/1-agent-planner/` — and `screens-v2/planner-manager-handoff/` **vs** `agencytrack-planner-handoff/2-manager-planner/` | Two more single-tier planner handoffs not covered by the original UNCLEAR row. | `diff -q`/`diff -rq` on README + mockups for both pairs: byte-identical. | **Deleted** (`planner-scheduler-handoff/`, `planner-manager-handoff/`) — no unique content. Net-new-builds table updated to point at `agencytrack-planner-handoff/{1-agent-planner,2-manager-planner}/`. |
| `screens-v2/Game Plan Loop - CC Handoff/` (12 files) **vs** `screens-v2/gameplan-loop-handoff/` (88 files) | Two generations of the Game-Plan-loop handoff; open question was whether `gameplan-loop-handoff/` preserved the "rev 5" Money Needs presentation-fix spec (`02c - Money Needs - Fix README (rev 5).md`) unique to the older folder. | Grepped `gameplan-loop-handoff/` for the rev-5 fix content — **not present** (only a shipped-status note in `Build Status Tracker.html` referencing the same component, not the fix spec itself). | **Ported then deleted.** `02c - Money Needs - Fix README (rev 5).md` moved into `gameplan-loop-handoff/` before `Game Plan Loop - CC Handoff/` was removed. |
| `screens-v2/design_handoff_financing_selfview/` (7 files) **vs** `screens-v2/design_handoff_track_k/` (9 files) | Both are "Track K financing" builds; unclear if `financing_selfview` was an earlier/narrower cut safe to delete. | `diff -q` on the 2 "unique" self-view sheets (`Track K Financing Self-View - Build.html`, `Track K Unit Financing - Unit Manager Build.html`): byte-identical to the copies already in `design_handoff_track_k/` under the same names — nothing to fold in file-content-wise. `README.md`s differ substantially: `financing_selfview/README.md` carries K9-specific design narrative (hierarchy decision, layout breakdown) absent from `track_k/README.md`'s umbrella overview. The 3 files under `financing_selfview/_reference/` (`Take-Home Waterfall`, both `Validation Dashboard` builds) are byte-identical duplicates of files already at `design_handoff_track_k/` root; `_reference/track-k-financing-new-agent-design-SPEC.md` (176 lines) is unique, not duplicated anywhere in `track_k/`. | **Kept both, per operator direction.** `design_handoff_financing_selfview/` retained (its README's K9/Unit-Financing narrative has no home in `track_k/`). Only the 3 duplicated `_reference/` files deleted; the unique spec file (`track-k-financing-new-agent-design-SPEC.md`) kept. |
| `guidelines/redesign-addendum.md` (root) **vs** `screens-v2/design-system-update/guidelines/redesign-addendum.md` (embedded) | Drift risk between the two copies. | `diff`: byte-identical. | **No drift found.** `design-system-update/` reclassified from "embedded snapshot, drift risk" to confirmed reference-only (see REFERENCE table) — not deleted, since mockups render against it in place. |

### Still open — flag for operator

| Path(s) | What's ambiguous | My lean (verify with operator) |
|---|---|---|
| `screens-v2/src/components/wizard/` **vs** repo-root `src/components/wizard/` | Looks like an accidental duplicate of live repo code sitting inside the design workspace. **Verified this pass:** it is NOT a clean duplicate — `CardStack.jsx` and `WizardForm.jsx` differ in content from the live versions, several live files don't exist here at all (`CurrencyField.jsx`, `NumericField.jsx`, `WeekConfirmView.jsx`, `WizardForm.helpers.js`, `__tests__/`), and it has its own `steps/` directory where live `src/` now has `v2steps/`. | Reads as a **stale pre-refactor snapshot**, not a safe auto-delete — deleting it would destroy an older wizard-structure reference, not a true duplicate. Left in place and flagged; confirm with operator whether it has any remaining reference value before deleting. |
| `screens-v2/design-system/` (second embedded DS snapshot, distinct from `design-system-update/`) | Whether this snapshot is current or stale — untested until this pass. | **Spot-checked this pass:** `app/tokens.css` is the pre-AA-fix v1 token set (no `--inkFaint`/`--inkDim` split, no motion/focus groups) — genuinely superseded by the live `tokens/app.css`, unlike its sibling `design-system-update/` which matched exactly. Not deleted (full dependency check — which mockups render against it — was out of this pass's scope). Operator should decide delete vs. archive. |
| `screens-v2/_ds/agencytrack-design-system-<uuid>/` (packed embedded DS bundle) | Whether this packed copy is current or stale — not diffed this pass. | Unverified. Given the mixed result above (one embedded copy matched live, one didn't), this one needs the same match-check before being trusted or deleted. Flagged for a follow-up verify pass. |

---

## TRAPS — files that LOOK canonical but are NOT (the confusion this catalog exists to end)

1. **DS Audit & Migration Plan HTMLs** (`screens-v2/AgencyTrack App - DS Audit & Migration Plan*.html`) — sit beside canonical mockups and are linked "start here" from the Reference Index, but the v2 **self-marks "⚠ SUPERSEDED as the authoritative plan."** → HISTORICAL.
2. **The drag-reorder sidebar + ⌘K command-palette demos** (`ui_kits/nexus/{shell.jsx,screens.jsx}`, `components/app/CommandPalette.*`, `components/app/SideNavSections.*` + the `useTouchReorder` hook) — these are DS **authoring demos** of a v2 nav, flagged authoring-only by the nav recon. The app's actual nav rules come from **`guidelines/redesign-addendum.md`** (nav section) + the shipped mobile-nav/More-sheet work — **not** these demos. → REFERENCE, not app spec.
3. **Embedded DS copies** (`screens-v2/_ds/`, `screens-v2/design-system/`, `screens-v2/design-system-update/`) — look like design-system sources but are authoring snapshots that exist only so mockups render in place. Canonical tokens/rules are at the **root** `tokens/` + `guidelines/`. → REFERENCE. **Verified this pass: they don't all agree with the root.** `design-system-update/` is confirmed byte-identical to root (`redesign-addendum.md`) / value-identical (`tokens/app-v2.css` AA values) — safe reference. `design-system/` (the *other* embedded copy) is confirmed **stale** — its `tokens.css` is the pre-AA-fix v1 set. `_ds/agencytrack-design-system-<uuid>/` is unverified. Don't assume any embedded copy is current without diffing it first.
4. **`screens-v2/deploy/` + `AgencyTrack Website.html`** — these are the **marketing** surface (public site), not app design intent. Don't port them into app components.
5. **`screens-v2/src/`** — an embedded snapshot of repo components, not the live source. Edit the real `src/` at repo root, never this copy. **`screens-v2/src/components/wizard/` specifically is a stale pre-refactor snapshot** (confirmed diverged from live `src/components/wizard/`, not a clean duplicate) — don't treat it as either the live source or an accurate historical mirror.

---

*Catalog generated as a classification map only (no deep content analysis). Classifications cite file location, in-file self-markers (e.g., the "⚠ SUPERSEDED" banner), and the folder's own `Reference Index.md` + CLAUDE.md precedence. Re-verify any UNCLEAR row with the operator before relying on it.*
