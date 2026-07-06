// Nexus sidebar — 232px, brand block, mono section titles, teal active state.
// Adapted from reference/app-shell.jsx (t-prop palette → CSS vars).
import { AgencyLogo } from '../icons/AgencyLogo.jsx';
import {
  IconHome, IconWizard, IconHistory, IconChart, IconWallet, IconTarget,
  IconBolt, IconRepeat, IconBook, IconSearch, IconMedal, IconShield,
} from '../icons/Icon.jsx';

export const NEXUS_SIDEBAR_W = 232;

const DEFAULT_SECTIONS = [
  { title: null, items: [
    { key: 'home',     Icon: IconHome,    label: 'Dashboard' },
    { key: 'wizard',   Icon: IconWizard,  label: 'Weekly Report' },
    { key: 'history',  Icon: IconHistory, label: 'History' },
  ]},
  { title: 'Planning', items: [
    { key: 'lookahead', Icon: IconChart,  label: 'Game Plan', badge: 'NEW' },
    { key: 'money',     Icon: IconWallet, label: 'Money Needs', child: true },
    { key: 'goals',     Icon: IconTarget, label: 'Goals' },
  ]},
  { title: 'Tools', items: [
    { key: 'commission',  Icon: IconBolt,   label: 'Commission' },
    { key: 'persistency', Icon: IconRepeat, label: 'Persistency' },
    { key: 'ledger',      Icon: IconBook,   label: 'Policy Ledger' },
    { key: 'prospect',    Icon: IconSearch, label: 'Prospect Prep' },
  ]},
  { title: 'Recognition', items: [
    { key: 'awards', Icon: IconMedal,  label: 'Awards' },
    { key: 'career', Icon: IconShield, label: 'Career Portal' },
  ]},
];

export function Sidebar({ active = 'home', sections = DEFAULT_SECTIONS, org = 'Tatil Life · South', user = { initials: 'MS', name: 'Marsha Singh', role: 'Senior Associate' }, onNavigate }) {
  return (
    <div style={{
      width: NEXUS_SIDEBAR_W, background: 'var(--surface)',
      borderRight: '1px solid var(--rule)',
      display: 'flex', flexDirection: 'column', padding: '20px 12px',
      flexShrink: 0, fontFamily: 'var(--sans)', boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 18px', borderBottom: '1px solid var(--rule)', marginBottom: 12 }}>
        <AgencyLogo size={32} />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.012em' }}>AgencyTrack</div>
          <div style={{ fontSize: 10, color: 'var(--inkMute)', marginTop: 1 }}>{org}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sections.map((s, si) => (
          <div key={si} style={{ marginBottom: 14 }}>
            {s.title ? (
              <div style={{
                fontSize: 9.5, fontWeight: 700, color: 'var(--inkFaint)',
                letterSpacing: '0.14em', textTransform: 'uppercase',
                padding: '10px 12px 6px', fontFamily: 'var(--mono)',
              }}>{s.title}</div>
            ) : null}
            {s.items.map((it) => {
              const isActive = active === it.key;
              return (
                <div key={it.key}
                  onClick={onNavigate ? () => onNavigate(it.key) : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: it.child ? 9 : 11,
                    padding: it.child ? '7px 12px 7px 32px' : '9px 12px', borderRadius: 9,
                    background: isActive ? 'var(--tealTint)' : 'transparent',
                    color: isActive ? 'var(--teal)' : 'var(--inkMute)',
                    transition: 'background-color 180ms ease, color 180ms ease',
                    fontSize: it.child ? 12 : 13, fontWeight: 600,
                    position: 'relative', cursor: onNavigate ? 'pointer' : 'default',
                  }}>
                  {isActive ? (
                    <div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, background: 'var(--teal)', borderRadius: 999 }}></div>
                  ) : null}
                  {it.child ? (
                    <div style={{ position: 'absolute', left: 19, top: -2, width: 10, height: 16, borderLeft: '1.5px solid var(--rule)', borderBottom: '1.5px solid var(--rule)', borderBottomLeftRadius: 5, pointerEvents: 'none' }}></div>
                  ) : null}
                  <it.Icon size={it.child ? 15 : 17} color={isActive ? 'var(--teal)' : 'var(--inkMute)'} stroke={1.8} />
                  <div style={{ flex: 1 }}>{it.label}</div>
                  {it.badge ? (
                    <div style={{
                      padding: '1px 6px', borderRadius: 999, fontSize: 8.5, fontWeight: 700,
                      background: 'var(--gold)', color: 'var(--surface)', letterSpacing: '0.06em',
                    }}>{it.badge}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{
        padding: '12px 10px', borderTop: '1px solid var(--rule)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', background: 'var(--tealTint)',
          color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13, fontFamily: 'var(--display)', flexShrink: 0,
        }}>{user.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
          <div style={{ fontSize: 10.5, color: 'var(--inkMute)', marginTop: 1 }}>{user.role}</div>
        </div>
      </div>
    </div>
  );
}
