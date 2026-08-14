import { act } from '@testing-library/react';

/**
 * Let React run pending passive effects, so that the listener serving the NEXT
 * dispatch is the one subscribed against the CURRENT render.
 *
 * WHY THIS EXISTS — a stale keydown-handler closure, PROVEN by trace (PR #898).
 * A component subscribes a document/window keydown listener inside an effect whose
 * deps change as async data lands. Between the render commit and the passive-effect
 * flush there is a window in which the committed DOM and the LIVE handler closure
 * disagree. A SYNCHRONOUS `fireEvent.keyDown` landing in that window is served by
 * the previous closure, which clamps against stale bounds or bails outright — so
 * the state transition the test awaits never happens at all. Never, not late, which
 * is why no timeout change ever helped. Measured: 33/33 failing MeetingMode traces
 * showed exactly one stale-served dispatch, the deck resting at `target - 1`.
 *
 * WHEN TO USE THIS instead of `userEvent.keyboard` — see CLAUDE.md
 * § Choosing between `userEvent` and `fireEvent`. Short version: a test that models
 * a USER pressing a key should use `userEvent.keyboard`, whose activeElement
 * targeting is faithful. A test that dispatches at a SPECIFIC target on purpose —
 * to exercise target-sensitive logic such as a form-field bail or a focus trap —
 * must keep `fireEvent` and obtain the flush separately, because retargeting would
 * destroy what it is testing. This helper is for that second case.
 *
 * Mutation-verified: removing it while keeping the `await` at every call site
 * reproduced the failures (3/100 against a 5/100 pre-fix baseline), so the bare
 * microtask yield from an async helper is NOT sufficient — the `act()` flush is the
 * active ingredient.
 */
export async function flushPendingEffects() {
  await act(async () => {});
}
