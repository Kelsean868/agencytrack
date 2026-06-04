# Track J — v2 "restyle ports" reclassified as REDESIGNS (scoping notes)

**Authored:** 2026-06-04 (Track J overnight queue, item 15) · **HEAD at authoring:** `origin/main` post-#452/#453
**Fulfils:** the port-ledger's referenced **STEP 2** restyle-vs-redesign reclassification (previously "not yet committed to the tree" — see [`track-j-port-ledger.md`](../track-j-port-ledger.md) § Methodology note).

This doc is the durable record of the Track J overnight-queue finding: the eight screens dispatched as **"green-channel restyle ports" (queue items 1–8) are all REDESIGNS, not cosmetic restyles.** Every v2 mockup adds data, composition, flows, or fields the shipped component lacks — which is each item's own Phase-0 PARK trigger. Firing across the *entire* cohort (8/8) makes it a queue-level premise break, not eight independent parks. These screens re-enter the pipeline as **daytime redesign tracks** (CD mechanics pass → redesign brief → slices), not as TRUE-RESTYLE dispatches.

---

## Authorization record (dispatcher decision block, verbatim)

> Dispatcher decision — queue-level premise break confirmed; re-scope authorized. Do NOT halt
> the night. Effective immediately:
>
> A. ITEMS 1–8: PARKED-PREMISE. No branches, no PRs — empty park-PRs are noise. Your 8-row
>    redesign table is the finding; it goes in the end-of-night report and item 15. The
>    audit's green-channel triage was component-side only and its own caveat fired 8/8; these
>    screens re-enter the pipeline as daytime redesign tracks (CD mechanics pass → brief →
>    slices).
>
> B. CONTINUE with every premise-independent item:
>    - Finish item 0 (complete the 5-run proof; if green, merge per §1).
>    - Items 9–13 exactly as briefed (9 ends at open PR; 10–13 auto-merge eligible).
>
> C. TWO NEW ITEMS, authorized by this block (cite it in each PR body):
>    ITEM 14 — SuggestedWeekCard state tests. Branch test/suggested-week-card-states. Scope:
>    NEW test file(s) for SuggestedWeekCard ONLY — zero src changes (existing testids
>    suffice; if the component proves untestable without src edits, PARK item 14 instead).
>    Cover: derived (3 chips + expand chain incl. prospects), floor fallback (5 floor metrics,
>    "company floor" label), no-anchor CTA, loading, error. Closes the banked #445 smoke-gap
>    FU at unit level. Test-only → auto-merge eligible; prod-smoke N/A → substitute
>    full-suite green.
>    ITEM 15 — Redesign scoping notes. Branch docs/track-j-redesign-scoping. One new doc:
>    docs/design/track-j-redesign-scoping-notes.md — for EACH of the 8 screens: what the v2
>    mockup adds vs the shipped component (your table, expanded per screen), data/schema
>    implications, suggested slice boundaries, open product questions. Embed this decision
>    block verbatim at the top as the authorization record. This doc FULFILLS the port-ledger's
>    referenced "STEP 2" restyle-vs-redesign reclassification — also update the ledger's
>    methodology note to point at it (sequential merges make that safe). Docs-only →
>    auto-merge eligible.
>
> D. NIGHT AUTONOMY RULES — supersede stop-handling for the remainder of the night:
>    1. Per-item premise failure → park (no empty PRs), log, continue.
>    2. Cohort-level premise failure → drop the affected items, continue every
>       premise-independent item, convert findings into a scoping-notes deliverable. Never
>       halt the queue for a subset.
>    3. Any question needing a NEW dispatcher decision outside this block → SKIP that item,
>       log it under "MORNING DECISIONS" in the end-of-night report, and continue.
>    4. FULL-QUEUE HALT only for: the two-revert circuit breaker; production breakage that
>       auto-revert cannot fix; environment/credential loss making gates unrunnable; anything
>       touching the §1 hard lines (rules / functions / schema / ANY Firestore write).
>    5. Every deferred question MUST appear under MORNING DECISIONS — deferred, never
>       silently dropped.
>
> Strike count unaffected — this stop was methodology-correct. Resume now.

---

## Summary table — 8 screens, redesign verdict

| Item | Ledger row | Screen | Shipped component(s) | What the v2 mockup ADDS (shipped lacks) | Class |
|---|---|---|---|---|---|
| 1 | 17 | Settings v2 | `profile/ProfileScreen.jsx` (+ `EmailUpdateModal`) | A whole new surface: **My Preferences** (appearance, view defaults, Meeting Mode, notifications) + **Team Defaults** with recommend-vs-lock grammar + hierarchy resolution (Company→SM→Branch→Unit→Agent) + provenance for locked rows. ProfileScreen is a profile editor (name/phone/bio/photo/email/logging-mode). | **REDESIGN** (new feature) |
| 2 | 20 | Compliance v2 | `manager/CompliancePanel.jsx` | Reality bar (filed % · on-time · late · not-in), exception-first not-in list with **Nudge / Nudge all**, on-time-**streak** roster, coaching-drawer reuse. Shipped = 3-column Submitted/Pending/Missing + CBTT + unlock/view. | **REDESIGN** |
| 3 | 22 | Monthly Recruiting v2 | `manager/MonthlyRecruitingTab.jsx` | **8-stage candidate pipeline** (Sourced→…→Licensed&active) as a **kanban board** + candidate drawer (stage timeline, referrer/owner, advance-stage) + configurable target. Shipped = a monthly roll-up *form* (`candidatesAssessed`, `agentsContracted`, notes) + team view. | **REDESIGN** (new data model) |
| 4 | 23 | Campaigns v2 | `campaigns/CampaignPanel.jsx`, `CampaignCard.jsx` | **Qualify-target ladders** + **1st/2nd/3rd placement races** + the **persistency gate** (payout scales by ≥90/85/80/<80% bands) + standings/builder/confirm-winners. Shipped panel has **zero** of these mechanics (grep: 0 hits). | **REDESIGN** |
| 5 | 10 | Persistency v2 (manager) | `manager/PersistencyTab.jsx`, `PersistencyEntryForm.jsx`, `PersistencyAgentRow.jsx` | Reality bar, exception-first below-80%-floor band, 90%-gate/80%-floor banding, data-**source** display (manager-locked vs self-entry), drawer-reused manager entry + **what-if playground**. Brief framed this as "restyle-to-parity" with the shipped agent side (#395); the mockup is materially more. | **REDESIGN** |
| 6 | 21 | Weekly WARs v2 | `manager/ManagerWarTab.jsx`, `ManagerWarDetail.jsx`, `TeamWarsTab.jsx` | Team matrix (filed/draft/not-filed + **8-week consistency**), **review drawer (approve / request changes)**, filing streaks. | **REDESIGN** |
| 7 | 19 | Master Sheet v2 | `manager/MasterSheet.jsx` | Reality bar, **column presets**, **"Show only exceptions"** toggle, status pills + mini API bars, **5-tab coaching drawer** on row click. Column *data* is identical (23 cols) but composition + flows are new. | **REDESIGN** (lightest — see slices) |
| 8 | 32 | Meeting Mode v2 | `manager/MeetingMode.jsx` | Full **guided-presentation rebuild** (not a stat slideshow): branch scorecard week/month/quarter/year, units team-by-team, two master sheets, exception-first drill vs floors, recognition (top producers + most-active + "on the rise"), birthdays/anniversaries, awards-within-reach, actions-captured, a **1-on-1 step** (coaching ratios + self-eval), Tweaks (theme/chrome/sort), **team-photo upload** (persisted), **phone presenter remote**. | **REDESIGN** (large) |

---

## Per-screen scoping notes

### Item 1 · Settings v2 (ledger row 17)
- **Mockup adds:** a consolidated settings home off the avatar menu with two tabs — *My Preferences* (personal: appearance, view defaults incl. period/KPI-detail/presets, Meeting Mode, notifications) and *Team Defaults* (managers set defaults for levels beneath them, choosing **recommend** = overridable or **lock** = read-only-below). Settings resolve down Company→SM→Branch→Unit→Agent; rows locked above show greyed with provenance. Reuses the recommend-vs-lock grammar from Goals.
- **Data/schema implications:** **heavy.** Needs a per-user preferences store and a per-level "team defaults" store carrying `{ value, mode: recommend|lock, setByRole, setByUid }` per setting key, plus a resolver that walks the hierarchy and computes effective value + provenance. New collections + new rules (who can write which level) + a resolution function. This is closest in shape to the existing Goals cascade (`goals`/`unitGoals`/`branchGoals`/`companyMinimums`) — reuse that mental model.
- **Suggested slices:** (S1) My Preferences only (personal, no cascade) — appearance + view defaults wired to existing localStorage/profile fields; (S2) Team Defaults read + resolver + provenance display (no write); (S3) Team Defaults write (recommend/lock) with rules; (S4) in-context "Tweaks" deep-links that write the same value.
- **Open product questions:** which settings are in-scope for the floor set (the mockup lists API floor, weekly activity floors, persistency threshold, award criteria — several already live in `companyMinimums`/awards ruleset)? Does "lock" at SM/Branch coexist with the existing company floor, and who wins? Is there an audit trail requirement for who changed a locked default?

### Item 2 · Compliance v2 (ledger row 20)
- **Mockup adds:** a reality bar (filed % · on-time · late · not-in); an **exception-first not-in list** with one-tap **Nudge** + **Nudge all**; a filing roster with status pill, submitted time, **on-time streak**; clicking a row opens the **shared coaching drawer** on the Weekly tab.
- **Data/schema implications:** *Nudge* is a write/notification flow (likely a `notifications` doc or a CF send) — net-new action. *On-time vs late* is derivable from `submittedAt` vs the Sunday deadline (no schema change). *On-time streak* needs history aggregation across weeks (read-only, but new compute). Coaching drawer = reuse existing. CBTT section present today is **absent** from the mockup (a removal to confirm, not drop silently).
- **Suggested slices:** (S1) reality bar + on-time/late classification (pure derive, no writes); (S2) exception-first not-in list + single Nudge (notification write) + Nudge-all; (S3) on-time-streak roster; (S4) coaching-drawer wire. Keep CBTT decision explicit in S1.
- **Open product questions:** does Nudge send email (SendGrid path) or in-app notification or both? Is "Nudge all" rate-limited / deduped? Where does CBTT compliance live if the Compliance surface no longer shows it?

### Item 3 · Monthly Recruiting v2 (ledger row 22)
- **Mockup adds:** an **8-stage recruiting pipeline** (Sourced → Contacted → Career seminar → Interview → Assessment → Offer/contracted → In licensing → Licensed & active) rendered as a **kanban board**, with a candidate drawer (stage timeline, referrer/owner, advance-stage). Only "Licensed & active" counts as a hire and feeds the Recruiting KPI on the Weekly WAR. Target is configurable (monthly/quarterly), soft minimum.
- **Data/schema implications:** **largest schema delta of the eight.** The shipped surface stores a *monthly aggregate* (`managerMonthlyRollupService` → `{ candidatesAssessed, agentsContracted, notes }`). The mockup needs a **per-candidate document model**: `candidate { name, stage, referrerUid, ownerUid, stageHistory[], createdAt }`, with a collection, rules (anyone-can-refer / manager-owns-pipeline), and a derivation that rolls "Licensed & active" count into the WAR Recruiting KPI. This is a new subsystem, not a restyle.
- **Suggested slices:** (S1) candidate data model + rules + create/refer; (S2) kanban board read + stage columns; (S3) advance-stage + stage timeline drawer; (S4) target config + funnel stats; (S5) WAR Recruiting-KPI feed from "Licensed & active". The existing monthly-rollup form likely deprecates once the pipeline feeds the KPI — migration question.
- **Open product questions:** does the per-candidate model replace or coexist with the monthly rollup? Who can move a candidate between stages (owner only, or any manager up-line)? PII handling for candidate names/contacts (these are non-agents — privacy + retention)?

### Item 4 · Campaigns v2 (ledger row 23)
- **Mockup adds:** two campaign structures — **qualify-target ladders** (hit a tier → win its prize; company default modelled on Christmas Campaign 2025) and **1st/2nd/3rd placement races** — plus the signature **persistency gate** (payout scales by quality band: ≥90% full · 85–89% half · 80–84% quarter · <80% disqualified). Manager surfaces: index · live standings · builder · confirm-winners. Agent mobile: my-prize-locked, gate health, reach-for-next-tier.
- **Data/schema implications:** the shipped `CampaignPanel` (651 lines) has **none** of these mechanics (grep for persistency/ladder/placement/tier/qualify/gate = 0). Needs campaign schema extension: `{ structure: ladder|placement, tiers[{ threshold, prize }], persistencyGate, standings, winners[] }`, a standings derivation joined to production + persistency, and a confirm-winners write flow. Persistency gate joins campaign payout to the persistency data (item 5's domain).
- **Suggested slices:** (S1) campaign schema + builder (create ladder/placement, set tiers/prizes/gate); (S2) live standings derivation (read); (S3) persistency-gate scaling applied to standings; (S4) confirm-winners write + agent mobile prize/gate views.
- **Open product questions:** does this replace the existing P8B campaign model or extend it (migration of live campaigns)? Where does the persistency % for the gate come from at confirm time (monthly persistency doc vs a campaign-period snapshot)? Agency-wide campaigns are SM-scoped — does the builder enforce scope-by-creator?

### Item 5 · Persistency v2, manager-entry side (ledger row 10)
- **Mockup adds:** reality bar (month · scope · branch persistency w/ trend · below-floor count); exception-first **below-80%-floor** book; roster banded against the **90% award gate / 80% floor** with **source** badges (manager-locked vs self-entry); two drawer actions — **manager entry** (six figures → derived %, gold precedence banner: saving overrides agent self-entry) and a **what-if playground** (levers → projected % vs gate, with at-risk policies).
- **Data/schema implications:** the agent side shipped at #395 is the in-repo styling reference. Manager entry/derivation likely already exists in `persistencyService` (the shipped manager components are `PersistencyTab`/`PersistencyEntryForm`/`PersistencyAgentRow`). Most of the mockup is *derivable* (banding, reality bar, trend) from existing persistency docs. The **what-if playground** is net-new client compute. The **source** badge (manager-locked vs self-entry) may need a field distinguishing entry origin if not already present.
- **Suggested slices:** (S1) reality bar + 90/80 banding + below-floor exception list (read-only, reuse existing data); (S2) source badge (confirm/derive entry-origin field); (S3) manager-entry drawer restyle on existing write path; (S4) what-if playground (new client compute, no writes).
- **Open product questions:** is the entry-origin (`manager-locked` vs `self-entry`) already stored, or does the precedence model need a new field? Does the what-if playground persist anything or is it ephemeral? This is the **lightest-schema** of the manager redesigns and the closest to a true restyle-plus — worth a focused re-audit of the shipped manager components before classifying its slices.

### Item 6 · Weekly WARs v2 (ledger row 21)
- **Mockup adds:** a team matrix (filed / draft / not-filed + **8-week consistency**), a **review drawer (approve / request changes)**, and filing streaks. WAR = the manager's edition of the weekly report (production/activity + managerial KPIs: 1-on-1s, joint field work, recruiting touches, training, unit meeting, dashboard review). Trevor files his own WAR up-line and reviews his 5 leaders.
- **Data/schema implications:** these are functional Track-I surfaces (existing smokes `manager-war-smoke`, `upline-war-browse-smoke`). The 8-week consistency matrix is history aggregation (read). **Approve / request-changes** is a status-write flow on the WAR doc — net-new if the shipped review is read-only. Targets are "configurable by upper management (none mandatory yet)" — graceful with/without minimums.
- **Suggested slices:** (S1) team matrix + 8-week consistency (read); (S2) review drawer read; (S3) approve / request-changes write + status model; (S4) filing-streak + KPI-target display.
- **Open product questions:** does "request changes" reopen the WAR for the leader to edit (status lifecycle), and does it notify them? Are managerial-KPI targets stored anywhere yet, or display-only? Keep the existing functional smokes green as a gate for any restyle.

### Item 7 · Master Sheet v2 (ledger row 19) — lightest of the eight
- **Mockup adds:** a compact reality bar (week · scope · team API / on-pace / exceptions); **column presets**; a **"Show only exceptions"** toggle; status pills + mini API bars; a **5-tab coaching drawer** on row click. The 23-column set, order, derivations, sticky behaviour, and horizontal scroll are **data-identical**.
- **Data/schema implications:** **none at the data layer** — column data unchanged. The adds are client-side: preset state, an exceptions filter (the "five flagged agents must match the dashboard exactly" — reuse the dashboard's flag logic), and the coaching drawer (reuse). This is the closest to a TRUE-RESTYLE-plus; the only reason it parks is the new presets/exceptions/drawer *composition + flows* exceed a chrome swap.
- **Suggested slices:** (S1) reality bar + table chrome restyle (pure presentational — could be a near-true-restyle); (S2) column presets (client state); (S3) "show only exceptions" toggle wired to the shared flag logic; (S4) 5-tab coaching drawer reuse. **S1 alone may qualify as a green-channel TRUE-RESTYLE** if scoped to chrome only — candidate for the first re-entry.
- **Open product questions:** which column presets ship (named sets)? Does "exceptions" reuse the dashboard's exact five-flag rule (single source) or its own? Coaching drawer = the same 5-tab drawer as Compliance/Weekly — confirm one shared component.

### Item 8 · Meeting Mode v2 (ledger row 32) — largest
- **Mockup adds:** a full **guided stand-up presentation** (replacing the current stat slideshow): opens on branch reality, bird's-eye scorecard (week/month/quarter/year), units team-by-team, two master sheets (activity + printed production report), exception-first drill through each agent vs the company minimum weekly activity floors, recognition (top producers + most-active + an "on the rise" strip), birthdays & anniversaries, awards-within-reach, actions-captured wrap, a **1-on-1 step** (coaching ratios + self-evaluation), a Tweaks panel (theme flip — dark default, hide presenter chrome, activity-sheet group/sort default), **team-photo upload** (persisted, separate from kiosk), and a **phone presenter remote**. Always-dark `--color-presentation-*` token set (theme-invariant by design).
- **Data/schema implications:** **large.** Most content is read-derived from existing production/activity/awards/floor data, but assembled into a many-step guided flow. **Team-photo upload** needs Firebase Storage (a new path, separate from kiosk avatars). The **presenter remote** needs some lightweight phone↔deck channel (state sync). The 1-on-1 step pulls coaching ratios + self-eval. SPECIAL TOKEN RULE: stay within `--color-presentation-*` (defined in `:root` only); do **not** add presentation tokens to `.dark`.
- **Suggested slices:** (S1) guided-deck shell + branch reality + bird's-eye scorecard (read-only, presentation tokens); (S2) exception drill vs floors + recognition strips; (S3) birthdays/anniversaries + awards-within-reach + actions wrap; (S4) 1-on-1 step; (S5) Tweaks (theme/chrome/sort persistence); (S6) team-photo upload (Storage) + presenter remote.
- **Open product questions:** where do team photos live (Storage path, who can upload, retention) and how do they stay "separate from kiosk"? What's the presenter-remote transport (Firestore doc poll? other)? Birthdays/anniversaries — is DOB/hire-date stored on the user doc today?

---

## How these re-enter the pipeline

Per the dispatcher decision block (A): these are **daytime redesign tracks**, not TRUE-RESTYLE dispatches. The recommended shape per screen:

1. **CD (Claude Design) mechanics pass** — resolve the open product questions above; lock the data/schema model.
2. **Redesign brief** — REDESIGN-class brief (allows composition + computation + schema changes), not a TRUE-RESTYLE brief (which locks those down). Schema-touching slices follow the brief-completeness rule for new Firestore collections (rules + write + read + indexes + smoke).
3. **Slices** — the suggested slice boundaries above are starting points; each slice gets its own brief + green-channel gates.

**Note on Master Sheet (item 7):** its S1 (chrome-only reality bar + table restyle, no presets/toggle/drawer) is the single best candidate for a near-term **TRUE-RESTYLE** green-channel dispatch — the column data is byte-identical and only the chrome changes. Recommend re-auditing it first.

**Note on Persistency manager (item 5):** lightest-schema of the manager redesigns; a focused re-audit of the shipped `manager/PersistencyTab.jsx` + `PersistencyEntryForm.jsx` against the agent-side #395 reference may reveal that S1–S3 are restyle-grade, with only the what-if playground as net-new.
