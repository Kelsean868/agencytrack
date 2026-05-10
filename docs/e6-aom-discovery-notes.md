# E6 AOM — Discovery Notes

> Phase 2 of the E6 Agent-of-Month brief. Source-of-truth for Phases 3–8.

## 1. Activity field schema (confirmed from E5.1 notes + WeeklyActivityPanel.jsx)

Read via `extractFields(sub)` — single source of truth.

| Category | Metric | extractFields field |
|---|---|---|
| Activity | Names | `totalNewNames` |
| Activity | Calls | `totalTelAttempts` |
| Activity | FFIs | `ffiConducted` |
| Activity | CIs | `ciConducted` |
| API | Total API | `extractTotalProductionCredit(sub)` |
| Apps | Total Apps | via `computeAgentTotals()` → `totalApps` |

Activity winner total = `totalNewNames + totalTelAttempts + ffiConducted + ciConducted` per agent for the month.

For AOM candidates, filter submissions by MTD (`filterSubmissionsByPeriod(subs, 'mtd')`), then aggregate per agent.

## 2. Manager tab pattern (from ManagerDashboard.jsx)

- `NAV_ITEMS` array with optional `roles` array for gating
- `filteredNavItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role))`
- Render: `{activeTab === 'agent-of-month' && <AgentOfMonthTab />}`
- New entry: `{ id: 'agent-of-month', label: 'Agent of Month', tabId: 'agent-of-month', Icon: Trophy, roles: ['branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin'] }`

## 3. Cloud Function patterns (from kiosk/createToken.js)

```javascript
const MANAGER_ROLES = new Set(['branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin']);
exports.setAgentOfMonth = functions.https.onCall(async (data, context) => {
  const { role, tenantId } = context.auth.token;
  if (!MANAGER_ROLES.has(role)) throw new functions.https.HttpsError('permission-denied', '...');
  // ...
});
```

Export pattern in `index.js`:
```javascript
exports.setAgentOfMonth        = require('./agentOfMonth/setAgentOfMonth').setAgentOfMonth;
exports.getAgentOfMonthCandidates = require('./agentOfMonth/getCandidates').getAgentOfMonthCandidates;
```

## 4. Kiosk + Firestore rules

- `isKiosk()` → `getRole() == 'kiosk'`
- `kioskCanRead(tenantId)` → `isSignedIn() && isKiosk() && getTenantId() == tenantId`
- Kiosk reads Firestore directly after `signInWithCustomToken` in KioskRoute.jsx
- `setRuntimeTenantId(data.tenantId)` is called before KioskShell mounts — `getTenantId()` works

New rules block (additive only):
```
match /tenants/{tenantId}/agentOfMonth/{monthKey} {
  allow read: if canManage(tenantId) || kioskCanRead(tenantId);
  allow write: if false; // CF writes via Admin SDK
}
```

## 5. KioskShell architecture

- `PANEL_COMPONENTS` dict → add `agentOfMonth: AgentOfMonthPanel`
- `PANEL_ORDER` → insert `'agentOfMonth'` at index 1 (after 'welcome')
- `PANEL_DURATIONS` → add `agentOfMonth: 45`
- `sharedProps` → add `agentOfMonthData` (fetched separately from Firestore in KioskShell)
- AOM fetch: read `tenants/{tid}/agentOfMonth/{currentMonthKey}`, fallback to prior month if day 1-7

## 6. Avatar sizes (from Avatar.jsx)

Current `SIZE_PX = { sm: 24, md: 32, lg: 48, tv: 60 }`. Add:
```javascript
const SIZE_PX = { sm: 24, md: 32, lg: 48, tv: 60, aom: 200 };
```

## 7. Trinidad timezone for month key

- TT is UTC-4, no DST (consistent with `computations.js`)
- `TRINI_OFFSET_MS = 4 * 60 * 60 * 1000`
- Month key format: `"YYYY-MM"` in TT time
- Edit window: monthKey is current OR (previous AND today is day 1-7 of current month in TT time)

## 8. getAgentOfMonth — direct Firestore read (no CF needed)

Per brief recommendation, kiosk reads directly from Firestore using existing `kioskCanRead` rule.
Manager UI also reads directly (uses `canManage` rule).
Service layer: `src/services/agentOfMonthService.js`.

## 9. No STOP conditions triggered

| Condition | Result |
|---|---|
| Activity fields different | ✅ Same as E5.1 — confirmed via WeeklyActivityPanel.jsx |
| Manager tab pattern conflicts | ✅ Straightforward — uses filteredNavItems pattern |
| CF architecture conflicts | ✅ Follows createToken.js pattern exactly |
| Panel layout issues | Deferred to Phase 5 — 250px avatars at 1920×1080 should fit 3-up |
| Firestore rules can't express read | ✅ kioskCanRead + canManage covers it cleanly |
