# Track E — Daily Log Enhancement: Design Questions

> **Purpose:** Block-surface before implementation begins. Each question carries CC's recommended answer and a one-line rationale. Kyron's explicit ACK on every question unlocks the build brief.
>
> Source: `docs/track-e-recon.md` + ground-truth verification of `DailyEntryModal.jsx`, `DailyFAB.jsx`, `dailyActivityService.js`, `dailyActivity.js`, `dailyActivity.aggregator.js`, `AgentDashboard.jsx`, `phase7-8-PRD.md §4`. Verified 2026-05-28.

---

## Source-verification corrections / confirmations

The following were checked against current source before drafting:

- `DailyFAB.jsx:12` comment explicitly says "Skip-day visibility deferred: depends on per-agent work schedule (not yet built)." Confirmed E6 shipped without skip-day logic.
- Current always-visible fields: 13 (8 Activity + 3 Names&Service + 2 New Business). PRD §4.5 proposes 8 always-visible fields (6 Activity + 2 Time). Divergence is real, not a doc-drift error.
- `hoursWorked` is a SINGLE field in the dailyActivity schema (`src/lib/schema/dailyActivity.js:51`). PRD §4.5 Section 2 proposes "Office hours" + "Field hours" as TWO fields. This is a schema change, not a label rename.
- `aggregateDailyToWeekly` in `dailyActivity.aggregator.js:68-83` lists the exact 8 activity fields used today. PRD's proposed new fields ("Dials", "Telephone contacts", "F2F attempts", "F2F successful") do NOT currently exist in the schema or aggregator.
- The existing `/config/{docId}` wildcard rule covers the proposed `holidays/{year}` doc — no new rule block required for the holiday calendar IF write access is manager-only (canManage). Confirmed at `firestore.rules` line 508–511.
- `workSchedule` is NOT in the current user-doc update allowlist (PR #129 field set). An agent writing `workSchedule` to their own user doc today would be DENIED — same class of gap as the goals write bug (Task 1).

---

## Questions

### Q1 — Field mapping: are the PRD Section 1 labels schema changes or label renames?

**Context from recon §3.1:** PRD §4.5 Section 1 lists 6 fields: Dials, Telephone contacts, F2F attempts, F2F successful, FFI conducted, CI conducted. Current schema has 8 Activity fields: qualifiedApproaches, appointmentsSet, ffisScheduled, ffiConducted, solutionPresentations, newCIBooked, oldCIBooked, ciConducted.

Only 2 map directly: `ffiConducted` ↔ "FFI conducted", `ciConducted` ↔ "CI conducted".

The other 4 PRD labels have no clean 1:1 mapping:
- "Dials" — not in current schema at all.
- "Telephone contacts" — possibly `serviceContacts` (currently "Service contacts today") or a new field.
- "F2F attempts" — possibly `qualifiedApproaches` or `appointmentsSet`.
- "F2F successful" — possibly `ffisScheduled` or `ffiConducted`.

**Options:**
- A. Label renames only: map existing fields to PRD labels, no schema change. E.g. `qualifiedApproaches` → "Dials", `serviceContacts` → "Telephone contacts", `appointmentsSet` → "F2F attempts", `ffisScheduled` → "F2F successful". Aggregation unchanged.
- B. New schema fields for genuinely new concepts; deprecated fields removed. Requires: new dailyActivity schema fields + aggregator + CF deploy.
- C. Hybrid: rename labels where semantics match; add only truly new fields (`dials` if it's distinct from approaches); keep deprecated fields for backward compat.

**CC recommendation:** Option A (label renames, no schema change) — if the semantics match.
**Rationale:** Aggregation is the binding constraint. Changing field names requires an aggregator change AND a CF deploy AND a schema migration for past docs. Label-only renames in the UI are zero-risk. If "Dials" means exactly what `qualifiedApproaches` means today, a rename is the right call.

**Kyron must confirm:** Are these label renames (same concept, new name) or genuinely new measurement concepts that don't map to existing fields?

---

### Q2 — "Dials": new field or rename of `qualifiedApproaches`?

**Context:** "Dials" (telephone-initiated outreach attempts) and "Qualified Approaches" (in-person or phone contacts that resulted in a qualifying conversation) are potentially different metrics. If Tatil's definition of `qualifiedApproaches` was always "number of calls made," then "Dials" is a rename. If qualifiedApproaches was "approaches that led to a scheduled appointment," then "Dials" is a new, broader field.

**Options:**
- A. "Dials" = rename of `qualifiedApproaches`. Schema field name stays; label in UI changes.
- B. "Dials" is a new, broader field. Add `dials` to dailyActivity schema. Decide whether to keep/collapse `qualifiedApproaches` or replace it.

**CC recommendation:** Surface to Kyron — CC cannot determine the semantic equivalence from code alone.
**Rationale:** This is a product definition question. The wrong call creates silent data drift: if "Dials" ≠ "Qualified Approaches" and we just rename the label, manager dashboards will show inflated or deflated numbers.

---

### Q3 — FAB behavior on skip days: hidden, dimmed, or visible-no-dot?

**Context from recon §5:** PRD §4.3 says "Agent can still tap the FAB to log activity on a skip day — overrides the skip silently." PRD §4.4 says "Hidden on skip days unless agent explicitly opens it via menu."

These two sentences are in tension: §4.3 implies the FAB is always tappable; §4.4 implies it's hidden.

**Options:**
- A. **Hidden** on skip days. Agent can still log via a different access point (e.g., long-press or "Log a past day" from the Dashboard). PRD §4.4 intent.
- B. **Dimmed** (lower opacity, no amber dot) on skip days. Agent can still tap. Clear visual cue that "today is a rest day" without blocking entry.
- C. **Visible with no dot** on skip days. Identical appearance to "already logged today." No visual skip signal. Simplest to implement.

**CC recommendation:** Option B — dimmed FAB on skip days, no amber dot.
**Rationale:** Option A risks agents not being able to log if they work on a skip day (they might not find the alternative entry point). Option C is visually ambiguous (looks like "already logged"). Option B communicates "today is a rest day" clearly while keeping the entry point accessible — matches §4.3's "agent can still tap."

**UX question:** Should the amber dot appear on skip days when the agent hasn't logged? (Currently the amber dot = "you should log today.") On a skip day, no logging is expected — the dot should NOT appear.

---

### Q4 — Office hours / Field hours: new fields or replace `hoursWorked`?

**Context from recon §3.1:** Current schema has `hoursWorked` (single float). PRD §4.5 Section 2 has "Office hours" + "Field hours" (two separate fields). These can mean either:
- A single `hoursWorked` value split into two components.
- Or truly additive: `hoursWorked = officeHours + fieldHours`.

**Options:**
- A. **Replace** `hoursWorked` with `officeHours` + `fieldHours`. Total hours = sum of both. Schema change; existing docs with `hoursWorked` need migration or fallback display.
- B. **Add** `officeHours` + `fieldHours` as NEW fields alongside existing `hoursWorked`. Agent enters both; `hoursWorked` deprecated in UI but retained in schema. No migration needed.
- C. **Keep** `hoursWorked` as the only hours field; split the UI label into two inputs that sum to `hoursWorked`. Cosmetic only — schema unchanged.

**CC recommendation:** Option A (replace with two new fields) — clean schema, no legacy cruft.
**Rationale:** `hoursWorked` is in the reflection section (NOT propagated to weekly). It's not used in any aggregation or KPI computation today. No migration needed for existing docs (they just won't have the new fields — display as 0). A clean split is less surprising than a cosmetic two-input → one-field hack.

**Kyron must confirm:** Are office hours and field hours tracked SEPARATELY because managers care about the breakdown? Or are they convenience groupings that sum to total hours?

---

### Q5 — Policies received / Policies delivered: new schema fields + aggregation?

**Context from recon §3.1:** PRD §4.5 Section 4 lists "Policies received" and "Policies delivered" as two service metrics. Neither exists in the current dailyActivity schema or the weeklyReport/submission schema.

**Options:**
- A. Add both as new dailyActivity fields + aggregation → weekly submission fields. Requires: schema change + aggregator change + weekly submission schema extension + CF deploy.
- B. Add as daily-log-only capture (reflection-only, no aggregation). Stored on the dailyActivity doc but not propagated to weekly. Agent uses them for personal tracking only.
- C. Defer to a future track; exclude from initial Track E scope.

**CC recommendation:** Surface to Kyron — depends on whether managers need these metrics surfaced in the weekly report.
**Rationale:** If these are manager-visible metrics (e.g. in MasterSheet, CompliancePanel), they need aggregation. If they're personal journaling, reflection-only is fine. Aggregation requires a CF deploy, which has higher process overhead. Decision is product intent, not a technical call.

---

### Q6 — `workSchedule` on user doc: agent self-write rules coverage?

**Context from recon §4:** `workSchedule` is NOT in the current user-doc update allowlist. The user-doc update rule (`firestore.rules` ~line 155–195) only allows writes through the manager-edit path (PR #129 field set). An agent writing `workSchedule` to their own user doc today would be DENIED.

**Fix options:**
- A. Add `workSchedule` to the agent-writable allowlist arm on the user doc update rule.
- B. Create a dedicated Cloud Function (`saveWorkSchedule`) that writes `workSchedule` via Admin SDK (bypasses rules). Consistent with the CF-gate pattern for sensitive user fields.
- C. Store `workSchedule` on a NEW separate Firestore path (e.g., `tenants/{tid}/userPreferences/{uid}`) with its own rule block giving agents self-write access.

**CC recommendation:** Option A — add `workSchedule` to the agent-writable allowlist on the user doc update rule.
**Rationale:** `workSchedule` has no security implications (agent setting their own work schedule is trivially safe). The CF-gate pattern (Option B) is reserved for fields that affect auth, roles, or cross-user visibility. A dedicated subcollection (Option C) is over-engineering for a single field. Option A is the minimal correct fix — same shape as the goals write fix needed in Task 1.

**Rule change required:** This is an additive rules change. Arm:
```
allow update: if isSignedIn() && isAgent() && getTenantId() == tenantId
  && request.auth.uid == userId
  && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['workSchedule'])
```
(or extend the existing agent-self-update arm if one exists.)

---

### Q7 — What fields from the current 8 Activity fields are REMOVED from always-visible?

**Context:** Current always-visible Activity section has 8 fields. PRD §4.5 Section 1 has 6 fields. If Q1 is resolved as label renames, then 2 of the current 8 become either (a) hidden, (b) moved to a collapsed section, or (c) removed from daily log entirely.

Candidates for removal/demotion based on PRD §4.5 vs. current schema:
- `solutionPresentations` — no PRD counterpart in Section 1 or 3.
- `newCIBooked` — no PRD counterpart.
- `oldCIBooked` — no PRD counterpart.
- `appointmentsSet` / `ffisScheduled` — if "F2F attempts" replaces both, one becomes redundant.

**CC recommendation:** Surface to Kyron — CC cannot determine product intent.
**Rationale:** "Removing" a daily-log field that the weekly report currently displays causes a silent data gap for agents in daily-only mode. `solutionPresentations`, `newCIBooked`, `oldCIBooked` currently aggregate to the weekly submission. If they're removed from the daily form, agents can't log them daily — they'd need to enter them manually in the weekly wizard.

---

### Q8 — Missing-day catch-up cards (PRD §4.7): same track or future?

**Context:** PRD §4.7 describes a dashboard component: "You haven't logged Tuesday yet. [Log Tuesday now]" cards that open the daily modal pre-set to a past date. Currently, `DailyEntryModal` always opens to `getTodayLocalDate()` — no date-picker exists. The `isCatchUp` flag and `catchUpStartDate/EndDate` fields exist in the schema but aren't used from the catch-up card flow (they're only set by the mode-switch `weekly → daily` path in `loggingModeService.js`).

**Options:**
- A. Include catch-up cards in Track E scope. Requires: date-selector on DailyEntryModal, "missing day" computation in AgentDashboard, dashboard card component.
- B. Defer to a follow-up track. Track E focuses on work-schedule, FAB skip-day, and form refinement only. Catch-up UI comes later.

**CC recommendation:** Option B — defer catch-up cards.
**Rationale:** Catch-up cards require a date-selector on the modal (non-trivial), missing-day computation (dependent on work-schedule being built first), and a new dashboard card component. They're a UX polish slice best sequenced after the work-schedule layer exists. Track E's core value is the schedule + skip-day + form — that's already a 3-4 PR scope.

---

## ACK checklist — PENDING (awaiting Kyron's review)

- [ ] **Q1** — PRD Section 1 fields: label renames or new schema? Confirm which current fields map to Dials / Telephone contacts / F2F attempts / F2F successful.
- [ ] **Q2** — "Dials" field: rename of `qualifiedApproaches` or new concept?
- [ ] **Q3** — FAB skip-day behavior: hidden, dimmed, or visible-no-dot?
- [ ] **Q4** — Office / Field hours: replace `hoursWorked` or add alongside?
- [ ] **Q5** — Policies received / delivered: aggregate to weekly or reflection-only?
- [ ] **Q6** — `workSchedule` write path: agent-writable allowlist extension (recommended), CF gate, or separate path?
- [ ] **Q7** — Which current 8 Activity fields remain always-visible after PRD §4.5 restructure? Which are removed / demoted?
- [ ] **Q8** — Missing-day catch-up cards: Track E scope or defer?
