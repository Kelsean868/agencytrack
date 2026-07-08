// F3 — Manager read-only Prospect Info tab inside CoachingNotesModal.
//
// Privacy direction: agent-authored, manager-readable in scope. Managers
// CANNOT write here — rule enforces. UI mirrors that (no add/edit form).

import React, { useEffect, useState } from 'react';
import { UserSearch } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getProspectInfo,
  PROSPECTING_SOURCE_LABELS,
  APPOINTMENT_TYPES,
  OBJECTIONS,
  POLICY_TYPES,
} from '../../services/prospectInfoService';

const SOURCE_LABEL      = PROSPECTING_SOURCE_LABELS;
const APPT_TYPE_LABEL   = Object.fromEntries(APPOINTMENT_TYPES.map((a) => [a.value, a.label]));
const OBJECTION_LABEL   = Object.fromEntries(OBJECTIONS.map((o) => [o.value, o.label]));
const POLICY_TYPE_LABEL = Object.fromEntries(POLICY_TYPES.map((p) => [p.value, p.label]));

function PrepReadOnlyCard({ prep }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-card-raised">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
          {APPT_TYPE_LABEL[prep.appointmentType] ?? prep.appointmentType}
        </span>
        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-success/10 text-success-ink">
          {SOURCE_LABEL[prep.prospectingSource] ?? prep.prospectingSource}
        </span>
        <span className="text-[11px] text-ink-muted">
          {prep.intendedAppointmentDate || '—'}
        </span>
      </div>
      <div className="text-sm text-ink space-y-1">
        <p className="font-medium">{prep.clientName || '—'}</p>
        {(prep.clientAge || prep.clientOccupation) && (
          <p className="text-xs text-ink-muted">
            {prep.clientAge ? `${prep.clientAge} yrs` : ''}
            {prep.clientAge && prep.clientOccupation ? ' · ' : ''}
            {prep.clientOccupation || ''}
          </p>
        )}
        {prep.policyType && (
          <p className="text-xs text-ink-muted">
            <span className="font-medium">Policy: </span>
            {POLICY_TYPE_LABEL[prep.policyType] ?? prep.policyType}
          </p>
        )}
        {Array.isArray(prep.objections) && prep.objections.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {prep.objections.map((o) => (
              <span key={o} className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning/10 text-warning-ink">
                {OBJECTION_LABEL[o] ?? o}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProspectInfoTab({ agentId }) {
  const { user, role, tenantId } = useAuth();
  const [preps, setPreps]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!agentId || !role) return;
    setLoading(true);
    setError('');
    getProspectInfo({ tenantId, agentId, callerRole: role, callerUid: user?.uid })
      .then(setPreps)
      .catch((err) => {
        console.error('Failed to load prospect info:', err);
        setError('Failed to load prospect info. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [tenantId, agentId, role, user?.uid]);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 min-h-0 stagger">
      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-border/40 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="p-3 rounded-xl border border-danger/30 bg-danger/10 text-sm text-danger-ink" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && preps.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-ink-muted">
          <UserSearch size={32} className="opacity-30" aria-hidden="true" />
          <p className="text-sm">No joint-call prep submitted yet.</p>
          <p className="text-xs">The agent has not briefed any upcoming joint calls.</p>
        </div>
      )}

      {!loading && !error && preps.map((prep) => (
        <PrepReadOnlyCard key={prep.id} prep={prep} />
      ))}
    </div>
  );
}
