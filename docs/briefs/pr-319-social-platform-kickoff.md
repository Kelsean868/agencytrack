# PR #319 — `socialPlatform` Attribution: Capture-Only Slice

**Dispatched:** 2026-05-27  
**Session ledger:** `docs/sessions/2026-05-27-319-h3-h4-run.md`  
**Rules-touching:** Yes → PR-OPEN only. Do NOT merge or deploy. Dispatcher approves merge + rules deploy.  
**Methodology:** Rules 1 / 9 / 12 / 15 / 17 apply. Surface before any decision outside "Decisions locked."

---

## Goal

Add a nullable `socialPlatform` field to both `prospectInfo` docs and `policies` docs. Field stores which social platform brought the prospect when `sourceOfProspect / prospectingSource === 'social-media'`. This is capture-only — no surfacing, no aggregation, no changes to StepSocialMedia or the weekly wizard.

---

## Decisions locked

- **Enum (6 values, kebab-case stored):** `'whatsapp'`, `'instagram'`, `'facebook'`, `'tiktok'`, `'linkedin'`, `'other'`
- **UI labels:** WhatsApp, Instagram, Facebook, TikTok, LinkedIn, Other
- **Conditional render:** `socialPlatform` select renders ONLY when source === `'social-media'`; required-when-shown; hidden AND cleared to `null` when source changes away
- **Surfaces:** prospect-info add form + edit form; policy create form. Both gated by source value.
- **F3.1 prefill extension:** `handleCreatePolicyFromPrep` in `AgentDashboard.jsx` carries `socialPlatform` only when `prep.prospectingSource === 'social-media'`
- **Service-layer guard:** `addProspectInfo` / `updateProspectInfo` throw when source is `'social-media'` AND socialPlatform is null/empty. Same guard in `createPolicy` `validate()`.
- **Rules:** add `'socialPlatform'` to `hasOnly` on policies Arm A (agent body-edit update) AND `prospectInfo` update arm. No hasOnly change needed on create arms (create arms use targeted value guards, no full hasOnly).
- **CAPTURE ONLY:** NO changes to `StepSocialMedia.jsx`, `socialMediaConstants.js`, wizard KPIs, dashboard KPI cards, or any "leads by platform" view. `SOCIAL_PLATFORMS` stays at `['facebook', 'instagram', 'whatsapp', 'linkedin']`.
- **Enum stored separately from wizard enum** — no shared constant between attribution and breakdown. Attribution lives in `prospectInfoService.js` (`SOCIAL_PLATFORMS_ATTRIBUTION`).

---

## Phase 1 — Source verify (confirmed 2026-05-27, re-verify at dispatch)

Run these before writing any code:

```powershell
# 1a. Confirm 'social-media' in PROSPECTING_SOURCES
git grep "social-media" src/services/prospectInfoService.js

# 1b. Confirm Arm A hasOnly line number (expect ~275)
git grep -n "replacedPolicyAPI.*sourceOfProspect\|sourceOfProspect.*cashWithApp" firestore.rules

# 1c. Confirm prospectInfo update hasOnly line (expect ~739)
git grep -n "'policyType', 'intendedAppointmentDate', 'updatedAt'" firestore.rules

# 1d. Confirm no socialPlatform already exists anywhere
git grep -r "socialPlatform" src/

# 1e. Confirm EMPTY_FORM structure in PolicyLedgerPanel
git grep -n "sourceOfProspect" src/components/agent/PolicyLedgerPanel.jsx

# 1f. Confirm prefill carry in AgentDashboard
git grep -n "handleCreatePolicyFromPrep\|setPrefillPolicy" src/components/dashboard/AgentDashboard.jsx
```

Expected Phase 1 outcome: `socialPlatform` absent from all src/ files. Arm A hasOnly ends at `'sourceOfProspect', 'cashWithApp'`. prospectInfo update hasOnly ends at `'intendedAppointmentDate', 'updatedAt'`.

---

## Phase 2 — Edit surface (6 files)

### 1. `src/services/prospectInfoService.js`

Add after `OBJECTIONS`:
```js
export const SOCIAL_PLATFORMS_ATTRIBUTION = [
  { value: 'whatsapp',   label: 'WhatsApp' },
  { value: 'instagram',  label: 'Instagram' },
  { value: 'facebook',   label: 'Facebook' },
  { value: 'tiktok',     label: 'TikTok' },
  { value: 'linkedin',   label: 'LinkedIn' },
  { value: 'other',      label: 'Other' },
];
const SOCIAL_PLATFORM_VALUES = SOCIAL_PLATFORMS_ATTRIBUTION.map((p) => p.value);
```

Extend `addProspectInfo` params + body: accept `socialPlatform` (nullable). Guard: if `prospectingSource === 'social-media'` and `!socialPlatform`, throw `'socialPlatform is required when source is social-media'`. Write as `socialPlatform: socialPlatform ?? null`.

Extend `updateProspectInfo` params + body: same guard + write.

### 2. `src/services/policiesService.js`

Add `SOCIAL_PLATFORMS_ATTRIBUTION` import from `prospectInfoService`. Add `const VALID_SOCIAL_PLATFORMS = new Set(SOCIAL_PLATFORMS_ATTRIBUTION.map(p => p.value))`.

Extend `validate(data)`: if `data.sourceOfProspect === 'social-media'` and `!data.socialPlatform`, throw `'socialPlatform is required when source is social-media'`. If `data.socialPlatform` is non-null and `!VALID_SOCIAL_PLATFORMS.has(data.socialPlatform)`, throw `'invalid socialPlatform'`.

Extend `createPolicy` payload: `socialPlatform: data.sourceOfProspect === 'social-media' ? (data.socialPlatform ?? null) : null`.

### 3. `src/components/agent/ProspectInfoPanel.jsx`

Import `SOCIAL_PLATFORMS_ATTRIBUTION` from `prospectInfoService`.

In `BLANK_FORM`: add `socialPlatform: null`.

In the edit form (inside `CardView`, field change handler): when `prospectingSource` changes away from `'social-media'`, clear `socialPlatform` to `null`.

Add conditional select after the `prospectingSource` select in BOTH the add form and the edit form:
```jsx
{form.prospectingSource === 'social-media' && (
  <FieldGroup label="Platform" required id="socialPlatform-{formId}">
    <select id="socialPlatform-{formId}" name="socialPlatform"
      value={form.socialPlatform ?? ''} onChange={set('socialPlatform')}
      className={selectCls} required>
      <option value="">Select platform…</option>
      {SOCIAL_PLATFORMS_ATTRIBUTION.map((p) =>
        <option key={p.value} value={p.value}>{p.label}</option>
      )}
    </select>
  </FieldGroup>
)}
```

Wire `socialPlatform` into the `addProspectInfo` / `updateProspectInfo` call payloads.

When source changes away from `'social-media'`, set `form.socialPlatform = null` in the change handler.

### 4. `src/components/agent/PolicyLedgerPanel.jsx`

Import `SOCIAL_PLATFORMS_ATTRIBUTION` from `prospectInfoService`.

In `EMPTY_FORM`: add `socialPlatform: null`.

In `handleChange` for `sourceOfProspect`: when value changes away from `'social-media'`, also clear `socialPlatform` to `null`. Use `setForm((prev) => ({ ...prev, sourceOfProspect: e.target.value, socialPlatform: e.target.value === 'social-media' ? prev.socialPlatform : null }))`.

Add conditional select immediately after the `sourceOfProspect` FieldGroup:
```jsx
{form.sourceOfProspect === 'social-media' && (
  <FieldGroup label="Platform" required id="socialPlatform">
    <select id="socialPlatform" name="socialPlatform"
      value={form.socialPlatform ?? ''} onChange={handleChange}
      className={selectCls} required>
      <option value="">Select platform…</option>
      {SOCIAL_PLATFORMS_ATTRIBUTION.map((p) =>
        <option key={p.value} value={p.value}>{p.label}</option>
      )}
    </select>
  </FieldGroup>
)}
```

Wire `socialPlatform: form.socialPlatform` into the `createPolicy` call.

### 5. `src/components/dashboard/AgentDashboard.jsx`

Extend `handleCreatePolicyFromPrep`:
```js
function handleCreatePolicyFromPrep(prep) {
  setPrefillPolicy({
    ownerName:       prep.clientName,
    sourceOfProspect: prep.prospectingSource,
    socialPlatform:   prep.prospectingSource === 'social-media' ? (prep.socialPlatform ?? null) : null,
  });
}
```

### 6. `firestore.rules`

**Arm A policies update `hasOnly`** (lines ~275-282): add `'socialPlatform'` to the list.

**`prospectInfo` update `hasOnly`** (lines ~739-743): add `'socialPlatform'` to the list.

No change to prospect-info create arm (uses `keys().hasAll([...])` for required fields; `socialPlatform` is optional/nullable, no hasAll change needed).
No change to policies create arm (uses targeted value guards, no hasOnly on body).

---

## Phase 3 — Tests

### Unit tests

**`src/services/prospectInfoService.test.js`** (add cases):
1. `addProspectInfo` with `prospectingSource='social-media'` + `socialPlatform='instagram'` → stored as `'instagram'`
2. `addProspectInfo` with `prospectingSource='referral'` + `socialPlatform=null` → stored as `null` (no throw)
3. `addProspectInfo` with `prospectingSource='social-media'` + `socialPlatform=null` → throws `'socialPlatform is required'`
4. `updateProspectInfo` with source `'social-media'` + `socialPlatform='tiktok'` → stored
5. `updateProspectInfo` with source `'social-media'` + `socialPlatform=null` → throws

**`src/services/policiesService.test.js`** (add cases):
6. `createPolicy` with `sourceOfProspect='social-media'` + `socialPlatform='facebook'` → payload contains `socialPlatform:'facebook'`
7. `createPolicy` with `sourceOfProspect='referral'` + no `socialPlatform` → `socialPlatform: null` in payload
8. `createPolicy` with `sourceOfProspect='social-media'` + `socialPlatform=null` → throws `validate` error
9. `createPolicy` with `sourceOfProspect='social-media'` + `socialPlatform='invalid-value'` → throws

### Component tests

**`ProspectInfoPanel.test.jsx`** (add cases):
10. Render add form, change source to `'social-media'` → platform select appears
11. Render add form with source `'social-media'`, change source to `'referral'` → platform select disappears and `socialPlatform` cleared to `null`
12. Platform select is required: submit blocked when source=`'social-media'` + platform empty

**`PolicyLedgerPanel.test.jsx`** (add cases):
13. Render create form, change sourceOfProspect to `'social-media'` → platform select appears
14. Render create form with source `'social-media'`, change to `'referral'` → platform select disappears
15. `createPolicy` called with `socialPlatform` from form when source=`'social-media'`

**`AgentDashboard.test.jsx` or `ProspectInfoPanel.test.jsx`** (add case):
16. `handleCreatePolicyFromPrep` with `prep.prospectingSource='social-media'` + `prep.socialPlatform='whatsapp'` → `prefillPolicy` includes `socialPlatform:'whatsapp'`
17. `handleCreatePolicyFromPrep` with `prep.prospectingSource='referral'` → `prefillPolicy.socialPlatform` is `null`

### Emulator rules tests

**`tests/rules/prospect-info.rules.test.mjs`** (add cases — append to existing 15):
16. ALLOW: agent creates own prep with `prospectingSource='social-media'` + `socialPlatform='instagram'`
17. ALLOW: agent creates own prep with `prospectingSource='referral'` (socialPlatform absent) — existing patterns; regression check
18. ALLOW: agent updates own prep with `socialPlatform` in affectedKeys (set `{ prospectingSource: 'social-media', socialPlatform: 'tiktok', updatedAt: new Date() }`)
19. DENY: agent updates own prep with `socialPlatform` bundled with a non-allowlisted field (e.g., `agentId` changed) — hasOnly violation

**`tests/rules/policies.rules.test.mjs`** (add cases to Arm A block):
20. ALLOW: agent updates own submitted policy with `{ socialPlatform: 'facebook', sourceOfProspect: 'social-media' }` (Arm A affectedKeys include socialPlatform)
21. DENY: agent updates own policy with `{ socialPlatform: 'facebook', status: 'settled' }` — socialPlatform + status change = fails Arm A (status != submitted) AND Arm B (no legal transition submitted→submitted+socialPlatform)

---

## Acceptance criteria

- [ ] `socialPlatform` select appears/disappears when source toggles on/off `'social-media'` (both forms)
- [ ] Cleared to `null` in form state when source changes away (not stale value)
- [ ] Required-when-shown: HTML5 `required` attribute blocks submit when empty
- [ ] Service guards throw when source=`social-media` + null platform
- [ ] `createPolicy` payload writes `null` when source ≠ `'social-media'`
- [ ] F3.1 prefill carries `socialPlatform` when prep source is `'social-media'`; carries `null` otherwise
- [ ] Emulator: all 6 new cases green (4 ALLOW + 2 DENY)
- [ ] `npm run lint && npm test && npm run build` — all pass
- [ ] PR checklist per Rule 18: smoke box UNCHECKED at PR-open

---

## Out of scope (CAPTURE ONLY)

- `StepSocialMedia.jsx` / `socialMediaConstants.js` — DO NOT TOUCH
- Weekly wizard KPIs, `extractFields.js`, dashboard KPI cards
- Any "leads by platform" aggregation, reports, or charts
- `socialPlatformBreakdown` field — DO NOT TOUCH
- Manager-facing read surfaces — `socialPlatform` will be visible via existing `getOwnPolicies` / `getProspectInfo` returns; no new display logic needed in this slice

TikTok wizard expansion banked as LOW in `docs/FOLLOW_UPS.md`.
