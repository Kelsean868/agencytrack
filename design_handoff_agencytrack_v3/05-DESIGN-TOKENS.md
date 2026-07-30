# 05 — Design tokens

**All values come from the bound AgencyTrack design system**
(`_ds/agencytrack-design-system-<id>/tokens/app.css`), not from this prototype. Read
them from the design system in production — do not copy hex values into components.
The list below is for reference and for the derived rules that matter.

## Core palette (light → dark)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | warm off-white | `#1A1613` | page |
| `--surface` | white | `#252019` | cards, panels |
| `--surfaceMute` | warm grey | `#1F1B17` | recessed / active rows |
| `--ink` | near-black | warm off-white | body text |
| `--inkMute` | mid grey | mid warm grey | secondary |
| `--inkFaint` | `#7A7264` | | tertiary — **AA-corrected value, 4.7:1 on `--surface`** |
| `--teal` | `#01696F` | **`#4AB5B8`** | brand |
| `--tealDark` | `#014E52` | | |
| `--tealTint` | `#E6F4F4` | 14% alpha wash | |
| `--gold` | `#B07D1A` | | recognition |
| `--success` / `--successTint` | | | kept, matched |
| `--warning` / `--warningTint` | | | at risk, declared |
| `--danger` / `--dangerTint` | | | lapse, conflict |
| `--rule` / `--ruleStrong` | | | borders |

## The single most important token rule

> **`--teal` is BRIGHTER in dark mode (`#01696F` → `#4AB5B8`).** Any hard-coded light
> ink on a teal or semantic fill inverts and fails contrast in dark mode.

This produced **five separate defects** in this build (money card, `.ap-send`, active
segment, selected month cell, and the skip link). Every one was fixed by making the
**ink** theme-aware, never by changing the fill:

```css
.thing { background: var(--teal); color: #fff }
.nexus.dark .thing { color: var(--bg) }     /* ← the fix */
```

Dark-mode semantic tints are **alpha washes** over the card's own tint, so a semantic
ink on its own tint composites too close together. For small text on a tint, ground
the element on `--surface` with a semantic **border** instead of a tint fill.

Measured outcomes after fixing: money card 2.4:1 → **7.4:1** · skip link 2.44:1 →
**7.36:1** · disabled mobile save 1.18:1 → **4.99:1** light / **7.82:1** dark ·
warn chips 4.46 → **5.02:1**.

## Family hues

Activity codes are grouped into families, each with a hue used as a **tinted block
background + left rail** on the planner grid. The mapping lives in
`ACTIVITY_METADATA` (`planner-v3-data.jsx`) — read it from there.

| Family | Codes |
|---|---|
| calls | `PC` `SC` |
| selling | `AI` `FFI` `CI` |
| prospecting | `SEM` `TRADE` |
| meeting | `MTG` |
| service | `COLL` |
| development | `JC` `ONE` `RI` `UM` |
| admin | `ADMIN` |

**Small text never sits on a family tint** at `--inkFaint`; on a tint it drops to
~4.1:1. Use `--inkMute` or ground the element on `--surface`.

## Type

Design-system stacks only: `var(--sans)` for UI, `var(--mono)` for codes, times,
policy numbers, and every figure in a ledger. Monospace for numbers is not
decoration — columns of figures must align for a manager to scan them.

| Role | Size | Weight |
|---|---|---|
| Screen title (Topbar) | 20px | 600 |
| Section eyebrow (`.pf-eb`, `.scr-eyebrow`) | 11px | 600, tracked, uppercase |
| Body | 14px | 400 |
| Event title | 13px | 600 |
| Event meta (`.ev-who`, `.ev-time`) | 12px | 500 |
| Code chip | 10–11px mono | 700 |
| Ledger figure | 15px mono | 600 |
| Fine print (`.rc-fine`) | 12px | 400, `--inkMute` |

## Spacing · radius · elevation

- Spacing: **4px base** — 4 · 8 · 12 · 16 · 20 · 24 · 32
- Radius: 6px (chips, inputs) · 8px (blocks, rows) · 10–12px (cards) · 14px (frame)
- Mobile frame: 390×844 content, 9px bezel, **38px** outer radius
- Grid row height: **96px per hour**; cancelled tombstone **26px**
- Right rail: **300px**; mobile bottom bar **61px** + 14px + `env(safe-area-inset-bottom)`
- Elevation is `--surface` over `--bg` plus a border. Shadows only on overlays and
  the mobile sheet.

## Layout rules that are load-bearing

1. **Sibling grids never share a column definition.** A sticky header outside the
   scroll container resolves `1fr` against a different width than the body inside it
   (scrollbar), drifting ~2px per column. Put the header **inside** the same grid as
   the first row, `position:sticky; top:0`.
2. **Toolbars wrap.** `.scr-tool` / `.hz`: `flex-wrap:wrap` + 8px row gap; the label
   gets `min-width:0` + ellipsis so it yields before anything wraps.
3. **Never `-webkit-line-clamp` on a flex child** — it blockifies to `flow-root` and
   the clamp silently dies. Clamp by height, and always pair truncation with `title`.
4. **Name the shrink victim.** In a row of fixed + flexible children, decide
   explicitly which element loses space. Times and figures get `flex:0 0 auto`;
   status words shrink and abbreviate.
5. **Reserve space for absolutely-positioned DS chrome.** `MobileTab` is `absolute`;
   the consumer pads for it.
