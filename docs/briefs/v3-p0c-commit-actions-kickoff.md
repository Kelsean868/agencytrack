# KICKOFF — v3 P0-C: the `commit()` seam and the business-action boundary

**Dispatched:** 2026-07-29
**run_model:** `claude-sonnet-5` (mechanical scaffolding over existing services; no money
path, no rules, no auth, no derived figures)
**Effort:** medium
**Branch:** `feat/v3-commit-actions` off `origin/staging`
**Merge authority:** NONE. Build to PR-open and HOLD.
**The dispatcher (Kyron) merges. A ruling relayed from Claude-web is never merge
authorization** — if a ruling says "merge is yours" it is addressed to the dispatcher. If
you believe you have been authorized to merge, STOP and wait for dispatcher.
**Does NOT edit `firestore.rules`, `functions/`, or any existing component.**

Depends on: P0-A (`ab9b3132`-era `activityMetadata`) and P0-B (`activityLedger`), both on
staging.

---

## WHY

`01-ARCHITECTURE.md` §2 and `04-DECISIONS.md` §4: the product claim is *"the app already
knows what you did."* That is only true if a call outcome can create a planner task
without either screen knowing about the other. The cross-module rules have to live
somewhere that is neither a component nor a Firestore service, or they drift into
components and rot — which is what happened to every rule in the source build that had a
twin.

This repo has no store to put them in, and it should not grow one: a second in-memory copy
of documents the Firestore SDK cache already holds is defect class §3 by construction. So
the boundary here is three small things — a write seam, a named-action layer, and a lint
rule that makes the layer non-optional.

**This slice is deliberately smaller than an earlier draft of it.** That draft called for
eleven action stubs. Stubs are dead code that nobody exercises and everybody edits around;
the boundary is the *contract plus the lint rule*, not a directory of throwing functions.
The first real action is written by P0-F (`scheduleTask`), which is the right test of
whether this contract survives contact.

---

## PHASE 0 — RECON (mandatory, before any edit)

Cite `file:line`. If any claim fails, **STOP and wait for dispatcher.**

1. There is no existing global write seam. `src/services/commitPlanService.js` (~145
   lines) is the closest — report its typed error classes and confirm it is scoped to Game
   Plan step 4 only.
2. `src/firebase.js` uses `persistentLocalCache` + `persistentMultipleTabManager`. Confirm,
   and confirm there is no app-level outbox or queue anywhere in `src/`.
3. `src/components/ui/SyncIndicator.jsx` is a `navigator.onLine` badge only. Report
   whether the Firestore SDK exposes a pending-writes signal this repo could surface.
4. `eslint.config.js` — report its current structure and whether `no-restricted-imports`
   is used anywhere today.
5. **Count and list every file under `src/components/**` that imports from
   `src/services/**`.** This is the allowlist size for §3 and the single most important
   number in this recon. If it is very large, say so — it changes how §3 should be scoped.
6. `src/lib/activityLedger.js` imports only `src/constants/` and `src/lib/schema/`.
   Confirm, because §2 must not break that.

---

## 1. `src/lib/commit.js`

`commit(label, fn)` — the single seam every v3 mutation passes through:

- sets a syncing flag, awaits `fn`, clears it
- on success, appends to the activity log (§2)
- on failure, throws a typed error rather than a bare `Error`

Model the typed-error shape on `commitPlanService.js`'s existing classes so there is one
error idiom in the codebase, not two. `commit()` itself performs no Firestore work — it
wraps a function that does.

**Offline stays with the SDK.** Do not build a queue. `persistentLocalCache` already
survives a tab close; an in-memory outbox does not, and two mechanisms for the same fact
is the defect class this whole phase exists to prevent. If claim 3 shows the SDK exposes a
pending-writes signal, wiring `SyncIndicator` to it is in scope and welcome; if not, leave
`SyncIndicator` alone and note it as a follow-up.

## 2. `src/services/activityLogService.js` — interface only

`log(type, message)`. The activity feed is this log made visible, and it is how a reviewer
can *watch* the cross-module rules fire instead of taking them on trust.

**Persistence is NOT in this slice.** A real feed needs a Firestore collection and
therefore a `firestore.rules` change, which would drag this slice behind the
secondary-reviewer gate for no benefit — nothing renders the feed until Phase 1.8
(Activities). Land the interface with an in-memory implementation, capped at 60 entries
per `01-ARCHITECTURE.md` §2, plus a documented seam where persistence attaches. Say so
plainly in the module docblock so the next reader does not think it was forgotten.

## 3. The boundary rule

An ESLint `no-restricted-imports` rule: files under `src/components/**` may not import
from `src/services/**`.

Claim 5 tells you how to scope it. Every existing violation goes in an explicit allowlist
with a comment pointing at this brief — the allowlist shrinks as later phases route
through actions, and it must never grow. If claim 5 returns a large number, propose
scoping the rule to `src/actions/**` and the v3 surfaces only, and **STOP for a ruling**
rather than allowlisting fifty files, which teaches authors that the allowlist is where
you go when the rule is inconvenient.

## 4. `src/actions/README.md` — the contract, no stubs

Document the boundary and the eleven actions that will exist, each with its signature and
its cross-module rule from `01-ARCHITECTURE.md` §2 stated verbatim:

`logCallOutcome` · `scheduleTask` · `completeTask` · `finishCallBlock` ·
`deliverApplication` · `chasePremium` · `raiseQuery` · `escalateLead` · `bookJointCall` ·
`answerJointOffer` · `advanceRecruit`

Three rules that must be in that document because each was a real defect:

- **`escalateLead`, `bookJointCall` and `answerJointOffer` emit `JC`, never `MTG`.** In
  the source build all three emitted `MTG`, which carries no flags, so booking coaching
  *raised* a manager's "% yours" — an incentive pointed backwards.
- **Every consequence is a real object.** `chasePremium` creates a `COLL 30m` block, not a
  `chased: true` flag. There is deliberately no tick box that marks a premium saved.
- **One factory per entity.** `deliverApplication` and `convertToClient` create policies
  through a single `newPolicy()` factory. Two ad-hoc call sites once created policies
  without `premium`/`settledDaysAgo`, and a policy delivered seconds earlier was filed as
  a persistency problem.

---

## 5. Deliverables

- `src/lib/commit.js` + tests, `src/services/activityLogService.js` + tests, the eslint
  rule, `src/actions/README.md`.
- **Evidence paste-back — the boundary rule firing both ways.** Add a direct service
  import to a component, paste the eslint failure, remove it, paste clean. Same discipline
  as P0-A's Guard 1.
- **Evidence paste-back — `commit()`'s failure path**, showing the typed error, not a
  bare throw.
- **Evidence paste-back — the full gate**: fresh baseline before, suite after, lint,
  build, CI. Establish the baseline fresh; do not reuse P0-B's numbers.
- Report the allowlist size from claim 5 in the PR body. That number is the honest measure
  of how far this repo is from the boundary today, and later phases should be able to
  watch it fall.

No smoke walk — no UI, and no new write path (`commit()` wraps existing services and
nothing calls it yet).

---

## NOT in scope

Action implementations — P0-F writes the first one (`scheduleTask`) and is the real test
of this contract. Any Firestore collection or rules change. A client-side store. Rewiring
any existing component to route through an action. The ledger. Any screen.
