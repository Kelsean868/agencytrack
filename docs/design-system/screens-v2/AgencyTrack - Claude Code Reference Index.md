# AgencyTrack — Claude Code Reference Index

Everything needed to bring **every app screen onto the Nexus v2 design system** and build the
remaining net-new surfaces. Save the whole project folder to Claude Code — the mockups reference
sibling `.jsx` files, `doc-page.js`, and the `_ds/` bundle, so they only render correctly in place.

> **The one thing to internalize first:** the production app already ships the Nexus design system
> in `src/index.css` (Tailwind tokens that 1:1-match the mockups). "Implement the new design system"
> = port each mockup's look into its existing React component using those repo tokens. Do **not**
> import the `_ds/` bundle into the app — it's a design-authoring tool, not a runtime dependency.

---

## Start here (read in this order)

| # | File | What it is |
|---|------|------------|
| 1 | **AgencyTrack — Master Build Reference.html** | The map: every screen → its mockup → its repo component → status (Shipped / Verify / Build). Token bridge + global rules + per-screen definition of done. |
| 2 | **AgencyTrack App — DS Audit & Migration Plan v2 (Repo-Reconciled).html** | Why the picture is "finish a mostly-built port," not a migration. Reconciled against the repo. |
| 3 | **AgencyTrack — CRO Build Handoff.html** | Net-new build #1: CRO/back-office role + Delivery Register + 30-day clawback clock. |
| 4 | **AgencyTrack — Planner & Scheduler Build Handoff.html** | Net-new builds #2 + #3: agent planner + manager coaching tier, folded. |
| 5 | **Planner & Scheduler — Unified Claude Code Kickoff.md** | Paste-ready prompt for the planner build (both tiers, in order). |

---

## The three real builds (where effort goes)

Everything else is verify-vs-mockup. These three were the net-new / not-routed builds at
authoring time — **all three have since SHIPPED** (status refreshed Run A Tier 1 §5, 2026-07-24;
note the 2026-07-07 recon still listed CRO as pending — it predated the CRO ship):

- **CRO / back-office** — `AgencyTrack CRO.html` + CRO Build Handoff. **SHIPPED & routed** —
  `role === 'cro'` routes to `CRODashboard` (`src/App.jsx:131`); `DeliveryRegisterPanel` +
  `ClawbackChip` live under `src/components/cro/`.
- **Planner (agent)** — `planner-scheduler-handoff/` + Planner Build Handoff. **SHIPPED & un-gated** —
  `COMING_SOON_TABS` no longer contains `planner` (`src/config/comingSoonTabs.js`); `AgentPlannerPanel`
  renders live. The E1–E5 enhancements are the separate Run A Planner track, per
  `docs/design-system/proposals/planner-scheduler-v2/README.md`.
- **Team Planner (manager)** — `planner-manager-handoff/`. **SHIPPED** — `TeamPlannerPanel.jsx` live;
  coaching-tier trust constraints enforced at the security-rules layer.

---

## Redesigned screen mockups (design source of truth)

All at project root. Open in this tool to review (drag-pan, ⌘/Ctrl-scroll zoom, ⤢ Focus for
fullscreen). Each maps to a repo component in the Master Build Reference.

**Agent:** Agent Dashboard v2 · Daily Capture v2 · Weekly Report Wizard v2 · Game Plan v2 ·
Goals v2 · Commission v2 · Persistency v2 (+ Playground v1-v2 + Model-Change Spec) ·
Policy Ledger v2 · History v2 · Production Report v2 · Agent Report View v2 · Leaderboard ·
Agent Awards v2 · Career Portal v2 · Prospect Prep v2 · Settings v2

**Manager:** Manager Dashboard v2 · Master Sheet v2 · Compliance v2 · Policy Reconciliation ·
Weekly WARs · Monthly Recruiting · Campaigns · Manager Reports · Branch Report · Reports ·
Meeting Mode v2 · Kiosk Mode

**Admin / shell / system:** App Layout · App Mobile · Mobile Nav · Nav & Quick Actions (2 Options) ·
System Screens · Emails · Settings v2 (admin section)

**New builds:** CRO · Planner & Scheduler v2 · Planner — Manager Surfaces

**Handoff bundles (spec + kickoff + mockups):** `planner-scheduler-handoff/` ·
`planner-manager-handoff/` · `agencytrack-planner-handoff/` · `design_handoff_v2_app/` ·
`design_handoff_financing_selfview/` · `design_handoff_track_k/` · `gameplan-loop-handoff/` ·
`money-needs-allocator-handoff/` · `nav-quickactions-handoff/`

**Composed prototype:** `AgencyTrack Prototype.html` — the navigable app wiring the screens together.

---

## Global rules (from the Master Build Reference)

- Tokens only, no new hex; Tailwind `@layer` utilities first.
- Every screen light + dark (except Kiosk/Meeting = presentation-dark).
- Loading / empty / error / ready on every data surface.
- Data via `src/services/*` with `tenantId`; never query Firestore from components.
- Currency via `formatCurrency` → `TTD 24.5K`; tabular right-aligned nums; JetBrains Mono for
  eyebrows/currency/policy#.
- Dense tables scroll in-card, sticky header + first column; one GlassCard max; gold = recognition only.
- a11y CI green (axe + jsx-a11y): labelled controls, focus rings, 44px targets, reduced-motion guards.
- No emoji; only `★` and `✓` as text glyphs.
- Rules / Cloud Functions changes → human-merge + `firebase deploy`; all React ships on the Vercel PR path.

---

## Design system source (for reference, not for import into the app)

`_ds/agencytrack-design-system-ad1cd77a-1bcf-4449-a9f6-c870361300fb/` — the Nexus DS bundle,
tokens, and component source. Use it to author mockups in this tool and to read exact token values;
the app itself styles against its own `src/index.css`.
