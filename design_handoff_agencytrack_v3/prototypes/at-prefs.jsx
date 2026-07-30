// Preferences — the customise layer. Everything added on top of the planner and
// the dialer is opinionated, and an opinion an agent can't switch off becomes a
// complaint. So each addition is a preference with a stated default, persisted per
// device, and every row shows what it does rather than just naming it.
//
// Two rules the panel follows:
//   · Defaults are the recommendation, and "Reset to defaults" restores exactly
//     them — so experimenting is never a one-way door.
//   · A preference that changes what gets RECORDED (live notes, the follow-up
//     prompt) is separated from one that only changes what is SHOWN, because
//     turning off capture has consequences turning off chrome does not.
const { Icon: PIcon } = window.AgencyTrackDesignSystem_ad1cd7;

const PREF_DEFAULTS = {
  view: 'day',            // day | week — the scale
  smart: false,           // compression, applies to whichever scale is showing
  gapThreshold: 45,       // minutes of empty time Smart collapses
  // Managers do not HAVE a floor — unit development is not piecework. But an
  // unsuggested target is a target nobody sets, so the ladder ships with suggested
  // weekly numbers, clearly labelled as suggestions and editable to any value or off.
  mgrFloors: true,
  mgrJC: 3, mgrONE: 4, mgrRI: 2,
  navCollapsed: true,
  railOpen: true,
  showPlay: true,
  autoAdvance: false,
  nowLine: true,
  liveNotes: true,
  talkTrack: true,
  followUpPrompt: true,
  connectDefault: 'device',
  archivePrompt: true,
};

const PREF_GROUPS = [
  {
    g: 'THE PLANNER', rows: [
      { k: 'view', kind: 'choice', label: 'Default scale', help: 'Which scale the planner opens on.',
        options: [['day', 'Day'], ['week', 'Week']] },
      { k: 'smart', kind: 'bool', label: 'Open in Smart', help: 'Smart is a modifier, not a third view — it compresses whichever scale you are on. On Day it lists the working blocks; on Week it drops any hour band nobody has booked.' },
      { k: 'gapThreshold', kind: 'choice', label: 'Smart collapses gaps over', help: 'Shorter gaps stay drawn to scale — the turnaround between two appointments is worth seeing.',
        options: [[30, '30m'], [45, '45m'], [60, '1h'], [90, '1h 30m']], when: (p) => p.smart },
      { k: 'nowLine', kind: 'bool', label: 'Now line', help: 'The red marker at the current time.' },
      { k: 'showPlay', kind: 'bool', label: 'Play controls on blocks', help: 'Start and pause a block to time it against the plan.' },
      { k: 'autoAdvance', kind: 'bool', label: 'Advance the clock automatically', help: 'Demo aid — walks the now line forward so the day plays out.' },
      { k: 'railOpen', kind: 'bool', label: 'Open the action plan on arrival', help: 'Off gives the grid the full width; the rail is one click away either way.' },
    ],
  },
  {
    g: 'THE CALL', rows: [
      { k: 'connectDefault', kind: 'choice', label: 'Connect with', help: 'How the call is placed by default. Both hand off to this device — nothing is dialled by the app itself.',
        options: [['device', 'Phone'], ['whatsapp', 'WhatsApp']] },
      { k: 'liveNotes', kind: 'bool', label: 'Notes while the line is open', help: 'Captures more than a note written after hanging up. Off means notes are wrap-up only.', weight: true },
      { k: 'followUpPrompt', kind: 'bool', label: 'Ask for the next step on wrap-up', help: 'The follow-up is created as you hang up rather than deferred to a list. Off falls back to the disposition default.', weight: true },
      { k: 'talkTrack', kind: 'bool', label: 'Objection rail during the call', help: 'Three answers for the product in play, one tap each.' },
      { k: 'archivePrompt', kind: 'bool', label: 'Prompt on the third non-contact', help: 'The archive and dead-lead cycle still runs — this only controls the prompt.', weight: true },
    ],
  },
  {
    g: 'THE UNIT LADDER', rows: [
      { k: 'mgrFloors', kind: 'bool', label: 'Suggest weekly unit-development targets', help: 'Managers have no floor — these are suggestions, not standards, and nothing is reported against them. Off hides the targets and leaves the counts.' },
      { k: 'mgrONE', kind: 'choice', label: 'One-on-ones a week', help: 'The highest-leverage thing a manager does, and the first to vanish when the week fills.',
        options: [[2, '2'], [3, '3'], [4, '4'], [6, '6']], when: (p) => p.mgrFloors },
      { k: 'mgrJC', kind: 'choice', label: 'Joint calls a week', help: 'Includes the ones agents escalate to you.',
        options: [[2, '2'], [3, '3'], [4, '4'], [5, '5']], when: (p) => p.mgrFloors },
      { k: 'mgrRI', kind: 'choice', label: 'Recruiting interviews a week', help: 'Career interviews — booking one advances that candidate in the recruiting pipeline.',
        options: [[1, '1'], [2, '2'], [3, '3'], [4, '4']], when: (p) => p.mgrFloors },
    ],
  },
  {
    g: 'THE SHELL', rows: [
      { k: 'navCollapsed', kind: 'bool', label: 'Start with navigation collapsed', help: 'Icons only, labels on hover. More room for the work.' },
    ],
  },
];

function usePrefs() {
  const { useState, useCallback, useEffect } = React;
  const [prefs, setPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem('at-prefs');
      const saved = raw ? JSON.parse(raw) : {};
      // Migration: Smart used to be a third scale. A stored view of 'smart' becomes
      // Day + the Smart modifier, so an existing preference is honoured rather than
      // silently falling back to a default the user never chose.
      if (saved.view === 'smart') { saved.view = 'day'; saved.smart = true; }
      return { ...PREF_DEFAULTS, ...saved };
    } catch (e) { return { ...PREF_DEFAULTS }; }
  });
  useEffect(() => { try { localStorage.setItem('at-prefs', JSON.stringify(prefs)); } catch (e) {} }, [prefs]);
  const set = useCallback((k, v) => setPrefs(p => ({ ...p, [k]: v })), []);
  const reset = useCallback(() => setPrefs({ ...PREF_DEFAULTS }), []);
  const changed = Object.keys(PREF_DEFAULTS).filter(k => prefs[k] !== PREF_DEFAULTS[k]);
  return { prefs, set, reset, changed };
}

function PrefRow({ row, prefs, set }) {
  const v = prefs[row.k];
  const isDefault = v === PREF_DEFAULTS[row.k];
  return (
    <div className={'pr-row' + (row.weight ? ' is-weighty' : '')}>
      <span className="pr-t">
        <b>{row.label}{row.weight && <i className="pr-cap" title="Changes what gets recorded, not just what is shown">RECORDS</i>}</b>
        <span>{row.help}</span>
      </span>
      <span className="pr-ctl">
        {row.kind === 'bool' ? (
          <button className={'pr-tog' + (v ? ' is-on' : '')} role="switch" aria-checked={!!v} aria-label={row.label}
            onClick={() => set(row.k, !v)}><i></i><em>{v ? 'On' : 'Off'}</em></button>
        ) : (
          <span className="pr-seg">
            {row.options.map(([ov, ol]) => (
              <button key={String(ov)} className={v === ov ? 'is-on' : ''} onClick={() => set(row.k, ov)} aria-pressed={v === ov}>{ol}</button>
            ))}
          </span>
        )}
        <span className="pr-def">{isDefault ? 'default' : <button onClick={() => set(row.k, PREF_DEFAULTS[row.k])}>reset</button>}</span>
      </span>
    </div>
  );
}

function PrefsOverlay({ prefs, set, reset, changed, onClose }) {
  return (
    <div className="ov" role="dialog" aria-modal="true" aria-label="Customise" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ov-scrim"></div>
      <div className="ov-panel pr-panel">
        <div className="ov-head">
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="ov-title" style={{ display: 'block' }}>Customise</span>
            <span className="ov-sub" style={{ display: 'block' }}>
              {changed.length ? changed.length + ' setting' + (changed.length > 1 ? 's' : '') + ' away from default · saved on this device' : 'Everything at its default · saved on this device'}
            </span>
          </span>
          <button className="ov-x" onClick={onClose} aria-label="Close"><PIcon name="plus" size={16} style={{ transform: 'rotate(45deg)' }} /></button>
        </div>
        <div className="ov-body pr-body">
          {PREF_GROUPS.map(grp => (
            <section key={grp.g} className="pr-grp">
              <span className="pf-eb">{grp.g}</span>
              {grp.rows.filter(r => !r.when || r.when(prefs)).map(r => <PrefRow key={r.k} row={r} prefs={prefs} set={set} />)}
            </section>
          ))}
          <p className="rc-fine">Rows marked RECORDS change what the system captures, not just what it shows. Switching live notes or the wrap-up follow-up off will leave thinner call records — the archive cycle and the activity log keep running either way.</p>
        </div>
        <div className="ov-foot">
          <button className="pb pb-sec" onClick={reset} disabled={!changed.length}>Reset to defaults</button>
          <button className="pb pb-pri" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { usePrefs, PrefsOverlay, PREF_DEFAULTS, PREF_GROUPS });
