# Kickoff — Cleanup Duo: flake stabilization + AA stragglers

**Type:** two-item queue, channels per item. Serialize smokes. Hardened harness.
**Branch per item** (independent PRs).

---

### ITEM 1 — CompliancePanel.nudge flake fix · GREEN (test-only, AUTO-MERGE)
**Branch:** `test/compliancepanel-nudge-stabilize`
The PROMOTED fix-now FU: three full-suite flaps (2026-06-05 settlements, S2, S3
dispatches), always green in isolation — a timing/async race in the test, not the
component. Phase 0: read the test + component interaction (the nudge fire path), name
the race (un-awaited state update, fake-timer gap, missing waitFor — cite lines). Fix
with proper async discipline (waitFor/findBy, timer control); ZERO component/src
changes — if stabilization is impossible without touching src, PARK + report. Proof:
the test 20× consecutive green in a loop run, full suite green ×2 consecutive. Close
the FU. Gates: lint · suite · build. No smoke (test-only waiver per the standing rule).

### ITEM 2 — AA stragglers · MEASURE-FIRST (GREEN if mechanical; STOP if token decision)
**Branch:** `fix/aa-stragglers`
The two banked nodes: NotificationDrawer.jsx:61 "Mark all read" (text-primary
hover:text-primary-dark — reported failing both themes) · ActivityFeed `<time
class="activity-time">` (fails dark).
**Phase 0 — measure, don't trust the reports:** for each node, identify the actual
rendered background (drawer surface, feed card — cite), then compute exact ratios with
src/utils/contrast.js for both themes. Report the matrix.
**Channel fork (self-assign honestly):**
- If BOTH nodes fix mechanically with EXISTING tokens (e.g., the time tag's custom CSS
  color → an existing ink token; the button passing with --color-primary on its actual
  bg, or failing only via the hover state needing dark:hover:text-primary-light which
  ALREADY EXISTS) → GREEN: fix, deterministic contrast test additions for both nodes,
  targeted axe re-run on NotificationDrawer + ActivityFeed both themes (expect the
  drawer's last allowlist residual beyond the bell badge to clear), suite, AUTO-MERGE.
- If EITHER node needs a NEW token or a design call (a deep-primary-for-text value,
  any new CSS variable) → STOP after Phase 0 with the measured matrix + a recommended
  token; the dispatcher decides. Token definitions are never autonomous.
Close/update both FUs accordingly; note the bell badge remains the lone intended
residual either way.

---

## Report
Per-item: PR/SHA (Rule 20) · the 20× loop output (Item 1) · the contrast matrix
(Item 2) · FU closures · anything parked/stopped.
