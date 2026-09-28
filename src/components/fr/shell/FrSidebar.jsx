import React, { useMemo } from 'react';
import FrIcon from './FrIcon';
import { FR_NAV, frNavItems, frFindByTab, frTargetTab } from './frNav';

/**
 * FrSidebar — the FR desktop sidebar (canvas D3-Sidebar), a pure view.
 *
 * Groups Work · Numbers · Money · Compete · You. The active hub (Money,
 * Numbers) opens its sub-items in place. Footer: the weekly-report card
 * (the most important recurring action) and the account row (profile,
 * Settings, Sign out — sign-out must stay reachable at every width).
 *
 * Widths are CSS (src/styles/fr-look.css `.fr-sidebar`): 220px at ≥1024px,
 * a 72px icon rail at 768–1023px, hidden below 768px (the tab bar takes over).
 *
 * @param {object}   props
 * @param {string}   props.activeTab           current AgentDashboard route
 * @param {(tabId: string) => void} props.onNavigate
 * @param {(action: string) => void} props.onAction   'submit' opens the weekly report
 * @param {{ title: string, sub: string, done: boolean }} [props.report]
 * @param {{ name: string, roleLabel?: string, photoURL?: string }} props.user
 * @param {() => void} props.onSignOut
 * @param {object[]} [props.nav]              defaults to FR_NAV (tests inject)
 */
export default function FrSidebar({ activeTab, onNavigate, onAction, report, user, onSignOut, nav = FR_NAV }) {
  const items = useMemo(() => frNavItems(nav), [nav]);
  const hit = frFindByTab(activeTab, nav);
  const initials = (user?.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

  let lastGroup = null;
  return (
    <nav aria-label="Primary navigation" className="fr-sidebar" data-testid="fr-sidebar">
      <button type="button" className="fr-sidebar-brand" onClick={() => onNavigate('dashboard')} aria-label="AgencyTrack — Today">
        <span className="fr-sidebar-mark" aria-hidden="true">
          <span className="h-1.5" />
          <span className="h-2.5" />
          <span className="h-3.5" />
        </span>
        <span className="fr-sidebar-hide font-display text-[17px] font-bold tracking-[-0.02em]">AgencyTrack</span>
      </button>

      <div className="fr-sidebar-scroll">
        {items.map((it) => {
          const head = it.group !== lastGroup ? it.group : null;
          lastGroup = it.group;
          const on = hit?.item.id === it.id;
          const open = on && Array.isArray(it.subs);
          return (
            <React.Fragment key={it.id}>
              {head ? <div className="fr-sidebar-head fr-sidebar-hide">{head}</div> : null}
              <button
                type="button"
                className="fr-sidebar-item"
                data-active={on ? 'true' : 'false'}
                aria-current={on && !it.subs ? 'page' : undefined}
                aria-expanded={it.subs ? open : undefined}
                title={it.label}
                data-testid={`fr-nav-${it.id}`}
                onClick={() => onNavigate(frTargetTab(it))}
              >
                <FrIcon name={it.icon} />
                <span className="fr-sidebar-hide min-w-0 flex-1 truncate text-left">{it.label}</span>
                {it.subs ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                    className={`fr-sidebar-hide shrink-0 opacity-60 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                ) : null}
              </button>
              {open ? (
                <div className="fr-sidebar-subs fr-sidebar-hide">
                  {it.subs.map((s) => {
                    const sOn = hit?.sub?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className="fr-sidebar-sub"
                        data-active={sOn ? 'true' : 'false'}
                        aria-current={sOn ? 'page' : undefined}
                        data-testid={`fr-nav-${it.id}-${s.id}`}
                        onClick={() => onNavigate(s.tabId)}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>

      <div className="fr-sidebar-foot">
        {report ? (
          <button
            type="button"
            className="fr-sidebar-report"
            data-done={report.done ? 'true' : 'false'}
            onClick={() => onAction('submit')}
            title={report.title}
            data-testid="fr-nav-report"
          >
            <FrIcon name={report.done ? 'check' : 'report'} className="text-primary" />
            <span className="fr-sidebar-hide flex min-w-0 flex-col text-left">
              <span className="truncate text-[13px] font-bold text-primary">{report.title}</span>
              <span className="truncate text-[12px] text-ink-muted">{report.sub}</span>
            </span>
          </button>
        ) : null}
        <div className="fr-sidebar-account">
          <button type="button" className="fr-sidebar-avatar" onClick={() => onNavigate('profile')} aria-label="Open profile">
            {user?.photoURL ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" /> : initials}
          </button>
          <span className="fr-sidebar-hide flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-bold" title={user?.name || 'Agent'}>{user?.name || 'Agent'}</span>
            {user?.roleLabel ? <span className="truncate text-[11px] text-ink-muted">{user.roleLabel}</span> : null}
          </span>
          <button type="button" className="fr-sidebar-icon-btn" onClick={() => onNavigate('settings')} aria-label="Settings" title="Settings">
            <FrIcon name="settings" size={16} />
          </button>
          <button type="button" className="fr-sidebar-icon-btn" onClick={onSignOut} aria-label="Sign out" title="Sign out">
            <FrIcon name="signOut" size={16} />
          </button>
        </div>
      </div>
    </nav>
  );
}
