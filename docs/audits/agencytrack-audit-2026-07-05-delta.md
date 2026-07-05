# AgencyTrack — Audit Delta / Verify / Gap-Closure Pass

**Date:** 2026-07-05
**Base audit:** [`docs/audits/agencytrack-audit-2026-07-04.md`](agencytrack-audit-2026-07-04.md) (34 findings)
**Scope:** Re-verify the top-8 findings against current `main`; close the base audit's own self-critique gaps that are feasible read-only; a bounded new-findings sweep on surfaces the base audit did not cover.
**Method:** Direct source re-read (each claim re-located, old line numbers NOT trusted), a real `npm run build` chunk report, read-only `npm audit --omit=dev` at both package roots, and full reads of the three components the base audit flagged as un-sampled. Nothing was modified, committed, or deployed.
**Main HEAD at audit time:** `ca252831` (PR #794 wizard smoke). PRs since 07-04 audit reviewed: #792 (`41935ef8`, goals/awards — touched no security surface), #793 (`5f8bc0d7`, docs), #794 (`ca252831`, smoke-only). **None invalidate any base-audit finding.**

---

## 1. Verification table — top-8 findings re-verified against current source

| ID | Base claim | Status | Current evidence (re-located) |
|----|-----------|--------|-------------------------------|
| **SEC-001** | `setUserClaims` writes arbitrary claims, no matrix/tenant/platform_admin guard | **CONFIRMED-STILL-OPEN** (evidence drifted −0 lines) | `functions/index.js:456-472`. Guard is still only `['platform_admin','tenant_admin'].includes(role)` (`:457`). `{ uid, role, tenantId, branchId, ownedBranchIds } = data` all client-supplied (`:461`); `claims = { role, tenantId }` (`:466`) set verbatim via `setCustomUserClaims` (`:470`). No `CREATION_MATRIX` gate, no `tenantId === context.auth.token.tenantId` clamp, no `role === 'platform_admin'` block. Exploit path unchanged: a tenant_admin can mint `platform_admin` or plant a uid in another tenant. |
| **PRIV-002 / PRIV-006** | No erasure path; no consent/lawful-basis capture for third-party PII | **CONFIRMED-STILL-OPEN** | `git grep -E "eraseUser\|hardDelete\|purgeUser\|rightToErasure" functions src` → **no export**. `deactivateUser` remains soft-delete. Consent grep across `src/services` returns only `moneyNeedsService.js` (an unrelated `consent`-substring match — no data-subject consent field on `prospectInfoService`/`policiesService` create paths). |
| **SEC-004 / COST-001** | App Check not enforced (client or server) | **CONFIRMED-STILL-OPEN** | `git grep -E "AppCheck\|initializeAppCheck\|enforceAppCheck\|context\.app\|consumeAppCheckToken" src functions` → **NO MATCHES**. `src/firebase.js:1-49` still has no `initializeAppCheck`. |
| **SEC-002** | Agent-of-Month CFs not branch-scoped for branch_manager | **CONFIRMED-STILL-OPEN** (evidence drifted) | `functions/agentOfMonth/getCandidates.js:12-37` — `MANAGER_ROLES` includes `branch_manager` (`:5-10`); `branchId` from `data` (`:22`) used directly in the users query (`:35`), no `caller.branchId` comparison. `functions/agentOfMonth/setAgentOfMonth.js:39-72` — validates the *agent* is in `branchId` (`:70`) but **never** checks the *caller* owns that branch, so a BM can still write any branch's record. |
| **SEC-003** | Kiosk `createKioskToken`/`revokeKioskToken` not branch-scoped for BM | **CONFIRMED-STILL-OPEN** | `functions/kiosk/createToken.js:28` — `const branchId = data.branchId ?? context.auth.token.branchId ?? 'default'` with no BM-branch equality check; `TOKEN_TTL_MS = 1 year` (`:12`). `functions/kiosk/revokeToken.js:11-46` — tenant-match only (`:37`), any BM may revoke any token in the tenant (cross-branch DoS). |
| **SEC-005** | Dependency CVEs: functions 4 high / 13 mod / 2 low; root 2 high / 1 mod | **CONFIRMED-STILL-OPEN, counts drifted** | Fresh `npm audit --omit=dev` (2026-07-05): **functions = 4 high / 10 moderate / 1 low (15 total)**; **root = 2 high / 1 moderate (3 total)**. High set unchanged (`@grpc/grpc-js`, `protobufjs`, `fast-xml-builder`, `form-data`; root: `@grpc/grpc-js`, `protobufjs`). Moderates down 13→10 (transitive churn), no fix applied. Recommended upgrades **NOT** done: `functions/package.json` still `firebase-admin: ^12.0.0`, `firebase-functions: ^4.9.0`. |
| **SEC-006** | `storage.rules` absent from repo & `firebase.json` | **CONFIRMED-STILL-OPEN** | `git ls-files \| grep storage.rules` → **NOT TRACKED**. `firebase.json:1-23` still has no `storage` block (functions/firestore/extensions/emulators only). Deployed rule content remains Needs-verification (Console). |
| **SEC-007** | No CSP / security headers | **CONFIRMED-STILL-OPEN** | `vercel.json:1-5` is still `{ rewrites: [ /(.*)→/index.html ] }` only — no `headers` key. `index.html` carries no `<meta http-equiv="Content-Security-Policy">`. |
| **SEC-009** | CI omits rules test & dependency scan | **CONFIRMED-STILL-OPEN** | `.github/workflows/ci.yml:1-46` — `lint-and-build` (lint + `npm test --run` + build) + `functions-tests` (Jest). No Firestore-emulator job, no `firebase emulators:exec` rules run, no `npm audit`/Dependabot gate. The excluded rules suite (`tests/rules/**`) is still never executed in CI. |

**Net:** all 8 (9 with the paired PRIV) findings are **CONFIRMED-STILL-OPEN**. Only line/count anchors drifted; no root-cause remediation has landed since 07-04.

---

## 2. Gap-closure results (base audit §8 self-critique)

### 2a. PERF-001 quantified — real `npm run build` chunk report

Build succeeded (Vite 8, `vite build`, 2777 modules, ✓ 6.15s). Emitted assets:

| Asset | Raw | Gzip |
|-------|-----|------|
| `dist/assets/index-*.js` (**single entry chunk**) | **3,947.82 kB** | **1,133.17 kB** |
| `dist/assets/index-*.css` | 106.87 kB | 19.33 kB |
| `workbox-window.prod.es5-*.js` | 5.74 kB | 2.25 kB |
| `index.html` | 0.51 kB | 0.31 kB |

**Findings, confirming and sharpening PERF-001:**
- **No code-splitting whatsoever** — there is exactly **one** application JS chunk (`index-*.js`). Vite's own reporter emits the `(!) Some chunks are larger than 500 kB` warning and explicitly recommends `dynamic import()`. Zero `React.lazy`/`import()` split points exist (confirms base audit's "Zero `React.lazy` in src/").
- **First-load JS is ~1.13 MB gzipped / 3.95 MB raw** shipped to every user (including mobile field agents) before first paint. `@react-pdf/renderer` (PDF), Recharts (charts), and both dashboards are all statically imported into this one chunk.
- **PWA precache = 4000.38 KiB across 11 entries** — the service worker precaches the whole entry bundle, so the weight is paid on install too.
- **Severity holds at High** and is now **quantified** rather than "Needs-verification." The single most effective mitigation is a dynamic `import()` of the PDF/export module at the "Download report" call site plus `React.lazy` on the two dashboards — that alone should move PDF + a dashboard out of the critical path.

### 2b. Dependency refresh — read-only `npm audit --omit=dev` (2026-07-05)

**Root (`--omit=dev`): 2 high, 1 moderate, 3 total.**
- HIGH `@grpc/grpc-js` — malformed-request / malformed-compressed-message server/client crash (DoS).
- HIGH `protobufjs` — unbounded recursive JSON descriptor expansion (DoS); prototype-shadowing; unbounded Any expansion.
- MODERATE `dompurify` — multiple `IN_PLACE`/hook-pollution/Trusted-Types XSS-bypass advisories. **Reachability: no `dangerouslySetInnerHTML` and no direct DOMPurify call in production `src/` — it rides in transitively; the app does not appear to invoke the vulnerable `IN_PLACE`/hook paths.** Low real-world exposure but present in the shipped client dep graph.

**Functions (`--omit=dev`): 4 high, 10 moderate, 1 low, 15 total.**
- HIGH `@grpc/grpc-js` (crash/DoS), `protobufjs` (DoS), `fast-xml-builder` (attribute/comment sanitization bypass), `form-data` (CRLF injection via unescaped multipart field/file names).
- MODERATE cluster all transitive under `firebase-admin` / `@google-cloud/firestore` / `@google-cloud/storage` / `google-gax` / `gaxios` / `express`: `qs` (DoS), `uuid` (missing buffer-bounds check v3/v5/v6), `retry-request`/`teeny-request`, `express`→`qs`.

**Delta vs 07-04:** functions moderate 13→10, low 2→1; high count unchanged at 4; root unchanged at 2H/1M. This is transitive-graph drift, **not** remediation — the highs are all still present and the recommended `firebase-admin` v12→v13 / `firebase-functions` v4→v6 bumps that would pull patched transitives have **not** been applied. **No fix was run** (read-only pass only).

### 2c. Component coverage — the three un-sampled surfaces (base audit §8 bullet 2)

Full reads of `src/components/daily/DailyCaptureV2.jsx` (1,124 lines), `src/components/profile/CareerPortal.jsx` (886 lines), and `src/components/dashboard/GamePlanV2/index.jsx` (353 lines) + `PlanSuggestionsCard.jsx`. Checked for: unbounded listeners, N+1 reads, missing effect cleanup, unvirtualized lists, trusting client values.

**Headline: all three are well-built.** No `onSnapshot` listeners anywhere in the three (all use one-shot `getDoc`/`getDocs`-style service reads), every async effect uses an `active`/`alive` cancellation flag with a cleanup return, all numeric inputs go through `parseInt`/`parseFloat`, and there are no long unvirtualized lists (Career ladder = 7 fixed nodes; suggestions list is small and bounded). New findings are minor:

| ID | Title | Sev | Conf | Location | Effort | Change-risk | Priority |
|----|-------|-----|------|----------|--------|-------------|----------|
| PERF-009 | `GamePlanScreen` fires 4 independent sequential-effect reads on mount (money-needs, year-plan, monthly-plan, weekly-plan, daily-week — 5 reads across 3 effects), none deduped; re-run on tenant/uid change. Bounded per-agent (own data), not a fan-out, but 5 round-trips before the hub paints. | Low | Confirmed | `GamePlanV2/index.jsx:90-136` | S | Low | P3 |
| PERF-010 | `PlanSuggestionsCard` fires N fire-and-forget `markSuggestionSeen` writes on view (one per `open` suggestion). Bounded by suggestion count (small) and guarded by an `ackedFor` ref so it fires once per agent; acceptable, noted for completeness. | Info | Confirmed | `GamePlanV2/PlanSuggestionsCard.jsx:59-66` | S | Low | — |
| PERF-011 | `CareerPortal` main `useMemo` recomputes YTD/quarterly/trailing-2yr aggregates by iterating all `submissions` client-side; fine at pilot volume but grows with tenure (same class as base COST-002, agent-scoped so lower blast radius). | Info | Confirmed | `CareerPortal.jsx:793-830`, `computeQuarterlyAPI:63-81` | S | Low | — |
| A11Y-001 | `CareerPortal` uses `var(--color-text-faint)` at three sites — **all on `aria-hidden` decorative elements** (locked-coin numeral `:117`, dashed connector accent `:187`, chart floor-marker `:434`), NOT on readable text. **D5 rule ("no `text-faint` on new text") does NOT apply** — these are non-text decorations. Recorded to preempt a false-positive flag. | Info | Confirmed | `CareerPortal.jsx:117,187,434` | — | — | — |

**No unbounded-listener, missing-cleanup, or trust-client-value defect was found in any of the three.** DailyCaptureV2 in particular is exemplary: 5 effects, each with `active`-flag teardown; save persists the daily doc first then best-effort-aggregates with failure isolation (`:660-671`); the save button self-disables via `!!savedAt` and auto-closes (`:672`).

### 2d. SEC-003 blast radius — every kiosk-readable path a forged-branch token could read

`kioskCanRead(tenantId)` (`firestore.rules:54-56`) = `isSignedIn() && isKiosk() && getTenantId() == tenantId`. **Critical structural finding: the kiosk read predicate checks ONLY tenant match — it never references `branchId`.** So a kiosk token is effectively **tenant-wide read**, and the SEC-003 cross-branch mint (a BM minting a token for a branch they don't own) does not even *need* to forge a branch to widen reach: any valid kiosk token in the tenant reads every kiosk-armed collection tenant-wide. The token's own `branchId` claim gates nothing at the rules layer.

Enumerated kiosk-readable arms (all `allow get`/`list`/`read` that OR in `kioskCanRead`):

| Collection | Rule line | Access | What a kiosk token reads |
|-----------|-----------|--------|--------------------------|
| `tenants/{tid}/users/{userId}` | `firestore.rules:143` (`allow get`) | per-doc get | Any single user profile in the tenant (name, role, branchId, unitId, photoURL, phone, bio, email). **No branch filter on the kiosk arm** — a kiosk can `get` any user doc by id, tenant-wide. |
| `tenants/{tid}/submissions/{id}` | `:285` (get), `:299` (list) | get + **list** | Weekly submission KPI docs. The `list` arm ORs `kioskCanRead` with no branch/agent constraint → a kiosk query can **list submitted reports across the whole tenant** (API, apps, activity, agentId, weekStarting). This is the widest exposure. |
| `tenants/{tid}/agentOfMonth/{monthKey}` | `:854` (`allow read`) | read (get+list) | Recognition records: winner agentUid, agentName, photoURL, achievementValue per category, per branch — tenant-wide. |
| `tenants/{tid}/leaderboards/{branchId}` | `:864` (get), `:870` (list) | get + list | Per-branch precomputed leaderboard aggregate. Kiosk arm has **no `branchId==token.branchId` clamp** (unlike the agent arm at `:867`), so a kiosk reads **every branch's** leaderboard, not just its own. |
| `tenants/{tid}/weeklyChampions/{weekStarting}` | `:891` (get), `:893` (list) | get + list | Tenant-wide weekly champion docs (topAPI/topApps/topActivity: agentId, agentName, value). Explicitly tenant-wide by design. |

**Blast radius summary:** a leaked/forged kiosk credential (1-year TTL, minted by any BM+ per SEC-003, validated by the public unauthenticated `validateKioskToken` per SEC-008) can read, **tenant-wide and across all branches**: every user profile, every submitted weekly report's production numbers, all Agent-of-Month records, all branch leaderboards, and all weekly-champion standings. It cannot write anything (all kiosk-armed collections are `write: if false` or manager-gated) and cannot reach money/policy/prospect/coaching/goals/moneyNeeds collections (no kiosk arm there — verified: the kiosk arms are exactly the 5 above). **The practical SEC-003 fix must therefore also add a `branchId` clamp to `kioskCanRead` (or the per-collection kiosk arms), not only the CF-side BM-branch check** — otherwise even a correctly-minted own-branch kiosk token still reads every branch. This sharpens SEC-003's recommendation: branch-scope the *rule*, not just the *mint*.

---

## 3. New findings (surfaces not covered by the 07-04 audit)

Beyond the §2c component findings (PERF-009/010/011, A11Y-001), one structural finding surfaced during the SEC-003 blast-radius trace and is promoted here because it is a distinct rules-layer gap, not a restatement:

| ID | Title | Sev | Conf | Location | Effort | Change-risk | Priority |
|----|-------|-----|------|----------|--------|-------------|----------|
| **SEC-012** | **`kioskCanRead` is tenant-wide, never branch-scoped** — the kiosk read predicate (`firestore.rules:54-56`) checks only `getTenantId() == tenantId`. Every kiosk-armed collection (users get, submissions get+list, agentOfMonth, leaderboards, weeklyChampions) is therefore readable across **all branches** in the tenant by any kiosk token, regardless of the token's own `branchId` claim. This is the *rules-side* companion to SEC-003 (which is the *CF mint-side* gap) and is independently exploitable: even without minting a cross-branch token, a single valid kiosk token over-reads. | High | Confirmed | `firestore.rules:54-56` + arms at `:143,:285,:299,:854,:864,:870,:891,:893` | S–M | Med (kiosk display UI may currently rely on tenant-wide reads; a branch clamp needs the kiosk UI to pass/hold a branchId — stage carefully) | **P1** |

No other new material issues were found in the surfaces incidentally traversed (firebase config, CI, vercel.json, the three components). The base audit's coverage of rules, `functions/index.js`, services, and money-write paths remains accurate and was not re-litigated.

---

## 4. Open findings by remediation surface (human-merge + deploy vs frontend-only)

Per project policy, `firestore.rules` / auth / claims / functions / config changes are **ALWAYS HUMAN-MERGE** and rules/functions/index changes take effect only after an explicit `firebase deploy`.

**Rules / Functions / config surface — human-merge + `firebase deploy` required:**
- **SEC-001** (`functions/index.js` `setUserClaims`) — deploy `--only functions`.
- **SEC-002** (`functions/agentOfMonth/*`) — deploy `--only functions`.
- **SEC-003** (`functions/kiosk/createToken.js` + `revokeToken.js`) — deploy `--only functions`.
- **SEC-012 (new)** (`firestore.rules` `kioskCanRead` + kiosk arms) — deploy `--only firestore:rules`.
- **SEC-004 / COST-001** (App Check) — Console registration + `src/firebase.js` (frontend) **and** enforcement toggle on Firestore/Functions (backend/Console) — mixed, but the enforcement half is a deploy/Console action.
- **SEC-005** (dependency upgrades in `functions/package.json` + root) — `functions/` deploy after upgrade + suite pass.
- **SEC-006** (author `storage.rules` + `firebase.json` block) — deploy `--only storage`.
- **SEC-009** (`.github/workflows/ci.yml` emulator + audit job) — CI config; merges normally but is infra, not frontend runtime.
- **PRIV-002** (erasure CF), **PRIV-004** (TTL/retention CF), **PRIV-005** (access-log emit) — new functions/rules; deploy required.
- **ARCH-001** (multi-tenant cron in `functions/index.js`) — deploy `--only functions`.
- **SEC-010, SEC-011, PERF-007** — `functions/` deploy.

**Frontend-only (Vercel auto-deploys on merge, standard PR path):**
- **SEC-007** (`vercel.json` headers/CSP) — config file, ships with the Vercel build (no `firebase deploy`).
- **PERF-001** (code-splitting: `React.lazy` + dynamic `import()`), **PERF-003** (virtualize MasterSheet), **PERF-004** (memoize `new Date()` props), **PERF-005/006** (client N+1 batching), **PERF-008** (`CashFlowChart` memo), **PERF-009/010/011 (new)**, **COST-002/003** (client read pagination/dedupe), **ARCH-002** (inline-style cleanup), **A11Y-001** (n/a — decorative).
- **PRIV-003** (DSAR export — `exportService.js`), **PRIV-006** (consent capture UI + service field — but the field also implies a rules allowlist entry → mixed).
- **BUG-001/PERF-002** (AgentDashboard campaign fan-out — client query shape; frontend, though the durable fix is a server-side aggregate = functions).

**Mixed (both surfaces):** SEC-004 (client init + server enforcement), PRIV-006 (client field + rules allowlist), BUG-001 (client now / CF later).

---

## 5. Top-5 risks as of 2026-07-05

| Rank | ID | Risk | Severity | Surface |
|------|-----|------|----------|---------|
| 1 | SEC-001 | `setUserClaims` still lets a tenant_admin grant `platform_admin`/cross-tenant claims | High (privilege escalation) | functions (human-merge + deploy) |
| 2 | SEC-002 / SEC-003 / **SEC-012** | Agent-of-Month + kiosk-token CFs not BM-branch-scoped, **and** the kiosk read rule itself is tenant-wide (SEC-012) — a single kiosk token over-reads every branch's users/submissions/leaderboards | High (cross-branch data exposure) | functions + rules |
| 3 | PRIV-002 / PRIV-006 | No erasure path + no consent/lawful-basis for third-party prospect/policyholder PII | High (compliance / T&T DPA + GDPR) | functions + client + rules |
| 4 | SEC-004 / COST-001 | App Check still unenforced → billable-abuse + un-attested-client vector | High (abuse + cost) | client + Console/backend |
| 5 | SEC-005 | 4 high (functions) + 2 high (root) dependency CVEs unremediated; recommended admin/functions major bumps not applied | High (supply chain / DoS) | functions + root deps |

PERF-001 (now quantified at ~1.13 MB gzip single-chunk first load) is the top **non-security** risk and the highest-leverage frontend-only quick win.

---

## 6. Self-critique (known gaps in THIS delta pass)

- **Rules still read statically, not emulator-executed.** The SEC-012 finding and the SEC-003 blast-radius enumeration are from reading `firestore.rules` line-by-line, not from running the excluded rules suite against the emulator. A `list`-vs-`get` short-circuit subtlety (the exact class of the SHAKEDOWN-002B and I1.2 collection-group incidents banked in CLAUDE.md) could still hide in the OR arms I traced. **What would overturn SEC-012:** an emulator test showing a kiosk-role token is in practice denied cross-branch `leaderboards`/`submissions` reads by some arm I mis-read — I judged this unlikely because the kiosk clauses contain no `branchId` token at all, but it is unverified at runtime.
- **`npm audit` reachability is advisory-only.** The high CVEs are DoS-class in transitive gRPC/protobuf/xml/form-data deps; I did not trace attacker-controlled input to each sink. `dompurify` in particular appears unreachable (no `dangerouslySetInnerHTML`, no direct call), so its moderate rating likely overstates real exposure.
- **Deployed state unverified (read-only limit, unchanged from base §7):** actual deployed Storage rules (SEC-006), Firestore region (PRIV-007), and App Check Console enforcement (SEC-004) still require Console access I do not have. The static findings hold regardless, but the *deployed* posture on those three is asserted from repo state, not observed.
- **Component sweep was the three named files + one child (`PlanSuggestionsCard`).** Sibling GamePlanV2 pieces (`SuggestedWeekCard`, `PlanCascade`, `ReviewCommitModal`, `MonthlyPlanModal`) and the financing/awards panel bodies the base audit also left un-sampled were not read — an unvirtualized list or missing cleanup there remains unassessed.
- **Build was run once, unprofiled.** Chunk sizes are from Vite's reporter output, not a source-mapped bundle analyzer, so the exact PDF-vs-Recharts-vs-app breakdown within the 3.95 MB chunk is inferred from the static import graph, not measured per-module.
