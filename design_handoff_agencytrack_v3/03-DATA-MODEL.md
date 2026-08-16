# 03 — Data model

## The central contract: derived vs declared

Every number an agent is judged on carries a provenance. There are exactly two:

- **Evidenced** — derived from a record the system holds (a call log entry, a kept
  appointment, a settled policy). **Read-only. Never editable, never typeable.**
- **Declared** — typed by the agent for activity the system could not see.

They are shown in **separate columns** and never blended. The percentage evidenced is
shown to both agent and manager. This one rule is what makes the ledger trustworthy
to a manager and non-punitive to an agent, and it is load-bearing for the whole
product — if you blend them, you have a spreadsheet with a login.

**Corollary that must hold in code:** adding activity can never reduce evidence.
Any derivation that can decrease when a record is added is wrong — see the PC rule
below and `06-DEFECT-CLASSES.md` §3.

---

## Activity codes — `ACTIVITY_METADATA` (`planner-v3-data.jsx`)

The single source of truth. Every classifier, colour, counter and filter **derives
from this table**. Do not maintain a parallel list anywhere.

| Code | Meaning | Family | Flags |
|---|---|---|---|
| `PC` | Phone calls | calls | `icon:'call'` |
| `SC` | Seen call — a contact made (reached the person) | calls | `icon:'call'` |
| `AI` | Approach interview | selling | prep-capable |
| `FFI` | Fact find interview | selling | prep-capable |
| `CI` | Closing interview | selling | prep-capable |
| `MTG` | Meeting | meeting | `meeting` |
| `SEM` | Seminar | prospecting | |
| `TRADE` | Trade show | prospecting | |
| `COLL` | Collection / premium chase | service | |
| `ADMIN` | Admin | admin | not counted to floor |
| `JC` | **Joint call** | development | `mgr`, `dev`, prep-capable |
| `ONE` | One-on-one | development | `mgr`, `dev` |
| `RI` | Recruiting interview | development | `mgr`, `dev` |
| `UM` | Unit meeting | development | `mgr`, `dev` |
| `SUGGESTION` | System-proposed slot | — | not real activity; excluded from all counts |

> **`SC` — historical term.** An agent had "seen" a prospect once they answered the
> door. Modern meaning is contact made, by any channel — you do not need to see
> someone in person to ask for an appointment. **NOT a service call**; see
> `serviceCalls` in the weekly submission, which is servicing existing clients and
> is ratified as excluded from every funnel sum (`planVariance.js:19-20`,
> `funnelModel.js:84`). Corrected from "Service calls" by dispatcher ruling
> 2026-07-30; the repo's `ACTIVITY_METADATA` is authoritative for the code set.

**Flags do the work:**

- `icon:'call'` → the Activities classifier treats it as a call; the tally counts it
  by call count, not block count.
- `mgr` / `dev` → excluded from an agent's own production hours, counted as
  development hours in the manager's three-way split.
- prep-capable → gets the 4-item prep checklist on its overlay.
- Anything not flagged is one-per-block for the floor.

`SUGGESTION` must be filtered out of every count, every hours total and every
"booked" figure. It is a proposal, not an activity.

---

## Entities

### Lead
```
id · name · phone · email · need · source · sourceDetails · location · queue
status: pending | worked | success | closed | archived | dead
attempts        consecutive non-contacts (resets on any contact)
cycleCount      completed archive cycles; at 2, the next failure is "dead"
lastOutcome · lastContact · assignedTo · notes · batchId
```

### Call
```
id · leadId · name · phone · disposition · seconds · notes
via: device | whatsapp | bridge | softphone
at              display time string
atHour          DECIMAL HOUR — REQUIRED. This is what attributes the call to a
                block window in pcBreakdown(). Without it the call is ad-hoc.
```

### Task (unbooked) → Event (booked)
```
Task:  id · title · type (activity code) · duration (decimal hours) · priority · leadId
Event: id · title · type · startHour · endHour · leadId
       status: (none) | cancelled | postponed
       isPast · isCompleted · isPlaying
       dials         a block's own recorded dial count
       prep          { factFind, illustration, objection, route } booleans
```
`scheduleTask` converts one to the other. **They are the same object in two states**
— do not model them as unrelated tables.

### Policy
```
id · policyNumber · client · product · family · premium (API)
issuedDaysAgo · deliveredDaysAgo · settledDaysAgo
clawbackDaysRemaining      derived from settledDaysAgo against a 90-day window
persistencyStatus: current | due | missed | lapsed
commissionAtRisk           derived: premium × contracted rate
```
**All policies must be created through `newPolicy()`.** Two call sites created them
ad hoc without `premium`/`settledDaysAgo` and a policy delivered seconds earlier was
immediately filed as a persistency problem.

### Settlement
```
id · policyNumber · paidAmount · settledApi · paidOn
verdict: match | conflict | unpaid | unmatched     DERIVED, never stored
expected = settledApi × rateFor(family)            COMPUTED, never typed
queried · queryRaisedAt · queryNote
```

### Agent · Recruit · Batch
```
Agent:   id · name · initials · area · open (unworked lead count) · active
Recruit: id · name · stage · source · movedAt
Batch:   id · file · count · skipped · at · perAgent{} · queue
```

---

## The PC derivation (write this as a pure function and test it)

```
pcBreakdown(store, day) →
  blocks = events of type PC|SC that are done and not cancelled/postponed
  for each block:
      inside  = calls where atHour ∈ [block.startHour, block.endHour)
      claim those calls
      inBlocks += max(block.dials || 0, inside.length)
  adhoc = calls not claimed by any block
  total = inBlocks + adhoc
```

**Invariant to unit-test:** for any state `S` and any new call `c`,
`pcBreakdown(S + c) >= pcBreakdown(S)`. This invariant was violated twice and both
times the failure surfaced to a manager as an accusation about an agent.

---

## Phone normalisation (Trinidad & Tobago)

```
strip non-digits
11 digits starting 1  → drop the 1
7 digits              → prefix 868   (local number)
must end at 10 digits → else error "phone is not a usable number"
format                → (868) NNN-NNNN
dedupe key            → the 10 raw digits
```
This is locale-specific and belongs in a configurable module, not inline.

---

## Rates and floors — make these tenant settings

Hardcoded in the prototype, must be configurable:

- Commission rate: **40%** first-year API (life/term), **30%** (annuity)
- Clawback window: **90 days**
- Company activity floor: **PC 20/week** and the per-code targets in `at-tally.jsx`
- Archive threshold: **3** consecutive non-contacts
- Max archive cycles: **2**
- Smart-compression threshold: **45 minutes** (a user preference)
- Working day: **08:00–17:00**
