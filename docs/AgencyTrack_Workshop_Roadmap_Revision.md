# AgencyTrack — Workshop-Driven Roadmap Revision

**Status:** Roadmap addendum. Extends `docs/phase7-8-PRD.md` and `docs/phase7-8-implementation.md` with findings from the Tatil Life manager workshop of 2026-05-19. Does **not** supersede them — it adds one new track (I), extends Track F, locks a Track H schema decision, adds two small items, and re-sequences for a live commercial opportunity.

**Provenance:** On 2026-05-19, Kyron attended a Tatil Life manager workshop where an external vendor (SCG / ApplyOn) demoed a competing activity-tracking + CRM tool. The managers (Felix Mahadeo, Amery Rauseo, Kendall Lowhar, Gia Rauseo-Suite, Victoria Walcott, Cyril Murray, Mikel Granderson, Keith Charles, Bryan Pedro, Garvis Ryan, Delano Rauseo) spent ~2h15m articulating exactly what they want from a tool like this. Transcript + screenshots analysed 2026-05-20.

**Positioning:** Kyron holds an insider seat (branch decision-maker). Strategy is to *quietly become the obvious choice*, not to win a side-by-side bake-off. Build priority therefore optimises for what managers personally feel and what makes AgencyTrack indispensable — not demo parity.

---

## 0. Scope Guardrail (read first)

AgencyTrack tracks **activity, production, and coaching** — it is **not** a relational client/prospect database.

Two deliberate, bounded exceptions are introduced by this revision:
- a **prospect-source enum** on the policy ledger (attribution, not a contact record), and
- an **appointment-bound prospect-info form** attached to a specific joint call (not a prospect pipeline).

Tatil has **no company CRM** of its own (Kyron's Zoho is personal). This is both an opportunity (no incumbent competing with AgencyTrack's layer) and a risk (constant pull to become a full CRM — the exact over-scope that ended the first attempt). When a future ask pushes past the guardrail, that is an explicit scope conversation, not a drift.

**Forward note:** a CRM that *tightly integrates* with AgencyTrack is on the long-range horizon. Until that is a funded, scoped piece of work, this product skirts the line between a CRM and a reporting tool and stays on the reporting/coaching side of it.

---

## 1. Why this matters — what the workshop confirmed

The managers' mental model is AgencyTrack's model, not the vendor's. The vendor demoed a lead/CRM funnel; the managers repeatedly pulled them back to "show me the agent's WAR, objective vs actual, variance, and the manager roll-up." That is what AgencyTrack already ships. The vendor was at "mocked up, not implemented"; AgencyTrack is at P8E + Track A complete with the agent WAR, Master Sheet, Meeting Mode, goals, gamification, and a PWA live.

The single most reusable output of the meeting: the managers negotiated and **agreed company minimum weekly activity standards** (see Appendix A), which map directly onto AgencyTrack's Company Floor layer.

---

## 2. Coverage map — workshop ask vs. current plan

| Workshop ask | Where it lands | Status |
|---|---|---|
| Agent WAR (activity → sales, objective/achieved/variance) | Shipped wizard + Master Sheet; Track E refines cadence | Covered |
| Three-tier minimums (company floor / branch standard / actual) | Shipped Goals system (3-tier) | Covered — needs weekly-activity-floor extension + seed (see §3.5) |
| Mobile, real-time entry | Shipped E6 daily logging + Track E FAB | Covered |
| Roll-up agent → manager → head of sales | Master Sheet + Track F drill-down | Covered |
| Record of Written & Paid ("Looking Ahead" ledger) | Track H — Policy Ledger MVP | Covered — column decision locked (§3.3) |
| Manager coaching into an agent | Track F — Coaching Notes (manager-chain private) | Infra + privacy model covered |
| Joint-call **observation form** (kept, type, coaching minutes, training identified, sale Y/N) | Track F **extension** (§3.2) | New — extend Track F |
| Joint-call **prospect-info form** | Track F **extension** (§3.2) | New — in AgencyTrack, appointment-bound |
| **Manager's own WAR** (their time: planning/training/1-on-1/joint work/recruiting/supervision, objective/achieved/variance) | **Track I** (§3.1) | New — own track |
| **Recruitment activity** tracking | Folded into Track I (§3.1) | New |
| Social / content KPIs (videos, engagement, names from social) | Track E sub-item (§3.4) | New — small |
| Personal Growth / CPD log (reading, courses, license exams) | Career Portal / Phase 8 (§3.4) | New — small |
| Simplified "Expected / Actual" wording | Quick win (§3.5) | Trivial copy change |

~70% is already planned or shipped. The contract-deciding net-new is Track I plus the Track F extension.

---

## 3. New & changed scope

### 3.1 Track I — Manager Activity Reporting (NEW)

**Intent:** Managers log and report on their own *management* activity, the way agents log selling activity. This is distinct from (a) managers logging their own *sales* (Track E FAB on "My Production"), and (b) managers' own *awards* (Track D). It is the manager's Weekly Unit Planner / Manager WAR from the workshop (Image 9 + the 48:00–52:00 discussion).

**Why a separate track:** it is a parallel surface to the agent wizard — same architecture (wizard + submission service + Master-Sheet roll-up + Meeting Mode), different field set. Bolting it onto Track F (which is *viewing agents*) would muddy both.

**Activity categories (time-based: objective / achieved / variance per week):**
planning, training, one-on-one, joint work (field), recruiting, selection, selling assistance, personal services, personal development, admin, meetings. Recruitment activity (recruits sourced, selection interviews, recruits selected) is a first-class section here, complementing the recruiting *awards* in Track D.

**Roll-up:** UM activity rolls to BM; BM to Sales Manager / head of sales. Reuses the Master Sheet + period-aggregation patterns (weekly / monthly / quarterly / semi-annual / annual).

**Reuse:** wizard/submission/extractFields/Master-Sheet/Meeting-Mode primitives already exist. This is volume, not novelty.

**Design pass needed before build** (open items): exact category list lock with managers; whether manager WAR uses the same weekly cadence + wrap-up model as Track E; how manager-WAR objective targets are set (company default vs self-set).

### 3.1a Track J — Tenure & Level API Minimums (NEW)

**Source:** head-of-sales slide (2026-05-19), reconciled against board-signed `Sales_Career.pdf`.

**Resolved:** career-level API requirements are authoritative in `Sales_Career.pdf` (L1–6 = 200/250/350/450/600/800K; L7 = Chairman's choice). The app already matches these — no change. The head-of-sales slide's career numbers (300/300/500/700) are a divergent draft and are disregarded.

**J1 (PR #240, `4134d2c`):** tenure-based Company Floor (150K–500K by months of service, from `contractStartDate`) replacing the flat 200K; per-agent weekly API floor = tenure annual ÷ 10 ÷ 4. Stored as tenant-admin-editable config at `config/companyMinimums.tenureApiFloors`, seeded from the slide via `scripts/seed/seed-tenure-api-floors.mjs`, **flagged provisional pending head-of-sales confirmation** (`tenureApiFloorsProvisional: true`). Bands per the brief table:

| Months of service | Annual API floor (TTD) |
|---|---|
| < 12 (0–11) | 150,000 |
| 12–24 | 200,000 |
| 25–36 | 250,000 |
| 37–48 | 300,000 |
| 49–60 | 400,000 |
| > 60 | 500,000 |

Missing/invalid `contractStartDate` → flat 200,000 / 4,800 fallback.

**J2 (follow-up):** career-level qualification on a trailing 2-year average of annual API (the doc's stated basis), feeding the Career Portal.

**J3 (→ Track I):** manager levels 8–10 production model (personal + per-advisor + unit, tenure-scaled recruitment/performance schedules).

**Open action:** confirm the tenure numbers with the head of sales; surface the slide-vs-doc career-level discrepancy to him.

### 3.2 Track F extension — Structured Joint-Call Log + Prospect-Info form

Track F already specs Coaching Notes (free-text, categorised, manager-chain private, agent never sees) with the right privacy model, agent-doc subcollection, and audit trail. Extend it with two **structured** companions under the same privacy + audit model:

**(a) Field Joint-Call Observation Log** — `/tenants/{tid}/users/{agentId}/jointCalls/{callId}` (manager-chain visibility, agent excluded — same rule as coachingNotes):
- appointment date/time, agent, branch/unit (auto)
- appointment kept (Y/N); if rescheduled → next meeting date
- meeting type enum: `demonstration` / `observation` / `collaboration`
- **need covered** enum (routed here from Track H per §3.3)
- comments (free text)
- sale made (Y/N)
- coaching time spent after (minutes)
- training identified (free text + optional tag set)
- on submit → notification to branch manager (existing notification system) + surfaced on the agent-mirror dashboard and a manager joint-call summary

**(b) Prospect-Info form** (appointment-bound — **not** a prospect pipeline) — captured for a specific joint call so the manager arrives informed:
- client name, age, occupation
- prospecting activity type enum: `seminar` / `booth-event` / `referral` / `cold-call` / `social-media` / `orphan` / `existing-client` / `family-friend` / `BOA` / `self` / `other`
- appointment type: `2nd interview` / `closing interview`
- objections enum: `no-money` / `no-need` / `no-hurry` / `no-confidence`
- policy type discussed/sold

Keep Coaching Notes (free-text) **and** these two structured forms — they serve different jobs.

**Scope note (guardrail):** the prospect-info form lives in AgencyTrack by decision, bounded to the joint-call appointment. It does not become a standing prospect list or disposition tracker (those remain out of scope / future CRM).

### 3.3 Track H — column decision (LOCKED)

Track H stays a production + lifecycle + attribution ledger. Pull in the four fields managers actively use; keep everything structured so it cannot drift into a contact database.

**Pull into the policy schema:**
- **Source of Prospect** — enum (reuse the §3.2 prospecting-activity taxonomy). Ties the ledger to social/content KPIs and the prospect-info form. Enum, not free text.
- **Cash with Application** — boolean + optional amount. The company's own definition of a sale is "first premium collected"; also an early-lapse signal.
- **Date Placed** — map to the existing `dateIssued` / Settled milestone. Do not add a duplicate field.
- **Policy Delivery Date** — one milestone date on/after the Settled state (a persistency/quality checkpoint). Not full service-form tracking, which stays out of scope.

**Hold out of Track H:**
- Occupation, Annual Income — demographic; these are Money-Needs inputs / future client-record concerns.
- Date First Met, Interview-on-which-closed, AM/PM — sales-cycle granularity, low decision value vs. entry cost.
- **Need Covered** — route to the §3.2 Joint-Call Observation Log as an enum (it is a coaching signal, not a production field).

PRD §9 (out-of-scope) and §7.4 (schema) update accordingly at Track H design time.

### 3.4 Small additions

- **Social / content KPIs** — add an optional content section to the Track E daily-log / wizard: content pieces produced (e.g. videos), engagement (likes/comments), inbox enquiries, names-from-social (the latter already exists as a New-Names source). Surface a simple content KPI for agents and a roll-up for managers. Fits Track E; do not let it expand into a social-media management tool.
- **Personal Growth / CPD log** — structured log: reading (title / author / start / end / notes), audio-visual, courses, license exams, CPD/MDRT. Folds into the Career Portal, or pairs with the Phase-8 "Quarterly Self-Improvement" item. Low risk, bounded.

### 3.5 Quick wins (ship first)

- **Seed agreed company minimums.** Requires a small schema extension: the current `config/companyMinimums` holds annual API/apps/persistency only; add a `weeklyActivityFloors` block (the 10 activities in Appendix A) plus a Tenant-Admin surface in Company Config (B5 pattern). Then seed Appendix A. Branch managers can raise per agent, never below the floor (matches the 3-tier model exactly).
- **Relabel "Expected / Actual."** Cyril and Garvis asked for plain wording on every page — "Expected" (the standard, never changes) and "Actual" (what's logged) — instead of Objective/Achieved/Variance jargon. Copy/label change on dashboard + Master Sheet.

---

## 4. Revised sequence (insider-seat strategy)

The original `phase7-8-implementation.md` order (D → E → G → F → H) optimises for risk/dependencies under "pilot postponed, no runway pressure." That assumption no longer holds — there is a live opening with named decision-makers. Re-sequence to front-load what the managers were emotional about:

1. **Quick wins** (§3.5) — days, not weeks. Seed minimums + Expected/Actual relabel. Cheapest "they listened to us" signal.
2. **Track F — pulled forward, led by drill-down + the §3.2 structured Joint-Call Log + Prospect-Info form.** Hands managers "see my agents + log my field observations" — the thing they begged for and the vendor failed to deliver.
3. **Track I — Manager Activity Reporting** (§3.1). The headline "we go beyond the agent layer" feature.
4. **Track D — Awards Expansion + Ruleset Config** and **Track E — Daily Reporting Polish** (plus §3.4 social KPIs as a Track E sub-item). Valuable, lower contract-urgency. (Track D still unblocks Track H.)
5. **Track H — Policy Ledger MVP** with the §3.3 column decision; reconcile its schema against the managers' Record of Written & Paid sheet during design.
6. **Track G — Money Needs Worksheet** and §3.4 Personal Growth / CPD log. Strong agent tools; not a workshop ask.

Dependency note unchanged: Track H's awards integration (H8) still requires Track D's ruleset config (D1–D2) to exist first.

---

## 5. Decisions resolved (this revision)

- **Manager WAR** → new Track I (not bolted onto Track F).
- **Prospect-info form** → built in AgencyTrack, appointment-bound (Tatil has no company CRM; the option to "push to Zoho" never applied to the company).
- **Track H columns** → pull in Source of Prospect, Cash with Application, Date Placed, Policy Delivery Date; hold out demographics; route Need Covered to the Joint-Call Log (§3.3).
- **CRM stance** → skirt the CRM/reporting line, staying on the reporting/coaching side, behind the §0 guardrail. A tightly-integrated CRM is a future, separately-scoped piece of work.

---

## 6. Risks

- **CRM scope creep** (high likelihood, high impact) — the no-company-CRM vacuum will keep pulling AgencyTrack toward a full CRM. Mitigation: §0 guardrail; treat each line-crossing ask as an explicit scope decision.
- **Manager data-entry burden** (the managers' own #1 adoption concern) — every new field fights buy-in. Mitigation: keep Track I and the joint-call forms short, mobile, enum-driven; lead the pitch with least-entry-for-most-report.
- **Track H ≠ managers' sheet exactly** — reconcile columns at design time (§3.3 already starts this).
- **Plan predated the meeting by a day** — this addendum is the reconciliation; keep `phase7-8-*.md` and this doc in step as tracks ship.

---

## Appendix A — Agreed company weekly minimums (Tatil, 2026-05-19 workshop)

Company floor (branch/agent may raise, never lower). Subject to a 6-month review (managers flagged this explicitly).

| # | Activity | Company minimum (weekly) |
|---|---|---|
| 1 | Calls Made | 60 |
| 2 | Contacts Made | 40 |
| 3 | Appointments Scheduled | 20 |
| 4 | Interviews Kept | 15 |
| 5 | Fact Finds Completed | 10 |
| 6 | Closing Interviews Kept | 10 |
| 7 | Applications Submitted | 1 |
| 8 | Clients Sold | 1 |
| 9 | API (TTD) | 4,800 |
| 10 | Referrals / New Leads | 100 |

Definitions agreed in-meeting: a **call** = a dial attempt (successful or not); a **contact** = the person answered / a conversation occurred; an **appointment scheduled** = an appointment secured. These align with AgencyTrack's existing wizard field definitions.

---

*Document generated 2026-05-20 from the 2026-05-19 workshop transcript + screenshots. Living document — update as Track I / Track F-ext / Track H design passes lock detail.*
