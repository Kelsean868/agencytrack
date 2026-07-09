// F3 — Manager read-only Prospect Info tab inside CoachingNotesModal.
//
// Privacy direction: agent-authored, manager-readable in scope. Managers
// CANNOT write here — rule enforces. UI mirrors that (no add/edit form).

import React, { useEffect, useMemo, useState } from 'react';
import { UserSearch } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getProspectInfo,
  PROSPECTING_SOURCE_LABELS,
  APPOINTMENT_TYPES,
  POLICY_TYPES,
} from '../../services/prospectInfoService';
import { formatDMY, deriveReadiness, pickNextCall, todayISO } from '../../utils/prospectPrep';
import NextCallHero from '../prospect/NextCallHero';
import ApptBadge from '../prospect/ApptBadge';
import ObjectionRehearsal from '../prospect/ObjectionRehearsal';

const SOURCE_LABEL      = PROSPECTING_SOURCE_LABELS;
const APPT_TYPE_LABEL   = Object.fromEntries(APPOINTMENT_TYPES.map((a) => [a.value, a.label]));
const POLICY_TYPE_LABEL = Object.fromEntries(POLICY_TYPES.map((p) => [p.value, p.label]));

function PrepReadOnlyCard({ prep, today }) {
  const { prepped } = deriveReadiness(prep);
  return (
    <div className="p-4 rounded-xl border border-border bg-card-raised">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
          {APPT_TYPE_LABEL[prep.appointmentType] ?? prep.appointmentType}
        </span>
        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-success/10 text-success-ink">
          {SOURCE_LABEL[prep.prospectingSource] ?? prep.prospectingSource}
        </span>
        <ApptBadge intendedDate={prep.intendedAppointmentDate} today={today} prepped={prepped} />
        <span className="text-[11px] text-ink-muted">
          {formatDMY(prep.intendedAppointmentDate) || '—'}
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
          <ObjectionRehearsal objections={prep.objections} className="pt-1" />
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

  const today    = useMemo(() => todayISO(), []);
  const heroPrep = useMemo(() => pickNextCall(preps, today), [preps, today]);
  const listPreps = useMemo(
    () => (heroPrep ? preps.filter((p) => p.id !== heroPrep.id) : preps),
    [preps, heroPrep],
  );

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

      {!loading && !error && heroPrep && (
        <NextCallHero prep={heroPrep} today={today} readOnly />
      )}

      {!loading && !error && heroPrep && listPreps.length > 0 && (
        <p className="text-[10px] font-bold tracking-wider text-ink-muted uppercase">
          Later · {listPreps.length}
        </p>
      )}

      {!loading && !error && listPreps.map((prep) => (
        <PrepReadOnlyCard key={prep.id} prep={prep} today={today} />
      ))}
    </div>
  );
}
