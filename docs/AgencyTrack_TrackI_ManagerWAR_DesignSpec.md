# AgencyTrack — Track I: Manager Activity Reporting (Manager WAR)
### Design Spec

**Status:** Design — decisions locked, not yet built
**Currency:** TTD
**Source inputs:** Tatil manager workshop (2026-05-19) + head-of-sales clarifications + Caribbean management-roles research
**Depends on (already locked):** Track F joint-call / prospect-info forms · Track H policy ledger · Goals System target cascade
**Cadence convention:** Sunday-to-Sunday week, mirroring the agent Weekly Wizard (week-start = Sunday, validated; `parseFloat()` on all numerics; auto-save per step)

---

## 1. Locked decisions

| # | Decision | Detail |
|---|----------|--------|
| 1 | Manager WAR cadence | Weekly, same submit-and-review rhythm as agents. **Customizable** (an org can switch a tier to monthly). |
| 2 | Personal production | Tracked **separately** from unit roll-up. Optional — only for `isProducingManager` users. Never blended into unit totals. |
| 3 | Target cascade | Head of Sales → Branch → Unit → Agent. Each agent's floor never drops below their tenure minimum. |
| 4 | Accountability | **Flag-upward only.** Visibility + escalation notification. No system-enforced consequences. |
| 5 | Joint-call → JFW | Auto-counted from the Track F joint-call log. Credit finalizes only after the post-call evaluation is completed. |
| 6 | BOA | = **Bank Referral (Bank Originated Account)** — intra-ANSA bank referrals. Distinct enum value from generic `referral`. |
| 7 | Tenure anchor | Measured from **contract date** (= date provisional license issued = date able to sell). |
| 8 | Persistency | Keep **manual monthly %**. Optional YTD proxy, explicitly labeled as an estimate. |

---

## 2. The Manager Weekly Activity Report

**Proposed collection:** `/tenants/{tid}/managerWeeklyReports/{managerId}_{weekStartISO}`
(mirror the existing agent weekly-report collection's conventions)

Seven tracked activities. "Source" = how the value enters the system. "Standard" = the weekly target, **set by the upline** and customizable; defaults marked *TBD* require head-of-sales numbers before build.

| # | Activity | Field(s) | Type | Source | Standard |
|---|----------|----------|------|--------|----------|
| 1 | Joint Field Work (JFW) | `jfwCount` | number | **Auto** (count of Track F joint-call logs in the week, post-eval) | upline-set *(TBD)* |
| 2 | One-on-One Pipeline Reviews | `oneOnOnesConducted` | number | manual | upline-set *(TBD)* |
| 3 | Recruiting (weekly portion) | `namesSourced`, `interviewsConducted`, `recruitsInFirstWeeks` | number ×3 | manual | upline-set *(TBD)* |
| 4 | Training Delivered | `trainingSessions`, `trainingTopic` (optional) | number / text | manual | upline-set *(TBD)* |
| 5 | Unit/Branch Meeting | `unitMeetingHeld`, `attendanceCount` (optional) | boolean / number | manual | held = Y |
| 6 | Planning & Dashboard Review | `dashboardReviewDone` | boolean | manual | done = Y |
| 7 | Personal Production *(producing managers only)* | `personalApi` (TTD), `personalApps` | number ×2 | manual | optional, separate |

**Design notes**
- JFW (#1) is read-only on the report — it reflects the joint-call log so a manager can't manually inflate it. The Track F post-call evaluation (meeting type / need-covered / coaching time / training identified) is the gate that finalizes the JFW credit.
- Personal production (#7) is gated behind `isProducingManager` on the user doc and rendered in its own panel, never summed with unit production.
- Activity *standards* are distinct from API *targets*. API targets flow through the Goals System cascade (§6); activity standards are simple upline-set weekly numbers stored alongside the report config.

---

## 3. Recruiting funnel — tracking cadence

Split by how much control the manager has over timing.

| Funnel stage | Cadence | Why |
|--------------|---------|-----|
| Names Sourced | **Weekly** | High-volume, fully controllable; feeds the pipeline. |
| Initial Interviews | **Weekly** | Measures sourcing effectiveness + scheduling discipline. |
| Candidates (assessment / 2nd round) | **Monthly** | Lower-volume, deeper qualitative review. |
| Contracted (licensing) | **Monthly** | Gated by CBTT Form 3, Certificate of Character, TTII exam — outside manager control. |
| New-Recruit First Weeks (activation) | **Weekly** | Needs intensive supervision; early-failure intervention window. |

Weekly fields live on the Manager WAR (§2 #3). Monthly fields (`candidatesAssessed`, `agentsContracted`) live on a separate monthly roll-up so flat weeks don't read as failure.

---

## 4. Accountability — flag-upward model

Two tiers only. No automated consequences — consequence is the upline's human decision.

1. **Tier 1 — Visibility.** A missed weekly standard surfaces on the manager's own dashboard.
2. **Tier 2 — Escalation flag.** The miss notifies the direct upline through the existing notification system (Unit Manager miss → Branch Manager; Branch Manager miss → Sales Manager / Head of Sales).

**Optional intensifier (not consequences):** two consecutive missed weeks can raise the flag's prominence on the upline dashboard. Still purely a flag.

---

## 5. Prospecting taxonomy — BOA update

`BOA` resolves to **Bank Referral (Bank Originated Account)** — a referral from the ANSA banking arm (e.g. a mortgage client routed for credit-life / mortgage protection). It stays a **separate enum value** from `referral` because conversion rate and average policy size differ materially.

Shared taxonomy used by both:
- Track F prospect-info form (`prospectingActivityType`)
- Track H ledger (`sourceOfProspect`)

```
seminar · booth-event · referral · bank-referral (BOA) · cold-call ·
social-media · orphan · existing-client · family-friend · self · other
```

---

## 6. Tenure & licensing

**Anchor:** tenure = months since `contractDate`. The contract is only issued once the person can sell (provisionally), so contract date is the start of selling ability — the correct, fair anchor.

**Two license states** (the official CBTT license can lag the contract by up to 24 months):

| Field | Type | Notes |
|-------|------|-------|
| `contractDate` | date | Tenure clock start. |
| `licenseStatus` | enum `provisional` \| `official` | `provisional` = sells under supervision. |
| `cbttExamDeadline` | date (derived) | `contractDate` + 24 months. |
| `cbttExamPassedDate` | date \| null | Set when status flips to `official`. |

- Provisional agents carry the **same** tenure-based company floors — no branching in the floor engine.
- **Compliance signal:** flag any `provisional` agent within ~90 days of `cbttExamDeadline` on the manager/compliance view (missing it stops them selling).
- Feeds directly into the **tenure Company Floor** build already next in queue.

**Tenure Company Floor (confirmed bands)** — annual ÷ 40 for weekly:

| Tenure | Annual API floor (TTD) | ≈ Weekly (÷40) |
|--------|------------------------|----------------|
| Under 12 months | 150,000 | 3,750 |
| 12–24 months | 200,000 | 5,000 |
| 25–36 months | 250,000 | 6,250 |
| 37–48 months | 300,000 | 7,500 |
| 49–60 months | 400,000 | 10,000 |
| Over 60 months | 500,000 | 12,500 |

---

## 7. Policy lifecycle stages

Five milestones, mapped onto the **existing Track H ledger** — no new schema beyond the locked Track H fields.

1. **Submitted** — application + first premium to admin.
2. **Underwriting / Pending.**
3. **Placed / Approved** — risk accepted, contract issued (triggers FYC; counts to API).
4. **Delivered / Settled** — signed delivery receipt (maps to existing `dateIssued` / Settled + locked Policy Delivery Date).
5. **First Persistency Check** — first recurring premium clears.

---

## 8. Persistency

1. **Keep manual monthly %** entered by managers — unchanged. (True persistency needs each agent's full in-force portfolio, which the app doesn't hold.)
2. **Optional YTD proxy** from the in-app ledger: `active ÷ placed` in the YTD window. Render labeled **"Estimated — not official persistency."**
3. **Awards reference the manual/official figure only**, never the proxy.

*Reference (for labeling, not computation):* TTAIFA uses a 13-month rolling window; 90% average over the 12 months ending Dec 31 (95% for Rookie of the Year). The app can't reproduce this without the full portfolio — hence manual entry stays authoritative.

---

## 9. Product pick-list (replaces free text)

Generic category + Tatil product name. Editable as names are verified.

1. Critical Illness — *Life Span / Life Span Lite*
2. Final Expense / Micro-Life — *Rest Assured*
3. Term Life
4. Whole Life / Permanent
5. Universal Life
6. Endowment
7. Pension / Annuity
8. Mortgage / Credit Life

---

## 10. Open items before build

1. **Activity standards (§2):** head of sales to supply default weekly numbers for JFW, one-on-ones, recruiting, training.
2. **Provisional-license rule (§6):** confirm with compliance that the window is a flat 24 months and whether any grace/extension exists.
3. **Next step:** convert this spec to a CC kickoff brief in `docs/briefs/` (per the kickoff-brief commit convention) when ready to build.
