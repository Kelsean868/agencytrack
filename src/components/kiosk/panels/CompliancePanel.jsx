import React, { useMemo } from 'react';
import { computeComplianceStats } from '../../../lib/productionReport/computations';
import { getMostRecentSunday } from '../../../utils/dateHelpers';
import { useCountUp } from '../../../hooks/useCountUp';

function PctDisplay({ value, colorClass }) {
  const display = useCountUp(value, { duration: 800 });
  return (
    <p className={`text-9xl font-display font-bold animate-count-up ${colorClass}`}>
      {Math.round(display)}%
    </p>
  );
}

export default function CompliancePanel({ allSubmissions, allUsers }) {
  const { stats, submittedAgents, pendingAgents } = useMemo(() => {
    const weekStarting = getMostRecentSunday();
    const activeAgents = allUsers.filter((u) => u.role === 'agent' && u.provisioning !== true);
    const s = computeComplianceStats(allSubmissions, activeAgents, weekStarting);

    const submittedIds = new Set(
      (allSubmissions ?? [])
        .filter((sub) => sub.weekStarting === weekStarting && sub.status === 'submitted')
        .map((sub) => sub.agentId ?? sub.userId ?? '')
    );

    return {
      stats: s,
      submittedAgents: activeAgents.filter((u) => submittedIds.has(u.id)),
      pendingAgents: activeAgents.filter((u) => !submittedIds.has(u.id)),
    };
  }, [allSubmissions, allUsers]);

  const pctColor =
    stats.percent >= 80
      ? 'text-success'
      : stats.percent >= 50
      ? 'text-warning'
      : 'text-danger';

  return (
    <div className="w-full h-full flex flex-col p-10">
      <h1 className="text-5xl font-display font-bold text-ink mb-10 tracking-tight">
        This Week's Compliance
      </h1>
      <div className="flex-1 grid grid-cols-2 gap-8">
        <div className="bg-card rounded-2xl flex flex-col items-center justify-center">
          <PctDisplay value={stats.percent} colorClass={pctColor} />
          <p className="text-ink-muted text-2xl mt-6">
            {stats.submitted} of {stats.total} submitted
          </p>
        </div>

        <div className="flex flex-col gap-6 overflow-hidden">
          {submittedAgents.length > 0 && (
            <div>
              <p className="text-success text-xl font-semibold mb-3">
                Submitted ({submittedAgents.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {submittedAgents.map((a) => (
                  <span
                    key={a.id}
                    className="bg-success-tint text-success px-4 py-2 rounded-full text-lg"
                  >
                    {a.name || a.displayName || 'Agent'}
                  </span>
                ))}
              </div>
            </div>
          )}
          {pendingAgents.length > 0 && (
            <div>
              <p className="text-warning text-xl font-semibold mb-3">
                Pending ({pendingAgents.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {pendingAgents.map((a) => (
                  <span
                    key={a.id}
                    className="bg-warning-tint text-warning px-4 py-2 rounded-full text-lg animate-stagger-in"
                    style={{ animationDelay: `${pendingAgents.indexOf(a) * 60}ms`, animationFillMode: 'both' }}
                  >
                    {a.name || a.displayName || 'Agent'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
