# AgencyTrack Phase 7–8 Implementation Plan

**Companion to:** `AgencyTrack_Phase7-8_PRD_Spec.md`

**Status:** Recommended build order and track structure for the Phase 7 feature set. Based on current codebase state (E6 logging mode shipped, Track B Design System v2 mostly complete) and the locked design decisions from the May 2026 conversation.

**Build cadence:** No runway pressure (pilot postponed indefinitely). Recommend depth-first quality over speed; one track at a time, each track is its own PR series.

---

## 1. Current State — What's Built, What's Partial, What's New

### Already shipped and load-bearing
- E6 logging mode infrastructure: `ProfileScreen` mode panel, `loggingModeService.js`, `dailyActivityService.js`, `dailyActivity` schema, `sundayDailyToWeekly` aggregator, daily nudge banner on `AgentDashboard`
- Awards engine (`awardsEngine.js`) consuming weekly submissions + monthly settlements with three-state badge (Confirmed / Estimated)
- Manager Master Sheet with `SubmissionViewer` drawer drill-in (single-week snapshot only)
- Tenant Admin Dashboard with Company Config tab (B5) — `annualAPI` editable; other fields scaffolded
- Goals system (3-tier: Company Floor / Manager Target / Personal Commitment) + Tier 2 unit + branch goals
- Settlements layer (`/tenants/{tid}/settlements/{agentId}_{periodKey}`) for monthly BM confirmation entry
- Persistency tracking (aggregate per-agent monthly)
- Meeting Mode with 1-on-1 coaching ratio cards

### Partial — exists but needs expansion
- Daily entry modal exists but field structure needs alignment with the 8-field-in-2-sections daily log spec
- Drill-down exists only as `SubmissionViewer` drawer — needs full agent-mirror dashboard with historic trends
- Awards engine is hardcoded with Tatil 2026 constants — needs migration to `config/awardsRuleset/{year}`

### Net-new (no existing surface)
- Per-agent work schedule with holiday/vacation overrides
- T&T public holiday calendar in tenant config
- Floating Action Button for Daily Log
- Awards parity expansion (agent + UM views matching BM detail level)
- At-risk awards view for managers
- Coaching notes (private to manager chain)
- Aggregation Cloud Function for historic trends
- Money Needs Worksheet (entire feature)
- Policy Ledger MVP (entire feature)

---

## 2. Build Tracks

Five tracks, each shippable independently. PR counts are estimates assuming the established AgencyTrack PR cadence (one feature concern per PR, lint+build gate, real-pixel smoke verification at 390×844 per the May 14 banked rule).

### Track D — Awards Expansion + Ruleset Config Migration

**Estimated:** 6–8 PRs. **Risk:** Low. **Dependencies:** None. **Unblocks:** Track H.

**Why first:** Value-add to existing surfaces with high visibility. Awards engine already exists and is well-tested. Ruleset config migration is prerequisite for Policy Ledger awards integration. Risk is low because the engine logic stays — only the source of constants changes.

PRs:
1. **D1** — Awards ruleset config schema + seed data. Create `/tenants/{tid}/config/awardsRuleset/2026` doc, seed from current hardcoded constants. Tests: schema validation, default seeding for new tenants.
2. **D2** — Refactor `awardsEngine.js` to consume ruleset config. Pure-function signature: `(submissions, settlements, persistency, ruleset) → awardProgress[]`. All existing tests should pass against seeded config.
3. **D3** — Agent Awards page parity expansion. Add distance-to-tier, persistency gate status, trend indicator, source badge per award. Mobile-friendly layout.
4. **D4** — UM Awards page (new surface). Mirror BM detail level, scoped to UM-eligible awards (Unit Recruiting/Activity/Production/Persistency, Unit of the Year).
5. **D5** — BM Awards page at-risk view (new section). "Close to achieving" / "Just achieved" / "At risk of losing" / "No longer eligible" with filters (period, award, unit). Configurable thresholds in ruleset config.
6. **D6** — Tenant Admin awards config editor UI. Form for editing thresholds, prizes, exclusions in Company Config tab. Version history sub-collection.
7. **D7** — Backfill cleanup: tag remaining hardcoded Tatil constants with `// TENANT-CONFIG-DEFERRED`, remove dead constants from `awardsEngine.js`.

### Track E — Daily Reporting Polish

**Estimated:** 5–7 PRs. **Risk:** Low–Medium. **Dependencies:** None (builds on shipped E6). **Unblocks:** none.

**Why second:** E6 infrastructure exists; this is polish for production readiness. Schedule + FAB make daily cadence feel respectful and quick. High agent satisfaction return for relatively low complexity.

PRs:
1. **E1** — T&T public holiday calendar tenant config. Schema, seeded for 2026, Tenant Admin editor in Company Config. Variable holidays (Eid, Divali) flagged for annual update.
2. **E2** — Work schedule schema + ProfileScreen section. Working days checkboxes, optional working hours, holiday-override toggles, vacation period entries. Save handlers.
3. **E3** — Auto-skip logic in nudge / streak / compliance. `isWorkingDay(date, agent, tenantConfig)` utility. Nudge banner respects skip days. Streak doesn't break on skip days. Manager dashboard shows "off" status for skip days.
4. **E4** — Daily Log form refinement to 8-field 2-section layout. Reorganize existing daily entry modal. 2-column grid on mobile.
5. **E5** — Floating Action Button component. Bottom-right, 56dp, state indicator dot. Mobile and desktop variants. Bottom sheet on mobile / modal on desktop opens the refined Daily Log.
6. **E6** — Weekly Wrap-up surface reorganization. Existing wizard pages remap to wrap-up flow. Verify-aggregated-totals surface on Steps 1-4. Don't-block-week-on-wrap-up logic.
7. **E7** — Backfill / catch-up UX. Missing-day cards on Dashboard. Past-day edit flow from History tab.

### Track F — Manager Drill-down + Coaching Notes

**Estimated:** 8–10 PRs. **Risk:** Medium. **Dependencies:** None blocking, but benefits from Track D for awards detail. **Unblocks:** none.

**Why third:** Substantial build with high manager value, but requires aggregation infrastructure (Cloud Function). Builds on Track D's awards detail richness when shipped after.

PRs:
1. **F1** — Aggregation Cloud Function scaffold. Nightly cron at TT 02:00. Computes `/tenants/{tid}/aggregates/{agentId}_{periodKey}` docs for monthly / quarterly / annual / trailing-4w/12w/26w periods.
2. **F2** — Aggregation triggers on submission write — refresh current-period aggregates immediately so drill-down dashboards aren't stale.
3. **F3** — Routing + permissions for `/manager/agent/:agentId`. Permission middleware honours UM-sees-own-unit, BM-sees-own-branch, SM-sees-everything, Tenant Admin audit-logged.
4. **F4** — Agent-mirror Dashboard tab. Read-only mirror of agent's Dashboard tab + manager overlay (outlier flags, peer comparison, "Start 1-on-1" button).
5. **F5** — Agent-mirror Career, Awards, History tabs.
6. **F6** — Historic trend visualizations. Recharts components for sparklines, line charts, vs-peer bars, vs-prior-period overlays. Reads from aggregates.
7. **F7** — Coaching Notes schema + service + Firestore rules. `/tenants/{tid}/users/{agentId}/coachingNotes/{noteId}` with visibility = manager_chain, agent excluded.
8. **F8** — Coaching Notes UI on agent-mirror Dashboard. List + filter by category + pin-to-top + add/edit modal.
9. **F9** — Drill-down for `/manager/unit/:unitId` and `/manager/branch/:branchId`. Hierarchical navigation with breadcrumb. SM gets the full tree.
10. **F10** — Manager-read audit log. `/tenants/{tid}/users/{agentId}/access_log/{logId}` writes on every drill-down read. Used for future analytics + audit.

### Track G — Money Needs Worksheet

**Estimated:** 7–9 PRs. **Risk:** Medium (PAYE engine + privacy model). **Dependencies:** None. **Unblocks:** none.

**Why fourth:** Self-contained feature. T&T-localized. High agent + manager coaching value. PAYE engine is the trickiest piece; privacy model must be exactly right because it's household financial data.

PRs:
1. **G1** — PAYE config schema + bracket math engine. `/tenants/{tid}/config/payeFormula` doc, `paye.js` engine with bracket-walk gross-from-net, comprehensive tests across bracket boundaries.
2. **G2** — Tenant Admin PAYE editor in Company Config tab. Brackets list + add/remove rows + effectiveFrom + notes + live preview ("$X net → $Y PAYE/year"). Version history subcollection.
3. **G3** — `config/budgetCategories` schema + seed from Kyron's existing T&T worksheet. Five expense groups + three sub-calculators with default line items.
4. **G4** — Money Needs schema (`/tenants/{tid}/users/{uid}/moneyNeeds/{year}`) + service layer. Annual snapshots, embedded `payeBracketsSnapshot` for historical accuracy.
5. **G5** — Money Needs UI page (Career Portal subtab). Five expense groups with collapsible sub-calculators. Frequency-to-annual conversion. Total → PAYE → Renewal Income → Commissions Required summary.
6. **G6** — Privacy model + Firestore rules. Onboarding consent modal on first creation. Persistent footer showing share state. Per-doc visibility toggle. Manager-read audit subcollection.
7. **G7** — "Send to Playground" integration. Button copies Life-portion commission target into Commission Playground.
8. **G8** — Soft validation hook on Personal Commitment save. Warning banner when commitment < calculated annual need.
9. **G9** — Hard banner UX when PAYE brackets update. "Tax brackets updated [date]. [Refresh PAYE Calculation]" on existing worksheets.

### Track H — Policy Ledger MVP

**Estimated:** 10–12 PRs. **Risk:** High (touches awards engine, persistency, manager workflows). **Dependencies:** Track D (awards ruleset config). **Unblocks:** future per-policy lapse tracking, retire settlements collection.

**Why fifth:** Biggest build. Foundational to retiring "Estimated" badges and creating the agent-vs-head-office reconciliation workflow. Requires Track D's awards ruleset config to be in place.

PRs:
1. **H1** — Policy schema + service layer. `/tenants/{tid}/policies/{policyId}` + audit history subcollection.
2. **H2** — `config/policyPlans` schema + Tenant Admin editor. Curated plans list with isActive flag, pendingReview queue, promote-to-official flow.
3. **H3** — Per-agent enablement flag (`usesPolicyLedger: boolean` on user doc). Tenant Admin / Branch Manager toggle.
4. **H4** — Agent entry form — single-policy create. 9-required + 3-optional + 1-auto + 2-conditional fields per spec 7.4. Self-or-family checkbox. Replacement → replacedPolicyAPI conditional field.
5. **H5** — Agent status-update flow per state machine. Per-transition prompt for transition-specific fields (Rated → ratedPremium, Settled → dateIssued + settledAPI, etc.).
6. **H6** — Lapsed transition handler. BM-only edit. Agent notification on lapse with deduction-from-awards explanation.
7. **H7** — Agent policy ledger list view. Filterable by status, period, product line. Click row → policy detail.
8. **H8** — Awards engine integration. Engine reads policies where `usesPolicyLedger: true`, applies credit rules from ruleset config, computes `creditableApps` and `creditableAPI`. Falls back to existing settlements + submissions path for other agents.
9. **H9** — Three-state badge update across awards surfaces. Confirmed / Agent-tracked / Estimated based on data source.
10. **H10** — Manager Reconciliation UI. BM workflow for reviewing pending-review policies for the period, side-by-side agent entry vs head-office circular fields, bulk-confirm mode. Discrepancy detection logic.
11. **H11** — Discrepancy notification flow. Agent receives "manager revised your entry" message with deltas. Manager-side discrepancy queue surface.
12. **H12** — A&H handling — `countsTowardCompanyMetrics` flag on tenant productLines config. Engine filters; visual cue ("Does not count toward Tatil Life awards") at agent surfaces.

---

## 3. Track Dependencies

```
Track D (Awards Expansion + Ruleset Config) ──┐
                                              ↓
                                      Track H (Policy Ledger MVP)
                                              
Track E (Daily Reporting Polish)  ── independent
Track F (Manager Drill-down)      ── independent (benefits from D)
Track G (Money Needs Worksheet)   ── independent
```

**Hard dependency:** Track H requires Track D's awards ruleset config to exist (`config/awardsRuleset/{year}`) before H8 ships. If running tracks in parallel, D1–D2 must complete before H8.

**Soft dependency:** Track F (drill-down) gains value when Track D ships first — at-risk view feeds the drill-down dashboard's award-progress detail.

**No coupling:** Tracks E and G are independent of everything and can ship in any order.

---

## 4. Recommended Sequence

Two viable sequencing options. Both finish in roughly the same calendar time; difference is risk profile and value delivery cadence.

### Option A — Maximum value-per-week (recommended)

```
Month 1:    Track D (Awards Expansion)              ── high visibility, low risk, unblocks H
Month 2:    Track E (Daily Reporting Polish)        ── high agent satisfaction, low risk
Month 3-4:  Track G (Money Needs Worksheet)         ── self-contained, valuable, doesn't block
Month 4-5:  Track F (Manager Drill-down)            ── substantial, can incorporate D's at-risk view
Month 6-7:  Track H (Policy Ledger MVP)             ── biggest build, foundational; D is now mature
Month 8+:   Phase 8 small items (Opportunity Grid, Self-Improvement, Long-Range Plan)
```

**Rationale:**
- Track D first because it's value-add to existing surfaces, low risk, and unblocks H.
- Track E second because it's polish with high agent satisfaction return and zero dependencies.
- Track G before F because it's self-contained and finishes a complete agent-facing feature before pivoting to manager-facing.
- Track F before H because drill-down infrastructure (aggregation Cloud Function) is valuable regardless of policy ledger adoption.
- Track H last because it's the biggest, riskiest build and benefits from having mature awards config (D) and drill-down infrastructure (F) in place.

### Option B — Highest-priority manager value first

If manager feedback is loud about drill-down specifically, swap F earlier:

```
Month 1:    Track D (Awards Expansion)
Month 2:    Track E (Daily Reporting Polish)
Month 3-4:  Track F (Manager Drill-down)            ← swapped earlier
Month 4-5:  Track G (Money Needs Worksheet)
Month 6-7:  Track H (Policy Ledger MVP)
```

Trade-off: Track F's aggregation Cloud Function and trend visualizations are substantial work to land in month 3-4. Schedule risk is higher.

### Strong recommendation: Option A.

The ordering balances quick wins, risk distribution, and dependency satisfaction. Manager value still arrives by month 4 (drill-down), and Policy Ledger — the biggest architectural change — ships on a mature base.

---

## 5. Risk Analysis

| Track | Risk Level | Primary Risks | Mitigation |
|---|---|---|---|
| D | Low | Awards engine regression during ruleset migration | Refactor in D2 keeps all existing test cases green against seeded config; gate behind feature flag if needed |
| E | Low–Medium | T&T holiday data accuracy (variable dates) | Tenant Admin annual update flow; banner reminders for Q4 each year |
| F | Medium | Aggregation accuracy + drift; query performance at scale | Versioned aggregates with `aggregatedAt`; spot-check rebuild script for verification; monthly aggregate refresh job |
| G | Medium | PAYE bracket math correctness; privacy model leaks | Comprehensive bracket-boundary test suite; audit-logged manager reads with rate-limit alarms; security review before shipping |
| H | High | Awards engine source-of-truth confusion (ledger vs settlements); migration data integrity | Per-agent enablement flag; settlements coexist for full pilot; data quality dashboard for Tenant Admin; rollback plan if confidence drops |

---

## 6. Cross-Track Concerns

A few things that span multiple tracks and should be settled in coordination:

### 6.1 Tenant Admin Config Surface

Tracks D, E, G all add to Tenant Admin Company Config tab:
- Track D: awards ruleset editor (per year)
- Track E: holiday calendar editor (per year)
- Track G: PAYE bracket editor + budget categories

Recommend consistency in the UI pattern: each config doc gets a tile in Company Config, opens a dedicated modal/page with edit form + version history. Reuse the `EditConfigModal` pattern from B5.

### 6.2 Notification System

Tracks D, F, G, H all generate agent-facing notifications:
- Track D: "You qualified for [Award]" / "You're 5 apps from Centurion" (at-risk view triggers)
- Track F: not agent-facing (manager-only surfaces)
- Track G: PAYE brackets updated banner
- Track H: "Your policy X was lapsed" / "Your entry for policy Y was revised by [Manager]"

Existing notification system (`/tenants/{tid}/notifications/{notificationId}`) handles these. No new infrastructure needed.

### 6.3 Audit Logging

Tracks F, G, H all introduce audit trails:
- Track F: drill-down read logs on agent docs
- Track G: manager-read logs on `moneyNeeds/{year}`
- Track H: per-policy edit history subcollection

Standardize the schema: `{ readerUid, readerRole, readerName, action, target, timestamp, note? }`. Reusable utility writes audit entries.

### 6.4 Aggregation Pipeline

Track F introduces nightly aggregation. Tracks D's at-risk view and H's awards engine could also benefit from aggregated data instead of live computation. Consider whether the aggregator should be extended to materialize award-progress snapshots too — would simplify the at-risk view (just diff against the prior snapshot).

Decision: defer that decision to F's design pass. For now, at-risk view computes live from the awards engine since per-tenant agent counts are small (Tatil pilot is single-branch).

---

## 7. Per-PR Process Notes

These already exist in CLAUDE.md but worth restating in context:

- One feature concern per PR. Single-branch rule (one branch per PR, never reuse).
- Lint + build gate on every PR to main; verify Vercel preview in incognito before merging.
- Real-pixel smoke verification at 390×844 (mobile) for any UI work.
- Production smoke autonomously via `setupBypassSession` for every PR; waiver only for clearly non-user-visible changes with justification.
- Post-merge sequence: sync main, capture squash SHA, fill `docs/CONTEXT.md` recently-shipped row + `docs/FOLLOW_UPS.md` mark-resolved, commit + push direct to main.
- Source-verify at brief authoring (Rule 17): pair grep with `git ls-files` for tracked-status before claims.
- Brief commits to `docs/briefs/` before CC dispatch for every PR regardless of size; filename pattern `pr-X-topic-kickoff.md` or `fu-topic-kickoff.md`.

---

## 8. Phase 8 and Beyond

Not part of this plan but on the horizon:

- **Phase 8 small items** (Opportunity Grid, Quarterly Self-Improvement, Long-Range 3-Year Plan) — design pass each, then 2-3 PRs to ship
- **Settlements collection retirement** — depends on Track H reaching universal `usesPolicyLedger: true` adoption
- **Per-policy lapse tracking** — extension of Track H once primary lifecycle is stable
- **Awards ruleset version history UI** — currently shipped as data-only; UI for browsing past versions when needed
- **Full multi-product support** across Wizard / Master Sheet / Persistency / Awards Engine — currently Life-only outside Money Needs
- **Tenant Admin full config UI** — extension of B5 work to cover every config doc, plan retired plan promotion flow, etc.

---

## 9. Open Questions Not Yet Settled

Five items that need decisions before their respective tracks start design work in detail:

1. **Track D** — How are at-risk thresholds defined? Single percentage (80% of any threshold), per-award configurable (Centurion at 80 apps differs from API at 80%), or per-tenant configurable? Lean per-award configurable, settable in awards ruleset config.
2. **Track E** — Daily nudge time per agent or per tenant? E6's existing `dailyNudgeTime` looks per-agent. Confirm before E2.
3. **Track F** — Coaching notes: are concern-category notes flagged or counted in any manager-overview dashboard? Or strictly individual-agent context?
4. **Track G** — Default `config/budgetCategories` content needs translation of Kyron's Excel rows into JSON. Straightforward conversion task, but who owns the line-item naming? (Spec says "Other" custom items capped at 5 per group, but the cap is proposed not locked.)
5. **Track H** — Does `agentType: 'agent' | 'bdo' | 'dso'` already exist on user docs, or does it need to be added? Awards eligibility depends on it. Quick check before H schema work.

Each is small enough that a single back-and-forth in the design session for that track resolves it.

---

## 10. Summary

Five tracks, recommended order **D → E → G → F → H**, total ~36–46 PRs across the Phase 7 feature set. No tracks block pilot launch (pilot is postponed indefinitely). Each track is independently shippable; if priorities shift mid-stream, swap the next track in without breaking what's shipped.

The biggest architectural lift is Track H (Policy Ledger MVP). The biggest UX lift is Track F (drill-down + coaching notes). The biggest agent-satisfaction lift is Track E (daily polish + FAB). The biggest manager-coaching lift is Track G (Money Needs) and Track D (at-risk view). The biggest unblock-for-the-future is Track D (awards ruleset config — the foundation that makes the whole system more portable to a second carrier).

Ship one at a time, ship cleanly, no scope creep within a track.

---

*Document generated May 19, 2026 from the design conversation and codebase state survey. Update as tracks ship.*
