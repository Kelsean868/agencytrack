# 06 — Defect classes and standing rules

This build went through many review cycles. Nearly every defect fell into one of four
classes. **Read this before writing code** — these are cheap to prevent and expensive
to find, and three of them produced defects that reported *wrong business numbers to a
manager*, not just visual problems.

---

## §1 Ink on a brand or semantic fill, unchecked in dark mode

**Five occurrences.** The most reliable defect class in the codebase.

`--teal` brightens from `#01696F` to `#4AB5B8` in dark mode. Any hard-coded `#fff`
on it inverts. Occurrences: the money card, `.ap-send`, the active segment, the
selected month cell, and — worst — the **skip link**, whose only audience is keyboard
users, so the one state that ever renders was the one that failed (2.44:1).

**Standing rule**
> Anything painted on `--teal` or a semantic fill must have its ink checked in **both**
> themes, **including states that only appear on focus, hover or disabled**. Fix the
> **ink** (`.nexus.dark .thing{color:var(--bg)}`), never the fill.

**Add to CI** — a contrast sweep over every element with a non-transparent background,
in both themes, that also visits `:focus-visible` and `:disabled`. Every one of these
five would have been caught automatically.

---

## §2 Silent fallbacks

The design system's `Icon` resolves `NAME_PATHS[name] || NAME_PATHS.grid`. Five names
the prototype used (`play`, `pause`, `grip`, `chevron`, `alert`) aren't in the set, so
five distinct glyphs silently rendered as a grid icon — including **Cancel**, which
showed a grid where an alert belonged.

**Standing rule**
> A lookup with a `||` default must either log or throw in development. A fallback
> that renders something plausible is worse than one that renders nothing.

**Action for production** — add `play`, `pause`, `grip`, `chevron`, `alert`, `upload`
to the real icon set rather than passing inline children.

---

## §3 Two sources of truth for the same fact  — the expensive class

Every regression in the later phase came from a hardcoded list that had a twin
somewhere else:

| Defect | The twin |
|---|---|
| PC counted blocks *and* calls into one total | container vs contents |
| PC exclusion scoped per **day** instead of per **block** | logging a call made the count go **down**, pushing an agent under the company floor |
| `KIND_OF` hardcoded `['AI','FFI','CI','MTG','SEM','TRADE']` | vs `ACTIVITY_METADATA`; new codes fell through to the **task** closer, which *deleted* appointments |
| Joint-call creators emitted `MTG` | vs the `dev`-flagged `JC`; booking coaching **raised** "% yours" |
| Policies created without `premium` / `settledDaysAgo` | vs `newPolicy()`; a policy delivered seconds ago was filed as a persistency problem |
| A metric's fallback vs its seed; the floor denominator vs its exception | same shape |

Note what these have in common: **each one surfaced to a manager as a fact about an
agent.** The per-day scoping bug fired `MOSTLY DECLARED` against a named agent
because of a scoping error. That is the real cost of this class.

**Standing rules**
> 1. **Derive, don't list.** Classifiers, colours, counters and filters all read
>    `ACTIVITY_METADATA`. A new activity code must require **zero** other edits.
> 2. **One factory per entity.** `newPolicy()` is the only way a policy is created.
> 3. **Never store what you can derive.** Verdicts, totals, queue membership, and
>    hours splits are all computed at read time.
> 4. **Test monotonicity.** For any derived count that represents work done:
>    `f(state + record) >= f(state)`. Assert it as a property test.

---

## §4 Fixed-width containers that grow

Toolbars clipped their own controls twice: the Activities `.scr-tool` overflowed by
27px (a filter button half-clickable) and the harness `.hz` by **409px** (controls
past "Commission" clipped entirely, canvas pushed into horizontal scroll). Both were
`nowrap` rows that had accumulated children over many turns.

Also in this class: sibling grids drifting ~2px per column because a sticky header
outside the scroll container resolved `1fr` against a different width than the body
inside it.

**Standing rules**
> - Any row that will accumulate children over time **wraps**. Add `flex-wrap:wrap` +
>   a row gap the day you create it, not the day it breaks.
> - Give the flexible label `min-width:0` + ellipsis so it yields before the row wraps.
> - Never let a sticky header be a **sibling** of the grid it heads. Same grid, first
>   row, `position:sticky`.
> - **Name the shrink victim** explicitly. Times and figures never shrink; status
>   words shrink and abbreviate, with a `title`.

---

## §5 Process notes — how to review this kind of work

Two things that made review effective and are worth carrying into the implementation:

**Measure, don't look.** Every fix above was confirmed by querying computed style and
bounding boxes, in both themes, before and after — not by screenshot. Contrast ratios,
overflow in px, monotonicity across a logged call. Several defects (the skip link, the
disabled button, the per-day scoping) are **invisible in a screenshot of the default
state**.

**One decisive fix at the root cause, not a numeric tweak.** When a fix required
changing the same numeric property twice, that was always a sign the diagnosis was
wrong. State the cause in one sentence first; if you can't, you don't have it yet.

**And one hard-won engineering rule, from the worst mistake in the build:**

> Never `slice(indexOf(a), indexOf(b))` on a file without asserting both indices are
> `> -1`. A missing needle returns `-1`, `slice(start, -1)` swallows the rest of the
> file, and a "targeted fix" silently destroyed two-thirds of a stylesheet — which was
> then reported as clean because the change *looked* surgical.
