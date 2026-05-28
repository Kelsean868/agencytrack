# H3 — Trinidad (UTC-4) Timezone Pipeline Investigation

> **Prepared:** 2026-05-28  
> **Scope:** Read-only source audit + probe. No source changes. Dispatcher review required before any fix.

---

## 1. Pipeline Trace

### 1a. Form inputs — HTML type and value format

All date fields use **`<input type="date">`**, which produces an ISO 8601 date-only string in `YYYY-MM-DD` format. There are no `datetime-local` inputs in the current codebase.

| Field | Location | HTML type | Source line |
|-------|----------|-----------|-------------|
| `dateWritten` | `PolicyLedgerPanel.jsx` EMPTY_FORM, create form | `type="date"` | L697–699 |
| `dateSubmitted` | `PolicyLedgerPanel.jsx` create form | `type="date"` | L701–704 |
| `dateIssued` | `PolicyLedgerPanel.jsx` transition modal (status → `settled`) | `type="date"` | L515–517 |
| `dateLapsed` | `PolicyReconciliationPanel.jsx` lapse form | `type="date"` | L632–634 |

Default values: `dateWritten`, `dateSubmitted`, and `dateIssued` default to `today` via:

```js
// PolicyLedgerPanel.jsx line 41
const today = new Date().toISOString().split('T')[0];
// → "YYYY-MM-DD" in UTC
```

The default `today` value is itself UTC-based: `new Date().toISOString()` always returns UTC. For a TT agent at 9pm on Dec 31, `today` would be `"2025-01-01"` (UTC Jan 1), not `"2024-12-31"` (TT local). This compounds the boundary issue described below.

### 1b. Conversion to Firestore Timestamp

All date fields are converted by:
```js
Timestamp.fromDate(new Date(inputString))
```

**Critical behavior of `new Date('YYYY-MM-DD')`:**  
Per ECMAScript spec (§20.4.1.15), a date-only string with no time component is parsed as **UTC midnight** — not as local midnight. This is the root of the timezone issue.

Node.js probe output (machine TZ = `America/Port_of_Spain`, UTC-4):

```
new Date('2024-12-31').toISOString() → "2024-12-31T00:00:00.000Z"   (UTC midnight)
new Date('2025-01-01').toISOString() → "2025-01-01T00:00:00.000Z"   (UTC midnight)
```

In Trinidad (UTC-4), UTC midnight is **8pm the previous calendar day**:
- `"2024-12-31"` stored as `2024-12-31T00:00:00Z` → TT local: Dec 30, 8pm
- `"2025-01-01"` stored as `2025-01-01T00:00:00Z` → TT local: Dec 31, 8pm (PREVIOUS MONTH)

For comparison, `datetime-local` strings (`"YYYY-MM-DDTHH:mm"`) are parsed as **local time**. Since the form does not use `datetime-local`, this variant is hypothetical but documented:
```
new Date('2024-12-31T20:00').toISOString() → "2025-01-01T00:00:00.000Z"
  (TT 8pm Dec 31 → UTC midnight Jan 1 — month attribution flipped to January)
```

Conversion sites in `policiesService.js`:
```js
// createPolicy (lines 64–65) — dateWritten and dateSubmitted:
dateWritten:   Timestamp.fromDate(new Date(data.dateWritten)),
dateSubmitted: Timestamp.fromDate(new Date(data.dateSubmitted)),

// transitionPolicyStatus (line 135) — dateIssued when transitioning to 'settled':
const dateIssued = Timestamp.fromDate(new Date(fields.dateIssued));

// PolicyReconciliationPanel.jsx (line 225) — dateLapsed:
const dateLapsedTs = Timestamp.fromDate(new Date(ls.dateLapsed));
```

### 1c. Display paths

Two separate `fmtDate` helpers — functionally identical — render dates with `toLocaleDateString('en-TT', {...})`:

**`PolicyLedgerPanel.jsx` lines 83–87:**
```js
function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-TT', { year: 'numeric', month: 'short', day: 'numeric' });
}
```

**`PolicyReconciliationPanel.jsx` lines 34–38:** — identical signature.

`toLocaleDateString('en-TT', {...})` without an explicit `timeZone` option uses the **browser's local timezone** (TT = UTC-4 for agents and managers in Trinidad). For a Timestamp at UTC midnight, it renders the **previous day** in TT.

Usage in templates:

| File | What's displayed | Field |
|------|-----------------|-------|
| `PolicyLedgerPanel.jsx` L351 | `Written: {fmtDate(p.dateWritten)}` | `dateWritten` |
| `PolicyLedgerPanel.jsx` L360 | `Lapsed on {fmtDate(p.dateLapsed)}` | `dateLapsed` |
| `PolicyLedgerPanel.jsx` L426 | `{fmtDate(h.at)}` — history event timestamp | history `at` |
| `PolicyReconciliationPanel.jsx` L604 | `Lapsed on ${fmtDate(policy.dateLapsed)}` | `dateLapsed` |

**`dateIssued` is NOT displayed as text in either panel.** In `PolicyReconciliationPanel`, it is used only for client-side month filtering (see §1d). In `PolicyLedgerPanel`, settled policies show "Settled" status + manager-confirmed API, but not the raw `dateIssued` string.

`AgentReportDocument.jsx` (react-pdf, hex-only): uses `periodLabel(s.periodKey)` to render settlement history — not `dateIssued` directly. `periodKey` is already a YYYY-MM string computed from `dateIssued`.

`AgentAwardsPanel.jsx`: consumes `confirmedSettlements` (already keyed by `periodKey`) and `settlementShapeFromPolicies` output — no direct `dateIssued` render.

### 1d. periodKey computation

**`settlementShapeFromPolicies` — `policiesService.js` lines 325–338:**
```js
const d = dateIssued.toDate ? dateIssued.toDate() : new Date(dateIssued);
const periodKey = d.toISOString().substring(0, 7);   // UTC-based: "YYYY-MM"
```

`toISOString()` always returns UTC. For a Timestamp stored at `2025-01-01T00:00:00Z`, `periodKey = "2025-01"` regardless of TT timezone.

**`PolicyReconciliationPanel` month filter — lines 264–265 (and 100–101, 272–273):**
```js
const d = p.dateIssued.toDate ? p.dateIssued.toDate() : new Date(p.dateIssued);
return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
```

`getFullYear()` and `getMonth()` use the **browser's local timezone** (TT = UTC-4). For `2025-01-01T00:00:00Z` in TT: `getFullYear() = 2024`, `getMonth() + 1 = 12` → bins the policy to **December 2024**, not January 2025.

The `today` default (line 41) also uses `new Date().toISOString().split('T')[0]` — UTC-based. This means a TT agent working after 8pm may get `tomorrow's UTC date` as the default, compounding the boundary scenario.

---

## 2. Probe Results Table

Probe script: `scripts/verification/h3-tt-tz-probe.mjs` (not committed — diagnostic only).  
Runtime timezone: `America/Port_of_Spain` (UTC-4), matching Trinidad agents.

| Input string | Stored Firestore Timestamp (ISO UTC) | periodKey (awards engine) | Display in TT (`toLocaleDateString`) | Manager filter bucket (`getFullYear/Month`) | Period attribution correct for agent intent? |
|---|---|---|---|---|---|
| `"2024-12-31"` | `2024-12-31T00:00:00Z` | `2024-12` | 30 Dec 2024 | `2024-12` | **Y** *(display off by 1 day — cosmetic)* |
| `"2025-01-01"` | `2025-01-01T00:00:00Z` | `2025-01` | 31 Dec 2024 | `2024-12` | **N — ATTRIBUTION BUG** |
| `"2024-03-31"` | `2024-03-31T00:00:00Z` | `2024-03` | 30 Mar 2024 | `2024-03` | **Y** *(display off by 1 day — cosmetic)* |
| `"2025-06-15"` | `2025-06-15T00:00:00Z` | `2025-06` | 14 Jun 2025 | `2025-06` | **Y** *(display off by 1 day — cosmetic)* |
| `"2024-12-31T20:00"` *(hypothetical — no `datetime-local` input exists)* | `2025-01-01T00:00:00Z` | `2025-01` | 31 Dec 2024 | `2024-12` | **N** *(if datetime-local were used, Dec 31 8pm TT would go to January)* |
| `"2025-01-01T01:00"` *(hypothetical)* | `2025-01-01T05:00:00Z` | `2025-01` | 1 Jan 2025 | `2025-01` | **Y** |

**The split is not January-specific.** It occurs for **any `dateIssued` on the 1st of any month**:  
UTC midnight on the 1st = TT 8pm on the last day of the previous month. Both `fmtDate` and `getMonth()` see the previous month; `toISOString()` sees the new month.

Additional impact: the `today` default itself uses `new Date().toISOString().split('T')[0]`. A TT agent opening the "settled" transition form after 8pm will see tomorrow's UTC date as the default `dateIssued` — further increasing the likelihood of a 1st-of-month entry being entered unintentionally.

---

## 3. Verdict

**"Period attribution is wrong in case `"2025-01-01"` (and any `dateIssued` on the 1st of a month) — a genuine split-brain bug exists in the date pipeline."**

Specifically:
- `settlementShapeFromPolicies` attributes the policy to month **M** (UTC-based `toISOString()`).
- `PolicyReconciliationPanel`'s month filter attributes it to month **M-1** (local `getFullYear/Month()`).
- `fmtDate` displays month **M-1** to both agents and managers.

This creates a three-way inconsistency for 1st-of-month `dateIssued`:
1. **Awards engine** (and AgentAwardsPanel, AgentReportDocument settlement history): month M.
2. **Manager reconciliation panel** (which month a policy appears under for confirmation): month M-1.
3. **Displayed date string**: previous-month day (cosmetic, but reinforces wrong month impression).

The split is **structurally guaranteed** for any UTC-4 browser entry of a date-only string on the 1st. The window is small — only affects `dateIssued` exactly on the 1st — but it is deterministic and silent (no error, no warning).

**Scope:** Affects `dateIssued` only (the settlement-period-defining date). `dateWritten` and `dateSubmitted` display off-by-one cosmetically but do not drive period attribution. `dateLapsed` displays off-by-one but has no periodKey computation.

---

## 4. Display Gap Analysis

### Does any display path render `dateIssued` as the wrong day/month to users?

`dateIssued` is **not directly rendered as a human-readable date** in either panel's current UI. The agent's `PolicyLedgerPanel` list card shows only `dateWritten` and `dateLapsed`; settled policies show "Settled" status + the API amount. The manager's `PolicyReconciliationPanel` confirm card shows only `settledAPI`, `policyNumber`, and `initialPremium` — NOT `dateIssued` as text.

Therefore: **no user currently sees a displayed `dateIssued` string that could mislead them.** The harm is entirely in silent mis-attribution of which month a policy is counted in.

### Does `dateWritten` / `dateLapsed` display off-by-one cause confusion?

`fmtDate(p.dateWritten)` renders in the policy list card. For `"2024-12-31"` the display shows "30 Dec 2024" — one day earlier than the agent entered. This is cosmetic but potentially confusing for field agents who entered Dec 31 and see Dec 30. No period attribution is affected since `dateWritten` does not drive `periodKey`.

`fmtDate(p.dateLapsed)` has the same cosmetic issue. `dateLapsed` also has no periodKey computation so no attribution effect.

### Manager confirmation view

The manager uses a `year + month` selector (e.g., "January 2025") to filter which settled policies to confirm. For `dateIssued = "2025-01-01"`, the manager must select **December 2024** to find the policy — because the local `getMonth()` filter bins it to December. The manager's intent is "confirm January policies," but this policy will be invisible in January's view and appear in December.

If the manager confirms this policy under December, the resulting `settlements` doc gets `periodKey = "2024-12"`. But if the awards engine independently computes `settlementShapeFromPolicies` using the raw policy docs, it produces `periodKey = "2025-01"`. These two data sources diverge. Which one wins in the awards display depends on whether `AgentAwardsPanel` uses `confirmedSettlements` or `ledgerPolicies` — it uses both, merged by `periodKey`. The merge would produce two separate rows for what the agent considers one period.

---

## 5. Recommendation

Three options, ordered from lightest to heaviest change:

---

### Option (a) — No fix needed

**Rationale for considering it:** The `dateIssued` field is not displayed to users, so there's no visible wrong-date UX. The split only occurs when `dateIssued` is exactly the 1st of a month. For the Tatil pilot (single branch, small agent count), the probability of a policy being genuinely issued on the 1st is real but low. The pilot data volume is small enough that manual correction is feasible.

**Why this is insufficient:** The split is deterministic and silent. Every January 1st (or any 1st) `dateIssued` will silently land in the previous month in the manager panel while landing in the correct month in the awards engine. These diverge without any error. As policy volume grows, the discrepancy accumulates. Additionally, the `today` default increases the chance of a 1st-of-month entry being typed by accident.

**Verdict: Not recommended.** The bug is real, reproducible, and will cause permanent data quality issues at scale.

---

### Option (b) — Cosmetic fix only (adjust display to UTC)

Change `fmtDate` in both panels to pass `timeZone: 'UTC'` explicitly:

```js
function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-TT', {
    year: 'numeric', month: 'short', day: 'numeric',
    timeZone: 'UTC',   // ← add this
  });
}
```

This makes the display match the stored UTC date (Dec 31 stored at UTC midnight → displays "31 Dec"). It eliminates the cosmetic off-by-one. But it **does not fix the semantic split** — the manager filter still uses `getFullYear()` / `getMonth()` (local TT time), so the `PolicyReconciliationPanel` month bucket would still disagree with the awards engine for 1st-of-month dates.

**Verdict: Partial improvement, but leaves the real bug (period split) unresolved.** Not sufficient on its own.

---

### Option (c) — Semantic fix: interpret dates as TT-local, store as TT-midnight UTC

Change all date-string-to-Timestamp conversions to interpret the input as TT local midnight, not UTC midnight. This requires adding 4 hours to the parsed date:

```js
// Before (UTC midnight — the bug):
Timestamp.fromDate(new Date('2025-01-01'))
// → 2025-01-01T00:00:00Z

// After (TT local midnight = UTC 04:00):
function parseTTLocalDate(dateStr) {
  // dateStr = "YYYY-MM-DD" from <input type="date">
  // Interpret as TT midnight: append T04:00:00Z (UTC offset for UTC-4)
  return Timestamp.fromDate(new Date(dateStr + 'T04:00:00Z'));
}
// → 2025-01-01T04:00:00Z (TT midnight Jan 1)
```

With TT-local storage:
- `toISOString().substring(0, 7)` = "2025-01" (January) ✓
- `getFullYear()` in TT = 2025, `getMonth()+1` = 1 (January) ✓
- `fmtDate` with no timeZone = "1 Jan 2025" ✓

All three paths would agree. The manager filter and awards engine would both bin to January.

**Migration consideration:** Existing production `dateIssued` Timestamps are stored at UTC midnight. Changing the write path without a migration would create two different storage conventions in the same collection. The migration would require reading every settled policy and rewriting `dateIssued`, `dateWritten`, `dateSubmitted`, and `dateLapsed` to shift by +4 hours. This is feasible with an Admin SDK script but must be done carefully (dry-run first, verify count, execute with transaction guard).

**Also fix the `today` default:** `new Date().toISOString().split('T')[0]` would also need to change to TT-local today:
```js
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Port_of_Spain' });
// → "YYYY-MM-DD" in TT local time
```
(`'en-CA'` locale uses ISO date format, avoiding locale-specific separators.)

---

### CC Recommendation: **Option (c) — Semantic fix + data migration, staged.**

The cosmetic off-by-one (option b) is a symptom; the root cause is that `new Date('YYYY-MM-DD')` always returns UTC midnight. The semantic fix is the only option that produces a correct, internally consistent system.

Recommended staging:
1. **Stage 1 (write path only, pre-migration):** Change new writes to use TT-local midnight. Existing data stays at UTC midnight. The split is reduced to only existing historical data and eliminated for all new entries.
2. **Stage 2 (migration):** Admin SDK script (dry-run + execute) to shift existing Timestamps +4 hours for all date fields in the `policies` collection. Run against the real production dataset before the Tatil pilot generates significant volume.
3. **Stage 3 (display fix):** Update `fmtDate` to explicitly pass `timeZone: 'UTC'` so stored dates always render at the stored day — making the display deterministic regardless of browser timezone.

Priority: **HIGH** before the Tatil pilot ramps up. The pilot is described as postponed indefinitely; if it launches before this fix, every policy issued on the 1st of a month will be silently mis-attributed. At 8pm+ in Trinidad, the `today` default will also silently give agents tomorrow (UTC) as the default entry date.

---

*Investigation conducted 2026-05-28. Source verified against `main` HEAD `df161fe`. Probe script at `scripts/verification/h3-tt-tz-probe.mjs` (not committed).*
