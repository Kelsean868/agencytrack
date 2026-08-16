# 08 — Open items and known limitations

Stated honestly. Nothing here is hidden in a "future work" footnote.

---

## Genuinely unfinished

### 1. The prep grid badge does not render
The prep checklist itself works and persists (`PREP · 2 OF 4 → 3 OF 4` verified on the
appointment overlay). But its at-a-glance badge on the planner **block** does not
render on seeded events — the container row isn't rendering at all.

That badge was the actual value of the feature: *"an unprepped joint call tomorrow is
visible."* Without it, prep is something you find only by opening the appointment. The
checklist logic is correct; the grid affordance needs building.

**Related:** the pre-existing static "Prep" tag said "Prep" whether anything was
prepped or not. It has been converted to report real state — so if you see a stale
implementation reference, prefer the state-reporting version.

### 2. Print surfaces — not started
Weekly WAR · Agent Report · Master Sheet · Production Report. All four are specified
by the data model and all the data now exists in the store, but none is built. See
`07-BUILD-ORDER.md` Phase 7 — and build them as print-owning documents from the start
rather than screen views with print CSS.

### 3. Preferences: personal vs unit policy — needs a product decision
Twelve settings are personal and persisted, with three marked `RECORDS` because
disabling them thins the evidence trail. **Whether a manager can lock those three is
undecided.** If unit contact rate depends on notes being captured, they must be
lockable — which means a two-tier model (unit policy over personal preference).

Decide before launch. Retrofitting a lock onto a setting agents already rely on is a
much worse conversation than never offering it.

---

## Deliberately deferred, with the reasoning already made

| Item | Status |
|---|---|
| **Telephony bridge** (measured duration + recording) | Costed at ~TTD 0.20–0.60/min. Add when duration and recording justify it; `tel:` + WhatsApp cover day one. |
| **Browser softphone** | Shown as an option but recommended last — first thing to break on agency wifi. |
| **Commission on a phone** | Labelled `desktop` in the More sheet rather than reflowed. A nine-column reconciliation that silently drops columns is worse than being told to open a laptop. |

---

## Hardcoded values that must become tenant settings

These are in the prototype as constants and will be wrong for the second tenant:

- Commission rate **40%** first-year API (life/term), **30%** (annuity)
- Clawback window **90 days**
- Company activity floor (**PC 20/week** and the per-code targets in `at-tally.jsx`)
- Archive threshold **3** consecutive non-contacts; max **2** archive cycles
- Working day **08:00–17:00**
- Smart-compression threshold **45 minutes** (this one is a user preference, not tenant)
- Phone normalisation assumes **Trinidad & Tobago** (`868`, 7-digit local numbers)

---

## Prototype-only, do not build

- The `.hz` harness bar (role switch, screen tabs, sync pill, Desktop/Mobile toggle,
  Dark/Light). Dark mode and the real shortcuts (`d w s f [ ]`) **are** product; the
  rest is a demo rig.
- `currentHour` / `autoAdvance` — a fake clock so the "now" line can be demonstrated.
  Production reads the real clock.
- Seed data: the fictional Wednesday 1 July 2026, `SEED_LEADS`, `WEEK_EVENTS`,
  `SAMPLE_ROWS`, `AGENTS`. The **sample import list is worth keeping** as a fixture —
  it encodes the real messiness (four phone formats, duplicates across the book and
  within the file, off-list values, export preamble rows) and makes a good test case.
- Roles as a switch. In production they are session claims; `at-trust.jsx` is the
  authorisation spec.

---

## Not verified

- **Real fullscreen behaviour across browsers.** The Fullscreen API path works in the
  preview environment; Safari's prefixed behaviour and iOS's lack of element
  fullscreen are untested.
- **Excel parsing at volume.** SheetJS handles the sample workbooks; multi-thousand-row
  files with merged cells and multiple header bands are untested. The CSV path is the
  safer default and the drop zone says so.
- **Drag-to-schedule on touch.** The planner drag is mouse/pointer `dragstart` based.
  Mobile does not offer drag-to-schedule at all, which is probably correct, but if you
  want it, it needs a different interaction (long-press + move, or tap-to-place).
- **Print output.** Nothing has been through a print engine.

---

## Where the design system needs additions

1. **Icons** — `play`, `pause`, `grip`, `chevron`, `alert`, `upload` are missing and
   are currently drawn inline. Add them to the set.
2. **A dark-mode-safe "solid brand fill" pattern.** Five defects came from ink on
   `--teal`. The DS should ship a single class (or token pair) that owns the correct
   ink for a teal fill in both themes, so consumers stop re-deriving it.
3. **`Topbar` has one internal contrast failure in light mode** that a consumer cannot
   fix without overriding the component. Left alone deliberately — it needs a design-system
   change, not an app-level override.
4. **A tinted-surface ink guideline.** `--inkFaint` is AA-correct on `--surface` but
   drops to ~4.1:1 on family tints. The DS should say so, or ship a tint-safe faint ink.
