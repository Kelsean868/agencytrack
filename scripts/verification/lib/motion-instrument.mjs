// scripts/verification/lib/motion-instrument.mjs
// Injected browser instrumentation for the motion jank verifier.
// The beacon converts the screen-enter animationstart/animationend DOM events
// into a pixel change the screencast can see — so animation timing lands on
// specific captured frames without any cross-clock math.

export const MOTION_BEACON_ID = '__motion_beacon__';

/** Runs in the page (via page.addInitScript). No external references. */
export function installMotionInstrument() {
  const BEACON_ID = '__motion_beacon__';
  const marks = { declaredDurationMs: null, animation: { startPerfMs: null, endPerfMs: null }, longTasks: [], contentBox: null, mutations: [], imgLoads: [] };
  window.__motionMarks = marks;
  const MUT_CAP = 400, IMG_CAP = 200;

  function beacon() {
    let el = document.getElementById(BEACON_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = BEACON_ID;
      el.style.cssText = 'position:fixed;top:0;left:0;right:0;height:6px;z-index:2147483647;background:#000;pointer-events:none';
    }
    // Attach to <body> (a <div> child of <html> is not retained/rendered). The
    // beacon is a sibling of #root — NOT a descendant of the screen-enter div —
    // so the screen-enter transform/opacity never fades or moves it. beacon() is
    // called at install (body may be null → documentElement) and re-called on each
    // animationstart (body exists → re-parented there), so it lands in body.
    const parent = document.body || document.documentElement;
    if (el.parentNode !== parent) parent.appendChild(el);
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

  // Diagnostic: timestamped DOM mutations (element additions) + image loads — so a
  // capture can name WHAT repaints late (mutations/imgLoads with tMs > animationEnd
  // are the pop-in culprit). Reset before each capture so the log is switch-scoped.
  try {
    new MutationObserver(function (records) {
      const t = performance.now();
      for (const r of records) {
        if (r.type !== 'childList' || marks.mutations.length >= MUT_CAP) continue;
        for (const n of r.addedNodes) {
          if (n.nodeType !== 1 || marks.mutations.length >= MUT_CAP) continue;
          marks.mutations.push({
            tMs: t, tag: n.tagName,
            testid: (n.getAttribute && n.getAttribute('data-testid')) || '',
            cls: (typeof n.className === 'string' ? n.className : '').slice(0, 50),
            txt: (n.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
          });
        }
      }
    }).observe(document, { childList: true, subtree: true }); // document node is always present at document-start (documentElement may not be)
  } catch (_) {}

  document.addEventListener('load', function (e) {
    const el = e.target;
    if (el && el.tagName === 'IMG' && marks.imgLoads.length < IMG_CAP) {
      marks.imgLoads.push({ tMs: performance.now(), src: (el.currentSrc || el.src || '').slice(0, 70) });
    }
  }, true);
}

/** Runs in the page (via page.evaluate) between cold and warm captures. */
export function resetMotionMarks() {
  if (window.__motionMarks) {
    window.__motionMarks.animation = { startPerfMs: null, endPerfMs: null };
    window.__motionMarks.longTasks = [];
    window.__motionMarks.contentBox = null;
    window.__motionMarks.mutations = [];
    window.__motionMarks.imgLoads = [];
  }
  const el = document.getElementById('__motion_beacon__');
  if (el) el.style.background = '#000';
}
