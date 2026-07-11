# Fable Run 5 — Progress Log

Run start (TT): 2026-07-11 (attended). Start HEAD: `942ab252` (staging == main).
Brief: [`docs/briefs/fable-run5-kickoff.md`](briefs/fable-run5-kickoff.md).
Design authority: [`docs/design-system/screens-v2/design_handoff_company_config/`](design-system/screens-v2/design_handoff_company_config/README.md).
Real-defaults sources: [`docs/audits/company-config-recon-2026-07-11.md`](audits/company-config-recon-2026-07-11.md) + [`docs/audits/tenant-config-audit-2026-07-10.md`](audits/tenant-config-audit-2026-07-10.md).

## Checklist

| Item | Status | Notes |
|------|--------|-------|
| 0.1 Handoff relocation + catalog + recon landing | ✅ | `325f539b`; hygiene fix `02d8d58f` (untracked 799 Run-4 `out/` debris swept by broad add; sha256 credential check: both literal fixture passwords byte-identical to already-tracked staging values — no new exposure, no rotation) |
| 0.2 Run docs committed | ✅ | `7eae1f48` |
| 0.3 Baseline re-seed + full VH suite (39 legs) | ✅ | re-seed 94 docs → **39/39 PASS, 0 FAIL, 0 SKIP**. Log: out/run5-baseline-vh.log |
| Item 1 Config substrate (configService + registry + ConfigProvider) | ⏳ | |
| Item 2 Shell + row grammar (Company Config route) | ✅ | kit `16facd43` + surface (this commit): 12 registry-driven sections, rail + SOON tags + override dots, five-state grammar, ⌘F palette (container-scroll jump + 2s flash, reduced-motion static), draft/save lifecycle w/ real user count, history drawer reading configAudit; narrow <880px list→drill-in. Orchestrator fix: platform rows show REAL value in mono slot (ConfigRow) per grammar state 4 |
| Item 3 Audit log (configAudit + rules arm, emulator-first) | ✅ | `52979762` (configAuditService, batched with every config write) + `95be99f1` (append-only rules arm, emulator 16/16); history-drawer read lands with Item 2 |
| Item 4 Live-wire: 4a Activity Standards · 4b Awards (whole-object exception) · 4c Feature Flags · T&M read-only | ✅ | 4a: purpose-built ActivityStandardsEditor (real 8-key × 3-role schema; kit's StandardsTable modeled the mock schema — couldn't represent booleans/fixed keys honestly); **override counts UNAVAILABLE** (managerActivityStandardOverrides `allow list: if false`, rules:1574 — em-dash + tooltip, banked below). 4b: AwardsRulesetPanel embedded w/ `embedded` prop, whole-object write path kept + exception comment. 4c: flags panel (3 real flags, danger confirm, immediate commit + audit, meta provenance). T&M read-only from live companyMinimums values + legacy-editor drawer (operator ruling) |
| Item 5 Rules: flags allowlist arm + configAudit arm → deploy-staging.ps1 | ✅ | `95be99f1` — settings featureFlags/featureFlagsMeta MapDiff allowlist (emulator 14/14; non-allowlisted keys can't be added/modified/removed by clients; other config docs regression-tested); triple-copy cross-check test 3/3; **deployed to agencytrack-staging** (orchestrator, per brief; functions all skipped-no-changes) |
| Item 6 VH legs: t1-company-config + flags leg | ✅ | `cbf527d7` — both legs PASS live (write-read-verify, reset proves KEY ABSENT via staging-pinned Admin read, audit entries asserted incl. to=DEFAULT and flag ON↔OFF; flags leg ends at seeded state); t3-flag-gated-shells regression PASS; new shared admin-read.mjs (read-only, aborts on prod id) |
| E1 re-seed + full suite (39 + new) vs deployed rules | ✅ | re-seed 94 docs → **41/41 PASS, 0 FAIL, 0 SKIP** (incl. t1-company-config + t1-company-config-flags). Final unit suite 5252/5252. No regressions, no reverts. Log: out/run5-e1-final-vh.log |
| E2 final doc + push | ✅ | this commit; verbatim origin line in § Handoff |
| E3 HOLD | ✅ | no merges to main, zero prod contact, nothing further |

## Dispatch / telemetry (per-part model routing)

| Item / part | Model | Started (TT) | Ended | Outcome | SHA(s) |
|------|-------|--------------|-------|---------|--------|
| 0.1 relocation + hygiene fix | Fable (orchestrator) | ~17:15 | ~17:40 | ✅ | `325f539b`, `02d8d58f` |
| 0.2 run docs | Fable (orchestrator) | ~17:45 | ~17:50 | ✅ | `7eae1f48` |
| 0.3 baseline seed + 39 legs (bg) | orchestrator | ~17:50 | ~17:58 | ✅ 39/39 | — |
| Item 1A configService + ConfigProvider + audit service | **Opus 4.8** | ~18:05 | +24.2 min | ✅ 29 tests; full suite 5234 | `52979762` (shared) |
| Item 1B registry port + parity tests | **Sonnet** | ~18:05 | +8.6 min | ✅ 36/36 parity; 4 stale citations corrected | `52979762` (shared) |
| Item 2B presentational kit | **Sonnet** | ~18:10 | +9.0 min | ✅ 7 RTL tests | `16facd43` |
| Items 3+5 rules + emulator tests | **Opus 4.8** | ~18:25 | +12.3 min | ✅ emulator 30/30 + cross-check 3/3 | `95be99f1` |
| Items 2A+4 surface + live wiring | **Opus 4.8** | ~18:25 | +41.7 min | ✅ full suite 5252; build clean | `a735922c` |
| staging rules deploy (deploy-staging.ps1) | Fable (orchestrator) | ~18:40 | ~18:45 | ✅ rules+indexes → agencytrack-staging only (functions no-change) | — |
| Visual probe + fixes (both themes + mobile) | Fable (orchestrator) | ~19:05 | ~19:40 | ✅ 3 defects caught+fixed, hygiene clean | `0b69b769` |
| Item 6 VH legs | **Sonnet** | ~19:15 | +29.3 min | ✅ 2 legs PASS live + regression | `cbf527d7` |

**Routing notes:** no Haiku anywhere (per rails); no gate-failure escalations were needed — every down-routed Sonnet part passed its gates first time. The one mid-run collision (probe fix `0b69b769` landing while the Sonnet legs agent iterated) was absorbed by the legs agent with correct diagnosis (verified the write path via Admin reads before adjusting its visual assertion).

## Locked decisions in force (from brief — do not re-litigate)

Diff-only storage + delete-on-reset · awards accessor contract (not its storage) · ConfigProvider forward-only (no 25-consumer retrofit) · effective-dating engine = slice 2 (T&M not live-wired) · MDRT not configurable · manager overrides / RANK BY / kiosk / financing / CF constants stay put.

## Awards exception (Item 4b — explicit)

Awards & Clubs keeps `awardsRulesetService`'s validated-complete **whole-object** write path this run. The row grammar renders its states, but storage is NOT diff-only for awards until slice 2. This is the one deliberate deviation from the diff-only invariant, per operator lock #2.

## Operator rulings received during run

1. **Old-panel disposition (Item 4a/4b):** legacy editor link-through. ActivityStandardsPanel + AwardsRulesetPanel stacked mounts removed (editing re-homes into the new surface); CompanyConfigPanel (companyMinimums editor) stays reachable via a quiet "Edit minimums (legacy editor)" affordance in the read-only Targets & Minimums section, opening in a drawer. Retires when slice 1.5 lands the dating engine.

## Orchestrator design rulings (within brief rails — reviewable)

1. **Plain-legacy adapter mode:** `managerActivityStandards` (CF reader expects plain role maps) and `settings.featureFlags` (`isFlagOn === true`) cannot carry envelope provenance without breaking production readers. configService ships three modes: envelope (forward substrate), plain-legacy (+ root updatedBy/updatedAt), flag (+ `featureFlagsMeta` sibling for ON-state provenance). Delete-on-reset identical in all modes.
2. **No fabricated values:** registry items with no backing code constant are `unbacked` and render em-dash + SOON — prototype fictions (Monday week-start, grace period, 80% pace default…) were corrected or dropped; all deviations carry file:line citations in the registry.
3. **⌘F only** for find-a-setting (⌘K is owned by the app's global command palette), bound only while the surface is mounted.

## Orchestrator visual probe (both themes + mobile, post-deploy)

Walks at `a735922c` and `0b69b769` (out/run5-ccfg-probe + out/run5-ccfg-reprobe, gitignored): light/dark/mobile all hygiene-clean (0 prod requests / 0 page errors / 0 console errors). Caught + fixed in `0b69b769`: Recognition points-table field-shape mismatch (blank activity/code cells), fictional ÷48 weekly-floor column on the bands table (registry copy disclaimed it, kit still rendered it), floating DEFAULT tag on bare table items. Verified fixed + dark-mode verified via the app's real toggle. Polish nit banked (non-blocking): points table sits beside its label instead of wrapping full-width (flex-wrap artifact of min-w-[380px]).

## DECISIONS-NEEDED

1. **Override-count indicator needs a rules extension.** `managerActivityStandardOverrides` deliberately has `allow list: if false` (forgery-prevention arm, firestore.rules:1519-1575), so tenant_admin cannot count per-standard overrides and the 4a "N managers override this" column renders em-dash + tooltip. Options for a later slice: (a) add a tenant_admin-scoped `list` arm, (b) denormalized counter doc maintained by the override writer, (c) drop the indicator. Rules change was out of this run's locked scope (Items 3+5 only).
2. **Platform-locked palette previews** show HARDCODED/PLATFORM per README §Find-a-setting while rows show the real value — confirm this split is the intended reading of the spec.

## Handoff

**What shipped (staging only, 7 commits `325f539b` → `cbf527d7`):** the full Company Config slice 1 — diff-only config substrate (configService 3 modes + configAuditService + ConfigProvider/useConfig, forward-only), the 46-item real-defaults registry with 36 parity tests, the five-state row-grammar surface (12 sections, ⌘F palette, history drawer, draft/save, mobile drill-in), live wiring for Activity Standards (plain-legacy mode) + Feature Flags (allowlisted, danger confirm, meta provenance) + Awards (whole-object exception, embedded editor), T&M read-only + legacy-editor drawer, configAudit + flags-allowlist rules (emulator 30/30, deployed), and two new VH legs. E1: 41/41 vs deployed rules; unit suite 5252/5252.

**Slice 1.5 / 2 pickups:** effective-dating engine + T&M live-wiring (+ retire the legacy CompanyConfigPanel drawer) · correction flow (audit schema already correction-ready) · awards diff-only migration · override-count rules extension (DECISIONS-NEEDED #1) · points-table full-width wrap polish nit · envelope mode's first real consumer.

Final origin tip = this E2 docs commit (`docs(run5): E2 close-out`) — the verbatim `git log origin/staging --oneline -1` capture is in the run-close operator report (a doc cannot quote its own future SHA; Rule 17 chicken-and-egg).
