# Track J — Wizard v2, PR1: Structural Shell (re-pagination + navigation)

**Type:** REDESIGN (composition/structure changes allowed — NOT a restyle)
**Merge:** Human-merge + dispatcher pre-review. NOT green-channel auto-merge.
**Arc:** This is PR1 of 3. PR2 = live-compute layer (Week-So-Far panel + computations). PR3 = Review step + celebration. Build PR1 only.

---

## Goal

Port the WAR Wizard from its current 9-step / 5-group structure to the v2 mockup's **12 micro-steps across 4 phases**, with the v2 navigation chrome (phase rail, full-screen modal takeover, footer nav, autosave chip). Re-fan the **existing** step fields into the new layout — do **not** rewrite field logic, add computations, or change what gets persisted.

The acceptance bar for PR1: an agent can complete a full WAR through the new 12-step flow and submit it, and the persisted submission is **byte-for-byte the same shape** as today's. The re-pagination is a navigation/layout change only.

**Source mockups (read in full before coding):**
`design_handoff_v2_app/mockups/wizard-v2-shared.jsx` (model, progress, field atoms, phases/steps) and `design_handoff_v2_app/mockups/wizard-v2-screens.jsx` (desktop/mobile chrome, footer, modal frame).

---

## Locked decisions feeding this PR

- **(B) Activity re-bucketing** — Steps 1/2/4 in v2 are titled "Letters & outreach," "Seminars & tradeshows," "Social & content." These are to be treated as a **re-grouping of existing prospecting fields**, NOT new inputs. Phase 1 must diff against the current Step 1 fields and confirm this. **If any of those three steps has no corresponding existing field → STOP and wait for dispatcher** (a genuinely-new activity input is a schema-add decision, out of scope here).
- Deferred to later PRs / FUs (do NOT build in PR1): Week-So-Far panel, all live computations, last-week hints/deltas, 6-week sparkline (→ PR2); Review step + jump-back + celebration (→ PR3); SUGGESTED values + goal-seeding (→ deferred FU, decision A).

---

## Phase 1 — source-verify FIRST (no code until this is done)

Per Rule 11/17. Read the live source, not the ledger's description of it.

1. Read `src/components/wizard/WizardForm.jsx` and all 9 step files (`steps/Step1Prospecting…Step9Goals.jsx`). Build a complete inventory of every persisted field and which step owns it today.
2. Confirm exactly how `WizardForm.jsx` groups 9 → 5 and how submission keys off field state, so the re-fan to 12 preserves the **same persisted field groups**.
3. **Decision-B diff:** map the current Step 1 prospecting fields onto the new Activity steps 1 (Letters & outreach), 2 (Seminars & tradeshows), 4 (Social & content). Confirm each new step is fed by an existing field. **STOP and wait for dispatcher** if any is unmatched.
4. Read the two mockup files for the exact pagination table, phase ranges (Activity 1–5, Sales 6–8, Reflection 9–10, Goals 11–12), and the desktop/mobile chrome.
5. Confirm the autosave key can move to the new 12-step index without changing what is written to Firestore.

**Surprise-stop triggers (halt immediately, Rule 12 language only):** any genuinely-new Activity bucket; any step that would alter the persisted submission shape; any contradiction between the mockup's pagination and the actual current field set.

---

## Phase 2/3 — build

Re-fan + chrome only. Reuse the existing field components (`CurrencyField`, `NumericField`) and the existing submit path unchanged.

1. **Pagination** — implement the 12-step / 4-phase structure per the mockup table. Each micro-step renders the existing fields assigned to it. Map (from the spec):
   - 1 Letters & outreach, 2 Seminars & tradeshows, 3 Calls & face-to-face, 4 Social & content, 5 New names added → (Activity)
   - 6 Approaches & interviews, 7 New business this week (incl. collapsible PPP + Lumpsums), 8 Delivery & service → (Sales)
   - 9 Hours worked, 10 Rate your week → (Reflection)
   - 11 Targets for next week, 12 *(Review — PR3; for PR1, step 11 is the final step and submits via the existing mechanism)* → (Goals)
   *(Note: PR1 ends the flow at step 11 with the existing submit/confirmation. The discrete Review step 12 arrives in PR3.)*
2. **PhaseProgress** — phase-labels row (active = teal + "·pos/len" counter, past = green, future = faint) + a segmented dot bar, one dot per step, grouped by phase (current = elongated teal pill, past = solid teal, future = mute). Build all 12 dots (the mockup's "11" comment is stale).
3. **Modal takeover** — full-screen wizard over a dimmed app shell on desktop; mobile = sticky header (status + step title + autosave chip + close) and sticky footer (Back / Next). Not an inline route.
4. **Footer nav** — Back (left) · centered step-info ("STEP N OF 12") · Next (right, labeled with the upcoming step title). Strictly linear forward/back. Progress dots: allow tapping **visited** steps, gate future steps.
5. **AutosaveChip** — v2 visual dressing for the existing `WizardFormSaveStatus` (states: saving / saved / failed + "tap to retry"). Save **behavior** unchanged; only the chip's appearance and its step-index keying change.
6. **Preserve, do not touch:** field components, submission payload shape, Sunday week-start rule, `parseFloat` on numerics, TTD currency, the existing submit/confirmation.

Tokens/styling: Nexus warm theme via existing CSS vars. 44px touch targets. Motion-reduce safe on any transition. No new hardcoded hex.

---

## Phase 3f — verification (baked in)

1. **Regression test (the critical one):** assert that, for a fixed set of inputs, the submission payload produced through the new 12-step flow is identical to the payload the current 9-step flow produces. The re-pagination must not change a single persisted field.
2. **Component tests:** PhaseProgress renders 4 phases + 12 dots with correct active/past/future states; footer Next/Back advance and retreat across phase boundaries; visited-step dot is tappable, future-step dot is not; modal mounts and the close affordance works; autosave chip reflects saving/saved/failed.
3. Lint + full vitest + build green.
4. **Smoke — write-read-verify on the Vercel preview** (per smoke standard, not selector-only): log in as the test agent → open the new wizard → fill a complete WAR through all steps → submit → **reload** → assert the submission persisted with the same shape as before. Run both themes. This exercises rules + claims + indexes, not just rendering.

---

## Phase 4 — docs with placeholders

- `docs/CONTEXT.md`: add a recently-shipped row for Wizard v2 PR1 (shell) with `#TBD/{TBD}` placeholders; update Active/Next track narrative (Next = Wizard v2 PR2 compute layer). Check for and clean any double-Next-track-row artifact.
- `docs/track-j-port-ledger.md`: mark the Wizard row **PARTIAL — shell ported (PR1); compute layer + review pending (PR2/PR3)**. Do not flip headline count to fully-ported.
- `docs/FOLLOW_UPS.md`: bank (a) **Wizard v2 PR2** (live-compute layer) and **PR3** (Review + celebration) as the continuation; (b) **Suggested-values + goal-seed sourcing** (MEDIUM, decision A deferred — needs a per-field source chosen: last-week / weekly floor / tenure floor / personal goal — before the SUGGESTED atom is wired); (c) anything Phase 1 flagged.

## Phase 5 — commit / push / PR

Commit, push to feature branch, open PR. Stop at the open PR. **Do not merge** (Rule 19). Report for dispatcher pre-review.

---

## Out of scope (explicit)

Week-So-Far panel · any live computation (Production API roll-up, conversion, est-commission, sparkline) · last-week field hints + deltas · new Review step + Edit·Step-N jump-back · submit→celebration/confetti · SUGGESTED values · goal-seeding · any change to persisted submission shape · any new data read.
