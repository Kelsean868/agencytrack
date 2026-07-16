# Claude Code — kickoff: Planner & Scheduler production enhancements

Paste the block below into Claude Code inside the `Kelsean868/agencytrack` repo, with this
`planner-enhancements-handoff/` folder available.

---

```
You are ENHANCING the shipped Planner (src/components/planner/ — item 3.2), not rebuilding it.
Read planner-enhancements-handoff/README.md for the five enhancements (E1–E5); the design source of
truth is planner-enhancements-handoff/mockups/AgencyTrack Planner & Scheduler v2.html (open it —
section 10 "Feedback round" + artboards 12–13 hold the new screens).

Before writing code, read the production surface you're extending:
- src/components/planner/AgentPlannerPanel.jsx (views, churn dialog, sheet wiring, week counters,
  Daily-Capture handoff — all stays)
- src/components/planner/planner.helpers.js + recurrence.helpers.js (+ their tests)
- src/components/planner/AppointmentSheet.jsx, SeriesEditChoice.jsx, plannerPrimitives.jsx
- src/services/plannerService (getAgentWeek, createAppointment, updateAppointment,
  setAppointmentStatus, postponeWithRebook)

The five enhancements, in build order:
1. E1 — Desktop Day/3-day/Week toggle rendering side-by-side fluid (1fr) day columns; mobile
   untouched. Reuse groupByDate/sortByStartTime/buildWeekDates — no new date math.
2. E5 — collapsed-sidebar adaptation: desktop multi-column views drop the max-w-3xl cap
   (max-w-none) so columns reclaim the rail's ~168px automatically.
3. E2 — drag & drop reschedule (desktop): grip handle, teal drop targets, ghosted origin; ON DROP
   call the existing postponeWithRebook — drag is a faster path to the same mutation, never a new
   one. Series drop = "just this one" (existing scope-lock + note). Churn dialog stays as the tap /
   keyboard / mobile path.
4. E3 — running-late prompt: when an appt passes startTime+durationMin un-churned, sheet/modal with
   (a) gap-smart scope — if a large gap follows the NEXT appt, default "Next meeting only" with the
   gap named ("a 1h40m gap follows your 1:00 — the rest of today is unaffected"), else/also offer
   "Everything after this"; (b) push +10/+20/+30; (c) cascade preview old→new times, unaffected rows
   say why; (d) Call/WhatsApp per affected prospect with a prepared copy-on-tap message;
   (e) actions: Push & notify (batch updateAppointment), Keep schedule, Wrap up · mark Kept.
   Implement the scope/cascade math as a pure helper computeLateCascade() in planner.helpers.js
   with unit tests.
5. E4 — per-appointment timestamped notes thread ({at, text, during}), "THIS MEETING" tag while
   active, and notes travel with the prospect (past appts' notes for the same prospectId surface on
   the prep/booking card). Legacy note string becomes the first thread entry on read.

Rules: existing Tailwind/Nexus token classes (bg-card, border-border, text-ink, text-primary…),
light + dark; Lucide icons; ≥44px targets; useFocusTrap on every new dialog/sheet; data-testid on
new interactive elements; four-states for new async; TT timezone helpers; everything stays inside
the 'planner' tab (no router). Write tests beside the code like the existing __tests__/ do. Don't
touch TeamPlannerPanel except where E1's grid can be shared read-only.

Match the mockups' spacing/tone exactly (the .jsx in mockups/ are design reference, not production
code). Ask before adding any field or screen the spec doesn't call for.
```
