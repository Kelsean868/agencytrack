# Persistency — the 24-Month Model (Tatil memo of 29 Aug 2026): build brief

**Written 3 September 2026.** Source of truth: Tatil Life inter-departmental memo *"Introduction of the Updated 24-Month Persistency Model"*, signed by Amery Rauseo (Executive, Business Development), dated 29 Aug 2026, effective **from September 2026 persistency onwards**. The operator holds the signed PDF (`Memo - Persistency 29 Aug 2026 draft 2.0 - Signed.pdf`).

**Target repo:** this one only.

---

## 1. What the memo changes, in the memo's own words

| Memo term | Rule |
|---|---|
| Scope | Only policies **within 24 months of their Issue Date** are included. |
| **Net Gross Settled** | `Gross Settled − Not Takens − Decreases + Increases + 10% Lumpsums` |
| **Net Settled** | `Net Gross Settled − Lapses + Reinstatements` |
| **Persistency** | `Net Settled ÷ Net Gross Settled` |
| Agent reporting | **12-Month Persistency is retired for agent reporting.** The 24-Month model replaces it. |
| Company reporting | 24-Month continues, modified to the new model. |
| Uses | Persistency reporting, bonuses, incentive administration — sales competitions, campaigns, monthly/quarterly/annual incentives. |
| Lapse rule | A policy that lapses before 24 months hurts persistency. **How long** it hurts depends on the number of premiums paid before lapse; it stops affecting persistency once it reaches the equivalent of 24 months of premiums paid **or** exceeds 24 months from the month of its Issue Date, whichever comes first. The 24-month check is reckoned from the month of the **Paid-To-Date**, not the Lapse Date. |
| Still to come | "A detailed process document will be provided" to guide I.T. requirements gathering. |

Two things follow from that table and they shape the whole brief:

1. **The formula is ratified. Build it.** The FOLLOW_UPS entry *"Persistency v2 (NEW calc methodology, R-07) — Tatil-gated PROPOSAL"* said the first deliverable had to be "a locked formula spec from Tatil actuarial, not code". This memo is that spec for the **aggregate formula**. The gate on that part is lifted.
2. **The per-policy lapse engine is NOT ratified in enough detail to build.** The lapse rule above is one paragraph, is internally ambiguous ("24 months from Issue Date … calculated from the Paid-To-Date"), and the memo itself defers the mechanics to a process document that does not exist yet. That part stays gated. Slice P3 below is a design placeholder, not a build.

---

## 2. What exists today (verified in source, 3 Sept 2026, `main` at `5cb6b5f3`)

- `src/lib/persistency/calculations.js` — the E3 formula. **It is the memo's formula minus one term.** `calculateGrossSettled = (businessPlaced − notTakens) + incPPPs + lumpsums100 × 0.10`; `calculateNetSettled = gross − lapses + reinstatements`; `calculatePersistency = net ÷ gross`. There is no `decreases` input. The docblock calls the derived number "Gross Settled"; the memo calls the same number **"Net Gross Settled"** and uses "Gross Settled" for what the app calls `businessPlaced`. Also: `PERS_FLOOR = 0.80`, `PERS_GATE = 0.90` (decimal canonical), `projectPersistency` and `calculateShortfall` with a `goodBusinessFallingOff` lever documented as a "rolling 12-month window".
- `src/services/persistencyService.js` — monthly per-agent docs at `tenants/{tenantId}/persistency/{agentUid}_{YYYY_MM}`. `E3_FIELDS` = the six inputs (`businessPlaced, notTakens, incPPPs, lumpsums100, lapses, reinstatements`); `isE3Doc()` hides any doc missing one of them. `reportPeriodFromMonthKey()` returns a **12-month** rolling period ending in the month. `savePersistency` writes the six inputs plus the derived `grossSettled / netSettled / persistency`.
- `src/components/manager/PersistencyEntryForm.jsx` — the manager entry form; `FIELDS` carries the six inputs with labels *"Business Placed"*, *"12-Month Inc PPPs"* and help copy that says "12-month period". Agent self-entry lives in `src/components/agent/PersistencyTab.jsx` (which also has a "12-month trend" header and mounts the flag-gated v2 shell).
- `src/lib/persistency/rollingModelV2.js` + `src/components/persistency/PersistencyV2Shell.jsx` (flag `persistencyV2`, OFF) — a **time-weighted debit** model (`debit = API × (24 − lapseMonth) ÷ 24`) over a `PREVIEW_BOOK` fixture. That model was the pre-ratification proposal. **The memo did not adopt it** — the memo's model is the aggregate formula plus a per-policy 24-month *inclusion window*, not a time-weighted debit. The shell now shows arithmetic Tatil rejected.
- `firestore.rules` `match /persistency/{docId}` — `validE3InputsNonNegative()` checks the six inputs `>= 0`. It does not use `hasOnly`, so an extra field is accepted, but a new money input with no `>= 0` guard would be the only unguarded one. Emulator suite: `tests/rules/persistency.rules.test.mjs`.
- Readers of the derived numbers (labels and CSV headers to sweep): `src/components/manager/PersistencyTab.jsx` (CSV header `'Gross Settled (TTD)'`), `PersRoster.jsx`, `PersAtRiskBook.jsx`, `PersRealityBar.jsx`, `src/components/persistency/PersistencyPlayground.jsx`, `src/components/profile/agentReportModel.js` / `agentReportPdfModel.js` / `AgentReportDocument.jsx`, `src/components/productionReport/*`, `src/services/exportService.js`, `src/components/manager/MasterSheet.jsx`, `MeetingMode.jsx`.
- `src/config/companyConfigRegistry.js` cites `calculations.js` **by line number** and `src/config/__tests__/companyConfigRegistry.parity.test.js` pins those citations. Any edit that moves lines in `calculations.js` or `campaignEngine.js` must update the registry `source:` strings.
- `src/config/awardsRuleset/2026.js` — every `persistGate` (90 / 92 / 95) is a number the memo does not change. The memo changes what the number is **measured on** (24-month model), not the thresholds.
- Precedent for effective-dated business rules: `src/config/medicalLimits/2026-04.js` and `2026-09.js` — a new dated file beside the old one, never an edit to it.

---

## 3. Decisions locked — do not re-litigate

| # | Decision | Rationale |
|---|---|---|
| P-D1 | **Stored field ids do not change.** `businessPlaced`, `notTakens`, `incPPPs`, `lumpsums100`, `lapses`, `reinstatements`, `grossSettled`, `netSettled`, `persistency` stay as they are. Only **labels** adopt the memo's vocabulary. | Renaming fields on money docs is a migration for a cosmetic gain. The label layer is where the memo's words belong. |
| P-D2 | **`decreases` is a seventh input, effective-dated.** Required on docs with `monthKey >= '2026-09'`; treated as `0` on older docs; never back-filled. | The memo adds exactly one term. August 2026 and earlier were reported on the old model and must keep deriving the same number they always did. |
| P-D3 | **The model is chosen by month, not by a tenant switch.** `persistencyModelFor(monthKey)` returns the legacy 12-month model for `< '2026-09'` and the 24-month model from `'2026-09'` on. There is **no** `persistency.calcModel: current|v2` Company Config switch. | FOLLOW_UPS proposed a switch when the model was optional. It is not optional: Tatil has dated it. A switch would let a tenant admin report August on the new model or October on the old one, and both are wrong. |
| P-D4 | **The window becomes 24 months.** `reportPeriodFromMonthKey` returns a 24-month period for 24-month-model months; every "12-month" label in persistency copy becomes "24-month" for those months. | Memo scope line. |
| P-D5 | **The per-policy lapse-window engine is NOT built in this brief.** Slice P3 is a design note only, gated on Tatil's process document. | Memo §"Lapse" is one ambiguous paragraph and the memo itself promises a process document. Building money-affecting arithmetic from an ambiguous paragraph is the exact mistake the R-07 FOLLOW_UP forbade. |
| P-D6 | **The `persistencyV2` preview shell is retired.** Its arithmetic is the rejected proposal. | A flag-gated surface showing a formula Tatil did not adopt is a false fact waiting for someone to turn the flag on. |
| P-D7 | Thresholds do not move. `PERS_GATE = 0.90`, `PERS_FLOOR = 0.80`, every `persistGate` in the awards ruleset, the financing ruleset gates, `companyMinimums.persistency`. | The memo changes the measurement basis, not the bars. Note in the docblock that from Sept 2026 these gates read the 24-month figure. |

Plus everything in `docs/CONTEXT.md` § Locked decisions.

---

## 4. Slices

Build in this order. Each slice is one branch, one PR.

### Slice P1 — the formula, the seventh input, and the month-dated model

**Model: Opus 5, high effort.** Money-correctness-critical: this changes the number every award gate reads.

1. **New module `src/config/persistencyModel/index.js`** (or `src/lib/persistency/model.js` — pick one, state it in the PR) exporting:
   - `PERSISTENCY_MODEL_24M_EFFECTIVE_FROM = '2026-09'` (a `YYYY-MM` monthKey).
   - `persistencyModelFor(monthKey)` → `{ id: 'legacy12' | 'tatil24', windowMonths: 12 | 24, inputs: [...], effectiveFrom, source }`. `tatil24.source` names the memo and its date. Pure; no clock.
   - `isTwentyFourMonthModel(monthKey)` convenience.
2. **`calculations.js`:**
   - `calculateGrossSettled` gains `decreases`: `(businessPlaced − notTakens − decreases) + incPPPs + lumpsums100 × 0.10`. `decreases` defaults to `0` through the existing `num()` so every legacy call site and every legacy doc derives exactly what it did before. **Add a test that pins this:** the six-input fixture from the Feb 2026 validation (Ricardo Duke row) must still produce the same `grossSettled / netSettled / persistency` with `decreases` absent.
   - Docblock rewritten in the memo's vocabulary: the derived `grossSettled` **is the memo's "Net Gross Settled"**; the input `businessPlaced` is the memo's "Gross Settled"; `incPPPs` is the memo's "Increases". Say plainly that the stored ids are legacy names kept under P-D1.
   - `projectPersistency` / `calculateShortfall`: the `goodBusinessFallingOff` comment changes from "rolling 12-month window" to "rolling window (24 months from Sept 2026, 12 before)". Arithmetic unchanged.
   - Export a `LABELS` map (or put it in the model module) so every surface renders the same words: `businessPlaced → 'Gross Settled'`, `notTakens → 'Not Takens'`, `decreases → 'Decreases'`, `incPPPs → 'Increases'`, `lumpsums100 → 'Lumpsums (100%)'`, `lapses → 'Lapses'`, `reinstatements → 'Reinstatements'`, `grossSettled → 'Net Gross Settled'`, `netSettled → 'Net Settled'`. Legacy-model months may keep `'Business Placed'` / `'Inc PPPs'` if the surface is month-aware; if a surface is not month-aware, use the memo's words.
3. **`persistencyService.js`:**
   - `isE3Doc()` stays the legacy gate (six fields). Add `isModelCompleteDoc(doc)`: for `monthKey >= '2026-09'` the doc must also carry `decreases` (a number `>= 0`); for earlier months the six fields suffice. Readers use the new predicate; `isE3Doc` stays exported for the existing tests and for `SCOPE-2`.
   - `savePersistency` writes `decreases` (parseFloat-coerced) for 24-month-model months and refuses a save for those months when it is missing (surface a validation error, do not silently write `0`). For legacy months it writes no `decreases` key.
   - `reportPeriodFromMonthKey(monthKey)` returns the period for `persistencyModelFor(monthKey).windowMonths`. Tests: `'2026-08'` → 12-month period `2025-09-01 … 2026-08-31`; `'2026-09'` → 24-month period `2024-10-01 … 2026-09-30`; `'2026-12'` → `2025-01-01 … 2026-12-31`.
   - Docs carry `modelId: 'tatil24'` on 24-month-model writes (additive; absent on legacy docs). Display-only provenance; nothing branches on it — `persistencyModelFor(monthKey)` is the authority.
4. **`PersistencyEntryForm.jsx` and the agent self-entry form in `agent/PersistencyTab.jsx`:** the `FIELDS` list becomes month-aware — seven inputs with the memo's labels for 24-month-model months, the existing six for earlier months. Help copy: `decreases` → "Premium decreases on policies within the 24-month window." Replace every "12-month" in help copy with the model's `windowMonths`.
5. **`firestore.rules`** — additive, guarded: inside `validE3InputsNonNegative()` add `&& (!('decreases' in request.resource.data) || request.resource.data.decreases >= 0)`. Emulator case in `tests/rules/persistency.rules.test.mjs`: `decreases: -1` refused; `decreases: 0` allowed; doc with no `decreases` still allowed (legacy month). **Rules change ⇒ human merge + operator `firebase deploy --only firestore:rules`, staging first, released ruleset read back and compared byte-for-byte (the #935 ritual).** State in the PR body whether this qualifies as the additive carve-out (it does: the new clause only fails on a negative value of a field that did not exist).

**Deliverable — evidence paste-back in the PR body:** the six-input regression fixture output before and after (identical); `reportPeriodFromMonthKey` for `2026-08`, `2026-09`, `2026-12`; the emulator suite count before and after; and one screenshot of the entry form for **August 2026** (six fields) beside **September 2026** (seven fields).

### Slice P2 — the vocabulary sweep and the retired preview shell

**Model: Sonnet 5, medium effort.** Copy, headers, docblocks, one deletion.

1. Every rendered "Gross Settled" that means the derived number becomes **"Net Gross Settled"** (CSV header in `manager/PersistencyTab.jsx`, roster columns, playground cards, agent report + PDF model, production report, `exportService.js`). Grep for the LITERAL strings `Gross Settled`, `Inc PPP`, `Business Placed`, `12-month`, `12-Month`, `twelve` under `src/` — and for `12` next to `persist` — not only for symbol names (the 1A lesson).
2. "12-month trend" in `agent/PersistencyTab.jsx` becomes "Monthly trend" (it is a series of monthly figures, not the model window — do not relabel it "24-month trend", which would claim the chart shows two years).
3. **Retire the preview shell (P-D6):** delete `src/lib/persistency/rollingModelV2.js`, `src/components/persistency/PersistencyV2Shell.jsx`, their tests, and the mount in `agent/PersistencyTab.jsx`. Remove `persistencyV2` from `featureFlagsService.js` and its entry from `companyConfigRegistry.js` (`flag.persistencyV2`) — `flagAllowlist.cross-check.test.js` and `companyConfigRegistry.parity.test.js` will tell you every place it is pinned. If a live tenant `settings` doc carries `featureFlags.persistencyV2`, the stale key is harmless (reader gone); say so in the PR, do not write a cleanup script.
4. `companyConfigRegistry.js` `source:` line citations for `calculations.js` re-pointed after P1 moved lines; parity test green.
5. `CLAUDE.md` § domain rules: "12-Month Persistency" → the 24-month model with the effective month; the stale `0-100` annotation FOLLOW_UP (LOW, K4) can be closed in the same edit.
6. `docs/FOLLOW_UPS.md`: rewrite the R-07 entry — phase 1 (aggregate formula) **DONE by P1**; phase 2 (manager surface) **superseded** — the four `persistency-v2-*.jsx` mockups were drawn for the rejected debit model and are not to be ported; phase 3 (calc-model switch) **closed, will not build (P-D3)**; add the new gated item from slice P3.

**Deliverable:** the grep output for the literal strings, after the sweep, pasted in the PR body (expected: hits only in `docs/`, `CONTEXT-history`, and the awards/financing ruleset comments that describe historical thresholds).

### Slice P3 — the per-policy 24-month inclusion window (DESIGN ONLY — not built)

**No model. No branch. This slice is a FOLLOW_UPS entry written by P2.**

What the memo says the engine will need, recorded so requirements gathering starts from the app's actual data:

- The policy ledger already carries `dateIssued` (stamped at settlement), `status: lapsed`, and `lapsePolicy`. It does **not** carry `paidToDate` or a premium count. Both are needed for the memo's lapse rule and neither is entered anywhere today.
- The rule to encode, once the process document arrives: a lapsed policy stays in the Lapses term until `min(month it would have reached 24 premiums paid, issueMonth + 24)`, with the 24-month check reckoned from the Paid-To-Date month. **Open question for Tatil, to be asked verbatim:** *"Is the 24-month cut-off `paidToDateMonth − issueMonth >= 24`, or `paidToDateMonth + (24 − premiumsPaid)`?"* — the two readings of the memo's last sentence give different answers for the same policy.
- Until then, the app's persistency numbers are what managers and agents transcribe from Tatil's monthly report, exactly as today. The app does not compute persistency from the ledger and this brief does not change that.

---

## 5. Operator actions after merge (not Claude Code)

1. Deploy rules after P1 (staging first). Read back and compare.
2. September 2026 persistency, when Tatil's report arrives: enter the seven figures. The form will refuse a September save without `decreases`.
3. Tell managers the labels changed and why: the app now uses the memo's words, "Net Gross Settled" is the denominator.

---

## 6. Out of scope

- Any Cloud Function. Persistency stays client-computed from transcribed inputs.
- Backfilling `decreases` on pre-September docs (P-D2).
- The Company Config calc-model switch (P-D3).
- The Christmas Campaign gate — that is the companion brief `christmas-campaign-2026-brief.md`, which consumes P1's output (the December 2026 24-month figure) and is sequenced after P1.

---

## 7. Stop conditions

- If `firestore.rules` for `/persistency` turns out to use `hasOnly` anywhere the audit missed → surprise-stop; the additive-carve-out claim is void.
- If any consumer is found computing persistency from the policy ledger rather than from the monthly docs → surprise-stop; P-D5 assumed none exists.
- If a test fixture asserts `grossSettled` by literal value on a seven-input doc and disagrees with the memo's formula by exactly the `decreases` term → that is the sweep working, not a defect; fix the fixture and say so.
