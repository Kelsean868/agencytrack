// Meeting Mode v2 — the phased, exception-first branch stand-up deck.
//
// Replaces the pre-redesign 3-slide slideshow with a guided run-of-show
// (opening → branch scorecard → units → activity/production master sheets →
// exceptions → per-agent drill → recognition → celebrations → campaign → close).
// Every scene is DATA-DRIVEN: a scene with no honest data source is dropped from
// the deck (see MeetingMode.helpers · deriveDeck).
//
// Design intent: docs/design-system/screens-v2/meeting-v2-{shared,scenes,tables}.jsx.
// The mockup's inline-styled `t` theme + fabricated RUN/MEETING_SHEET are
// looks-only; this build ports the LAYOUT onto the app's presentation tokens
// (fixed-dark projection surface) and derives all numbers from real data.
//
// Dialog contract (§4, preserved from item 0.2): role=dialog + aria-modal +
// aria-label + useFocusTrap (Escape/Tab-trap/focus-return). The ManagerDashboard
// re-focuses the Start-Meeting trigger on unmount — do not regress either.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw, Gift,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { formatDateLabel } from '../../utils/validators';
import { useAuth } from '../../context/AuthContext';
import useFocusTrap from '../../hooks/useFocusTrap';
import { useCountUp } from '../../hooks/useCountUp';
import PanelSkeleton from '../ui/PanelSkeleton';
import { getTenantUsers, getAllYTDSubmissions } from '../../services/managerService';
import { getPersistencyMapForYear } from '../../services/persistencyService';
import { getCampaigns } from '../../services/campaignService';
import { computeStandings, isTieredCampaign } from '../../utils/campaignEngine';
import { CampaignStandingsBlock } from '../campaigns/CampaignStandings';
import {
  deriveWeekPulse, deriveBranchWindows, deriveUnits, deriveAgentRuns,
  deriveExceptions, deriveRecognition, deriveAnniversaries, deriveActiveCampaigns,
  deriveDeck, latestPersistency,
} from './MeetingMode.helpers';

// ── Small formatters / primitives ──

function kk(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 100_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

function AgentAvatar({ photoURL, name, size = 40 }) {
  const initials = (name ?? 'A').split(' ').map((w) => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();
  const dim = { width: size, height: size };
  return photoURL ? (
    <img
      src={photoURL}
      alt={name}
      style={dim}
      className="rounded-full object-cover border-2 border-presentation-border shrink-0"
    />
  ) : (
    <div
      style={{ ...dim, fontSize: Math.round(size * 0.36) }}
      className="rounded-full shrink-0 flex items-center justify-center bg-presentation-accent/25 text-presentation-accent font-bold border-2 border-presentation-border"
    >
      {initials}
    </div>
  );
}

// Count-up numeral (reduced-motion-safe via useCountUp). `format` maps the live
// value → display string.
function CountUp({ value, format = (v) => `${v}`, className }) {
  const display = useCountUp(value || 0, { duration: 900 });
  return <span className={className}>{format(display)}</span>;
}

// 6-week API trajectory spark — theme-safe via currentColor.
function Sparkline({ values, width = 120, height = 40, className = 'text-presentation-accent' }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * (width - 6) + 3;
    const y = (height - 4) - ((v - min) / range) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Presentation-token map for the flag / status tones.
const TONE = {
  danger:  { text: 'text-presentation-hot',    dot: 'bg-presentation-hot',    tint: 'bg-presentation-hot/15' },
  warning: { text: 'text-warning',             dot: 'bg-warning',             tint: 'bg-warning/15' },
  success: { text: 'text-success',             dot: 'bg-success',             tint: 'bg-success/15' },
};
function statusTone(status) {
  return status === 'met' ? TONE.success : status === 'at' ? TONE.warning : TONE.danger;
}

function Eyebrow({ children, className = '' }) {
  return <p className={`text-[0.68rem] font-bold uppercase tracking-[0.16em] text-presentation-muted ${className}`}>{children}</p>;
}

function FloorTile({ tile }) {
  const tone = statusTone(tile.status);
  const pct = tile.floor > 0 ? Math.min(100, Math.round((tile.actual / tile.floor) * 100)) : 100;
  const glyph = tile.status === 'met' ? '✓' : tile.status === 'at' ? '~' : '▾';
  return (
    <div className="rounded-xl p-3 bg-presentation-text/5 border border-presentation-border flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-[0.6rem] font-bold uppercase tracking-wider text-presentation-muted">{tile.label}</p>
        <span className={`text-[0.6rem] font-bold px-1.5 rounded-full ${tone.tint} ${tone.text}`}>{glyph}</span>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-bold text-presentation-text leading-none tabular-nums">{tile.actual}</span>
        <span className="text-[0.7rem] text-presentation-muted tabular-nums pb-0.5">/ {tile.floor}</span>
      </div>
      <div className="h-1 rounded-full bg-presentation-text/10 overflow-hidden">
        <div className={`h-1 rounded-full ${tone.dot}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── SCENES ───────────────────────────────────────────────────────────────

function OpeningScene({ pulse, counts, runs, selectedWeek }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="stagger flex flex-col gap-8 px-10 py-8 max-w-5xl mx-auto w-full">
        <div>
          <Eyebrow className="text-presentation-accent">Branch stand-up · Week of {formatDateLabel(selectedWeek)}</Eyebrow>
          <h1 className="mt-3 text-5xl font-display font-bold text-presentation-text leading-none">Good morning, team.</h1>
          <p className="mt-3 text-lg text-presentation-muted">
            {runs.length} to review
            {counts.attention > 0 && <>, <span className="text-warning font-bold">{counts.attention} need{counts.attention === 1 ? 's' : ''} attention</span></>}
            . Let&apos;s start where the branch stands.
          </p>
        </div>

        <div className="flex flex-wrap gap-10">
          {[
            { k: 'WEEK API', v: <CountUp value={pulse.api} format={(x) => formatCurrency(x)} /> },
            { k: 'APPLICATIONS', v: <CountUp value={pulse.apps} format={(x) => `${Math.round(x)}`} /> },
            { k: 'FFIs', v: <CountUp value={pulse.ffi} format={(x) => `${Math.round(x)}`} /> },
          ].map((m) => (
            <div key={m.k}>
              <Eyebrow>{m.k}</Eyebrow>
              <p className="mt-1 text-4xl font-display font-bold text-presentation-text tabular-nums">{m.v}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div className="rounded-2xl p-4 bg-success/10 border border-success/30 flex items-center gap-3">
            <p className="text-3xl font-display font-bold text-success tabular-nums">{counts.onPace}</p>
            <p className="text-sm text-presentation-muted">of {runs.length} on pace</p>
          </div>
          <div className="rounded-2xl p-4 bg-warning/10 border border-warning/30 flex items-center gap-3">
            <p className="text-3xl font-display font-bold text-warning tabular-nums">{counts.attention}</p>
            <p className="text-sm text-presentation-muted">need attention</p>
          </div>
        </div>

        {runs.length > 0 && (
          <div>
            <Eyebrow>Who we&apos;ll cover · exception-first</Eyebrow>
            <div className="mt-3 flex flex-col gap-1.5">
              {runs.map((r) => {
                const tone = TONE[r.flag.tone];
                return (
                  <div key={r.id} className="flex items-center gap-3 py-1.5">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[0.6rem] font-bold ${tone.tint} ${tone.text}`}>{r.initials}</span>
                    <span className="flex-1 text-sm font-semibold text-presentation-text">{r.name}</span>
                    <span className={`text-[0.6rem] font-bold uppercase tracking-wider ${tone.text}`}>{r.flag.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BranchCell({ big, sub, hero, mutedSub }) {
  return (
    <div className="px-5 text-right">
      <div className={`font-display font-bold text-presentation-text tabular-nums ${hero ? 'text-2xl text-presentation-accent' : 'text-xl'}`}>{big}</div>
      {sub && <div className={`text-xs mt-0.5 ${mutedSub ? 'text-presentation-muted' : 'text-presentation-accent'}`}>{sub}</div>}
    </div>
  );
}

function BranchScene({ windows }) {
  const COLS = ['NEW API', 'APPLICATIONS', 'PERSISTENCY'];
  return (
    <div className="flex-1 flex flex-col px-10 py-8">
      <div>
        <Eyebrow className="text-presentation-accent">The whole picture</Eyebrow>
        <h2 className="mt-2 text-4xl font-display font-bold text-presentation-text">Where the branch stands</h2>
      </div>
      <div className="stagger mt-6 flex-1 min-h-0 rounded-2xl border border-presentation-border overflow-hidden flex flex-col">
        <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr] bg-presentation-text/5 border-b border-presentation-border">
          <div className="px-5 py-3"><Eyebrow>What we did</Eyebrow></div>
          {COLS.map((c) => <div key={c} className="px-5 py-3 text-right"><Eyebrow>{c}</Eyebrow></div>)}
        </div>
        {windows.map((w, i) => (
          <div key={w.k} className={`flex-1 grid grid-cols-[1.1fr_1fr_1fr_1fr] items-center ${i < windows.length - 1 ? 'border-b border-presentation-border' : ''} ${w.hero ? 'bg-presentation-accent/10' : ''}`}>
            <div className="px-5">
              <div className={`text-lg font-display font-bold ${w.hero ? 'text-presentation-accent' : 'text-presentation-text'}`}>{w.name}</div>
              <div className="text-xs text-presentation-muted">{w.label}</div>
            </div>
            <BranchCell big={`TTD ${kk(w.api)}`} hero={w.hero} />
            <BranchCell big={w.apps} hero={w.hero} />
            {w.pers == null
              ? <div className="px-5 text-right text-xs text-presentation-muted">n/a · monthly</div>
              : <BranchCell big={`${w.pers}%`} hero={w.hero} />}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs italic text-presentation-muted">Persistency is reported monthly — no weekly figure. API &amp; Apps are settled, not submitted.</p>
    </div>
  );
}

function UnitsScene({ units }) {
  return (
    <div className="flex-1 flex flex-col px-10 py-8">
      <div>
        <Eyebrow className="text-presentation-accent">Team by team</Eyebrow>
        <h2 className="mt-2 text-4xl font-display font-bold text-presentation-text">How the units are moving</h2>
      </div>
      <div className="stagger mt-6 flex-1 min-h-0 flex gap-4">
        {units.map((u) => {
          const lead = u.rank === 1;
          return (
            <div key={u.id} className={`flex-1 min-w-0 rounded-2xl p-5 border flex flex-col ${lead ? 'border-presentation-gold/50' : 'border-presentation-border'} bg-presentation-text/5`}>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-lg font-display font-bold text-presentation-text truncate">{u.label}</div>
                  <div className="text-xs text-presentation-muted">{u.agents} agent{u.agents === 1 ? '' : 's'}</div>
                </div>
                {lead && <span className="text-[0.6rem] font-bold uppercase tracking-wider text-presentation-gold px-2 py-1 rounded-full bg-presentation-gold/15">★ Lead</span>}
              </div>
              <div className="mt-5">
                <Eyebrow>Settled API · year so far</Eyebrow>
                <div className="mt-1 text-3xl font-display font-bold text-presentation-text tabular-nums">{formatCurrency(u.ytdApi)}</div>
              </div>
              <div className="mt-auto pt-4 flex gap-3">
                <div className="flex-1">
                  <Eyebrow>This week</Eyebrow>
                  <div className="mt-1 text-lg font-display font-bold text-presentation-text tabular-nums">TTD {kk(u.wtdApi)}</div>
                </div>
                <div className="flex-1">
                  <Eyebrow>YTD apps</Eyebrow>
                  <div className="mt-1 text-lg font-display font-bold text-presentation-text tabular-nums">{u.ytdApps}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Dense §5 master-sheet — activity vs floor + result, BRANCH TOTAL row.
function ActivityScene({ runs }) {
  const total = runs.reduce((s, r) => ({
    api: s.api + r.weekApi, apps: s.apps + r.apps,
  }), { api: 0, apps: 0 });
  return (
    <div className="flex-1 flex flex-col px-8 py-6 min-h-0">
      <div className="flex items-end justify-between">
        <div>
          <Eyebrow className="text-presentation-accent">Activity master sheet</Eyebrow>
          <h2 className="mt-1 text-3xl font-display font-bold text-presentation-text">Everyone&apos;s week — activity &amp; result</h2>
        </div>
        <div className="flex gap-4 text-xs font-mono">
          <span className="text-success">● meets floor</span>
          <span className="text-warning">● at</span>
          <span className="text-presentation-hot">● below</span>
        </div>
      </div>
      <div className="mt-4 flex-1 min-h-0 rounded-xl border border-presentation-border overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-presentation-text/10">
            <tr>
              <th className="text-left px-4 py-2 text-[0.6rem] font-bold uppercase tracking-wider text-presentation-muted">Agent</th>
              {['Calls', 'Cont', 'Appt', 'FF', 'CI', 'Ref', 'API', 'Apps'].map((c) => (
                <th key={c} className="text-right px-3 py-2 text-[0.6rem] font-bold uppercase tracking-wider text-presentation-muted">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => {
              const cell = (key) => {
                const t = r.tiles.find((x) => x.key === key);
                const tone = t ? statusTone(t.status) : TONE.success;
                return <td key={key} className={`text-right px-3 py-2 tabular-nums font-semibold ${t && t.status === 'below' ? tone.text : 'text-presentation-text'}`}>{r.actuals[key] ?? 0}</td>;
              };
              return (
                <tr key={r.id} className="border-t border-presentation-border">
                  <td className="px-4 py-2 text-presentation-text truncate max-w-[10rem]" title={r.name}>{r.name}</td>
                  {cell('callsMade')}{cell('telContacts')}{cell('appointmentsScheduled')}
                  {cell('factFindsCompleted')}{cell('closingInterviewsKept')}{cell('referralsNewLeads')}
                  <td className="text-right px-3 py-2 tabular-nums font-bold text-presentation-text">{kk(r.weekApi)}</td>
                  <td className="text-right px-3 py-2 tabular-nums font-bold text-presentation-text">{r.apps}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0">
            <tr className="border-t-2 border-presentation-accent bg-presentation-accent/10">
              <td className="px-4 py-2.5 text-[0.7rem] font-bold uppercase tracking-wider text-presentation-accent" colSpan={7}>Branch total · {runs.length} agents</td>
              <td className="text-right px-3 py-2.5 tabular-nums font-bold text-presentation-accent">{kk(total.api)}</td>
              <td className="text-right px-3 py-2.5 tabular-nums font-bold text-presentation-accent">{total.apps}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// Windowed production sheet (WTD/MTD/QTD/YTD Apps + API) with BRANCH TOTAL.
function ProductionScene({ rows }) {
  const total = rows.reduce((s, r) => ({
    wtdApi: s.wtdApi + r.wtdApi, mtdApi: s.mtdApi + r.mtdApi, qtdApi: s.qtdApi + r.qtdApi, ytdApi: s.ytdApi + r.ytdApi,
    ytdApps: s.ytdApps + r.ytdApps,
  }), { wtdApi: 0, mtdApi: 0, qtdApi: 0, ytdApi: 0, ytdApps: 0 });
  return (
    <div className="flex-1 flex flex-col px-8 py-6 min-h-0">
      <div>
        <Eyebrow className="text-presentation-accent">Production report · this week to this year</Eyebrow>
        <h2 className="mt-1 text-3xl font-display font-bold text-presentation-text">Everyone&apos;s numbers</h2>
      </div>
      <div className="mt-4 flex-1 min-h-0 rounded-xl border border-presentation-border overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-presentation-text/10">
            <tr>
              <th className="text-left px-4 py-2 text-[0.6rem] font-bold uppercase tracking-wider text-presentation-muted">Agent</th>
              {['WTD API', 'MTD API', 'QTD API', 'YTD API', 'YTD Apps'].map((c, i) => (
                <th key={c} className={`text-right px-3 py-2 text-[0.6rem] font-bold uppercase tracking-wider ${i === 3 ? 'text-presentation-accent' : 'text-presentation-muted'}`}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-presentation-border">
                <td className="px-4 py-2 text-presentation-text truncate max-w-[10rem]" title={r.name}>{r.name}</td>
                <td className="text-right px-3 py-2 tabular-nums text-presentation-muted">{kk(r.wtdApi)}</td>
                <td className="text-right px-3 py-2 tabular-nums text-presentation-muted">{kk(r.mtdApi)}</td>
                <td className="text-right px-3 py-2 tabular-nums text-presentation-muted">{kk(r.qtdApi)}</td>
                <td className="text-right px-3 py-2 tabular-nums font-bold text-presentation-text">{kk(r.ytdApi)}</td>
                <td className="text-right px-3 py-2 tabular-nums text-presentation-muted">{r.ytdApps}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0">
            <tr className="border-t-2 border-presentation-accent bg-presentation-accent/10">
              <td className="px-4 py-2.5 text-[0.7rem] font-bold uppercase tracking-wider text-presentation-accent">Branch total</td>
              <td className="text-right px-3 py-2.5 tabular-nums font-bold text-presentation-text">{kk(total.wtdApi)}</td>
              <td className="text-right px-3 py-2.5 tabular-nums font-bold text-presentation-text">{kk(total.mtdApi)}</td>
              <td className="text-right px-3 py-2.5 tabular-nums font-bold text-presentation-text">{kk(total.qtdApi)}</td>
              <td className="text-right px-3 py-2.5 tabular-nums font-bold text-presentation-accent">{kk(total.ytdApi)}</td>
              <td className="text-right px-3 py-2.5 tabular-nums font-bold text-presentation-accent">{total.ytdApps}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ExceptionsScene({ exceptions, selectedWeek }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="stagger flex flex-col gap-4 px-10 py-8 max-w-4xl mx-auto w-full">
        <div>
          <Eyebrow className="text-warning">Needs attention · {exceptions.length}</Eyebrow>
          <h2 className="mt-2 text-4xl font-display font-bold text-presentation-text">Who to stop on this week</h2>
          <p className="mt-2 text-sm text-presentation-muted">Week ending {formatDateLabel(selectedWeek)}</p>
        </div>
        <div className="flex flex-col gap-3">
          {exceptions.map((r) => {
            const tone = TONE[r.flag.tone];
            return (
              <div key={r.id} className={`flex items-center gap-4 rounded-2xl p-4 border border-presentation-border ${tone.tint}`}>
                <span className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold ${tone.tint} ${tone.text} shrink-0`}>{r.initials}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-lg font-display font-bold text-presentation-text">{r.name}</div>
                  <div className="text-sm text-presentation-muted">{r.flag.reason}</div>
                </div>
                <span className={`text-[0.65rem] font-bold uppercase tracking-wider ${tone.text} shrink-0`}>{r.flag.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AgentScene({ run, photoURL, selectedWeek }) {
  const tone = TONE[run.flag.tone];
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-5 px-10 py-6 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-4">
          <AgentAvatar photoURL={photoURL} name={run.name} size={56} />
          <div className="flex-1 min-w-0">
            <h2 className="text-4xl font-display font-bold text-presentation-text leading-none">{run.name}</h2>
            <p className="mt-1 text-sm text-presentation-muted">{run.unit ? `${run.unit} · ` : ''}Week ending {formatDateLabel(selectedWeek)}</p>
          </div>
          <span className={`text-[0.7rem] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${tone.tint} ${tone.text} shrink-0`}>{run.flag.label}</span>
        </div>

        {run.flag.reason && (
          <div className={`flex items-center gap-3 rounded-xl p-3.5 border border-presentation-border ${tone.tint}`}>
            <AlertTriangle size={18} className={`${tone.text} shrink-0`} />
            <p className="text-sm text-presentation-text">{run.flag.reason}</p>
          </div>
        )}

        <div className="flex items-center gap-6 rounded-2xl p-4 bg-presentation-text/5 border border-presentation-border">
          <div>
            <Eyebrow>New API · this week</Eyebrow>
            <p className="mt-1 text-3xl font-display font-bold text-presentation-text tabular-nums">{formatCurrency(run.weekApi)}</p>
          </div>
          <div className="w-px h-10 bg-presentation-border" />
          <div>
            <Eyebrow>Apps</Eyebrow>
            <p className="mt-1 text-3xl font-display font-bold text-presentation-text tabular-nums">{run.apps}</p>
          </div>
          <div className="flex-1" />
          <div className="text-right">
            <Eyebrow>6-week API trend</Eyebrow>
            <div className="mt-1 flex justify-end"><Sparkline values={run.spark} className={tone.text} /></div>
          </div>
        </div>

        <div>
          <Eyebrow>This week&apos;s activity · vs company floor</Eyebrow>
          <div className="mt-3 grid grid-cols-4 gap-3">
            {run.tiles.map((tile) => <FloorTile key={tile.key} tile={tile} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function RecognitionScene({ recognition }) {
  const order = [2, 1, 3];
  const heights = { 1: 'h-36', 2: 'h-28', 3: 'h-24' };
  const byRank = (rank) => recognition.producers.find((p) => p.rank === rank);
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="stagger flex flex-col items-center gap-6 px-10 py-8 w-full">
        <div className="text-center">
          <Eyebrow className="text-presentation-gold">★ This week&apos;s recognition</Eyebrow>
          <h2 className="mt-2 text-4xl font-display font-bold text-presentation-text">Recognize the room</h2>
        </div>
        <div className="flex items-end justify-center gap-6">
          {order.map((rank) => {
            const p = byRank(rank);
            if (!p) return null;
            const first = rank === 1;
            return (
              <div key={rank} className="flex flex-col items-center w-48">
                <div className={`rounded-full flex items-center justify-center font-display font-bold bg-presentation-gold/15 text-presentation-gold border-2 border-presentation-gold/40 mb-2 ${first ? 'w-16 h-16 text-2xl' : 'w-12 h-12 text-lg'}`}>{p.initials}</div>
                <div className={`font-display font-bold text-presentation-text ${first ? 'text-lg' : 'text-base'}`}>{p.name}</div>
                <div className={`w-full ${heights[rank]} mt-3 rounded-t-xl border border-b-0 ${first ? 'border-presentation-gold bg-presentation-gold/20' : 'border-presentation-border bg-presentation-text/5'} flex flex-col items-center pt-3`}>
                  <div className={`text-2xl font-display font-extrabold ${first ? 'text-presentation-gold' : 'text-presentation-text'}`}>{rank}</div>
                  <div className="mt-1 text-base font-display font-bold text-presentation-text tabular-nums">{formatCurrency(p.weekApi)}</div>
                  <div className="mt-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-presentation-muted">Week API</div>
                </div>
              </div>
            );
          })}
        </div>
        {recognition.active.length > 0 && (
          <div className="w-full max-w-2xl">
            <Eyebrow className="text-presentation-accent">▲ Most active · effort this week</Eyebrow>
            <div className="mt-3 rounded-2xl border border-presentation-border divide-y divide-presentation-border">
              {recognition.active.map((a, i) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`w-5 text-center font-display font-extrabold ${i === 0 ? 'text-presentation-accent' : 'text-presentation-muted'}`}>{i + 1}</span>
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-[0.6rem] font-bold bg-presentation-accent/15 text-presentation-accent shrink-0">{a.initials}</span>
                  <span className="flex-1 text-sm font-semibold text-presentation-text truncate">{a.name}</span>
                  <span className="text-lg font-display font-bold text-presentation-accent tabular-nums">{a.activityScore}</span>
                  <span className="text-[0.55rem] font-bold uppercase tracking-wider text-presentation-muted">touches</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CelebrationsScene({ anniversaries }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="stagger flex flex-col gap-6 px-10 py-8 w-full">
        <div className="text-center">
          <Eyebrow className="text-presentation-gold">★ Celebrating this week</Eyebrow>
          <h2 className="mt-2 text-4xl font-display font-bold text-presentation-text">Work anniversaries</h2>
        </div>
        <div className="flex flex-wrap justify-center gap-5">
          {anniversaries.map((c) => (
            <div key={c.id} className="w-56 rounded-3xl p-6 border border-presentation-gold/40 bg-presentation-text/5 flex flex-col items-center text-center">
              <span className="text-[0.55rem] font-bold uppercase tracking-[0.16em] text-presentation-gold px-2.5 py-1 rounded-full bg-presentation-gold/15">Work anniversary</span>
              <div className="mt-4 w-20 h-20 rounded-full flex items-center justify-center text-2xl font-display font-bold bg-presentation-gold/20 text-presentation-gold border-2 border-presentation-gold/50">{c.initials}</div>
              <div className="mt-4 text-lg font-display font-bold text-presentation-text">{c.name}</div>
              {c.unit && <div className="mt-0.5 text-xs text-presentation-muted">{c.unit}</div>}
              <div className="mt-4 w-full rounded-xl p-3 bg-presentation-gold/10 border border-presentation-gold/30">
                <div className="text-2xl font-display font-bold text-presentation-gold">{c.years} year{c.years === 1 ? '' : 's'}</div>
                <div className="mt-1 text-[0.6rem] font-mono uppercase tracking-wider text-presentation-muted">{c.dateLabel}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CampaignScene({ campaigns, ytdSubs, users, persMap }) {
  // Reuse item 2.9's standings display. Standings are derived read-light from the
  // already-loaded YTD submissions windowed to each campaign, with the users as
  // participants + the latest per-agent persistency as the gate input. The
  // reused block renders on an app `bg-card` surface (its intended token set),
  // hosted on the presentation stage.
  const persByAgent = useMemo(() => {
    const out = {};
    Object.keys(persMap || {}).forEach((id) => { out[id] = latestPersistency(persMap[id]); });
    return out;
  }, [persMap]);
  const participants = useMemo(
    () => (users || []).filter((u) => u.role === 'agent').map((u) => ({ id: u.id, name: u.name ?? u.displayName ?? 'Agent', unit: u.unitId ?? null })),
    [users]
  );
  const campaign = campaigns[0];
  const tiered = isTieredCampaign(campaign);
  const standings = useMemo(() => {
    if (!tiered) return [];
    const start = typeof campaign.startDate === 'string' ? campaign.startDate.slice(0, 10) : '';
    const end = typeof campaign.endDate === 'string' ? campaign.endDate.slice(0, 10) : '';
    const windowed = (ytdSubs || []).filter((s) => s.weekStarting >= start && s.weekStarting <= end);
    return computeStandings(campaign, windowed, participants, persByAgent);
  }, [campaign, tiered, ytdSubs, participants, persByAgent]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="stagger flex flex-col gap-4 px-10 py-8 max-w-4xl mx-auto w-full">
        <div>
          <Eyebrow className="text-presentation-gold">★ Live campaign{campaigns.length > 1 ? `s · ${campaigns.length} active` : ''}</Eyebrow>
          <h2 className="mt-2 text-4xl font-display font-bold text-presentation-text">{campaign.name ?? 'Active campaign'}</h2>
          {campaign.prize && <p className="mt-1 text-sm text-presentation-muted">Prize: {campaign.prize}</p>}
        </div>
        {tiered ? (
          <div className="rounded-2xl bg-card p-5">
            <CampaignStandingsBlock campaign={campaign} standings={standings} hasPersistency={Object.keys(persByAgent).length > 0} />
          </div>
        ) : (
          <div className="rounded-2xl p-5 bg-presentation-text/5 border border-presentation-border flex items-center gap-3">
            <Gift size={20} className="text-presentation-gold shrink-0" />
            <p className="text-sm text-presentation-muted">Simple campaign — full ranked standings project only for tiered (qualify/placement) campaigns.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CloseScene({ runs, exceptions, recognition, selectedWeek }) {
  const stats = [
    { k: 'Reviewed', v: runs.length },
    { k: 'Flagged', v: exceptions.length },
    { k: 'Recognized', v: recognition.producers.length, gold: true },
  ];
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-10 text-center">
      <Eyebrow className="text-presentation-accent">Stand-up complete</Eyebrow>
      <h2 className="text-5xl font-display font-bold text-presentation-text">That&apos;s the room.</h2>
      <p className="text-presentation-muted">Week of {formatDateLabel(selectedWeek)}</p>
      <div className="flex gap-10 mt-2">
        {stats.map((s) => (
          <div key={s.k}>
            <Eyebrow>{s.k}</Eyebrow>
            <p className={`mt-1 text-4xl font-display font-bold tabular-nums ${s.gold ? 'text-presentation-gold' : 'text-presentation-text'}`}>{s.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Presenter notes (derived copy; the room never sees them) ──
function presenterNote(sceneId, model) {
  if (sceneId === 'opening') return 'Open on the branch reality. Name who needs attention before diving in.';
  if (sceneId === 'branch') return 'Lead with the year so far; let the room feel where the branch stands.';
  if (sceneId === 'units') return 'Call the leading unit, then the one that needs to move.';
  if (sceneId === 'activity') return 'Scan the floor breaches — they are who we stop on next.';
  if (sceneId === 'production') return 'Point out the year total and the top producers.';
  if (sceneId === 'exceptions') {
    const names = model.exceptions.map((r) => r.name).join(', ');
    return names ? `Call out: ${names}.` : 'Review who needs attention.';
  }
  if (sceneId === 'recognition') return 'Let them clap. Ask the top producer to share one thing that worked.';
  if (sceneId === 'celebrations') return 'Read the names out — a round of applause for the anniversaries.';
  if (sceneId === 'campaign') return 'Name who is close to qualifying and what closes the gap.';
  if (sceneId === 'close') return '';
  if (sceneId.startsWith('agent:')) {
    const r = model.runs.find((x) => `agent:${x.id}` === sceneId);
    if (!r) return '';
    return r.flag.reason || `${r.name} is on pace — recognize the week.`;
  }
  return '';
}

// Human label for a scene in the agenda rail / progress.
function sceneLabel(sceneId, model) {
  const base = {
    opening: 'Opening', branch: 'Branch scorecard', units: 'Units', activity: 'Activity sheet',
    production: 'Production sheet', exceptions: 'Needs attention', recognition: 'Recognition',
    celebrations: 'Celebrations', campaign: 'Campaign', close: 'Wrap-up',
  };
  if (base[sceneId]) return base[sceneId];
  if (sceneId.startsWith('agent:')) {
    const r = model.runs.find((x) => `agent:${x.id}` === sceneId);
    return r ? r.name : 'Agent';
  }
  return sceneId;
}

// ── AGENDA RAIL — scene list + position, click-to-jump ──
function AgendaRail({ scenes, model, index, onJump }) {
  return (
    <nav aria-label="Run of show" className="w-56 shrink-0 border-r border-presentation-border bg-presentation-text/5 overflow-y-auto py-4 px-2">
      <p className="px-3 pb-2 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-presentation-muted">Run of show</p>
      <ul className="flex flex-col gap-0.5">
        {scenes.map((sid, i) => {
          const active = i === index;
          const done = i < index;
          const isAgent = sid.startsWith('agent:');
          const run = isAgent ? model.runs.find((x) => `agent:${x.id}` === sid) : null;
          const tone = run ? TONE[run.flag.tone] : null;
          return (
            <li key={sid}>
              <button
                type="button"
                onClick={() => onJump(i)}
                aria-current={active ? 'true' : undefined}
                className={`w-full min-h-[36px] flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left transition-colors ${active ? 'bg-presentation-text/10' : 'hover:bg-presentation-text/5'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-presentation-accent' : done ? 'bg-presentation-muted' : tone ? tone.dot : 'bg-presentation-border'}`} />
                <span className={`flex-1 text-xs truncate ${active ? 'font-bold text-presentation-text' : done ? 'text-presentation-muted' : 'text-presentation-text'}`}>{sceneLabel(sid, model)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ── MAIN ───────────────────────────────────────────────────────────────

export default function MeetingMode({ submissions, selectedWeek, onClose }) {
  const { tenantId, role, branchId, userProfile } = useAuth();
  const modalRef = useFocusTrap({ onEscape: onClose });

  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState(null); // { users, ytdSubs, persMap, campaigns }
  const [reloadToken, setReloadToken] = useState(0);

  // ── One load gate on open — reuse the dashboard's own service calls ──
  useEffect(() => {
    if (!tenantId) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    setError(false);
    const year = new Date().getFullYear();
    Promise.all([
      getTenantUsers(tenantId).catch(() => { throw new Error('users'); }),
      getAllYTDSubmissions(tenantId).catch(() => []),
      getPersistencyMapForYear(tenantId, year, {
        branchId: role === 'branch_manager' ? userProfile?.branchId ?? branchId : undefined,
        unitId: role === 'unit_manager' ? userProfile?.unitId : undefined,
      }).catch(() => ({})),
      getCampaigns(tenantId).catch(() => []),
    ])
      .then(([users, ytdSubs, persMap, campaigns]) => {
        if (!alive) return;
        setData({ users, ytdSubs, persMap, campaigns });
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError(true);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [tenantId, role, branchId, userProfile, reloadToken]);

  // ── Derive the whole model + deck once data lands ──
  const model = useMemo(() => {
    if (!data) return null;
    const { users, ytdSubs, persMap, campaigns } = data;
    const agentIds = (users || []).filter((u) => u.role === 'agent').map((u) => u.id);
    const pulse = deriveWeekPulse(submissions);
    const windows = deriveBranchWindows(submissions, ytdSubs, persMap, selectedWeek, agentIds);
    const units = deriveUnits(users, ytdSubs, submissions);
    const runs = deriveAgentRuns(submissions, ytdSubs, users, persMap, selectedWeek);
    const exceptions = deriveExceptions(runs);
    const recognition = deriveRecognition(runs);
    const anniversaries = deriveAnniversaries(users, selectedWeek);
    const activeCampaigns = deriveActiveCampaigns(campaigns, undefined);
    const { scenes, skipped } = deriveDeck({ runs, units, exceptions, recognition, anniversaries, activeCampaigns, submissions });

    // Windowed production rows (per agent) from YTD subs — WTD from this week's
    // run, MTD/QTD/YTD windowed by the month/quarter/year of `selectedWeek`.
    const monthN = Number(selectedWeek.slice(5, 7));
    const qN = Math.floor((monthN - 1) / 3) + 1;
    const prodRows = runs.map((r) => {
      const agentSubs = (ytdSubs || []).filter((s) => (s.agentId ?? s.userId) === r.id);
      let mtdApi = 0, qtdApi = 0, ytdApi = 0, ytdApps = 0;
      agentSubs.forEach((s) => {
        const api = Number(s.apiSold ?? s.newBusiness?.api ?? s.api ?? 0) || 0;
        const apps = Number(s.applicationsSold ?? s.newBusiness?.apps ?? 0) || 0;
        const mm = Number((s.weekStarting || '').slice(5, 7));
        ytdApi += api; ytdApps += apps;
        if (mm === monthN) mtdApi += api;
        if (Math.floor((mm - 1) / 3) + 1 === qN) qtdApi += api;
      });
      return { id: r.id, name: r.name, wtdApi: r.weekApi, mtdApi, qtdApi, ytdApi, ytdApps };
    }).sort((a, b) => b.ytdApi - a.ytdApi);

    const counts = {
      onPace: runs.filter((r) => r.flag.key === null).length,
      attention: exceptions.length,
    };
    return { pulse, windows, units, runs, exceptions, recognition, anniversaries, activeCampaigns, scenes, skipped, prodRows, counts, users, ytdSubs, persMap };
  }, [data, submissions, selectedWeek]);

  const scenes = model?.scenes ?? [];
  const total = scenes.length;
  const clampedIndex = Math.min(index, Math.max(total - 1, 0));
  const currentScene = scenes[clampedIndex];

  const go = useCallback((dir) => {
    setIndex((i) => Math.min(Math.max(i + dir, 0), Math.max(total - 1, 0)));
  }, [total]);

  const jump = useCallback((i) => setIndex(Math.min(Math.max(i, 0), Math.max(total - 1, 0))), [total]);

  // Keyboard transport (Escape/Tab-trap/return owned by useFocusTrap).
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Home') setIndex(0);
      else if (e.key === 'End') setIndex(Math.max(total - 1, 0));
      else if (/^[1-9]$/.test(e.key)) {
        const n = parseInt(e.key, 10) - 1;
        if (n < total) setIndex(n);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [go, total]);

  const photoMap = useMemo(() => {
    const map = {};
    (model?.users || []).forEach((u) => { if (u.photoURL) map[u.id] = u.photoURL; });
    return map;
  }, [model]);

  const renderScene = () => {
    if (!model) return null;
    const sid = currentScene;
    if (sid === 'opening') return <OpeningScene pulse={model.pulse} counts={model.counts} runs={model.runs} selectedWeek={selectedWeek} />;
    if (sid === 'branch') return <BranchScene windows={model.windows} />;
    if (sid === 'units') return <UnitsScene units={model.units} />;
    if (sid === 'activity') return <ActivityScene runs={model.runs} />;
    if (sid === 'production') return <ProductionScene rows={model.prodRows} />;
    if (sid === 'exceptions') return <ExceptionsScene exceptions={model.exceptions} selectedWeek={selectedWeek} />;
    if (sid === 'recognition') return <RecognitionScene recognition={model.recognition} />;
    if (sid === 'celebrations') return <CelebrationsScene anniversaries={model.anniversaries} />;
    if (sid === 'campaign') return <CampaignScene campaigns={model.activeCampaigns} ytdSubs={model.ytdSubs} users={model.users} persMap={model.persMap} />;
    if (sid === 'close') return <CloseScene runs={model.runs} exceptions={model.exceptions} recognition={model.recognition} selectedWeek={selectedWeek} />;
    if (sid && sid.startsWith('agent:')) {
      const run = model.runs.find((x) => `agent:${x.id}` === sid);
      return run ? <AgentScene run={run} photoURL={photoMap[run.id]} selectedWeek={selectedWeek} /> : null;
    }
    return null;
  };

  const note = model && currentScene ? presenterNote(currentScene, model) : '';
  const showRail = !!model && (currentScene?.startsWith('agent:') || currentScene === 'exceptions');

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label="Meeting mode presentation"
      className="fixed inset-0 z-50 flex flex-col bg-presentation"
      data-meeting-mode="true"
    >
      {/* Progress bar */}
      <div className="h-1 bg-presentation-text/10 shrink-0" aria-hidden="true">
        <div className="h-1 bg-presentation-accent transition-all" style={{ width: total > 1 ? `${(clampedIndex / (total - 1)) * 100}%` : '0%' }} />
      </div>

      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-bold text-presentation-text">Branch Stand-up</p>
          <p className="text-[0.65rem] font-mono uppercase tracking-wider text-presentation-muted">Week of {formatDateLabel(selectedWeek)}</p>
        </div>
        <div className="flex-1" />
        {model && currentScene && (
          <p className="text-xs font-mono font-bold uppercase tracking-[0.16em] text-presentation-muted hidden sm:block">{sceneLabel(currentScene, model)}</p>
        )}
        <p className="text-sm font-mono font-bold text-presentation-muted tabular-nums">
          {total ? String(clampedIndex + 1).padStart(2, '0') : '00'} <span className="text-presentation-muted/60">/ {String(total).padStart(2, '0')}</span>
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center rounded-full text-presentation-muted hover:text-presentation-text hover:bg-presentation-text/10 transition-colors"
          aria-label="Exit meeting mode"
        >
          <X size={22} />
        </button>
      </header>

      {/* Body */}
      <main className="flex flex-1 min-h-0 overflow-hidden">
        {loading && (
          <div className="flex-1 p-10">
            <PanelSkeleton variant="metric-row" label="Loading meeting data" />
            <div className="mt-6"><PanelSkeleton variant="table" count={6} columns={5} /></div>
          </div>
        )}

        {!loading && error && (
          <div className="flex-1 flex items-center justify-center p-10">
            <div role="alert" className="max-w-md w-full rounded-2xl border border-presentation-hot/40 bg-presentation-hot/10 p-6 text-center">
              <AlertTriangle size={28} className="text-presentation-hot mx-auto" />
              <p className="mt-3 text-lg font-display font-bold text-presentation-text">Couldn&apos;t load the meeting data</p>
              <p className="mt-1 text-sm text-presentation-muted">The branch numbers didn&apos;t load. Check your connection and try again.</p>
              <button
                type="button"
                onClick={() => setReloadToken((t) => t + 1)}
                className="mt-4 inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-presentation-accent text-presentation font-semibold"
              >
                <RefreshCw size={16} /> Retry
              </button>
            </div>
          </div>
        )}

        {!loading && !error && model && (
          <>
            {showRail && <AgendaRail scenes={scenes} model={model} index={clampedIndex} onJump={jump} />}
            {renderScene()}
          </>
        )}
      </main>

      {/* Footer — transport + segments + presenter note */}
      {!loading && !error && model && (
        <footer className="flex items-center gap-4 px-6 py-3.5 border-t border-presentation-border bg-presentation-text/5 shrink-0">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={clampedIndex === 0}
            className="w-12 h-12 flex items-center justify-center rounded-full border border-presentation-border text-presentation-text hover:bg-presentation-text/10 transition-colors disabled:opacity-20"
            aria-label="Previous scene"
          >
            <ChevronLeft size={26} />
          </button>

          <div className="flex gap-1.5 items-center" aria-hidden="true">
            {scenes.map((sid, i) => (
              <span key={sid} className={`rounded-full transition-all ${i === clampedIndex ? 'w-5 h-1.5 bg-presentation-accent' : i < clampedIndex ? 'w-1.5 h-1.5 bg-presentation-accent/50' : 'w-1.5 h-1.5 bg-presentation-border'}`} />
            ))}
          </div>

          {note && (
            <div className="hidden md:flex items-center gap-2.5 ml-2 px-3 py-2 rounded-lg border border-dashed border-presentation-border max-w-md">
              <span className="text-[0.55rem] font-bold uppercase tracking-wider text-presentation-gold shrink-0">Presenter</span>
              <span className="text-xs text-presentation-muted truncate">{note}</span>
            </div>
          )}

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => go(1)}
            disabled={clampedIndex >= total - 1}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-presentation-accent text-presentation hover:opacity-90 transition-opacity disabled:opacity-20"
            aria-label="Next scene"
          >
            <ChevronRight size={26} />
          </button>
        </footer>
      )}
    </div>
  );
}
