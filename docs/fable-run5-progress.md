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
| Item 2 Shell + row grammar (Company Config route) | ⏳ | |
| Item 3 Audit log (configAudit + rules arm, emulator-first) | ⏳ | |
| Item 4 Live-wire: 4a Activity Standards · 4b Awards (whole-object exception) · 4c Feature Flags · T&M read-only | ⏳ | |
| Item 5 Rules: flags allowlist arm + configAudit arm → deploy-staging.ps1 | ⏳ | |
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

## DECISIONS-NEEDED

(accumulates during run)

## Handoff

(filled at E2)
