# Persistency P5 — orphan adoption moves to the numerator, behind a Company Config setting

**Written 7 September 2026.** Follows P4 (PR #940) and P4b. Sequenced **after #940 merges** — do not branch off `persistency-p4-playground-24m-levers`.

**Model: Sonnet 5, medium effort.** Two expressions, one config entry, one docblock, and two tests — one of which currently pins the wrong rule.

**Target repo:** this one only. One branch, one PR.

---

## 1. The rule (from Kyron, 7 September 2026)

**The persistency denominator is built from the WRITING agent's business only.**

When an agent adopts an orphan whose policy is under 24 months, that policy does **not** enter her denominator — she did not write it. If she then gets it reinstated, the reinstatement lands in her **numerator** as in-force business. Net exceeds gross, and she is legitimately above 100%.

**Status of the rule: stated by the operator, not yet confirmed in writing by Tatil.** The memo of 29 Aug 2026 does not address orphan adoption. That is why this slice puts the behaviour behind a setting rather than hardcoding it — and it is also why the setting's **default encodes the rule above**, because a default is a claim and this is the claim we believe. Confirming it with Tatil (via Victoria Walcott, alongside the Slice P3 process-document ask) remains an open operator action.

---

## 2. What the code does today, and why it is wrong

`calculations.js` treats an adopted orphan exactly like new business the agent wrote:

| Line | What it says |
|---|---|
| `163-164` | docblock: "newBusinessPlanned and newOrphansAdopted both ADD to gross settled (they are mathematically identical for the persistency calculation)" |
| `190` | `projectedGross = … + num(newOrphansAdopted)` |
| `268` | `noNeeded: nbNeeded, // mathematically identical to NB` |

Adding the same amount to the top and bottom of a fraction pulls it **toward** 100%, never past it. So today the planner cannot show the orphan benefit at all — and for an agent already above 100%, adopting orphans drags the projection **down**.

### The cost of this, in the agent's own numbers

Baseline 100,000, lapses 15,000, no reinstatements, 90% target:

- `nbNeeded = (15,000 − 0) / (1 − 0.90) − 100,000 = 50,000`
- `nrNeeded = 100,000 × 0.90 − 100,000 + 15,000 − 0 = 5,000`

Because `noNeeded` is wired to `nbNeeded`, the planner tells the agent to adopt **50,000** of orphan API when the truthful figure is **5,000**. Ten times overstated. The tool presents working an orphan list as a slow route back to 90%, when it is the fastest one available.

---

## 3. The setting

### 3.1 Why a plain config value and NOT a feature flag

A feature flag would drag in the deliberate triple-copy — `configService.ALLOWED_FLAG_KEYS`, `firestore.rules` `ccfgFlagKeysAllowed()`, and `scripts/verification/vh/flag-toggle.cjs` — pinned by `flagAllowlist.cross-check.test.js`. That means a rules change, a human merge, and a manual `firebase deploy --only firestore:rules`.

None of that is needed. `firestore.rules` name-gates config keys **only when `docId == 'settings'`**:

```
allow create, update: if isSignedIn()
  && getRole() in ['platform_admin', 'tenant_admin']
  && (getRole() == 'platform_admin' || getTenantId() == tenantId)
  && (docId != 'settings' || ccfgFlagKeysAllowed());
```

A new config doc is already writable by `tenant_admin`. **So this slice touches no rules file and needs no deploy.** Do not add anything to `ALLOWED_FLAG_KEYS` or to `flagAllowlist.cross-check.test.js`.

This is also the right shape on the merits: persistency counting rules vary by carrier, so how an adopted orphan is counted is a genuine tenant setting — unlike the 12-vs-24-month model, which is fixed by date for everyone and was correctly refused a switch under P-D3.

### 3.2 The entry

Add to `companyConfigRegistry.js`, following the `mode: 'plain'` shape already used at line 69:

- **id:** `persistency.orphanAdoptionEntersDenominator`
- **type:** boolean
- **default:** `false` — an adopted orphan lifts the numerator only
- **storage:** `{ docId: 'persistencySettings', keyPath: 'orphanAdoptionEntersDenominator', mode: 'plain' }`
- **label:** "Adopted orphans count in the persistency denominator"
- **desc:** name both readings plainly — `false` means the denominator belongs to the writing agent and an adopted orphan lifts in-force business only, which is what allows persistency above 100%; `true` means an adopted orphan counts like business the agent wrote.
- **source:** cite the `calculations.js` lines the value drives. `companyConfigRegistry.parity.test.js` pins these citations, so get them right.

### 3.3 Keep `calculations.js` pure

Do **not** read config inside `calculations.js`. Pass the resolved value in as a parameter — `orphansEnterDenominator`, defaulting to `false` — so the pure layer stays pure and testable. The playground resolves the config value and passes it down. The playground is the only consumer of either function.

---

## 4. What to build

### 4.1 `projectPersistency`

```js
const orphansToGross = orphansEnterDenominator ? num(newOrphansAdopted) : 0;
const orphansToNet   = orphansEnterDenominator ? 0 : num(newOrphansAdopted);

const projectedGross = num(currentGrossSettled)
  + num(newBusinessPlanned)
  + orphansToGross
  - num(goodBusinessFallingOff)
  - num(decreasesAnticipated);

const projectedReinstatements = num(currentReinstatements)
  + num(newReinstatementsPlanned)
  + orphansToNet;
```

Keep `newOrphansAdopted` as its own named parameter. Do not fold it into `newReinstatementsPlanned` — the planner shows them as separate levers and the agent needs to see which one moved the number.

### 4.2 `calculateShortfall`

`noNeeded` follows whichever algebra the setting selects:

```js
noNeeded: orphansEnterDenominator ? nbNeeded : nrNeeded,
```

Delete the `// mathematically identical to NB` comment. Both sentinels stay: `baseline <= 0` returns zeros, `t >= 1` yields `Infinity` for `nbNeeded` only.

### 4.3 Docblocks

Rewrite `163-164` in the rule's own words: new business enters gross because the agent wrote it; an adopted orphan does not, because the denominator belongs to the writing agent. State that this is what allows a projection above 100%, that the behaviour is settable per tenant, and that the default is numerator-only. Name the config id so the next reader can find the switch.

### 4.4 The test that pins the wrong rule

`calculations.test.js:335-349` — *"orphans add to gross settled identically to new business"* — asserts `viaNB.projectedGrossSettled === viaNO.projectedGrossSettled`. That test encodes the defect. **Rewrite it as two tests**, do not delete it:

- **default (`false`):** orphans do not change `projectedGrossSettled`; orphans and reinstatements of equal value give the same `projectedPersistency`; new business and orphans of equal value now differ.
- **`true`:** the old assertions hold exactly as written today — that is what the setting preserves.

The neighbouring test at `:350` — *"reinstatements add to net only, not gross"* — is the shape to copy.

Add a shortfall test: with the §2 numbers, `noNeeded` is 5,000 on the default and 50,000 when the setting is `true`.

---

## 5. Out of scope

- `deriveAll`, `calculateGrossSettled`, `calculateNetSettled`, `calculatePersistency`. The stored, reported persistency already handles the orphan case correctly — `reinstatements` has always added to net only. Nothing an agent is paid on changes here, and the setting must not reach them.
- `PERS_GATE`, `PERS_FLOOR`, every `persistGate` — P-D7 stands.
- `firestore.rules`, `firestore.indexes.json`, `functions/`, `ALLOWED_FLAG_KEYS`, `flag-toggle.cjs`. Plain merge, no `firebase deploy`.
- The lever's label and sublabel. "New Orphans Adopted" still reads correctly.

---

## 6. Deliverables — paste in the PR body

1. **The rule proof, on the default:** projected gross and projected persistency for equal amounts entered as new business, as an orphan adoption, and as a reinstatement — orphans matching reinstatements, no longer matching new business.
2. **The setting proof:** the same three figures with the setting flipped to `true`, showing today's behaviour returns exactly.
3. **The above-100% proof:** the Candice case — 100,000 own business, no lapses, 10,000 adopted and reinstated — reading **110%** on the default and not clipped.
4. **The shortfall proof:** `noNeeded` at 5,000 on the default and 50,000 when `true`.
5. The rewritten tests at `calculations.test.js:335`, before and after.
6. One screenshot of the new Company Config row.

Post-merge fill on this brief and on `docs/CONTEXT.md` after Kyron merges.
