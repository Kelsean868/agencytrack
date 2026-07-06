# Motion Jank Verifier — design spec

**Status:** approved design, pre-implementation
**Date:** 2026-07-06
**Branch:** `feat/motion-verifier`
**Owner:** Kyron (dispatch), CC (build)

## Problem

The app *feels* janky on tab navigation: an animation plays, then content "pops in"
**after** the animation has already completed. The screen-enter fade and the actual
content settle are decoupled.

Root-cause hypothesis (from source, not yet proven by measurement): `screen-enter`
(`src/index.css:1906`, `--dur-3` = **320ms**, `ease-out cubic-bezier(.22,1,.36,1)`) is
applied to `<div key={activeTab} className="screen-enter">` in all three dashboards
([AgentDashboard.jsx:606](../../src/components/dashboard/AgentDashboard.jsx),
[ManagerDashboard.jsx:474](../../src/components/dashboard/ManagerDashboard.jsx),
[TenantAdminDashboard.jsx:160](../../src/components/dashboard/TenantAdminDashboard.jsx)).
Because the fade wraps the **entire content region including async (Firestore) children**,
if data is not ready when the fade fires, the animation plays over an empty/skeleton
region and the real content paints **after** `animationend` — which reads exactly as
"it animated, then the stuff popped in."

## Goal

A **reusable, on-demand verifier** whose **first run is the diagnostic**: quantify the gap
between when the CSS animation ends and when the pixels actually stop changing, per
dashboard, and produce watchable proof (annotated slow-mo + GIF). Falsifies or confirms
the hypothesis above with real numbers.

## Non-goals (YAGNI)

- v1 covers **only** the `screen-enter` tab-switch surface on the 3 dashboards. Stagger
  (`.stagger`), sheet/drawer (`drawer-slide-up`), and kiosk `animate-stagger-in` are
  follow-ups the same harness can take later.
- **Not** CI-wired. On-demand verifier, catalogued in `scripts/verification/SMOKES.md`.
- **Read-only.** Navigation + screen capture only. No Firestore writes, no data mutation,
  no rules/functions/index touch. (Data-safety: nothing to mutate.)
- Does **not** fix the jank. It measures it. Fixes are a separate follow-up informed by
  the report.

## Approach — pixel-truth with beacon-aligned capture

Chosen over (B) instrument-only [measures DOM mutation, not painted pixels; no artifact;
doesn't use ffmpeg] and (C) `recordVideo`+ffmpeg [~25fps = 40ms resolution, too coarse
for a 320ms animation]. A lightweight slice of (B) is folded in as a free cross-check.

### The beacon trick (exact timing without cross-clock math)

Inject a `position:fixed` 6px strip at the **top of the viewport, outside the animated
content region** (so it is never itself faded). Listeners on the `.screen-enter` element:

- `animationstart` → beacon turns **green**
- `animationend`   → beacon turns **red**

The capture *sees* these flips, so the animation's start/end land on specific captured
frames on the **same clock as every other frame**. No fragile mapping between in-page
`performance.now()` and the capture timeline.

### Metrics (per tab-switch, per dashboard)

| Metric | Source |
|---|---|
| Declared duration | `getComputedStyle('.screen-enter').animationDuration` (anchor; expect 320ms) |
| Animation window | beacon green-frame → red-frame timestamps |
| Content settle | last frame where **content-region** (beacon excluded) inter-frame pixel-delta > threshold |
| **Pop-in gap (ms)** | `contentSettle − animationEnd` |
| **Late-change magnitude** | % of pixels changed *after* `animationEnd` |
| Jank (dropped frames) | inter-frame timestamp gaps during the window |
| Long-task cross-check | `PerformanceObserver('longtask')` entries in the window |

**The delta curve is reported, not just the scalar** — its *shape* distinguishes a real
pop-in (single late spike) from legitimate motion like `useCountUp` number ramps (sustained
small deltas) or a spinner (periodic). This confound is surfaced, not hidden.

### Cold-vs-warm contrast (proves the cause)

Each dashboard is measured twice:

- **Cold** — first visit, Firestore data still in flight → should reproduce the pop-in.
- **Warm** — re-entry, data cached → control.

Cold showing a large late delta spike while warm does not = hypothesis **confirmed**
(fade fires before data lands). Both clean = hypothesis **falsified**, look elsewhere.

## Architecture — two stages

**Stage 1 — capture (Node / Playwright), reuses existing verification infra.**
`scripts/verification/motion-verifier.mjs`

- Chromium via `setupBypassSession(context, baseUrl, token)` against the preview URL.
- Per role: `loginAs(page, baseUrl, email, password)` with the matching `A11Y_*` creds
  (agent → `A11Y_AGENT_*`, manager → `A11Y_BRANCH_MANAGER_*`, tenant-admin →
  `A11Y_TENANT_ADMIN_*`), then `waitForLoaded` for the dashboard.
- `addInitScript` installs the beacon + `animationstart`/`animationend` listeners +
  a `PerformanceObserver('longtask')` buffer before app scripts run.
- Start CDP screencast (`Page.startScreencast`, JPEG, quality ~80, up to ~60fps —
  compositor-dependent; **frames carry real timestamps so a variable rate is fine**).
- Drive the tab switch by clicking the primary nav item (replays `screen-enter` via
  `setActiveTab`); wait for settle with a hard cap (~1.5s); stop screencast.
- Write frames to `out/motion/<ts>/<role>/<case>/frame_*.jpg` + a `meta.json`
  (frame timestamps, declared duration, longtask entries, viewport, beacon strip bbox).
- Reuses `captureConsoleAndNetwork` / `formatCaptureReport`, `installGlobalTimeout`,
  `finishSmoke`, `stamp`.

**Stage 2 — analysis (Python / ffmpeg-python + numpy).**
`scripts/verification/lib/motion_analyze.py`

- Reads a case's frames + `meta.json`.
- numpy per-frame diff → beacon-region color transitions (anim window) + content-region
  delta curve (settle).
- Computes the metric table; applies thresholds → `PASS` / `WARN` / `FAIL`.
- ffmpeg assembles an **annotated slow-mo MP4 + GIF** per case (animation window and
  settle point marked) into the case dir.
- Emits `out/motion/<ts>/summary.json` + `summary.md`.

Stage 1 shells out to Stage 2 at the end (or Stage 2 runs standalone over a capture dir).
Rationale for the split: capture belongs with the Node/Playwright suite; the numerical
diff + video assembly is ffmpeg-python/numpy's sweet spot. (Could collapse to pure-Node +
ffmpeg-CLI later; kept split to use the installed `ffmpeg-python`.)

## Thresholds (initial, tunable — first run calibrates them)

- **FAIL:** pop-in gap > **100ms** AND late-change magnitude > **5%**.
- **WARN:** dropped-frame ratio > **20%** during the window.
- Documented at the top of `motion_analyze.py`; the first real run replaces guesses with
  measured baselines.

## Environment / auth

- Vercel **preview URL** (per decision), via `setupBypassSession` + `VERCEL_BYPASS_TOKEN`.
- Per-role `A11Y_*` creds from `.env.local` (all three tiers present in `.env.example`).
- `.env.local` does not propagate to worktrees — run from a worktree that has it, or the
  main worktree, against the preview URL. Reference creds by env-var name only; never echo.

## Output

```
scripts/verification/out/motion/<timestamp>/
  <role>/<cold|warm>/frame_*.jpg, meta.json, clip.mp4, clip.gif, case.json
  summary.json
  summary.md      ← per-case metric table + verdicts + the delta-curve shapes
```

## Verification of the verifier (Phase 3)

Per methodology Rule 5 (real invocation, not just module resolution): a first real run
against the preview, read-only, is the acceptance test. It must (a) log in per role,
(b) capture frames with a visible beacon flip, (c) produce a non-empty delta curve, and
(d) emit `summary.md`. A capture that never sees a beacon flip = broken instrumentation,
STOP and surface.

## Open risks / honest gaps

- CDP screencast fps is compositor-dependent; under load a 320ms window may get only
  ~10 frames. Mitigation: real per-frame timestamps + the beacon anchor keep the *timing*
  honest even at low frame counts; if resolution is inadequate, fall back to approach C is
  **not** an improvement (coarser) — instead lengthen capture / lower quality for higher fps.
- `useCountUp` and any perpetual spinner will register as "content still changing." Handled
  by reporting the curve shape + a settle cap ("still animating at cap" is a valid result).
- Beacon assumes `animationstart`/`animationend` fire on the keyed remount — expected, but
  Phase-3 gate (d) verifies it before any metric is trusted.
- Preview data volume differs from production; the *gap* is the signal, and it is
  data-volume-sensitive. Report notes the tenant/account used.
