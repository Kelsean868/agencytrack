/**
 * Pure helpers for WeekConfirmView.
 *
 * Kept separate from the component file so react-refresh (Fast Refresh)
 * doesn't flag the mixed component + non-component export pattern.
 */

/**
 * Derive the WeekConfirmView section array from an aggregated weekly draft.
 *
 * Mirrors DailyCaptureV2's GroupCard layout. Reflection fields (hoursWorked,
 * wins, blockers, notes) are excluded — they are per-day journal entries not
 * propagated to the weekly report.
 *
 * @param {object} draft - aggregated weekly draft (from aggregateDailyToWeekly)
 * @returns {Array<{id,label,accent,provenanceCount,rows}>}
 */
export function deriveSections(draft) {
  const d    = draft ?? {};
  const days = d.daysWorked ?? 0;
  const nb   = d.newBusiness ?? {};
  const ppp  = d.pppIncreases ?? {};
  const lmps = d.lumpsums ?? {};
  const spb  = d.socialPlatformBreakdown ?? {};

  return [
    {
      id:              'prospecting',
      label:           'Prospecting & outreach',
      accent:          'teal',
      provenanceCount: days,
      rows: [
        { key: 'prospectingLettersSent', label: 'Prospecting letters sent',  value: d.prospectingLettersSent ?? 0 },
        { key: 'seminarsConducted',      label: 'Seminars conducted',        value: d.seminarsConducted ?? 0 },
        { key: 'dials',                  label: 'Dials (total calls)',        value: d.dials ?? 0 },
        { key: 'telContacts',            label: 'Tel contacts (reached)',     value: d.telContacts ?? 0 },
        { key: 'f2fAttempts',            label: 'F2F attempts',              value: d.f2fAttempts ?? 0 },
        { key: 'qualifiedApproaches',    label: 'Qualified approaches',      value: d.qualifiedApproaches ?? 0 },
        { key: 'namesFromOther',         label: 'New names added',           value: d.namesFromOther ?? 0 },
        { key: 'oldNamesPool',           label: 'Old names worked',          value: d.oldNamesPool ?? 0 },
      ],
    },
    {
      id:              'social',
      label:           'Social & content',
      accent:          'teal',
      provenanceCount: days,
      rows: [
        { key: 'socialPostsTotal',                  label: 'Posts / content published', value: d.socialPostsTotal ?? 0 },
        { key: 'socialEngagementTotal',             label: 'Engagement total',          value: d.socialEngagementTotal ?? 0 },
        { key: 'socialInboxEnquiries',              label: 'Inbox enquiries',           value: d.socialInboxEnquiries ?? 0 },
        { key: 'namesFromSocial',                   label: 'Names from social',         value: d.namesFromSocial ?? 0 },
        { key: 'socialPlatformBreakdown.facebook',  label: 'Facebook',                  value: spb.facebook ?? 0 },
        { key: 'socialPlatformBreakdown.instagram', label: 'Instagram',                 value: spb.instagram ?? 0 },
        { key: 'socialPlatformBreakdown.whatsapp',  label: 'WhatsApp',                  value: spb.whatsapp ?? 0 },
        { key: 'socialPlatformBreakdown.linkedin',  label: 'LinkedIn',                  value: spb.linkedin ?? 0 },
      ],
    },
    {
      id:              'appointments',
      label:           'Appointments & FFI',
      accent:          'teal',
      provenanceCount: days,
      rows: [
        { key: 'appointmentsSet', label: 'Appointments set', value: d.appointmentsSet ?? 0 },
        { key: 'ffisScheduled',   label: 'FFIs scheduled',   value: d.ffisScheduled ?? 0 },
        { key: 'ffiConducted',    label: 'FFIs conducted',   value: d.ffiConducted ?? 0 },
      ],
    },
    {
      id:              'interviews',
      label:           'Interviews',
      accent:          'gold',
      provenanceCount: days,
      rows: [
        { key: 'newCIBooked',           label: 'New CIs booked',          value: d.newCIBooked ?? 0 },
        { key: 'oldCIBooked',           label: 'Old CIs booked',          value: d.oldCIBooked ?? 0 },
        { key: 'ciConducted',           label: 'CIs conducted',           value: d.ciConducted ?? 0 },
        { key: 'solutionPresentations', label: 'Solution presentations',  value: d.solutionPresentations ?? 0 },
      ],
    },
    {
      id:              'production',
      label:           'Production',
      accent:          'gold',
      provenanceCount: days,
      rows: [
        { key: 'newBusiness.apps',         label: 'Apps written',           value: nb.apps ?? 0 },
        { key: 'livesSold',                label: 'Lives sold',             value: d.livesSold ?? 0 },
        { key: 'newBusiness.api',          label: 'API (TTD)',              value: nb.api ?? 0,             unit: 'TTD' },
        { key: 'pppIncreases.apps',        label: 'PPP increases — apps',  value: ppp.apps ?? 0 },
        { key: 'pppIncreases.apiIncrease', label: 'PPP API increase',      value: ppp.apiIncrease ?? 0,    unit: 'TTD' },
        { key: 'lumpsums.grossAmount',     label: 'Lumpsum — gross',       value: lmps.grossAmount ?? 0,   unit: 'TTD' },
      ],
    },
    {
      id:              'delivery',
      label:           'Delivery & service',
      accent:          'teal',
      provenanceCount: days,
      rows: [
        { key: 'policiesDelivered', label: 'Policies delivered', value: d.policiesDelivered ?? 0 },
        { key: 'serviceContacts',   label: 'Service contacts',   value: d.serviceContacts ?? 0 },
      ],
    },
    {
      id:              'hours',
      label:           'Hours',
      accent:          'teal',
      provenanceCount: days,
      rows: [
        { key: 'officeHours', label: 'Office hours', value: d.officeHours ?? 0, unit: 'h' },
        { key: 'fieldHours',  label: 'Field hours',  value: d.fieldHours ?? 0,  unit: 'h' },
      ],
    },
  ];
}
