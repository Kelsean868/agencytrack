# KICKOFF — v3 P0-A: ACTIVITY_METADATA as the single source of truth

**Dispatched:** 2026-07-29
**run_model:** `claude-opus-5` (collapses seven live code-keyed lists into one table + a
`firestore.rules` mirror guard — judgment-dense, and a wrong classifier here reaches a
manager-facing number)
**Effort:** high
**Branch:** `feat/v3-activity-metadata` off `origin/staging`
**Merge authority:** NONE. Build to PR-open and HOLD.
**Does NOT edit `firestore.rules`.** It *reads* the rules file in a test. If you find
yourself needing to edit it, STOP and wait for dispatcher.

Source of truth: `design_handoff_agencytrack_v3/` docs `01`, `03`, `06`, `07`.
Binding rules: root `CLAUDE.md` § *Linked Agent System v3 — binding implementation rules*.
Read that section before the first edit. Rules 1, 2 and 11 are what this slice exists for.

---

## WHY

Every regression in the v3 prototype came from a hardcoded list of activity codes that
had a twin somewhere else. Three of those regressions surfaced to a manager as a false
fact about a named agent: a `KIND_OF` list that had drifted from the code table routed new
codes to the **task** closer, which *deleted appointments*; joint-call creators emitting
`MTG` instead of the `dev`-flagged `JC` meant booking coaching **raised** a manager's
"% yours".

This repo already has **seven** live lists keyed on the same codes, each with a documented
reason for being separate. They are not wrong today — they are the exact shape that goes
wrong on the next edit. Phase 1 adds five more codes, so this collapses first.

The rule to satisfy: **adding a new activity code requires zero edits anywhere except the
table** — with one honest exception, the `firestore.rules` allowlist, which is guarded
rather than derived (see §3).

---

## PHASE 0 — RECON (mandatory, before any edit)

The dispatcher's line numbers come from a read on 2026-07-29. **The in-repo file wins.**
Verify every claim below against the repo and cite `file:line` for each. If any claim
fails, **STOP and wait for dispatcher** — do not reconcile it yourself.

1. `src/constants/activityMetadata.js` does **not** already exist, and nothing in `src/`
   exports an `ACTIVITY_METADATA`.
2. `src/services/plannerService.js` exports `APPOINTMENT_TYPES` (16 entries), `TYPE_KEYS`,
   `SELLING_TYPE_KEYS` (8 entries), `PICKER_GROUPS`, `isSellingType`.
3. `src/components/planner/plannerTone.js` exports `TYPE_TONE` (16 entries) and
   `typeBarClass`, and `typeBarClass` ends in `?? TYPE_TONE.FREE`.
4. `src/components/planner/planner.helpers.js` defines `PLAN_TO_DAILY_FIELD` and
   `SEEDS_DAILY_CAPTURE`, and its comment states that importing `plannerService` here would
   close a three-module cycle via `recurrence.helpers`.
5. `firestore.rules` contains **exactly two** `d.type in ['PC', 'SC', …]` literal
   allowlists (expected near lines 1547 and 1633), one in `validApptWrite` and one in
   `validTemplateWrite`. Report both line numbers and the full code list each contains.
6. `lucide-react` resolves `Play`, `Pause`, `GripVertical`, `ChevronDown`,
   `AlertTriangle`, `Upload`. (If any is missing, report it — do not inline an SVG.)
7. Report the full list of files that import any of the five exports in claims 2–4, so the
   blast radius is known before the first edit rather than discovered during it.

Also report, without changing them: every **other** place in `src/` that switches on an
activity code and is not in the list above (candidates seen from outside the repo:
`src/utils/funnelModel.js`, `buildActivityEvents.js`, `buildManagerActivityEvents.js`,
`gapAnalysis.js`, `planVariance.js`, `weeklyPlanAssembly.js`, `campaignEngine.js`,
`awardsEngine.js`, `extractFields.js`, `src/lib/monthlyPlanMath.js`). Say which of those
hold a *list* (in scope for the guard test) versus a single-code comparison (not in scope).

---

## 1. The table

New file `src/constants/activityMetadata.js`. One `Object.freeze`d table keyed by code.

Per-code fields:

| Field | Meaning |
|---|---|
| `label` | full name (`'Prospecting call'`) |
| `shortLabel` | **≤5 chars** — the dense week card depends on this; see the comment at `plannerService.js:55` before lengthening any |
| `family` | `'call' \| 'ladder' \| 'sale' \| 'meeting' \| 'admin' \| 'suggestion'` — drives hue |
| `counts` | counts as selling activity (this is today's `SELLING_TYPE_KEYS` semantics, **not** "counts toward a floor row") |
| `icon` | lucide icon name |
| `mgr` | manager-ladder activity |
| `dev` | development hours, excluded from own production |
| `prepCapable` | gets the 4-item prep checklist |
| `seedsDailyField` | Daily Capture field name, or `null` |
| `pickerGroup` | booking-sheet group |
| `borderStyle` | `'solid' \| 'dashed'` — see §2 |

**21 codes.** The repo's existing 16 (`PC SC AI FFI CI SALE FREE PROP PAPER COLL DEL SEM
TRADE MTG TRAIN ADMIN`) plus five new: `JC` `ONE` `RI` `UM` `SUGGESTION`.

The repo's 16 are the migration base — they exist in live Firestore documents and in two
rules allowlists. Do not rename, re-key or drop any of them.

New codes:

- `JC` Joint call · family `meeting` · `mgr` `dev` · `prepCapable` · `counts: false`
- `ONE` One-on-one · family `meeting` · `mgr` `dev` · `counts: false`
- `RI` Recruiting interview · family `meeting` · `mgr` `dev` · `counts: false`
- `UM` Unit meeting · family `admin` · `mgr: true`, **`dev: false`** — overhead, named
  separately precisely so a week eaten by meetings reads as that rather than generic time
- `SUGGESTION` System-proposed slot · family `suggestion` · `counts: false`

`prepCapable` is `AI` `FFI` `CI` `JC` only. It is a flag on the table, not a list
elsewhere — `03-DATA-MODEL.md` names those four but the prototype had no such flag, which
is the twin problem this slice removes.

`SUGGESTION` is not a real activity. It must be excluded from every count, every hours
total and every "booked" figure **by its `counts: false` flag**, never by a filter written
at a call site.

**Import discipline:** this file imports nothing from `src/services/` or
`src/components/`. It is a leaf. That is what dissolves the `planner.helpers` →
`recurrence.helpers` → `plannerService` cycle documented at `planner.helpers.js:445`
instead of closing it.

---

## 2. Rewrite the seven twins as derived exports

Same public export names, same values, **no consumer changes**. These are
behaviour-preserving refactors and the 369 existing suites are the proof.

| File | Twin | Becomes |
|---|---|---|
| `plannerService.js:68` | `APPOINTMENT_TYPES` | mapped from the table, existing order preserved |
| `plannerService.js:88` | `TYPE_KEYS` | `Object.keys` of the table |
| `plannerService.js:112` | `SELLING_TYPE_KEYS` | filter on `counts === true` |
| `plannerService.js:123` | `PICKER_GROUPS` | group by `pickerGroup` |
| `plannerTone.js:48` | `TYPE_TONE` | built from `family` + `borderStyle` |
| `planner.helpers.js:430` | `PLAN_TO_DAILY_FIELD` | filter on `seedsDailyField` |
| `planner.helpers.js:454` | `SEEDS_DAILY_CAPTURE` | already derived from the above — leave it |

**Order matters for two of these.** `APPOINTMENT_TYPES` order drives the picker's visual
order and `WEEKLY_ACTIVITY_FLOOR_ROWS`-style display expectations elsewhere. Preserve the
existing order exactly; if the table's key order differs, sort explicitly rather than
relying on object key order.

**Preserve the solid/dashed semantics, and the reasoning.** `plannerTone.js:22-47`
documents that solid vs dashed is *semantic*, not decorative: neutral **solid** counts
(`PC SC SEM TRADE`), neutral **dashed** does not (`PROP PAPER COLL DEL MTG TRAIN ADMIN
FREE`). That is now expressible as `borderStyle` derived from `counts` — do that, and
delete the hand-maintained comment's warning about keeping `SELLING_TYPE_KEYS` "in step",
because after this slice they cannot diverge.

**Do not restore violet in this slice.** `plannerTone.js`'s header comment states a reason
for neutral calls that the file itself flags as now false, and there is an open MEDIUM
Track J follow-up to restore violet *together with* fixing that comment. Leave both. Note
in the PR body that the FU is now cheaper because the hue is one table field.

**Do not port `at-tally.jsx`'s `COUNTED` array.** The prototype hardcodes
`[{t:'PC',floor:20}, {t:'AI',floor:4}, …]` — a twin of exactly the kind this slice
forbids. Floors are a separate concern and land in Phase 2.1 with different values.

---

## 3. Two guard tests

Written in the existing static-source-scan style of
`src/utils/__tests__/dark-ink-static-guard.test.js` — `fs.readdirSync` from inside vitest,
allowlist entries carrying their reason, stale allowlist entries failing the suite.

**Guard 1 — no twin lists.** Fail if any file outside `activityMetadata.js` declares a
literal array or object literal containing **≥3** known activity codes. Allowlist by
`file + reason`; a test fixture is a valid reason, a production classifier is not.

**Guard 2 — rules mirror.** Parse the two `d.type in [...]` allowlists out of
`firestore.rules` and fail if either diverges from `Object.keys` of the table. This is the
one place rule 1 is provably false: `firestore.rules` cannot import JS. The guard makes
the divergence *loud* instead of silent, and the test's own message must say what to do —
edit the rules literal, then human-merge, then dispatcher runs `firebase deploy`.

Guard 2 will **fail on first run**, because the rules allowlist has 16 codes and the table
has 21. That failure is the point. Resolve it by adding the five new codes to both rules
literals — **but that is a `firestore.rules` edit, which this slice does not make.** So:
land Guard 2 with the five new codes in a documented, explicitly-listed pending set that
the guard tolerates and names, and open a follow-up for the rules edit as its own
human-merge PR. Do not widen the guard to tolerate arbitrary divergence.

---

## 4. Silent fallbacks throw in development (rule 11)

Add `devAssertKnown(map, key, mapName)` — `console.error` in dev, inert in production.
Production behaviour is unchanged; this only makes a miss visible during development.

Apply it at every `LOOKUP[x] || DEFAULT` / `?? DEFAULT` site in the files this slice
touches. `plannerTone.js:87`'s `TYPE_TONE[type] ?? TYPE_TONE.FREE` is the canonical
instance — it is the same shape that rendered five distinct prototype glyphs as a grid
icon, including a **Cancel** control that showed a grid where an alert belonged.

A fallback that renders something plausible is worse than one that renders nothing.

---

## 5. Deliverables

- `src/constants/activityMetadata.js`, the seven derived exports, the two guard tests, the
  `devAssertKnown` helper and its test.
- **Evidence paste-back — full `npm test` output.** All 369 existing suites green. These
  are behaviour-preserving refactors; a changed snapshot or a re-baselined assertion is a
  finding, not a fix. If one legitimately must change, quote the old and new values and
  say why in the PR body.
- **Evidence paste-back — Guard 1 both ways.** Add a deliberate twin list in a scratch
  file, paste the failure, remove it, paste the pass.
- **Evidence paste-back — Guard 2 output**, including the named pending set and the
  follow-up text for the rules edit.
- **Evidence paste-back — the Phase 0 recon**, with `file:line` for all seven claims and
  the blast-radius list.
- PR body states the root cause in one sentence before the change list.

No smoke walk — this slice has no UI surface and no write path. Do not invent one.

---

## NOT in scope

Floors and their values (Phase 2.1). The ledger and its derivations (P0-B). `commit()` and
the actions layer (P0-C). Any `firestore.rules` edit. Restoring violet. Task↔Event
unification (P0-F). Any screen.
