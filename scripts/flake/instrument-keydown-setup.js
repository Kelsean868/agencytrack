/**
 * instrument-keydown-setup.js — Phase 0 instrumentation for the flake-race brief.
 *
 * Answers the dispatcher's three questions WITHOUT editing the test or the component:
 *
 *   1. The value of `total` at each handler invocation.
 *   2. The final clampedIndex when the assertion fails.
 *   3. Which dispatch ordinal (1..N) first saw a non-zero `total`.
 *
 * It is designed to DISCRIMINATE, not to confirm. The two live accounts predict
 * different traces, and this records whichever occurs:
 *
 *   STALE-TOTAL      — at least one early dispatch is served by the mount-time
 *                      handler (total === 0). Because `setIndex` takes a functional
 *                      updater the index is never stale, only `total` is, so those
 *                      dispatches clamp to 0 and the deck ADVANCES SHORT. Final
 *                      counter reads strictly between 1/N and N/N.
 *   CONTENT-NOT-LOADED — every dispatch is served by a handler with the correct
 *                      `total`; the deck reaches the last scene and the final
 *                      counter reads N/N. The awaited text is absent for another
 *                      reason entirely.
 *
 * HOW `total` IS OBSERVED, and why the proxy is exact for MeetingMode.
 * `total` is a closure variable, not reachable from outside. Two independent
 * readings are recorded instead, and they cross-check each other:
 *
 *   (a) RENDERED COUNTER. MeetingMode.jsx:1006-1008 renders
 *       `{clampedIndex + 1} / {total}` (or `00 / 00` before load) into the header.
 *       That is a direct DOM readout of both numbers.
 *   (b) HANDLER GENERATION. MeetingMode.jsx:924-931 gives
 *       `model === null  <=>  scenes === []  <=>  total === 0`, and the listener
 *       effect (:936-949) re-subscribes on `[go, total]`. So the FIRST registered
 *       generation is precisely the one holding `total === 0`. Generation index is
 *       therefore an exact proxy for "was this the total===0 handler".
 *
 * Inert unless FLAKE_INSTRUMENT=1, so it can sit in the repo without affecting CI.
 * Read-only: it wraps listeners and reads the DOM; it changes no application state.
 */

import { afterEach, beforeEach } from 'vitest';

// '1'   — report on FAILING tests only (the measurement run).
// 'all' — report on every test that dispatched a keydown, pass or fail. Used to
//         prove the instrument fires both ways before any conclusion rests on it,
//         and to capture the HEALTHY trace that the failing trace is compared
//         against. #896's harness had to demonstrate the same thing.
const MODE = process.env.FLAKE_INSTRUMENT;
const ENABLED = MODE === '1' || MODE === 'all';

if (ENABLED) {
  const state = {
    // Generations are counted PER TARGET. A global counter conflates
    // useFocusTrap's `document` listener with MeetingMode's `window` transport
    // listener, which made the first version of this file unreadable: "gen 1"
    // was the focus trap, not the total===0 handler.
    genByTarget: { window: 0, document: 0 },
    dispatch: 0,
    log: [],
    registrations: [],
    lastCounter: null,
  };

  // Read the `NN / MM` transport counter (MeetingMode.jsx:1006-1008) out of the
  // DOM. Matching a whole element's text rather than scanning document.body
  // avoids picking up unrelated digit pairs elsewhere on the deck. Returns null
  // when the header is not mounted, which is itself informative.
  const COUNTER_RE = /^\s*(\d{2})\s*\/\s*(\d{2})\s*$/;
  function readCounter() {
    if (!document.body) return null;
    const nodes = document.body.querySelectorAll('p, span, div');
    for (const n of nodes) {
      const m = (n.textContent || '').match(COUNTER_RE);
      if (m) return { index: Number(m[1]), total: Number(m[2]) };
    }
    return null;
  }

  // The counter must be sampled while the component is still mounted. RTL's
  // auto-cleanup unmounts in its own afterEach, and relying on hook ordering to
  // beat it is exactly the kind of assumption this investigation keeps punishing.
  // A MutationObserver records the latest value on every DOM change instead, so
  // `lastCounter` is the value as of the final render regardless of hook order.
  const PROBE_ID = process.env.FLAKE_PROBE_TESTID;

  function sample() {
    const c = readCounter();
    if (c) state.lastCounter = c;
    // "Ever seen" beats a teardown snapshot: RTL's auto-cleanup unmounts the tree
    // in its own afterEach, so a snapshot taken then races the unmount and would
    // report ABSENT for an element that did arrive. The observer fires on every
    // DOM change during the test, so this answers the real question — did the
    // element EVER render — rather than "was it still there at teardown".
    if (PROBE_ID && !state.probeEverSeen && document.body
      && document.querySelector(`[data-testid="${PROBE_ID}"]`)) {
      state.probeEverSeen = true;
    }
    return c;
  }
  const observer = typeof MutationObserver !== 'undefined'
    ? new MutationObserver(() => sample())
    : null;

  function fmt(c) {
    return c ? `${String(c.index).padStart(2, '0')}/${String(c.total).padStart(2, '0')}` : 'none';
  }

  const targets = [
    { obj: globalThis.window, label: 'window' },
    { obj: globalThis.document, label: 'document' },
  ].filter((t) => t.obj && typeof t.obj.addEventListener === 'function');

  const originals = [];

  for (const { obj, label } of targets) {
    const origAdd = obj.addEventListener.bind(obj);
    const origRemove = obj.removeEventListener.bind(obj);
    originals.push({ obj, label, origAdd, origRemove });
    const wrappedFor = new WeakMap();

    obj.addEventListener = function instrumentedAdd(type, fn, opts) {
      if (type === 'keydown' && typeof fn === 'function' && !fn.__flakeProbe) {
        const gen = (state.genByTarget[label] += 1);
        state.registrations.push({ gen, label, atDispatch: state.dispatch, counter: sample() });
        const wrapped = function instrumentedHandler(e) {
          state.log.push({
            kind: 'invoke',
            gen,
            label,
            dispatch: state.dispatch,
            key: e && e.key,
            counter: sample(),
          });
          return fn.call(this, e);
        };
        // Keep a QUEUE per fn, not a single entry. If the same function reference
        // is registered twice on one target, a single-entry map can only ever
        // remove the newest wrapper — the earlier one stays attached and keeps
        // recording `invoke` rows under its old generation, inflating both the
        // stale-served count and the servedBy list. Those are the exact numbers
        // the Phase 0 conclusion rests on, so this is corrected rather than
        // argued about. (Raised by CodeRabbit on PR #898.)
        const q = wrappedFor.get(fn) || [];
        q.push(wrapped);
        wrappedFor.set(fn, q);
        return origAdd(type, wrapped, opts);
      }
      return origAdd(type, fn, opts);
    };

    obj.removeEventListener = function instrumentedRemove(type, fn, opts) {
      if (type === 'keydown' && typeof fn === 'function') {
        const q = wrappedFor.get(fn);
        if (q && q.length) {
          // FIFO: remove the oldest surviving wrapper, mirroring the order the
          // real listeners were attached in.
          return origRemove(type, q.shift(), opts);
        }
      }
      return origRemove(type, fn, opts);
    };
  }

  // Dispatch counter. Registered through the ORIGINAL addEventListener so it is
  // not itself instrumented, at capture phase on `window` — for an event
  // dispatched on `document`, window's capture handler runs before any of the
  // component's listeners, so the ordinal is assigned before the handlers run.
  const probe = function flakeDispatchProbe(e) {
    state.dispatch += 1;
    state.log.push({ kind: 'dispatch', ordinal: state.dispatch, key: e && e.key, counter: sample() });
  };
  probe.__flakeProbe = true;

  beforeEach(() => {
    state.genByTarget = { window: 0, document: 0 };
    state.dispatch = 0;
    state.log = [];
    state.registrations = [];
    state.lastCounter = null;
    state.probeEverSeen = false;
    const w = originals.find((o) => o.label === 'window');
    if (w) w.origAdd('keydown', probe, true);
    if (observer && document.body) observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  });

  afterEach((ctx) => {
    const w = originals.find((o) => o.label === 'window');
    if (w) w.origRemove('keydown', probe, true);
    if (observer) observer.disconnect();

    const task = ctx && ctx.task;
    const failed = task && task.result && task.result.state === 'fail';
    const dispatched = state.dispatch > 0;
    if (!failed && !(MODE === 'all' && dispatched)) return;

    const invokes = state.log.filter((r) => r.kind === 'invoke');
    const dispatches = state.log.filter((r) => r.kind === 'dispatch');

    // MeetingMode's transport listener is the one on WINDOW (:947); useFocusTrap
    // owns the `document` listener. Only window generations bear on `total`.
    const winInvokes = invokes.filter((r) => r.label === 'window');
    // Window generation 1 is the mount-time subscription, which holds total === 0
    // (model === null => scenes === [] => total === 0, MeetingMode.jsx:924-931).
    const firstFresh = winInvokes.find((r) => r.gen > 1);
    // Cross-check from the DOM rather than from the generation proxy alone.
    const firstNonZeroRendered = dispatches.find((r) => r.counter && r.counter.total > 0);

    const final = readCounter() || state.lastCounter;

    const lines = [];
    lines.push('');
    lines.push(`===== FLAKE INSTRUMENT [${failed ? 'FAIL' : 'PASS'}] =====`);
    lines.push(`test: ${task.name}`);
    lines.push(`keydown handler registrations: ${state.registrations.length}`);
    state.registrations.forEach((r) => {
      lines.push(`  gen ${r.gen} on ${r.label} registered after dispatch ${r.atDispatch}, counter=${fmt(r.counter)}`);
    });
    lines.push(`dispatches: ${dispatches.length}`);
    dispatches.forEach((d) => {
      const served = invokes.filter((i) => i.dispatch === d.ordinal).map((i) => `gen${i.gen}@${i.label}`);
      lines.push(`  #${d.ordinal} key=${d.key} counterBefore=${fmt(d.counter)} servedBy=[${served.join(', ') || 'NONE'}]`);
    });
    lines.push(
      `Q1 total at each WINDOW-handler invocation: ${
        winInvokes.map((i) => (i.gen === 1 ? '0(win-gen1)' : `${i.counter ? i.counter.total : '?'}(win-gen${i.gen})`)).join(', ') || 'n/a'
      }`,
    );
    lines.push(`Q2 FINAL counter (clampedIndex+1 / total): ${fmt(final)}`);
    lines.push(`Q3 first dispatch served by a fresh (non win-gen1) transport handler: ${firstFresh ? firstFresh.dispatch : 'NONE'}`);

    // ── Cross-file probe (AgentPlannerPanel and any other document-transport file) ──
    // Those files own their keydown listener on `document` (AgentPlannerPanel.jsx:1330,
    // 17-entry dep array) and render no index/total counter, so the MeetingMode
    // readout does not apply. The discriminator there is different and sharper:
    //
    //   PROXY           — the element commits on a LATER paint, so by teardown it IS
    //                     in the DOM. The bare query merely ran too early.
    //   STALE-LISTENER  — the handler bailed (`resolveAppt(id)` returns null against a
    //                     stale closure), so the element is NEVER rendered and is still
    //                     ABSENT at teardown, however long you wait.
    //
    // Set FLAKE_PROBE_TESTID to the data-testid the failing assertion queries.
    const probeId = process.env.FLAKE_PROBE_TESTID;
    if (probeId) {
      const present = state.probeEverSeen || !!document.querySelector(`[data-testid="${probeId}"]`);
      const docInvokes = invokes.filter((r) => r.label === 'document');
      const docGensAtEnd = state.genByTarget.document;
      const servingGens = [...new Set(docInvokes.map((r) => r.gen))];
      // A generation registered AFTER the dispatch means the listener the dispatch
      // hit was superseded — i.e. it was stale at the moment it ran.
      const laterRegs = state.registrations.filter(
        (r) => r.label === 'document' && r.atDispatch >= 1 && r.gen > Math.max(0, ...servingGens),
      );
      lines.push(`PROBE testid "${probeId}" EVER rendered: ${present ? 'YES' : 'NO'}`);
      lines.push(`  document transport generations: serving=[${servingGens.join(', ')}] totalRegistered=${docGensAtEnd}`);
      lines.push(`  generations registered AFTER a dispatch (dispatch hit a superseded handler): ${laterRegs.length}`);
      // Failure-only, for the same reason VERDICT-INPUT is: on a PASS the element
      // rendered by definition, so "EVER rendered: YES" is trivially true and a
      // verdict line there invites exactly the misreading this instrument exists
      // to prevent.
      if (failed) {
        lines.push(
          `  PROBE-VERDICT: ${
            present
              ? 'element DID render at some point -> it arrived late (favours PROXY)'
              : 'element NEVER rendered at all -> handler bailed (favours STALE-LISTENER)'
          }`,
        );
      }
    }
    lines.push(`Q3b first dispatch with rendered total > 0: ${firstNonZeroRendered ? firstNonZeroRendered.ordinal : 'NONE'}`);
    // ── STALENESS PREDICATE ───────────────────────────────────────────────────
    //   staleServed  <=>  servingGeneration.total  !=  counterBefore.total
    //
    // i.e. the handler that served this dispatch closed over a `total` that
    // DISAGREES with the render committed at dispatch time. That disagreement is
    // the defect itself — it is what made the first dispositive trace dispositive
    // (counterBefore=01/08 while a generation holding total=0 served).
    //
    // The earlier counter — "served by win-gen1" — was a PROXY, and it forced an
    // exclusion list: the Escape and Tab tests legitimately run before data loads,
    // so gen1 is correctly their live handler and they read as false positives. A
    // hand-picked exclusion list is where the next failure hides (rename a test,
    // add a fifth transport case, coverage silently lapses while still reporting
    // PASS). Under this predicate they fall out on their own: counterBefore=00/00
    // against a generation registered at total=0 AGREES, so it is not stale. No
    // special-casing, and the criterion applies uniformly to every test in the file.
    //
    // A generation's captured `total` is read from the counter as of ITS
    // REGISTRATION, which is precisely the value the effect closed over.
    const regTotalFor = (label, gen) => {
      const r = state.registrations.find((x) => x.label === label && x.gen === gen);
      return r && r.counter ? r.counter.total : null;
    };

    // Counted PER DISPATCH, not per serving handler. One dispatch can invoke more
    // than one live window handler, so a per-server tally could exceed
    // `dispatches.length` and — worse — be misread as k>=2 by the acceptance
    // runner, spuriously falsifying the act-boundary model when what actually
    // happened is ONE stale dispatch served twice. `k` is a count of dispatches.
    // (Raised by CodeRabbit on PR #899.)
    let staleServes = 0;
    let staleServerInvocations = 0;
    let unevaluable = 0;
    const staleDetail = [];
    for (const d of dispatches) {
      const servers = winInvokes.filter((i) => i.dispatch === d.ordinal);
      if (!servers.length) continue;
      const seenTotal = d.counter ? d.counter.total : null;
      let dispatchIsStale = false;
      for (const s of servers) {
        const capturedTotal = regTotalFor('window', s.gen);
        if (seenTotal === null || capturedTotal === null) {
          // No counter rendered on this surface (e.g. AgentPlannerPanel renders no
          // NN/MM readout). NOT counted as agreeing — silence is not a pass.
          unevaluable += 1;
          continue;
        }
        if (capturedTotal !== seenTotal) {
          dispatchIsStale = true;
          staleServerInvocations += 1;
          staleDetail.push(`#${d.ordinal}: win-gen${s.gen} captured total=${capturedTotal} vs committed ${seenTotal}`);
        }
      }
      if (dispatchIsStale) staleServes += 1;
    }
    lines.push(`STALE-SERVED dispatches (servingGen.total != counterBefore.total): ${staleServes} of ${dispatches.length}`);
    staleDetail.forEach((s) => lines.push(`    ${s}`));
    if (staleServerInvocations > staleServes) lines.push(`  (${staleServerInvocations} stale server-invocations across ${staleServes} dispatch(es) — one dispatch served by >1 live handler)`);
    if (unevaluable) lines.push(`  unevaluable (no counter on this surface): ${unevaluable} — judged by the PROBE instead, not treated as a pass`);
    // Only meaningful on a failure. On a pass, index === total is simply the
    // expected end state, and printing a "verdict" there invites misreading.
    if (failed) lines.push(
      `VERDICT-INPUT: ${
        final && final.total > 0 && final.index === final.total
          ? 'final index == total  -> deck REACHED the last scene (favours CONTENT-NOT-LOADED)'
          : final && final.total > 0
            ? `final index ${final.index} < total ${final.total} -> deck ADVANCED SHORT (favours STALE-TOTAL)`
            : 'no counter rendered -> component never left the load gate'
      }`,
    );
    lines.push('============================');
    lines.push('');
    // Never let the instrument itself fail or mask a test result: a throw inside
    // afterEach would surface as a test failure that has nothing to do with the
    // code under test, which is the opposite of what a measuring device may do.
    try { console.error(lines.join('\n')); } catch { /* reporting must never affect the run */ }
  });
}
