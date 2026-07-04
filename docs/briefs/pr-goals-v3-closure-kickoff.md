# PR — Goals v3 closure sweep: MDRT reconcile + AwardsReachPanel merged accessor + spec correction (S)

**Channel:** PR → CI → bot review → HUMAN-MERGE (agent-facing numbers + PDF surface)
**Size:** S | **Model tier:** Sonnet | **Strike count:** 0/2

## Context

Recon (2026-07-04, audit-only) established Goals v3.1–3.3 are SHIPPED (#638 DerivedIncomePanel,
#641 AwardsReachPanel, #643 MdrtTracker, #645 manager catch-up). Three gaps remain. This brief
closes them. It does NOT touch DerivedIncomePanel's math — that decision is gated on this
brief's Phase 5 recon rider.

## Phase 0 — falsification gate (Rule 17 anchors; STOP on any mismatch)

1. Confirm `MDRT_THRESHOLD = 500000` exists at `src/constants/mdrt.js` and grep its full
   consumer set. Expected: AgentReportDocument (PDF) + the v2 HeroCard progress marker.
   If consumers differ from expected, report the true set and proceed against it.
2. Confirm `MDRT_THRESHOLDS_2026` at `src/config/mdrtThresholds/2026.js` with
   mdrt: 688800 / cot: 2066400 / tot: 4132800, consumed by MdrtTracker.jsx.
3. Confirm AwardsReachPanel imports `DEFAULT_RULESET_2026` directly (not via
   getAwardsRuleset / getMergedAwardsRuleset).
4. Confirm `docs/goals-v3-spec.md` still carries the stale "Status: PLANNED — prep only" line.
5. Falsifier (Rule 23): if any consumer already imports MDRT_THRESHOLDS_2026 for the same
   purpose, or AwardsReachPanel already goes through a service accessor, the premise is
   stale — STOP and report before building.

## Phase 1 — MDRT reconcile

1. Migrate every `MDRT_THRESHOLD` consumer to `MDRT_THRESHOLDS_2026.mdrt`.
2. AgentReportDocument caution: it is rendered by @react-pdf/renderer and uses hardcoded
   hex only — change the imported constant ONLY, zero styling/layout edits.
3. Delete `src/constants/mdrt.js`. Post-delete grep: zero references repo-wide
   (pair with `git ls-files` per Rule 17 sub-bullet).
4. KNOWN VISUAL EFFECT (pre-authorized, do not treat as regression): HeroCard MDRT progress
   and the PDF marker will show lower progress (denominator 500000 → 688800). This is the
   correct 2026 T&T premium-method requirement and matches MdrtTracker.

## Phase 2 — AwardsReachPanel merged accessor

1. Switch AwardsReachPanel from the direct `DEFAULT_RULESET_2026` import to
   `getMergedAwardsRuleset` (the locked render-consumer accessor).
2. Mirror the consumption pattern of an established consumer (e.g. AgentAwardsPanel):
   same async/loading/error handling shape. Do not invent a new pattern.
3. Behavior contract: with no tenant override doc, rendered output is IDENTICAL to today
   (merged == DEFAULT). Add/extend a unit test asserting both: (a) default parity,
   (b) a tenant override field wins over the default.

## Phase 3 — spec correction (docs)

1. `docs/goals-v3-spec.md`: status → SHIPPED with the four PR numbers; note the
   flat-math deviation from the blended-rate intent as an OPEN item (decision pending,
   gated on Phase 5 rider); note MDRT tiered config landed via #643 and the legacy
   500k constant retired by THIS PR (#TBD).

## Phase 4 — verification

1. Unit tests: MDRT consumers assert 688800; AwardsReachPanel parity + override tests.
2. `npm run lint`, full `npm test`, `npm run build` — all green.
3. Smoke (non-waivable, subject signed in): production-preview walk, BOTH themes —
   agent Goals tab renders all four panels; HeroCard MDRT marker reflects 688800;
   AwardsReachPanel renders identically to production (no tenant override exists);
   PDF export generates without error and shows the 688800-based marker.
4. Axe: no NEW serious/critical vs main baseline.

## Phase 5 — recon rider (AUDIT-ONLY, report at PR-ready hold; no code)

Question that gates the DerivedIncomePanel blended-math brief: does per-policy or
per-submission data carry payment mode/frequency (annual/semiAnnual/quarterly/monthly)
sufficient to derive an agent's REAL mode mix?
1. Inspect the submission/policy write path and stored doc shapes (path:line citations).
2. Verdict: AVAILABLE (cite fields) / PARTIAL (what exists, what's missing) / ABSENT.
3. If ABSENT: note whether Commission Playground persists a user-set modeMix anywhere
   (Firestore or local) that could serve as the source instead.

## Phase 6 — docs-with-placeholders

1. CONTEXT.md Recently-shipped row (#TBD) + FOLLOW_UPS.md: mark the "two MDRT constants
   unreconciled" and "AwardsReachPanel bypasses merged accessor" items resolved with
   placeholders; bank the DerivedIncomePanel math decision as an OPEN FU referencing the
   Phase 5 rider verdict.

## Phase 7 — commit/push/PR

1. Stage explicitly (never `git add -A`). Branch off freshly-fetched main.
2. PR title: `fix(goals): reconcile MDRT thresholds + AwardsReachPanel merged accessor + spec correction`.
3. Report PR-ready with feature-branch HEAD SHA (Rule 20), bot reviews polled and
   dispositioned (Rule 21), ≥1 known gap enumerated (Rule 22), Phase 5 rider verdict
   included. HOLD for human merge.

## Rule 22 — minimum known gap to state

No live tenant currently overrides awardsRuleset in Firestore, so the merged-accessor
change is proven only by unit tests, not by a production data path.
