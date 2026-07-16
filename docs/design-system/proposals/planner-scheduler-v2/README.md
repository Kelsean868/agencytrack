# Planner & Scheduler — production enhancement handoff

> The Planner **shipped** (item 3.2): `src/components/planner/` — `AgentPlannerPanel.jsx` (Today / Week / Follow-ups, book/edit `AppointmentSheet` with recurrence, churn dialog Kept·Edit·Reschedule·Postpone·Cancel, series scope-choice, week counters vs `weeklyActivityFloors`, end-of-day `onCarryToDaily` seed into DailyCaptureV2), `planner.helpers.js`, `recurrence.helpers.js`, `plannerPrimitives.jsx`, manager `TeamPlannerPanel.jsx`, all with tests. **Do not rebuild any of that.** This package adds the five user-feedback enhancements that are NOT in production.

## The five enhancements (design: `mockups/AgencyTrack Planner & Scheduler v2.html`, section 10 "Feedback round" + artboards 12–13)

### E1 · Desktop 3-day + week views (view toggle)
Production renders ONE `max-w-3xl` column regardless of viewport. Add a **Day / 3 days / Week** toggle (desktop only) that renders **side-by-side day columns** — 3-day: `grid-cols-3` roomy cards; week: `grid-cols-7` compact chips. Columns are **fluid (`1fr`), never fixed-width**. Reuse `groupByDate` / `sortByStartTime` / `buildWeekDates` from `planner.helpers.js` — no new date math. Mobile keeps the current views untouched. (Artboards 12–13, F1–F2.)

### E2 · Drag & drop rescheduling
Grip dots on each appointment card (desktop). Drag within a day = change time; across day columns = change day. Drop targets: gap slots + day columns highlight teal; origin card ghosts (dashed, 35% opacity); the dragged card lifts (shadow + slight tilt). **On drop, call the EXISTING `postponeWithRebook(tenantId, apptId, newData, meta)`** — drag is a faster path to the same reschedule, not a new mutation. Keep the churn dialog as the tap path (and the only mobile path). Series instances: drop = "just this one moves" (same scope-lock as postpone; show the existing series note). Keyboard alternative required (churn dialog covers it). (F1–F2.)

### E3 · Running-late cascade (gap-smart)
When a non-retired appointment passes `startTime + durationMin` un-churned (client tick, TT timezone via `getTodayTT` conventions), surface a **"Running late"** prompt — mobile bottom sheet / desktop modal:
- **What moves** (the smart part): compute the gap after the NEXT appointment. If the gap ≥ the push amount, default-select **"Next meeting only — a 1h40m gap follows your 1:00 — the rest of today is unaffected"**; alternative radio **"Everything after this"** cascades the day.
- **Push by** +10 / +20 / +30 min.
- **Cascade preview**: each affected appt shows `1:00 → 1:20` (struck-through old time); unaffected rows show "not affected — outside the push".
- **Notify**: Call / WhatsApp buttons per affected prospect with a prepared copy-on-tap message ("running ~20 min behind, still good for 1:20?").
- Actions: primary **"Push back +N & notify"** (batch `updateAppointment` time shifts); **Keep schedule**; **Wrap up · mark Kept** (existing `setAppointmentStatus`).
(F3–F6.)

### E4 · Meeting notes (per-appointment thread)
Production has a single `note` string set at booking. Add a **timestamped notes thread** per appointment: `appointments/{id}/notes[]` `{at, text, during}` (or a subcollection) — add-note field, "THIS MEETING" tag for notes taken while the appt is active, and **notes travel with the prospect**: past appointments' notes for the same `prospectId` surface on the prep card / booking sheet. Keep the legacy `note` as the first thread entry on migrate-read. (F7–F10.)

### E5 · Collapsed-menu space adaptation
When the sidebar collapses to the 64px icon rail, the planner's content must **reclaim the ~168px**: day columns widen (they're `1fr` so this is automatic IF the panel drops its `max-w-3xl` cap on desktop views), and the day-strip shows more cells. Rule: desktop multi-column views get `max-w-none`; only the single-column mobile views keep the readable-width cap. (F11–F12.)

## Build order & wiring
1. **E1** first (the desktop grid is the canvas the rest lands on) — new `PlannerViewToggle` + desktop grid renderers inside `AgentPlannerPanel` (or a sibling `PlannerDesktopBoard.jsx` it mounts at `lg:`+).
2. **E5** with it (drop the width cap for multi-column views).
3. **E2** drag (HTML5 DnD or pointer events; wire to `postponeWithRebook`; per-day gap slots derived from `durationMin` holes).
4. **E3** running-late (pure helper `computeLateCascade(appts, now, pushMin, scope)` in `planner.helpers.js` + sheet/modal component; unit-test the gap logic like `deriveFollowups` is tested).
5. **E4** notes (schema + thread UI + prep-card surfacing).

## Conventions (unchanged)
Nexus tokens via Tailwind classes already in use (`bg-card`, `border-border`, `text-ink`, `text-primary`, `bg-primary/10`…), light + dark. Lucide icons. ≥44px targets, `useFocusTrap` on every new dialog/sheet, `data-testid` on new interactive elements, tests beside the code (`__tests__/`). Four-states (loading / error / empty / live) for any new async surface. TT timezone helpers (`getTodayTT`). No routers — everything stays inside the `'planner'` tab.

## Package contents
- `README.md` — this brief
- `CLAUDE_CODE_PROMPT.md` — paste-ready kickoff
- `mockups/AgencyTrack Planner & Scheduler v2.html` — the full design board (open in a browser; section 10 = the five enhancements; artboards 12–13 = 3-day view; F11–F12 = collapsed-rail adaptation)
- `mockups/planner-*.jsx` + `app-*.jsx` + `design-canvas.jsx` — the board's modules (design reference, not production code)
