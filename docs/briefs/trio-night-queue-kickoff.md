# Kickoff — Night Queue v2: trio synthesis + Commission groundwork + contrast-debt to PR-OPEN

**Type:** overnight autonomous queue under the STANDING GREEN CHANNEL + NIGHT RULES
D1–D5 (per-item premise fail → park + continue · cohort fail → drop affected, continue
independent · new-decision questions → SKIP + log MORNING DECISIONS · full halt only for
circuit-breaker / unrecoverable prod / env loss / hard lines: rules, functions, schema,
any Firestore write outside established smoke patterns). Serialize ALL smokes (one
Firestore). Hardened harness (finishSmoke / installGlobalTimeout / resolveSmokeBaseUrl)
mandatory. Channel per item assigned below; CC never self-promotes.
**The 2026-06-04 trio grounding audit (Appendix B) is canon — ingest, do not re-run.**

## Execution order: 3 → 4 → 5 → 6 → 1

---

### ITEM 3 — CD-flag + feasibility verification probe · GREEN (audit-only, report)
Verdict per item — EXISTS / DERIVABLE (name source) / ABSENT — with file:line:
a. tenure→API-floor mapping function (tenure band → company floor table)
b. tier-goal provenance fields (setBy/updatedBy or equivalent) on goals-cascade docs
c. recommend-vs-lock storage: any mode field on cascade docs + what the shipped coaching
   recommend drawer actually writes (cite the write site)
e. policy status machine: do grace-ends / missed-payment / NSF sub-states exist anywhere
   (Policy Ledger schema), or is 'lapsed' the only relevant state (cite)
f. **SETTLEMENTS FEASIBILITY (highest-value item tonight):** per-agent earned-commission
   field census on settlement docs (names, shapes, cite the service), the YTD query
   path, and CRITICALLY whether firestore.rules permit an AGENT own-read of their
   settlements client-side (cite the exact block). If agent own-read is NOT permitted,
   say so plainly — the Commission AnchorStrip then needs a different read path (fact
   for the morning brief, not a judgment).
g. SM-tier and branch-tier YTD API aggregation sources (what exists for scope rollups)
h. math duplication census: commissionMath.js vs goalDecomposition.js vs planVariance —
   enumerate shared/duplicated formulas (the "Commission is the engine" reconciliation)
i. COMPLETE the citations the audit opened: enteredByRole audit trail + lockedByManager
   (persistency), CareerPortal GoalsSection setGoals write site, AND cite the rules path
   that permits agent persistency self-entry (informs a morning product question).
No branch; findings feed Item 4.

### ITEM 4 — Trio synthesis kit · GREEN (docs-only, AUTO-MERGE eligible)
One docs PR, two files in docs/design/, the proven Track-J kit format:
- `trio-redesign-scoping-notes.md` — encode the audit verdicts as canon: Persistency
  agent-side COMPLETE (no work) · Goals agent-side restyle/no-op + the CareerPortal
  goal-setting finding · Commission = the trio's SOLE REDESIGN, data-first (settlements
  wiring before skin) · Goals + Persistency MANAGER scenes routed to a "manager-program
  backlog" section (alongside WARs/MasterSheet), NOT the trio plan. Per-screen: the
  Appendix-A [ADDED] inventory fused with Item-3 findings; slice proposals refined
  (Commission: S1 anchor/data → S2 ladder+targeting visuals → S3 writes).
- `trio-redesign-schema-matrix.md` — every Commission/manager-scene data element
  classified EXISTS / DERIVABLE / NET-NEW with sources.
Attach each Appendix-A flag's Item-3 verdict: FACT-RESOLVED (with citation) vs
TRUE-PRODUCT-JUDGMENT (rolls into MORNING DECISIONS).

### ITEM 5 — Commission test floor · GREEN (test-only, AUTO-MERGE)
(a) commissionMath.js characterization suite: every exported function, table-driven
cases citing source lines, boundaries (zero history, divisor conventions incl.
monthly=10), the decomposition chain end-to-end on a realistic fixture.
(b) Minimal CommissionPlayground RTL baseline: render, tab switch, the setGoals write
path (mocked), localStorage assumption persistence. ZERO src changes — if untestable
without src edits, PARK that part and keep (a).
This is the safety net under the screen we build next; the audit found a one-test floor.

### ITEM 6 — Derived-chip relabel micro-FU · GREEN (XS src, diff-locked, AUTO-MERGE)
SuggestedWeekCard suggestion-state chip 'Dials' → 'Prospecting calls' (banked #477 FU;
ratified semantics). Scope-lock: the label constant + its test assertions ONLY. Gates +
both-themes smoke on the Game Plan card (suggestion state if reachable; else RTL +
note), close the FU in FOLLOW_UPS. If it exceeds label+tests, PARK.

### ITEM 1 — Contrast-debt retirement → PR-OPEN · HUMAN-MERGE (run LAST)
Execute `docs/briefs/contrast-debt-retirement-kickoff.md` (on main) through ALL phases —
Phase-0 inventory regen, -ink tokens + deterministic contrast tests, StatusPill
adoption, faint sweep, allowlist shrink, full gates, both-themes smokes — then OPEN THE
PR and HOLD (token definitions = always human; Rule 19). Morning deliverable: a
merge-ready PR with the inventory table, contrast proofs, and smoke evidence in the
body. If the brief is absent from main, SKIP and log MORNING DECISIONS.

---

## MORNING DECISIONS — expected contents (log, never resolve)
Commission judgments: projected run-rate method (linear / trailing-8wk / seasonal) ·
gap-to-goal reference (Goals personalAnnualAPI vs playground input) · ladder "Dials"
semantics (Prospecting 4-sum vs raw dials; daily-source gap) · any settlements read-path
consequence from Item 3f. Persistency: agent self-entry intended for pilot? (rules
citation attached from 3i). Manager-program backlog items (lever→pp formula · at-risk
sub-states · lock enforcement · Self-tier storage) — parked, not tonight's questions.
Trio sequencing: Commission S1 is the presumptive next build; flag anything that
challenges that.

## End-of-night report
Per-item status table · PR links + SHAs (Rule 20 each) · auto-merge evidence per green
item · MORNING DECISIONS · strike count.

---

## APPENDIX A — Claude Design trio inventory (condensed; authoritative copy in CD)
**GOALS v2 (drawn branch_manager):** [ADDED] per-node YTD cascade · exception-first
agent roster banded vs tenure floor, expandable targets · tier tabs with provenance +
recommend-vs-lock (locked = floor beneath) · Self tier (manager's own, excluded from
rollups) · recommend-drawer REUSE · mobile stack. Banding adopts pace floor-tick grammar.
**COMMISSION v2 (agent + manager variant):** [ADDED] top-level page promotion · "Your
reality" AnchorStrip (YTD earned · projected run-rate · gap-to-goal · 4-wk persistency)
· 7-stage decomposition ladder (engine = commissionMath) · cadence toggle (1/2/4/10) ·
Modal Targeting (mode-mix → API + 12-mo stacked cash-flow) · "Set as my goal" WRITE →
Goals cascade · manager suggest-a-goal (notifications primitive).
**PERSISTENCY v2 (drawn branch_manager):** [ADDED] reality bar (% · 6-mo trend ·
below-floor · award-eligible · lapses) · at-risk exception book · roster banded 90/80 +
source badge + editedAt · entry-drawer restyle (shipped manager-wins write) · what-if
playground (levers → projected pp; share-as-recommendation via notifications) · mobile.
**Flags:** run-rate method · gap reference · ladder Dials semantics · lever→pp formula ·
at-risk sub-states · lock enforcement · SM/branch YTD sources · Self storage ·
persistency by/editedAt · tier-goal setBy.

## APPENDIX B — 2026-06-04 trio grounding audit (canon; condensed)
Mounts: AgentDashboard.jsx nav :64/:66/:67, renders :638/:649/:658. All three Nexus v2,
zero legacy hex, zero TODOs.
**Verdicts:** GOALS agent = RESTYLE/NO-OP (GapAnalysisPanel read-only by design; mockup
goal-setting is manager-facing; agents commit via CareerPortal GoalsSection setGoals
~:647 + Game Plan). PERSISTENCY agent = COMPLETE (PR #395 f62ea76; matches v2 1:1;
5 RTL + 2 smokes; enteredByRole audit trail + lockedByManager verified; FUs WALK-2 /
PERF-1 are LOW). COMMISSION = the sole REDESIGN, and it is a DATA gap: the playground
is a pure client calculator (reads submissions for ratios + localStorage; writes
assumptions via setGoals; NEVER reads settlements) — the AnchorStrip needs real settled
earnings. Test floor: one tap-target RTL test (math covered in utils/commissionMath
tests).
**Surprises:** agents CAN self-enter persistency until manager-locked (contradicts the
CLAUDE.md framing — product confirmation pending) · Commission's gap is data-layer, not
skin · agent Goals tab cannot set goals (by design) · Commission's component test floor
is the thinnest of the trio.
