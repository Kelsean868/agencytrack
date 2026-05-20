# PR Kickoff — Weekly Activity Floors (Company Minimum Standard)

**Track:** Quick win — roadmap revision §3.5 (`docs/AgencyTrack_Workshop_Roadmap_Revision.md`). Not a Track D–H item.
**Type:** Feature PR · **Size:** M · **Risk:** Low–Medium
**Provenance:** Tatil manager workshop 2026-05-19. Managers negotiated and agreed a 10-activity weekly minimum standard (Appendix A of the roadmap revision). This surfaces that standard inside AgencyTrack.

---

## Goal

Store the ten agreed company-minimum weekly activity floors, and show each agent **"Expected (standard) vs Actual (this week)"** on their dashboard. This is the contract-relevant "they listened to us" signal — the managers' negotiated numbers, live in the product, on their first look.

---

## Source-verified current state (Rule 17)

- `config/companyMinimums` currently holds only `annualAPI` / `annualApps` / `persistency`. No weekly activity floors exist yet.
- `goalsService.js` exposes `getCompanyMinimums(tenantId)` (returns built-in defaults when no explicit doc) and `setCompanyMinimums(tenantId, data, updatedBy)` (B5 made only `annualAPI` editable; `merge: true` preserves other fields). `usingDefaultMinimums(minimums)` heuristic = doc has `updatedBy`/`updatedAt`.
- Submission actuals are read through `src/utils/extractFields.js` (flat schema, single source of truth). **Canonical keys confirmed in Phase 1 source-verify** (see corrected mapping below): `totalTelAttempts` (derived), `telContacts` (with `qualifiedApproaches` fallback), `appointmentsSet`, `ffiConducted`, `ciConducted`, `applicationsSold`, `livesSold`, `apiSold`, `totalNewNames` (derived 7-sum). Earlier draft of this brief referenced `telephoneDials` / `telephoneContacts` — those names do not exist in the codebase; corrected below.

## Activity → actual mapping (corrected 2026-05-20 per Phase 1 source-verify)

| # | Floor key | Activity | Floor (weekly) | Actual source |
|---|---|---|---|---|
| 1 | `callsMade` | Calls Made | 60 | `totalTelAttempts` (derived 4-sum; **`serviceCalls` excluded by design** — prospecting dials only) |
| 2 | `contactsMade` | Contacts Made | 40 | `telContacts` (**resolves to `qualifiedApproaches` via existing `extractFields` fallback** as the current app-consistent proxy until a true telephone-contacts wizard field exists) |
| 3 | `appointmentsScheduled` | Appointments Scheduled | 20 | `appointmentsSet` |
| 4 | `interviewsKept` | Interviews Kept | 15 | `ffiConducted + ciConducted` |
| 5 | `factFindsCompleted` | Fact Finds Completed | 10 | `ffiConducted` |
| 6 | `closingInterviewsKept` | Closing Interviews Kept | 10 | `ciConducted` |
| 7 | `applicationsSubmitted` | Applications Submitted | 1 | `applicationsSold` |
| 8 | `clientsSold` | Clients Sold | 1 | `livesSold` |
| 9 | `api` | API (TTD) | 4,800 | `apiSold` |
| 10 | `referralsNewLeads` | Referrals / New Leads | 100 | `totalNewNames` (existing derived 7-sum: `namesFromColdCanvass + referralsObtained + namesFromSeminarsConducted + namesFromSeminarsAttended + namesFromTradeshowsConducted + namesFromTradeshowsAttended + namesFromOther`) |

**Decision baked in (sanity-check on review):** #4 "Interviews Kept" = all interviews held = `ffiConducted + ciConducted`, so it deliberately overlaps #5 and #6. Acceptable for a floor-vs-actual display; managers flagged a 6-month review. If "Interviews Kept" should instead mean *appointments kept* (a distinct kept-rate), that requires a new wizard field and a re-scope.

**Notes on the corrected mapping:**
- **Row #1 (`totalTelAttempts`):** the canonical "Dials" surface across `AgentDashboard`, `MasterSheet`, `MeetingMode`, `AgentReportDocument`, `Kiosk`. Excludes `serviceCalls` — prospecting attempts only, matching the workshop definition of "a call = a dial attempt".
- **Row #2 (`telContacts` → `qualifiedApproaches` proxy):** `extractFields.js` already comments "telContacts not saved directly; qualifiedApproaches is best available proxy" and uses fallback `d.telContacts || d.qualifiedApproaches`. Card surfaces this transparently via a small footnote/tooltip ("Contacts = qualified approaches (current proxy)") so the resolution is not hidden. A future wizard field for true telephone contacts auto-improves accuracy with no schema change. Tracked as a follow-up in `docs/FOLLOW_UPS.md`.

---

## Scope

**IN**
- Extend `config/companyMinimums` with a `weeklyActivityFloors` object (the 10 keys above).
- `goalsService.js`: `getCompanyMinimums()` returns the new block, defaulting to Appendix A values when absent; `setCompanyMinimums()` merges/preserves it.
- Admin SDK seed script (idempotent) writing Appendix A into `tatillife_south` `companyMinimums`; sets `updatedBy`/`updatedAt` so `usingDefaultMinimums()` returns false.
- Agent surface: a **"Weekly Standard — Expected vs Actual"** card on `AgentDashboard`. Ten rows; **Expected** = floor, **Actual** = current-week submission via `extractFields` (#4 and #10 derived). Per-row status (green ≥ floor / amber within threshold / red below). Card uses the words "Expected" and "Actual" natively. Nexus tokens, mobile-first, 44px targets, light + dark.
- Firestore rules: confirm/extend so the new fields on `companyMinimums` are readable by authenticated tenant users (likely already covered — same doc).

**OUT / DEFERRED (fast-follow PRs, logged in FOLLOW_UPS.md)**
- Tenant-Admin in-app editor for the 10 weekly floors (B5 `EditConfigModal` pattern). Fast-follow.
- Broader "Expected/Actual" relabel of existing `KPICard` / `MasterSheet` wording. Separate tiny PR.
- Manager-side roll-up of floor adherence. Later (Track F adjacency).

---

## Phases

1. **Source-verify.** Confirm exact `extractFields` key names (incl. Step-5 new-name sources for #10), verify the `companyMinimums` Firestore read rule covers new fields, confirm `ffiConducted`/`ciConducted` are the right held-interview keys. Pair `grep` with `git ls-files` for any tracked-status claim.
2. **Data + service.** Extend schema; `getCompanyMinimums` defaults to Appendix A; `setCompanyMinimums` preserves the block. Admin SDK seed script (idempotent) + run against `tatillife_south`. Tests: defaults seeding, merge preservation, `usingDefaultMinimums` flips false after seed.
3. **Agent surface + rules.** "Weekly Standard — Expected vs Actual" card on `AgentDashboard`, actuals via `extractFields` (#4/#10 derived), per-row status. Confirm/extend Firestore rules. Loading / empty / error states.
4. **Docs (placeholders).** `docs/CONTEXT.md` Recently-shipped row with `#TBD` / `{TBD}`. `docs/FOLLOW_UPS.md`: mark the §3.5 quick-win (weekly-floors portion) shipped, and add the two deferred fast-follows (TA editor; Expected/Actual relabel).
5. **Commit / push / PR.** Single branch off fresh main (`git fetch` first). Lint + build gate. Push feature branch, open PR via `gh`, Rule 15 post-push verify (`git fetch origin && git log origin/<branch> --oneline -1`), report. **Do not merge** — Kyron merges.

**Smoke: RUN** (user-visible). Production smoke via `setupBypassSession` including a real write-read-verify cycle (per smoke standard): log in as test agent, load the dashboard, assert the card renders the seeded floors as "Expected" and the agent's current-week numbers as "Actual" with correct per-row status, light + dark, 390×844. A selector-only check is insufficient — it must actually read the seeded `companyMinimums` doc and a submission's actuals.

---

## Acceptance criteria

- `tatillife_south` `companyMinimums` carries `weeklyActivityFloors` = Appendix A; `usingDefaultMinimums()` = false.
- `AgentDashboard` shows the 10-row Expected vs Actual card; Actuals equal `extractFields` for the current week; #4 = `ffiConducted + ciConducted`; #10 = sum of new-name sources.
- Lint 0; build green; real-pixel verification at 390×844; light + dark.
- Firestore rules allow tenant-user read; zero permission errors in the smoke write-read-verify.
- Original wizard step files untouched (steps are frozen).

## Post-merge (after Kyron confirms merge)

Standard sequence: sync main, capture squash SHA, fill `#TBD` / `{TBD}` in `CONTEXT.md` + `FOLLOW_UPS.md`, commit + push direct to main, Rule 15 verify, hard-stop on mismatch.

---

## Appendix A — Seed values

```
weeklyActivityFloors: {
  callsMade: 60,
  contactsMade: 40,
  appointmentsScheduled: 20,
  interviewsKept: 15,
  factFindsCompleted: 10,
  closingInterviewsKept: 10,
  applicationsSubmitted: 1,
  clientsSold: 1,
  api: 4800,
  referralsNewLeads: 100
}
```

Source: Tatil manager workshop 2026-05-19 (roadmap revision Appendix A). Currency TTD. Subject to managers' 6-month review.
