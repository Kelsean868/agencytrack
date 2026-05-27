// Attribution-only platforms — which social platform sourced a prospect.
// Separate from the wizard's SOCIAL_PLATFORMS (weekly breakdown, 4 values);
// includes tiktok + other which the wizard does not track.
// Shared by prospectInfoService and policiesService to avoid cross-service import.
export const SOCIAL_PLATFORMS_ATTRIBUTION = [
  { value: 'whatsapp',   label: 'WhatsApp' },
  { value: 'instagram',  label: 'Instagram' },
  { value: 'facebook',   label: 'Facebook' },
  { value: 'tiktok',     label: 'TikTok' },
  { value: 'linkedin',   label: 'LinkedIn' },
  { value: 'other',      label: 'Other' },
];
