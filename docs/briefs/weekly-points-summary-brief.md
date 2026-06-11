# Brief — Weekly points summary (agent payoff moment) [RECON-FIRST]

**Suggested branch:** `feat/weekly-points-summary`
**Size:** M
**Type:** Depends on the Phase 1 fork ruling — **frontend-only** (no deploy) if the frontend computes the value, or **frontend + CF + deploy** if the CF writes a delta. Human-merged + pre-review either way.

---

## Context

The gamification arc has the engine (the 20-activity scale, PR #556/#558) and the agent surface (MyPointsCard + transparency panel, PR #561). The missing piece is the payoff: a per-submission "you earned N points this week" moment. MyPointsCard is a place to *see* points; this is the moment that *rewards* earning them. With no agent points leaderboard, it's the only place an agent watches points move week to week — the most motivating piece of the arc, and the one currently absent.

## Goal

After an agent submits their weekly report, a tasteful moment showing the points earned that submission plus progress toward the next level — e.g. "Strong week — +165 points · 60 to Pro" — with a special celebration on a level-up.

---

## THE DESIGN FORK — Phase 1 crux (do NOT pre-decide)

How does the frontend obtain the points earned for a single submission? Two genuine options, plus a hybrid:

- **Option A — frontend computes.** Duplicate `computePoints` as an ESM module (`src/`) mirroring the CF's CJS `computePoints` (extracted in PR #556), per the established duplicate-CJS+ESM + deep-equal cross-check convention (precedent: `rankingLogic.js` ↔ `computations.js`). The frontend runs it on the submitted data → **instant display, frontend-only** (the CF copy is untouched, no deploy).
  - Risks Phase 1 must weigh: (1) the frontend must compute on the *same data shape the CF reads* (the written `after.data()` form) — an input-shape divergence would display a number that doesn't match the agent's actual total increase, eroding trust in a trust-sensitive feature; (2) a `computePoints` cross-check (CF CJS output == frontend ESM output across fixtures) must be feasible in the vitest setup.
- **Option B — CF writes the delta.** `onSubmissionWrite` already computes points and increments the cumulative; have it *also* write the per-submission delta (e.g. a `lastSubmission` field) the frontend reads. **Accurate by construction** (the CF's actual number — no divergence possible), simple frontend. Costs: a CF change + deploy (human-merge per Rule 19) + **latency** — the moment waits ~1-3s for the CF to process and write, or surfaces on the post-submit dashboard rather than instantly.
- **Hybrid:** frontend instant-display (A) with the live `leaderboard/{uid}` subscription as the authoritative backstop that self-corrects the persistent total. Phase 1 can recommend this if it's cleaner.

Deciding factors: the entanglement/cleanliness of a `computePoints` port (A's feasibility), the input-shape-divergence risk (A's accuracy), the CF latency (B's UX cost), and whether instant gratification (A) or accuracy-by-construction (B) better serves the moment. **This brief stays neutral — Phase 1 reports both with a recommendation, dispatcher rules.**

---

## Phase 1 — recon (HARD STOP)

1. **THE FORK.** Locate the CF's pure `computePoints` (extracted in PR #556 — `git grep`, don't assume the path). For Option A: how entangled is it — can it be cleanly duplicated as a pure ESM function? What input shape does it consume (flat fields off `after.data()`?), and does the wizard's in-memory submission data match that shape (the input-divergence risk)? Is a CF-CJS-vs-frontend-ESM cross-check feasible in vitest (precedent: the config + `rankingLogic` cross-checks)? For Option B: where in `onSubmissionWrite` the delta would be written, and the realistic read latency. Report both with a recommendation.
2. **SUBMISSION FLOW.** Where the weekly wizard submits (the submit handler / WizardForm), and where the agent lands afterward (dashboard? confirmation screen?). Identify the natural mount for the moment — post-submit modal/toast, or a card on the landing surface.
3. **CONTENT INPUTS.** Confirm the frontend has what it needs for "progress to next level" (cumulative from `leaderboard/{uid}` + `LEVEL_THRESHOLDS` — MyPointsCard already reads both) and for level-up detection (whether this submission crossed a `LEVEL_THRESHOLDS` boundary, i.e. prior cumulative vs new).

Report findings + a fork recommendation. Hard stop for dispatcher ruling before Phase 2.

---

## Phase 2 — build (approach confirmed at the Phase 1 ruling)

1. The per-submission points value, obtained per the ruled fork.
2. The moment UI — points earned + progress to next level. Read `/mnt/skills/public/frontend-design/SKILL.md` first; Nexus styling, Lucide icons, both themes, 44px targets, **tasteful, not gimmicky**.
3. Special-case a **level-up** ("You reached Pro!"). Handle **first submission** (no prior points) and a **low/zero-points** submission gracefully — encouraging, not patronizing; don't show a celebratory moment for 0.
4. Mount at the spot confirmed in Phase 1.
5. If Option A: the ESM `computePoints` + cross-check test. If Option B: the CF delta-write + the frontend read.

---

## Phase 3 — verify

1. If Option A: the `computePoints` cross-check (CF == frontend) + unit tests for the moment's content (earned amount, progress, level-up, first-submission, zero).
2. Frontend smoke: submit a weekly report (write-read cycle) → assert the moment renders the correct earned amount + progress. Both themes.
3. If Option B: post-deploy smoke (CF writes the delta → frontend reads it).
4. Lint / Vitest / build green.

---

## Phase 4 — docs (with placeholders)

Note the moment ships and completes the gamification arc (engine → surface → payoff). If Option A, record whether the duplicated `computePoints` routes through `extractFields` or stays flat-schema, and bank the `extractFields` routing if deferred (the pre-existing flat-schema `computePoints` note). SHA placeholders for Phase 5.

---

## Phase 5 — commit / push / PR

Human-merge + pre-review. Rule 20 HEAD SHA; Rule 21 Gemini disposition. If Option B (CF change): `firebase deploy --only functions` gated on "Deploy complete!", then post-deploy smoke. If Option A (frontend-only): no deploy, pre-merge preview smoke.

---

## Boundary

- A per-submission payoff — **no leaderboard or ranking**.
- Don't bundle the `extractFields` `computePoints` refactor unless the ruled fork requires it — otherwise bank it.
- Tasteful celebration consistent with Nexus restraint — no confetti-gimmickry unless you explicitly want it.
- If Phase 1 finds the submission flow has no clean post-submit mount (e.g. the wizard just closes to a busy dashboard with nowhere natural), say so — that's a mount decision worth surfacing, not forcing.
