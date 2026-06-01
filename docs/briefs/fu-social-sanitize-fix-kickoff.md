# FU (HIGH) — submissionService.sanitize() social-field write gap

**Type:** Bug fix, service-layer data-persistence. Pre-existing in `main` (affects BOTH the v1 and v2 wizards).
**Merge:** Human-merge + dispatcher pre-review (data-persistence change). NOT auto-merge.
**Surfaced by:** PR #416 path-A smoke (`fields=true/11` — the 11 non-social fields persist; the 5 social fields are silently dropped).

---

## The bug

`submissionService.sanitize()` does not enumerate the social/content fields, so they are entered in the wizard and held in `formData` but silently stripped before the Firestore write. Silent data loss. Forward-only fix — social data not captured to date is gone and is not recoverable.

The 5 affected fields (per the PR #416 Phase 1 inventory):
- `socialPostsTotal`, `socialEngagementTotal`, `socialInboxEnquiries`, `namesFromSocial` — numerics
- `socialPlatformBreakdown.{facebook, instagram, whatsapp, linkedin}` — nested object, numerics

---

## Phase 1 — source-verify FIRST (no code until done)

1. Read `submissionService.js` `sanitize()` in full. Confirm the exact current field enumeration, and confirm **how it already handles the other nested objects** that DO persist (`newBusiness`, `pppIncreases`, `lumpsums`) — mirror that same nested-handling pattern for `socialPlatformBreakdown`. Do not invent a new pattern.
2. Confirm `sanitize()` is the **only** drop point — that no other gate in the write path strips these fields.
3. **Rules fork — the decision that sets the scope.** Read `firestore.rules` for the WAR submission write path and determine whether the rules constrain or whitelist the submission's field set:
   - **Permissive** (write allowed regardless of field set) → this is a **frontend-only** fix (the `sanitize()` edit), auto-deploys via Vercel on merge. Proceed.
   - **Field-validated / whitelisted** → the 5 social fields must also be added to the rules, which is a **rules deploy = dispatcher action (Rule 19)**. **STOP and wait for dispatcher** — do not ship a fix that writes fields the live rules would reject (the prod write would fail). Surface the exact rules constraint.
4. Confirm the domain `parseFloat` rule applies to the 5 social numerics in `sanitize()`.

**Surprise-stop:** if the rules whitelist fields (step 3) → STOP and wait for dispatcher.

---

## Phase 2/3 — build

Add the 5 social fields to `sanitize()`'s enumeration, mirroring the existing nested-object handling for `socialPlatformBreakdown`, with `parseFloat` on the numerics. No other changes. Service file only — do not touch the wizard.

---

## Phase 3f — verification

1. **Unit test:** `sanitize()` retains all 5 social fields (including the 4 nested `socialPlatformBreakdown` keys) with `parseFloat` applied, and leaves the existing fields untouched.
2. Lint + full vitest + build green.
3. **Smoke (write-read-verify, the exact failing case):** fill the social fields (v2 step 4 / StepSocialMedia) → submit → Admin-SDK read-verify that all 5 social fields now **persist with correct values** → cleanup to 0. Both themes. Re-delete the service-account-key after (Rule 4).

---

## Phase 4 — docs with placeholders

- `docs/CONTEXT.md`: recently-shipped row with `#TBD/{TBD}` placeholders; check/clean double-Next-track-row.
- `docs/FOLLOW_UPS.md`: mark the **HIGH social-sanitize** FU resolved with placeholders.
- Ledger: not a Track J screen port — no ledger row.

## Phase 5 — commit / push / PR

Open PR, STOP, do not merge (Rule 19). If Phase 1 found a rules implication, the PR body notes the pending rules deploy and the dispatcher deploys rules at merge (deploy-hygiene check).

---

## Out of scope

The v2 panel's social display (→ PR2) · any new social fields · the wizard components themselves · backfilling historical lost data (not recoverable).
