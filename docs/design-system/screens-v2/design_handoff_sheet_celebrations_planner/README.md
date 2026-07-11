# Handoff: Master Sheet Funnel · Celebration Surfaces · Planner Recurrence

Three AgencyTrack (Nexus v2) deliverables, designed July 2026 against the Nexus v2 system
(Satoshi + Cabinet Grotesk, app.css tokens, light + dark, no gradient buttons, 44px targets, AA floor).

1. **Master Sheet — Funnel edition** — the branch manager's dense reporting table regrouped as an
   explicit 8-stage sales funnel, with collapse/expand, comprehensive sort + filter, coaching drill,
   1-on-1 takeover, and a branch-meeting projection mode.
2. **Celebration surfaces** — the filing-streak milestone takeover redesign plus the full personal
   celebration ladder (birthday, contract anniversary, first sale, award qualification, personal-best
   week, annual commitment) and the manager-side echo toast.
3. **Planner — recurrence states** — recurring appointments inside the shipped Planner language.

## About the Design Files

Everything in `mockups/` is a **design reference built in HTML/JSX prototypes** — they show intended
look and behavior; they are **not production code to copy in**. The task is to **recreate these designs
in the AgencyTrack production codebase** (React + the shipped Nexus v2 token/component system) using its
established patterns: `app.css` tokens, the existing Icon set, `ttd()` money formatting, the shipped
ManagerShell / coaching drawer / AppointmentSheet components where they already exist.

To view the mockups: serve the `mockups/` folder statically and open any of the three HTML files. Each
renders a pannable canvas of numbered artboards (scroll/drag; artboards are live and interactive —
click controls in them). They use in-browser Babel; no build step. A `<link>` to
`_ds/.../tokens/fonts.css` will 404 in this bundle — the mockups then fall back to system fonts. In
production use the repo's local Cabinet Grotesk / Satoshi / JetBrains Mono fonts.

The "Full report ↗" link inside the coaching drawer points at a design file that exists only in the
main design project (`AgencyTrack Agent Report View v2.html`); in production it routes to the Agent
Report screen.

## Fidelity

**High-fidelity.** Colors, type, spacing, radii and states are final and pulled from the shipped Nexus
v2 tokens (see Design Tokens below). Recreate pixel-perfectly with the codebase's tokens/components.
Sample data (names, TTD amounts, week numbers) is illustrative.

---

# 1 · Master Sheet — Funnel edition

Files: `AgencyTrack Master Sheet Funnel.html` + `mastersheet-funnel-data.jsx` (column model + data),
`mastersheet-funnel-table.jsx` (the table), `mastersheet-funnel-scenes.jsx` (action bar, filters panel,
chips, drill drawer, 1-on-1, meeting + narrow scenes). Reuses `mastersheet-v2-shared.jsx`
(reality bar, roster, flag pills), `manager-v2-shared.jsx` (ManagerShell), `manager-v2-drill.jsx`
(the 5-tab coaching drawer).

## Column model — 8 funnel stages after the sticky lead columns

Sticky lead: `#` (rank, 30px) · `Agent · Unit` (168px, avatar + name + unit/NO LOG line) ·
`Status` (100px, flag pill; strong right hairline + 6px scroll shadow marks the pinned seam).

| # | Group (tier-1 label) | Sub-columns → KPI (KPI always LAST in group) |
|---|---|---|
| 01 | PROSPECTING ACTIVITIES | Letters/Em · Seminars · Cold Canv · Ref Calls → **Total** (sum) |
| 02 | CONTACT ATTEMPTS | Tel · F2F → **Total** (sum) |
| 03 | CONTACTS MADE | Tel · F2F → **Total** (sum) |
| 04 | QUALIFIED APPR. | **Approaches** (standalone KPI, no toggle) |
| 05 | FFIs | Sched → **Conducted** (KPI, `IK` tag) |
| 06 | CIs | New Bkd · Old Bkd → **Conducted** (KPI, `IK` tag) |
| 07 | RESULTS | Apps · Lives → **API · TTD** (terminal KPI) |
| 08 | REFERRALS | Referrals · New Names → **Total** (sum) |

Design rules encoded in the mockup:
- **KPI sits last** in its group (parts → outcome). Stage-KPI cells get a neutral ink wash
  (`rgba(38,35,28,0.05)` light / `rgba(240,235,224,0.055)` dark) + 700 weight + full ink; sub-columns
  400 weight, muted ink. **Teal is reserved for the terminal KPI band only** (API, wash
  `rgba(1,105,111,0.085)` light / `rgba(74,181,184,0.11)` dark, values 700 teal with a tiny `TTD`
  prefix, `tabular-nums`).
- **Group boundary rhythm**: each group opens with a stronger hairline (`ruleStrong`) and closes with
  its KPI band — 23 columns scan as 8 stages. Tier-1 header: teal mono stage number (`01`…`08`) +
  mono uppercase group label.
- **Two-tier sticky header** (group row 27px + sub-column row) survives horizontal AND vertical
  scroll; lead columns are `position: sticky; left: 0 / 30 / 198`.
- **Totals row pinned bottom** (`SOUTH BRANCH · N AGENTS` + per-column sums, KPI emphasis repeated).
- **IK affordance**: tiny bordered `IK` tag (7.5px mono) on both Conducted headers; footer spells out
  `IK — FFI + CI CONDUCTED = INTERVIEWS KEPT · <n> THIS WEEK` (Activity Standards derived figure).
- Zero values render as dimmed `—`.

## Collapse / expand

- **Default: all collapsed** — every stage shows only its KPI column at a wider collapsed width
  (group label switches to its short form, e.g. `01 · PROSP`); whole funnel fits without scroll.
- Per-stage toggle: `+` / `−` glyph box (14px) at the right of each tier-1 group cell. QA has no toggle.
- Action-bar `VIEW` segmented: `TOTALS` collapses all, `+ DETAILS` expands all; mixed states (from
  per-stage toggles) highlight neither.

## Sorting (tri-state) & filtering

- **Every column header is clickable**: 1st click sort ↓ (desc), 2nd ↑ (asc), **3rd returns to the
  default listing (YTD API rank)**. Active column shows ↓/↑; inactive KPI headers show a faint ↕.
- `RANK BY` preset (`API` ↔ `NEW NAMES`): sets the sort AND moves the terminal teal emphasis to the
  Referrals · New Names column (grouped headers unaffected).
- `UNIT` segmented: ALL / S·01 / S·02 / S·03.
- `FILTERS` button (badge = active count) opens a live-apply popover (324px, radius 14): STATUS chips
  (On track / Off pace / Gone quiet / Report late / Pers. ↓ / Below floor), LEVEL chips (L1–L4),
  WEEKLY REPORT chips (Submitted / Draft / Missing), "No daily log this week only" toggle; RESET + DONE.
- **Every active condition renders as a dismissible chip** above the table (`SORT · 07 API ↓ ×`,
  `UNIT · S·02 ×`, …) with `CLEAR ALL` when ≥2. Empty result → centered empty state
  ("NO AGENTS MATCH THE CURRENT FILTERS").
- "Exceptions" toggle (amber) filters to flagged agents — kept from the shipped sheet, composes with
  everything above. Reality bar (week · scope · team stats) carries over unchanged.

## Row drill → coaching drawer → deeper

- Row click slides in the **shared 5-tab coaching drawer** (468px, right; scrim click or Close pill
  dismisses), opening on the **Weekly** tab; header adapts to the clicked agent.
- Pinned drawer footer: **"Full report ↗"** (routes to Agent Report) + primary teal **"Start 1-on-1"**.
- **1-on-1 meeting mode**: full-frame takeover — agent hero (avatar, name, status pill, unit/level/
  weeks/YTD), the week as **8 funnel stage tiles** (KPI at 34px display + sub-column list), and a
  **weekly standard strip** (8 metrics, actual/floor, green/amber + mini bar). "Exit 1-on-1" pill.

## Branch meeting mode (16:9, 1280×720 projection)

Deep projection dark (`bg #120F0B, surface #1E1914`). Same interactive table with: live **search
input** (filters by agent name, teal border when active, × clears), `VIEW` segmented, `EXCEPTIONS`
toggle, header-click tri-state sorting, per-stage `+/−`. Header: mono eyebrow
`MONDAY STAND-UP · WEEK 48 · SOUTH BRANCH` + 27px display title.

## Narrow viewport (~834px)

Lead column condenses to one 178px cell (avatar + name + 6px status dot + unit); unit filter becomes
compact chips; a **stage scrubber** (8 mono chips `01 PROSP` … `08 REFERRALS`, active = solid teal)
jumps `scrollLeft` to the stage offset. Everything else (toggles, sort, drill) works the same.

## State (production)

`expandedGroups: Set<stageId>` · `sort: {key, dir} | null` · `unit` · `filters {statuses[], levels[],
reports[], noLogOnly}` · `search` · `exceptionsOn` · `preset ('api'|'newNames')` · `drillAgent` ·
`oneOnOne`. Row order derives from settled-YTD rank when `sort` is null. Persist view state per user.

---

# 2 · Celebration surfaces

Files: `AgencyTrack Streak Celebration v2.html` + `streak-celebrate.jsx` (streaks, birthday,
anniversary), `celebrations-more.jsx` (first sale, award, best week, commitment, manager echo,
balloons), `dailycap-celebrate.jsx` (source grammar: confetti field, medal keyframes `dc-pop`,
`dc-halo`, `dc-ring`, `dc-rise2` staggers).

## Shared takeover grammar

- Full-screen over the dimmed origin screen (blur 3px, 40% opacity) + warm scrim (~84% light / 88%
  dark) + radial glow behind the hero.
- Gold flame/glyph **medal** (radial `#fde9a8 → #e0aa3e → #a06b12`, inset shadows, specular blob) with
  pulsing halo + expanding ring; confetti field (5-color, seeded pseudo-random).
- Mono 0.24em-tracked gold eyebrow → **hero** → 19px display subtitle → ≤300px muted copy →
  3 stat chips (first chip gold-tinted) → gold CTA (44px min) → `TAP ANYWHERE TO CONTINUE`.
- **One-tap dismiss**: whole overlay is the target (desktop adds an `ESC · DISMISS` pill, top-right).
- **Reduced motion** (`prefers-reduced-motion`): no confetti, no balloons, no pop/rise/ring; halo
  frozen at ~55% opacity. Same content and dismiss.
- **Color discipline**: gold ONLY for earned recognition (streaks, anniversary, first sale, award,
  best week, commitment). Birthday is festive-not-performance → teal-led.

## The surfaces

1. **Filing streak** (5/10/25/52 weeks, fires on weekly-report submit): hero = the week count at
   132–148px display gold; chips STREAK / BEST / NEXT MILESTONE (52 → `THIS YEAR 52/52`); CTA "Keep
   filing". 52-week annual: ★ eyebrow, extra static ring on the medal, denser confetti. Desktop
   variant over the blurred Report Wizard. Milestone copy per tier is written in the mockup — use it.
2. **Birthday** (personal; kiosk + meeting already announce to the room): teal glowing initials-avatar
   instead of the medal, `★ TODAY · <DATE>` eyebrow, "Happy birthday, <name>." — **zero stats**;
   CTA "Back to my day".
3. **Contract anniversary**: gold; years count as hero (120px), `CONTRACT ANNIVERSARY · SINCE <MMM
   YYYY>`, chips YEARS / WEEKS FILED / LIVES; CTA "Here's to the next one".
4. **First sale** (★ in medal): "Your first sale.", chips API / PRODUCT / LIVES; CTA "The first of many".
5. **Award qualification** (trophy): "<Award>, qualified.", chips SETTLED / THRESHOLD / WEEKS LEFT;
   CTA "See your awards".
6. **Personal-best week** (bolt, fires on settlement): hero = the settled TTD figure; chips THIS WEEK /
   OLD BEST / APPS; CTA "Keep the pace".
7. **Annual commitment met** (target): hero `100%`; chips SETTLED / COMMITTED / WEEKS EARLY; CTA
   "Set the stretch" → routes to Game Plan.
8. **Manager echo** — NOT a takeover: stacked 384px toasts, top-right of the manager dashboard, newest
   first. Gold icon tile + "<Agent> hit <milestone>" + mono sub (`FILING STREAK · JUST NOW`) + gold
   **Congratulate** (sends a note the agent sees) + ghost **View** + × dismiss.

## Balloon rules (birthday + anniversary only — kiosk parity)

5 float keyframe paths (gentle S-curve / wide opposite drift / mid-rise bump + squash wobble ×2 /
diagonal), ~880px rise over 24s (background) / 14s (foreground); spawn 2–95% width; independent
pseudo-random streams for position, color, path, size, delay; palette of 8 soft festive tones + gold;
SVG balloon = radial-gradient ellipse + specular highlight + knot triangle + curling string.
**Background layer**: 6 balloons, 50% opacity, blur 2.5px, behind content. **Foreground layer**: max
~2 visible at once (long spacing), full opacity, drop-shadow + color glow, in front of content,
`pointer-events: none`. Layered WITH confetti.

---

# 3 · Planner — recurrence states

Files: `AgencyTrack Planner Recurrence.html` + `planner-recurrence.jsx`; base planner language in
`planner-base/` (`planner-shared.jsx` = ActChip/StatusPill/ApptRow/PHeader/PlannerNav etc.,
`planner-mobile-a.jsx` = AppointmentSheet grammar: SheetBackdrop, SegTabs, FieldRow).

## Data model

```
repeatRule: 'none' | 'daily' | 'weekly' | 'custom'   // custom → daysOfWeek: subset of MON..SUN
endCondition: 'never' | { onDate: date } | { afterCount: n }
```
An instance knows its series, position (`4 of 12`), and per-instance overrides (moved/postponed).
**Past instances never change. Postponed/cancelled instances are retained (dimmed), never deleted.**

## States designed

1. **Create** — AppointmentSheet gains a `REPEATS` field (chips: None / Daily / Weekly / Custom days;
   repeating chips carry the ↻ icon; selected = solid teal). Choosing a rule reveals `ENDS`
   (Never / On date / After # times — count uses a −/12/+ stepper, date uses a picker field) and a
   **plain-language teal preview panel**: "Books 12 appointments · every Tue, 5:00 PM · through Sep 8".
   Custom days opens a 7-chip day picker (44×44px, solid teal when selected). CTA becomes **"Book
   series"** when repeating.
2. **Series indicator on calendar items** — recurring ApptRows get a ↻ badge (18px teal-tint rounded
   square) beside the ActChip and a mono series line under the body, separated by a dashed hairline:
   `Every Tue · 4 of 12 · ends Sep 8`. One-offs unchanged.
3. **Instance vs series edit choice** — tapping edit on a recurring item raises a choice sheet BEFORE
   any form: ↻ badge + "This appointment repeats" + context line, then two option rows —
   **"Edit this appointment only"** (highlighted teal-tint; "Tue Jun 24 changes · the rest of the
   series stays") and **"Edit this and all future"** ("Jun 24 onward · past appointments never
   change") — plus Cancel. Rows are ≥44px.
4. **Postpone one instance** — postpone sheet is **scope-locked**: `APPLIES TO` shows "Just this one"
   as the only live (amber) chip; "Whole series — use Edit" is a disabled dashed chip. New day + time
   fields, then an amber consequence panel: "Only Tue Jun 24 moves to Thu Jun 26" + "The series stays
   every Tue · next: Jul 1, 5:00 PM". CTA "Move this one".
5. **After state** — the original slot stays in the timeline, dimmed, `POSTPONED` pill, warning note
   "Moved to Thu Jun 26 · 5:00 PM" + series line "Only this one moved · series stays every Tue".

---

# Design tokens (Nexus v2 app palette — from `app-tokens.jsx` / shipped `app.css`)

**Light**: bg `#F7F6F2` · surface `#FFFFFF` · surfaceRaised `#FAFAF8` · surfaceSoft `#F4F2EC` ·
surfaceMute `#F0EFE9` · ink `#28251D` · inkMute (warm mid) · inkFaint · inkDim `#CFCBC2` ·
rule `#E5E2DB` · ruleStrong `#CFCBC2` · teal `#01696F` · tealLight `#018A91` · gold `#B07D1A` ·
semantic success/warning/danger + tints.

**Dark** (warm, never blue-black): bg `#1A1612` · surface `#252019` · surfaceRaised `#302A23` ·
rule `rgba(240,235,224,0.08)` · ruleStrong `rgba(240,235,224,0.18)` · teal brightens `#4AB5B8` ·
gold brightens `#E0AA3E`. Meeting projection dark: bg `#120F0B`, surface `#1E1914`.

**Type**: Cabinet Grotesk 700/800 display (−0.02…−0.045em on heroes); Satoshi 400/500/600/700 body;
JetBrains Mono for eyebrows (8.5–11px, 700, 0.08–0.24em, uppercase), table numerics
(`tabular-nums`), status labels, chips. Table body 11.5–12px; KPI cells 12px/700.

**Radii**: chips/pills 999 · buttons 9–12 · cards/sheets 11–14 · panels 14–22.
**Motion**: 150–320ms ease; celebration keyframes as specced; respect `prefers-reduced-motion`
everywhere. **Hard rules**: no gradient buttons (medal radial + progress bars are the only
gradients), no emoji (★ ✓ ↻ unicode + line icons only), gold strictly for recognition.

Currency: `ttd(n)` → `TTD 2.40M` / `TTD 24.5K` / `TTD 950`.

# Assets

None beyond fonts + the hand-rolled inline SVG line icons already in the codebase (24px viewBox,
stroke 1.8). Flame/balloon/medal art is inline SVG in the mockup files — lift directly.

# Files

```
mockups/
  AgencyTrack Master Sheet Funnel.html      ← deliverable 1 canvas (11 artboards)
  mastersheet-funnel-data.jsx / -table.jsx / -scenes.jsx
  mastersheet-v2-shared.jsx · manager-v2-shared.jsx · manager-v2-drill.jsx   (reused v2 surfaces)
  AgencyTrack Streak Celebration v2.html    ← deliverable 2 canvas (13 artboards)
  streak-celebrate.jsx · celebrations-more.jsx · dailycap-celebrate.jsx
  AgencyTrack Planner Recurrence.html       ← deliverable 3 canvas (6 artboards)
  planner-recurrence.jsx
  planner-base/                              (shipped Planner design language, reference only)
  design-canvas.jsx · app-tokens.jsx · app-motion.jsx · app-shell.jsx · app-mobile.jsx  (mock infra)
```
