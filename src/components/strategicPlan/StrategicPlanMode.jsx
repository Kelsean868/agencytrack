import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import { fmtTTD, fmtPct } from './planFormat';
import { formatPersistencyPct } from '../../lib/persistency/persistencyRounding';

// Track K — Strategic Plan · presentation mode. Clones the MeetingMode shell
// (scene list + agenda rail + prev/next + presenter notes + keyboard transport)
// but reads the useStrategicPlan model — no re-derivation (single math path).
// Full-screen, always-dark presentation surface; Escape/focus-trap via useFocusTrap.

const SCENES = [
  { id: 'cover', label: 'Cover', note: 'Open on the agency and the period. Name the plan owner.' },
  { id: 'agents', label: 'Agent Tracker', note: 'Lead with the top producers; name who needs to move.' },
  { id: 'production', label: 'Production', note: 'Year quota vs settled; call the run-rate projection.' },
  { id: 'period', label: 'Period Metrics', note: 'Walk goal vs actual per period; flag the variances.' },
  { id: 'org', label: 'Org Structure', note: 'Show the units and their producers.' },
  { id: 'recruitment', label: 'Recruitment', note: 'Where the pipeline stands and how many are licensed.' },
];

function Kicker({ children }) {
  return <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-presentation-muted">{children}</p>;
}

function SceneBody({ id, plan }) {
  if (id === 'cover') {
    return (
      <div className="flex h-full flex-col justify-center">
        <Kicker>Agency Strategic Plan</Kicker>
        <h1 className="mt-3 font-display text-5xl font-bold leading-none text-presentation-text">{plan.meta?.branchName ?? 'Branch'}</h1>
        <p className="mt-4 text-lg text-presentation-muted">
          {plan.meta?.period ? `${plan.meta.period.year} · ${plan.meta.period.granularity === 'half' ? 'Half-year' : 'Quarterly'} plan` : ''}
        </p>
        <p className="mt-1 text-base text-presentation-muted">Agency Manager · {plan.meta?.authorName ?? '—'}</p>
      </div>
    );
  }
  if (id === 'agents') {
    const rows = (plan.agents?.rows ?? []).slice(0, 10);
    return (
      <div>
        <Kicker>Agent Performance · YTD net vs objective</Kicker>
        <div className="mt-4 space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-4 border-b border-presentation-border pb-2">
              <span className="flex-1 text-base font-semibold text-presentation-text">{r.name} <span className="text-sm text-presentation-muted">· {r.title}</span></span>
              <span className="tabular-nums text-presentation-text">{fmtTTD(r.apiNetSettled)}</span>
              <span className="w-16 text-right tabular-nums text-presentation-muted">{fmtPct(r.apiPctObj)}</span>
            </div>
          ))}
          {rows.length === 0 && <p className="text-presentation-muted">No advisors in this branch.</p>}
        </div>
      </div>
    );
  }
  if (id === 'production') {
    const a = plan.production?.annual;
    return (
      <div>
        <Kicker>Production Summary · annual</Kicker>
        {a ? (
          <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { l: 'Annual quota', v: fmtTTD(a.apiQuota) },
              { l: 'Net settled', v: fmtTTD(a.apiNetSettled) },
              { l: 'Projected EOY', v: fmtTTD(a.projectedApi) },
              { l: 'Persistency', v: formatPersistencyPct(plan.production?.persistency?.currentPct) },
            ].map((m) => (
              <div key={m.l}>
                <p className="text-sm text-presentation-muted">{m.l}</p>
                <p className="mt-1 font-display text-3xl font-bold tabular-nums text-presentation-text">{m.v}</p>
              </div>
            ))}
          </div>
        ) : <p className="mt-4 text-presentation-muted">No production data.</p>}
      </div>
    );
  }
  if (id === 'period') {
    const rows = plan.periodMetrics?.rows ?? [];
    return (
      <div>
        <Kicker>Period Metrics · goal vs actual (net)</Kicker>
        <div className="mt-4 space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-4 border-b border-presentation-border pb-2">
              <span className="w-12 font-semibold text-presentation-text">{r.label}</span>
              <span className="flex-1 tabular-nums text-presentation-muted">Goal {fmtTTD(r.apiGoal)}</span>
              <span className="tabular-nums text-presentation-text">Actual {fmtTTD(r.apiActual)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (id === 'org') {
    const units = plan.orgStructure?.units ?? [];
    return (
      <div>
        <Kicker>Organisation · {plan.orgStructure?.unitCount ?? 0} units</Kicker>
        <div className="mt-4 space-y-2">
          {units.map((u) => (
            <div key={u.unitId} className="flex items-center gap-4 border-b border-presentation-border pb-2">
              <span className="flex-1 text-base font-semibold text-presentation-text">{u.unitName} <span className="text-sm text-presentation-muted">· {u.advisorCount} advisors</span></span>
              <span className="tabular-nums text-presentation-text">{fmtTTD(u.ytdNetApi)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (id === 'recruitment') {
    const rec = plan.recruitment;
    return (
      <div>
        <Kicker>Recruitment · {rec?.total ?? 0} active · {rec?.hired ?? 0} licensed</Kicker>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {(rec?.byStage ?? []).map((s) => (
            <div key={s.key} className="rounded-lg border border-presentation-border bg-presentation-text/5 px-2 py-3 text-center">
              <div className="text-2xl font-bold tabular-nums text-presentation-text">{s.count}</div>
              <div className="mt-1 text-[0.6rem] uppercase tracking-wide text-presentation-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export default function StrategicPlanMode({ plan, onClose }) {
  const modalRef = useFocusTrap({ onEscape: onClose });
  const [index, setIndex] = useState(0);
  const total = SCENES.length;
  const clamped = Math.min(index, total - 1);
  const scene = SCENES[clamped];

  const go = useCallback((dir) => setIndex((i) => Math.min(Math.max(i + dir, 0), total - 1)), [total]);
  const jump = useCallback((i) => setIndex(Math.min(Math.max(i, 0), total - 1)), [total]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Home') setIndex(0);
      else if (e.key === 'End') setIndex(total - 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [go, total]);

  const progress = useMemo(() => (total > 1 ? (clamped / (total - 1)) * 100 : 0), [clamped, total]);

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label="Strategic plan presentation"
      className="fixed inset-0 z-50 flex flex-col bg-presentation"
      data-testid="strategic-plan-mode"
    >
      <div className="h-1 shrink-0 bg-presentation-text/10" aria-hidden="true">
        <div className="h-1 bg-presentation-accent transition-all" style={{ width: `${progress}%` }} />
      </div>

      <header className="flex shrink-0 items-center justify-between px-6 py-4">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-presentation-muted">{scene.label}</p>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-presentation-muted">
            {String(clamped + 1).padStart(2, '0')} <span className="text-presentation-muted/60">/ {String(total).padStart(2, '0')}</span>
          </span>
          <button type="button" onClick={onClose} aria-label="Close presentation" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-presentation-muted hover:text-presentation-text">
            <X size={22} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Agenda rail */}
        <nav className="hidden w-56 shrink-0 overflow-y-auto border-r border-presentation-border px-3 py-4 sm:block" aria-label="Scenes">
          {SCENES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => jump(i)}
              className={`mb-1 flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                i === clamped ? 'bg-presentation-text/10 font-bold text-presentation-text' : 'text-presentation-muted hover:text-presentation-text'
              }`}
            >
              <span className="font-mono text-xs">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex-1 truncate">{s.label}</span>
            </button>
          ))}
        </nav>

        {/* Scene */}
        <main className="min-w-0 flex-1 overflow-y-auto px-8 py-8">
          <SceneBody id={scene.id} plan={plan} />
          {scene.note && <p className="mt-8 border-t border-presentation-border pt-4 text-sm italic text-presentation-muted">{scene.note}</p>}
        </main>
      </div>

      {/* Transport */}
      <footer className="flex shrink-0 items-center justify-between px-6 py-4">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={clamped === 0}
          aria-label="Previous scene"
          className="min-h-[44px] rounded-lg border border-presentation-border px-4 text-sm text-presentation-text disabled:opacity-40"
        >
          ← Prev
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={clamped === total - 1}
          aria-label="Next scene"
          className="min-h-[44px] rounded-lg border border-presentation-border px-4 text-sm text-presentation-text disabled:opacity-40"
        >
          Next →
        </button>
      </footer>
    </div>
  );
}
