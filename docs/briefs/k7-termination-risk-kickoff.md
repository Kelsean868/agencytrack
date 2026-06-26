# K7 — termination-risk monitor + clause-5.3 notify duty — kickoff brief

**Authored:** post-#760 · dispatcher. **Legal-duty PR — ATTENDED.**
**Baseline:** origin/main `78fc703` (K6 fast-follow fill; #760 squash `942dd93`) — **Phase 0 re-verifies exact HEAD.**
**run_model:** `claude-opus-4-8` (money/legal-duty math + a Cloud Function + new collection/config + rules).
**Mode:** Attended. **Phase 1 ends in a hard-stop for dispatcher lock** (the mount + the CF surface + the config-doc shape). Then build to PR-open, **HOLD**.
**Merge class:** **Human-merge (Rule 19)** — money/legal logic, a Cloud Function, a new config doc + rules. Functions + rules always hold for human review. **+ operator pre-merge:** deploy rules AND the new CF.

## Header

| Field | Value |
|---|---|
| **Type** | Implementation PR — Track K · termination-risk monitor (clause 7.2c consecutive-miss, FLAG-ONLY) + clause-5.3 >10% notify-duty (manager-confirmed, server-side fire) |
| **Shape** | pure `financingMissEngine.js` (monthly miss verdict + consecutive counter) · `config/financingConfig` doc + `financingConfigService` (notify-recipient) · a K7 notify Cloud Function (`notifyFinancingAdjustment`) reusing the nudge transport · rules (config read + the notify path) · `FinancingRiskPanel.jsx` monitor surface · docs |
| **Size** | L–XL |
| **Branch** | `feat/k7-termination-risk` (own worktree: `git worktree add ../agencytrack-k7 -b feat/k7-termination-risk origin/main`) |
| **Sources** | `docs/track-k-financing-new-agent-design.md` §7/§8 · `docs/design/track-k-locked-decisions.md` (CD#3/#4/#5/#15/#16) · `BmAtRiskPanel.jsx` (monitor mirror) · `CompliancePanel.jsx` + `nudgeService.js` + `functions/compliance/sendComplianceNudge.js` (notify/transport mirror) · the deployed K1 terms / K5 proration ledger / K6 reconciliation (Phase 1 reads live) |
| **Risky classification** | **YES — Phase 1 hard-stop for dispatcher lock.** Legal-duty math + a CF + new config/rules. |
| **Smoke walk** | Emulator rules pre-merge + **seeded write-read-verify deferred to Phase 6** (operator deploys rules + the CF first; CF behavior verified via the emulator + a Phase-6 live fire). Offline + emulator green at PR-open. |
| **Strike count** | 0/2 |

---

## Context

K1–K6 are on main: terms (incl. `validatingAPI`), monthly ledger (`actualAPI`, per-month `validatingAPI`, `adjustmentPct`, `basisSource`), bonus engine, take-home, proration, reconciliation. K7 is the **risk monitor** — it consumes those inputs and surfaces two contract obligations without automating their consequences: the **7.2c consecutive-miss** termination condition (flagged, never auto-executed) and the **5.3 >10% downward-adjustment** notify duty (manager-confirmed, fired server-side to a configured recipient). "The year-end stops being a surprise, and the legal duties have a paper trail."

---

## Architectural decisions (locked at brief authoring — owner-confirmed this session)

### Miss definition (Decision 1 — the legal-trigger core)
1. A **monthly miss** = `actualAPI < validatingAPI` for that month (equivalently `prorationRatio < 1`), evaluated **only on a confirmed basis** (`basisSource` ∈ {`submitted-final`, `settled-confirmed`}; **never** `submitted-provisional` — CD#3). **Read the LEDGER MONTH's `validatingAPI`** (the amount in effect that month — preserves a mid-term Validation-Schedule downward adjustment), **NOT** the terms doc.
2. **Counter** = monthly and consecutive (CD#4). **Resets** on any confirmed month meeting the target (`actualAPI >= validatingAPI`). A **pending/unconfirmed** month (`submitted-provisional` or no entry) **neither counts nor resets** — the counter **holds** until the month confirms.
3. **Surfacing** (spec §8): amber at **2** consecutive misses, critical at **3** (the 7.2c condition met). **FLAG ONLY.**

### Termination (Decision 3 — FLAG ONLY, no status-machine change)
4. K7 **does NOT** add a `terminated` status, **does NOT** auto-transition any agent's `financingStatus`, and **does NOT** touch `LEGAL_TRANSITIONS` (B.9 forward-only stays intact). At 3 consecutive misses K7 **flags that the 7.2c auto-terminate condition is met** — the actual termination is a **human/admin action** outside K7. K7 is a monitor that recommends; the disposition stays with a person. (An explicit admin-driven `terminated` transition is a separate future decision — out of scope.)

### >10% notify duty (Decisions 2 + 4 — manager-confirmed, server-side fire, configured recipient)
5. The **5.3 flag** surfaces automatically when `adjustmentPct > 0.10` on a **confirmed** (non-null) value (denominator `currentMonthlyFinancing`, CD#5; `adjustmentPct > 0` is a cut below current). Routine proration does not raise it.
6. The **notify is MANAGER-CONFIRMED, not auto-fired** (CD#5 "don't spam the duty"). The BM (UM excluded; BM-and-up) clicks a notify affordance (mirror `CompliancePanel`'s nudge + cooldown) to **discharge** the duty. A cooldown/dedupe record prevents re-firing on routine re-confirmation of an already-flagged cut.
7. **The notify fires SERVER-SIDE via a NEW K7 Cloud Function** (`notifyFinancingAdjustment`), **NOT** `sendComplianceNudge`. Reason (Phase-1-verified): `sendComplianceNudge`'s `targetInScope` rejects a tenant-level recipient for a BM caller (`target.branchId === caller.branchId`), and its audience model assumes caller-scoped *agents* — a tenant-level CRO recipient inverts that. The K7 CF resolves the configured recipient **server-side** (config-driven, not caller-supplied → the cross-branch concern is contained) and **reuses the TRANSPORT** (the atomic batch: bell `tenants/{tid}/notifications/{autoId}` with the existing `{userId,tenantId,type,title,body,link,read,createdAt}` schema + a `mail/` email doc + a **tenant-scoped** `tenants/{tid}/auditNudges/{autoId}` audit append for the 5.3 paper trail — who/when/payload, CD#15), **NOT** the caller-scoped audience-resolution.
8. **Recipient config (Decision 2):** a new `tenants/{tid}/config/financingConfig` doc + `financingConfigService` (mirror the established `config/{concern}`+service pattern — `companyMinimums`/`managerActivityStandards`/`awardsRuleset`), field `notifyRecipientUid` (the CRO-function uid today; re-points cleanly when a `cro` role is built — do NOT invent a `cro`/`sales_admin` role, that's a roles-hierarchy change out of scope). App tolerates absence: if `notifyRecipientUid` is unset, the notify affordance is **disabled with a "no recipient configured" state**, never a silent no-op.

## Out of scope

- Auto-terminate / any `financingStatus` change / a `terminated` state / `LEGAL_TRANSITIONS` edit (Decision 3) · building the `cro` role (config-driven uid only) · the validation dashboard + full multi-period live wiring + drill-down → **K8**
- Re-implementing the credit filter / proration / reconciliation (reuse K3/K5/K6) · auto-firing the notify (manager-confirmed only) · using `sendComplianceNudge` directly (new CF)

## Phase 0 — gate

Own worktree `git worktree add ../agencytrack-k7 -b feat/k7-termination-risk origin/main`; launch CC **from inside** it. Re-verify `git rev-parse --abbrev-ref HEAD` == feat/k7-termination-risk at EVERY phase gate. Clean tree. STOP on divergence.

## Phase 1 — source-verify (ends in a hard-stop for dispatcher lock)

1. `git ls-files` the sources (spec §7/§8, addendum CD#3/#4/#5/#15/#16, `BmAtRiskPanel.jsx`, `CompliancePanel.jsx`, `nudgeService.js`, `functions/compliance/sendComplianceNudge.js`) → tracked. Missing → STOP.
2. Greenfield grep: `financingMiss` / `financingConfig` / `notifyFinancingAdjustment` / `FinancingRiskPanel` new. Confirm no `terminated` status exists (re-confirm B.9 `LEGAL_TRANSITIONS`).
3. **Miss-input verification (load-bearing).** Confirm the per-month ledger doc carries `actualAPI`, `validatingAPI`, `basisSource` (Decision 1 reads these). Quote the field set + the K5 write site. If `validatingAPI` is NOT snapshotted per-month to the ledger (only on terms) → STOP and surface (Decision 1 depends on the per-month value).
4. **>10% input verification.** Confirm `adjustmentPct` on the ledger (nullable until manager-confirmed) + the `currentMonthlyFinancing` denominator. Quote the write site.
5. **Notify-transport verification (load-bearing).** Re-read `sendComplianceNudge.js`: confirm the transport artifacts (bell schema, `mail/` doc, tenant-scoped `auditNudges`) the K7 CF will reuse, AND re-confirm `targetInScope` would reject a tenant-level recipient for a BM caller (the reason for a new CF). If the scope model differs from the recon → surface.
6. **Config-doc verification.** Confirm the `config/{concern}`+service pattern (read `goalsService`/`managerActivityStandardsService` config reads) to mirror for `financingConfigService`. Confirm no existing financing-config doc/FU pre-decides the home (grep FOLLOW_UPS for `financingRuleset`/`financing config`).
7. **Recommend the locks (the dispatcher decision):** (a) the monitor mount — a new `FinancingRiskPanel` sub-view in `FinancingTab` (now Terms·Ledger·Proration·Take-Home·Reconciliation·**Risk** = 6)? Confirm file:line. (b) the notify-affordance + cooldown shape (mirror `CompliancePanel`). (c) the `financingConfig` doc field set + the `financingConfigService` read shape. (d) the K7 CF signature (`notifyFinancingAdjustment(agentId, month, payload)` → resolves recipient → transport batch). (e) mockup parity vs `Track K Validation Dashboard - Manager Build.html` (the "Notify Sales Admin →" affordance) — confirm what's K7 vs K8's dashboard.
8. Mockup parity — list anything drawn but out of K7 scope (esp. K8 dashboard, any auto-terminate UI).

**Report 1–8, then STOP and wait for dispatcher.** No build until the mount + CF surface + config-doc shape are locked. Hard-stop-and-HOLD also on #3/#5 missing load-bearing source.

## Phase 2 — build (after dispatcher lock)

1. `financingMissEngine.js` — pure: `computeMonthlyMiss(monthRow)` (confirmed-basis verdict) + `computeConsecutiveMisses(rows)` (counter with hold-on-pending, reset-on-meet) + the >10% flag predicate. Exhaustive tests (miss/meet/pending-holds/reset; the amber-2/critical-3 boundaries; >10% on confirmed vs null; the polarity).
2. `config/financingConfig` rules block (read by managers + the CF; written by tenant_admin/platform_admin) + `financingConfigService` (get/set `notifyRecipientUid`) + emulator rules tests.
3. The K7 Cloud Function `notifyFinancingAdjustment` (functions/) — resolves `config/financingConfig.notifyRecipientUid` server-side, writes the transport batch (bell + mail + tenant-scoped audit), returns a cooldown record. `Timestamp.now()` for any in-array value (never `serverTimestamp()` in arrays). Reuse `buildMailDoc`/the batch pattern; do NOT call `sendComplianceNudge`.
4. `FinancingRiskPanel.jsx` at the locked mount — the consecutive-miss monitor (amber-2/critical-3, mirror `BmAtRiskPanel` accents) + the 7.2c "condition met" flag (FLAG ONLY, no terminate action) + the >10% flag + the manager-confirmed notify affordance with cooldown (disabled "no recipient configured" when unset). Nexus tokens, both themes, 44px.

## Phase 3 — verification

- Lint 0 · build green · full suite green (+ new emulator rules tests + CF unit tests).
- Hex-grep new/changed → clean. axe on the new surface (both themes).
- **Offline + emulator are the PR-open bar.** The seeded write-read-verify + a live CF fire are **Phase 6** (deploy-gated, Rule 19): seed an agent with a confirmed miss streak → counter surfaces amber/critical; seed a >10% confirmed cut → flag surfaces → manager-confirm → the CF fires to a configured recipient → bell + audit persist (value-level read-back) → cooldown blocks a re-fire. Note clearly the write/CF verification is deferred.

## Phase 4 — docs (placeholders)

- `docs/CONTEXT.md` — recently-shipped row (`#TBD`), top table → K7 shipped, Where-we-left-off. Size cap.
- `docs/FOLLOW_UPS.md` — bank: (a) the **`cro` role** buildout (K7 uses a config uid; re-point when the role lands); (b) any K8 dependency on K7's miss-counter/flag state; carry the K7-banked items.

## Phase 5 — commit / push / PR

Conventional commits. Green gates. PR via `gh`: title `feat(k7): termination-risk monitor + clause-5.3 notify duty (Track K)`; description = outcome + the worked miss-counter examples (a reset, a hold-on-pending, an amber-2, a critical-3) + the >10% worked example + the Phase-1 verification results + the explicit note that the CF fire + write-read-verify are deferred to Phase 6. **Rule 15** paste-back. **Rule 20** HEAD SHA. Reviewers: CodeRabbit auto + **on-demand `/gemini review`** (money/legal CF — use the explicit trigger via PowerShell; the auto-batch is weaker). Poll BOTH, disposition all (Rule 21). Do NOT merge. Surface PR URL, then **STOP and wait for dispatcher**.

## Phase 6 — held (operator-gated)

Operator deploys **rules AND the new CF** from `../agencytrack-k7` (`cd` there first — the cwd-rules/functions lesson; verify the live ruleset createTime advances + the `financingConfig` block present + the new CF deployed, Rule 23/24). Then CC runs the seeded write-read-verify + the live CF fire (value-level), Admin-SDK cleanup. Human-merge → `/post-merge <pr#>` (Sonnet) — no rules/CF re-deploy.

## Strike rules

Session opens 0/2. Hard stops (Rule 12 phrasing only):
- Phase 1 ends in the mandatory dispatcher lock (mount + CF surface + config shape) → **STOP**
- Phase 1 #3/#5 missing load-bearing source (per-month `validatingAPI`; the transport/scope model) → **STOP and HOLD**
- Any decision not pre-listed (Rule 1) — esp. ANY `financingStatus`/`LEGAL_TRANSITIONS` change, a `terminated` state, building a `cro` role, or auto-firing the notify → **STOP**
- Phase 2 scope expansion — K8 dashboard, using `sendComplianceNudge` directly, auto-terminate → **STOP**
- Phase 3 lint/build/suite/axe/emulator failure after one fix attempt → **STOP**
- A wrong-worktree/wrong-branch detection at any phase gate → **STOP IMMEDIATELY**
