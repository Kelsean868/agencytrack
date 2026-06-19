# Brief — Collapse the multi-deploy update prompt to one reload

**Size:** XS–S
**Merge:** HUMAN-MERGE (app-infra / reload behavior — worth an eyeball)
**Stacks on:** `main`
**Deploy:** none (pure client; Vercel auto-deploys)

---

## 1. Goal

When several deploys land between a user's sessions, the app currently shows the "update available / reload" prompt once **per deploy** — N merged PRs → N clicks, each reload leaving the prompt up until it's been clicked N times. It should show **one** prompt, and **one** reload should land the user on the latest build and clear it.

---

## 2. Locked decisions

1. **"Behind latest" is a latched boolean, not a count or queue.** Detecting additional new versions while the prompt is already showing is a no-op — it does not enqueue a second prompt.
2. **One reload reaches the latest build and clears the flag.** Don't touch the detection cadence or the reload trigger that already works — the only change is collapsing the accumulation.
3. No new dependencies, no change to caching/offline strategy.

---

## 3. Phase 0 — recon + gates (STOP and report on any gate)

1. **Locate the mechanism.** Grep candidates: `onNeedRefresh`, `registerSW`, `updateSW`, `virtual:pwa-register`, `serviceWorker`, "update available", and any version-poll (`version.json`, a build-hash/meta fetch, a `setInterval` comparing build ids), plus any `localStorage` key holding pending-update state. Classify it as (a) service-worker / workbox, or (b) custom version-poll.
2. **Find the accumulation.** Identify exactly where N deploys become N prompts: an array/queue in state, a `localStorage` list, multiple event-listener registrations, or a re-fire each poll with no latch. Name the root cause before touching anything.
3. **GATE A — does one reload actually reach the *latest* build?** This is the load-bearing assumption. Confirm a single hard reload fetches Vercel's newest build (not the next-queued version). **If one reload does NOT reach latest** (e.g., a service worker serves a stale/next-in-line build), STOP and report — then the real bug is the reload reaching latest, not the prompt count, and collapsing the prompt would *strand* users on an old build with no prompt. Do not collapse until this is confirmed.
4. **GATE B — anything other than event accumulation.** If the symptom isn't explained by update-event accumulation (e.g., a deeper SW `waiting`/`skipWaiting` lifecycle issue), STOP and report.
5. Confirm testability: is detection a hook/state a component/unit test can drive with N simulated detections, or SW-based needing a mocked registration? Note the approach.

---

## 4. Phase 1 — collapse to a single latched prompt

1. Replace the queue/counter with one boolean (`updateAvailable` or equivalent). Additional detections while it's true are no-ops.
2. On the reload action, fire the existing reload path (SW `skipWaiting` + reload, or `location.reload()` for a poll). After reload the app loads latest → the comparison/registration sees current == latest → the flag stays false. If a `localStorage` queue existed, clear it on reload / on version-match.
3. Leave the detection cadence and the reload trigger otherwise unchanged.

## 5. Phase 2 — tests

- Unit/component: 3 detection events → exactly **one** prompt rendered; re-detection while shown is a no-op; reaching latest / version-match → prompt cleared. If SW-based, drive it via a mocked registration per the Phase 0 approach.

## 6. Phase 3 — verify

- Lint, the affected suite, build all green.

## 7. Phase 4 — docs (with placeholders)

1. `docs/CONTEXT.md` per Rule 16 (respect the size caps; shed oldest as you prepend).
2. Leave `#TBD`/`{TBD}` placeholders for PR# + squash SHA.

## 8. Phase 5 — commit / push / PR

1. Branch off `main`; commit fix + tests + docs.
2. Open the PR, report feature-branch HEAD SHA (Rule 20), poll CI + Gemini and disposition each (Rule 21).
3. **HOLD for human review** (Rule 19).

---

## 9. Acceptance

The honest proof is the test in Phase 2 (N detections → one prompt → clears on latest), because a production smoke can't simulate N real deploys mid-run. **Production smoke WAIVED** with justification: multiple real deploys aren't reproducible in a smoke, the logic is unit-covered, and the failure mode is benign (extra clicks, no data effect). If CC can drive N detections programmatically against the preview, a light smoke is welcome but not required. Final confirmation is manual: the next time several PRs merge close together, a single prompt + single reload to latest.

---

## 10. Out of scope

- Detection cadence, caching/offline strategy, SW precache tuning.

## 11. Risks / falsification

- **The stranding risk (GATE A).** Collapsing N→1 is only safe if one reload reaches the latest build. Falsifier: after one reload, the loaded build is NOT the newest. If that can happen, fix the reload, not the prompt — and do not ship the collapse until one-reload-reaches-latest is proven.
