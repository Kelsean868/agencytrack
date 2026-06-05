# Kickoff — Commission v2 Slice 3: "Set as my goal" (the write)

**Size:** S · **Type:** WRITE slice — the Commission agent arc's last piece · **Merge:**
HUMAN-MERGE + dispatcher pre-review.
**Branch:** `feat/commission-v2-s3`
**Layout authority:** `docs/design/commission-v2-s1.html` — the "Set as my goal" CTA +
confirm sections. Manager suggest-a-goal is OUT (routed to the manager-program backlog,
2026-06-06 dispatcher decision); Goals/Persistency surfaces are OUT.

## Locked decisions

### D1 — The write reuses the existing path, byte-compatible
"Set as my goal" writes through the SAME service call CareerPortal's GoalsSection uses
(setGoals — cite the service + the ~:647 call site in Phase 0), with the SAME payload
shape. The decomposition's annual API target maps to personalAnnualAPI; include
companion fields (apps etc.) ONLY if CareerPortal writes them today — zero schema drift,
zero new service functions. parseFloat enforced on every numeric (domain rule).

### D2 — UX per the annotation
CTA on the decomposition ladder. Tapping opens a CONFIRM affordance (mandatory — this
overwrites their committed goal) showing current → new. On confirm: write, success
state, and the AnchorStrip re-derives live (gap updates against the new goal). The S1
no-goal empty-state CTA upgrades from navigate-only to this real flow. Guard rails: no
zero/negative/NaN writes; the confirm shows TTD-formatted values.

### D3 — Rules expectation: ZERO changes
The agent own-goal write rule exists (the historical path-based scoping fix — Phase 0
cites the exact rules block). If ANY rules gap surfaces, STOP — that is a finding, not
a patch to improvise.

## Phase 0 — source-verify (Rule 17)
setGoals signature + full payload CareerPortal writes today (field-by-field) · the
agent goal-write rules block · every consumer of personalAnnualAPI (GapAnalysisPanel,
commissionAnchor.gapToGoal, anything else — the write must feed all of them) · the
AnchorStrip re-derivation path post-write (does the dashboard's state refresh, or does
the strip need a refetch hook — cite, design the minimal wiring) · testids · the
S2 smoke's goal-dependence (goal=84000 underpins the recompute leg — informs the
restore requirement below).

## Phase 3 gates
Lint 0 · full suite (S1/S2 suites + both characterizations untouched-green; confirm-flow
RTL added: render, guard rails, mocked write payload asserted byte-shaped vs CareerPortal's)
· build · hex-grep.

## Smoke (E3 — AGENT credential) — write-read-verify with MANDATORY RESTORATION
1. CAPTURE: SDK-read the agent's current committed goal (expect 84000 — record whatever
   exists).
2. WRITE via the product UI: full CTA → confirm flow with a distinct sentinel value.
3. VERIFY: Firestore doc shows the sentinel (SDK read) · the strip's gap re-derives
   against the sentinel (displayed == recompute) · success state rendered.
4. RESTORE via the SAME product flow: set the captured original back; SDK-verify the doc
   equals the pre-smoke value exactly. THE RESTORE IS A PASS/FAIL LEG — the S2 recompute
   smoke and any future goal-dependent leg depend on this agent's data shape surviving.
5. Both themes for the UI render legs (write cycle runs once); axe NO-NEW vs bell-badge
   baseline; 0 console errors; §2 screenshots.

## Phase 4 — docs
Standard placeholders · FOLLOW_UPS: Commission v2 arc marked COMPLETE for the agent
(S1+S2+S3) pending merge · manager suggest-a-goal entry added under the manager-program
backlog section with the nudges-primitive note · the trio intent ("fully working when
agents use them") recorded as DELIVERED: Persistency (pre-existing), Goals (by design via
CareerPortal/Game Plan, now also via this CTA), Commission (S1–S3).

## Out of scope
Manager suggest-a-goal · any nudge/CF work · Goals/Persistency surfaces · engine math ·
rules (STOP on any gap).

## Acceptance
Write lands byte-shaped through the existing path and every consumer reflects it · the
confirm flow per annotation with guard rails · smoke's full capture→write→verify→RESTORE
cycle green with the restore leg explicit in the output · zero rules/schema/engine drift
· Rules 12/15/17/18/19/20.
