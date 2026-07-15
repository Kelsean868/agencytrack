# Fable Run 6 — Kickoff Brief (20h unattended, STAGING)

Operator brief, received 2026-07-11 (TT). Orchestrator: Fable 5. Operator ASLEEP — no pings.
Any product/design ambiguity → bank to DECISIONS-NEEDED in the progress doc and continue with the stated default. E1/E2 reserve (last 90 min) is mandatory. Work on `staging` in the `at-fable-staging` worktree; push per item so staging Vercel rebuilds for live smokes.

## Hard constraints

- **Never touch prod** (`agencytrack-2a610`) — hygiene legs assert zero prod requests.
- **Never merge to main.**
- Seeder always `--env-file=.env.staging`.
- Smokes = value-level as owning subject, write-read-verify for mutations, console-clean everywhere.
- Staging Firebase deploys ONLY via `scripts/staging/deploy-staging.ps1` (brief-authorized autonomous, staging-only).
- Rules changes (if any): emulator tests FIRST → staging deploy → live verify — autonomous, staging-only.

## CAMPAIGNS HARD STOP (absolute)

Persistency-gate + tier-ladder may be built as DISPLAY/PROJECTION only. NO write path that marks a payout owed/released/paid; no "Confirm & release"; no AwardWinners close. If the gate requires a new write path or data that does not exist → STOP the item, bank it, move on. No fabricated money math, ever.

## Subagent routing rails

- **Opus 4.8 floor:** Phase-0 revalidation judgment · `.catch`-swallow disposition (judgment, not find-replace) · any rules change · Campaigns gate math.
- **Sonnet 4.6 floor** everywhere else. No Haiku.
- Down-route to Sonnet: mechanical component edits (skeleton swaps, focus-trap application, sticky-table CSS), the two deletions, test authoring.
- Two-strike escalation one tier up, noted in telemetry. Per-part model choice recorded in the E2 telemetry table.

## Run plan

**0.1** Run docs (this brief + `docs/fable-run6-progress.md`). Commit.
**0.2** Baseline: re-seed (env-file) + full VH suite (41 legs). Non-flake failure → investigate; unresolved after 60 min → restrict night to PHASE 0 + TIER 0 §1 only.

### PHASE 0 — Revalidate the build map (Opus 4.8; NEVER DROPPED)

`docs/audits/design-conformance-2026-07-07.md` is CONTEXT.md's declared active build map but is STALE (pre-Nexus-v2-promotion, pre-Runs 3/4/5). Verified-stale examples to confirm (not trust): ⌘K command palette (shipped Tier 1) · agent Prospect Prep un-gated · prospect-prep sort fixed (ASC) · 8-stage recruiting kanban (Tier 2.2) · WAR reviewer workflow (C3) · kiosk theatrical surface (3.6) · consolidated Settings + tenant-admin toggles (superseded by Settings split ruling: My Preferences = user prefs, Company Config = tenant policy; Company Config slice 1 shipped, registry-driven, 12 sections).

TASK: produce `docs/audits/design-conformance-2026-07-12.md` with MANDATORY validity-SHA header (the HEAD it describes). Re-verify EVERY finding in the old audit against current HEAD with file:line citations (Rule 17 — grep-verify, never assert from the old doc). Classify each: STILL-VALID / RESOLVED-SINCE (cite shipping commit or file:line) / SUPERSEDED (cite what absorbs it). Recount buckets honestly. Mark old audit superseded in CONTEXT.md's Active-track line. New doc becomes the build map. Do NOT delete the old audit.

### TIER 0 — Systemic contract sweep

**§1 FOUR-STATES** (Opus for swallow disposition, Sonnet for mechanical edits; NEVER DROPPED). Every panel handles loading / error / empty / populated.
- (a) SILENT SWALLOWS — judgment. Sites include TenantAdminDashboard (3 fetches console.error-only), CampaignPanel, Production views, any `.catch(() => [])` / `.catch(() => null)` in services. OPERATOR RULE (locked): surface errors that indicate FAILURE; KEEP swallows that encode legitimate absent-means-X semantics (e.g. absent weeklyPlan = "not committed" — deliberate locked design). EVERY site touched or skipped gets a category + reasoning row in the progress doc. Unsure → KEEP, bank, move on.
- (b) ERROR CARDS: every error state gets Retry (copy reference implementations — UserManagementPanel, CompliancePanel, bulk-import).
- (c) LOADING: replace spinners/text/em-dash-stuck-tiles with PanelSkeleton.
- (d) EMPTY STATES (locked): CTA where an honest action exists; honest descriptive empty where not. NEVER fabricate a CTA.
- (e) Partial-failure banners where a multi-fetch surface can half-succeed.
- Live-smoke highest-traffic touched surfaces: loading→populated and error→Retry.

**§4 FOCUS-TRAP** (Sonnet): apply EXISTING useFocusTrap + Escape + focus-return to: DeactivateBranchConfirmDialog, PlanCatalogModal, WelcomeScreen, PolicyDrillDrawer, PersistencyPlayground, EditUserDrawer, MeetingMode overlay. No new focus machinery. Tests per dialog: trap-in, Escape closes, focus returns to trigger.

**SMALL RULED ITEMS** (Sonnet; operator-ruled):
- S1. DELETE `src/components/daily/DailyEntryModal.jsx` + test. Verify zero importers first (DailyCaptureV2 is live path). Any importer → bank + skip.
- S2. DELETE unwired onboarding wizard steps (no container renders; no importer of onboarding/steps). Any importer → bank + skip.
- S3. TierGoalForm: optional FFI/CI/Dials activity targets in tier goal forms (GoalsPanel). Same activity vocabulary Company Config owns.
- S4. CompliancePanel: explicit ScopeSwitch.
- S5. Admin home: surface exception-lead block on TenantAdminDashboard (ExceptionLeadPanel exists for managers; "admin may be exempt" is OVERRULED). If a rules read arm is needed: emulator-test + deploy-staging.ps1 autonomously.

**§2 MOTION** (Sonnet; droppable): per-block stagger + count-up where design specifies and live surface lacks it. Respect prefers-reduced-motion (static). Don't touch shipped motion tokens.

**§5 DENSE-TABLE** (Sonnet; droppable): sticky header + sticky first column + footer count on NON-FUNNEL roster tables (ProductionTable, RankedLeaderboard). Funnel Master Sheet already has this — do not touch.

### CAMPAIGNS PERSISTENCY GATE (Opus 4.8; LAST, FIRST TO DROP)

Display/projection only:
- Persistency multiplier bands (≥90% / 85–89% / 80–84% / <80%) scaling PROJECTED payouts in campaign standings + campaign card. Run 2's standings already show gate multipliers (×1.0, ×0.25) — extend, don't reinvent.
- Tier ladder (Bronze/Silver/Gold: API + apps minimums) as DISPLAY model.
- Band values = Tatil business policy → Company Config registry (Recognition section) as SOON/read-only rows with real values. Not editable this run.
- Per-agent persistency at campaign-close time missing → STOP, bank, move on. No approximation.
- NOT SHIPPING: Confirm & release, AwardWinners close, any owed/paid write.

### Drop order (bottom-up)

NEVER DROPPED: Phase 0 · Tier 0 §1 · E1/E2 reserve. Then: §4 focus-trap → S1–S5 → §2 motion → §5 dense-table → Campaigns gate (first to drop).

### Run end (mandatory, last 90 min)

- **E1.** Re-seed (env-file) + full VH suite (41 + new/extended) vs deployed rules. EXPLICIT NO-REGRESSIONS GATE: every pre-existing leg green. Any regression → REVERT the offending item's commits on staging (operator-locked: revert over debug in the reserve) and note it. Regression gate = the run's real acceptance criterion.
- **E2.** Progress doc: final smoke table, per-part model telemetry, SHAs, swallow-disposition table (every site, kept-or-surfaced, reasoning), DECISIONS-NEEDED, morning handoff (shipped/banked/dropped + why). Commit + push. Verbatim `git log origin/staging --oneline -1` in the doc.
- **E3.** HOLD. No merges, no prod, nothing further.
