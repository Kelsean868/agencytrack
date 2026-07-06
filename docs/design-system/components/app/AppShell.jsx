// Nexus page shell — sidebar + topbar + content, 1280×800 desktop frame.
// Wrap in .nexus / .nexus.dark (or pass dark prop and it sets the classes itself).
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';

export function AppShell({ active, title, subtitle, dark = false, onToggleMode, onNavigate, sections, org, user, width = 1280, height = 800, children }) {
  return (
    <div className={dark ? 'nexus dark' : 'nexus'} style={{
      width, height, background: 'var(--bg)',
      color: 'var(--ink)', fontFamily: 'var(--sans)',
      position: 'relative', overflow: 'hidden', boxSizing: 'border-box',
      display: 'flex',
    }}>
      <Sidebar active={active} sections={sections} org={org} user={user} onNavigate={onNavigate} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar title={title} subtitle={subtitle} dark={dark} onToggleMode={onToggleMode} />
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
