# Session: 2026-05-27 — F3.1 Prospect Prefill + Track F Polish + Suite Hardening + Forward Recon

**Started:** 2026-05-27
**Model:** claude-sonnet-4-6
**Scope:** F3.1 new-policy prefill from prospect-info; Track F polish (isPinned, peer-BM scope, F2.2 joint-call archive); suite hardening (weak-waitFor audit, policy lifecycle tests, a11y warn→error); forward recon (Phase 9, H4, H3 parity)

## Anchor (Phase 0)

- Main HEAD: `a4a6e79` (post-merge fill — PR #358 CI stabilization complete)
- Suite: 1521/1521 green (101 test files)
- CI arc: confirmed closed (#355–#358 all merged; 48/48 smoke sweep)
- CONTEXT.md: current, no drift detected

## Phase 1 — F3.1 Verify Finding

**Task:** prospect-info → New Policy form prefill

**Source: prospectInfo doc fields**
| Field | Type | Values |
|---|---|---|
| `clientName` | string (max 120) | free text |
| `clientAge` | numeric | float |
| `clientOccupation` | string (max 120) | free text |
| `prospectingSource` | enum | PROSPECTING_SOURCES (11 values; same as policy `sourceOfProspect`) |
| `appointmentType` | enum | '2nd-interview' \| 'closing-interview' |
| `objections` | multi-select enum | 4 values |
| `policyType` | string (POLICY_TYPES) | 8 Tatil product categories |
| `intendedAppointmentDate` | date string | ISO date |

**Destination: New Policy create form (EMPTY_FORM)**
`ownerName`, `insuredName`, `policyNumber`, `productLine`, `newBusinessType`, `policyClass`, `planName`, `planId`, `proposedPremium`, `proposedFrequency`, `proposedAPI`, `proposedCoverage`, `dateWritten`, `dateSubmitted`, `notes`, `isSelfOrFamily`, `replacedPolicyAPI`, `sourceOfProspect`, `cashWithApp`

**Safe 1:1 mappings (obvious, no product decision):**
1. `clientName` → `ownerName` — prospect becomes policy owner; natural CTA ("how the appointment went well")
2. `prospectingSource` → `sourceOfProspect` — EXACT SAME ENUM (both consume `PROSPECTING_SOURCES` from `prospectInfoService.js`); zero translation needed

**Deferred — require dispatcher product decision:**
- `policyType` (POLICY_TYPES: 8 Tatil categories) → `policyClass` (POLICY_CLASSES: 5 different categories) — different taxonomies; no safe 1:1 map without dispatcher confirmation
- `clientName` → `insuredName` — agent decides; `sameAsOwner` checkbox handles this
- `intendedAppointmentDate` → `dateWritten` — appointment date ≠ policy write date

**Existing hook point:**
- `AgentDashboard.jsx:772-775`: `ProspectInfoPanel` and `PolicyLedgerPanel` are sibling renders on `activeTab`
- `setActiveTab` at `AgentDashboard.jsx:90` — available in `AgentDashboard` scope
- No existing "create policy from prospect" CTA in either panel
- No `prospectInfoId` field on the policy schema

**Rules/schema change needed:** NONE — agent already reads own prospectInfo; this is pure frontend state passing

## PR Log

| PR | SHA | Description | Status |
|---|---|---|---|
| — | — | Run starting | — |

## Phase Completion

| Phase | Status | Notes |
|---|---|---|
| Phase 0 (Anchor) | ✅ Complete | 1521/1521; CI arc closed |
| Phase 1 (F3.1 verify) | ✅ Complete — PR-OPEN pending | Brief to be committed; build in progress |
| Phase 2 (Track F polish) | — | — |
| Phase 3 (Suite hardening) | — | — |
| Phase 4 (Forward recon) | — | — |
