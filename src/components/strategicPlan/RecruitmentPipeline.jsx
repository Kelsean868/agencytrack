import React from 'react';
import StatusPill from '../ui/StatusPill';
import { SectionCard, SectionState } from './SectionState';

// Track K — Strategic Plan · Recruitment Pipeline (deck p6-7). Candidates across
// the 8 recruiting stages (sourced → licensed) with hired count. Objective header
// omitted (no stored recruiting objective in Phase 1).
export default function RecruitmentPipeline({ recruitment, loading, error, onRetry }) {
  const rec = recruitment;
  return (
    <SectionCard
      id="recruitment"
      num="05"
      title="Recruitment Pipeline"
      subtitle={rec ? `${rec.total} active candidate${rec.total === 1 ? '' : 's'} · ${rec.hired} licensed` : 'Candidate pipeline'}
    >
      <SectionState
        loading={loading}
        error={error}
        empty={!loading && !error && (!rec || rec.empty)}
        emptyLabel="No recruiting candidates in this branch yet."
        onRetry={onRetry}
      >
        {rec && (
          <div className="space-y-5">
            {/* Stage funnel */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {rec.byStage.map((s) => (
                <div key={s.key} className="rounded-lg border border-border bg-surface-muted/40 px-2 py-2 text-center">
                  <div className="text-lg font-bold tabular-nums text-ink">{s.count}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-muted">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Candidate rows */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-ink-muted">
                    <th className="py-2 pr-3 font-semibold">Candidate</th>
                    <th className="px-2 py-2 font-semibold">Source</th>
                    <th className="px-2 py-2 font-semibold">Recruiter</th>
                    <th className="px-2 py-2 font-semibold">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {rec.rows.map((c) => (
                    <tr key={c.id} data-testid={`sp-candidate-${c.id}`} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-medium text-ink">{c.name}</td>
                      <td className="px-2 py-2 text-ink-muted">{c.source || '—'}</td>
                      <td className="px-2 py-2 text-ink-muted">{c.ownerName || '—'}</td>
                      <td className="px-2 py-2">
                        <StatusPill variant={c.hired ? 'success' : 'muted'} label={c.hired ? 'Licensed' : c.stage} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionState>
    </SectionCard>
  );
}
