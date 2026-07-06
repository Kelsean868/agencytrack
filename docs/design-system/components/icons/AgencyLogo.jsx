// AgencyTrack logo mark — teal shield tile + rising activity bars + accent dot.
// Copied verbatim from reference/app-tokens.jsx (source: public/icons.svg in the repo).
export function AgencyLogo({ size = 32, radius }) {
  const rad = radius != null ? radius : Math.round(size * 0.22);
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-label="AgencyTrack" style={{ display: 'block', borderRadius: rad, flexShrink: 0 }}>
      <rect x="0" y="0" width="200" height="200" rx="44" fill="#014e52" />
      <path d="M100 28 Q65 28 37 42 Q30 45 30 56 L30 115 Q30 160 100 188 Q170 160 170 115 L170 56 Q170 45 163 42 Q135 28 100 28 Z" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.55" strokeWidth="2.5" />
      <rect x="72" y="127" width="11" height="18" rx="2.5" fill="white" fillOpacity="0.30" />
      <rect x="87" y="117" width="11" height="28" rx="2.5" fill="white" fillOpacity="0.50" />
      <rect x="102" y="105" width="11" height="40" rx="2.5" fill="white" fillOpacity="0.75" />
      <rect x="117" y="93" width="11" height="52" rx="2.5" fill="white" />
      <circle cx="122.5" cy="86" r="4.5" fill="#4ecdc4" />
      <polyline points="120,87 122.5,84 125,87" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
