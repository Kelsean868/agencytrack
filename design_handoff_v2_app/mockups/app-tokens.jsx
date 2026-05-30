// AgencyTrack App Layout — shared tokens, icons, and shell primitives.
// Two modes: light (default) and dark. Mapped from src/index.css Nexus tokens.

// ──────────────────────────────────────────────────────────────────────────
// PALETTES — light (default) + dark, sourced from src/index.css :root + .dark
// ──────────────────────────────────────────────────────────────────────────
const APP_LIGHT = {
  mode:         'light',
  bg:           '#F7F6F2',
  surface:      '#FFFFFF',
  surfaceRaised:'#FAFAF8',
  surfaceSoft:  '#F4F2EC',
  surfaceMute:  '#F0EFE9',
  ink:          '#28251D',
  inkMute:      '#6B6560',
  inkFaint:     '#A8A39C',
  inkDim:       '#CFCBC2',
  rule:         '#E5E2DB',
  ruleStrong:   '#CFCBC2',
  teal:         '#01696F',
  tealLight:    '#018A91',
  tealDark:     '#014E52',
  tealTint:     '#E6F4F4',
  gold:         '#B07D1A',
  goldTint:     '#FAEFD3',
  success:      '#2D7A4F',
  successTint:  '#E8F5EE',
  warning:      '#B45309',
  warningTint:  '#FEF3E2',
  danger:       '#C0392B',
  dangerTint:   '#FDE8E7',
  inkAccent:    '#5A3FA0',                // violet for variety in lists
  inkAccentTint:'#F0ECFF',
};

const APP_DARK = {
  mode:         'dark',
  bg:           '#1A1612',
  surface:      '#252019',
  surfaceRaised:'#302A23',
  surfaceSoft:  '#1F1B17',
  surfaceMute:  '#1F1B17',
  ink:          '#F0EBE0',
  inkMute:      '#B8AEA0',
  inkFaint:     '#8A8074',
  inkDim:       '#4F473E',
  rule:         'rgba(240,235,224,0.08)',
  ruleStrong:   'rgba(240,235,224,0.18)',
  teal:         '#4AB5B8',
  tealLight:    '#6FD3D6',
  tealDark:     '#01696F',
  tealTint:     'rgba(74,181,184,0.14)',
  gold:         '#E0AA3E',
  goldTint:     'rgba(224,170,62,0.14)',
  success:      '#5DB876',
  successTint:  'rgba(93,184,118,0.14)',
  warning:      '#E8B53E',
  warningTint:  'rgba(232,181,62,0.14)',
  danger:       '#D96B5D',
  dangerTint:   'rgba(217,107,93,0.14)',
  inkAccent:    '#A995E0',
  inkAccentTint:'rgba(169,149,224,0.14)',
};

const APP_FONT_DISPLAY = "'Cabinet Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const APP_FONT_SANS    = "'Satoshi', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const APP_FONT_MONO    = "'JetBrains Mono', 'Menlo', 'SF Mono', monospace";

// Standard artboard dimensions for desktop screens
const APP_W = 1280;
const APP_H = 800;

// ──────────────────────────────────────────────────────────────────────────
// Icons — simple inline SVG (children pattern; avoids babel-standalone JSX
// edge cases with elements-as-attribute-values)
// ──────────────────────────────────────────────────────────────────────────
function Icon({ children, size = 20, color = 'currentColor', stroke = 1.8, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
         strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const IconHome     = (p) => <Icon {...p}><path d="M3 12L12 4l9 8M5 10v10h14V10" /></Icon>;
const IconWizard   = (p) => <Icon {...p}><path d="M9 21h6M12 17V11M5 8h14M5 8l2-4h10l2 4M5 8v3a7 7 0 0 0 14 0V8" /></Icon>;
const IconHistory  = (p) => <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2" /></Icon>;
const IconChart    = (p) => <Icon {...p}><path d="M3 20h18M5 16V8M11 16V5M17 16v-6" /></Icon>;
const IconTarget   = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></Icon>;
const IconWallet   = (p) => <Icon {...p}><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7H5a2 2 0 0 1 0-4h14V7" /><circle cx="17" cy="13" r="1" /></Icon>;
const IconMedal    = (p) => <Icon {...p}><circle cx="12" cy="15" r="6" /><path d="M8 3l2 6M16 3l-2 6" /></Icon>;
const IconShield   = (p) => <Icon {...p}><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" /></Icon>;
const IconBolt     = (p) => <Icon {...p}><polygon points="13 2 4 14 11 14 10 22 19 10 12 10 13 2" /></Icon>;
const IconRepeat   = (p) => <Icon {...p}><path d="M17 2l4 4-4 4M3 12V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 12v4a2 2 0 0 1-2 2H3" /></Icon>;
const IconBook     = (p) => <Icon {...p}><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4z" /><path d="M4 16a4 4 0 0 1 4-4h12" /></Icon>;
const IconUsers    = (p) => <Icon {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" /></Icon>;
const IconGrid     = (p) => <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></Icon>;
const IconSettings = (p) => <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2z" /></Icon>;
const IconSearch   = (p) => <Icon {...p}><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16" y2="16" /></Icon>;
const IconBell     = (p) => <Icon {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21h4" /></Icon>;
const IconSun      = (p) => <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></Icon>;
const IconMoon     = (p) => <Icon {...p}><path d="M21 13a8 8 0 1 1-10-10 7 7 0 0 0 10 10z" /></Icon>;
const IconChevR    = (p) => <Icon {...p}><polyline points="9 6 15 12 9 18" /></Icon>;
const IconChevD    = (p) => <Icon {...p}><polyline points="6 9 12 15 18 9" /></Icon>;
const IconArrowR   = (p) => <Icon {...p}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></Icon>;
const IconCheck    = (p) => <Icon {...p}><polyline points="20 6 9 17 4 12" /></Icon>;
const IconAlert    = (p) => <Icon {...p}><path d="M12 2l10 18H2L12 2z" /><line x1="12" y1="9" x2="12" y2="14" /><circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" /></Icon>;
const IconTrophy   = (p) => <Icon {...p}><path d="M6 4h12v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V4z" /><path d="M6 6H4a2 2 0 0 0 2 4M18 6h2a2 2 0 0 1-2 4" /><path d="M9 20h6M12 16v4" /></Icon>;
const IconFilter   = (p) => <Icon {...p}><polygon points="3 4 21 4 14 13 14 20 10 20 10 13 3 4" /></Icon>;
const IconDownload = (p) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></Icon>;
const IconPlus     = (p) => <Icon {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Icon>;
const IconClock    = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 16 14" /></Icon>;

// Currency helper
function ttd(n) {
  if (n >= 1_000_000) return `TTD ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `TTD ${(n / 1_000).toFixed(1)}K`;
  return `TTD ${Math.round(n).toLocaleString()}`;
}

// Brand mark — the real AgencyTrack logo (teal shield + rising activity bars +
// teal accent dot). Inline SVG so it renders in every design-canvas HTML
// without an asset path. Source: public/icons.svg in the agencytrack repo.
function AgencyLogo({ size = 32, radius }) {
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

Object.assign(window, {
  APP_LIGHT, APP_DARK,
  APP_FONT_DISPLAY, APP_FONT_SANS, APP_FONT_MONO,
  APP_W, APP_H,
  Icon, IconHome, IconWizard, IconHistory, IconChart, IconTarget, IconWallet,
  IconMedal, IconShield, IconBolt, IconRepeat, IconBook, IconUsers, IconGrid,
  IconSettings, IconSearch, IconBell, IconSun, IconMoon, IconChevR, IconChevD,
  IconArrowR, IconCheck, IconAlert, IconTrophy, IconFilter, IconDownload, IconPlus, IconClock,
  ttd, AgencyLogo,
});
