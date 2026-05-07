import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import GoalDonut from './GoalDonut';

const TABS = [
  { id: 'week',    label: 'Week',    targetSuffix: 'weekly target'              },
  { id: 'month',   label: 'Month',   targetSuffix: 'monthly target'             },
  { id: 'quarter', label: 'Quarter', targetSuffix: 'quarterly target'           },
  { id: 'ytd',     label: 'YTD',     targetSuffix: 'annual personal commitment' },
];

const AUTO_ROTATE_MS  = 6000;
const RESUME_DELAY_MS = 6000;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

export default function GoalCarousel({ data, autoRotate = true }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const hoveredRef     = useRef(false);
  const focusedRef     = useRef(false);
  const resumeTimerRef = useRef(null);
  const tabRefs        = useRef([]);

  const reducedMotion = usePrefersReducedMotion();

  // Auto-rotate — disabled when paused, when prefers-reduced-motion is on,
  // or when the parent opts out via autoRotate={false}.
  useEffect(() => {
    if (!autoRotate || reducedMotion || paused) return;
    const id = setInterval(() => {
      setActive((a) => (a + 1) % TABS.length);
    }, AUTO_ROTATE_MS);
    return () => clearInterval(id);
  }, [autoRotate, reducedMotion, paused]);

  // Cleanup any pending resume timer on unmount.
  useEffect(() => () => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const clearResumeTimer = () => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  };

  const pause = useCallback(() => {
    clearResumeTimer();
    setPaused(true);
  }, []);

  // Schedules auto-rotate to resume RESUME_DELAY_MS after the user has
  // both stopped hovering and lost focus. Per kickoff Q3: "resumes 6s after
  // both pointerleave AND focusout (whichever happens last)". The active
  // tab is preserved across pause/resume — auto-rotate continues from
  // wherever the user pinned, not from Week.
  const tryScheduleResume = useCallback(() => {
    if (hoveredRef.current || focusedRef.current) return;
    clearResumeTimer();
    resumeTimerRef.current = setTimeout(() => {
      setPaused(false);
      resumeTimerRef.current = null;
    }, RESUME_DELAY_MS);
  }, []);

  const handlePointerEnter = () => {
    hoveredRef.current = true;
    pause();
  };
  const handlePointerLeave = () => {
    hoveredRef.current = false;
    tryScheduleResume();
  };
  const handleFocus = () => {
    focusedRef.current = true;
    pause();
  };
  const handleBlur = (e) => {
    // React's onBlur on the wrapper fires for any descendant; check whether
    // focus is actually leaving the carousel (not just moving between tabs).
    if (e.currentTarget.contains(e.relatedTarget)) return;
    focusedRef.current = false;
    tryScheduleResume();
  };

  const activateTab = (i, opts = {}) => {
    setActive(i);
    pause();
    tryScheduleResume();
    if (opts.focus) {
      // Synchronously update active state, then move focus on next frame.
      // requestAnimationFrame keeps the focus move after React has flushed
      // the aria-selected change so SRs announce the new state correctly.
      requestAnimationFrame(() => tabRefs.current[i]?.focus());
    }
  };

  const handleTabClick = (i) => {
    activateTab(i);
  };

  const handleTabKeyDown = (e, i) => {
    let next = null;
    if      (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft')  next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home')       next = 0;
    else if (e.key === 'End')        next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    activateTab(next, { focus: true });
  };

  return (
    <div
      className="role-hero"
      onMouseEnter={handlePointerEnter}
      onMouseLeave={handlePointerLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <div className="goal-carousel">
        <div role="tablist" aria-label="Goal period" className="goal-tabs">
          {TABS.map((tab, i) => {
            const isActive = active === i;
            return (
              <button
                key={tab.id}
                ref={(el) => { tabRefs.current[i] = el; }}
                type="button"
                role="tab"
                id={`goal-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`goal-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                className={`goal-tab ${isActive ? 'active' : ''}`}
                onClick={() => handleTabClick(i)}
                onKeyDown={(e) => handleTabKeyDown(e, i)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="goal-slide-wrap">
          <div className="goal-slide-track" data-active={active}>
            {TABS.map((tab, i) => {
              const slice = data[tab.id];
              const isActive = active === i;
              const widthPct = Math.min(Math.max(slice.percent, 0), 100);
              return (
                <div
                  key={tab.id}
                  className="goal-slide"
                  role="tabpanel"
                  id={`goal-panel-${tab.id}`}
                  aria-labelledby={`goal-tab-${tab.id}`}
                  aria-hidden={!isActive}
                  tabIndex={isActive ? 0 : -1}
                >
                  <div className="goal-content">
                    <div className="goal-period">{slice.period}</div>
                    <div className="goal-value">{formatCurrency(slice.current)}</div>
                    <div className="goal-target">
                      of {formatCurrency(slice.target)} {tab.targetSuffix}
                    </div>
                    <div className="goal-bar-wrap">
                      <div className="bar bar-thick">
                        <div className="bar-fill" style={{ width: `${widthPct}%` }} />
                      </div>
                    </div>
                    <div className="goal-status">
                      <Calendar size={12} aria-hidden="true" />
                      <span>{slice.status}</span>
                    </div>
                  </div>
                  <div className="goal-donut-wrap">
                    <GoalDonut percent={slice.percent} period={tab.label.toLowerCase()} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
