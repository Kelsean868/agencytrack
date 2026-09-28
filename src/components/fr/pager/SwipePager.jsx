import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  dragOffsetFor,
  isHorizontalIntent,
  resolveTargetIndex,
  translateFor,
} from './swipeMath';

/**
 * SwipePager — the FR phone "swipe pages" pattern (replaces long vertical scrolls).
 *
 * Spec: docs/design-system/screens-fr/specs/SWIPE3.md. Renders
 *   1. a PAGER: a scrollable row of named chips (tablist / tab) + a row of dots,
 *   2. a one-time "Swipe for more" hint (hidden after the first page change),
 *   3. the TRACK: all pages side by side, each exactly `width` px, inside an
 *      overflow-hidden, `touch-action: pan-y` viewport, driven by a pointer engine
 *      copied from M3-Home.dc.html (intent at |dx|>10 && |dx|>|dy|, 1:1 drag,
 *      rubber band at the ends, velocity projection, one page per swipe).
 *
 * The active page sets the viewport height (rule 5 — no blank scroll below a short
 * page); inactive pages are aria-hidden, inert and clipped to that height.
 *
 * NOT this component's job (rule 6): anything that must stay reachable from every
 * page — sticky bottom action bars, bottom sheets, celebration overlays. Callers
 * render those OUTSIDE the pager.
 *
 * @param {{
 *   pages: Array<{ id: string, label: string, content: React.ReactNode }>,
 *   initialPageId?: string,
 *   onPageChange?: (id: string) => void,
 *   ariaLabel: string,
 *   width?: number,      // page width in px; measured from the viewport when absent (default 390)
 *   className?: string,
 * }} props
 */

const DEFAULT_WIDTH = 390;
const VELOCITY_WINDOW_MS = 80;

function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setReduced(mql.matches);
    onChange();
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    return () => { if (mql.removeEventListener) mql.removeEventListener('change', onChange); };
  }, []);
  return reduced;
}

function startIndexFor(pages, initialPageId) {
  if (initialPageId == null) return 0;
  const i = pages.findIndex((p) => p.id === initialPageId);
  if (i === -1) {
    // Non-negotiable 11: a silent fallback must say so in development.
    if (import.meta.env.DEV) console.warn(`SwipePager: initialPageId "${initialPageId}" not found; starting on the first page.`);
    return 0;
  }
  return i;
}

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false" className="shrink-0">
      <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SwipePager({ pages, initialPageId, onPageChange, ariaLabel, width, className = '' }) {
  if (import.meta.env.DEV && (pages.length < 3 || pages.length > 5)) {
    console.warn(`SwipePager: expected 3-5 pages, got ${pages.length} (SWIPE3.md rule 3).`);
  }
  const count = pages.length;
  const uid = useId();
  const reducedMotion = usePrefersReducedMotion();

  const [index, setIndex] = useState(() => startIndexFor(pages, initialPageId));
  const [dragPx, setDragPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [measuredWidth, setMeasuredWidth] = useState(DEFAULT_WIDTH);
  const [activeHeight, setActiveHeight] = useState(0);

  const pageW = width ?? measuredWidth;
  const safeIndex = Math.max(0, Math.min(count - 1, index));

  const viewportRef = useRef(null);
  const pageRefs = useRef([]);
  const tabRefs = useRef([]);
  const dragRef = useRef(null);
  const dragPxRef = useRef(0);
  const suppressClickRef = useRef(false);

  const goTo = useCallback((next, { focus = false } = {}) => {
    const target = Math.max(0, Math.min(count - 1, next));
    if (focus) tabRefs.current[target]?.focus();
    if (target === safeIndex) return;
    setIndex(target);
    setShowHint(false);
    onPageChange?.(pages[target].id);
  }, [count, safeIndex, onPageChange, pages]);

  // Measure the viewport width when the caller does not fix it.
  useEffect(() => {
    if (width != null) return undefined;
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w > 0) setMeasuredWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  // The active page sets the viewport height (SWIPE3 rule 5).
  useEffect(() => {
    const el = pageRefs.current[safeIndex];
    if (!el) return undefined;
    const read = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) setActiveHeight(h);
    };
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [safeIndex]);

  // A native drag (of a link, image or selected text) cancels the pointer and
  // kills the swipe. Block it on the viewport (listener, not a JSX handler, so
  // the viewport stays a non-interactive element for assistive tech).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const stop = (e) => e.preventDefault();
    el.addEventListener('dragstart', stop);
    return () => el.removeEventListener('dragstart', stop);
  }, []);

  // Keep the active chip visible in a scrolled chip row.
  useEffect(() => {
    const chip = tabRefs.current[safeIndex];
    if (chip && typeof chip.scrollIntoView === 'function') {
      chip.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [safeIndex]);

  // ── Keyboard on the tablist (not a global listener) ──────────────────────
  const onTablistKeyDown = (e) => {
    let next = null;
    if (e.key === 'ArrowRight') next = safeIndex + 1;
    else if (e.key === 'ArrowLeft') next = safeIndex - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    if (next == null) return;
    e.preventDefault();
    goTo(next, { focus: true });
  };

  // ── Pointer engine (copied from M3-Home.dc.html) ─────────────────────────
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    suppressClickRef.current = false;
    dragRef.current = {
      x: e.clientX, y: e.clientY, t: performance.now(),
      id: e.pointerId, el: e.currentTarget, active: false, ignored: false, hist: [],
    };
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || d.ignored) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.active) {
      if (isHorizontalIntent(dx, dy)) {
        d.active = true;
        try { if (typeof d.el.setPointerCapture === 'function') d.el.setPointerCapture(d.id); } catch { /* capture is best-effort */ }
        // A mouse drag would otherwise select card text; dragging that selection
        // later starts a native drag, which cancels the pointer (the next swipe dies).
        try { window.getSelection?.()?.removeAllRanges(); } catch { /* no selection API */ }
      } else if (Math.abs(dy) > 10) {
        d.ignored = true; // vertical scroll: leave it to the page until pointerup
        return;
      } else {
        return;
      }
    }
    e.preventDefault();
    const now = performance.now();
    d.hist.push({ x: e.clientX, t: now });
    while (d.hist.length > 2 && now - d.hist[0].t > VELOCITY_WINDOW_MS) d.hist.shift();
    dragPxRef.current = dx;
    setDragPx(dx);
    setDragging(true);
  };

  const endDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || !d.active) return;
    suppressClickRef.current = true;
    const h = d.hist;
    let v = 0;
    if (h.length > 1) {
      const dt = h[h.length - 1].t - h[0].t;
      // A zero-length window carries no velocity information.
      v = dt > 0 ? ((h[h.length - 1].x - h[0].x) / dt) * 1000 : 0;
    }
    const shown = dragOffsetFor(safeIndex, pageW, dragPxRef.current, count);
    const target = resolveTargetIndex({ index: safeIndex, count, dragPx: shown, velocityPxPerSec: v, width: pageW });
    dragPxRef.current = 0;
    setDragPx(0);
    setDragging(false);
    goTo(target);
  };

  // A swipe must never "tap" the card under the finger.
  const onClickCapture = (e) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const tx = translateFor(safeIndex, pageW, dragging ? dragPx : 0, count);

  return (
    <div className={className}>
      {/* PAGER — chips */}
      <div
        role="tablist"
        aria-label={ariaLabel}
        // -1: focusable for the a11y rule, but Tab lands on the active chip (roving tabIndex).
        tabIndex={-1}
        onKeyDown={onTablistKeyDown}
        className="flex gap-2 overflow-x-auto px-4 py-1"
      >
        {pages.map((p, i) => {
          const active = i === safeIndex;
          return (
            <button
              key={p.id}
              ref={(el) => { tabRefs.current[i] = el; }}
              type="button"
              role="tab"
              id={`${uid}-tab-${p.id}`}
              aria-selected={active}
              aria-controls={`${uid}-panel-${p.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => goTo(i)}
              className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-full px-4 font-sans text-sm font-medium ${
                active ? 'bg-fr-accent text-fr-on-accent' : 'bg-fr-sunk text-ink-muted'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* PAGER — dots (decorative; the chips carry the semantics) */}
      <div aria-hidden="true" className="flex items-center justify-center gap-1.5 py-2">
        {pages.map((p, i) => (
          <span
            key={p.id}
            data-active={i === safeIndex ? 'true' : 'false'}
            className={`block h-1.5 rounded-full ${reducedMotion ? '' : 'fr-glide-w'} ${
              i === safeIndex ? 'w-4 bg-fr-accent' : 'w-1.5 bg-ink-dim'
            }`}
          />
        ))}
      </div>

      {showHint && (
        <p className="flex items-center justify-center gap-1 pb-2 font-sans text-xs text-ink-muted">
          Swipe for more
          <ChevronRight />
        </p>
      )}

      {/* TRACK viewport */}
      <div
        ref={viewportRef}
        data-testid="swipe-pager-viewport"
        className={`touch-pan-y overflow-hidden ${reducedMotion ? '' : 'fr-glide-h'}`}
        style={activeHeight > 0 ? { height: activeHeight } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
      >
        <div
          data-testid="swipe-pager-track"
          data-dragging={dragging ? 'true' : 'false'}
          className={`fr-track flex items-start ${dragging ? 'select-none' : ''} ${reducedMotion ? '!transition-none' : ''}`}
          style={{ width: count * pageW, transform: `translateX(${tx}px)` }}
        >
          {pages.map((p, i) => {
            const active = i === safeIndex;
            return (
              <div
                key={p.id}
                ref={(el) => { pageRefs.current[i] = el; }}
                role="tabpanel"
                id={`${uid}-panel-${p.id}`}
                aria-labelledby={`${uid}-tab-${p.id}`}
                aria-hidden={active ? undefined : 'true'}
                inert={!active}
                className={`shrink-0 ${active ? '' : 'overflow-hidden'}`}
                style={active || activeHeight <= 0
                  ? { width: pageW }
                  : { width: pageW, maxHeight: activeHeight }}
              >
                {p.content}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
