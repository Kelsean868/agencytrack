# AgencyTrack Azure Edition — Target Architecture, Cost Model & Tatil License Pricing
**Date:** 2026-07-22 · **Author:** Claude-web (architect) · **Status:** Strategy recon — pre-decision
**Context:** Follows Tatil senior-management meeting raising (1) conflict-of-interest, (2) data residency, (3) white-label licensing, (4) Microsoft/Dataverse integration. Decision taken in principle: build a single-tenant Azure edition on Kyron's own subscription as the reference deployment, redeploy via infrastructure-as-code into each client's tenant.

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

**Dataverse position (Q4 resolution):** Dataverse is **not** the application database — the multiplexing licensing rules would force per-user Power Platform licenses on every Tatil agent accessing app data through the API, even via a service account. Instead, Azure SQL is the system of record inside their tenant, and Dataverse/Power BI get a **reporting feed** (scheduled export or direct Power BI → SQL connection, which their existing licensing covers). They get the Microsoft-ecosystem visibility they asked for without the per-seat licensing trap. Confirm in writing with their Microsoft rep regardless.

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

## 3. Ongoing cost — Tatil (production, in their subscription)

Assumes 100–300 users, business-hours load (T&T single time zone helps — the DB can scale down or pause overnight/weekends).

| Service | Monthly (US$) |
|---|---|
| Azure SQL serverless (min 1 vCore, active ~10–12 hrs weekdays) — or 2-vCore provisioned if always-on | 150–400 |
| Azure Functions consumption | 5–30 |
| Static Web Apps Standard | 9 |
| Blob Storage | 5–20 |
| SignalR Standard (only if push features ship) | 0–50 |
| Backups, Log Analytics, App Insights | 20–60 |
| **Total** | **~US$200–550/mo ≈ TTD 1,400–3,750/mo ≈ TTD 17k–45k/yr** |

Two selling points hiding in this number:
1. **It lands on their existing Microsoft commercial agreement** — likely draws down their Azure commitment rather than being a new vendor bill, and their negotiated rates may beat list.
2. **No per-user infrastructure cost.** Entra ID for their staff is already paid for in M365. Headcount growth doesn't move the infra bill materially. (Contrast: the Dataverse-as-database route would have added ~US$5–20/user/month in Power Platform licenses.)

Position it exactly this way in the proposal: *"Your total infrastructure cost is under TTD 4,000/month, inside your existing Microsoft agreement, with no per-user Microsoft licensing required."*

---

## 4. License pricing recommendation — Tatil Life

### Market anchors (verified July 2026)
US insurance agency-management SaaS runs roughly **US$49–200/user/month**, clustering near US$99–109 (AgencyBloc US$109/user/mo; HawkSoft US$99/user/mo; EZLynx ~US$49–200+ by module). Those are multi-tenant SaaS list prices where the vendor carries hosting. AgencyTrack's offer is *stronger* on enterprise dimensions (white-label, single-tenant, their infrastructure, their compliance perimeter, Entra SSO) and *weaker* on vendor dimensions (solo founder, v1, no reference customers yet, smaller-market purchasing power).

### Recommended structure

**A. One-time implementation fee: TTD 150,000–250,000** (≈ US$22k–37k)
Covers: deployment into their tenant, Entra integration, branding/config, data migration from current records, training, 90-day hypercare. This is standard enterprise practice, funds the migration build, and — importantly — filters for a serious buyer. Do not waive it; discount it at most.

**B. Annual license: TTD 180/seat/month equivalent, billed annually, banded**

| Band | Seats | Annual license (TTD) | Effective/seat/mo |
|---|---|---|---|
| 1 | up to 100 | 240,000 | 200 |
| 2 | 101–200 | 420,000 | 175–208 |
| 3 | 201–350 | 640,000 | 152–176 |
| 4 | 351+ | negotiated | — |

Rationale for ~TTD 175–200/seat/mo (≈ US$26–30):
- Roughly **25–30% of US comparable list** — defensible for the market, the vendor stage, and the fact that *they* carry infrastructure cost (their ~TTD 30k/yr Azure spend is trivial against the license).
- **Value anchor for the negotiation:** one seat costs less per month than the commission on a single small policy; the Strategic Plan/Master Sheet/persistency automation displaces hours of manager and admin reporting time monthly. Price against the manual reporting burden, not against software comparables — they can't buy AgencyBloc localized to Tatil's hierarchy, TTD, and their strategic-plan deck anyway. There is no direct substitute.
- **Floor: TTD 120/seat/mo.** Below that, walk — it signals the product isn't valued and poisons pricing for insurer #2.

**C. Maintenance/support: included in the license** (bundled, not itemized). Industry norm is 18–22% separate; bundling is simpler at this scale and reads better against a first-time buyer. Define support scope in the agreement (business-hours response, update cadence, exclusions).

**D. Year-1 reference-customer option (recommended):** offer **20–25% off the year-1 license only** (never the implementation fee) in exchange for: written case-study rights, a referenceable named contact, and logo usage. Tatil as a signed reference is worth more than the discount when selling to Guardian/Sagicor/Maritime later. Year 2 reverts to list.

### Illustrative deal (200 seats)
Year 1: TTD 200k implementation + TTD 315k license (25% ref discount) = **TTD 515k**.
Year 2+: **TTD 420k/yr** recurring. Kyron's direct cost against this: his own Azure dev environment (~TTD 5–7k/yr) plus time — margin is effectively the whole license; the binding constraint is founder time, which is exactly what the Bicep-template deployment model protects.

### Contract terms to insist on (attorney checklist additions)
1. Annual billing, in advance; 3-year term with annual price escalator (5% or CPI).
2. Source-code escrow (answers the solo-founder continuity question before they ask).
3. Vendor no-access-to-tenant-data clause (Q1 conflict resolution, in writing).
4. License covers one legal entity/tenant — Tatil General or affiliates are separate licenses.
5. Customization requests priced separately as professional services; features ship in core behind config, never as a fork.

---

## 5. Open items before this becomes a build track
1. **Tatil IT meeting (Phase 0):** confirm in writing — data-residency requirement specifics, Azure subscription ownership for the deployment, Entra app-registration preference (their directory), Microsoft rep's answer on any Power Platform licensing they expect to use, and actual seat count.
2. **Seat count** drives the band — get the real advisor headcount (the tables above assume 100–300).
3. **Real-time inventory:** list which current surfaces use `onSnapshot` and triage push-needed vs. poll-acceptable (feeds the SignalR decision).
4. **Migration recon brief (CC dispatch, later):** enumerate every Firestore touchpoint — service files, rules, functions, derivations — to size the rebuild precisely. Read-only recon per standard discipline before any kickoff brief.
5. **TTD/USD rate assumption:** 1 USD ≈ 6.75–6.80 TTD used throughout; re-verify at proposal time.

*All Azure prices are pay-as-you-go list rates as of July 2026 (East US region as proxy); verify current rates and the Caribbean-serving region (likely East US/South Central US for latency) in the Azure pricing calculator before committing numbers to a proposal.*
