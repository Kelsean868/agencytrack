# EFF-002 Suspense-fallback screenshots

Captured by `scripts/verification/smoke-eff002-code-splitting.mjs` against a local
`vite preview` of the Phase-1 build, under CDP **Slow-3G** throttling with the
browser cache disabled (so the lazy dashboard chunk re-fetches slowly and the
fallback stays on screen long enough to capture). Each shows the app's existing
themed `LoadingScreen` (the `<Suspense>` fallback in `App.jsx`) — the intentional
loading treatment a real user on a slow connection sees while their role's
dashboard chunk downloads. It resolves to the real dashboard once the chunk lands
(verified by the `slow-fallback-resolved` smoke legs — no infinite fallback, no
white screen).

| File | Boundary / state | Theme |
|---|---|---|
| `suspense-fallback-agent-light-slow3g.png` | App-level `<Suspense>` fallback during the **AgentDashboard** chunk fetch (Slow-3G) | Light |
| `suspense-fallback-agent-dark-slow3g.png` | App-level `<Suspense>` fallback during the **AgentDashboard** chunk fetch (Slow-3G) | Dark |
| `suspense-fallback-manager-light-slow3g.png` | App-level `<Suspense>` fallback during the **ManagerDashboard** chunk fetch (Slow-3G) | Light |
| `suspense-fallback-manager-dark-slow3g.png` | App-level `<Suspense>` fallback during the **ManagerDashboard** chunk fetch (Slow-3G) | Dark |
| `chunk-error-fallback-light.png` | **ChunkLoadErrorBoundary** fallback when a dashboard chunk request is **aborted** (rejected `import()`) — themed card + "Reload" button, NOT a white screen | Light |
| `chunk-error-fallback-dark.png` | **ChunkLoadErrorBoundary** fallback when a dashboard chunk request is **aborted** (rejected `import()`) — themed card + "Reload" button, NOT a white screen | Dark |

**Chunk-error fallback (EFF-002 safety FU):** captured by the smoke's `chunk-fail-*` legs, which route-abort the `AgentDashboard` chunk so the lazy `import()` rejects. The `ChunkLoadErrorBoundary` (outside `<Suspense>`) catches it and renders a themed card — teal `AlertTriangle`, "Something didn't load", and a full-width **Reload** button (44px touch target) that does a full `window.location.reload()` to re-fetch a valid `index.html`. This is the load-path safety net the split ships with.

**What to eyeball (for the human merge review):** the fallback is a centered card
with a teal spinner + "Loading AgencyTrack…", on the warm page background — light
mode uses the beige `--color-bg` / white `--color-surface` card; dark mode uses the
warm near-black `--color-bg` / warm-dark `--color-surface` card with the lifted-teal
spinner. It reads as an intentional loading state, not a raw spinner or an unstyled
flash-of-wrong-theme. (Phase 2 would add a smaller content-area `tab-loading`
fallback inside `<Shell>`; Phase 2 is deferred — see `docs/FOLLOW_UPS.md`.)
