import React from 'react';
import { SectionCard, SectionState } from './SectionState';
import { fmtTTD, fmtYears } from './planFormat';

// Track K — Strategic Plan · Org Structure (deck p8/14-17). Branch → units tree
// with per-unit advisor counts + per-advisor rows. Live units (grouped on unitId),
// not a fixed template. Age/sex columns intentionally omitted — not on the user
// doc (functions/index.js:216-234).
export default function OrgStructure({ orgStructure, loading, error, onRetry }) {
  const org = orgStructure;
  return (
    <SectionCard
      id="org"
      num="04"
      title="Organisation Structure"
      subtitle={org ? `${org.unitCount} unit${org.unitCount === 1 ? '' : 's'} · ${org.adminCount} admin` : 'Units & advisors'}
    >
      <SectionState
        loading={loading}
        error={error}
        empty={!loading && !error && (!org || org.empty)}
        emptyLabel="No units configured for this branch yet."
        onRetry={onRetry}
      >
        {org && (
          <div className="space-y-4">
            {org.units.map((unit) => (
              <div key={unit.unitId} data-testid={`sp-unit-${unit.unitId}`} className="rounded-xl border border-border bg-surface-muted/40 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="font-display text-base font-bold text-ink">{unit.unitName}</span>
                    <span className="ml-2 text-xs text-ink-muted">
                      {unit.headName ? `${unit.headName} · ${unit.headTitle}` : 'No unit head'}
                      {unit.headExperienceYears != null && ` · ${fmtYears(unit.headExperienceYears)}`}
                    </span>
                  </div>
                  <div className="text-right text-xs text-ink-muted">
                    <span className="font-semibold text-ink">{fmtTTD(unit.ytdNetApi)}</span> net · {unit.advisorCount} advisor{unit.advisorCount === 1 ? '' : 's'}
                  </div>
                </div>
                {unit.advisors.length > 0 && (
                  <ul className="mt-3 divide-y divide-border/50">
                    {unit.advisors.map((a) => (
                      <li key={a.id} className="flex items-center justify-between py-1.5 text-sm">
                        <span className="text-ink">{a.name}</span>
                        <span className="text-xs text-ink-muted">{a.title} · {fmtYears(a.experienceYears)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionState>
    </SectionCard>
  );
}
