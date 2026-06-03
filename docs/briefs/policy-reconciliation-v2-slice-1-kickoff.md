# Policy Reconciliation v2 — Slice 1 (Manager surface) — Kickoff brief

- **Status:** FINAL — decisions locked.
- **Channel:** HUMAN-MERGE + pre-review. (Track J gated screen — token change + new layout; not auto-merge-eligible.)
- **Scope class:** Manager-surface UI restyle on the **existing manual reconciliation model**. **No file ingestion, no auto-matching, no schema / awards / nav / route change.**
- **Smoke:** REQUIRED — uses the shared harness (`scripts/verification/lib/walk-helpers.mjs`). Real write-read-verify on a confirm; both themes.
- **Branch:** off `origin/main` (current HEAD `f6e4da0`).
- **Build reference:** `docs/design/policy-reconciliation-v2-slice-1-build.html` (the annotation, landed alongside this brief — note the `/land-brief` kebab name may drop `-build`; content is canonical). Mechanics: the Claude Design Policy Ledger v2 spec (manager surface).
- **Rules in force:** 9, 12, 15, 17, 19, 20.

---

## 0. Why

**Data reality (the load-bearing constraint):** Tatil's settlement / issued-policy record reaches the branch only as a **PDF / printed circular** that managers read. There is **no structured, ingestible file**. So reconciliation stays **manual** — the manager reads the circular and keys the confirmed figure in per policy (the current shipped model). We are **not** building PDF parsing / OCR / auto-matching.

This slice restyles the existing `PolicyReconciliationPanel` (Confirm tab + Lapse tab) into the v2 reconciliation worklist **on that manual model** — and fixes its broken `text-text*` token usage along the way. The 8-way discrepancy taxonomy, the `unmatched`/`missing` records, and the dispute/escalate workflow are deferred to Slice 2 (richer *manual* reconciliation); the FEEDS/campaign linkage stays deferred behind the dormant `usesPolicyLedger` flip.

## 1. Scope — locked decisions (= acceptance criteria)

**IN:**
1. **At-risk hero + 3 tiles.** "TTD at risk" hero = **Σ |ledger settled API − manager-keyed figure| over flagged rows** (Phase 0 confirms the exact ledger field — `settledAPI` vs `proposedAPI`). Tiles: **Clean·ready / Flagged / Confirmed**, driven by the **existing boolean `hasDiscrepancy`** (+ confirmation state). All client-derived from the existing manager query — no new reads, no new fields.
2. **Worklist + side-by-side compare + in-row confirm/key-in**, on the existing model (`managerSettledAPI`, `managerNote`, `hasDiscrepancy`). The worklist mirrors the current Confirm-tab population (settled, reconciliation-relevant policies for the manager's scope) — Phase 0 confirms the exact filter.
3. **Honest reframe:** the compare's right column is the **manager's keyed figure** — labelled **"Confirmed · from circular"**, **never "Tatil Report."** Key-in is the **normal confirm flow** (read circular → type figure), not a "record not in file" special case. No copy anywhere implies an ingested file or an automated match.
4. **Reuse the shipped `statusToken()` helper** (`policyStatusTokens.js`, from PR #432) for every chip; **fix the `text-text*` token drift** → canonical `text-ink*` / `bg-card` / `border-border` etc. **No raw Tailwind palette** on the surface.
5. **Keep the existing Lapse tab** as a **BM-only secondary tab** (tokenized for consistency). Do **not** fold it into the worklist — that's Slice 2.
6. **Loading skeleton / empty ("No policies to reconcile") / error** states — all three.
7. **No new field, no schema change, no file ingestion, no auto-matching, no `usesPolicyLedger` reference.** Nav unchanged — the manager "Policy Reconciliation" tab stays; access roles unchanged (**Confirm** = BM / tenant_admin / platform_admin / `canConfirmSettlements`; **Lapse** = BM+). **Reuse `confirmPolicy` / `lapsePolicy` as-is** (presentation moves; logic doesn't).

**OUT (deferred):**
- The **8-way discrepancy taxonomy** (clean / amount / partial / status / period / duplicate / missing / unmatched) → Slice 1 uses the existing boolean + the delta; sub-classification is Slice 2.
- **`unmatched` / `missing` rows** (policies with no ledger doc / not in the circular) → no file to surface them; Slice 2 makes them **manual** manager actions.
- The **dispute / escalate resolution-state workflow** → Slice 2 (keep the existing confirm + flag + notify).
- **File ingestion / OCR / auto-matching** → not planned (revisit only if Tatil ships a structured export).
- **FEEDS / campaign chips + "Export proof"** → deferred behind the dormant `usesPolicyLedger` flip.
- **Folding Lapse into the worklist** → Slice 2.

## 2. Source-verified anchors (Phase 0 re-verifies against `origin/main` — Rule 17)

From the current-state audit (manager surface unchanged since; PR #432 added shared helpers but did **not** touch `PolicyReconciliationPanel`) — re-confirm at Phase 0:
- **Manager surface:** `src/components/manager/PolicyReconciliationPanel.jsx` — Confirm tab + Lapse tab, grouped by agent. `canAccess` (Confirm roles above; Lapse BM+). Uses `text-text*` (the broken token family this slice fixes) + `bg-card` / `border-border` / `bg-primary` / `text-danger`.
- **Service / data:** `src/services/policiesService.js` — `getPoliciesForManager` (~324, role-scoped: UM by `unitId`, BM by `branchId`, else tenant); `confirmPolicy` (~182, batch: policy + manager history + discrepancy notification); `lapsePolicy` (~249, BM+ only). Manager-confirmation fields: `managerSettledAPI`, `managerNote`, `confirmedByManager/Uid/At`, computed `hasDiscrepancy`.
- **Shared helper:** `policyStatusTokens.js` (`statusToken`, shipped #432) — confirm its API and the semantic roles it supports (built for the agent slice; should already cover in-flight / settled / confirmed / soft-exception / hard-exception / closed). **Extend only if a manager-specific role is genuinely missing** — don't fork it.
- **Formatter:** the compact "TTD X.XK" formatter in `formatters.js` (shipped #432) for the hero/tiles.
- **Tokens:** canonical `text-ink*` / `bg-card` / `bg-card-raised` / `border-border` / status families (well-established post-#432).

**If any anchor diverges materially → STOP and wait for dispatcher.**

## 3. Build

Restyle `PolicyReconciliationPanel` to the annotation (`docs/design/policy-reconciliation-v2-slice-1-build.html`): at-risk hero + tiles + worklist + side-by-side compare + in-row confirm/key-in, plus the kept BM-only Lapse tab. Reuse `confirmPolicy` / `lapsePolicy` (logic unchanged), `statusToken()`, and the compact formatter. The hero + tiles compute from the existing `managerSettledAPI` / `hasDiscrepancy` — no new backend.

## Phases

**0 — Gate + sanity.** Branch off `origin/main`. Re-verify §2 anchors. Confirm `statusToken()`'s API + the semantic roles it exposes; confirm the exact ledger field for the delta (§1.1). If `statusToken()` is missing a needed role, or any anchor diverges → STOP and wait for dispatcher.

**1 — Design.** Component structure for the worklist + compare row + the tile/hero derivation; how the Lapse tab co-exists (secondary tab, BM-only).

**2 — Build.** The worklist + tiles + at-risk hero (derived from existing data); the compare/confirm row with the honest "from circular" framing; the tokenized chips via `statusToken()`; the `text-text*` → canonical fix; the kept Lapse tab; loading/empty/error states. Reuse `confirmPolicy` / `lapsePolicy`.

**3 — Verify.** `npm run lint` / `npm run build` green; raw-palette/hex grep empty on the surface; axe NO-NEW serious/critical vs main baseline (delta); SMOKE both themes via the shared harness (see §Smoke).

**4 — Docs (with placeholders).** `docs/CONTEXT.md` Recently-shipped row + Rule 16 refresh (`#TBD/{TBD}`); `docs/track-j-port-ledger.md` Policy Reconciliation row → **Slice 1 PORTED**; bank/append the Slice-2 FU (taxonomy + unmatched/missing as manual actions + dispute/escalate + Lapse re-home) under the existing Policy Ledger v2 FU.

**5 — Commit / push / PR.** Conventional commit; push; `gh pr create`. **STOP. Do not merge / deploy (Rule 19).** Report PR URL + smoke result + the feature-branch HEAD SHA (Rule 20).

**6 — Post-merge.** `/post-merge <pr-number>`.

## Smoke (Rule 9 — REQUIRED)

Use the shared harness (`scripts/verification/lib/walk-helpers.mjs`: `resolvePreviewUrl`, `setTheme`, `runBothThemes`, `waitForLoaded`, `setupBypassSession`). Against the PR's fresh Vercel preview (`SMOKE_PREVIEW_URL`):
1. **Seed** (Admin SDK, test-tenant-only, cleaned up after): policies for a test agent in `settled` status awaiting confirmation — at least one **clean** (manager figure would match) and one **flagged** (`hasDiscrepancy` true), plus one already **confirmed** — enough to populate the worklist, the three tiles, and the at-risk hero.
2. Log in as the **test BM**; open the Policy Reconciliation tab.
3. Assert the worklist + tiles render and the **"TTD at risk"** hero shows a non-zero figure; assert the compare's right column reads **"Confirmed · from circular"** and **"Tatil Report" appears nowhere** on the surface.
4. **Write-read-verify:** confirm one clean policy (key in the figure → confirm), reload, assert it persisted (moved to Confirmed; `managerSettledAPI`/`confirmedByManager` written) and the tiles/worklist updated. Clean up the seed.
5. Assert the **Lapse tab is present** (BM seat).
6. Both themes (`runBothThemes`); axe NO-NEW serious/critical. Report X/Y both themes.

## Acceptance criteria
- The manager surface renders the v2 worklist + tiles + at-risk hero + compare/confirm row per the annotation, on the existing manual model; `confirmPolicy`/`lapsePolicy` reused.
- Honest framing: "Confirmed · from circular" everywhere; no "Tatil Report"; no copy implies an ingested file or auto-match.
- `statusToken()` reused (not forked); the `text-text*` drift fixed; no raw palette on the surface.
- Lapse kept as a BM-only secondary tab; access roles unchanged.
- No new field / schema / read / awards / nav change; no file ingestion or matching.
- Loading / empty / error all present.
- Smoke green both themes, including the confirm write-read-verify.
