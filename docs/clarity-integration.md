# Microsoft Clarity — privacy-gated integration

Microsoft Clarity (session recording + heatmaps) on the AgencyTrack portal. The
app renders agents' **personal financial data** (the Money Needs household
budget; the GPM1 manager projection), so Clarity ships privacy-gated by design —
not a bare script drop.

## Where the project id lives

`VITE_CLARITY_PROJECT_ID` — set **only** in Vercel → Settings → Environment
Variables, **Production scope only**. Never Preview, never local, never
committed. When absent (every Preview build, every local/test run) Clarity does
not initialize at all.

## How the gate works

[`src/lib/clarityInit.js`](../src/lib/clarityInit.js) `initClarity()` is called
once from [`src/main.jsx`](../src/main.jsx). It is a **no-op unless BOTH**:

- `import.meta.env.PROD` is true (a production build), **and**
- `VITE_CLARITY_PROJECT_ID` is present.

Consequence (deliberate): preview-targeted smokes see **zero `clarity.ms`
network traffic**, so the clean-console / clean-network smoke assertions (e.g.
[`smoke-team-plans-gpm1.mjs`](../scripts/verification/smoke-team-plans-gpm1.mjs))
stay valid with no allowlisting.

No user identifiers are passed to Clarity — there are no `Clarity.identify`
calls (no uid / email).

## What is masked, and how

Two layers, defense-in-depth:

1. **Masking mode — STRICT (dashboard).** The `@microsoft/clarity` npm package's
   `init(projectId)` API takes only a project id; it **cannot** set the masking
   mode in code. Masking mode is a Clarity **dashboard** setting (Settings →
   Masking). It **must** be set to **Strict** (all text masked by default).
   Clarity defaults to strict only until the server settings are fetched, so the
   dashboard setting is mandatory, not optional.

2. **Element-level suppression — `data-clarity-mask="True"` (code).** Regardless
   of mode, these containers carry the attribute (which masks the node and all
   its children and overrides site mode), so financial figures never appear in a
   recording even if the mode is later loosened:

   | Surface | Container | File |
   |---|---|---|
   | Money Needs worksheet | outer worksheet `<div>` | `src/components/agent/MoneyNeedsPanel.jsx` |
   | Team Plans roster rows | roster `<ul>` | `src/components/manager/TeamPlansRoster.jsx` |
   | Agent Plan drawer | drawer panel `<div>` | `src/components/manager/AgentPlanDrawer.jsx` |
   | Plan suggestions card (agent hub) | card outer `<div>` | `src/components/dashboard/GamePlanV2/PlanSuggestionsCard.jsx` |

   This attribute is the **load-bearing defense** now that mode is dashboard-only.
   A silent refactor dropping it must fail the suite — that is enforced by
   [`clarity-mask-guard.test.js`](../src/utils/__tests__/clarity-mask-guard.test.js).

## Operator post-merge steps (in order)

1. Create the Clarity project at [clarity.microsoft.com](https://clarity.microsoft.com),
   get the project id.
2. Clarity → **Settings → Masking → set mode to STRICT** (mandatory — the
   default-strict behavior only holds until the server settings fetch).
3. Vercel → set `VITE_CLARITY_PROJECT_ID` (**Production scope only**), redeploy,
   then the **live playback check**: browse to Money Needs as an agent, confirm
   the session appears in the Clarity dashboard **AND** that the figures are
   masked in playback. **If figures are visible in playback → STOP and report.**

## History

Brief Phase 2a's "strict masking configured at init" was superseded by the
2026-07-03 dispatcher ruling once Phase 0 confirmed the npm init API cannot set
mode in code. Strict mode moved to a mandatory operator dashboard step; the
element-level `data-clarity-mask` attributes became the code-enforced defense.
