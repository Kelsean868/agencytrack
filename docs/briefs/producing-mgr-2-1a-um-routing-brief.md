# Producing-Manager Slice 2.1a — UM wizard routing + production roll-up

Build-and-hold. **Frontend-only — no rules, no CF → Vercel auto-deploys on merge; post-merge
smoke, no `firebase deploy`.** Slice 2.0 (gamification gate) is LIVE + smoked. This routes UM
personal production through the agent wizard into the PRODUCTION totals. BM is 2.1b; mandatory-
filing compliance is Phase 3.

## Locked decisions (Phase 2 recon review)
- **Entry-gate: UM only.** The agent-wizard trigger in ManagerDashboard (`onSubmitReport →
  setShowWizard → WizardForm`) is currently ungated (any manager). Gate it to **`unit_manager`
  only** — block BM (re-enabled in 2.1b once its roll-up exists), SM, TA (permanent). A role files
  only when its roll-up is wired. (This gates the agent wizard, NOT the manager WAR — WAR is
  untouched until 2.2.)
- **UM submission:** `unitId` = own UID (existing model). WizardForm already writes
  `userProfile?.unitId ?? null`, and a UM's `unitId` IS their own UID. No WizardForm change — verify.
- **Production roll-up ONLY — do NOT touch compliance.** Include the UM's personal production in
  the branch/unit PRODUCTION total.
- **Decouple production-scope from compliance-scope.** `useBranchOverview`'s `inScopeAgentIds`
  (agents-only) feeds BOTH `teamYTDAPI` (production) and `kpiData.compliance`. Split them: UMs join
  the PRODUCTION scope; the COMPLIANCE denominator stays agents-only. Phase 3 adds UMs to compliance
  with the retroactive cutoff — NOT here.
- `CompliancePanel` untouched.

## Phase 1 — confirm sites (report inline, then PROCEED; stop only if a site needs real rewiring)
1. The agent-wizard trigger in ManagerDashboard/ManagerOverviewTab — confirm the cleanest gate point.
2. grep for production aggregation that filters `role === 'agent'` and would exclude a UM
   (`useBranchOverview` confirmed; check for unit-level totals or other production views). List them.
3. Confirm `getWeeklySubmissions` already returns the UM's own submission (recon said yes).

## Phase 2 — build
- **Entry-gate:** gate the agent-wizard trigger to `role === 'unit_manager'`. BM/SM/TA don't
  see/trigger it.
- **Production roll-up:** in `useBranchOverview`, introduce `productionScopeIds` (agents + UMs)
  driving `teamYTDAPI`/production subs, and keep `complianceScopeIds` (agents only) driving
  `kpiData.compliance`. Apply the same agents+UMs inclusion to any other production site found in
  Phase 1.
- **Compliance stays agents-only** everywhere (`CompliancePanel` + the compliance scope).

## Phase 3 — tests
- Entry-gate: a UM sees/triggers the wizard; BM, SM, TA do not.
- Production: a UM personal submission counts in `teamYTDAPI` (and any unit-level production total).
- Compliance: the UM is NOT in the compliance denominator (`kpiData.compliance` unchanged).
- Keep the suite green.

## Phase 4/5 — docs + PR
- CONTEXT.md per Rule 16 (live UI + roll-up change → advances HEAD); FOLLOW_UPS. Branch
  `feat/producing-mgr-2-1a-um-routing`. Rule 21 / 20.

## Smoke
**Post-merge (frontend auto-deploys; no `firebase deploy`).** Write-read-verify: as a UM, open the
wizard, file a personal submission → it rolls into the branch/unit PRODUCTION total (`teamYTDAPI`
reflects it) and the UM is NOT added to the compliance denominator. Confirm BM/SM/TA cannot open
the wizard. Both themes + mobile.

## Merge posture
Build-and-hold — human-merge (UI + a change to the overview totals). Frontend-only → Vercel
auto-deploys on merge; no CF/rules deploy. Eyeball: the UM now counts in production but not
compliance, and BM/SM/TA can't open the agent wizard.

## Note (optional hardening, not in scope)
`canManage` rules still permit an SM/TA to write a submission via the API (bypassing the UI gate);
the gamification gate (2.0) and the production scope both exclude them, so any such submission is
inert. A rules-level block on SM/TA personal submissions is bankable as a LOW FU if wanted.
