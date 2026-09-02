# Brief M — the September 2026 underwriting schedule, as data

**2 September 2026.** Follows `claude/tatil-medical-limits-september-2026.md` (the table, the diff, the memo) and the April build, AgencyTrack #933/#934 and Financial-Planning-App #2/#3.

**Model: Opus 5, medium effort.** Two repos, one table each, a small derivation change. The shape already exists; this is the second table the April design was built to receive.

**Target repos:** Slice M1 is `C:\Projects\AgencyTrack` (this brief lands and dispatches there). Slice M2 is `C:\Projects\Financial-Planning-App` and is run separately, after M1 merges, by pointing a Claude Code session in that repo at this file. Each slice merges on its own. Run M1 first — it settles the token names M2 copies.

## Decisions locked on 2 September — do not re-litigate

1. **A new file per effective date.** `2026-09.js` beside `2026-04.js`. April is never edited.
2. **The default table is September.** `CURRENT_MEDICAL_LIMITS` points at it; stored cases pass `limitsInForceOn(submittedOn)`.
3. **Aggregation is one optional input**, `otherCoverLast12Months`, default 0, with `assessedAmount` and `assumesNoOtherCover` echoed on every result. No `termRiderAmount`.
4. **Blood panels are data on the table**, keyed by the page's own names. Tier tokens name the panel; they do not spell it out.
5. **The effective-date test is the submission date** — the memo's word.
6. **The planning app's `medical_limits` stays the current table**; April moves verbatim to `medical_limits_superseded`.

Source documents, both in `C:\Users\noryk\Downloads`:
- `Underwriting Requirements Schedule Eff September 2026.pdf` — the table
- `Memo - Change In Underwriting Requirements Schedule.pdf` — J. Robinson, Executive, Insurance Operations, 27 August 2026

Read the schedule off the **rendered page**. The text layer emits the five age headings after their five requirement blocks, same as April; the age-to-block pairing in the project doc was read from the rendered table on 2 September and is the mapping to encode.

---

## What changed, in the words the code needs

| | April (`2026-04.js`) | September |
|---|---|---|
| Non-Medical ceiling, 16–40 and 41–50 | 500,000 | **1,500,000** |
| Paramedical tier, 16–50 | 500,001–1,000,000 | **gone** — no tier uses `Paramedical` between 16 and 60 any more |
| 41–50 top tier | + Chest X-ray | **no Chest X-ray** — 41–50 is now identical to 16–40 |
| 51–60 first tier | Paramedical + bloods to 500,000 | **Non-Medical** to 500,000 |
| 0–15 | HIV from 500,001; Paramedical to 1,000,000; ECG at top | **HIV only from 1,500,001; Paramedical to 1,500,000; no ECG** |
| Financial Statement | from 1,500,000 | **from 3,000,000**, named "Confidential Financial Statement / Proof of Income for Self Employed" |
| Inspection report | from 1,500,000 | **from 3,000,000** |
| Urine screen | ages 16–60 | **ages 16+** (`maxAge: null`) |
| Lipid panel | Chol, Trigs, HDL, LDL, VLDL (+ FBS separate) | Chol, Trigs, HDL, LDL, FBS — **no VLDL** |
| Over 60 | — | unchanged |
| DIR rule, 5,000,000 ceiling | — | unchanged |
| Effective-date wording | "received and submitted" | **"submitted"** |
| Aggregation | not stated | **stated**: the assessed amount is the new cover **plus** all Life/CI issued or reinstated on the life in the trailing 12 months, plus term riders on a whole-life base |

---

# Slice M1 — AgencyTrack

Repo `C:\Projects\AgencyTrack`, `main` at `b0b2a57a` (post-merge fill for #935). Branch from there.

## 1. The new table

Add `src/config/medicalLimits/2026-09.js`. **Do not edit `2026-04.js`** — the file header says why, and a case submitted 31 August still reads it.

```js
export const MEDICAL_LIMITS_2026_09 = Object.freeze({
  effective: '2026-09-01',
  retrieved: '2026-09-01',
  transcribed: '2026-09-02',
  status: 'VERIFIED_SINGLE_SOURCE',
  bandMappingConfirmed: '2026-09-02',   // read from the rendered page, not the text layer
  bandMappingNote: '...',               // say that, in one sentence
  ageBasis: 'age next birthday (attained age + 1)',
  ageBasisConfirmed: '2026-08-30',      // unchanged; carried forward
  appliesTo: ['life', 'criticalIllness'],
  effectiveOn: 'submitted',             // the memo's word. April said "received and submitted".
  supersedes: '2026-04-01',
  source: 'TATIL LIFE UNDERWRITING REQUIREMENTS SCHEDULE (Effective September 1st, 2026); memo '
    + '"Change in Underwriting Requirements Schedule", J. Robinson (Executive, Insurance Operations), 27-AUG-2026',
  bloodPanels: { ... },                 // see §2
  aggregation: { ... },                 // see §3
  bands: [ ... ],                       // the five bands from the project doc, verbatim
  universal: [
    { from: 3000000, minAge: 16, maxAge: null, requirement: 'Urine screen for marijuana and cocaine' },
    { from: 3000000, minAge: 0,  maxAge: null, requirement: 'Confidential Financial Statement / Proof of Income for Self Employed' },
    { from: 3000000, minAge: 0,  maxAge: null, requirement: 'Inspection report' },
  ],
  determinedAtUnderwritingFrom: 5000000,
  disabilityIncomeRiderRequiresMedical: true,
});
```

`EXAM_LEVELS` and `EXAM_LEVEL_LABELS` stay where they are in `2026-04.js` and are re-exported, not duplicated — the "Non-Medical form (life application part 2)" label is a fact about the form, not about a schedule. `Paramedical` stays in `EXAM_LEVELS` because 0–15 still uses it.

Band-by-band, the tiers to encode:

- **0–15:** 500,000 Non-Medical · 750,000 Non-Medical + APS · 1,500,000 Paramedical + APS · open Medical, HIV, APS
- **16–40:** 1,500,000 Non-Medical · 2,000,000 Medical, Micro, Nicotine, HIV, Lipid Blood Profile (Fasting) · open Medical, ECG, Micro, Nicotine, HIV, Complete Blood Profile (Fasting)
- **41–50:** identical to 16–40. Write it out; do not alias one band to the other — a future revision may split them again and an alias hides that they are two rows on the page.
- **51–60:** 500,000 Non-Medical · 750,000 Medical, ECG, Micro, Nicotine, HIV, Lipid Blood Profile (Fasting), PSA (males only) · 2,000,000 same with Complete Blood Profile (Fasting) · open + Chest X-ray
- **Over 60 (61+):** 500,000 Medical, Micro, Lipid Blood Profile (Fasting) · 1,500,000 Medical, ECG, Micro, Nicotine, HIV, Complete Blood Profile (Fasting), PSA (males only) · open + Chest X-ray

## 2. The blood panels are named now

The schedule defines the two panels in footnotes. Carry them as data on the table:

```js
bloodPanels: Object.freeze({
  'Lipid Blood Profile (Fasting)':    ['Cholesterol', 'Trigs', 'HDL', 'LDL', 'Fasting Blood Sugar'],
  'Complete Blood Profile (Fasting)': ['Cholesterol', 'Trigs', 'HDL', 'LDL', 'VLDL', 'Alkaline Phosphatase', 'SGOT', 'SGPT', 'GGTP', 'Creatinine', 'Fasting Blood Sugar'],
}),
```

Tier `requirements` use the panel **name** as the token, exactly as the page does. A display layer that wants the composition looks it up. Do not flatten the panel into the tier list the way April did — April had no footnote to point at; September does, and the lipid panel's contents changed between the two, so the composition belongs beside the date it was true.

## 3. The aggregation rule — a new input, not a new guess

The schedule says the tier is picked on the **total risk amount**: the new application plus everything Tatil issued or reinstated on the same life in the trailing 12 months, plus any term rider on a whole-life base.

`requirementsFor()` and `headroomFor()` currently take one number. Add one optional input to both:

```
otherCoverLast12Months  number, default 0
```

The tier and the universal rules are picked on `sumAssured + otherCoverLast12Months` (for headroom: `issuedCoverage + otherCoverLast12Months`). The result echoes:

```
assessedAmount        the number the table was actually read at
assumesNoOtherCover   true when otherCoverLast12Months was omitted
```

`assumesNoOtherCover` is the honest flag. AgencyTrack does not today know a client's other Tatil policies, so nearly every call will set it, and the UI must be able to say "assuming no other Tatil cover in the last 12 months" next to the answer. Record on the table, under `aggregation`, the sentence from the schedule and the fact that term riders are the caller's job to fold into `sumAssured`.

Headroom is `ceiling - assessedAmount`, never `ceiling - issuedCoverage`. A client with 1,000,000 issued in March and 700,000 in hand is at 1,700,000, in the Medical tier, with no free headroom at all.

Do **not** add a `termRiderAmount` input. One number in, one assessed number out. The rider rule is a note on how to build `sumAssured`, and a second field is how two callers fold it in twice.

## 4. Which table is the default

Today every function defaults `table = MEDICAL_LIMITS_2026_04` and `TABLES` has one entry.

1. `TABLES = [MEDICAL_LIMITS_2026_04, MEDICAL_LIMITS_2026_09]`.
2. Export `CURRENT_MEDICAL_LIMITS = MEDICAL_LIMITS_2026_09` and make it the default everywhere `2026_04` is the default now — `bandFor`, `requirementsFor`, `headroomFor`.
3. `limitsInForceOn('2026-08-31')` → April; `('2026-09-01')` → September; `('2026-03-31')` → null, as before.

Nothing in `src/` outside the module and its test imports these yet (checked 2 September: `grep -rl medicalRequirements src` returns only the module, the config and the test). So the default flip breaks no caller. Say so in the PR body anyway.

## 5. The comments that are now false

`medicalRequirements.js` states April figures as facts in its header — "crossing 1,500,000 pulls in a financial statement", "at 51 there is no non-medical band at all", the 55-year-old worked example. `2026-04.js` says the same in its `universal` comment. The April file's comments stay (they are true of April). The **module header** is rewritten so every figure it quotes is either tagged with its effective date or replaced with the table-relative statement. The 50/51 paragraph becomes:

> Attained 49 is underwritten at 50 (non-medical to 1,500,000 from September 2026); attained 50 is underwritten at 51 (non-medical to 500,000). One birthday moves the non-medical ceiling by a million dollars.

## 6. Tests

`src/utils/__tests__/medicalRequirements.test.js` today reads the April table through the defaults. Split it:

- **April blocks keep passing, against April explicitly.** Every existing `requirementsFor` / `headroomFor` / `bandFor` call in the file passes `table: MEDICAL_LIMITS_2026_04`. Not one April assertion changes value. That is the proof that the new file did not touch the old one.
- **A September block** mirrors the same shape with the new figures. The `KEY_FIGURES` handshake for September:

```js
const KEY_FIGURES_2026_09 = {
  nonMedicalLimit16to50: 1500000,
  nonMedicalLimit51to60: 500000,
  nonMedicalLimitChildWithAps: 750000,
  firstAgeWithNoNonMedicalBand: 61,
  firstAgeRequiringMedicalFromFirstDollar: 61,
  paramedicalUsedOnlyByBand: 0,          // minAge of the only band with a Paramedical tier
  financialStatementAndInspectionFrom: 3000000,
  urineScreenFromAges16Plus: 3000000,
  determinedAtUnderwritingFrom: 5000000,
  disabilityIncomeRiderRequiresMedical: true,
  lipidPanelExcludesVldl: true,
};
```

- **The three assertions that carry over from April, re-pointed:** the 16–40 / 41–50 pair (now *identical*, assert deep equality of the two `tiers` arrays); the 750,000 breakpoint (still only 0–15 and 51–60); the urine screen age range (now `minAge 16, maxAge null` — assert it is **not** bounded at 60 any more).
- **Effective dating:** the three `limitsInForceOn` cases in §4.
- **The 50/51 boundary, September numbers:** same client, same 1,000,000, born 1976-09-03, `asOf` 2026-09-02 → ANB 50 → Non-Medical; `asOf` 2026-09-03 → ANB 51 → Medical with bloods and PSA. And attained-age would have said Non-Medical on both days.
- **Aggregation:** age 35, `issuedCoverage 700000, otherCoverLast12Months 1000000` → `assessedAmount 1700000`, exam Medical, `headroom 300000` (to the 2,000,000 tier ceiling — the universal clamp at 3,000,000 no longer bites first), `assumesNoOtherCover false`. Same call without the second input → Non-Medical, `headroom 800000`, `assumesNoOtherCover true`.
- **Headroom, September:** age 35 issued 600,000 → ceiling 1,500,000, headroom 900,000, `clampedBy 'tier'`, `nextStep.adds` includes Medical and the lipid panel. Age 30 issued exactly 1,500,000 → headroom 0. Age 55 issued 300,000 → ceiling 500,000, headroom 200,000, free. Age 35 issued 2,500,000 → ceiling 2,999,999, `clampedBy 'universal'`, `nextStep.adds` lists the urine screen, the financial statement and the inspection report.
- **Panels:** every tier token that names a panel resolves in `bloodPanels`; the lipid panel has no VLDL; the complete panel has it.

## 7. Deliverables

- The PR, one squash, `src/` only — no deploy-gated surface, ships with the Vercel rebuild.
- **`npx vitest run src/utils/__tests__/medicalRequirements.test.js` paste-back**, whole output, with the April block count and the September block count both visible.
- **A worked-example paste-back**: a 10-line node script calling `requirementsFor` and `headroomFor` for the eight cases in §6 against both tables, output pasted verbatim. This is what the operator reads; the suite is what the machine reads.
- **The known-gap statement** (CLAUDE.md, the ≥1-gap rule). The one this brief already knows: the September mapping was read from the rendered page by the person writing this brief, not confirmed against a printed copy by the operator the way April's was. `bandMappingConfirmed` carries the date; the note must say who and how.
- **Post-merge fill** under Rule 16(c), real squash SHA.
- The Rule 21 second-reviewer slot is still empty. Note it; do not wait on it.

---

# Slice M2 — Financial-Planning-App

Repo `C:\Projects\Financial-Planning-App`, `main` at `7949d9d` (#3). Branch from there. Run after M1 merges so the token strings are copied from the merged file, not from this brief.

## 1. The JSON shape has to grow a second table

`parameters/tt-parameters.json` → `life_underwriting.medical_limits` is one object with `effective: "2026-04-01"`, and `key_figures` beside it. It has no room for two dates.

Restructure to:

```
life_underwriting
  _note, _twin                     (update _twin to name BOTH AgencyTrack files)
  medical_limits                   ← the CURRENT table (September), same field names as today
  medical_limits_superseded        ← array; April moved here VERBATIM, untouched
  key_figures                      ← September figures, snake_case twins of KEY_FIGURES_2026_09
  key_figures_superseded           ← array; the April key_figures object moved here verbatim
```

`medical_limits` keeps its name and its field names so any consumer that reads `P.life_underwriting.medical_limits` reads the current table without change. (There are none today outside `verify.mjs` — checked 2 September — but the name is the contract.)

The September object mirrors M1's fields in snake_case: `blood_panels`, `aggregation`, `effective_on: "submitted"`, `supersedes: "2026-04-01"`, `band_mapping_confirmed: "2026-09-02"`, `transcribed`.

## 2. `parameters/verify.mjs`

The "Tatil life underwriting" block currently asserts `ml.effective === "2026-04-01"` and April's figures. Change it to:

- `medical_limits.effective === "2026-09-01"`, `supersedes === "2026-04-01"`.
- Every structural check (bands tile the age line, tiers ascend, open-ended last tier, exam levels explained, Non-Medical documented as a form) runs over **both** the current table and every entry in `medical_limits_superseded`. Loop; do not copy the block.
- The `key_figures` checks run current-against-current and, in the same loop, each superseded table against its own superseded key figures by `effective`.
- Re-point the three carried-over assertions as in M1 §6: 16–40 and 41–50 tiers deep-equal; 750,000 only in bands 0 and 51; urine screen `max_age === null`.
- Add: every panel token used in a tier exists in `blood_panels`; the lipid panel has no `"VLDL"`.
- Add: `medical_limits_superseded[0]` still says `effective "2026-04-01"` and `non_medical_limit_16_to_50 === 500000` in its key figures — the proof April moved rather than changed.

`ageNextBirthday` in `tt-parameters.js` is unchanged.

## 3. Deliverables

- The PR, one squash.
- **`node parameters/verify.mjs` paste-back**, whole output, both tables' lines visible.
- **A diff paste-back proving April moved verbatim:** `git show main:parameters/tt-parameters.json | jq .life_underwriting.medical_limits` against `jq '.life_underwriting.medical_limits_superseded[0]'` on the branch, one `diff`, empty output.
- Post-merge fill.

---

## Standing constraints, both slices

- **Never edit the April data.** The design is one file per effective date. A case submitted before 1 September is read against April, and April must still say what it said on 30 August.
- **`ok: false` beats a guess.** The derivation refuses rather than extrapolates; keep that. An `age` with no band, a sum with no tier, a date before the first table — all refusals, unchanged.
- **The cross-repo contract is a handshake.** No test in one repo reads the other. Both suites assert the same September figures so an edit on either side fails there and names the number. Keep the wording of that comment honest; do not claim automatic enforcement.
- **"Non-Medical" is a form.** The label test that forbids the bare token in display strings stays and passes.
- **The memo's summary table lists three changes; the schedule has nine.** Encode the schedule. If the two disagree anywhere, the schedule wins and the disagreement goes in the PR body.

---

## Stop conditions

**STOP and wait for dispatcher** if:

- Any file in `src/` outside the module, its config and its test turns out to import `requirementsFor`, `headroomFor` or `bandFor` — the default-table flip then has a caller, and the brief's premise in M1 §4 has shifted (Rule 17).
- An April assertion changes value once `table: MEDICAL_LIMITS_2026_04` is passed explicitly. That means the new file touched the old one, or the derivation changed behaviour for the old table.
- The rendered schedule and the tiers listed in this brief disagree anywhere. Do not pick one; surface the row.
- `2026-04.js` has been modified on `main` since `7d3913e3` (#933) / `c18c787f` (#934). `git log --oneline -- src/config/medicalLimits/2026-04.js` should show only those.

## Out of scope — named so it is not drifted into

- **Any UI.** Nothing renders these functions yet. The headroom offer (life-pipeline Phase 5) is the consumer and gets its own brief.
- **Knowing a client's other Tatil policies.** `otherCoverLast12Months` is an input; where it comes from is a data question for the policy record, not this slice.
- **Retiring `Paramedical`.** 0–15 still uses it. It stays in `EXAM_LEVELS`.
- **Critical Illness as a separate table.** The memo says the schedule applies to Life and CI alike; `appliesTo` carries both, as April did.
