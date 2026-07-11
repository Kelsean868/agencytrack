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
| Item 6 VH legs: t1-company-config + flags leg | ⏳ | |
| E1 re-seed + full suite (39 + new) vs deployed rules | ⏳ | |
| E2 final doc + push | ⏳ | |
| E3 HOLD | ⏳ | |

## Dispatch / telemetry (per-part model routing)

| Item / part | Model | Started (TT) | Ended | Outcome | SHA(s) |
|------|-------|--------------|-------|---------|--------|
| 0.1 relocation + hygiene fix | Fable (orchestrator) | ~ | ~ | ✅ | `325f539b`, `02d8d58f` |
| 0.2 run docs | Fable (orchestrator) | | | ✅ | (this commit) |

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

## DECISIONS-NEEDED

1. **Override-count indicator needs a rules extension.** `managerActivityStandardOverrides` deliberately has `allow list: if false` (forgery-prevention arm, firestore.rules:1519-1575), so tenant_admin cannot count per-standard overrides and the 4a "N managers override this" column renders em-dash + tooltip. Options for a later slice: (a) add a tenant_admin-scoped `list` arm, (b) denormalized counter doc maintained by the override writer, (c) drop the indicator. Rules change was out of this run's locked scope (Items 3+5 only).
2. **Platform-locked palette previews** show HARDCODED/PLATFORM per README §Find-a-setting while rows show the real value — confirm this split is the intended reading of the spec.

## Handoff

(filled at E2)
