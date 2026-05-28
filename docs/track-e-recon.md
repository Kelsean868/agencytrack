# Track E — Daily Log Enhancement: Recon

> **Purpose:** Ground-truth audit of the current Daily Log surface before designing the work-schedule layer, FAB skip-day logic, and refined form. Feeds `docs/track-e-design-questions.md`.
>
> **Source-verified against:** `src/components/daily/DailyEntryModal.jsx`, `src/components/daily/DailyFAB.jsx`, `src/services/dailyActivityService.js`, `src/lib/schema/dailyActivity.js`, `src/lib/schema/dailyActivity.aggregator.js`, `src/components/dashboard/AgentDashboard.jsx`, `docs/phase7-8-PRD.md §4`. Verified 2026-05-28.

---

## 1. Current surface — what's built (E6, shipped)

### 1.1 Entry points

| Surface | Trigger | Component |
|---|---|---|
| AgentDashboard FAB | Always visible when `loggingMode` is `'daily'` or `'hybrid'` | `DailyFAB.jsx` |
| Bottom-nav "submit" (daily-only mode) | Tap "submit" when `loggingMode === 'daily'` | `handleAction('submit')` |
| Dashboard banner | "Haven't logged today" nudge → `action === 'log-today'` | `handleAction('log-today')` |

### 1.2 Modal: `DailyEntryModal.jsx`

Full-screen modal (fixed inset). Always opens to TODAY (agent cannot select a different date from this entry point — catch-up not yet wired from the modal itself).

**Sections and fields:**

| Section | Fields | Always visible? |
|---|---|---|
| Activity | qualifiedApproaches, appointmentsSet, ffisScheduled, ffiConducted, solutionPresentations, newCIBooked, oldCIBooked, ciConducted (8 fields) | Yes |
| Names & Service | newNamesAdded, oldNamesWorked, serviceContacts (3 fields) | Yes |
| New Business | newBusiness.apps, newBusiness.api (2 fields) | Yes |
| PPP Increases | pppIncreases.apps, pppIncreases.apiIncrease (2 fields) | No — expand-on-tap ("Add PPP details") |
| Lumpsums | lumpsums.grossAmount (1 field) | No — expand-on-tap ("Add lumpsum details") |
| Reflection | hoursWorked, wins, blockers, notes (4 fields) | No — expand-on-tap ("Add reflection (optional)") |

**Total always-visible fields: 13 across 3 sections.** Optional fields: 7 behind expand-on-tap.

### 1.3 FAB: `DailyFAB.jsx`

- Fixed bottom-right, `bottom-20` (80px above bottom nav).
- Pencil icon.
- Amber dot when `!todayLogged` (today not yet logged). Disappears once logged.
- **Skip-day visibility: DEFERRED.** Comment in `DailyFAB.jsx:12`: "Skip-day visibility deferred: depends on per-agent work schedule (not yet built). Currently always visible when showDailyCTA is true."
- Currently always visible regardless of what day of the week it is.

### 1.4 Schema: `src/lib/schema/dailyActivity.js`

Doc path: `tenants/{tenantId}/users/{userId}/dailyActivity/{YYYY-MM-DD}`.

Full field list:
```
version, weeklyReportVersion, date, weekStarting, agentId, agentName,
qualifiedApproaches, appointmentsSet, ffisScheduled, ffiConducted,
solutionPresentations, newCIBooked, oldCIBooked, ciConducted,
newBusiness: { apps, api },
pppIncreases: { apps, apiIncrease },
lumpsums: { grossAmount },
newNamesAdded, oldNamesWorked, serviceContacts,
hoursWorked, wins, blockers, notes,
isCatchUp, catchUpStartDate, catchUpEndDate,
createdAt, updatedAt
```

### 1.5 Aggregation: `src/lib/schema/dailyActivity.aggregator.js`

`aggregateDailyToWeekly(dailyEntries, commissionRate)` maps daily fields → weekly submission doc fields:

| Daily field | Weekly submission field |
|---|---|
| qualifiedApproaches | qualifiedApproaches |
| appointmentsSet | appointmentsSet |
| ffisScheduled | ffisScheduled |
| ffiConducted | ffiConducted |
| solutionPresentations | solutionPresentations |
| newCIBooked | newCIBooked |
| oldCIBooked | oldCIBooked |
| ciConducted | ciConducted |
| newBusiness.{apps,api} | newBusiness.{apps,api} |
| pppIncreases.{apps,apiIncrease} | pppIncreases.{apps,apiIncrease} |
| lumpsums.grossAmount | lumpsums.{grossAmount, apiCredit, commission} |
| newNamesAdded | namesFromOther |
| oldNamesWorked | oldNamesPool |
| serviceContacts | serviceContacts |
| hoursWorked, wins, blockers, notes | NOT propagated (reflection-only) |

**Aggregator is also used by** `functions/aggregators/sundayDailyToWeekly.js` (Sunday 23:00 TT cron) and the mid-week mode-switch logic in `loggingModeService.js`.

### 1.6 Logging mode

`userProfile.loggingMode` = `'weekly'` | `'daily'` | `'hybrid'` (default `'hybrid'`).

- `'hybrid'` → FAB visible + weekly wizard accessible.
- `'daily'` → FAB only; "submit" button in bottom nav opens daily modal (not wizard).
- `'weekly'` → no FAB; wizard only.

---

## 2. What's NOT built (deferred by E6)

| Feature | Where deferred |
|---|---|
| Skip-day FAB visibility | `DailyFAB.jsx:12` comment: "depends on per-agent work schedule (not yet built)" |
| Per-agent work schedule (working days Mon–Sun) | `docs/phase7-8-PRD.md §4.1` |
| T&T holiday calendar tenant config | `docs/phase7-8-PRD.md §4.2` |
| Vacation period overrides on user doc | `docs/phase7-8-PRD.md §4.1` |
| Missing-day cards in dashboard (catch-up entry for a past day) | `docs/phase7-8-PRD.md §4.7` |
| Manager-portal FAB ("My Production" tab for producing managers) | `docs/phase7-8-PRD.md §4.4` |

---

## 3. PRD proposal — refined form (§4.5)

The PRD proposes a 4-section form with 8 fields in Sections 1+2 always visible:

| Section | Always visible? | Fields |
|---|---|---|
| Section 1 — Activity (6 fields) | Yes | Dials, Telephone contacts, F2F attempts, F2F successful, FFI conducted, CI conducted |
| Section 2 — Time (2 fields) | Yes | Office hours, Field hours |
| Section 3 — Production (3 fields) | Expand-on-tap | Apps sold, API written (TTD), New prospects added |
| Section 4 — Service (3 fields) | Expand-on-tap | Service calls, Policies received, Policies delivered |

**Total: 14 fields across 4 sections.** Layout: 2-column grid on mobile for sections 1+2.

### 3.1 Field-label divergence vs. current schema

| PRD label | Current schema field | Gap type |
|---|---|---|
| Dials | ??? | **UNMAPPED** — no `dials` field exists today |
| Telephone contacts | serviceContacts? | **AMBIGUOUS** — `serviceContacts` is broader than phone calls |
| F2F attempts | appointmentsSet? qualifiedApproaches? | **AMBIGUOUS** — multiple candidate mappings |
| F2F successful | ffisScheduled? | **AMBIGUOUS** |
| FFI conducted | ffiConducted | Direct match |
| CI conducted | ciConducted | Direct match |
| Office hours | hoursWorked (partial) | **NEW** — currently a single `hoursWorked` field |
| Field hours | (none) | **NEW** — no field-hours split exists |
| Apps sold | newBusiness.apps | Direct match |
| API written (TTD) | newBusiness.api | Direct match |
| New prospects added | newNamesAdded | Likely match |
| Service calls | serviceContacts | Likely match (rename) |
| Policies received | (none) | **NEW** — no existing schema field |
| Policies delivered | (none) | **NEW** — no existing schema field |

### 3.2 PRD-vs-current: fields removed from always-visible

The following 8 current Activity fields have unclear mapping to PRD's 6 Section 1 fields:
- `appointmentsSet`, `ffisScheduled`, `solutionPresentations`, `newCIBooked`, `oldCIBooked` — no direct PRD counterpart listed

If the PRD's 6 fields are a subset/rename of current 8, the orphaned fields (`solutionPresentations`, `newCIBooked`, `oldCIBooked`) need a decision: **collapse into Section 3/4, remove entirely from daily log (wizard-only), or keep as optional fields**.

### 3.3 Aggregation impact

Any schema field added to the daily doc that also needs to aggregate to the weekly submission requires:
1. New field on `createEmptyDailyEntry` in `dailyActivity.js`
2. New `sumInt` line in `aggregateDailyToWeekly` in `dailyActivity.aggregator.js`
3. Corresponding weekly submission field (may or may not exist already)
4. Same change in `functions/aggregators/sundayDailyToWeekly.js` (CF side — requires CF deploy)

Fields that are daily-log-only (like `hoursWorked`, `wins`, etc.) don't need aggregation changes.

---

## 4. Work-schedule — proposed schema (PRD §4.1)

Stored on the user doc (`tenants/{tenantId}/users/{userId}`):

```json
{
  "workSchedule": {
    "workingDays": ["mon", "tue", "wed", "thu", "fri"],
    "workingHoursStart": "08:00",
    "workingHoursEnd": "17:00",
    "holidayOverrides": ["2026-02-16"],
    "vacationPeriods": [
      { "start": "2026-07-15", "end": "2026-07-29", "label": "Family trip" }
    ]
  }
}
```

**Current rules gap:** The user doc update rule (`allow update`) has a field allowlist (PR #129) for the manager-edit path. Agent self-service writes (loggingMode, workSchedule) are handled separately — need to confirm whether `workSchedule` is in the agent-writable allowlist or needs an explicit extension.

### 4.1 Holiday calendar — proposed schema (PRD §4.2)

New path: `/tenants/{tenantId}/config/holidays/{year}`.

This is a **new doc under the existing `/config/{docId}` collection**. The current `match /config/{docId}` wildcard rule (read: any tenant member; write: canManage) already covers this path — no new rule block needed unless per-holiday field write restrictions are required.

---

## 5. Auto-skip logic (PRD §4.3)

Proposed check per day:
1. Is the day in the agent's `workingDays`? If no → skip.
2. Is the day in `/config/holidays/{year}.holidays[]` AND NOT in agent's `holidayOverrides`? If yes → skip.
3. Is the day within any `vacationPeriods` range? If yes → skip.

This logic lives entirely in the client — no CF or rules change required. Pure `isSkipDay(date, workSchedule, holidays)` util function.

Effect of skip: no FAB amber dot, FAB hidden or dimmed (TBD per design question Q3), no nudge banner, streak ignores the day.

---

## 6. Open surface gaps flagged for design questions

| Gap | Category |
|---|---|
| PRD Section 1 field names don't map 1:1 to current schema | Field mapping |
| `dials` has no current schema field | New field / aggregation |
| Office hours / field hours replaces single `hoursWorked` — backward compat? | Schema migration |
| Policies received / policies delivered — new fields with no weekly submission counterpart | New field |
| `workSchedule` on user doc — agent self-write rules coverage | Rules |
| FAB behavior on skip days (hidden vs dimmed vs visible-no-dot) | UX |
| Missing-day cards (catch-up from dashboard) — scope of this track vs. future | Scope |
| Manager-portal FAB ("My Production") — scope of this track vs. future | Scope |
| Aggregator CF sync (`sundayDailyToWeekly.js`) — CF deploy required for any new daily field that aggregates | Deploy |
