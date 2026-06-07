# Kickoff — Night Queue: Main-Codebase Review + Visual Walk (R1/R2 program)

**Version: v1 (2026-06-06).**
**Type:** overnight autonomous queue under the STANDING GREEN CHANNEL + NIGHT RULES
D1–D5. Serialize smokes · hardened harness · canonical-worktree env checks · two-revert
circuit breaker across the whole night · strike count 0/2.
**HARD LINES (unwaivable):** firestore.rules · functions/** · schema/doc shapes ·
money-math engines (commissionMath, goalDecomposition, calculations formulas) · token
DEFINITIONS · dependencies · writes outside the established smoke patterns. Findings in
these areas are REPORT-ONLY.
**REMEDIATION channel** (the operator's recorded grant, dispatcher-bounded): per-fix
failing-test-first for bug claims · ≤15 lines / ≤2 files · own branch + PR + full gates
+ axe NO-NEW on UI files · AUTO-MERGE on full self-pass · prod spot-check per merged
batch · HARD CAP 8 remediation merges tonight across R1+R2 combined; beyond-cap →
MORNING DECISIONS. Perf findings report-only. #517 is NEVER touched or merged tonight
(held for the operator's aesthetic verdict).

## Execution order: 0 → R1 → R2 → E

### ITEM 0 — Harvest continuation · conditional
If the Gemini harvest window left batches unfinished (PRs open, dispositions pending):
complete them under the harvest brief's own bounds and grant. If the harvest finished:
verify its docs artifact landed, SKIP.

### ITEM R1 — Code review of current main · REVIEW=GREEN, FIXES=REMEDIATION
The program the operator commissioned: review what's actually shipping.
(a) HORIZONTAL pass across src/: the every-component loading/error/empty rule ·
parseFloat on all numeric writes · TT date utils at every date site · listener/effect
cleanup + dependency arrays · query tenant/agent scoping (ANY under-scoped read is a
FINDING — report-only, rules-adjacent, named loudly) · dead exports (zero-consumer grep
proof) · obvious correctness bugs · error-swallowing catch blocks.
(b) ARC spot-reviews: the recent merged arcs (#487 sweep, #494, #496/498/500, #505/509/
515, #502/503, #508, #510) — each gets a focused "would a reviewer object" pass.
Output: the findings table (file:line · class · severity · disposition FIX/REPORT/FU),
then remediation per the channel. Findings contradicting recorded doctrine or
characterization-protected behavior are DISAGREE-with-citation, never "fixed."

### ITEM R2 — Visual walk + hero census · AUDIT=GREEN, FIXES=REMEDIATION (shared cap)
Screenshot walk of every screen (agent + manager nav sets), BOTH themes:
(a) Visual audit vs Nexus conventions — spacing/alignment drift, wrong-tier ink,
touch-target shortfalls, theme asymmetries, missing states. Mechanical existing-token
fixes ride the remediation channel with before/after screenshots; anything needing a
token decision or design judgment → MORNING DECISIONS with the screenshot.
(b) THE HERO CENSUS for the S3 sweep: per screen — top-summary-card identification →
component file:line → verdict HERO / NO-GLASS (recipe census reason) / AMBIGUOUS. The
operator's named four (Dashboard YTD · History "Your Year" · Policy Ledger pipeline ·
Production Report top card) are explicit rows; the #517 three are DONE rows. The table
is a REPORT (the S3 census STOP resolves against it tomorrow) — no conversions tonight.
(c) AXE per screen, both themes, NO-NEW vs the bell-badge baseline; on any GLASS
surface also report the color-contrast INCOMPLETE count (the axe-blind-spot doctrine).
Pre-existing finds enumerated for FUs; in-family one-liners (D6 pattern, faint/muted
class) may ride remediation per the established carve-outs.

### ITEM E — Hygiene · GREEN
Branch/worktree sweep per the runbook · prune gone-upstreams (skip attached) ·
report survivors with verdicts.

## MORNING DECISIONS — expected
The hero census table (for the S3 confirmation) · beyond-cap and out-of-bounds findings
(tenant-scoping finds first) · visual judgment items with screenshots · anything parked.

## End-of-night report
Per-item table · findings tables (R1 + R2 + census) · per-remediation evidence
(failing-test commit → fix commit → gates) with the running cap count · PR links + SHAs
(Rule 20) · auto-merge evidence · MORNING DECISIONS · strike count.
