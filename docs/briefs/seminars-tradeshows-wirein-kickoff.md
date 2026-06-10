# Brief — Wire seminar & tradeshow counts into prospecting activity (+ collapse section to 4 fields)

**Suggested branch:** `feat/seminars-tradeshows-wirein`
**Size:** M (may reach L depending on how many display surfaces Phase 1 finds)
**Type:** Frontend feature + small schema trim. Expected: no rules/CF/index change — Phase 1 confirms. Human-merged.

---

## Context

Recon (read-only, prior session) found this wizard section carries **8 fields** and only the names-yield half does any work:

- `seminarsConducted`, `seminarsAttended`, `tradeshowsConducted`, `tradeshowsAttended` — **orphaned**: extracted in `extractFields.js` for schema completeness, then never read into any KPI, award, leaderboard, manager view, PDF, or chart.
- `namesFromSeminarsConducted`, `namesFromSeminarsAttended`, `namesFromTradeshowsConducted`, `namesFromTradeshowsAttended` — **load-bearing**: all four flatten into `computeTotalNewNames()` at `extractFields.js:148–160` with equal weight (feeds the prospecting-floor check only).
- Stored verbatim via `submissionService.js:40–47`.

Product decision: adopt the realistic-verb model — agents **conduct** seminars and **attend** tradeshows — collapsing the 2×2 to four fields, and **wire the two surviving counts into prospecting-activity tracking** so they appear alongside calls / face-to-face / letters, matching the paper spec's PROSPECTING EFFORTS page (which lists "New seminars conducted" as a prospecting effort). The current orphaning is treated as an implementation gap, not intent.

---

## Target state

**Keep (4 fields):** `seminarsConducted`, `namesFromSeminarsConducted`, `tradeshowsAttended`, `namesFromTradeshowsAttended`
**Drop (4 fields):** `seminarsAttended`, `namesFromSeminarsAttended`, `tradeshowsConducted`, `namesFromTradeshowsConducted`

1. Section collapses to the four kept fields with clean labels.
2. `seminarsConducted` + `tradeshowsAttended` feed the prospecting-activity **display** surfaces (and a prospecting-efforts total, if one exists), mirroring how the existing prospecting activities are aggregated and shown — no bespoke treatment.

---

## Hard boundary — scope guard (read before building)

- This brief is **activity-tracking / display only.**
- **Do NOT** wire the two counts into gamification points, leaderboard scoring, awards eligibility, or any new activity floor.
- **If Phase 1 finds the existing prospecting activities (calls/F2F/letters) feed points, leaderboard, awards, or a floor check** — STOP and report. Extending scoring to seminars/tradeshows is a separate decision (it's coupled to the pending points-weights review), not this brief. Wire display only; flag the scoring path for a ruling.

---

## Phase 1 — recon (HARD STOP — paste findings back before Phase 2)

Confirm/extend the prior recon. Report each with `file:line`:

1. **Prospecting-activity pipeline.** Where are `newTelephoneCalls` / `newF2FAttempts` / letters-emails-sent (and `seminarsConducted` per spec) (a) summed into any total or derived metric, and (b) displayed? Enumerate **every** surface — `useAgentMetrics.js`, dashboard cards, `MasterSheet.jsx` COLS, `AgentReportDocument.jsx` (PDF), `MeetingMode.jsx`, `CompliancePanel.jsx`, any manager view.
2. **Scoring/floor check (boundary trip).** Does that pipeline feed gamification points, `leaderboardAggregate`, `awardsEngine.js`, or `weeklyActivityFloors.js` — or is it display + the `totalNewNames` floor only? Answer explicitly; this decides whether the hard boundary trips.
3. **Collapse edit points.** Exact sites: `StepSeminarsTradeshows.jsx` field set; the `computeTotalNewNames` terms at `extractFields.js:148–160`; the write mapping at `submissionService.js:40–47`.
4. **Dependency confirm.** Verify frontend + existing Firestore reads only — no rules/CF/index change.

---

## Phase 2 — collapse to four fields

1. `StepSeminarsTradeshows.jsx` — render only the four kept fields. Labels: "Seminars conducted", "New names from seminars", "Tradeshows attended", "New names from tradeshows".
2. `extractFields.js` `computeTotalNewNames` — keep `namesFromSeminarsConducted` + `namesFromTradeshowsAttended`; remove the two dropped terms.
3. `submissionService.js` — write the four kept fields; drop the four removed from the write mapping.

---

## Phase 3 — wire the two counts into prospecting activity

1. At **every** surface Phase 1 enumerated for calls/F2F/letters, add `seminarsConducted` + `tradeshowsAttended`, mirroring the existing pattern exactly (same total inclusion, same card/row/column treatment). Match the established pattern — do not invent a new component or layout.
2. If a prospecting-efforts total exists, include the two counts in it (intended: managers will see that total rise).
3. `AgentReportDocument.jsx` — if these join the PDF, follow its hardcoded-hex convention (no CSS vars; react-pdf can't resolve them).

---

## Phase 4 — docs (with placeholders)

1. Note the 8→4 collapse and the two new prospecting-activity members in the relevant doc (and CLAUDE.md only if a domain invariant changes — likely not).
2. Record the Phase 1 finding on scoring/floor coupling for the future points-weights work.
3. SHA placeholders to be filled at Phase 5.

---

## Phase 5 — commit / push / PR

1. Commit on `feat/seminars-tradeshows-wirein`, push, open PR.
2. Name the feature-branch HEAD SHA in the report; no silent post-report pushes (Rule 20).
3. Poll for the Gemini bot review and disposition every comment before reporting (Rule 21).

---

## Smoke (Phase 5 — never authorization-gated)

- Production smoke via `setupBypassSession`, **write-read-verify**: log in (smoke agent), write a submission with `seminarsConducted = N` and `tradeshowsAttended = M` plus names values → reload → assert (a) both counts render on the prospecting-activity surface(s), and (b) `totalNewNames` computes correctly from the two kept names fields.
- Frontend + existing reads → not rules/CF/index-gated, so a preview/prod smoke is fine pre-merge. If Phase 1 surfaces any server-side aggregation, that portion becomes post-merge-and-deploy.

---

## Out of scope / banked

- Gamification points and the points-weights decision (separate; gated).
- Renaming the verbose keys (`namesFromSeminarsConducted` → `namesFromSeminars`) — optional later tidy; keep keys as-is to avoid churn.
- Branch-scoped manager views and other banked FUs.

## Timing

Pre-pilot, no real submissions yet — the field collapse is migration-free right now. After agents log weeks of data it would not be.
