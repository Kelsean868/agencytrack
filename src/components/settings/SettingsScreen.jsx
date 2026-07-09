// Explicit React import — required for Vitest compatibility per banked rule
// (Vite applies the automatic JSX transform but Vitest does not always).
import React, { useState } from 'react';
import { Sun, Moon, Monitor, UserCog, ChevronRight } from 'lucide-react';
import { useTheme } from '../../lib/theme';
import useAppSettings from '../../hooks/useAppSettings';
import {
  MASTER_SHEET_PRESETS, DEFAULT_MASTER_SHEET_PRESET, isValidMasterSheetPreset,
  PERIOD_OPTIONS, DEFAULT_PERIOD, isValidPeriod,
} from '../../config/viewDefaults';

/**
 * SettingsScreen — Settings v2 shell + "My Preferences" tab (Fable Tier 2 · 2.4).
 *
 * Ports `docs/design-system/screens-v2/settings-v2.jsx` to real tokened UI. Scope
 * is the operator SPLIT ruling: the shell + My Preferences ONLY. The mockup's
 * "Team Defaults" recommend-vs-lock cascade is deliberately NOT built (no tab
 * rendered), and the "Account" tab is a shortcut into the existing ProfileScreen
 * (which owns edit / photo / password / sign-out), not a duplicate profile form.
 *
 * HONESTY RULE — only controls wired to a live consumer ship:
 *   • Theme (Light/Dark/System) → `src/lib/theme.js` (same source of truth as the
 *     topbar toggle; System resolves via matchMedia and tracks the OS live).
 *   • Default time period → seeds the production-leaderboard surface's period.
 *   • Master Sheet preset (managers only) → seeds the Master Sheet's column preset.
 *   • Notifications → the app has no toggleable notification-pref substrate today
 *     (push is a future release); the one real control — the daily reminder time —
 *     lives in Profile, so we link there instead of rendering dead toggles.
 *   • Density → SKIPPED: the app has no density substrate (no compact/comfortable
 *     class, token, or data-attr). Inventing one is a design-system decision, not
 *     a Settings wiring task. Row intentionally omitted (no dead control).
 *
 * @param {{ role?: string, roleLabel?: string, userProfile?: object,
 *           tenantId?: string, uid?: string, onOpenProfile?: () => void }} props
 */
export default function SettingsScreen({
  role,
  roleLabel,
  userProfile,
  tenantId,
  uid,
  onOpenProfile,
}) {
  const [tab, setTab] = useState('prefs');

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      {/* Tab bar + "signed in as" caption (Team Defaults tab intentionally absent) */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label="Settings sections"
          className="inline-flex gap-1 p-1 rounded-xl bg-card-raised border border-border"
        >
          {[['prefs', 'My Preferences'], ['account', 'Account']].map(([k, label]) => {
            const on = k === tab;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(k)}
                data-testid={`settings-tab-${k}`}
                className={`min-h-[44px] px-4 rounded-lg text-sm font-bold transition-colors ${
                  on ? 'bg-card text-primary border border-border shadow-sm' : 'text-ink-muted hover:text-ink border border-transparent'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {roleLabel && (
          <p className="text-xs text-ink-muted">
            Signed in as <span className="font-semibold text-ink">{roleLabel}</span>
          </p>
        )}
      </div>

      {tab === 'prefs'
        ? <MyPreferences role={role} tenantId={tenantId} uid={uid} onOpenProfile={onOpenProfile} />
        : <AccountTab role={role} roleLabel={roleLabel} userProfile={userProfile} onOpenProfile={onOpenProfile} />}
    </div>
  );
}

// ── My Preferences ───────────────────────────────────────────────────────────
function MyPreferences({ role, tenantId, uid, onOpenProfile }) {
  const { mode, setMode } = useTheme();
  const { settings, setSetting } = useAppSettings({ tenantId, uid });

  const isAgent = role === 'agent';
  const isAdmin = role === 'tenant_admin' || role === 'platform_admin';
  // Master Sheet exists for producing/non-producing managers, not agents or
  // tenant admins — only offer the preset where the surface actually renders.
  const showMasterSheet = !isAgent && !isAdmin;
  // The production leaderboard exists for agents + managers, not tenant admins.
  const showPeriod = !isAdmin;

  const periodValue = isValidPeriod(settings.defaultPeriod) ? settings.defaultPeriod : DEFAULT_PERIOD;
  const presetValue = isValidMasterSheetPreset(settings.masterSheetPreset)
    ? settings.masterSheetPreset : DEFAULT_MASTER_SHEET_PRESET;

  return (
    <div className="flex flex-col gap-4">
      {/* APPEARANCE */}
      <Group title="Appearance">
        <Row title="Theme" desc="Light, dark, or follow your device.">
          <Segmented
            name="settings-theme"
            ariaLabel="Theme"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'light', label: 'Light', Icon: Sun },
              { value: 'dark', label: 'Dark', Icon: Moon },
              { value: 'system', label: 'System', Icon: Monitor },
            ]}
          />
        </Row>
        {/* Density row intentionally SKIPPED — no density substrate in the app
            (see component docstring). Adding one is a design-system decision. */}
      </Group>

      {/* VIEW DEFAULTS — only rendered when at least one row applies to the role */}
      {(showPeriod || showMasterSheet) && (
        <Group
          title="View Defaults"
          sub="How surfaces open for you. In-context controls still work — they change the same setting for that session."
        >
          {showPeriod && (
            <Row
              title="Default time period"
              desc="Your production leaderboard opens on this period."
            >
              <Segmented
                name="settings-period"
                ariaLabel="Default time period"
                value={periodValue}
                onChange={(v) => setSetting('defaultPeriod', v)}
                options={PERIOD_OPTIONS}
              />
            </Row>
          )}
          {showMasterSheet && (
            <Row
              title="Master Sheet preset"
              desc="Which column set the team Master Sheet loads first."
            >
              <Segmented
                name="settings-mastersheet-preset"
                ariaLabel="Master Sheet preset"
                value={presetValue}
                onChange={(v) => setSetting('masterSheetPreset', v)}
                options={MASTER_SHEET_PRESETS.map((p) => ({ value: p, label: p }))}
              />
            </Row>
          )}
        </Group>
      )}

      {/* NOTIFICATIONS — no toggleable substrate today; link to the one real
          control (daily reminder time) which lives in Profile. */}
      <Group title="Notifications">
        <Row
          title="Daily reminder time"
          desc="Set when we nudge you on days you haven't logged. Managed in your Profile."
        >
          <LinkButton onClick={onOpenProfile} label="Open Profile" />
        </Row>
      </Group>
    </div>
  );
}

// ── Account (shortcut into ProfileScreen) ─────────────────────────────────────
function AccountTab({ role, roleLabel, userProfile, onOpenProfile }) {
  const name = userProfile?.name || userProfile?.displayName || '—';
  const email = userProfile?.email || '—';
  const branch = userProfile?.branchName || userProfile?.unitName || null;

  const info = [
    ['Name', name],
    ['Role', roleLabel || role || '—'],
    ...(branch ? [['Branch', branch]] : []),
    ['Email', email],
  ];

  return (
    <Group
      title="Account"
      sub="Your profile and sign-in live in Profile — edit your photo, name, password, and sign out there."
    >
      {info.map(([label, value]) => (
        <div
          key={label}
          className="flex items-center justify-between gap-4 py-3 border-t border-border first:border-t-0"
        >
          <span className="text-sm text-ink-muted">{label}</span>
          <span className="text-sm font-medium text-ink truncate">{value}</span>
        </div>
      ))}
      <div className="pt-3 border-t border-border">
        <button
          type="button"
          onClick={onOpenProfile}
          data-testid="settings-open-profile"
          className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-primary text-white dark:bg-primary-dark text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <UserCog size={16} aria-hidden="true" />
          Open Profile
        </button>
      </div>
    </Group>
  );
}

// ── primitives (tokened) ──────────────────────────────────────────────────────
function Group({ title, sub, children }) {
  return (
    <section className="card flex flex-col">
      <div className="mb-1">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{title}</h2>
        {sub && <p className="text-xs text-ink-muted mt-1 leading-snug">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ title, desc, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-t border-border first:border-t-0 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink">{title}</div>
        {desc && <div className="text-xs text-ink-muted mt-0.5 leading-snug">{desc}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Segmented({ name, ariaLabel, options, value, onChange }) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-card-raised border border-border"
    >
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.Icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            data-testid={`${name}-${o.value}`}
            className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-md text-xs font-bold transition-colors ${
              on
                ? 'bg-primary text-white dark:bg-primary-dark shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {Icon && <Icon size={13} aria-hidden="true" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function LinkButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 min-h-[44px] px-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
    >
      {label}
      <ChevronRight size={15} aria-hidden="true" />
    </button>
  );
}
