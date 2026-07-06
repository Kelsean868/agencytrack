// PDF shared primitives — design tokens + page shell + small components.
// All components render at native A4 size (595 × 842 px @ 1pt = 1px).

const A4_W = 595;
const A4_H = 842;
const PAD  = 36; // outer page margin — slightly more generous than current 32

const PDF = {
  // Brand — kept on-palette with the existing report so this is a refresh,
  // not a re-brand. Slightly deeper ink for stronger print contrast.
  teal:        '#01696F',
  tealDark:    '#014E52',
  tealMid:     '#02838A',
  tealLight:   '#D6ECEC',
  tealTint:    '#F0F7F7',

  paper:       '#FFFFFF',
  paperCream:  '#FBFAF6',   // cover + accent panels
  paperSoft:   '#F7F6F2',   // optional fill for chart bg etc
  paperPanel:  '#F9F7F2',

  ink:         '#1F1C16',
  inkMute:     '#6B6560',
  inkFaint:    '#A8A39C',

  rule:        '#EAE6DD',
  ruleStrong:  '#CFCBC2',

  gold:        '#B07D1A',
  goldTint:    '#FAEFD3',
  success:     '#2D7A4F',
  successTint: '#E3F1E9',
  warning:     '#B45309',
  warningTint: '#FEF1DA',
  danger:      '#C0392B',
  dangerTint:  '#FADEDB',
};

// Email-safe + react-pdf-compatible stack. Cabinet Grotesk is what their
// Tailwind config uses for display; we'd register it with Font.register()
// in the real export — for the mock we let it fall back to Helvetica Neue.
const SERIF_DISPLAY = "'Cabinet Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const SANS          = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO          = "'JetBrains Mono', 'Menlo', 'SF Mono', monospace";

// ── PdfPage — single A4 page with optional running header / footer ─────────
function PdfPage({ children, runningHeader, pageNumber, totalPages, paper = PDF.paper, footer = true, agentName = 'Marsha Singh' }) {
  return (
    <div style={{
      width: A4_W,
      height: A4_H,
      background: paper,
      color: PDF.ink,
      fontFamily: SANS,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {runningHeader && (
        <div style={{
          position: 'absolute', top: 18, left: PAD, right: PAD,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingBottom: 10,
          borderBottom: `1px solid ${PDF.rule}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 200 200" style={{ display: 'block', borderRadius: 4 }}>
              <rect x="0" y="0" width="200" height="200" rx="44" fill="#014e52" />
              <path d="M100 28 Q65 28 37 42 Q30 45 30 56 L30 115 Q30 160 100 188 Q170 160 170 115 L170 56 Q170 45 163 42 Q135 28 100 28 Z" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.55" strokeWidth="2.5" />
              <rect x="72" y="127" width="11" height="18" rx="2.5" fill="white" fillOpacity="0.30" />
              <rect x="87" y="117" width="11" height="28" rx="2.5" fill="white" fillOpacity="0.50" />
              <rect x="102" y="105" width="11" height="40" rx="2.5" fill="white" fillOpacity="0.75" />
              <rect x="117" y="93" width="11" height="52" rx="2.5" fill="white" />
              <circle cx="122.5" cy="86" r="4.5" fill="#4ecdc4" />
              <polyline points="120,87 122.5,84 125,87" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.005em' }}>AgencyTrack</div>
            <div style={{ fontSize: 8.5, color: PDF.inkFaint }}>·</div>
            <div style={{ fontSize: 8.5, color: PDF.inkMute }}>Performance Report</div>
          </div>
          <div style={{ fontSize: 8.5, color: PDF.inkMute, letterSpacing: '0.04em' }}>
            {agentName} · YTD 2026
          </div>
        </div>
      )}

      {/* Content slot */}
      <div style={{
        position: 'absolute',
        top: runningHeader ? 48 : 0,
        bottom: footer ? 36 : 0,
        left: 0, right: 0,
      }}>
        {children}
      </div>

      {footer && (
        <div style={{
          position: 'absolute', bottom: 14, left: PAD, right: PAD,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 8, color: PDF.inkFaint, letterSpacing: '0.06em',
        }}>
          <div style={{ textTransform: 'uppercase' }}>Tatil Life · Confidential</div>
          <div style={{ textTransform: 'uppercase' }}>
            {typeof pageNumber === 'number' && `Page ${String(pageNumber).padStart(2, '0')} / ${String(totalPages ?? '04').padStart(2, '0')}`}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Editorial section header — eyebrow number + uppercase title ────────────
function SectionMark({ n, title, subtitle }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4,
      }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: PDF.teal, letterSpacing: '0.18em',
          fontFamily: MONO,
        }}>{n}</div>
        <div style={{
          flex: 1, height: 1, background: PDF.rule, alignSelf: 'center', marginTop: 2,
        }}></div>
      </div>
      <div style={{
        fontSize: 16, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.018em',
        lineHeight: 1.15, fontFamily: SERIF_DISPLAY,
      }}>{title}</div>
      {subtitle && (
        <div style={{
          fontSize: 9.5, color: PDF.inkMute, marginTop: 3,
          letterSpacing: '0.005em', lineHeight: 1.4,
        }}>{subtitle}</div>
      )}
    </div>
  );
}

// ── Pill ───────────────────────────────────────────────────────────────────
function Pill({ children, color = PDF.teal, bg = PDF.tealTint }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 999,
      fontSize: 8, fontWeight: 700, color, background: bg,
      letterSpacing: '0.09em', textTransform: 'uppercase',
      fontFamily: SANS,
    }}>{children}</span>
  );
}

// ── Hairline divider ───────────────────────────────────────────────────────
function Hairline({ strong = false, marginY = 12 }) {
  return <div style={{ height: 1, background: strong ? PDF.ruleStrong : PDF.rule, margin: `${marginY}px 0` }}></div>;
}

// Format currency to TTD
function ttd(n) {
  if (n === null || n === undefined) return '—';
  return 'TTD ' + Math.round(n).toLocaleString('en-US');
}

Object.assign(window, {
  PDF, SERIF_DISPLAY, SANS, MONO,
  A4_W, A4_H, PAD,
  PdfPage, SectionMark, Pill, Hairline,
  ttd,
});
