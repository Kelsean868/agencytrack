// Nexus topbar — 60px, page title, ⌘K search, mode toggle, bell.
// Adapted from reference/app-shell.jsx.
import { IconSearch, IconSun, IconMoon, IconBell } from '../icons/Icon.jsx';

export function Topbar({ title, subtitle, dark = false, onToggleMode }) {
  const iconBox = {
    width: 36, height: 36, borderRadius: 9, background: 'var(--surface)',
    border: '1px solid var(--rule)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: 'var(--inkMute)', cursor: 'pointer', flexShrink: 0,
  };
  return (
    <div style={{
      height: 60, background: 'var(--surface)', borderBottom: '1px solid var(--rule)',
      padding: '0 28px', display: 'flex', alignItems: 'center', gap: 18,
      flexShrink: 0, fontFamily: 'var(--sans)', boxSizing: 'border-box',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.012em', fontFamily: 'var(--display)' }}>{title}</div>
        {subtitle ? <div style={{ fontSize: 11.5, color: 'var(--inkMute)', marginTop: 1 }}>{subtitle}</div> : null}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 9, width: 280,
        padding: '8px 14px', background: 'var(--surfaceSoft)', borderRadius: 9,
        border: '1px solid var(--rule)', boxSizing: 'border-box',
      }}>
        <IconSearch size={14} color="var(--inkMute)" />
        <div style={{ flex: 1, fontSize: 12.5, color: 'var(--inkFaint)' }}>Search agents, policies, weeks…</div>
        <div style={{ fontSize: 10, color: 'var(--inkFaint)', padding: '2px 6px', background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 4, fontFamily: 'var(--mono)' }}>⌘K</div>
      </div>

      <div style={iconBox} onClick={onToggleMode} role="button" aria-label="Toggle mode">
        {dark ? <IconSun size={16} color="var(--inkMute)" /> : <IconMoon size={16} color="var(--inkMute)" />}
      </div>

      <div style={{ ...iconBox, position: 'relative', cursor: 'default' }}>
        <IconBell size={16} color="var(--inkMute)" />
        <div style={{ position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', border: '2px solid var(--surface)' }}></div>
      </div>
    </div>
  );
}
