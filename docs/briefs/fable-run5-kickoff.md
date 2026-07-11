# Fable Run 5 — Kickoff Brief (Company Config, Slice 1)

**Mode:** ATTENDED autonomous run on **STAGING**. No fixed window — run until the item list completes; the E1/E2 reserve is mandatory before E3 HOLD. Operator present: any product/design ruling → **PING and WAIT** (no timeout-defaulting this run). One-line status at each item completion.
**Branch:** `staging` in the `at-fable-staging` worktree; push per item so staging Vercel rebuilds for live smokes.
**Orchestrator:** Fable 5. Start HEAD: `942ab252` (staging == main post Runs-3+4 promotion).

## Hard constraints (standing)

- Never touch prod (`agencytrack-2a610`) — hygiene legs assert zero prod requests.
- Never merge to main. No payout-release logic.
- Seeder always `--env-file=.env.staging`.
- Smokes: value-level as owning subject; write-read-verify for mutations; console-clean everywhere.
- Staging Firebase deploys ONLY via `scripts/staging/deploy-staging.ps1` (orchestrator action, Rule 19).
- Rules changes: emulator tests FIRST → staging deploy → live verify.

## Design authority

`docs/design-system/screens-v2/design_handoff_company_config/` — **README.md is the spec** (read end-to-end first); `Company Config Prototype.html` + `cc-proto-*.jsx` are the acceptance criteria (run the prototype, click every interaction). **RECREATE in the repo's real stack; never copy prototype code verbatim.**

**CRITICAL:** the prototype's seeded data (Alicia Gopaul / Rajiv Maharaj, "214 users", TTD 9.60M, override counts) is **FICTIONAL** — port the registry STRUCTURE; every default VALUE comes from the real code constants inventoried in [`docs/audits/company-config-recon-2026-07-11.md`](../audits/company-config-recon-2026-07-11.md) and [`docs/audits/tenant-config-audit-2026-07-10.md`](../audits/tenant-config-audit-2026-07-10.md) (grep-verify each against HEAD, Rule 17). The "214 users" copy becomes the tenant's real user count at runtime.

## Operator-locked decisions (do not re-litigate)

1. **Diff-only storage:** config docs store ONLY keys differing from code defaults; absent = code default (fail-closed, `featureFlags` pattern); reset-to-default **DELETES the key**, never writes the default back.
2. **Adopt the awards accessor contract** (deep-merge-to-default, `getMerged*` vs raw split) as the read pattern; do NOT adopt its whole-object storage.
3. **ConfigProvider** (app-mount hydration, load-once) + `useConfig(path, default)` introduced this run, **FORWARD-ONLY** — no retrofit of the ~25 existing consumers (companyMinimums / awards / standards keep their current read paths).
4. **Effective-dating ENGINE + correction re-derivation are SLICE 2** — not this run. Targets & Minimums is therefore NOT live-wired (Item 4).
5. **MDRT values:** not configurable this run (rename precursor banked separately).
6. Per-manager activity overrides stay in the manager flow; RANK BY stays a user pref; kiosk/financing/CF constants stay code.

## Subagent routing rails

Route by the **cost of a subtle error**, not item size. Decompose items; never pin a whole item to Opus because one part needs it.

**Opus 4.8 floors:** Item 1 configService write semantics + ConfigProvider contract; Item 3 audit-log rules arm + Item 5 rules changes; Item 4b awards-exception boundary.
**Sonnet 4.6 floor everywhere else** — no Haiku anywhere this run.
**Explicit down-routes (Sonnet):** Item 1 registry data-entry port + default-parity cross-check tests; Item 2 presentational components (rail, group cards, palette UI — draft/save STATE MACHINE stays Opus); Item 4a/4c panel re-homing + flags panel UI; Item 6.
**Escalation rule (no ping needed):** down-routed output fails its gate twice, OR the task turns out to touch the diff-only invariant / rules / cross-bundle boundaries → re-dispatch that part on Opus, note in telemetry.
Record per-part model choice in the telemetry table.

## Items

**0.1** Relocate `design_handoff_company_config/` → `docs/design-system/screens-v2/` + catalog entry; gitignore `_ds/`. Commit.
**0.2** Run docs (this brief + progress doc). Commit.
**0.3** Baseline: re-seed (env-file) + full VH suite (39 legs). Non-flake failure → investigate; unresolved → PING.

**Item 1 — Config substrate.** `configService`: grouped-doc reads under `tenants/{tid}/config/*`, diff-only writes, per-key provenance `{value, who, date}` on write, delete-key on reset. Registry-driven typed module ported from `cc-proto-data.jsx` STRUCTURE (sections → groups → items: id/type/default/lock/tier/dated) with REAL defaults wired to existing code constants. `ConfigProvider` + `useConfig(path, default)`: app-mount hydration, fail-closed to code default on absence/error. Unit tests: absent key = default; diff-only write shape; reset deletes; provenance recorded; registry default parity with cited code constants (cross-check test per section).

**Item 2 — Shell + row grammar.** Company Config route (tenant-admin gated), in-screen left rail (12 sections, 5 groups, SOON tags, override-dot markers), five-state row grammar per README (inherited / overridden / draft / platform-locked / hardcoded-unlocks-tier), group cards, gold eyebrows for Recognition only, Cmd-F find-a-setting palette (jump + flash, reduced-motion static), draft-save lifecycle (floating save bar, per-key commit, toast with REAL user count), change-history drawer reading the audit log. All 12 sections RENDER from the registry; future sections show SOON banner + honest lock states with real read-only values.

**Item 3 — Audit log (minimal; operator un-banked into slice 1).** Append-only `tenants/{tid}/configAudit`: `{settingId, section, from, to, who, whoName, at, correction?: reason}` — written on every save/flag flip. Rules arm: create-only for tenant_admin/platform_admin in-tenant, no update/delete, shape-validated. Emulator tests. Schema must accommodate future CORRECTION entries without migration. History drawer reads it.

**Item 4 — Live-wire three sections.**
- **4a Activity Standards** — re-home existing panel's editing into the new surface (same `config/managerActivityStandards` doc, now through configService); read-only "N managers override this" indicator (count from `managerActivityStandardOverrides`). Old panel location: link-through or remove per cleanest path — **PING operator with recommendation before deleting UI**.
- **4b Awards & Clubs** — re-home AwardsRulesetPanel editing; KEEP the existing awardsRulesetService write path (validated-complete whole-object stays for awards THIS RUN — diff-only migration is slice 2; row grammar still renders its states). Note the exception in code comments + progress doc.
- **4c Feature Flags** — net-new panel: allowlist from `flag-toggle.cjs` `ALLOWED_FLAGS`, fail-closed copy, danger-enable inline confirm, immediate commit + audit entry, provenance on ON state.
- **Targets & Minimums**: renders from the registry with real current values, edit controls DISABLED with dated/tier chips per the grammar — live-wiring is slice 1.5 (needs the dating engine). State this honestly in section body copy.

**Item 5 — Rules (emulator-first).** Tighten `config/{docId}` wildcard minimally: (a) `settings.featureFlags` writes may only touch allowlisted flag keys (server-side ALLOWED_FLAGS mirror — note CJS/rules duplication, add cross-check test); (b) configAudit arm per Item 3. Do NOT add full per-doc shape validation (banked hardening). `deploy-staging.ps1` after emulator green.

**Item 6 — VH legs.** New `t1-company-config` leg — as tenant_admin: open route, Cmd-F jump to a setting, edit one Activity Standard, save, re-read after reload (write-read-verify), reset-to-default and verify the KEY IS ABSENT from the doc (direct Firestore read via harness), audit entry exists. Flags leg — enable an allowlisted flag via confirm flow, verify fail-closed OFF→ON, audit entry, disable, verify key deleted. Extend nothing else unless regression demands.

## Run end

**E1** re-seed + full suite (39 + new legs) against deployed rules; regression → PING operator (attended — no auto-revert without a ping).
**E2** progress doc: final table, per-part model telemetry, SHAs, DECISIONS-NEEDED, handoff; verbatim `git log origin/staging --oneline -1`.
**E3 HOLD.**
