# KICKOFF — Planner activity types: +9 hardcoded types

**Dispatched:** 2026-07-27
**Model:** Opus 4.8
**Branch:** `feat/planner-activity-types` off `origin/staging`
**Merge authority:** NONE. Build to PR-open and HOLD.
**⚠️ THIS TRACK EDITS `firestore.rules`** — human merge + dispatcher-run
`firebase deploy` are mandatory and sequenced below. CC never merges, never deploys.

---

## WHY

Agents need to record what they actually did each day. Today's 7 types cover
only the selling ladder plus one catch-all `FREE` block. Nine new types make the
day legible: support work, servicing, and non-production time each get a real
code instead of collapsing into `FREE`.

Tenant-configurability is a LATER run. This one hardcodes the list, but the list
must live somewhere a future config layer can seed from (see §6).

---

## PHASE 0 — DESIGN AUTHORITY VERIFICATION (mandatory, before any build)

The dispatcher read mockup copies outside the repo and derived the rulings below
from them. Per the design-authority rule, **the in-repo file wins**. Verify every
claim in this section against the repo. If any claim fails, **STOP and wait for
dispatcher** — do not reconcile it yourself.

Read (do not edit):
- `docs/design-system/proposals/planner-scheduler-v2/README.md`
- the planner mockup source in `docs/design-system/screens-v2/` (and
  `design_handoff_v2_app/mockups/` if the planner scenes live there) — locate the
  real paths, report them.

Confirm these six findings, citing file:line for each:

1. A **stream** concept exists (`stream: 'sell' | 'coach' | 'recruit'`) with hue
   families: sell = teal, recruit = gold, coach = accent/neutral.
2. The **agent booking sheet already has a mode toggle** — `Prospect` (selling
   types + prospect attach) vs `Free block` (chip row: Training · Company
   seminar · Tradeshow · Prospecting time · Personal).
3. The **manager booking sheet has four modes** — Sell / Coach / Recruit / Block —
   and promotes block types to first-class codes (`TRAIN`, `SEM`, `TRADE`, `PERS`)
   with an in-source rationale about them becoming "first-class options."
4. `ACT_CODE` in the mockup carries codes beyond the shipped 7 (`RC`, `RI`, `RS`,
   `O2O`, `TEAM`, `JOINT`).
5. Naming convention is dotted mono (`P.C`, `R.SEM`, `1:1`) or short words
   (`UNIT`, `Sale`, `Free`).
6. The authority is **silent** on: solution/proposal writing, application
   paperwork, premium collection, policy delivery, admin work, and a
   branch-meeting type for agents. (`UNIT`/unit meeting exists on the manager side
   only.)

Emit a Phase 0 report as the first artifact. Where the authority is silent,
build the minimum that satisfies this brief and **record the provenance gap in
the PR body** — do not invent design beyond it.

---

## THE NINE TYPES (dispatcher-ruled, final)

| key | label (chip, ≤5 chars) | name (tooltip / picker) | picker mode | counts as selling activity? |
|---|---|---|---|---|
| `PROP`  | `Prop`  | Solution / proposal writing        | Support | NO |
| `PAPER` | `Paper` | Writing / submitting applications  | Support | NO |
| `COLL`  | `Coll`  | Premium collection                 | Support | NO |
| `DEL`   | `Del`   | Policy delivery                    | Support | NO |
| `SEM`   | `Sem`   | Company seminar                    | Block   | **YES** |
| `TRADE` | `Trade` | Tradeshow                          | Block   | **YES** |
| `MTG`   | `Mtg`   | Branch meeting                     | Block   | NO |
| `TRAIN` | `Train` | Training / CPD                     | Block   | NO |
| `ADMIN` | `Admin` | Admin work                         | Block   | NO |

Total after this change: **16 types** (7 existing + 9 new).

**Explicitly NOT added — already covered, do not create synonyms:**
- "Calls / calling block" → this is `PC` (`name = 'Prospecting call'`).
- Existing `FREE` and `FREE_BLOCK_LABELS` stay **exactly as they are** for backward
  compatibility. Do NOT migrate existing `FREE` appointments to the new codes. Do
  NOT remove `FREE` from the picker.

**Label budget is load-bearing.** Recon derived ~3–4 chars of headroom in the
narrowest dense week column (131.4px column → ~81px content box); today's worst
case `F.F.I` (5 chars) already overflows by ~4px and relies on the `flex-wrap`
safety valve. All nine labels above are ≤5 chars — matching today's worst case,
not exceeding it. **Do not lengthen them.** If your own measurement contradicts
the ~81px figure, report it rather than silently re-deriving.

---

## §1 — THE RULES BLOCKER AND ITS SEQUENCING

`firestore.rules` validates the appointment `type` **value** against two literal
allowlists:

- `firestore.rules:1541` — `validApptWrite`, `/tenants/{tid}/appointments`
- `firestore.rules:1619` — `validTemplateWrite`, `/tenants/{tid}/appointmentTemplates`

Both must gain the nine new keys. That is the **only** rules change authorized in
this track: extend the two `d.type in [...]` lists. Nothing else in
`firestore.rules` may be touched — not `hasOnly` key lists, not other match
blocks, not other arms. Any further rules need STOP.

**Mandatory sequence — CC cannot verify its own work before the deploy:**

1. CC builds everything, opens the PR, **HOLDS**.
2. Dispatcher merges.
3. Dispatcher runs `firebase deploy --only firestore:rules` against **staging**.
4. CC (or dispatcher) runs the smoke against staging — the first point at which a
   new type can be written.
5. Promotion to main later; dispatcher deploys rules to **production** as part of
   that promotion.

The PR body must state plainly, at the top: *"Merged ≠ deployed. This PR is inert
until `firebase deploy --only firestore:rules` runs. Until then every new type is
rejected at the rules layer."*

Write the smoke in this PR, register it in SMOKES.md, and mark it explicitly as
**deploy-gated** — it will fail before step 3, and that is expected, not a defect.

---

## §2 — COUNTERS: WHAT MUST NOT INFLATE

Recon established the good news: `WEEK_COUNTER_ROWS`
(`AgentPlannerPanel.jsx:117-121`) and `COUNTER_ROWS`
(`TeamPlannerPanel.jsx:17-19`) filter by **exact type equality** against `CI`,
`FFI`, `PC` only. The nine new types are therefore **inert for booked-vs-floor by
construction** — no exclusion logic is needed there, and none may be added.

Two sites DO count every type and WILL inflate. Both must be fixed:

**A. `TeamPlannerPanel.jsx:152`** — `total: active.length`, rendered at `:208` as
"N booked this week." This is a **manager coaching surface**: a manager reading
"12 booked" must not be seeing 5 selling appointments plus 7 admin blocks. Filter
`active` by the selling set.

**B. `planner.helpers.js:459`** — `keptCount += 1` unconditionally, rendered at
`AgentPlannerPanel.jsx:1580-1588` as "N kept appointments today." It labels the
carry-to-Daily-Capture CTA, so it must reflect what is actually being carried.
(Note `FREE` already has this bug today — fixing it for `FREE` too is in scope and
should be called out in the PR body.)

`deriveSeedFromKept`'s payload is already safe — `PLAN_TO_DAILY_FIELD` returns
`undefined` for unmapped types and the write is skipped. Do not add the new types
to `PLAN_TO_DAILY_FIELD`.

**The selling set** — one exported constant beside the type definitions in
`plannerService.js` (NOT in `planner.helpers.js`; `TeamPlannerPanel` does not
import that file). Members: `PC`, `SC`, `AI`, `FFI`, `CI`, `SALE`, `SEM`, `TRADE`.
Everything else — including existing `FREE` — is non-production.

Each fix gets a value-level test with a **negative control** (break the filter,
confirm the test fails, revert).

---

## §3 — TIME RECORDING

`durationMin` is already a required, rules-validated contract field
(`plannerService.js:114`, `firestore.rules:1540`). **No new field is needed.**

In scope for this track: nothing beyond confirming that new-type appointments
carry duration like any other. A reporting surface that *sums* `durationMin` per
type does not exist anywhere today — that is net-new build and is **OUT of scope
here**. Bank it as a follow-up FU with the note that the data is already being
captured, only the reporting is missing.

---

## §4 — PICKER

Follow the authority's mode pattern rather than growing a flat grid. The agent
booking sheet's existing `Prospect` / `Free block` toggle becomes:

- **Prospect** — `PC`, `SC`, `AI`, `FFI`, `CI`, `SALE` (+ prospect attach, unchanged)
- **Support** — `PROP`, `PAPER`, `COLL`, `DEL`
- **Block** — `SEM`, `TRADE`, `MTG`, `TRAIN`, `ADMIN`, `FREE`

`FREE` keeps its existing `FREE_BLOCK_LABELS` chip row when selected. A flat
16-button grid is explicitly rejected: it puts `A.I` (Approach interview) two
buttons from `Admin`, which is a mis-click hazard on a record that feeds coaching
surfaces.

Prospect attach: Support types are client-linked in practice (a delivery or a
collection is for someone). If the existing sheet makes prospect attach
straightforward for them, allow it as **optional**. If it requires restructuring
the attach logic, make Support types prospect-optional in the simplest way
available and bank the richer behaviour. Do not restructure the attach model.

44px touch targets, both themes, loading/error/empty on any new surface.

---

## §5 — TONE

The authority uses **stream hues**, not a shared neutral. Assign:

- **Support** (`PROP`, `PAPER`, `COLL`, `DEL`) — one distinct family, visually
  separate from the teal selling ladder and the gold sale.
- **Block** (`SEM`, `TRADE`, `MTG`, `TRAIN`, `ADMIN`) — muted/neutral family,
  consistent with how `FREE` reads today.

Pick from **canonical tokens in `app.css` v2 only** — never invent a hue, never
edit a token value. `TYPE_TONE[type] ?? TYPE_TONE.FREE` already exists as a
fallback; make the new entries deliberate rather than relying on it.

---

## §6 — SATELLITE MAPS (each needs a manual edit)

`APPOINTMENT_TYPES` (`plannerService.js:48-57`) is the single definition site for
the client — labels, names and `TYPE_KEYS` all derive from it. These do NOT
derive and must each be updated:

| Site | Action |
|---|---|
| `firestore.rules:1541` | +9 keys (the blocker) |
| `firestore.rules:1619` | +9 keys |
| `plannerTone.js` `TYPE_TONE` | +9 entries per §5 |
| `plannerService.js` selling set | NEW export per §2 |
| `plannerService.test.js:71` | exact-set assertion — must be updated |
| `planner.helpers.js` `PLAN_TO_DAILY_FIELD` | **no change** (absence is correct) |
| `AgentPlannerPanel.jsx` `WEEK_COUNTER_ROWS` | **no change** (§2) |
| `TeamPlannerPanel.jsx` `COUNTER_ROWS` | **no change** (§2) |

**Future-config shape:** keep the list in `plannerService.js` and mirror the
`weeklyActivityFloors` precedent — `Object.freeze(DEFAULT_…)` in a module, tenant
override at `config/companyMinimums.<key>`, consumers merging
`{...DEFAULT, ...(config ?? {})}`. Do NOT build the config layer here. Do add a
short in-source note that a future tenant layer will collide with the rules
allowlist (a per-tenant set cannot be a rules literal), so the next author
inherits that constraint.

---

## §7 — SEEDER + SMOKE

- Extend `scripts/staging/seed-fixtures.mjs` with at least one appointment of a
  Support type and one of a Block type, so the picker, chip, tone and counter
  behaviour are all exercisable. Follow existing fixture conventions; target
  `staging_test` only.
- New smoke, deploy-gated: log in as the test agent → book a new-type appointment
  through the real service path → reload → assert persisted → assert it does NOT
  appear in the booked-vs-floor counters → assert the manager "N booked this week"
  number excludes it. Console-clean, zero production requests.
- Sweeper is an **unconditional prerequisite** before any mutating smoke run.
- Feature-branch previews are on **production** Firebase — use the local
  `--mode staging` build route, or run against staging after the rules deploy.

---

## STANDING RULES

- Rule 17: source-verify every claim in this brief before relying on it. This
  brief was written from a recon plus out-of-repo mockup copies; the repo wins.
- Rule 15: verbatim `git log origin/<branch> --oneline -1` paste-back after every push.
- Full local suite before push — no subsets.
- Single-branch PR rule; `git fetch origin` before branching.
- Per-tier drift check: diff the touch-set between `origin/staging` and
  `origin/main` before cutting the branch; STOP on drift with the file list.
- Rule 21: timestamp-keyed reviewer checks. CodeRabbit rate-limit silence is a
  wait, not approval. An attended reviewer-only pass is the standing second
  reviewer for rules-touching work — expect one before merge.
- STOP phrases: "STOP and wait for dispatcher" / "STOP IMMEDIATELY". No others.

## OUT OF SCOPE — do not build

Tenant configurability · duration-sum reporting surfaces · migrating existing
`FREE` appointments · manager recruiting/coaching codes (`RC`/`RI`/`O2O`/`TEAM`/
`JOINT`) · any `functions/` change · any rules change beyond the two `d.type`
allowlists · Daily Capture / WAR / Master Sheet / Meeting Mode field changes
(recon confirmed those surfaces do not consume planner types at all).

END OF BRIEF
