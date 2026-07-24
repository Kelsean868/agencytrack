# RUN A — Waves 1–3: Hygiene · Planner E1–E5 · Track J Conformance Closeout

**Dispatched:** 2026-07-23
**Orchestrator:** Claude Opus 4.8 (NOT Fable — see Escalation rule below)
**Window:** single long autonomous window (~15–19h build time budgeted)
**Merge authority:** NONE. CC executes to PR-open and HOLDS. Kyron merges. Kyron promotes.
**Target branch flow:** feature branches → PRs into `staging` → ONE human staging→prod promotion after the window.
**Production verification URL:** `portal.agencytrack.app` ONLY. `*.vercel.app` aliases are prohibited for verification under all circumstances.

---

## ESCALATION RULE (Opus-orchestrated run)

There is no higher model tier in this run. Any item that under Fable orchestration
would have been "escalate and resolve" is now **STOP and wait for dispatcher**.
Specifically: schema ambiguity, rules-adjacent decisions, design-authority
mismatches, or any conflict between this brief and repo state. Do not absorb
conflicts. Do not improvise resolutions. The only permitted halt phrases are
"STOP and wait for dispatcher" and "STOP IMMEDIATELY".

## SUBAGENT MODEL PINNING

- **Opus 4.8 (orchestrator, retains):** E1–E5 builds (Tier 2), R-06 and R-11 builds (Tier 3b), any recon that surfaces ambiguity.
- **Sonnet 4.6:** all of Tier 1 (hygiene/fixtures/doc sweeps/CI action bumps), Tier 3c mechanical conformance, SMOKES.md registration, post-merge fills.
- **Haiku 4.5:** trivial single-file fixes only (BranchKPIStrip format anomaly, orphan deletion) if delegated at all.

## STANDING ABSOLUTE STOPS (unchanged, restated for this run)

Do NOT touch, regardless of remaining time or apparent ease:
- Anything in `functions/` **runtime** (Node-20 migration, SDK upgrade, R-02/R-03 CF aggregates, email-template deploys). NOTE: CI workflow YAML action-version bumps in `.github/workflows/` are IN scope (Tier 1, item 6) — the functions runtime is not.
- `firestore.rules` — any change is a STOP, not a build.
- Policy Reconciliation Slice 2 (feature-wide stop).
- Campaign payout close/confirm/release (money).
- Persistency v2 calc engine (Tatil-gated).
- SM cross-branch view · EditUserDrawer commission/reset-password · SEC-9b.
- Production-Report roster rebuild (Run 8 rejection stands).
- Any write to live tenant data (`tatillife_south` null-unitId fix is attended-only, not this run).
- Track K Phase 2 in its entirety (gated behind the reviewer decision — NOT in this run).

---

## PHASE 0 — ANCHOR VERIFICATION (mandatory, before any build)

Rule 17 is delegated to run-time for this brief. Grep-verify EVERY anchor below.
If any anchor fails, STOP and wait for dispatcher — do not substitute a
plausible alternative path.

Verify existence and read the head of each:

1. `docs/design-system/proposals/planner-scheduler-v2/README.md` — the SOLE
   design authority for Tier 2. Confirm it describes E1–E5 (desktop multi-day
   views, drag-drop reschedule, running-late cascade, per-appointment notes
   thread, collapsed-rail adaptation). If the file is absent or describes a
   different feature set, STOP IMMEDIATELY. Do not build from memory, chat
   history, or any other document. (This is the Run 9 failure mode.)
2. `scripts/seed-fixtures.mjs` (or locate the actual seeder path if it lives
   elsewhere under `scripts/`) — confirm current fixture coverage before
   extending.
3. `SMOKES.md` — confirm registry format before adding the six Run-9 smokes.
4. `docs/track-j-port-ledger.md` and `docs/trackj-recon-2026-07-07.md` (locate
   actual paths) — confirm both still lack supersession banners.
5. `CONTEXT.md` — confirm the stale "J2 is next" prose is present; confirm
   current-head matches `ebb168f1` lineage (fill commit `53a65faa`).
6. `FOLLOW_UPS.md` — confirm the index rows named in Tier 1 item 5 are in the
   stated stale states before sweeping.
7. The verification lib file that constructs production URLs — locate it and
   confirm the current (non-pinned) behavior before hard-pinning.
8. Existing planner service layer: confirm `postponeWithRebook` (or the actual
   reschedule/propagation service from Run 9 F3) exists and note its exact
   signature — E2 wires to it, it must not be reimplemented.
9. Confirm appointments live in the collection the planner services read
   (record the exact collection name from the service files, do not assume).
10. ChampionsPanel component — confirm the live ranking source before Tier 3a.

Emit a Phase 0 report (anchor → verified/failed → evidence line) as the first
artifact of the run, committed to the run's working notes.

---

## TIER 1 — Hygiene + verification substrate (~2–3h, Sonnet)

Order matters: item 1 unblocks half of Tier 2/3 verification.

1. **Extend the seeder** with three fixture families: campaigns, settled
   policies, jointCalls. Purpose: Campaigns / Policy-Recon / Champions /
   Meeting currently verify as empty states; the run's own smokes need real
   data to prove anything. Respect existing seeder conventions (env-file
   handling — note the known `--env-file` foot-gun; do not "fix" the foot-gun
   in this run, just don't trip it). Fixtures target the smoke tenant, never
   a live tenant.
2. **Net-vs-Gross value-level integration assertion** (seeded): using the new
   settled-policy fixtures, add an assertion that calendar-period Net Settled
   (settled minus lapsed via `policiesDerivation.js`) diverges from gross where
   the fixture includes a lapse — i.e. the fixture must contain at least one
   lapsed policy so Net ≠ Gross and the assertion is non-vacuous.
3. **Hard-pin `portal.agencytrack.app`** in the verification lib. Any code path
   that could resolve a `*.vercel.app` alias for verification must fail loudly
   instead. Add a comment citing the rollback-scare incident. Log (do not
   chase) the stray `agencytrack.vercel.app` deployment as a FOLLOW_UPS entry
   if not already present.
4. **Register the six Run-9 smokes in SMOKES.md** per the registry's format.
5. **Stale-doc sweep:**
   - Supersession banners on `track-j-port-ledger.md` ("18 of 34" claim) and
     `trackj-recon-2026-07-07.md` (12-PENDING table).
   - Fix CONTEXT.md's "J2 is next" prose.
   - Fix the screens-v2 Reference Index's stale "planner gated / CRO not
     routed" claims.
   - FOLLOW_UPS index stale-row sweep: reconcile index rows against their
     bodies (e.g. "planner recurrence edit-this-and-all-future" listed open but
     body says RESOLVED shipped Run 9 F3 `d0e74c12`; resolved rows like
     `t1-compliance-scope` still in the open index). Sweep is index-hygiene
     only — do not change any body's disposition.
6. **CI workflow action bumps:** update deprecated Node-20 GitHub Actions
   versions in `.github/workflows/` only. This does NOT touch the functions
   runtime. Verify CI goes green on the PR.
7. **Small fixes:** BranchKPIStrip compliance tile renders `13` with no `%` —
   code-check and fix the formatter. Orphan cleanup: medal trio +
   ManagerHeroSection — delete ONLY after grep-confirming zero imports.

Tier 1 lands as one PR (single-branch rule). Open PR into staging, HOLD for
review bots, proceed to Tier 2 on a fresh branch off staging while holding.

## TIER 2 — Planner Run A: E1–E5 (~8–10h, Opus retains)

Design authority: the Phase-0-verified README ONLY. Where this brief and the
README disagree, the README wins and the disagreement is logged.

Build order (dependency-first):

1. **E1 — desktop multi-day views** (3-day / week). Extends the existing
   desktop planner shell (`PlannerDeskFrame` lineage); reuse the timeline
   primitives (TimeRail / ApptRow / gap rows), do not fork them.
2. **E5 — collapsed-rail adaptation** — rides E1's layout work; the rail
   behavior must degrade per the README, not per improvisation.
3. **E2 — drag-drop reschedule** — wires to the EXISTING Run 9 F3
   reschedule/propagation service verified in Phase 0. Reimplementing
   propagation is prohibited (single math/write path). Series instances:
   per-instance override semantics from the recurrence model apply ("past
   instances never change").
4. **E4 — per-appointment notes thread.** SCHEMA CONSTRAINT: notes MUST land
   as a subcollection (or embedded field) under the existing appointment
   document so they inherit the current rules surface. If the README requires
   notes keyed by `prospectId`, cross-agent visibility, or ANY shape that the
   current rules do not already cover: build the contract layer + UI against
   the appointment-scoped shape, tag the divergence NEEDS-HUMAN-REVIEW in the
   PR body, and STOP the E4 arm there. A `firestore.rules` edit is never the
   answer in this run.
5. **E3 — running-late cascade.** The cascade math and UI are in scope. The
   "notify prospect" half is DISPLAY-ONLY (banner/status affordance). Any
   actual send (email/WhatsApp/SMS/notification) is functions-adjacent and out.

All five: both themes, loading/error/empty states on every new surface, 44px
touch targets, no inline styles, all writes via service files, no new
dependencies without a STOP.

Tier 2 lands as one PR into staging (or two — E1+E5+E2 / E4+E3 — if the diff
exceeds reviewable size; orchestrator's call, noted in run log). HOLD at
PR-open.

## TIER 3 — Track J conformance closeout (~4–6h, mixed)

Requires Tier 1's fixtures. Run after Tier 1's seeder lands on the run's
staging lineage (fixture availability, not PR merge, is the dependency —
fixtures run against the smoke tenant from the branch).

**3a — Verify-first (may close as verification, not build):**
- R-08 ChampionsPanel podium: with seeded data, verify the live panel's
  "Ranked by API, this week" behavior against the ruling. If conformant,
  close with evidence (screenshot + data trace), no build.
- `tatillife_smoke` tenant live verification (index marks uncertain) — run the
  write-read-verify cycle and record the result.

**3b — Ruled-buildable (rulings of 2026-07-13 apply; no new decisions):**
- R-06 Commission saved-scenario chips — profile-doc, own-write, agent-private
  slice only. No shared/manager visibility.
- R-11 login-stamp write path + All Users LAST-activity column. The stamp is a
  client-side own-doc write on auth; if the ruling's mechanism requires
  anything server-side, STOP that item.
- Commission §4.7 daily-cadence chip + two-column rail+ladder layout
  conformance + the missing persistency stat in the hero (per the visual-pass
  findings and the screens-v2 mockup).
- Master Sheet STATUS filters — build the YTD + companyMinimums read path per
  the ruling. LEVEL filter remains BLOCKED (unpopulated career-level data) —
  do not build. Unit friendly names (LOW) — include if time permits.

**3c — Mechanical conformance (Sonnet):**
- Run-3 hero-card conformance worklist.
- Motion pop-in wiring to the first live panels (kit exists; wiring only).
- Reconcile `design_handoff_v2_app/mockups/` vs `screens-v2/` (docs-level
  reconciliation; screens-v2 + redesign-addendum remain canonical).
- Gold-contrast pass (tokens are canonical in app.css v2; fix usages, never
  token values).

**EXPLICITLY OUT of Tier 3** (need a design pass first — do not attempt):
1-on-1 takeover · tenure-band admin editor · Game Plan Fork-B suggest-back ·
Emails refined composition + 2 net-new templates.

Tier 3 lands as one PR into staging. HOLD at PR-open.

---

## VERIFICATION STANDARD (every tier)

- Smokes are write-read-verify cycles: log in as the smoke agent → write a
  Firestore doc through the real service path → reload → assert persistence.
  Selector-only checks do not count. Console-clean. Zero production requests
  from preview contexts.
- Feature-branch PR previews CANNOT live-verify Firebase Auth (authorized-
  domains allowlist). This is intended behavior — verify auth-dependent flows
  against staging after Kyron merges, not by working around the allowlist.
- Waiving any smoke requires written justification in the run log; default is
  RUN.
- Lint + build green on every PR (CI gate).

## PROCESS RAILS

- Single-branch rule: all commits for a PR stack on one branch;
  `git fetch origin` before branching.
- Rule 15: verbatim `git log origin/<branch> --oneline -1` paste-back after
  every push, in the run log.
- CC never merges, never deploys, never self-promotes merge authority.
- Reviewer note for this run: CodeRabbit is currently the sole reviewer and
  rate-limits on the free tier. HOLD at PR-open means hold — if CodeRabbit has
  not posted on a PR, that PR is not review-complete. Surface rate-limit waits
  in the run log rather than treating silence as approval. (The reviewer-
  stack decision is a separate attended item; nothing in this run depends on
  it because nothing here touches rules or functions runtime.)
- End-of-run deliverable: run log with per-tier disposition table, Phase 0
  report, all Rule 15 paste-backs, smoke evidence, and a promotion-readiness
  summary for the single staging→prod promotion (which Kyron performs using
  the promotion runbook — merge commit, NOT squash; the button defaults to
  squash every time).

END OF BRIEF
