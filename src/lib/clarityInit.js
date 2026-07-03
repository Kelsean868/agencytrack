// Microsoft Clarity — privacy-gated initialization.
//
// Clarity (session recording + heatmaps) initializes ONLY in a production build
// AND only when VITE_CLARITY_PROJECT_ID is present. That env var is set ONLY in
// Vercel's Production environment — never Preview, never local — so preview
// smokes and the local/test environment see zero clarity.ms traffic (keeps the
// clean-console / clean-network smoke assertions valid with no allowlisting).
//
// Masking posture (the portal renders agents' personal financial data — the
// Money Needs household budget and the GPM1 manager projection):
//   • Masking MODE (Strict) is a Clarity dashboard setting (Settings → Masking),
//     an operator step — the npm package's init API takes only a projectId and
//     cannot set the mode in code. (Brief Phase 2a "strict at init" is superseded
//     by the 2026-07-03 dispatcher ruling; strict mode is a mandatory operator
//     post-merge step, documented in docs/clarity-integration.md.)
//   • Element-level suppression is enforced IN CODE via data-clarity-mask="True"
//     on the sensitive containers (MoneyNeedsPanel worksheet, TeamPlansRoster
//     rows, AgentPlanDrawer). That attribute masks regardless of mode and is the
//     load-bearing defense — guarded by clarity-mask-guard.test.js.
//
// No user identifiers are passed to Clarity (no Clarity.identify calls).

import Clarity from '@microsoft/clarity';

/**
 * Initialize Microsoft Clarity iff this is a production build with a project id
 * configured. Returns the project id that was initialized, or null when the
 * gate is closed — the state every test and preview build runs in.
 */
export function initClarity() {
  const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID;
  if (!import.meta.env.PROD || !projectId) return null;
  Clarity.init(projectId);
  return projectId;
}

export default initClarity;
