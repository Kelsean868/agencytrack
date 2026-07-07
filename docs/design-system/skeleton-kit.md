# Panel Skeleton Kit

Reusable loading-state primitives for the app. One import
(`src/components/ui/PanelSkeleton.jsx`) gives a panel a skeleton that reserves the
**real structural footprint** of the content it stands in for, so when data
resolves the content fills *in place* — no layout jump, no post-entrance pop-in.

**Provenance.** Extracted and generalized from the field-measured Game-Plan
skeleton work (PR #825, branch `feat/gp-skeleton`), which the #830 recon
concluded was the systemic fix for loading-state pop-in across panels. The
Game-Plan-specific compositions were left behind; only the reusable core is here.

> **Status: kit only — not yet wired into any panel.** This is the primitive for
> the pending pop-in rollout, which applies it panel-by-panel (operator-driven,
> per-screen). Importing it into a live surface is rollout work, not part of this
> kit.

---

## What's in the kit

| Export | Kind | Use for |
|--------|------|---------|
| `PanelSkeleton` (default) | scaffold | Reserve a whole panel's shape while it loads |
| `SkeletonText` (named) | inline value slot | Hold a single value's box inside already-present structure |
| `Skeleton` (named) | atomic block | Compose a bespoke placeholder the presets don't cover |

All three are reduced-motion-safe and decorative to assistive tech (the pulse
never announces); `PanelSkeleton` additionally wraps its content in a
`role="status"` live region so the *loading state itself* is announced.

---

## `PanelSkeleton` — preset scaffolds

```jsx
import PanelSkeleton from '../ui/PanelSkeleton';

if (loading) return <PanelSkeleton variant="card-grid" count={4} />;
```

### Props

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `variant` | `'list' \| 'card-grid' \| 'metric-row' \| 'table'` | `'list'` | Panel shape. Unknown → falls back to `list`. |
| `count` | `number` | per-variant (4, 4, 4, 5) | Repeated units: rows / cards / metrics / body rows. Clamped ≥ 0. |
| `columns` | `number` | `4` | Cells per row — **`table` only**; ignored otherwise. Clamped ≥ 1. |
| `label` | `string` | `'Loading…'` | Accessible loading label on the status region. |
| `className` | `string` | `''` | Passthrough on the status wrapper. |

### Variants

| Variant | Shape | Box reserved | Fits |
|---------|-------|--------------|------|
| `list` | Vertical stack of full-width rows | `h-14` rounded rows | Feeds, item lists, stacked cards |
| `card-grid` | Responsive grid (2-up mobile → 4-up ≥sm) | `h-24` cards | KPI card grids, medal / badge grids |
| `metric-row` | Single row of equal-width slots (stacks on mobile) | `h-16` slots | Anchor / metric strips |
| `table` | Header bar + `count` rows × `columns` cells | `h-10` header, `h-11` cells | Master Sheet, ledgers, dense tables |

---

## `SkeletonText` — geometry-stable value slot

For an inline value (a metric, count, currency figure) whose surrounding
structure is **already on screen** — you want to hold the *number's* box, not the
whole panel's. The trick: the **same `<span>` renders in both states**, so
loading → ready is a text-content + className swap, never a node insert/remove.
Width is reserved with `min-width` in `ch` + `tabular-nums`, so the shimmer
occupies the width the real figure will take and nothing shifts when it lands.

```jsx
import { SkeletonText } from '../ui/PanelSkeleton';

<p className="text-2xl font-semibold">
  <SkeletonText loading={loading} reserveCh={7}>
    {formatCurrency(annualAPI)}
  </SkeletonText>
</p>
```

| Prop | Type | Notes |
|------|------|-------|
| `loading` | `boolean` | `true` → reserved placeholder; `false` → children |
| `reserveCh` | `number?` | `min-width` in `ch` reserving the real value's width (both states) |
| `className` | `string` | Passthrough (applied in both states) |
| `children` | node | The real value (shown when not loading) |

Pick `reserveCh` from the widest value the slot will realistically show (e.g. a
currency figure like `$12,345` ≈ 7 ch). Over-reserving leaves a gap; under-
reserving reintroduces the shift the primitive exists to prevent.

---

## `Skeleton` — atomic block

The building block behind every preset. Decorative (`aria-hidden`),
motion-safe-pulsing, muted-filled. Pass layout classes (height, radius, width):

```jsx
import { Skeleton } from '../ui/PanelSkeleton';

<Skeleton className="h-28 w-full rounded-2xl" />
```

The pulse lives **only** on this atom, so it's the single source of the
animation — every preset variant inherits reduced-motion safety from it.

---

## Reduced motion

Every pulse uses Tailwind's `motion-safe:` variant
(`motion-safe:animate-pulse`). Under `prefers-reduced-motion: reduce` the pulse
does not apply — the skeleton renders as a static muted placeholder, still
reserving the same footprint. This is an improvement over the ad-hoc
`animate-pulse` (no `motion-safe:`) scattered across current panels, which
animates regardless of the user's motion preference.

---

## Design-system reconciliation (rollout decisions)

Two deliberate deltas vs [`guidelines/redesign-addendum.md`](guidelines/redesign-addendum.md) §1.
Both are flagged for the operator to settle at rollout, not silently baked in:

1. **Fill = `bg-surface-muted` + pulse, not the `--skeleton` gradient.** The
   addendum says "Skeleton fill uses `--skeleton`." That token is a
   `linear-gradient` shimmer animated via `background-position`, which does not
   compose with the pulse (opacity) model this kit uses. The pulse model is what
   PR #825 field-measured and what this brief specified. Switching the kit to the
   gradient token (with a sweep keyframe) is a viable rollout-time change — it
   would centralize on the canonical token — but it is a design decision, not a
   mechanical swap.
2. **Variant vocabulary.** The addendum names archetypes `cards` / `table` /
   `timeline` / `detail`; this kit ships `list` / `card-grid` / `metric-row` /
   `table` (the brief's set). `card-grid`≈`cards` and `table`=`table` line up;
   `timeline` and `detail` have no direct variant yet (compose from `Skeleton`,
   or add variants during rollout).

---

## Full usage example

```jsx
function TeamPanel({ loading, error, members }) {
  if (loading) return <PanelSkeleton variant="list" count={5} label="Loading team…" />;
  if (error)   return <InlineError onRetry={refetch} />;
  if (!members.length) return <EmptyState … />;
  return <MemberList members={members} />;
}
```

The skeleton and the real list share the same outer footprint, so the entrance
animation plays over a structurally-complete placeholder and the swap to real
rows is a low-delta, in-place fill.
