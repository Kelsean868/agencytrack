# FU - Microsoft Clarity Integration (privacy-gated)

run_model: claude-sonnet-4-6
size: S
track: analytics/tooling (operator-initiated)
rules_change: NONE | data_model_change: NONE | deploy_required: NO (Vercel env var only)
channel: HUMAN-MERGE (session-recording on a personal-financial-data surface)

## Intent
Operator decision: add Microsoft Clarity (session recording + heatmaps) to the portal.
The app renders agents' personal financial data (Money Needs household budget; the GPM1
manager projection), so this ships privacy-gated by design, not as a bare script drop.

## Locked posture (do not relax)
1. STRICT masking mode - all text masked by default in recordings. Not Balanced.
2. Element-level suppression on the sensitive surfaces regardless of mode: the Money
   Needs worksheet (MoneyNeedsPanel) and the GPM1 Team Plans roster/drawer get explicit
   Clarity mask attributes on their data containers, so figures never appear in a
   recording even if the mode is later loosened.
3. PRODUCTION-ONLY init: Clarity initializes only when a VITE_CLARITY_PROJECT_ID env
   var is present AND import.meta.env.PROD. The var is set ONLY in Vercel's Production
   environment - never Preview, never local. Consequence (deliberate): preview-targeted
   smokes see zero Clarity network traffic, so the clean-console/clean-network smoke
   assertions stay valid with no allowlisting.
4. No user identifiers passed to Clarity (no custom-identify calls with uid/email).

## Phase 0
0.1 Fresh `npm i @microsoft/clarity` (the ambient uncommitted dep was discarded by the
  operator; re-add cleanly). Cite the package's init API from its README.
0.2 Locate the app entry (main.jsx) + confirm how env vars flow (import.meta.env).
0.3 Cite one smoke's network-clean assertion to document why prod-only init matters.
0.4 Confirm Clarity's masking API (strict mode config + the mask attribute name for
  element-level suppression) from the package/docs - do not guess attribute names.

## Phase 2
2a. Init module (e.g. src/lib/clarityInit.js): no-op unless PROD + project id present;
  strict masking configured at init. Called once from main.jsx.
2b. Mask attributes on the sensitive containers: MoneyNeedsPanel data regions, GPM1
  TeamPlansRoster rows + AgentPlanDrawer content. Comment each: "Clarity mask - personal
  financial data; do not remove."
2c. .env.example entry + a short docs note (where the project id lives, what is masked,
  why prod-only).
2d. Unit test: init is a no-op when the env var is absent (the state every test/preview
  runs in).

## Phase 5
Lint/suite/build. Run one existing preview smoke (any GPM1 or K10 smoke) and confirm
zero clarity.ms network requests appear - the prod-gate proof. A live-production
recording check is the OPERATOR's post-merge step (set the Vercel env var, redeploy,
open the portal, verify a session appears in the Clarity dashboard AND that Money
Needs figures are masked in the playback) - bank it as a deferred-verification note in
the PR body; CC cannot do this step.

## Standing
Rule 19 HOLD at PR-open. Rule 21 poll + disposition. Rule 22 >=1 gap. Rule 23: the
no-op test must fail if init fires without the env var. Strike 0/2.

## Operator post-merge steps (yours, Kyron)
1. Create the Clarity project (clarity.microsoft.com), get the project id.
2. Vercel -> Settings -> Environment Variables -> VITE_CLARITY_PROJECT_ID, Production
   scope ONLY. Redeploy.
3. Open the live portal, browse to Money Needs, then check the Clarity dashboard:
   session appears, figures masked. If figures are visible in playback -> STOP, report.
