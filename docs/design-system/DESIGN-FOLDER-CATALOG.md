# Design-System Folder Catalog

**Purpose.** `docs/design-system/` mixes generations — the current canonical redesign lives beside superseded migration plans, embedded design-system snapshots, and authoring-only demos. Prior build sessions repeatedly lost time deciding which file was authoritative. This catalog is the **map**: for every file or logical group it records what the thing is and whether a builder should **build toward it (CANONICAL)**, **ignore it as superseded (HISTORICAL)**, **use it as supporting material only (REFERENCE)**, or **ask the operator (UNCLEAR)**.

It is a classification map, **not** a spec read — it does not summarise design intent. For design intent, open the canonical mockups themselves.

> **Precedence (operator-set).** For **app** surfaces: `guidelines/redesign-addendum.md` wins on rules → the `screens-v2/` per-screen `.html` mockups (+ their `.jsx` scene sources) are the canonical **design intent** → `tokens/*.css` are the canonical **values**. The folder's own [`screens-v2/AgencyTrack - Claude Code Reference Index.md`](screens-v2/AgencyTrack%20-%20Claude%20Code%20Reference%20Index.md) calls the redesigned mockups the *"design source of truth"* (line 39). Pre-2026-redesign material (the `DS Audit & Migration Plan` HTMLs — the v2 self-marks **"⚠ SUPERSEDED"** — and early Zoho/Perplexity/Gemini ideation inputs) is historical. See also [`CLAUDE.md` → Theme System → Canonical sources & precedence].

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
| **Build-handoff bundles** (net-new / in-flight surfaces) — `screens-v2/design_handoff_v2_app/`, `screens-v2/design_handoff_track_k/`, `screens-v2/gameplan-loop-handoff/`, `screens-v2/money-needs-allocator-handoff/`, `screens-v2/nav-quickactions-handoff/`, `screens-v2/planner-scheduler-handoff/`, `screens-v2/planner-manager-handoff/`, `screens-v2/agencytrack-planner-handoff/` | build-handoff (spec + kickoff + mockups) | Current handoffs the Reference Index points to for **net-new / not-yet-routed** builds (CRO, Planner agent + manager, Game-Plan loop, Money-Needs allocator, Nav options, Track K financing). ⚠ Some overlap/duplicate — see UNCLEAR. |
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
| Master sheet | `AgencyTrack Master Sheet v2.html` | `manager/MasterSheet` |
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
| Planner (agent) | `planner-scheduler-handoff/` + Planner Build Handoff | `planner` tab gated coming-soon in `navConfig.js`. |
| Team Planner (manager) | `planner-manager-handoff/` | Coaching tier; trust constraints at the rules layer. |
| Track K financing | `design_handoff_track_k/` | Financing self-view + terms setup + monthly statement entry. |

---

## HISTORICAL — superseded, do not build toward

| Path / group | Type | Why historical |
|---|---|---|
| `screens-v2/AgencyTrack App - DS Audit & Migration Plan v2 (Repo-Reconciled).html` | migration-plan | **Self-marked in-file: "⚠ SUPERSEDED as the authoritative plan — retained…"**. The reskin it planned is largely shipped; kept for audit trail only. |
| `screens-v2/AgencyTrack App - DS Audit & Migration Plan.html` | migration-plan | The v1 migration plan (superseded by the v2 above, which is itself superseded). |
| `screens-v2/uploads/*.md` ideation inputs — `Zoho CRM Interface Design Resources*`, `Zoho CRM NextGen Mobile*`, `AgencyTrack UI_UX Recommendations…Zoho Design Philosophy*`, `Perplexity/Perlexity UI Recommendation*`, `agencytrack-gemini-spec.md`, `AgencyTrack Technical Specification…` | research inputs | Pre-2026-redesign ideation/inspiration; superseded by the shipped Nexus v2. Reference for archaeology, not intent. |

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
| `screens-v2/design-system/`, `screens-v2/design-system-update/` | DS snapshot (embedded) | Embedded DS snapshots. ⚠ `design-system-update/guidelines/redesign-addendum.md` is a **second copy** of the addendum — canonical one is `guidelines/redesign-addendum.md` at root; the embedded copy can drift. See TRAPS. |
| `screens-v2/deploy/` | marketing site | The **marketing website** deploy artifact (`index.html` title = "…Insurance Agency Management…for the Caribbean", legal/adoption pages). Marketing surface, **not** app design intent. |
| `screens-v2/AgencyTrack Website.html` | mockup (marketing) | Marketing homepage mockup — light-only marketing surface, not an app screen. |
| `screens-v2/src/` | repo-source snapshot | Embedded copy of repo components (`components/wizard/*`) for authoring reference — **not** the live source (that's the repo root `src/`). |
| `screens-v2/{screenshots,mockups,scraps,sh,gen}/` | screenshot / render capture | PNG/JPG screen captures + render helpers. Visual reference only. |
| `screens-v2/og/`, `uploads/og-image.png`, `assets/og-image.png` | OG image | Open-graph image sources. |
| `uploads/{Satoshi,GeneralSans,CabinetGrotesk}_Complete/`, `assets/fonts/`, `screens-v2/_ds/**/assets/fonts/` | font assets | Web-font families (`.woff/.woff2/.ttf/.otf`). Asset payload; font policy lives in `readme.md` "Font status". |
| `uploads/{logo-shield.svg,favicon.svg}`, `assets/{logo-shield.svg,favicon.svg}`, `screens-v2/agencytrack-logo.svg` | brand asset | Logo/favicon sources. |
| `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`, `styles.css` (root) + same under `screens-v2/_ds/**` | DS bundle machinery | The DS export's build/lint/manifest/entry files. Machinery, not read for design intent. |
| `*.prompt.md`, `CLAUDE_CODE_PROMPT.md`, `START-HERE.md`, `README.md` (inside handoff bundles) | build prompt | Paste-ready build prompts + bundle READMEs. Instructions to a builder, paired with the CANONICAL mockups they ship with. |

---

## UNCLEAR — flag for operator (generation/authority can't be settled from name+location)

| Path(s) | What's ambiguous | My lean (verify with operator) |
|---|---|---|
| `screens-v2/planner-build-package/` **vs** `screens-v2/agencytrack-planner-handoff/` | Near-duplicate: 28 shared files (`1-agent-planner/mockups/*`); differ only in wrappers (`planner-build-package/` adds `Planner & Scheduler Build Handoff.html` + `START-HERE.md` + `Unified…Kickoff.md`; `agencytrack-planner-handoff/` adds `README.md`). Only `agencytrack-planner-handoff/` is named in the Reference Index. | `agencytrack-planner-handoff/` is the referenced one; `planner-build-package/` looks like a redundant packaging. Confirm which is live before building. |
| `screens-v2/Game Plan Loop - CC Handoff/` (12 files, slice labels "SHIPPED"/"PENDING", `00 - START HERE - Manifest.md`) **vs** `screens-v2/gameplan-loop-handoff/` (88 files, numbered slices 0–8 + `LOOP_BUILD_STATUS.md` + `LOOP_SPEC.md` + build-status trackers) | Two generations of the same Game-Plan-loop handoff. Overlapping slice content, different structure. | `gameplan-loop-handoff/` (larger, has active build-status trackers) looks like the working set; `Game Plan Loop - CC Handoff/` reads as an earlier packaged summary. Confirm which is authoritative. |
| `screens-v2/design_handoff_financing_selfview/` (7 files) **vs** `screens-v2/design_handoff_track_k/` (9 files) | Both are "Track K financing" builds; `track_k` is broader (Self-View + Terms Setup + Monthly Statement Entry), `financing_selfview` is a subset (Self-View + Unit Financing + Take-Home Waterfall component). | `design_handoff_track_k/` looks like the superset/current; `financing_selfview` may be an earlier/narrower cut. Confirm scope split. |
| `guidelines/redesign-addendum.md` (root, CANONICAL) **vs** `screens-v2/design-system-update/guidelines/redesign-addendum.md` (embedded snapshot) | Two copies of the app-rules doc. Canonical is unambiguous (root); the drift risk between them is the open question. | Treat root as canonical; operator may want to delete or re-sync the embedded snapshot to prevent a builder reading the stale one. |

---

## TRAPS — files that LOOK canonical but are NOT (the confusion this catalog exists to end)

1. **DS Audit & Migration Plan HTMLs** (`screens-v2/AgencyTrack App - DS Audit & Migration Plan*.html`) — sit beside canonical mockups and are linked "start here" from the Reference Index, but the v2 **self-marks "⚠ SUPERSEDED as the authoritative plan."** → HISTORICAL.
2. **The drag-reorder sidebar + ⌘K command-palette demos** (`ui_kits/nexus/{shell.jsx,screens.jsx}`, `components/app/CommandPalette.*`, `components/app/SideNavSections.*` + the `useTouchReorder` hook) — these are DS **authoring demos** of a v2 nav, flagged authoring-only by the nav recon. The app's actual nav rules come from **`guidelines/redesign-addendum.md`** (nav section) + the shipped mobile-nav/More-sheet work — **not** these demos. → REFERENCE, not app spec.
3. **Embedded DS copies** (`screens-v2/_ds/`, `screens-v2/design-system/`, `screens-v2/design-system-update/`) — look like design-system sources but are authoring snapshots that exist only so mockups render in place. Canonical tokens/rules are at the **root** `tokens/` + `guidelines/`. → REFERENCE (and the second `redesign-addendum.md` copy under `design-system-update/` can drift).
4. **`screens-v2/deploy/` + `AgencyTrack Website.html`** — these are the **marketing** surface (public site), not app design intent. Don't port them into app components.
5. **`screens-v2/src/`** — an embedded snapshot of repo components, not the live source. Edit the real `src/` at repo root, never this copy.

---

*Catalog generated as a classification map only (no deep content analysis). Classifications cite file location, in-file self-markers (e.g., the "⚠ SUPERSEDED" banner), and the folder's own `Reference Index.md` + CLAUDE.md precedence. Re-verify any UNCLEAR row with the operator before relying on it.*
