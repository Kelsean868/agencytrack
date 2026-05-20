# PR Kickoff — Tenure-Based Company Floor + Per-Agent Weekly API

**Track:** Tenure & Level API Minimums (new — to be added to the roadmap revision in this PR's Phase 4).
**Type:** Feature PR · **Size:** M · **Risk:** Medium (changes the binding Company Floor)
**Provenance:** Head-of-sales slide (Tatil, 2026-05-19 workshop), tenure table; reconciled against the board-signed `Sales_Career.pdf`.

---

## Goal

Replace the flat company-floor annual API (200,000) with a **tenure-based Company Floor** resolved per agent from contract date, and derive each agent's **weekly API floor** from it. This makes the Company Floor — and the API row of the Weekly Standard card we shipped in #238 — accurate to the agent's years of service.

## Critical context (read before scoping — prevents a known wrong turn)

- **Career-level numbers are already correct. Do NOT touch them.** The board-signed, agent-distributed `Sales_Career.pdf` (in project files) is the source of truth for career-level requirements, and the app's Career Portal already matches it exactly (L1–6 = 200/250/350/450/600/800K; apps 42/42/48/48/52/52; L7 = Chairman's choice, no API min). The head-of-sales *slide* showed different career-level numbers (300/300/500/700) — that is a divergent draft; **disregard it.** This PR makes **no** career-level changes.
- **This PR is only the tenure Company Floor + weekly derivation.** The tenure table is a *separate* thing from career levels — it is the contract-retention minimum by months of service, and it is **not** in `Sales_Career.pdf`. It exists only on the slide.
- **Tenure numbers are provisional.** Because the slide proved unreliable on its career-level table, the tenure numbers are seeded but **flagged for head-of-sales confirmation** and stored as editable config — never hard-coded as immutable.

## Source-verify first (Rule 17, Phase 1 — confirm before coding)

- `config/companyMinimums` currently holds `annualAPI` (200000) / `annualApps` / `persistency` + the `weeklyActivityFloors` block added in #238. `goalsService.js` has `getCompanyMinimums()` + `setCompanyMinimums()`.
- The user doc carries `contractStartDate` (ISO date) and `careerLevel`. Confirm the exact field name/format and whether a months-of-service helper already exists in `dateHelpers.js` (do not assume; pair grep with git ls-files).
- The Weekly Standard card's API row (#9) currently reads `weeklyActivityFloors.api` (flat 4800). Confirm where that value is consumed in `WeeklyStandardCard.jsx` / `weeklyActivityFloors.js` so the per-agent derivation slots in cleanly.
- Confirm where the annual Company Floor is read for the Goals Overview and for floor enforcement in `setGoals()`.

## Tenure → annual API floor (seed values, provisional)

| Months of service | Annual API floor (TTD) |
|---|---|
| < 12 (0–11) | 150,000 |
| 12–24 | 200,000 |
| 25–36 | 250,000 |
| 37–48 | 300,000 |
| 49–60 | 400,000 |
| > 60 | 500,000 |

Boundaries (exact): `m < 12` → 150k; `12 ≤ m ≤ 24` → 200k; `25 ≤ m ≤ 36` → 250k; `37 ≤ m ≤ 48` → 300k; `49 ≤ m ≤ 60` → 400k; `m > 60` → 500k. Months of service = whole months from `contractStartDate` to today.

## Scope

**IN**
- Extend `config/companyMinimums` with a `tenureApiFloors` block (the 6 bands above) plus a `provisional: true` marker (or equivalent note) signalling the numbers await head-of-sales confirmation.
- Idempotent Admin SDK seed (re-runnable to correct numbers without a code change) writing `tenureApiFloors` into `tatillife_south`; sets `updatedBy`/`updatedAt`.
- Resolver (util or `goalsService` helper): `contractStartDate` → months of service → tenure band → annual API floor. Pure function, unit-tested at every boundary. Fallback to flat `annualAPI` (200k) when `contractStartDate` is missing/invalid.
- **Company Floor (annual)** for an agent now resolves to the tenure-based floor (flat `annualAPI` becomes the fallback). Surface it in the Goals Overview "Company Floor" column.
- **Weekly API floor (#9)** in the Weekly Standard card = tenure annual ÷ 10 ÷ 4, per agent. Flat 4800 becomes the fallback when tenure is unknown. The other nine weekly activity floors stay flat (unchanged).
- Floor enforcement in `setGoals()`: personal commitment must be ≥ the tenure-resolved floor (was the flat 200k).
- `parseFloat()` on all numerics; `formatCurrency()` (TTD); Nexus tokens; light + dark.

**OUT / DEFERRED (log in FOLLOW_UPS.md, Phase 4)**
- Tenant-admin in-app editor for the tenure table (fast-follow; B5 `EditConfigModal` pattern). Until then, numbers are correctable by re-running the seed.
- **Career-level number changes — NONE.** App already matches `Sales_Career.pdf`.
- Career-level qualification on a **trailing 2-year average** of annual API (the doc's basis) — separate Career Portal follow-up; not in this PR.
- **Manager levels 8–10** production model (personal + per-advisor + unit, tenure-scaled schedules) — captured for **Track I (Manager WAR)**.

## Phases

1. **Source-verify** (above). If any field name/consumer differs from this brief, STOP and report (Rule 12).
2. **Data + resolver + seed.** `tenureApiFloors` schema; `getCompanyMinimums()` returns it (defaults = seed table when absent); resolver helper; idempotent Admin SDK seed run against `tatillife_south` (mark provisional). Unit tests: every band boundary, missing-`contractStartDate` fallback, weekly derivation math.
3. **Surfacing + enforcement.** Goals Overview Company Floor → tenure-resolved; Weekly Standard card API row → per-agent derived (÷10÷4); `setGoals()` enforcement against the resolved floor. Loading/empty/error states.
4. **Docs (with placeholders).** (a) Fold the **roadmap track section** (Appendix below) into `docs/AgencyTrack_Workshop_Roadmap_Revision.md`. (b) `docs/CONTEXT.md` recently-shipped row with `#TBD` / `{TBD}`. (c) `docs/FOLLOW_UPS.md`: log the deferred items — TA tenure-table editor; career-level 2-yr-average qualification; manager levels 8–10 → Track I; **and a flag: "tenure floor numbers provisional — confirm with head of sales (slide diverged from Sales_Career.pdf on career levels)."**
5. **Commit / push / PR.** Single branch off fresh main (`git fetch` first). Lint + build gate. Push, open PR via `gh`, Rule 15 post-push verify. Do NOT merge.

**Smoke: RUN** (user-visible, and it changes the floor). Production smoke via `setupBypassSession`, real write-read-verify: confirm the Company Floor and the weekly API floor resolve correctly for **at least two contract dates spanning different tenure bands** (e.g. a <12-month and a >60-month case — seed/adjust `contractStartDate` on a test agent or use two test users), and that a missing `contractStartDate` falls back to 200k / 4800. Light + dark, 390×844, 0 console errors.

## Acceptance criteria

- `tatillife_south` `companyMinimums` carries `tenureApiFloors` = seed table, marked provisional.
- Agent Company Floor (annual) and weekly API floor resolve from `contractStartDate` per the band table; missing date → 200k / 4800 fallback.
- Resolver unit-tested at every boundary; weekly = annual ÷ 10 ÷ 4.
- `setGoals()` enforces the resolved floor.
- Career-level numbers unchanged; Career Portal untouched.
- Lint 0; build green; smoke green across ≥2 tenure bands + fallback.

## Post-merge

Standard sequence: sync main, capture squash SHA, fill `#TBD`/`{TBD}`, commit + push direct to main, Rule 15 verify.

---

## Appendix — roadmap track section to fold into the revision doc (Phase 4)

> ### Track J — Tenure & Level API Minimums
> **Source:** head-of-sales slide (2026-05-19), reconciled against board-signed `Sales_Career.pdf`.
>
> **Resolved:** career-level API requirements are authoritative in `Sales_Career.pdf` (L1–6 = 200/250/350/450/600/800K; L7 = Chairman's choice). The app already matches these — no change. The head-of-sales slide's career numbers (300/300/500/700) are a divergent draft and are disregarded.
>
> **J1 (this PR):** tenure-based Company Floor (150K–500K by months of service, from `contractStartDate`) replacing the flat 200K; per-agent weekly API floor = tenure annual ÷ 10 ÷ 4. Stored as tenant-admin-editable config, seeded from the slide, **flagged provisional pending head-of-sales confirmation.**
> **J2 (follow-up):** career-level qualification on a trailing 2-year average of annual API (the doc's stated basis), feeding the Career Portal.
> **J3 (→ Track I):** manager levels 8–10 production model (personal + per-advisor + unit, tenure-scaled recruitment/performance schedules).
>
> **Open action:** confirm the tenure numbers with the head of sales; surface the slide-vs-doc career-level discrepancy to him.
