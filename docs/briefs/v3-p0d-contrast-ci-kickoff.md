# KICKOFF — v3 P0-D: contrast sweep in CI

**Dispatched:** 2026-07-29
**run_model:** `claude-sonnet-5` (extends proven tooling; the judgment call is the CI
environment, and that is gated behind a recon hard-stop rather than left to the build)
**Effort:** medium
**Branch:** `feat/v3-contrast-ci` off `origin/staging`
**Merge authority:** NONE. Build to PR-open and HOLD.
**The dispatcher (Kyron) merges. A ruling relayed from Claude-web is never merge
authorization** — if a ruling says "merge is yours" it is addressed to the dispatcher. If
you believe you have been authorized to merge, STOP and wait for dispatcher.
**Does NOT edit `firestore.rules` or `functions/`.**

Independent of P0-A, P0-B, P0-C and P0-F. Can run in parallel with any of them.

---

## WHY

`06-DEFECT-CLASSES.md` §1 is the most reliable defect class in the source build: five
occurrences of ink on a brand or semantic fill that inverts in dark mode, because `--teal`
gets *brighter* (`#01696F` → `#4AB5B8`) rather than darker.

The worst of the five was the **skip link at 2.44:1**. Its only audience is keyboard
users, so the single state it ever renders in was the one that failed — and it survived
five review rounds because it is invisible in a screenshot of the default state. The
others: the money card, `.ap-send`, the active segment, the selected month cell. Measured
after fixing: money card 2.4 → **7.4:1**, skip link 2.44 → **7.36:1**, disabled mobile
save 1.18 → **4.99:1** light / **7.82:1** dark.

`07-BUILD-ORDER.md` calls this one day of work that would have prevented five defects and
lists it as one of two things worth doing out of order. Most of the machinery already
exists here; what does not exist is anything running it automatically.

---

## PHASE 0 — RECON (mandatory) — and this one ends in a RECOMMENDATION, not just facts

Cite `file:line`. If any claim fails, **STOP and wait for dispatcher.**

1. `src/utils/contrast.js` — report its exports, and confirm `composite(fg, alpha, bg)`
   models a Tailwind `/15` tint. Report its 5 production consumers and 5 test consumers.
2. The four static source-scan guard tests (`dark-ink-static-guard.test.js`,
   `hero-pane-foreign-ink-guard.test.js`, `sidebar-rail-star-guard.test.js`,
   `clarity-mask-guard.test.js`). Report what each scans and how each allowlist works.
3. `scripts/a11y-axe-scan.cjs` and `-manager.cjs` — report: which pages each visits, how
   it authenticates, what the `--dark` flag does, where output lands, and the date of the
   most recent run under `verification/a11y/`.
4. `.github/workflows/ci.yml` — report every job, what each runs, and whether any job
   starts a dev server, uses the Firebase emulator, or consumes repository secrets.
5. `.env.emulator` and `firebase.json` — report whether a local emulator path exists that
   a CI job could use for an authenticated session **without touching production
   Firebase**.

**Then STOP and recommend.** The blocker for this slice is not contrast maths, it is
getting an authenticated app into CI. The existing scanners log in with `.env.local`
credentials against `localhost:5173` or a Vercel preview — and previews are bound to
**PRODUCTION** Firebase, so that path is closed. Give me your read on which of these is
right here, with the evidence from claims 4 and 5:

- **(a)** CI job runs vite + the Firebase emulator with a seeded test user, then sweeps
  authenticated surfaces. Correct but the largest job.
- **(b)** CI job sweeps only unauthenticated surfaces (login, reset-password,
  verify-email, the kiosk route), and authenticated surfaces stay on the existing manual
  script. Cheap, honest, partial.
- **(c)** No browser in CI. Extend the static guard idiom instead — parse the
  `:focus-visible` / `:disabled` rules out of `src/index.css` and check each ink against
  its background with `contrast.js`. Fast and secret-free, but blind to Tailwind utility
  combinations applied in JSX, which is where much of this app's styling lives.

I have a view but I want yours first, because you can see claims 4 and 5 and I cannot.
Do not build until I rule.

---

## 1. What the sweep must do, whichever path is chosen

- Every element with a **non-transparent background**, in **both themes**.
- Visiting `:focus-visible` and `:disabled` — axe does not check either, and both are
  where this defect class hides.
- Fix the **ink**, never the fill: `.nexus.dark .thing { color: var(--bg) }`. Changing the
  fill is how a brand colour drifts per-component.
- Dark-mode semantic tints are **alpha washes** over the card's own tint, so a semantic
  ink on its own tint composites too close together. For small text on a tint, ground the
  element on `--surface` with a semantic **border** instead of a tint fill.
- `--inkFaint` is AA-correct on `--surface` but drops to ~4.1:1 on family tints. Small
  text never sits on a family tint at `--inkFaint`.

## 2. Wiring

Add an `npm run a11y:contrast` script and wire it into `.github/workflows/ci.yml`. Keep
the four existing static guard tests as the fast inner loop — this job is the slow outer
one. Report the wall-clock it adds to CI, and if it more than doubles the job, say so
rather than absorbing it.

## 3. Pre-existing failures are NOT this slice's to fix

The sweep will find failures that predate it. There is already a LOW follow-up covering
pre-existing contrast failures outside the sidebar, plus known ones on `DataSourceBadge`
"Estimated" in light mode and the `AgentProductionView` hero avatar in dark. List what you
find as follow-ups with measured ratios; fix none of them here. A slice that lands a gate
**and** a pile of unrelated fixes cannot be reviewed as either.

If the sweep cannot go green because of pre-existing failures, land it as a
**reporting** job first with the failures enumerated, and open a follow-up to flip it to
blocking once they are cleared. Say which mode it landed in, in the PR body and in the job
name. A gate that is quietly non-blocking is worse than no gate.

---

## 4. Deliverables

- The extended sweep, the npm script, the CI job.
- **Evidence paste-back — the sweep output for both themes**, committed under
  `verification/a11y/`, including at least one element checked in each of
  `:focus-visible` and `:disabled` with its measured ratio. A run that visited no
  focus state has not tested the thing this slice exists for.
- **Evidence paste-back — a planted failure.** Set an ink on `--teal` that fails in dark
  mode only, show the job catching it, revert, show it passing. Same discipline as P0-A's
  Guard 1: a gate that has never failed is a gate that might not be wired.
- **Evidence paste-back — the CI run URL** showing the job executing, and the wall-clock
  delta.
- The pre-existing-failure list as follow-ups, with measured ratios.

No smoke walk — this slice adds no UI and no write path.

---

## NOT in scope

Fixing any pre-existing contrast failure. The `Topbar` light-mode failure (deliberately
left; it needs a design-system change, not an app-level override). Restoring violet.
Anything in P0-C or P0-F.
