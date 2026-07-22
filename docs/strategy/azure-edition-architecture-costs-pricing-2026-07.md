# AgencyTrack Azure Edition — Target Architecture, Cost Model & Tatil License Pricing
**Date:** 2026-07-22 · **Rev B (same day)** · **Author:** Claude-web (architect) · **Status:** Strategy recon — pre-decision
**Context:** Follows Tatil senior-management meeting raising (1) conflict-of-interest, (2) data residency, (3) white-label licensing, (4) Microsoft/Dataverse integration. Decision taken in principle: build a single-tenant Azure edition on Kyron's own subscription as the reference deployment, redeploy via infrastructure-as-code into each client's tenant.

**Rev B locked inputs (supersede Rev A ranges):**
- **Target seat count: 350.** Sections 3 and 4 are re-costed against this firm number; the Rev A band table is replaced by a single-deal structure.
- **Tatil's Power Platform licensing does NOT cover Dataverse for agents.** This confirms the Azure SQL architecture and is now a quantified savings argument, not a caveat (see §4a).

---

## 1. Target architecture — Firebase → Azure service mapping

| Current (Firebase/Vercel) | Azure Edition | Migration effort | Notes |
|---|---|---|---|
| React 19 + Vite frontend (Vercel) | **Azure Static Web Apps** | Low | App code survives essentially intact. SWA gives CDN hosting + integrated Functions routing + free SSL. Free tier for dev; Standard (~US$9/mo) for production. |
| Firestore | **Azure SQL Database** (serverless, General Purpose) | **High — the core rewrite** | Document model → relational schema. This is a redesign, not a port: collections (users, policies, prospects, activities, goals, funnels) become tables with real foreign keys. Payoff: the reporting surfaces (Strategic Plan, Master Sheet, persistency, funnels) become straightforward SQL instead of client-side derivation, and Power BI connects natively — which is half of what Tatil is asking for. Alternative considered: Cosmos DB (closer to Firestore mentally) — rejected: costs more at this scale, weaker Power BI/reporting story, keeps NoSQL query limitations. |
| Cloud Functions (gen-1, Node 20) | **Azure Functions** (Consumption plan, Node) | Medium | Business logic in JS largely portable; triggers change (Firestore triggers → SQL change feed / explicit API calls; scheduled → timer triggers; callable → HTTP). |
| Firestore security rules | **API-layer authorization middleware** in Azure Functions | **High — biggest conceptual change** | There is no client-direct database access in this architecture. All reads/writes go through the API, which enforces the role hierarchy (Agent → UM → BM → SM → Tenant Admin) in code. Every service file (`src/services/*`) is rewritten to call the API instead of Firestore SDK. Side benefit: this is where the "Platform Admin cannot see tenant data" guarantee gets enforced structurally (Q1 conflict resolution). |
| Firebase Auth (email+password) | **Microsoft Entra ID** (client tenant) / **Entra External ID** (Kyron's hosted edition) | Medium | Client deployments: agents sign in with their existing M365 accounts; IT manages lifecycle; MFA/conditional access apply automatically. Own edition: Entra External ID, free to 50k monthly active users. Custom claims (tenantId, role) → Entra app roles / token claims. |
| Firebase Storage | **Azure Blob Storage** | Low | Direct swap. |
| Firestore real-time listeners (`onSnapshot`) | **Azure SignalR Service** or polling | Medium | ⚠ Real loss to plan around: SQL doesn't push to clients. Inventory which surfaces genuinely need live updates (kiosk, planner presence?) vs. can poll/refresh. SignalR free tier for dev; Standard ~US$50/mo if needed in production. Recommend: default to fetch-on-focus + light polling; add SignalR only where a surface demonstrably needs push. |
| Vercel auto-deploy on merge | **GitHub Actions → SWA/Functions deploy** | Low | Keeps the same merge-to-deploy rhythm. |
| — (new) | **Bicep templates** (infrastructure-as-code) | Medium, day-one requirement | The entire environment defined as parameterized templates. "Selling Tatil the software" = running the template against their subscription with their parameters (tenant name, branding config, Entra IDs). This is the deliverable that makes the white-label model survivable solo. |
| — (new) | **Application Insights + Log Analytics** | Low | Monitoring/alerting per deployment; clients' IT will expect it. |

**What survives:** the React app, Nexus v2 design system, component library, all UX work, the domain logic *concepts*. **What is rewritten:** every service file, all security-rule logic, all Cloud Functions triggers, the data model. Honest scale: **a months-scale rebuild** (rough order: 3–5 focused months solo with CC executing, longer alongside other tracks). The implementation fee (Section 4) is designed to fund this final mile.

**Dataverse position (Q4 resolution — now settled):** Dataverse is **not** the application database. Multiplexing rules force per-user Power Platform licensing on every agent accessing app data through the API, even via a service account — and Tatil's existing agreement does not cover agents for Dataverse. Instead, **Azure SQL is the system of record inside their tenant**, with Power BI / Excel / Power Automate connecting to it directly as a normal enterprise data source. They get the Microsoft-ecosystem visibility they asked for; the licensing trap disappears entirely because Dataverse is never in the path.

⚠ **Two secondary Microsoft licensing lines survive this decision and must be raised in Phase 0:**
1. **Power BI Pro** (US$14/user/mo list, price set April 2025 and unchanged through 2026) is required for anyone *publishing or sharing* reports. It is included free in Microsoft 365 E5. If Tatil is on E5, this is zero; on E3, it's a per-manager cost (~30–50 people, not 350 agents). Confirm which they hold.
2. **The SQL Server connector in Power Automate is a premium connector.** Anyone *building* flows against AgencyTrack data needs Power Automate Premium (~US$15/user/mo) or per-flow licensing. This affects a handful of automation builders, never the agent population — but don't let it surface as a surprise after contract.

---

## 2. Ongoing cost — Kyron (dev/reference environment)

Serverless everything, auto-pause on, dev-scale usage. Azure SQL serverless bills ~US$0.52/vCore-hour by the second and pauses when idle (rate verified July 2026; re-check at signing).

| Service | Monthly (US$) |
|---|---|
| Azure SQL serverless (0.5 vCore min, auto-pause, ~3–5 active hrs/day) | 15–40 |
| Azure Functions consumption (within free grant at dev volume) | 0–5 |
| Static Web Apps (free tier for dev) | 0 |
| Blob Storage | 1–5 |
| SignalR (free tier) | 0 |
| Entra External ID (<50k MAU) | 0 |
| App Insights (light sampling) | 0–10 |
| **Total** | **~US$20–60/mo (≈ TTD 135–410)** |

Budget **US$100/mo ceiling** to be safe. No enterprise agreement or special license needed — a pay-as-you-go subscription on a credit card. This replaces nothing yet: Firebase production keeps running in parallel until the Azure edition is proven.

---

## 3. Ongoing cost — Tatil (production, in their subscription, **350 seats**)

Business-hours load, single time zone (T&T UTC-4 helps — the DB scales down or pauses overnight and weekends). Assumes ~80–120 concurrent at peak.

| Service | Monthly (US$) |
|---|---|
| Azure SQL serverless (min 1 vCore, burst to 6–8, active ~12 hrs weekdays, auto-pause off-hours) | 300–450 |
| Azure Functions consumption | 10–40 |
| Static Web Apps Standard | 9 |
| Blob Storage | 10–30 |
| SignalR Standard (only if push features ship) | 0–50 |
| Backups, Log Analytics, App Insights | 30–70 |
| **Total** | **~US$400–700/mo ≈ TTD 2,700–4,750/mo ≈ TTD 33k–57k/yr** |

Three selling points hiding in this number:
1. **It lands on their existing Microsoft commercial agreement** — likely draws down their Azure commitment rather than being a new vendor bill, and their negotiated rates may beat list.
2. **No per-user infrastructure cost.** Entra ID for their staff is already paid for in M365. Growing from 350 to 500 agents doesn't move this bill materially — it's a compute-shaped cost, not a seat-shaped one.
3. **The architecture actively saves them money** — see below.

### 3a. What the Azure SQL decision saves Tatil (the number to lead with)

Microsoft consolidated Power Apps licensing in January 2026: the old Per App plan (~US$5/user/app/mo) was pulled from the licensing guide for most new purchasing channels, leaving **Power Apps Premium at US$20/user/mo** and **Pay-As-You-Go at ~US$10/active user/app/mo** as the two production paths. The discounted enterprise rate (US$12/user/mo) requires a 2,000+ seat minimum — Tatil at 350 does not qualify.

If AgencyTrack ran on Dataverse, all 350 agents would need one of these:

| Route | Annual cost to Tatil (US$) | ≈ TTD/yr |
|---|---|---|
| Power Apps Premium @ $20 × 350 | 84,000 | **~570,000** |
| Pay-As-You-Go @ ~$10 × 350 active | 42,000 | **~285,000** |

**The Azure SQL architecture avoids TTD 285,000–570,000 per year in Microsoft licensing** — and delivers the same Power BI / Excel / Power Automate visibility. That avoided cost is comparable to the entire annual license fee (§4). Put this table in the proposal.

Position the whole section as: *"Your total infrastructure cost is under TTD 5,000/month, inside your existing Microsoft agreement, with no per-agent Microsoft licensing required — an architecture choice that saves you between TTD 285,000 and 570,000 a year versus the Dataverse route."*

---

## 4. License pricing recommendation — Tatil Life

### Market anchors (verified July 2026)
US insurance agency-management SaaS runs roughly **US$49–200/user/month**, clustering near US$99–109 (AgencyBloc US$109/user/mo; HawkSoft US$99/user/mo; EZLynx ~US$49–200+ by module). Those are multi-tenant SaaS list prices where the vendor carries hosting. AgencyTrack's offer is *stronger* on enterprise dimensions (white-label, single-tenant, their infrastructure, their compliance perimeter, Entra SSO) and *weaker* on vendor dimensions (solo founder, v1, no reference customers yet, smaller-market purchasing power).

### Recommended structure

**A. One-time implementation fee: TTD 150,000–250,000** (≈ US$22k–37k)
Covers: deployment into their tenant, Entra integration, branding/config, data migration from current records, training, 90-day hypercare. This is standard enterprise practice, funds the migration build, and — importantly — filters for a serious buyer. Do not waive it; discount it at most.

**B. Annual license — 350 seats. Three numbers to hold in your head:**

| Position | TTD/seat/mo | Annual (TTD) | Use |
|---|---|---|---|
| **Opening ask (list)** | 190 | **800,000** | What you quote first. Never open at your target. |
| **Target settle** | 167 | **700,000** | Where a normal negotiation lands. Plan the business on this. |
| **Published band rate** | 152 | 640,000 | Your standard 201–350 seat rate — concede to this only if you need a "win" to close. |
| **Walk-away floor** | 120 | 504,000 | Below this, decline. |

Rationale:
- At TTD 700,000/yr, a 350-seat AgencyTrack deployment costs roughly **23% of the equivalent US list price** (AgencyBloc at US$109/user/mo × 350 seats ≈ US$458k/yr ≈ TTD 3.1M). Defensible for the market, the vendor stage, and the fact that *they* carry infrastructure cost.
- **All-in cost to Tatil at settle: ~TTD 745,000/yr including Azure = TTD 177 per agent per month.** That is the single most persuasive figure in the proposal — it is less than the commission on one modest policy per agent per year.
- **Price against the displaced work, not software comparables.** They cannot buy AgencyBloc configured to Tatil's hierarchy, TTD, their strategic-plan deck, and their incentive structures. There is no direct substitute — so the comparison set is the manager and admin hours currently consumed by manual reporting, not a SaaS price list.
- **Floor discipline:** below TTD 120/seat, walk. It signals the product isn't valued and poisons your pricing for insurer #2.

**Seat-count mechanics (get this into the contract):** 350 is an *aim*, not a confirmed headcount. Structure the license on the band, with **annual true-up at renewal only** — never mid-year. If they deploy at 220 and grow to 350, they stay in the 201–350 band throughout and nothing renegotiates until renewal. This protects you from a "we'll start with 50 seats" opening and protects them from surprise bills.

**C. Maintenance/support: included in the license** (bundled, not itemized). Industry norm is 18–22% separate; bundling is simpler at this scale and reads better against a first-time buyer. Define support scope in the agreement (business-hours response, update cadence, exclusions).

**D. Year-1 reference-customer option (recommended):** offer **20–25% off the year-1 license only** (never the implementation fee) in exchange for: written case-study rights, a referenceable named contact, and logo usage. Tatil as a signed reference is worth more than the discount when selling to Guardian/Sagicor/Maritime later. Year 2 reverts to list.

### The 350-seat deal, modelled at target settle

| | TTD |
|---|---|
| **Year 1** — implementation 250,000 + license 525,000 (700k less 25% reference discount) | **775,000** |
| **Year 2** — license at list | **700,000** |
| **Year 3** — license + 5% escalator | **735,000** |
| **3-year total contract value** | **≈ 2,210,000** (≈ US$326,000) |

Kyron's direct cost against this: his own Azure dev/reference environment (~TTD 5–8k/yr) plus time. Margin is effectively the whole license — **the binding constraint is founder time, not cost**, which is precisely what the Bicep-template deployment model exists to protect.

⚠ **Concentration risk (the real strategic exposure):** TTD 700k/yr from a single customer *is* the business. That is normal and fine for customer #1, but it hands Tatil enormous leverage at the year-2 renewal — and they will know it. The mitigation is commercial, not technical: **have a credible second insurer in the pipeline before the first renewal comes up.** Guardian, Sagicor, and Maritime all operate regionally; the Tatil reference is what opens those doors, which is the entire justification for the year-1 discount below.

### Contract terms to insist on (attorney checklist additions)
1. Annual billing, in advance; 3-year term with annual price escalator (5% or CPI).
2. Source-code escrow (answers the solo-founder continuity question before they ask).
3. Vendor no-access-to-tenant-data clause (Q1 conflict resolution, in writing).
4. License covers one legal entity/tenant — Tatil General or affiliates are separate licenses.
5. Customization requests priced separately as professional services; features ship in core behind config, never as a fork.

---

## 5. Open items before this becomes a build track

0. ⚠ **Expectation reset — do this first, and do it early.** Senior management asked about linking to *Dataverse*. The answer is Azure SQL, not Dataverse. If anyone in that room left believing "our data will live in Dataverse and appear across all our Microsoft tools," that belief must be corrected at the Phase 0 IT meeting — **not at contract time**, where it reads as a bait-and-switch. The framing is positive and easy: *same outcome (data in your tenant, live in Power BI and Excel), better economics (TTD 285k–570k/yr avoided in Microsoft licensing).* Lead with §3a.
1. **Tatil IT meeting (Phase 0):** confirm in writing — data-residency requirement specifics, Azure subscription ownership for the deployment, Entra app-registration preference (their directory), **whether they hold M365 E5 (Power BI Pro included) or E3 (must purchase for report publishers)**, and whether they intend to build Power Automate flows against AgencyTrack data (premium connector cost).
2. **Confirm the 350 seat count** — currently a target, not a verified licensed-advisor headcount. It sets the band and the whole deal size, so get the real number and the 24-month growth expectation.
3. **Real-time inventory:** list which current surfaces use `onSnapshot` and triage push-needed vs. poll-acceptable (feeds the SignalR decision).
4. **Migration recon brief (CC dispatch, later):** enumerate every Firestore touchpoint — service files, rules, functions, derivations — to size the rebuild precisely. Read-only recon per standard discipline before any kickoff brief.
5. **TTD/USD rate assumption:** 1 USD ≈ 6.75–6.80 TTD used throughout; re-verify at proposal time.

*All Azure and Microsoft licensing prices are list rates verified July 2026 (East US region as proxy); verify current rates and the Caribbean-serving region (likely East US/South Central US for latency) in the Azure pricing calculator before committing numbers to a proposal.*
