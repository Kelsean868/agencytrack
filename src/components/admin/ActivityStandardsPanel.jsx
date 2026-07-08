import React, { useState, useEffect, useCallback } from 'react';
import { Settings2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getManagerActivityStandards, NUMERIC_STANDARDS, BOOLEAN_STANDARDS } from '../../services/managerActivityStandardsService';
import ActivityStandardsModal from './ActivityStandardsModal';

const ROLE_LABELS = {
  unit_manager:   'Unit Managers',
  branch_manager: 'Branch Managers',
  sales_manager:  'Sales Managers',
};

const NUMERIC_LABELS = {
  jfwCount:             'JFW',
  oneOnOnesConducted:   '1-on-1s',
  namesSourced:         'Names Sourced',
  interviewsConducted:  'Interviews',
  recruitsInFirstWeeks: 'First-Weeks',
  trainingSessions:     'Training Sessions',
};

const BOOLEAN_LABELS = {
  unitMeetingHeld:    'Meeting Held',
  dashboardReviewDone: 'Dashboard Review',
};

function RoleStandardsRow({ roleKey, roleStandards }) {
  const numericParts = NUMERIC_STANDARDS
    .map((f) => {
      const v = roleStandards?.[f];
      return (v != null && v !== '') ? `${NUMERIC_LABELS[f]}: ${v}` : null;
    })
    .filter(Boolean);

  const boolParts = BOOLEAN_STANDARDS
    .filter((f) => roleStandards?.[f] === true)
    .map((f) => BOOLEAN_LABELS[f]);

  const allParts = [...numericParts, ...boolParts];

  return (
    <div className="flex items-start gap-3 py-2 border-t border-border first:border-t-0">
      <span className="text-sm font-medium text-ink w-32 shrink-0">{ROLE_LABELS[roleKey]}</span>
      <span className="text-sm text-ink-muted flex-1">
        {allParts.length > 0 ? allParts.join(' · ') : 'No standards set'}
      </span>
    </div>
  );
}

export default function ActivityStandardsPanel() {
  const { tenantId, user } = useAuth();
  const [standards, setStandards] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [readError, setReadError] = useState(null);
  const [editing,   setEditing]   = useState(false);

  const loadStandards = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setReadError(null);
    try {
      setStandards(await getManagerActivityStandards(tenantId));
    } catch (err) {
      setReadError(err?.message ?? 'Failed to load activity standards.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadStandards(); }, [loadStandards]);

  return (
    <section aria-labelledby="activity-standards-heading" className="card mt-4">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 id="activity-standards-heading" className="text-lg font-bold text-ink">
            Manager activity standards
          </h2>
          <p className="text-sm text-ink-muted mt-0.5">
            Weekly targets per manager role — displayed as actual / target on their WAR
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={loading || !!readError}
          aria-label="Edit activity standards"
          className="h-11 px-4 rounded-lg bg-primary/10 text-primary text-sm font-semibold flex items-center gap-2 hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Settings2 size={14} aria-hidden="true" />
          <span>Edit standards</span>
        </button>
      </div>

      {readError && (
        <div role="alert" className="text-sm text-red-600 dark:text-red-400 mb-3 flex items-center gap-3 flex-wrap">
          <span>{readError}</span>
          <button
            type="button"
            onClick={loadStandards}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div className="space-y-0">
        {['unit_manager', 'branch_manager', 'sales_manager'].map((role) => (
          <RoleStandardsRow
            key={role}
            roleKey={role}
            roleStandards={loading ? null : standards?.[role]}
          />
        ))}
      </div>

      {editing && standards !== null && (
        <ActivityStandardsModal
          tenantId={tenantId}
          currentUid={user?.uid ?? null}
          currentStandards={standards}
          onClose={() => setEditing(false)}
          onSaved={() => { loadStandards(); }}
        />
      )}
    </section>
  );
}
