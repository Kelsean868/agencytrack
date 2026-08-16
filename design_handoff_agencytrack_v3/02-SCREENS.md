# 02 — Screens

Every screen shares one frame: `.scr-wrap` (flex column, `overflow:hidden`) with a
`.scr-tool` toolbar at the top. **The toolbar must wrap** (`flex-wrap:wrap`, 8px row
gap) with the eyebrow label `min-width:0` + ellipsis — a fixed `nowrap` toolbar
clipped its own controls twice in this build (`06-DEFECT-CLASSES.md` §4).

---

## Planner

**Purpose** — the day, as it will actually happen. The agent's home.

**Layout** — `main` (grid) + a 300px right rail (`.pl-rail`), collapsible to a
vertical stub button showing the task count.

### Scale × Smart

Two independent controls, not three views:

- **Scale**: Day (`d`) or Week (`w`)
- **Smart** (`s`): a *modifier* that compresses whichever scale you're on

| Combination | Behaviour |
|---|---|
| Day | 8:00–17:00, `ROW_HEIGHT` 96px per hour, absolute positioning from decimal hours |
| Day + Smart | blocks stay proportional to duration; gaps **over the threshold** collapse to one clickable line stating its length; gaps under stay to scale (a 15-minute turnaround is information) |
| Week | 7 columns × the same hour rows |
| Week + Smart | an hour band survives if **any** of the 7 days has something in it; empty bands collapse to a single labelled strip spanning all columns, still droppable on any day |

Compression threshold is a preference (default 45m). Verified: the seeded week goes
628px compressed vs 960px raw.

**When nothing collapses, say so honestly.** "0 empty bands hidden · 0h 0m" made a
working feature look broken; the copy now reads *"Every hour has something in it —
nothing to hide, tightened to fit one screen."*

### Event blocks

`.ev` → `.ev-top` (code chip · time · status pill) + title + `.ev-who` + actions.

- **Family hue** per activity code (see `05-DESIGN-TOKENS.md`) as a tinted background
  and a left rail.
- **Overlap is resolved, not painted over.** `layoutSlots` assigns each event a lane;
  a cancelled block collapses to a **26px tombstone** and a live block offsets below
  it. This offset must survive smart compression — it was lost once and the cancelled
  CI stacked on its replacement.
- **`.ev-time` never shrinks** (`flex:0 0 auto`). The status pill shrinks instead,
  abbreviating to `CXL` / `PSTP` in narrow week columns, full word in day views. Both
  carry `title`. Rationale: a crushed time is unrecoverable; a status word is one of
  two known values.
- `.ev-who` uses **true line clamping via height, not `-webkit-line-clamp`** — as a
  flex child, `display:-webkit-box` blockifies and the clamp silently dies. Text is
  either fully rendered or withheld, never sliced. Every truncating name carries a
  `title`.
- **Play/pause** on the running block (measures real duration).
- **Prep badge** on AI · FFI · CI · JC blocks showing `PREP · n OF 4`.

### Drag to schedule

Drag a task from the rail onto the grid. `onDragOver` computes the hour from
`clientY` against the row height, snapped to 30 minutes, clamped 8–17. A drop calls
`scheduleTask(task, hour)`: the task leaves the rail and becomes an event.

### Action plan rail

Unbooked tasks (`.ti`) with code chip, duration, title, priority; a month strip; and
counters. Collapses via `]` to `.rail-stub`. Add-task inline. Every task is draggable.

---

## Dialer

**Purpose** — work a queue top to bottom without deciding what to do next.

**Layout** — queue list (left) + the live call card (right, dominant).

- **Queue rows** — avatar, name, need · source, attempt count, cycle badge. The
  active row grounds on `--surfaceMute` with a teal border + 3px left rail — **not**
  a teal wash (that failed contrast; see §1 of DEFECT-CLASSES).
- **Connect methods** — four, with honest cost:
  - `tel:` — hands off to the device dialer. Ships today, zero infrastructure. Verified format `tel:+18686204471`.
  - **WhatsApp** — `wa.me` with a prepared opener.
  - **Bridge** — provider rings the agent's mobile then joins the client. Cost stated (~TTD 0.20–0.60/min). Gets measured duration + recording.
  - **Softphone** — shown, but recommended last: first thing to break on agency wifi.
- **Live notes** open *with the line* and autofocus, with a word count. Capturing
  during the call, not after, is the whole point.
- **Disposition grid** — `Appointment Set` · `Callback Requested` · `Not Interested`
  · `Left Voicemail` · `No Answer` · `Bad Number`.
- **Wrap-up requires a typed next step** — call / A.I / fact find / closing interview
  / illustration — plus a when. That becomes a real activity-coded task, not a loose
  reminder.
- **Objection rail** keyed to the product in play.
- 3 non-contacts raises the archive prompt inline.

---

## Lead Entry

Single-lead form in three sections — **WHO** / **WHERE IT CAME FROM** / **WHICH
QUEUE** — plus a "just added" side list. Source and need are **required at entry**,
because they come back out in the production report and patching them later never
happens. Queues can be created inline. A success toast offers "Call now" straight
into the dialer.

---

## Bulk Import  (`at-import*.jsx`)

Three steps: **File → Columns → Review & assign.**

1. **File** — drop zone, Excel (SheetJS) or CSV/TSV parsed locally. Delimiter
   sniffing (`,` `;` tab `|`), quoted fields, BOM stripped. Downloadable template.
   A **sample messy list** is provided so the flow can be exercised — agency-style
   headers, four phone formats, duplicates, blanks, off-list values.
2. **Columns** — header row *guessed* (first row where ≥70% of cells are short
   non-numeric labels — this survives export preambles), then auto-mapped by alias
   ("Cell #", "Mobile", "Contact Number" → Phone). Every column overridable; sheet
   picker for multi-sheet workbooks. Cannot advance without a name and a phone.
3. **Review & assign** — per-row verdict: **ready · warn · dupe · error**.
   - Phones normalised to `(868) NNN-NNNN`; 7-digit local numbers get `868`.
   - Dupes detected **against the book and within the file**, reported by row.
   - Off-list need/source fuzzy-matched, else defaulted with a warning.
   - **Distribution**: by column · single agent · round-robin · **balance by open
     load** (fills the lightest current load, recomputing as it goes).
   - Commit logs the batch and per-agent counts, and is **undoable** (`undoImport`
     removes the leads and restores each agent's open count).

---

## Activities

Unified list of **tasks + appointments + call log** with Today · Overdue tasks ·
Overdue appointments · This week · Closed views, plus a type filter.

**Each row closes as its own type.** `KIND_OF` is **derived from
`ACTIVITY_METADATA`** — `icon === 'call'` → call, `ladder`/`meeting`/`mgr` →
appointment, else task — never a hardcoded list. A hardcoded list desynced twice and
destructively deleted appointments via the task closer. A call row hands off to the
dialer with the lead loaded; an appointment row says **"Book the time"**.

---

## Weekly Numbers  (`at-tally.jsx`) — the trust surface

Per day and per week, for each counted activity code: **Evidenced** (read-only,
derived) · **Declared** (typed) · **Counted** (sum) vs the company floor.

The header states the split: *"31 counted · 17 evidenced · 14 declared"* and
*"55% of this week is evidenced"*.

**PC (phone calls) is the hard case, and the rule matters:**

A call block is scheduled **capacity**; a call is the **activity**. Counting one per
block into the same total that receives one per call record sums a container with its
contents. So:

> Each PC/SC block counts `max(its own recorded dial count, the calls itemised inside
> it)`. Calls falling outside every block window are **ad-hoc** and count
> individually. The choice is made **per block**, never per day.

Scoping it per day makes the total go **down** when an agent logs a call, which
punishes exactly the behaviour the ledger exists to reward. Per block, adding a call
can only ever raise the total. Verified monotonic: 8 → 9 → 10 as calls are logged,
row label reading *"8 in blocks + 2 ad-hoc"*.

Every other code is one-per-block — one fact find genuinely is one appointment.

Footer copy (keep it): *"The evidenced column is read-only — it is the record, not an
opinion… Working the dialer can only ever raise the number."*

---

## Pipeline

Six stages — **Approach → Fact find → Closing interview → Application → Delivery →
Client** — as a board with counts. Moving a card triggers the real consequence:
`deliverApplication` / `convertToClient` create a policy through the single
`newPolicy()` factory (with `premium` and `settledDaysAgo`), so a policy delivered
seconds ago is not immediately filed as a persistency problem.

---

## The Book  (`at-book.jsx`)

Business written but **not yet safe**. Three lists, one screen:

- **Delivery register** — issued, not delivered. "Won, not banked." The commission
  isn't yours until it's receipted.
- **Clawback clock** — policies inside the 90-day window, each with a bar of days
  remaining and the commission that reverses on lapse. Seeded: **TTD 10.0K at risk**.
- **Persistency** — premium due or missed at any age, with clawback overlap flagged.

Rows appearing on **two** lists (inside clawback *and* premium missed) render in
danger tone — that intersection is the action for today, and it was previously
invisible. "Chase it" books a real `COLL 30m` block. "Received" is a separate action
that clears the row and logs the commission no longer at risk — there is deliberately
no tick that pretends a premium was saved by ticking.

Commission shown at 40% of first-year API (30% annuity) so the risk is a real sum.
**That rate must become a tenant setting.**

---

## Commission  (`at-commission.jsx`)

Expected commission is **computed** from a contracted rate per product family against
settled API — never typed. Reconciling two typed numbers is comparing two guesses.

Four verdicts: **✓ MATCH** (within tolerance) · **CONFLICT** (short/over-paid, with
the delta) · **NOT PAID YET** (awaiting settlement — deliberately *not* short-paid)
· **UNMATCHED** (a carrier line with no policy on the book).

That last direction matters: a settlement for business that isn't yours, paid into
your unit, is invisible to any system that only reconciles forwards.

**Overpayments are flagged as worse than shortfalls** — a shortfall you can ask for;
an overpayment arrives back without warning.

Raising a query shows the full calculation, logs it, marks the row *queried*, and
holds "n open queries" until the carrier answers. Queries are records, not phone calls.

---

## Game Plan · Unit Desk · Recruit · Who Sees What · Customise

- **Game Plan** — income goal → required activity, back-solved through the funnel.
- **Unit Desk** (`at-manager.jsx`) — per-agent evidenced %, activity vs floor,
  risk rows. Shows **`MOSTLY DECLARED`** when an agent's evidenced share is low —
  which is exactly why the PC scoping bug mattered: a scoping error surfaced to a
  manager as an accusation about an agent.
- **Manager Planner** — adds the unit lane and a three-way hours split: **own /
  manager / development**. Joint calls, one-on-ones, recruiting interviews and unit
  meetings are development hours, not own production (see decision §7).
- **Recruit** — the recruiting ladder; moving a recruit to Career interview books
  `RI 1h`.
- **Who Sees What** (`at-trust.jsx`) — the permissions spec per role. Treat as the
  authorisation requirements doc.
- **Customise** (`at-prefs.jsx`) — 12 settings, defaults stated, per-row reset,
  global reset, persisted. **Three rows are marked `RECORDS`** and set apart, because
  switching off live notes or the wrap-up follow-up thins the records. See decision §11
  for the open two-tier question.

---

## Mobile  (`at-mobile.jsx`)

390×844. Four tabs + More (`MobileTab`, More always slot five, 44px+ targets,
`env(safe-area-inset-bottom)` respected).

- **Day** — a list, next appointment marked.
- **Dialer** — whole screen, one card: `tel:` at **52px**, WhatsApp beneath,
  disposition grid, notes, log-and-next.
- **Pipeline** — one stage at a time.
- **The Book** — only what needs chasing.
- **More** — sections mirroring the desktop sidebar. Desktop-only screens are
  **labelled `desktop`** rather than shipped as a nine-column table that would lose
  columns on a phone.
