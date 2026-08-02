# `src/actions/` — the business-action boundary

**This directory is deliberately empty of implementations.** It is a contract plus
a lint rule, not a directory of stubs.

An earlier draft of P0-C called for eleven throwing stubs. Stubs are dead code
that nobody exercises and everybody edits around — they age into noise and give
false confidence that a layer exists. The boundary is the *contract plus the
enforcement*, and the first real action is written by **P0-F (`scheduleTask`)**,
which is the honest test of whether this contract survives contact.

---

## The rule

Screens never mutate state directly. They call a **named business action**, and
the cross-module rules live inside those actions.

```
component  →  action (src/actions/)  →  service  →  Firestore
                    ↑
            cross-module rules live HERE
```

`01-ARCHITECTURE.md` §2: *"screens never mutate state directly, they call a named
business action … The cross-module rules live inside those actions, which is why
the system stays coherent as screens are added."*

Rules that live in components drift into components and rot. Every rule in the
source build that had a twin got one that way.

### Enforcement

`eslint.config.js` carries a `no-restricted-imports` rule scoped to
`src/components/**` naming the v3 services components may not import directly.
Today that list is one entry: `activityLogService`.

**That file is the enforcement mirror of this document** — the same relationship
the `firestore.rules` `d.type` allowlist has to `ACTIVITY_METADATA`: a mirror with
a stated owner, not a twin. This README is the contract; the eslint list is the
machine-checked half. **Change them together.**

The rule restricts **which** services, not **whether** — so it needs no allowlist,
is fully enforced from its first commit, and grows one deliberate line per v3
service. The 92 component files that import pre-v3 services are untouched, not
pretended-fixed.

### Every action goes through `commit()`

`src/lib/commit.js` — `commit(label, fn)` sets the syncing flag, awaits, logs to
the activity feed on success, and throws `CommitFailedError` (original preserved
on `.cause`) on failure. `01-ARCHITECTURE.md` §2: *"**every** mutation goes
through this."*

---

## The eleven actions

Signatures are the intended shape, not yet contracts — the first implementation
(P0-F) may refine them, and this document is updated when it does.

| Action | Signature | Cross-module rule (`01-ARCHITECTURE.md` §2, verbatim) |
|---|---|---|
| `logCallOutcome` | `(leadId, outcome, meta)` | writes a `call` record with `atHour`, and an activity entry — *evidence* |
| ↳ = **Callback Requested** | | creates `PC 30m · Call back <name>` task — *the follow-up exists before you hang up* |
| ↳ = **Appointment Set** | | creates `FFI 1h · <name> — <need>` task — *ready to drag onto the grid* |
| ↳ 3 consecutive non-contacts | | raises an **archive** notification — *stops infinite dialling* |
| ↳ archive when `cycleCount >= 2` | | offers **mark dead** instead — *two cycles is enough* |
| `scheduleTask` | `(task, hour)` | task leaves the rail, becomes an `event` — *one object, two views* |
| `completeTask` | `(taskId)` | on a call block, its pending calls auto-complete — *same, inverted* |
| `finishCallBlock` | `(blockId)` | logs the block with its **real** duration — *duration is measured, not typed* |
| `deliverApplication` | `(applicationId)` | creates a policy via **one `newPolicy()` factory** — *prevents field desync* |
| `chasePremium` | `(policyId)` | books `COLL 30m · Collect · <name> (<policy>)` — *a premium isn't saved by a tick* |
| `raiseQuery` | `(settlementId, note)` | records the query, marks the row queried, opens a counter — *queries are records* |
| `escalateLead` | `(leadId)` | emits **`JC`** (not `MTG`) — *dev-hours split — decision §7* |
| `bookJointCall` | `(leadId, managerId)` | emits **`JC`** (not `MTG`) — *dev-hours split — decision §7* |
| `answerJointOffer` | `(offerId, answer)` | emits **`JC`** (not `MTG`) — *dev-hours split — decision §7* |
| `advanceRecruit` | `(recruitId, stage)` | recruit → Career interview books `RI 1h · Career interview · <name>` — *stage and calendar are one event* |

Related rules that are consequences rather than actions: *all calls for a task
done* → that planner task auto-completes; `setEventStatus(id, 'Kept')` → marks
completed, becoming **evidence** in the ledger.

---

## Three rules that are in this document because each was a real defect

### 1. `escalateLead`, `bookJointCall` and `answerJointOffer` emit `JC`, never `MTG`

In the source build all three emitted `MTG`, which carries no flags. So booking
coaching **raised** a manager's "% yours" — an incentive pointed backwards. A
manager who did more coaching looked like they were producing more.

`JC` carries `mgr: true, dev: true` in `ACTIVITY_METADATA`; `MTG` carries
neither. The flags are the whole mechanism (see `src/constants/activityMetadata.js`).

### 2. Every consequence is a real object

`chasePremium` creates a `COLL 30m` block — **not** a `chased: true` flag. There
is deliberately no tick box that marks a premium saved.

A flag records that someone pressed a button. A block records that time was set
aside to do the thing. Only the second is evidence, and only the second appears
on the planner where the work actually gets done.

### 3. One factory per entity

`deliverApplication` and `convertToClient` create policies through a **single
`newPolicy()` factory**.

Two ad-hoc call sites once created policies without `premium` / `settledDaysAgo`,
and a policy delivered seconds earlier was filed as a persistency problem — a
manager-facing figure was wrong about a named agent because two code paths built
the same entity differently.

---

## What is NOT here, and why

- **No action implementations.** P0-F writes the first (`scheduleTask`).
- **No store.** A second in-memory copy of documents the Firestore SDK cache
  already holds is `06-DEFECT-CLASSES.md` §3 by construction. Derived, never
  stored.
- **No offline queue.** `persistentLocalCache` already survives a tab close; an
  in-memory outbox does not. See the note in `src/lib/commit.js`.
