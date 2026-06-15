# Onboarding Set-up Wizard — Implementation (Program Brief)

**Sized:** L — program, phased across three slices.
**Type:** Net-new first-login onboarding flow. **Orchestration over existing live flows** + a write-once identity rule. No new write logic for Money Needs / Game Plan / Goals — those are driven through their existing services.
**Channel — SPLIT:**
- **Slice A (onboarding rules) = TIER-C** — Claude pre-review + human-merge + `firebase deploy --only firestore:rules`. Security-sensitive.
- **Slices B & C (wizard frontend) = TIER-B** auto-merge — dispatched only **after Slice A is deployed** (the identity write depends on the rule).
**Suggested CC model:** **opusplan** for Slices A and B (net-new, ambiguous, rules-adjacent); drop to **Sonnet** for Slice C once the pattern is set.
**Persona review:** YES — findings below.
**Design source:** locked CD mockup (`design_handoff_v2_app/`) + lock decisions (2026-06-15): condensed-only steps, full-screen takeover, skip-per-step + persisted resume, summary payoff; **gold = constrained award accent only** (never hero fill), **violet dropped** (map to existing tokens), **no JetBrains Mono** (Satoshi tabular-nums); flow **Welcome → Identity → Money Needs → Game Plan → Goals → Profile → Completion**; skippable; `onboardingComplete` flag; role-agnostic.

---

## Persona review — what surfaced

Reviewed against this project's failure surface; each lens imposed a constraint now baked into the slices below.

- **Tenant-isolation / data-integrity:** every onboarding write must scope to the user's **own UID + own tenant** — identity fields, Money Needs, commitment, profile. The owner-write rule (Slice A) must not permit writing *other* users' docs. Any collision query must be tenant-scoped. → drives the Slice-A field whitelist + own-UID writes throughout.
- **Role / permissions:** self-entry of agentNumber/DOB is a deliberate **pilot relaxation** of the manager-only norm — so the rule must be owner-**write-once** (not free owner-write), must **whitelist exactly** `{agentNumber, dateOfBirth, onboardingComplete}`, and must reject any attempt to write `role`, `tenantId`, or other privileged fields in the same update. `canManage` keeps full write (correction). → Slice A.
- **Money / commission-correctness:** the condensed Game Plan step writes the **Personal Commitment**, and it must use the **same setGoals/commit service + canonical API formula** as the full Game Plan loop — no parallel commitment math. Same for Money Needs. → Slice C "orchestration-via-services" constraint.
- **Operator-legibility:** first impression — must be **skippable** (not a wall before a user can log a sale), clear stepper, write-once messaging that's unambiguous ("set once; your manager can correct it"), and a completion screen that shows the value created. → Slice B/C UX.
- **a11y / contrast:** both themes, ≥44px, the **gold award accent must pass AA** (the retired gold-*hero* pattern stays retired — gold is a small accent only); form fields, validation states, and the DOB picker need labels + announced errors + keyboard paths. → all frontend slices.
- **Pilot-ops / reversibility:** the identity self-entry is pilot-scoped and **reversible** — manager-correctable, and the rule can be tightened post-pilot without touching the wizard. `onboardingComplete` must be **resettable by a manager** (re-onboard). The wizard must be skippable. → Slice A rule shape + Slice B trigger.
- **Maintainability:** build as an **orchestration layer** — no edits to the Money Needs / Game Plan / Goals internals; reuse their services + the v3 panels; the whole wizard is additive and removable. → the cross-cutting build rule.

---

## Architecture

1. **Trigger + flag.** A user is shown the wizard when `users/{uid}.onboardingComplete` is not `true`. Completion (or skip-to-finish) sets it `true`. The flag is Firestore (cross-device gate); a manager can reset it. Owner-writable via Slice A.
2. **Resume.** Prefer **data-derived completion** — which steps' data already exists (Money Needs doc? commitment set? agentNumber set?) — so resume is cross-device-safe, with a localStorage step-pointer as a per-device convenience. Slice B Phase 1 confirms the cleanest mechanism.
3. **Orchestration-via-services (load-bearing).** The condensed Money Needs / Game Plan / profile steps render focused input UI and **call the existing write services** (writes already live in service files per the repo's "writes go through services" rule). The wizard **never reimplements** a write. This is the line between orchestration (cheap, correct, removable) and reimplementation (divergent data).
4. **Identity — write-once + soft-validation + collision deferral.**
   - **Rule (Slice A):** owner may set `agentNumber`/`dateOfBirth` only when currently empty; locked after; `canManage` corrects.
   - **Format (frontend):** 3 digits + 1 letter + 2 digits (e.g. `000A00` placeholder — never a real number). Mismatch = **soft warning**, not a hard block; collision/format backstopped by manager review.
   - **Collision check — DEFERRED for v1.** Real-time uniqueness needs either a cross-roster read (likely permission-blocked for a regular agent) or a callable CF — both expand the gated surface. Agent numbers are Tatil-authoritative, so collisions are rare; **manager review reconciles**. Bank a CF-based collision check as future hardening. (Keeps Slice A to the write-once arm only.)

---

## Slice A — Onboarding rules · **TIER-C (Claude pre-review → human-merge → deploy)**

**Branch:** `feat/onboarding-rules` · **Model:** opusplan.

### Phase 1 — recon
1. Read the current `users/{uid}` write rule; record exactly how owner vs `canManage` writes are gated today, and whether a field whitelist (`hasOnly`) is present.
2. Confirm exact field names: `agentNumber` vs `agent_number`, `dateOfBirth` vs `dob`, and whether `onboardingComplete` exists.
3. Confirm whether profile fields (display name, avatar, prefs) are already owner-writable (Slice C needs this — if not, note it for a Slice-C rule addendum).
4. Confirm the rules emulator harness (Java JDK 21 present) and existing `users` rule tests.

### Phase 2 — build
Add an **owner-write-once** arm to `users/{uid}`:
- Owner (`request.auth.uid == uid`) may write **only** `{agentNumber, dateOfBirth, onboardingComplete}` (whitelist via `hasOnly` on the changed keys).
- `agentNumber`/`dateOfBirth`: write-once — permitted only when the existing value is null/absent; rejected once set.
- `onboardingComplete`: owner may set; `canManage` may set/reset.
- Types enforced (agentNumber string, DOB date-only string/timestamp per the app's convention).
- `canManage(tenantId)` retains full write (correction path) — unchanged.
- **Must not** allow the owner to write `role`, `tenantId`, or any non-whitelisted field in the same update.

### Phase 3 — emulator tests
Owner sets agentNumber once ✓ · owner cannot change it after ✗ · owner cannot write `role`/`tenantId` ✗ · owner sets `onboardingComplete` ✓ · `canManage` corrects agentNumber ✓ · cross-user write blocked ✗.

### Phase 4 — docs
CONTEXT ledger; note the pilot relaxation + its reversibility; bank the deferred CF collision-check FU.

### Phase 5 — PR + **HOLD**
Open PR, run emulator tests, poll Gemini. **HOLD for Claude pre-review** (Tier-C). After approval: human-merge → `firebase deploy --only firestore:rules` → post-deploy rule verification (the deploy gates Slice B). No pre-merge app smoke (rules-only).

---

## Slice B — Wizard frame + identity step · **TIER-B (after A deployed)**

**Branch:** `feat/onboarding-wizard-frame` · **Model:** opusplan.

Builds: the full-screen takeover route + shell, stepper, back/skip/resume nav, the `onboardingComplete` trigger/routing, **Welcome** screen, **Completion** payoff (summarizes what was created, sets `onboardingComplete=true`, drops into the populated app), and the **Identity step** (agentNumber soft-validation, DOB via `parseDateOnlyTT`/`getTodayTT`, write-once messaging; writes through the now-deployed Slice-A rule). Resume per Architecture §2 (Phase 1 confirms mechanism). Both themes, ≥44px, Nexus tokens (no hex), gold accent AA-checked.

- **Phase 1 recon:** routing/entry point for a full-screen takeover; the resume mechanism (data-derived vs localStorage); where `onboardingComplete` is read at login.
- **Smoke (rules-dependent → post-merge-and-deploy):** new user → wizard shows → set agentNumber (valid + soft-warn + already-set-lock paths) → reload → persisted & locked → complete → flag set → wizard does not re-show. Both themes. Value-asserting where applicable.

---

## Slice C — Content steps · **TIER-B**

**Branch:** `feat/onboarding-content-steps` · **Model:** Sonnet (pattern set by B).

Builds the condensed step content, each **calling the existing write service** (no reimplementation):
- **Money Needs** (condensed) → existing Money Needs write service.
- **Game Plan** (condensed commitment) → existing setGoals/commit path (canonical API formula).
- **Goals teaser** → reuse the v3 panels (gap + derived income + MDRT) + pin-a-stretch-award (AwardsReach pin) — the first-run moment.
- **Profile** (optional) → name/avatar/prefs to the user doc (per Slice-A Phase-1 finding on profile-field write perms).

- **Phase 1 recon:** identify the exact Money Needs write service + the Game Plan commit/setGoals service so the condensed steps call them; confirm the v3 panels render correctly inside the wizard chrome.
- **Smoke:** walk the full flow; **write-read-verify** that Money Needs doc, commitment, and profile actually persisted (reload → assert); goals teaser shows the resulting portfolio; skip paths work; resume works. Both themes.

---

## Cross-cutting build rules

- Orchestration only — **no edits** to Money Needs / Game Plan / Goals internals; reuse services + panels; wizard is additive and removable.
- Every write is own-UID, own-tenant.
- Gold = small award/MDRT accent, AA-checked; no violet; Satoshi tabular-nums (no new font).
- Skippable at every step; resume never traps or force-restarts (data already written persists).
- Slices dispatch in order; **B and C do not start until A is deployed**.
