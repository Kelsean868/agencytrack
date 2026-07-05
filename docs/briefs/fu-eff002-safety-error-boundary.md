# FU EFF-002-safety — Chunk-load error boundary for the code-split dashboards

> RUN ON: Opus (/model opus). Load-path safety net for the held EFF-002 PR.
> ADD TO THE EXISTING #804 BRANCH (perf/eff002-code-splitting) — do NOT open a
> new branch. HOLD FOR HUMAN MERGE — Kyron merges the complete PR (split +
> boundary together). Frontend-only; no rules/functions; no firebase deploy.

## Why
PR #804 code-splits the three role dashboards behind <Suspense>. Suspense
catches the LOADING state but NOT a FAILED import(). After a Vercel redeploy,
chunk file hashes change; a returning user whose cached index.html requests a
now-deleted chunk hash gets a rejected import() → white screen. Both bots flagged
this; it is the exact load-path failure this PR must not ship without. This brief
adds the missing error boundary so a failed chunk load shows a themed "reload"
fallback instead of crashing.

## Rule 17 gate
The branch already has the App.jsx changes from commit 7ae869ff (the three lazy
dashboards inside one <Suspense fall=LoadingScreen>). Re-read the current
App.jsx on the branch before editing so the boundary wraps the real Suspense
site. Confirm the branch is perf/eff002-code-splitting and up to date.

## Build
1. Create a ChunkLoadErrorBoundary class component (src/components/, or wherever
   app-level components live on this branch — match the existing convention).
   Requirements:
   - Class component (error boundaries cannot be hooks): implement
     getDerivedStateFromError to set an errored flag, and componentDidCatch to
     log the error (console.error is fine; do not add analytics).
   - On error, render a THEMED fallback consistent with the Nexus system and the
     existing LoadingScreen (same CSS-var surfaces/colors, both light and dark;
     no inline styles, no gradient buttons). The fallback shows a short message
     ("Something didn't load. Please reload.") and a Reload button.
   - The Reload button calls window.location.reload() — a full reload, so the
     browser fetches a fresh index.html with valid chunk hashes. A state-only
     reset is NOT sufficient and must not be used.
   - The button must meet the 44px touch-target rule.
2. In App.jsx, wrap the existing <Suspense> (the one added in 7ae869ff around the
   three lazy dashboards) with <ChunkLoadErrorBoundary>. The boundary goes
   OUTSIDE Suspense so it catches a lazy component that fails to resolve. Do NOT
   change the routing logic, the LoadingScreen fallback, or the agent
   provisioning guard — only add the boundary wrapper.
3. Scope discipline: add ONLY the error boundary + its wrapper. Do NOT retry-loop
   the import, do NOT add a chunk-preload strategy, do NOT touch the manualChunks
   build config (that's the separate banked Phase-2 FU). Boundary + reload only.

## Verify
4. lint clean; full vitest suite green; build clean (confirm the entry-chunk gzip
   is unchanged from Phase 1 — the boundary is tiny and must not re-bloat entry).
5. Unit test the boundary: a child that throws renders the fallback (not a
   crash); the fallback contains the reload affordance. Mock window.location
   .reload and assert the Reload button calls it. Keep it focused.
6. Smoke — extend the existing EFF-002 smoke (scripts/verification/
   smoke-eff002-code-splitting.mjs) with a chunk-FAILURE leg: simulate a failed
   dashboard chunk load (e.g. route/abort the dashboard chunk request via CDP or
   Playwright request interception) and assert the themed error fallback appears
   with a working Reload control — NOT a white screen. Run against the preview,
   both themes. Keep every existing leg green (the split itself must still pass
   60/60). Save a screenshot of the error fallback (light + dark) to
   docs/audits/eff002-run/screenshots/ and add it to INDEX.md.

## Phase 4 — Docs
7. Update the EFF-002 note in the efficiency audit to record the boundary was
   added (the load-path risk is now closed). Mark the error-boundary FU in
   FOLLOW_UPS.md RESOLVED (it's now done, not deferred). Update the RUN-LOG /
   CONTEXT note as appropriate (size-capped). The PR remains HELD.

## Phase 5 — Commit / push — THEN STOP (HOLD)
8. Commit to the EXISTING branch perf/eff002-code-splitting:
   "feat: chunk-load error boundary around lazy dashboards (EFF-002 safety)".
   Push to the same branch (updates PR #804 in place — do NOT open a new PR).
   Poll CodeRabbit + Gemini fresh on the new HEAD, disposition in a table
   (the bots' original finding should now resolve). Re-run the smoke on the
   new HEAD (Rule 20 — source changed).
9. HOLD. Do NOT merge. Do NOT deploy. Report PR-ready with: the boundary added,
   the chunk-failure smoke result (fallback shown, not white screen), the
   updated bot disposition, and the final HEAD SHA. Kyron merges the complete
   split + boundary PR, then runs /post-merge 804.

## Scope guard
Error boundary + reload fallback only, added to the existing branch. No retry
strategy, no manualChunks, no routing change. Strike count carries from the
prior EFF-002 run.
