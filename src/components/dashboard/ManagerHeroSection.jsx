import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import GoalDonut from './GoalDonut';

export default function ManagerHeroSection({
  teamYTDAPI,
  teamAnnualGoal,
  goalSet,
  inScopeAgentCount,
  loading,
}) {
  if (loading) {
    return <div className="h-40 rounded-2xl bg-border/30 animate-pulse mb-6" />;
  }

  const percent   = teamAnnualGoal > 0
    ? Math.min(100, Math.round((teamYTDAPI / teamAnnualGoal) * 100))
    : 0;
  const remaining = Math.max(0, teamAnnualGoal - teamYTDAPI);
  const weeksLeft = Math.round(
    (new Date(new Date().getFullYear(), 11, 31).getTime() - Date.now())
    / (7 * 24 * 60 * 60 * 1000)
  );

  return (
    <div className="role-hero mb-6">
      <div className="goal-slide" style={{ alignItems: 'center' }}>
        <div className="goal-content">
          <div className="goal-period">Team YTD — {new Date().getFullYear()}</div>
          <div className="goal-value">{formatCurrency(teamYTDAPI)}</div>

          {teamAnnualGoal > 0 ? (
            <>
              <div className="goal-target">
                of {formatCurrency(teamAnnualGoal)} annual goal
              </div>
              <div className="goal-bar-wrap">
                <div className="bar bar-thick">
                  <div className="bar-fill" style={{ width: `${percent}%` }} />
                </div>
              </div>
            </>
          ) : (
            <div className="goal-target">No annual goal set</div>
          )}

          <div className="goal-status" style={{ marginTop: 10 }}>
            <span>
              {inScopeAgentCount} advisor{inScopeAgentCount !== 1 ? 's' : ''}
              {teamAnnualGoal > 0 && remaining > 0 && (
                <> · {formatCurrency(remaining)} to go</>
              )}
              {weeksLeft > 0 && <> · {weeksLeft}w left</>}
            </span>
          </div>

          {!goalSet && teamAnnualGoal > 0 && (
            <p className="text-[11px] mt-2" style={{ opacity: 0.75 }}>
              Using company floor estimate — set a branch goal in the Goals tab
            </p>
          )}
        </div>

        <div className="goal-donut-wrap">
          <GoalDonut percent={percent} period="team annual goal" />
        </div>
      </div>
    </div>
  );
}
