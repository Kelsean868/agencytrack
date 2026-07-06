// AgencyTrack icon set — inline SVG, 24px viewBox, stroke 1.8, round caps/joins.
// Copied verbatim from reference/app-tokens.jsx (the codebase's own hand-rolled Lucide-style set).
//
// Two APIs:
//   1. children  — <Icon><path d="…"/></Icon> (original)
//   2. name      — <Icon name="bell" /> looks up NAME_PATHS below. Added for the
//                  2026 nav + state patterns (nexus-nav, nexus-patterns) which
//                  address glyphs by name. Names map to the same hand-rolled set.
const NAME_PATHS = {
  home:     ['M3 12L12 4l9 8M5 10v10h14V10'],
  wizard:   ['M9 21h6M12 17V11M5 8h14M5 8l2-4h10l2 4M5 8v3a7 7 0 0 0 14 0V8'],
  history:  ['M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2'],
  chart:    ['M3 20h18M5 16V8M11 16V5M17 16v-6'],
  target:   ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M12 11.4a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2'],
  wallet:   ['M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7H5a2 2 0 0 1 0-4h14V7', 'M17 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2'],
  medal:    ['M12 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12', 'M8 3l2 6M16 3l-2 6'],
  shield:   ['M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z'],
  bolt:     ['M13 2 4 14h7l-1 8 9-12h-7l1-8z'],
  repeat:   ['M17 2l4 4-4 4M3 12V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 12v4a2 2 0 0 1-2 2H3'],
  book:     ['M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4z', 'M4 16a4 4 0 0 1 4-4h12'],
  users:    ['M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M8.5 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11'],
  grid:     ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  settings: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6', 'M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2z'],
  search:   ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14', 'M20 20l-4-4'],
  bell:     ['M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8', 'M10 21h4'],
  sun:      ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5'],
  moon:     ['M21 13a8 8 0 1 1-10-10 7 7 0 0 0 10 10z'],
  trophy:   ['M6 4h12v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V4z', 'M6 6H4a2 2 0 0 0 2 4M18 6h2a2 2 0 0 1-2 4', 'M9 20h6M12 16v4'],
  clock:    ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'M12 7v5l4 2'],
  filter:   ['M3 4h18l-7 9v7l-4-2v-5z'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3'],
  calendar: ['M7 3v4M17 3v4M3 9h18M4 5h16v16H4z'],
  check:    ['M20 6 9 17l-5-5'],
  plus:     ['M12 5v14M5 12h14'],
  arrow:    ['M5 12h14', 'M12 5l7 7-7 7'],
  pin:      ['M9 4h6l-1 6 3 3H7l3-3-1-6z', 'M12 13v7'],
};
export function Icon({ children, name, size = 20, color = 'currentColor', stroke = 1.8, fill = 'none', style }) {
  const paths = name ? (NAME_PATHS[name] || NAME_PATHS.grid) : null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
         strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}
         aria-hidden={name ? 'true' : undefined}>
      {paths ? paths.map((d, i) => <path key={i} d={d} />) : children}
    </svg>
  );
}
export const IconHome     = (p) => <Icon {...p}><path d="M3 12L12 4l9 8M5 10v10h14V10" /></Icon>;
export const IconWizard   = (p) => <Icon {...p}><path d="M9 21h6M12 17V11M5 8h14M5 8l2-4h10l2 4M5 8v3a7 7 0 0 0 14 0V8" /></Icon>;
export const IconHistory  = (p) => <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2" /></Icon>;
export const IconChart    = (p) => <Icon {...p}><path d="M3 20h18M5 16V8M11 16V5M17 16v-6" /></Icon>;
export const IconTarget   = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></Icon>;
export const IconWallet   = (p) => <Icon {...p}><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7H5a2 2 0 0 1 0-4h14V7" /><circle cx="17" cy="13" r="1" /></Icon>;
export const IconMedal    = (p) => <Icon {...p}><circle cx="12" cy="15" r="6" /><path d="M8 3l2 6M16 3l-2 6" /></Icon>;
export const IconShield   = (p) => <Icon {...p}><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" /></Icon>;
export const IconBolt     = (p) => <Icon {...p}><polygon points="13 2 4 14 11 14 10 22 19 10 12 10 13 2" /></Icon>;
export const IconRepeat   = (p) => <Icon {...p}><path d="M17 2l4 4-4 4M3 12V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 12v4a2 2 0 0 1-2 2H3" /></Icon>;
export const IconBook     = (p) => <Icon {...p}><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4z" /><path d="M4 16a4 4 0 0 1 4-4h12" /></Icon>;
export const IconUsers    = (p) => <Icon {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" /></Icon>;
export const IconGrid     = (p) => <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></Icon>;
export const IconSettings = (p) => <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2z" /></Icon>;
export const IconSearch   = (p) => <Icon {...p}><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16" y2="16" /></Icon>;
export const IconBell     = (p) => <Icon {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21h4" /></Icon>;
export const IconSun      = (p) => <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></Icon>;
export const IconMoon     = (p) => <Icon {...p}><path d="M21 13a8 8 0 1 1-10-10 7 7 0 0 0 10 10z" /></Icon>;
export const IconChevR    = (p) => <Icon {...p}><polyline points="9 6 15 12 9 18" /></Icon>;
export const IconChevD    = (p) => <Icon {...p}><polyline points="6 9 12 15 18 9" /></Icon>;
export const IconArrowR   = (p) => <Icon {...p}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></Icon>;
export const IconCheck    = (p) => <Icon {...p}><polyline points="20 6 9 17 4 12" /></Icon>;
export const IconAlert    = (p) => <Icon {...p}><path d="M12 2l10 18H2L12 2z" /><line x1="12" y1="9" x2="12" y2="14" /><circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" /></Icon>;
export const IconTrophy   = (p) => <Icon {...p}><path d="M6 4h12v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V4z" /><path d="M6 6H4a2 2 0 0 0 2 4M18 6h2a2 2 0 0 1-2 4" /><path d="M9 20h6M12 16v4" /></Icon>;
export const IconFilter   = (p) => <Icon {...p}><polygon points="3 4 21 4 14 13 14 20 10 20 10 13 3 4" /></Icon>;
export const IconDownload = (p) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></Icon>;
export const IconPlus     = (p) => <Icon {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Icon>;
export const IconClock    = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 16 14" /></Icon>;
