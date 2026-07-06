// scripts/verification/lib/motion-instrument.mjs
// Injected browser instrumentation for the motion jank verifier.
// The beacon converts the screen-enter animationstart/animationend DOM events
// into a pixel change the screencast can see — so animation timing lands on
// specific captured frames without any cross-clock math.

export const MOTION_BEACON_ID = '__motion_beacon__';

/** Runs in the page (via page.addInitScript). No external references. */
export function installMotionInstrument() {
  const BEACON_ID = '__motion_beacon__';
  const marks = { declaredDurationMs: null, animation: { startPerfMs: null, endPerfMs: null }, longTasks: [], contentBox: null };
  window.__motionMarks = marks;

  function beacon() {
    let el = document.getElementById(BEACON_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = BEACON_ID;
      // Appended to <html> so the screen-enter transform (on a <body> descendant) never fades or moves it.
      el.style.cssText = 'position:fixed;top:0;left:0;right:0;height:6px;z-index:2147483647;background:#000;pointer-events:none';
      document.documentElement.appendChild(el);
    }
    return el;
  }
  beacon();

  document.addEventListener('animationstart', function (e) {
    if (e.animationName !== 'screen-enter') return;
    beacon().style.background = '#00c800';
    marks.animation.startPerfMs = performance.now();
    try {
      marks.declaredDurationMs = parseFloat(getComputedStyle(e.target).animationDuration) * 1000;
      const r = e.target.getBoundingClientRect();
      marks.contentBox = { x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)), width: Math.round(r.width), height: Math.round(r.height) };
    } catch (_) {}
  }, true);

  document.addEventListener('animationend', function (e) {
    if (e.animationName !== 'screen-enter') return;
    beacon().style.background = '#c80000';
    marks.animation.endPerfMs = performance.now();
  }, true);

  try {
    new PerformanceObserver(function (list) {
      for (const entry of list.getEntries()) marks.longTasks.push({ startPerfMs: entry.startTime, durationMs: entry.duration });
    }).observe({ entryTypes: ['longtask'] });
  } catch (_) {}
}

/** Runs in the page (via page.evaluate) between cold and warm captures. */
export function resetMotionMarks() {
  if (window.__motionMarks) {
    window.__motionMarks.animation = { startPerfMs: null, endPerfMs: null };
    window.__motionMarks.longTasks = [];
    window.__motionMarks.contentBox = null;
  }
  const el = document.getElementById('__motion_beacon__');
  if (el) el.style.background = '#000';
}
