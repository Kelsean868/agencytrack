# 04 — Decisions and their reasons

Each entry: **what was chosen**, **why**, and **what was rejected**. Where a decision
was reversed during the build, that is stated — the reversal is usually the most
useful part.

---

## §1 Sidebar collapsed by default

**Chosen** — the desktop sidebar starts collapsed (icons + floating badges), expands
on the chevron, and persists nothing.

**Why** — the planner grid is the screen the agent lives in, and every pixel of
column width improves it. An agent navigates a handful of times a day and reads the
grid continuously. Optimise for the continuous act.

**Rejected** — expanded by default (the conventional choice) and remembering the last
state. Remembering sounds friendlier but produces an inconsistent first screen
between devices, and the collapsed rail already shows active state via a teal left
border, so nothing is lost.

---

## §2 Focus mode uses the real Fullscreen API

**Chosen** — `f` requests actual fullscreen on the frame, and listens for
`fullscreenchange` to reconcile state.

**Why** — a fake fullscreen (CSS `position:fixed` over the viewport) still shows
browser chrome and the OS taskbar, which is the thing an agent is trying to escape
during a call block. And without the `fullscreenchange` listener, pressing Escape
leaves the app's state lying about whether it's in focus mode.

---

## §3 The action-plan rail collapses to a stub, not to nothing

**Chosen** — collapsing leaves a vertical stub button with the label and the task
count.

**Why** — a fully hidden panel is a panel the agent forgets, and unbooked tasks are
exactly the thing that must not be forgotten. The count is the reminder.

---

## §4 One shared store, not per-screen state

**Chosen** — a single store with **named business actions** as the only mutation path.

**Why** — the product claim is "the app already knows what you did". That claim is
only true if a call outcome can create a planner task without either screen knowing
about the other. Business actions are where those rules live. Per-screen state would
have forced every rule into a component, and the rules would have drifted.

**Consequence to keep in production** — screens never mutate state directly. Adding a
screen means adding actions, not adding rules to components.

---

## §5 Smart is a modifier, not a third view  *(reversed mid-build)*

**Originally** built as Day / Smart / Week — three mutually exclusive views.

**Reversed to** — Scale (Day | Week) × Smart (on | off), all four combinations valid.

**Why the reversal** — "Smart" isn't a *scale*, it's a *treatment of empty time*. As
a third view it forced a false choice: an agent who wanted a compressed **week** had
no way to ask for one. As a modifier, Smart + Week became the most useful combination
in the product (the whole week on one screen with empty bands collapsed).

**Migration note** — a stored preference of `view: 'smart'` is migrated to
`scale: 'day', smart: true` so an existing choice is honoured rather than reset.

---

## §6 Compressed time collapses gaps but keeps small ones to scale

**Chosen** — gaps over the threshold (default 45m) collapse to one labelled,
droppable line; gaps under stay proportional.

**Why** — a 15-minute turnaround between two appointments is *information*: it tells
the agent they cannot take a call in between. Collapsing it would delete a fact. A
3-hour hole is not information, it's just distance.

---

## §7 Joint calls, one-on-ones, recruiting interviews and unit meetings are development hours

**Chosen** — `JC` / `ONE` / `RI` / `UM` carry `mgr` + `dev` flags and are excluded
from a manager's own production hours, counted in a separate development bucket.

**Why** — a manager coaching an agent is doing the job. If coaching lands in own
production, the metric rewards a manager for *not* coaching, and "% yours" rises when
they spend a day in the field with a struggling agent. That's an incentive pointed
backwards.

**Bug this exposed** — all three joint-call creators (`escalateLead`,
`bookJointCall`, `answerJointOffer`) emitted `MTG`, which has no flags. Booking
coaching *raised* "% yours". Retyping them to `JC` fixed the inversion — and then
broke the Activities classifier, which had its own hardcoded list. See
`06-DEFECT-CLASSES.md` §3.

---

## §8 Telephony: ship the deep links, price the rest honestly

**Chosen** — four connect methods, two shipping immediately:

| Method | Verdict |
|---|---|
| `tel:` | **Ship.** Zero infrastructure, hands off to the device dialer. |
| WhatsApp `wa.me` | **Ship.** Prepared opener. Already the pattern in the existing codebase's `RunningLateSheet`, so it's proven, not a compromise. |
| Bridge (provider rings agent, joins client) | **Add when measured duration + recording are worth ~TTD 0.20–0.60/min.** |
| Browser softphone | **Recommend last.** First thing to break on agency wifi. |

**Why** — the two free methods deliver 90% of the value on day one. Showing all four
*with cost stated* is better than four buttons where two are dead, and better than
hiding the options and having the question re-litigated later.

---

## §9 Mobile is a different information model, not a reflow

**Chosen** — a separate component tree at 390×844 sharing the store and tokens; four
tabs + More; desktop-only screens **labelled "desktop"** in the More sheet.

**Why** — the phone use case is not "the desktop app, narrower". It's: *I'm in the
car between appointments.* That means the dialer is the whole screen with a 52px
`tel:` target, the Book shows only what needs chasing, and Pipeline shows one stage at
a time. Reflowing the nine-column commission table onto a phone would silently drop
columns, and a reconciliation you can't see all of is worse than one you're told to
open on a laptop.

**Chosen also** — the frame carries `class="nexus" data-view="mobile"` and inherits
app tokens. An earlier version defined its own mobile palette, which drifted from the
app in 7 light / 11 dark values — including `--surfaceMute` reading *lighter* than
`--surface` in dark mode, inverting elevation on the phone alone.

---

## §10 Prep is a property of the appointment, not an activity

**Chosen** — a 4-item checklist (fact find read back · illustration ready · objection
thought through · route confirmed) on the appointment's own overlay, for AI · FFI ·
CI · JC. **No activity code, no floor credit.**

**Why** — a prep block booked separately is the first thing dropped when the day
slips. Prep attached to the appointment travels with it. And giving prep floor credit
would let an agent hit their activity number by preparing for appointments they never
run.

---

## §11 Preferences are personal — but some shouldn't be  *(open question)*

**Chosen for now** — 12 personal settings, persisted, with per-row and global reset.
**Three are marked `RECORDS`** and visually set apart, because switching off live
notes or the wrap-up follow-up thins the evidence trail.

**The open question, and it needs a product decision before launch** — if unit
contact rate depends on notes being captured, a manager needs to *lock* those rows.
That's a two-tier model: **unit policy over personal preference**. It is much easier
to decide now than after agents have grown attached to settings a manager will later
take away.

---

## §12 Copy is part of the design

Several strings are load-bearing and should ship verbatim:

- **"Won, not banked."** — the delivery register's whole argument in three words.
- **"It's the record, not an opinion."** — why the evidenced column is read-only.
- **"Working the dialer can only ever raise the number."** — the monotonicity
  promise, stated to the agent, so the ledger is trusted.
- **"Every hour has something in it — nothing to hide, tightened to fit one screen."**
  — a working feature reporting an empty result honestly rather than looking broken.
- **"8 in blocks + 2 ad-hoc"** — the row naming its own composition, so a mixed
  derivation is never ambiguous.

Numbers that are computed should say what they were computed from. Every derived
figure in this build carries its source in the UI. That habit is why the two
monotonicity bugs were findable at all.

---

## §13 Overpayments are worse than shortfalls

**Chosen** — a settlement paid *over* expected is flagged more urgently than one paid
under.

**Why** — a shortfall is money you can ask for, on your timetable. An overpayment is
money that will be reclaimed on the carrier's timetable, usually by deduction from a
future statement, with no warning. Agents plan around the statement they received.

---

## §14 Reconcile in both directions

**Chosen** — an `UNMATCHED` verdict for a carrier settlement line with **no policy on
the book**.

**Why** — every reconciliation tool checks "did I get paid for my business". Almost
none check "was I paid for business that isn't mine". A settlement paid into your unit
for someone else's policy is invisible to a forwards-only reconciliation, and it's the
error most likely to be clawed back months later.

---

## §15 Every consequence is a real object

**Chosen** — actions create records, not flags:

| Action | Creates |
|---|---|
| Chase a premium | a `COLL 30m` block in the action plan |
| Escalate a lead | a `JC 1.5h` joint call |
| Move a recruit to Career interview | an `RI 1h` block |
| Callback requested | a `PC 30m` task |
| Appointment set | an `FFI 1h` task |
| Raise a commission query | a query record with the full calculation |

**Why** — a boolean `chased: true` tells you someone intended something. A `COLL`
block on Thursday at 2pm tells you when it will happen, counts toward the floor when
it does, and shows up as unbooked work if it doesn't. There is deliberately **no tick
box that marks a premium saved**, because ticking a box does not save a premium.
