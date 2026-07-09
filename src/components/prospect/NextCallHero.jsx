// NextCallHero — the appointment-bound hero for Prospect Prep (v2 mockup).
//
// Spotlights the soonest UPCOMING joint call: client identity, a countdown
// badge, the call facts (when / type / likely policy), source + readiness
// pills, and the objection rehearsal aid. Shared by the agent panel (with
// Edit / Log Policy CTAs) and the manager read view (readOnly — no CTAs).
//
// Derives everything from the shipped prospectInfo doc — no invented fields.
// EST. API / note tiles from the mockup are intentionally absent (no schema
// backing).

import React from 'react';
import { Pencil, FileText } from 'lucide-react';
import {
  PROSPECTING_SOURCE_LABELS,
  APPOINTMENT_TYPES,
  POLICY_TYPES,
} from '../../services/prospectInfoService';
import {
  formatDMY,
  deriveReadiness,
  prospectInitials,
} from '../../utils/prospectPrep';
import ApptBadge from './ApptBadge';
import ObjectionRehearsal from './ObjectionRehearsal';

const APPT_TYPE_LABEL = Object.fromEntries(APPOINTMENT_TYPES.map((a) => [a.value, a.label]));
const POLICY_TYPE_LABEL = Object.fromEntries(POLICY_TYPES.map((p) => [p.value, p.label]));

export default function NextCallHero({ prep, today, readOnly = false, onEdit, onLogPolicy }) {
  if (!prep) return null;

  const { prepped } = deriveReadiness(prep);
  const sourceLabel = PROSPECTING_SOURCE_LABELS[prep.prospectingSource] ?? prep.prospectingSource;
  const facts = [
    { k: 'WHEN', v: formatDMY(prep.intendedAppointmentDate) },
    { k: 'TYPE', v: APPT_TYPE_LABEL[prep.appointmentType] ?? prep.appointmentType ?? '—' },
    { k: 'POLICY', v: prep.policyType ? (POLICY_TYPE_LABEL[prep.policyType] ?? prep.policyType) : '—' },
  ];

  return (
    <div
      className="relative overflow-hidden p-4 sm:p-5 rounded-2xl border border-primary/40 bg-card shadow-md"
      data-testid="next-call-hero"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold tracking-wider text-primary uppercase">
          {readOnly ? 'Next joint call' : 'Your next joint call'}
        </span>
        <ApptBadge intendedDate={prep.intendedAppointmentDate} today={today} prepped={prepped} />
      </div>

      <div className="flex items-center gap-3 mt-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
          {prospectInitials(prep.clientName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-ink leading-tight truncate">{prep.clientName || '—'}</p>
          {(prep.clientAge || prep.clientOccupation) && (
            <p className="text-xs text-ink-muted mt-0.5">
              {prep.clientAge ? `${prep.clientAge} yrs` : ''}
              {prep.clientAge && prep.clientOccupation ? ' · ' : ''}
              {prep.clientOccupation || ''}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {facts.map((f) => (
          <div
            key={f.k}
            className="flex-1 min-w-[44%] px-3 py-2 rounded-lg bg-card-raised border border-border"
          >
            <p className="text-[9px] font-bold tracking-widest text-ink-muted">{f.k}</p>
            <p className="text-xs font-bold text-ink mt-0.5 truncate">{f.v}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
          {sourceLabel}{prep.socialPlatform ? ` · ${prep.socialPlatform}` : ''}
        </span>
        {prepped ? (
          <span
            className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-success/10 text-success-ink"
            data-testid="readiness-prepped"
          >
            ✓ Prepped
          </span>
        ) : (
          <span
            className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning/10 text-warning-ink"
            data-testid="readiness-needs-prep"
          >
            Needs prep
          </span>
        )}
      </div>

      {Array.isArray(prep.objections) && prep.objections.length > 0 && (
        <ObjectionRehearsal objections={prep.objections} className="mt-4" />
      )}

      {!readOnly && (onEdit || onLogPolicy) && (
        <div className="flex gap-2 mt-4">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(prep)}
              className="flex-1 min-h-[44px] px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors flex items-center justify-center gap-2"
              data-testid="hero-edit-btn"
            >
              <Pencil size={14} aria-hidden="true" /> {prepped ? 'Edit prep' : 'Finish prep'}
            </button>
          )}
          {onLogPolicy && (
            <button
              type="button"
              onClick={() => onLogPolicy(prep)}
              className="min-h-[44px] px-4 rounded-lg border border-gold/50 text-gold-ink text-sm font-semibold hover:bg-gold/5 transition-colors flex items-center justify-center gap-2"
              data-testid="hero-log-policy-btn"
            >
              <FileText size={14} aria-hidden="true" /> Log Policy
            </button>
          )}
        </div>
      )}
    </div>
  );
}
