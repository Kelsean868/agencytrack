# Kickoff — Persistency Manager v2 Slice 2: Entry Drawer (restyle of the shipped write)

**Size:** S · **Type:** RESTYLE of an existing WRITE surface — mechanics untouched ·
**Merge:** HUMAN-MERGE + dispatcher pre-review.
**Branch:** `feat/persistency-mgr-v2-s2`
**Layout authority:** `docs/design/persistency-mgr-v2-s1.html` — the entry-drawer
section (six inputs → derived % preview, gold precedence banner, Save & lock). OUT:
the what-if playground + share-as-recommendation (S3), any derivation/service change,
any agent-surface change.

## Locked decisions

### D1 — The write is byte-shape frozen
The drawer calls the SAME savePersistency signature with the SAME payload fields the
shipped form writes today (Phase 0 cites field-by-field). enteredByRole semantics
unchanged (manager-wins). parseFloat on every numeric. Zero service/rules/schema edits —
this slice may only change presentation and mount.

### D2 — Drawer per the annotation
Opens from a roster-row action on the S1 roster (and from wherever the pre-S1 entry
lived, if that mount survived — Phase 0's first item resolves the current state,
including any #505 gap window recorded in CONTEXT). Six inputs with the live derived-%
preview (reuse the shipped derivation — display-only recompute as the manager types),
the gold "saving locks the month — overrides her self-entry, she sees read-only"
precedence banner, Save & lock primary action (bg-primary dark:bg-primary-dark, ≥44px),
cancel affordance. Prefill when a month doc exists (current values + source badge
context); empty form otherwise. Validation states per Nexus conventions.

### D3 — States
Open/prefilled · open/empty · saving · success (roster row + bar reflect the write
without full reload — cite the refresh path or add the minimal callback, S1's
onGoalSaved pattern) · error. Both themes.

## Phase 0 — source-verify (Rule 17)
FIRST: the post-#505 entry-path state (preserved vs gap window — cite CONTEXT/PR
record) · savePersistency signature + full written payload today · the shipped form
component (what survives, what this replaces — enumerate removals) · the derivation
function for the live preview · roster-row action wiring point · the refresh path ·
testids · BM credential + which agents/months exist (smoke arms + restore plan).

## Phase 3 gates
Lint 0 · full suite (S1 suites untouched-green; new RTL: drawer render both prefill
arms, validation, derived-preview correctness vs the calc util, mocked write payload
asserted byte-equal to the shipped shape) · build · hex-grep.

## Smoke (E3 — BRANCH MANAGER credential) — write-read-verify with MANDATORY RESTORE
1. CAPTURE: SDK-read the target agent's month doc IF EXISTS (record full payload) or
   record ABSENT.
2. WRITE via the product UI: open drawer from the roster row → enter sentinel six-input
   values → Save & lock.
3. VERIFY: doc shows sentinel values + manager enteredByRole (SDK read) · roster row /
   bar re-derive against the sentinel (== recompute, reuse the S1 leg) · the agent-side
   lock consequence cited (read-only state derives from enteredByRole — assert the
   field, not the agent UI).
4. RESTORE (PASS/FAIL leg): doc existed → Admin SDK restore byte-exact; doc was ABSENT
   → Admin SDK DELETE the sentinel doc and verify absence. The S1 recompute leg and all
   future data-state smokes depend on this env surviving.
5. Both themes for render legs (write cycle once) · axe NO-NEW vs bell badge · 0
   console errors · §2 screenshots.

## Phase 4 — docs
Standard placeholders · close the gap-window record if #505 opened one · FOLLOW_UPS: S3
queued (playground + the program's first nudge-CF allowlist extension — Compliance
choreography) · note the walk-helpers token-capture micro-FU if not yet done.

## Acceptance
Pixel-true drawer per annotation, both themes · write payload byte-equal to the shipped
shape (RTL-proven) · live derived-% preview equals the calc util · full
capture→write→verify→RESTORE cycle green with the restore leg explicit · entry-path gap
(if any) closed and recorded · zero service/rules/schema drift · Rules 12/15/17/18/19/20.
