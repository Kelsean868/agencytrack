# Policy Ledger v2 — Slice 1 (Agent surface) — Kickoff brief

- **Status:** FINAL — decisions locked.
- **Channel:** HUMAN-MERGE + pre-review. (Track J gated screen — token change + new interaction; not auto-merge-eligible.)
- **Scope class:** Agent-surface UI restyle. Port the agent Policy Ledger to the v2 three-tier layout + drill drawer. **No schema / awards / backend / nav / route change.**
- **Smoke:** REQUIRED — uses the shared harness (`scripts/verification/lib/walk-helpers.mjs`). Real write-read-verify on a status transition; both themes.
- **Branch:** off `origin/main` (current HEAD `9c57731`).
- **Build reference:** `docs/design/policy-ledger-v2-slice-1-build.html` (the annotation, landed alongside this brief). Mechanics: the Claude Design Policy Ledger v2 spec.
- **Rules in force:** 9, 12, 15, 17, 19, 20.

---

## 0. Why

The agent Policy Ledger (`PolicyLedgerPanel.jsx`) is shipped and working. v2 reorganizes it into a three-tier layout (pipeline strip + flow bar, card feed + filters, drill drawer) and standardizes its tokens. This slice is **purely presentational** — same data, same status machine, same write path, same nav. The campaign Lens and the manager reconciliation surface are deferred (§6).

## 1. Scope — locked decisions (= acceptance criteria)

**IN:**
1. **Tier 1 — Pipeline strip + stage tiles** (Submitted · Rated · Awaiting confirm [= settled] · Confirmed · Closed·Lapsed; count + Σ TTD each) + the "Active Book" **flow bar** — ALL client-derived from the existing `getOwnPolicies` list (no new reads). Relabel the flow bar's "Commissionable" → **"Confirmed value."**
2. **Tier 2 — Restyled card feed** + filter chips (All · In flight · Action needed · Confirmed · Closed) + search. Each card shows the MiniLifecycle dots including the **derived Confirmed dot**.
3. **Tier 3 — Drill drawer** (slide-over on desktop / bottom sheet on mobile) **replacing the current inline expand**: LifecycleBar (4 nodes + dates), manager-confirmation card when confirmed, details grid, history timeline (existing append-only data), footer split-button transition.
4. **`confirmed` is a DERIVED display stage** — computed from the manager-confirmation fields being present — **NOT** a new value in the `policyLifecycle.js` status enum. The enum is untouched.
5. **The transition control MUST consume `LEGAL_AGENT_TRANSITIONS`** (the shipped modal already filters this way — preserve it). Options are conditional on current status (e.g. `rated → Settled | NTU` only). **Lapsed NEVER renders on the agent surface** (BM-only).
6. **Reword every awards-asserting label to neutral ledger language:** "Commissionable" → "Confirmed value"; "Settled value locked in for awards + persistency" → "Confirmed by manager." Nothing on the surface claims a live awards/persistency feed.
7. **Token pass** — replace the raw-palette status chips (`bg-blue-50 text-blue-700` etc.) with a single shared `statusToken()` helper mapping each semantic role to the canonical Nexus color family:
   - in-flight (submitted, rated) → **primary** (teal)
   - settled / clean → **success**
   - confirmed → **gold**
   - soft-exception (postponed) → **warning**
   - hard-exception (ntu, denied) → **danger**
   - closed / lapsed → **text-ink-faint** on **bg-surface-muted**

   Phase 0 confirms the exact utility form per family (foreground `text-{family}` + background): `success`/`warning`/`danger` expose `-tint` background utilities; **confirm whether `primary` and `gold` do, else use the codebase's established tint convention** (e.g. `/10` opacity modifier). **Do NOT introduce a token that doesn't exist** — if a needed family lacks a usable utility, STOP and wait for dispatcher. Keep the existing canonical structural tokens (`text-ink`, `bg-card`/`bg-card-raised`, `border-border`).
8. **Loading (skeleton cards) / empty ("No policies yet → Log a policy") / error** states — the mockup doesn't draw them; the coding rules require all three.
9. **No new policy field, no schema change, no new Firestore reads** (tier-1 numbers are client aggregations of `getOwnPolicies`); **`usesPolicyLedger` is NOT referenced or flipped.** Nav unchanged — the agent "Policy Ledger" tab stays; the Prospect Prep → "Log Policy" prefill (`initialForm`/`onPrefillConsumed`) is preserved; the create form is reused as-is (v2 doesn't redraw it).

**OUT (deferred):**
- Campaign **Lens** / CampaignProgressStrip / ContributionBadges / **FEEDS** chips / **"Export proof"** — the dormant `usesPolicyLedger` awards path. Defer **entirely**, not display-only.
- The entire manager reconciliation rebuild (`PolicyReconciliationPanel`) — its own track (§6).
- **Lapse re-homing** — deferred to the manager track; this slice does not touch the manager surface.

## 2. Source-verified anchors (Phase 0 re-verifies against `origin/main` — Rule 17)

From the current-state audit @ `9c57731` — re-confirm at Phase 0:
- **Agent surface:** `src/components/agent/PolicyLedgerPanel.jsx` — view-switched (list ~295–565, create ~568–778, transition modal ~446–562). `inputCls` ~line 101. `proposedAPI = premium × FREQ_MULT[freq]` ~179–183. Raw-palette status badges ~44–52 (the chips the token pass replaces).
- **Status machine:** `src/constants/policyLifecycle.js` — status enum ~line 12; `LEGAL_AGENT_TRANSITIONS` ~19–26; per-transition required fields ~43–51; `isLegalAgentTransition` ~34 (rejects `to==='lapsed'` for agents).
- **Service / data:** `src/services/policiesService.js` — `getOwnPolicies` (~82) is the agent read; `createPolicy` (~36), `transitionPolicyStatus` (~99). Per-policy `history` subcollection.
- **Nav / mount:** `src/components/agent/AgentDashboard.jsx` — `NAV_ITEMS` `policy-ledger` (~63); panel mount (~577) with `initialForm`/`onPrefillConsumed` prefill props.
- **Tokens:** canonical text/surface/border/status tokens are defined in `src/index.css`; `bg-card`/`bg-card-raised`/`text-ink`/`text-ink-muted` resolve via `tailwind.config.js` channel-split. `border-border` resolves app-wide (~201 uses; its mechanism is a separate banked audit FU — keep using it, consistent with the codebase). Confirm the canonical surface utility (`bg-card` vs `bg-surface`).

**If any anchor diverges materially from the above → STOP and wait for dispatcher.**

## 3. Build

Port the agent surface to the annotation (`docs/design/policy-ledger-v2-slice-1-build.html`), three tiers + drawer, applying §1. The create form is reused unchanged. The transition logic is reused (`LEGAL_AGENT_TRANSITIONS`) — only its presentation moves into the drawer footer. `confirmed` is derived from the manager-confirmation fields for the MiniLifecycle / LifecycleBar display only.

## 4. `statusToken()` helper

A single shared helper — placed where both the agent surface now and the manager surface later can import it (e.g. `src/lib/` or `src/constants/`) — returning the foreground/background token classes for each semantic role per §1.7. All chips (StatusPill, MiniLifecycle, any DeltaChip) derive from it. No raw Tailwind palette colors anywhere on the surface.

## Phases

**0 — Gate + sanity.** Branch off `origin/main`. Re-verify §2 anchors. Inventory the real tokens for §1.7 (confirm each semantic family's utility form; confirm `bg-card` vs `bg-surface`). If §1.7 needs a token/utility that does NOT exist → STOP and wait for dispatcher (do not invent tokens). If any anchor diverges → STOP and wait for dispatcher.

**1 — Design.** The `statusToken()` helper API + the drawer component structure (responsive slide-over / bottom sheet).

**2 — Build.** `statusToken()` helper; the three tiers; the drill drawer; the derived-confirmed display; loading/empty/error states; neutral labels. Reuse the create form + transition logic.

**3 — Verify.** `npm run lint` / `npm run build` green; hex/raw-palette grep empty on the surface; axe NO-NEW serious/critical vs main baseline (delta); SMOKE both themes via the shared harness (see §Smoke).

**4 — Docs (with placeholders).** `docs/CONTEXT.md` Recently-shipped row + Rule 16 top-of-file refresh (`#TBD/{TBD}`); `docs/track-j-port-ledger.md` row (Policy Ledger agent → **Slice 1 PORTED**); bank FOLLOW_UPS for the deferred items (Lens / manager reconciliation track / Lapse re-homing) if not already banked.

**5 — Commit / push / PR.** Conventional commit; push; `gh pr create`. **STOP. Do not merge / deploy (Rule 19).** Report PR URL + the smoke result + the feature-branch HEAD SHA (Rule 20).

**6 — Post-merge.** `/post-merge <pr-number>`.

## Smoke (Rule 9 — REQUIRED)

Use `scripts/verification/lib/walk-helpers.mjs` (`resolvePreviewUrl`, `setTheme`, `runBothThemes`, `waitForLoaded`, `setupBypassSession`). Against the PR's fresh Vercel preview (`SMOKE_PREVIEW_URL`):
1. Log in as the test agent; open the Policy Ledger tab.
2. **Test data:** if the agent has no policies, seed a minimal idempotent set (test-tenant-only, cleaned up after) covering `submitted` / `rated` / `settled` / a manager-confirmed policy — enough to populate the tiers, cards, and a drawer. Reuse the leaderboard test-seed approach (idempotent + reversible + test-tenant-only).
3. Assert the tier-1 pipeline strip renders counts + TTD, and the flow bar reads **"Confirmed value"** (NOT "Commissionable").
4. Open a policy's drill drawer; assert the LifecycleBar + history render; for a `rated` policy assert the transition control offers **only Settled + NTU** and **Lapsed is absent**.
5. **Write-read-verify:** exercise one transition (e.g. `submitted → rated`, or `rated → settled` with its required fields), reload, assert the status persisted and the card/drawer reflect it. Clean up the seeded data.
6. Both themes (`runBothThemes`); axe NO-NEW serious/critical. Report X/Y both themes.

## Acceptance criteria
- The agent surface renders the three v2 tiers + drill drawer per the annotation; create form + transition logic reused.
- `confirmed` is derived (status enum untouched); transitions obey `LEGAL_AGENT_TRANSITIONS`; Lapsed never appears on the agent surface.
- No raw-palette colors on the surface (`statusToken()` everywhere); all tokens pre-existing (or a single deliberate, documented addition).
- No awards-asserting copy; no schema / read / awards / nav change; the Prospect-Prep prefill is preserved.
- Loading / empty / error all present.
- Smoke green both themes, including the transition write-read-verify.
