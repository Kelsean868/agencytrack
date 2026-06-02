import React from 'react';
import { Card, NumericField } from '../CardStack';

/**
 * Wizard v2 step 9 — Hours worked.
 *
 * v2 extraction of the legacy Step7TimeManagement component (retirement R2).
 * Faithful 1:1 port — same persisted keys (officeHours / fieldHours), same
 * direct on-change, same display-only office/field time-split bar.
 */
export default function StepHoursWorked({ data, onChange }) {
  const office = data.officeHours ?? 0;
  const field = data.fieldHours ?? 0;
  const total = office + field;
  const officePct = total > 0 ? Math.round((office / total) * 100) : 0;
  const fieldPct = total > 0 ? 100 - officePct : 0;

  return (
    <div className="flex flex-col gap-4">
      <Card badge="Hours Logged" desc="How your week was split between office and field activity.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="Office Hours"
            name="officeHours"
            value={data.officeHours}
            onChange={onChange}
            desc="Admin, writing applications, branch meetings, training, study."
          />
          <NumericField
            label="Field Hours"
            name="fieldHours"
            value={data.fieldHours}
            onChange={onChange}
            desc="Client meetings, prospect appointments, canvassing, calls."
          />
        </div>
      </Card>

      <Card badge="Time Split" variant={total > 0 ? 'teal' : 'default'}>
        {total > 0 ? (
          <>
            <div className="rounded-lg overflow-hidden h-8 flex mb-3">
              <div
                className="h-full bg-primary flex items-center justify-center transition-all duration-300"
                style={{ width: `${officePct}%` }}
              >
                {officePct >= 15 && (
                  <span className="text-xs font-bold text-white">Office {officePct}%</span>
                )}
              </div>
              <div
                className="h-full bg-success/40 flex items-center justify-center transition-all duration-300"
                style={{ width: `${fieldPct}%` }}
              >
                {fieldPct >= 15 && (
                  <span className="text-xs font-bold text-success">Field {fieldPct}%</span>
                )}
              </div>
            </div>
            <div className="flex justify-between text-xs text-ink-muted">
              <span>Office: {office}h ({officePct}%)</span>
              <span>Total: {total}h</span>
              <span>Field: {field}h ({fieldPct}%)</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-ink-muted text-center py-2">
            Enter hours above to see your time split
          </p>
        )}
      </Card>
    </div>
  );
}
