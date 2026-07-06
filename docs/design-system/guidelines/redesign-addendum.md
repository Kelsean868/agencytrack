# Nexus App — Redesign Addendum (v2)

> Companion to the AgencyTrack Nexus `readme.md`. This documents the systems the
> 2026 app redesign proved out and the app now depends on — **state design,
> navigation, motion, dense tables, and accessibility** — plus the token
> reconciliation between the design system and the shipped, rated prototype.
>
> Audience: **you + Claude Design + Claude Code.** When these rules and the base
> `readme.md` disagree, this file wins for **app** surfaces (marketing is
> unchanged). Everything here is enforced across all 39 app screens, both themes,
> desktop + mobile, at stress-data volumes.

---

## 0. Token reconciliation (READ FIRST)

The design system (`tokens/app.css`) and the shipped prototype had drifted. The
resolution: **DS naming/scope is canonical** (`.nexus` / `.nexus.dark`,
camelCase) — the prototype's `.app-root[data-theme]` kebab names were a
throwaway convenience and should **not** enter production. But the prototype
carried genuine **AA-contrast corrections** the DS must absorb. `tokens/app-v2.css`
is the merged result. Key deltas:

| Token | v1 (DS) | v2 (canonical) | Why |
|---|---|---|---|
| `--inkFaint` (light) | `#A8A39C` | `#7A7264` | v1 was ~2.3:1 on text → **failed WCAG AA 1.4.3**. New value ~4.7:1. |
| `--inkFaint` (dark) | `#8A8074` | `#968B7C` | Raised to ~4.6:1 on `--surface`. |
| `--inkDim` (new role) | — | `#A8A39C` / `#4F473E` | The old faint value kept, but **non-text only** (dividers, disabled glyphs). |
| `--heroInk` / `--heroFaint` | (glass only) | explicit | Text on the teal hero needs its own AA-verified pair; never raw `--ink`. |
| motion / focus / skeleton | — | new groups | See §2–§4. |

**Prototype → canonical name map** (for anyone porting prototype code):
`--primary`→`--teal` · `--primary-soft`→`--tealTint` · `--ink-soft`→`--inkMute` ·
`--ink-faint`→`--inkFaint` · `--line`→`--rule` · `--line-soft` (non-text)→`--inkDim`/`--rule` ·
`--card`→`--surface` · `--card-raised`→`--surfaceRaised` · `--good`→`--success` ·
`--bad`→`--danger` · `data-theme="dark"`→`.dark`.

---

## 1. State design (loading · empty · error) — REQUIRED on every data surface

No screen may assume happy-path data. Every surface that fetches renders through
four states. The prototype ships one primitive per concern; reuse them, don't
re-invent.

- **Loading → skeletons, never spinners.** Match the skeleton to the final
  layout so nothing shifts when data lands. Four archetypes: `cards` (dashboard),
  `table` (Master Sheet / ledgers), `timeline` (capture / history), `detail`
  (policy / career). Skeleton fill uses `--skeleton`.
- **Empty → actionable, never "No data."** Each empty state names *why it's
  empty* and gives the *next step* as a real CTA. E.g. Daily Log →
  "No activity logged yet → Log your first activity"; Settlements → "No
  settlements pending → View policy ledger". Icon + one-line title + ≤2-line body
  + primary CTA.
- **Error → a persistent inline card with Retry, never a toast.** Toasts vanish;
  a load failure must stay on screen with a way to recover. Reassure that work is
  safe. Field-level validation associates the message with the input
  (`aria-describedby`), not a top banner.
- **Partial failure** (one row of many fails to sync) → an inline `--warning`
  banner above the table naming the count, plus per-row affordance. See
  Reconciliation's "N policies differ" banner.

**Contract:** `StateLayer({state, kind, empty, error, onRetry})` wraps content and
swaps in `SkeletonScreen`, `EmptyState`, or `ErrorState`. Drive `state` from the
fetch; default `ready`.

---

## 2. Motion — fast, quiet, and it must degrade to visible

Timing tokens: `--dur-1 .14s` (hover/focus), `--dur-2 .20s` (toggles/tabs),
`--dur-3 .32s` (screen enter / sheet). Easing: `--ease-out` for reveals and
hovers; `--ease-spring` **only** for sheets. No motion over ~320ms on content.

Approved motions:
- **Screen enter** — content region fades + rises 8px on navigation.
- **Staggered assemble** — a screen's top-level blocks rise in sequence
  (~40ms step). **Stagger via `transform` only, never `opacity`** — a paused or
  throttled tab must never leave a block stuck at `opacity:0`. (This bit us; the
  transform-only rule is the fix.)
- **Sheet open** — mobile sheets spring up (`--ease-spring`) with a backdrop
  fade and lightly staggered items.
- **Count-up** — KPI/hero numerals count from 0 with a cubic ease-out on load.

Hard rules: everything gated behind `@media (prefers-reduced-motion:
no-preference)`; **no infinite loops on content** (decorative glyph-drift /
marquee are the only exceptions); the visible end-state is always the base style
so print, PDF export, and reduced-motion show content, not the pre-animation
frame.

---

## 3. Navigation — the cognitive-load layer

Desktop: 232px sidebar, sections with mono-uppercase eyebrow headers, `aria-current="page"`
on the active item. Sidebar items are **drag-reorderable** (pointer + long-press
touch fallback), persisted.

Mobile: fixed 5-slot bottom bar. Slot 5 is always **More** — position never
moves (muscle memory), and it carries a **vertical ⋮ affordance beside the icon**
so it always reads as "opens a menu," even when it adaptively shows the current
deep screen's name. The center **+** slot is the primary create shortcut.

- **More sheet** — every screen for the role, grouped into labelled sections
  (mirror the desktop sidebar's grouping; keep sections ≤4–5 items, never one
  long blob). Includes a **Pinned** row (user-pinned, persisted) and an
  auto **Frequent** row (most-visited). Focus-trapped dialog; **Done** is a
  filled primary button at thumb reach.
- **Create sheet / command palette** — role-scoped: only show actions the role
  can perform (agent: log activity / new policy / weekly report / commission;
  manager: settlement / meeting; admin: branch / user). A selling manager in a
  dual surface sees both sets.
- **Reorder + pin** state persists to storage per role.

---

## 4. Accessibility — WCAG 2.2 AA is the floor, not a nice-to-have

- **Contrast:** all text ≥ 4.5:1 (≥ 3:1 for ≥ 24px/bold) on its actual surface,
  both themes. Use `--inkFaint` as the *smallest* text ink; never put text on
  `--inkDim`. Text on the hero uses `--heroInk` / `--heroFaint` only.
- **Focus:** visible ring on every interactive element (`--focus`); logical tab
  order; a skip-to-content link; `<main>` landmark.
- **Dialogs** (sheets, palette, modals) — `role="dialog"`, `aria-modal`,
  focus-trapped, Escape closes, focus returns to the trigger; closed sheets are
  removed from the tab order (`visibility:hidden`).
- **Icon-only controls** — every one needs an `aria-label` (e.g. "Edit Anika
  Ramdeen"). Table row-actions are real 32px buttons, not bare glyphs. Decorative
  badges (`the "4" on the bell`) are `aria-hidden`; the button label carries the
  count ("Notifications, 4 unread").
- **Nav** — `<nav aria-label>`, `aria-current="page"` on active; tab bars /
  segmented controls use `role="tablist"` / radio semantics.
- **Touch targets** ≥ 44px on mobile.

---

## 5. Dense operational tables — the second bar

Manager/admin data tables (Master Sheet, ledgers, settlements, rosters,
reconciliation) are judged on **density done well**, not beauty. They must hold
real volume (verified at 60–120 rows):

- Scroll **inside the card**, never the page. Sticky header (`position:sticky;
  top:0`) and sticky first column (`position:sticky; left:0`) so identity + labels
  stay while scanning.
- Numerals are `font-variant-numeric: tabular-nums`, right-aligned.
- Status is a banded mono/uppercase pill (`--successTint` / `--warningTint` /
  `--dangerTint`).
- A live footer count ("60 agents · 42 submitted · 18 draft").
- Long names/values truncate with ellipsis (+ title), never wrap the row.
- Give grid items `min-width:0` and make embedded SVGs (sparklines) responsive,
  or a fixed-width child forces the whole grid to overflow. (Real bug we hit.)

**When to relax the "crafted" bar:** dense tools *should* look utilitarian. Flag
them only for genuine confusion, inconsistency, or carelessness — never for being
plain.

---

## 6. Anti-patterns (additions to the base list)

On top of the base hard rules (no gradient buttons, no mesh-blur, no emoji, no
stock/generated faces, no purple-as-brand, no cool grays):

- No spinners where a skeleton fits. · No "No data" dead ends. · No error toasts
  for load failures. · No `opacity:0` entrance that can strand content. · No
  text on `--inkDim`. · No bare icon buttons without `aria-label`. · No page-level
  horizontal scroll for a wide table (scroll the card). · No one-long-blob
  navigation menu — always sectioned.
