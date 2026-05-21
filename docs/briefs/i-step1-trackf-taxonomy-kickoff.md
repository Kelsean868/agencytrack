# PR Kickoff — Track I Build Step 1: Track F Taxonomy Confirmations

**Track:** I (build step 1 — a Track F cleanup the head-of-sales conversation unblocked). **Type:** Feature PR · **Size:** S · **Risk:** Low (enum updates to shipped Track F prospect-info; no rule/privacy change).
**Provenance:** Track I design spec §5 (BOA→bank-referral) + §9 (policyType pick-list); head-of-sales confirmations 2026-05-21. Spec: `docs/AgencyTrack_TrackI_ManagerWAR_DesignSpec.md`.

---

## Goal

Apply two head-of-sales-confirmed taxonomy decisions to the shipped Track F prospect-info form (F3, #246): (1) `BOA` → `bank-referral` (distinct from generic `referral`); (2) `policyType` free text → a Tatil product pick-list. Lifts two provisional flags.

## Source-verify first (Rule 17, Phase 1 — STOP on contradiction)

- `prospectInfoService`: confirm `PROSPECTING_SOURCES` (includes `'BOA'`) and the `policyType` field (free text). Confirm both are used by `ProspectInfoPanel` (agent form) and `ProspectInfoTab` (manager display).
- Confirm **no Firestore rule validates these enum values** (F3 is submissions-style; the rule checks ownership/scope, not enum membership) → **no rule change.** Report.
- Check for existing `prospectInfo` docs with `prospectingSource: 'BOA'` or free-text `policyType` (migration scope — likely only F3 test data from today).

## Changes

**§5 — BOA → bank-referral**
- In `PROSPECTING_SOURCES`, replace `'BOA'` with `'bank-referral'` (canonical value); label "Bank Referral (BOA)".
- Existing docs with `prospectingSource: 'BOA'` → backfill to `'bank-referral'` (tiny script) if any non-test docs exist; otherwise note test-data-only and skip. Don't leave orphaned `'BOA'` values that won't render a label.
- Keep the enum reusable-exported (Track H will reuse it as `sourceOfProspect`).

**§9 — policyType pick-list**
- Add an exported `POLICY_TYPES` enum: Critical Illness (Life Span / Life Span Lite) · Final Expense / Micro-Life (Rest Assured) · Term Life · Whole Life / Permanent · Universal Life · Endowment · Pension / Annuity · Mortgage / Credit Life. (Editable as names are verified.)
- `ProspectInfoPanel`: `policyType` free-text input → select. Existing free-text values (test data) display as-is if present; new entries use the enum.

## Scope

**IN:** `PROSPECTING_SOURCES` rename + new `POLICY_TYPES` enum in `prospectInfoService` (both exported); `ProspectInfoPanel` form (source label + `policyType` select); `ProspectInfoTab` display labels; optional tiny backfill for `'BOA'` docs; unit + component test updates.
**OUT:** `needCovered` (still provisional — not this PR); any rule change; Track I core (I1 is next).

## Phases

1. **Source-verify** (above). STOP if the enums/components or the no-rule-dependency assumption differ from the brief.
2. **Enum + service** changes + unit test updates.
3. **UI** — `ProspectInfoPanel` policyType select + source label; `ProspectInfoTab` display labels; component test updates.
4. **Docs (placeholders).** CONTEXT.md recently-shipped row (`#TBD`/`{TBD}`); FOLLOW_UPS.md — lift the BOA + policyType provisional flags, mark **Track I build step 1 shipped**, note **I1 (Manager WAR foundation) next** and that the Track I spec doc is committed at `docs/AgencyTrack_TrackI_ManagerWAR_DesignSpec.md`. **If PR #250's post-merge `#TBD`/`{TBD}` placeholders are still unfilled (check), fill them here with `4fb54a7`/#250.**
5. **Commit / push / PR.** Single branch off fresh main (`git fetch` first). No rule/index change expected — confirm; if none, **no firebase deploy.** Lint + build. **Run the full suite with `.env.local` moved aside** (env-unset parity). Push, open PR via `gh`, Rule 15 verify. Do NOT merge.

**Smoke: RUN** (light — no privacy change):
- Agent enters a prospect-info prep with `prospectingSource = bank-referral` and `policyType` = a Tatil product → reload → persists and displays correctly (agent sees own). Manager sees it in the Prospect Info tab with the right labels.
- Light + dark, 390×844, 0 console errors.

## Acceptance criteria

- `bank-referral` replaces `BOA` (no orphaned values); `policyType` is a pick-list; both enums exported.
- No rule change; F3's submissions-style privacy intact.
- Lint 0; build green; suite green incl. env-unset parity; smoke green.

## Post-merge

Standard sequence: sync main, capture squash SHA, fill `#TBD`/`{TBD}`, commit + push direct to main, Rule 15 verify.
