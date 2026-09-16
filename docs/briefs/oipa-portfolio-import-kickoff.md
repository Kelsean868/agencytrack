# OIPA portfolio import + ledger-driven persistency - kickoff (16 Sep 2026, v2 - Kyron's answers folded in)

run_model: Opus 5 (dispatch with /land-and-dispatch-opus). Opus 5, high effort, for P0-P3. Sonnet 5, medium effort, as a subagent for P4 (UI).

## Goal in one line
Kyron uploads his OIPA/INGENIUM portfolio export, AgencyTrack fills his policy ledger from it, and the persistency tab works out from the ledger which policies count for a report month, instead of Kyron typing seven totals.

## Read first
1. `src/lib/persistency/model.js` and `src/lib/persistency/calculations.js` - the 24-month model and formula. Do not change the formula or the stored field ids.
2. `src/services/policiesService.js`, `src/constants/policyLifecycle.js`, `firestore.rules` (policies arms, lapsed is BM-only).
3. `src/services/persistencyService.js` - `tenants/{t}/persistency/{uid}_{YYYY_MM}` docs.
4. Prospecting project doc `claude/agencytrack-oipa-match-15sep.md` and the workbook `AgencyTrack_OIPA_match_15Sep2026.xlsx` is at `C:\Users\noryk\Documents\AgencyTrack-fixtures\AgencyTrack_OIPA_match_15Sep2026.xlsx`. It holds real client names: never copy it, or the source export, into the repo. Unit tests use small synthetic rows; the P0/P1 paste-backs come from a local script run against these two real files.
5. Source export: `C:\Users\noryk\Downloads\OIPA Agent Portfolio as at 15.09.26 - Kyron Marchan.xlsx`. Title row 1, blank row 2, headers row 3.

## Facts as of 16 Sep 2026 (read-only check)
- Tenant `tatillife_south`, Kyron uid `DRXMI8AgthW7eazwRL06l2Uac4a2`, agent 011B94.
- `policies` collection is empty in the whole tenant. `persistency` has no doc for Kyron.
- No importer exists.

## Hard rules
- Service account key: never print it. Prod writes only in P2 and only when Kyron says go in that session.
- Client data never enters git: no real export, fixture or client name in `docs/`, `src/` or tests.
- Client data: import only the fields listed below. No email, phone, address, DOB, income.
- Idempotent: re-importing a newer export updates by `policyNumber`, never duplicates.
- Never set `status: lapsed` through the agent path. The importer writes as an admin action with a history doc `{source: 'oipa_import', exportDate}`.
- Every list below marked "config" lives in one config file, not in code.

## Import rules
1. Drop OIPA shadow rows: sub status `Pending Issue`, and `AFR`-prefixed twins of an existing number.
2. Skip test records (config): SPI2500081, SPI2500082, SPI2500083, SPI2500084, FNE2500067.
3. One doc per policy number. Result on the 15 Sep file: 229 docs.
4. Status map: Active or Grace -> `settled`; Terminated/Lapsed -> `lapsed`; Not Taken, Withdrawn, Insufficient Premium, Cancelled -> `ntu`; Declined -> `denied`; Pending -> `submitted`; Surrendered, Deceased, Commutation, Claim Paid, NL -> `settled` plus `terminalReason`. Store the raw pair as `oipaStatus` / `oipaSubStatus` and `oipaStatusDate`.
5. Overrides (config). An override wins over the export until Kyron removes it:
   - DAN2602390 was replaced by DAN2602403. Import as `ntu` with `replacedBy: 'DAN2602403'`.
   - FNE2500031 died inside the grace period; a death claim is being submitted. Import as `settled` with `terminalReason: 'deceased'`, `claimStatus: 'pending'`. It is NOT a lapse.
   - TRM2501670 stays `lapsed`. The client will take a new policy instead of reinstating. That new policy is ordinary new business; never link it as a reinstatement.
6. Plan prefix -> name / `policyClass` / system (config):
   - RAE = Rest Assured I, whole_life, INGENIUM
   - LCT = Level Convertible Term, term, INGENIUM
   - CBU = Cash Builder (old annuity / Medallion), annuity, INGENIUM
   - CBA = old annuity (before the change to Destiny), annuity, INGENIUM
   - CIB = LifeSpan Gold (old Critical Illness), INGENIUM. Add `critical_illness` to `VALID_POLICY_CLASSES` and mirror it in `firestore.rules`. Kyron decided: keep the record.
   - DNU / DNA = Destiny annuity, annuity, OIPA
   - ULG / ULI = universal_life (read from the code, not confirmed - flag in the import report)
   - PSU = Kyron to confirm (2 policies, both commuted). Store null + `planClassPending: true`.
   - IMA / IMU appear only on the skipped test records.
   - An unknown prefix imports with null + `planClassPending`. It never fails the import.
7. Fields per doc: policyNumber, ownerName, insuredName, planId, planName, policyClass, sourceSystem, proposedAPI (= API), proposedPremium (= Modal Premium), proposedFrequency (Monthly M, Annual A, Semi-Annual S, Quarterly Q), proposedCoverage (= Sum Insured), dateIssued, paidToDate, totalPremiumPaid, writingAgentNumber, writingAgentName, servicingAgentNumber, oipaStatus, oipaSubStatus, oipaStatusDate, exportDate, importedAt. `agentId` = Kyron's uid (servicing). `isWritingAgent` = writingAgentNumber equals the profile's agentNumber.
8. `isSelfOrFamily` (config): true for FNE2600720 (Kyron) and TRM2501755 (Kyron's sister). False for TRM2602866. It removes campaign credit only. These policies still count for persistency.
9. `newBusinessType` = `nb_ordinary` for all; `sourceOfProspect` = a new value `portfolio_import` (or the nearest existing value - check `PROSPECTING_SOURCES`). Imported docs must not count as new production in weekly or campaign totals for the week they were imported. Production counts key off `dateIssued`, never `importedAt`.

## Persistency derivation rules (report month M)
1. Only policies where `isWritingAgent` is true. Orphans and inherited policies stay out of the denominator (matches the `orphanAdoptionEntersDenominator` default).
2. Window: issue month within the last 24 months, M included, so for 2026-09 that is Oct 2024 to Sep 2026. One constant. Kyron confirms with the CRO whether Sep 2024 is in.
3. Gross Settled (`businessPlaced`) = API of in-window policies that were placed: settled, lapsed, NTU-after-issue, and settled+terminal. Never-placed ntu (Withdrawn, Insufficient Premium), `replacedBy` docs and denied are out.
4. Not Takens = API of in-window `oipaSubStatus == 'Not Taken'`.
5. Lapses = API of in-window `status == 'lapsed'`, except a lapse drops out once totalPremiumPaid >= 2 x API (24 months of premium). If totalPremiumPaid is missing, the lapse stays in. A `terminalReason: 'deceased'` doc is never a lapse.
6. Annuity switch - per-agent setting `persistency.annuityLapseRule`, a toggle on the persistency tab and the Playground. Store the value used on each persistency doc it produces.
   - `legacy` (old system): annuities (`policyClass == 'annuity'`) count in Gross Settled, but a missed premium never makes them a lapse. Only status `lapsed` counts.
   - `tatil24` (new system): same, plus an annuity that is `settled` with paidToDate more than 60 days before the export date counts as a lapse. The 60 days is one constant.
   - Default `legacy` until the CRO confirms the new rule. The switch never touches non-annuity policies.
7. Decreases, Increases, Lumpsums, Reinstatements: not in the export. Default 0, shown as "not in export - enter manually" and editable. An existing manual entry still wins.
8. Output: the seven inputs plus the policy numbers behind each one, so the persistency tab can show which policies are counted. Feed the existing `deriveAll()`.
9. At-risk list: in-window annuities that `tatil24` would count as lapses, with API and "persistency if the switch were on tatil24". Also list the pending death claim so it is not forgotten.

## Slices (run in order; each stops with its paste-back and waits for Kyron)

P0 - Parser (pure, no Firestore). `src/lib/portfolioImport/parseOipaExport.js` + tests. Uses import rules 1-9. Paste-back: the counts for the 15 Sep file - rows 283, shadows 49, tests 5, docs 229; status settled 99, lapsed 87, ntu 22 (incl. the replaced one), settled+terminal 18 (incl. the FNE2500031 claim), denied 3; `planClassPending` 2 (PSU: C00156565, C00156609).

P1 - Ledger derivation (pure). `src/lib/persistency/deriveFromLedger.js` + tests. Paste-back: this table from the fixture, both switch positions. Not Takens is 0 in every row. The Dec rows use the same export with no new business.

| M | window starts | switch | Gross Settled | Lapses | Persistency | counted |
|---|---|---|---|---|---|---|
| 2026-09 | Oct 2024 | legacy | 210,975.24 | 28,196.88 | 86.6% | 31 |
| 2026-09 | Sep 2024 | legacy | 296,457.24 | 30,878.88 | 89.6% | 36 |
| 2026-12 | Jan 2025 | legacy | 188,595.72 | 27,014.52 | 85.7% | 28 |
| 2026-09 | Oct 2024 | tatil24 | 210,975.24 | 58,676.88 | 72.2% | 31 |
| 2026-12 | Jan 2025 | tatil24 | 188,595.72 | 55,094.52 | 70.8% | 28 |

If a number differs, stop and report the policy numbers behind the difference. Do not tune to match.

P2 - Importer write (admin script first, LIVE only with Kyron). `scripts/ops/import-oipa-portfolio.mjs --file <xlsx> --agent-email kyron.marchan@tatil.co.tt [--live]`. Dry run by default prints the create/update/skip plan. Batched writes, history doc per policy. Paste-back: the dry-run plan summary, then after `--live`: doc count in `tenants/tatillife_south/policies` for Kyron, and one full doc.

P3 - Persistency tab reads the ledger. When a ledger exists for the agent and month, prefill the seven inputs from P1 with a "from portfolio import, <exportDate>" tag, the annuity switch, and a counted-policies drawer. Manual save still works and wins. The Playground gets the at-risk list and the switch. Paste-back: the preview URL showing Kyron's Sep 2026 figure on both switch positions, and the drawer.

P4 - Upload screen (Sonnet 5 medium). Agent uploads the xlsx in the browser; P0 runs client-side; a callable Cloud Function does the P2 write as admin for that agent's own policies only. Shows the P0 report, the `planClassPending` list and the overrides before writing. Normal AgencyTrack Phases 0-5. Paste-back: preview URL and the smoke green.

## Smoke walk (LIVE, Kyron present, after P4)
1. Upload the 15 Sep file on the preview. The plan says 229 creates. Confirm.
2. Re-upload the same file. The plan says 0 creates, 229 unchanged.
3. Open Persistency, Sep 2026. It shows 86.6% on `legacy`, the drawer lists 31 policies, and FNE2500031 shows as a death claim. Flip the switch: 72.2%. Flip back.
4. Open a weekly production view for this week: the import added no production.
5. Paste back the screens from steps 1, 3 and 4.

## Post-merge fill
docs/CONTEXT.md (portfolio import, ledger-driven persistency, the status map, the config lists, the annuity switch); CLAUDE.md (the import script and its --live gate); Prospecting project doc `claude/agencytrack-oipa-match-15sep.md` gets the final live numbers. Open https://portal.agencytrack.app and paste the persistency header.

## Out of scope
Auto-download of the export from OIPA or INGENIUM, other agents' portfolios, commission, KQM Calls sync of the same data, the death-claim workflow itself.

## Open questions for Kyron (each blocks only the item named)
1. What is PSU? (P0; null until answered. Both PSU policies are old and out of the window, so persistency is not affected.)
2. Is Sep 2024 inside the Sep 2026 window? (P1 constant; CRO)
3. Does the new system count behind-on-premium annuities as lapses, and after how many days? (P1 switch default; CRO)
