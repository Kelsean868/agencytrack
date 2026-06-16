# Branch-Scoped Manager Views

**Sized:** S–M (query-level) → M (with rule-level hardening)
**Type:** Two-branch pilot — each `branch_manager` must see **only their own branch's figures**. Today `getTenantUsers` filters by branchId, but `getWeeklySubmissions` + `getAllYTDSubmissions` (managerService.js:50,111) fetch whole-tenant and filter **client-side** — so the other branch's data reaches the BM's client. Promotes the banked SCOPE-2 item to a pilot requirement.
**Channel:**
- **Slice 1 (query-level filtering) = TIER-B** — stops the other branch's data being fetched.
- **Slice 2 (rule-level read isolation) = TIER-C, CONDITIONAL** — go/no-go decided after Slice 1 recon (depends on whether branchId is in the auth claim).
**Model:** Sonnet (Slice 1); opusplan (Slice 2, if it runs).
**Persona review:** YES — findings below.
**Sequencing:** After the policy-ledger work.

---

## Persona review

- **Branch isolation / data-exposure (the point):** two *competing* branch managers — the other branch's figures shouldn't reach a BM's client (Slice 1), and ideally a BM can't read them even via a crafted query (Slice 2). Client-side hiding leaves the data in the network response — not real isolation.
- **Correctness — Cyril / Phoenix:** Cyril is a BM (his branch) AND manages the Phoenix unit via a thin unit_manager anchor account. Branch-scoping must preserve each account's legitimate scope — confirm Phoenix's branch attribution so nothing he legitimately manages gets scoped out, and nothing he shouldn't see gets scoped in.
- **Don't over-scope:** `sales_manager` / `tenant_admin` / `platform_admin` keep their broader (tenant-wide) views — that's correct for them. Only BM views narrow.

---

## Slice 1 — Query-level branch filtering · **TIER-B**

**Branch:** `feat/branch-scoped-views`

### Phase 1 — recon
1. **Pin down current BM behavior** — exactly what a BM *fetches* vs *displays*, across `getWeeklySubmissions`, `getAllYTDSubmissions`, and **any other BM-facing read** (audit the manager read surfaces). The pilot-readiness audit and older notes disagreed on roster vs submissions — settle it with file:line.
2. **Scoping field** — do submission / YTD docs carry a `branchId` (or a `unitId` that maps to a branch)? What field scopes a submission to a branch?
3. **Claim availability (gates Slice 2)** — is the BM's `branchId` in the auth **claim** (usable in a rule without a `get()`), or only in their user doc?
4. **Cyril / Phoenix** — how the Phoenix unit attributes to a branch, and whether Cyril's two accounts (BM + Phoenix UM anchor) each scope correctly on their own. Likely the two-account structure already handles it — confirm.

### Phase 2 — build
Filter the BM-facing submission/YTD queries by branchId **at the query** (so the other branch's data isn't fetched), mirroring the `getTenantUsers` branchId filter. Keep higher roles tenant-wide. Preserve each account's legitimate scope (Cyril's branch + the Phoenix anchor's unit).

### Phase 3 — tests + smoke
- BM-A fetches submissions → only branch-A docs returned; **assert branch-B docs are ABSENT from the response**, not merely hidden.
- BM-A YTD → only branch-A.
- sales_manager / tenant_admin → tenant-wide unchanged.
- Cyril's accounts → his branch + Phoenix as appropriate.
- Smoke on a two-branch fixture, both themes: BM-A's network responses contain **zero** branch-B submission data.

### Phase 4–5
Docs; Tier-B gates → auto-merge → prod smoke; report after. (The "branch-B absent from the response" assertion is the gate — that's the proof of isolation, not display-hiding.)

---

## Slice 2 — Rule-level read isolation · **TIER-C, CONDITIONAL**

Go/no-go after Slice 1 recon, on the claim finding:
- **branchId in the claim** → cheap and worth it: gate BM submission reads on `submission.branchId == claim.branchId`; the Slice 1 query filter already aligns the query to the rule. Tier-C, gives true isolation (un-fetchable even by a crafted query).
- **branchId needs a `get()`** on the BM's user doc → costlier (a get() per read evaluation); present the tradeoff and likely bank for post-pilot unless you want it now.

I'll recommend the call at Slice 1 sign-off.

---

## Cross-cutting
- "Only see their own figures" = other branch's data **not fetched** (Slice 1); rule-level (Slice 2) makes it **un-fetchable** even by a crafted query.
- Preserve legitimately-managed cross-unit scope (Cyril / Phoenix).
- Higher roles stay tenant-wide.
