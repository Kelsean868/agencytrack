# CLAUDE.md — AgencyTrack implementation rules

Drop this at the root of the target repo (or merge into an existing `CLAUDE.md`). It
is the short version of `06-DEFECT-CLASSES.md` — the rules that were learned the
expensive way.

## Non-negotiables

1. **`ACTIVITY_METADATA` is the only source of truth for activity codes.** Colours,
   classifiers, counters, filters and prep-capability all derive from it. Adding a new
   code must require **zero** edits anywhere else. Every regression in prototyping came
   from a hardcoded list that had a twin.

2. **Derived, never stored.** Verdicts, totals, queue membership, hours splits and
   ledger figures are computed at read time. Never cache a number you can derive.

3. **Monotonicity is a test, not a hope.** For any derived count representing work
   done: `f(state + record) >= f(state)`. This was violated twice, and both times a
   manager-facing screen accused a named agent because of a scoping bug.

4. **One factory per entity.** `newPolicy()` is the only way a policy is created. Same
   pattern for any entity with derived fields.

5. **Evidenced and declared are never blended.** Separate columns, provenance stated in
   the UI, percentage evidenced always visible. Derived figures say what they were
   derived from ("8 in blocks + 2 ad-hoc").

6. **Ink on `--teal` or any semantic fill must be checked in both themes**, including
   `:focus-visible` and `:disabled` states. `--teal` is *brighter* in dark mode. Fix
   the ink (`.dark .thing{color:var(--bg)}`), never the fill. Five defects, one of them
   in a keyboard-only state.

7. **Rows that accumulate children wrap.** `flex-wrap:wrap` + row gap on toolbars from
   day one. Flexible labels get `min-width:0` + ellipsis.

8. **Name the shrink victim.** Times and figures `flex:0 0 auto`; status words shrink
   and abbreviate with a `title`. Never let a time be crushed.

9. **No `-webkit-line-clamp` on a flex child** — it blockifies and dies silently.
   Clamp by height; always pair truncation with `title`.

10. **A sticky header lives inside the grid it heads**, as the first row — never as a
    sibling grid, which drifts against the scrollbar.

11. **Silent fallbacks throw in development.** `LOOKUP[x] || DEFAULT` must log or throw.
    A fallback that renders something plausible is worse than one that renders nothing.

12. **Never `slice(indexOf(a), indexOf(b))` without asserting both are `> -1`.** A
    missing needle returns `-1` and `slice(start, -1)` eats the rest of the file.

## Product rules that look like implementation details but aren't

- **Every consequence is a real object.** Chasing a premium creates a `COLL` block, not
  a `chased: true` flag. There is no tick box that marks a premium saved.
- **A call block is capacity; a call is activity.** Never sum a container with its
  contents. The per-block `max(dials, itemised)` rule is in `03-DATA-MODEL.md`.
- **Coaching is not own production.** `JC`/`ONE`/`RI`/`UM` are development hours.
- **Prep is a property of an appointment**, never an activity with floor credit.
- **Reconcile in both directions** — an unmatched carrier line matters as much as an
  unpaid policy.
- **Copy is design.** Ship the strings verbatim; several of them *are* the feature.

## Review method

Measure, don't look. Query computed style and bounding boxes in both themes before and
after every fix. Several real defects here are invisible in a screenshot of the default
state. State the root cause in one sentence before editing — if you can't, you don't
have it yet, and tweaking the same numeric property twice means the diagnosis is wrong.
