# E1 Slice 2A — Discovery Notes

> Discovery run: 2026-05-09. Worktree: feat/e1-slice-2a-wizard-restructure.
> Pre-flight complete before discovery: 21 docs migrated to V2 in tatillife_south.

---

## Files read

| File | Role |
|------|------|
| `src/components/wizard/steps/Step4ClosingSales.jsx` | Production step — 3 Card sections |
| `src/components/wizard/WizardForm.jsx` | Wizard orchestrator — INITIAL_DATA, formData state, auto-save |
| `src/components/wizard/CardStack.jsx` | UI primitives: Card, NumericField, CurrencyField, SuggestedField |
| `src/services/submissionService.js` | Firestore write path — sanitize() function |
| `src/utils/extractFields.js` | Canonical read path — V1 flat schema branch |

---

## Step 4 structure (`Step4ClosingSales.jsx`)

Three `Card` sections:

1. **Closing Interviews** — `newCIBooked`, `oldCIBooked`, `ciConducted` (SuggestedField)
2. **Sales Results** — `applicationsSold`, `livesSold`
3. **Production Value** — `apiSold`, `estimatedCommissions`

**Stop condition check:** Pattern is a clean single form with several fields per card. No tabs,
no sub-sections, no complex conditional logic. Clear for restructure. ✅

---

## WizardForm.jsx state

`INITIAL_DATA` (const, lines 59–135) — flat object. Step 4 production fields:

```javascript
applicationsSold:    0,   // → removed (replaced by newBusiness.apps)
livesSold:           0,   // → kept (activity metric, not a production source)
apiSold:             0,   // → removed (replaced by newBusiness.api)
estimatedCommissions: 0,  // → removed (replaced by computed totalCommission)
```

`handleChange(name, value)` at line 213:
```javascript
setFormData((prev) => ({ ...prev, [name]: value }));
```
Works unchanged for nested sub-objects — calling `onChange('newBusiness', { apps: 3, api: 18500 })`
sets `formData.newBusiness` correctly. No WizardForm.jsx logic changes needed for this.

**Auto-save trigger** (`useEffect` line 194):
- Fires on `[formData, step, weekStarting, screen, user, draftStatus]` after 1500ms debounce
- Calls `saveDraft(user.uid, agentName, weekStarting, formData)`
- Slice 2A adds `userProfile?.commissionRate ?? 0` as 5th argument

---

## submissionService.js — sanitize()

Step 4 writes (lines 42–48, to be replaced):

```javascript
newCIBooked:          int(data.newCIBooked),
oldCIBooked:          int(data.oldCIBooked),
ciConducted:          int(data.ciConducted),
applicationsSold:     int(data.applicationsSold),   // → removed
livesSold:            int(data.livesSold),           // → kept
apiSold:              float(data.apiSold),            // → removed
estimatedCommissions: float(data.estimatedCommissions), // → removed
```

`sanitize()` does NOT currently take a `commissionRate` parameter.
Slice 2A adds `commissionRate = 0` parameter for `totalCommission` computation.
`saveDraft` and `submitReport` both accept it and pass it to `sanitize()`.

---

## extractFields.js — production fields (flat schema branch)

```javascript
// line 89
applicationsSold: p(d.applicationsSold || d.appsSold),
// line 91
apiSold:          p(d.apiSold || d.api || d.annualPremium),
```

Slice 2A adds V2-first guard: when `d.version === 2`, read from `d.newBusiness.*`.
V1 aliases remain as defensive fallback.

---

## Slice 2A change map

| File | Change |
|------|--------|
| `Step4ClosingSales.jsx` | Full restructure to 3-source UI (NB primary + expandable PPP/LMPS) |
| `WizardForm.jsx` | INITIAL_DATA: swap flat fields → sub-objects; pass commissionRate to service calls; update ReviewSummary |
| `submissionService.js` | `sanitize(data, commissionRate)`: write V2 shape; import computation helpers |
| `extractFields.js` | V2-first `apiSold` + `applicationsSold` reads |
| `docs/e1-slice-2a-discovery-notes.md` | This file |

---

## Not changed in Slice 2A (deferred to Slice 2B)

- Dashboard KPI cards (still read via `extractFields.js`, which now reads V2 correctly)
- PDF report (`AgentReportDocument.jsx`)
- Leaderboard / Master Sheet
- `awardsEngine.js`, `BadgeGrid.jsx`, `AgentDashboard.jsx` — these all go through `extractFields.js`;
  V2-first read in that file covers them until Slice 2B does the full audit
- Cloud Function `onSubmissionWrite` — still reads `apiSold` directly; Slice 2B target
