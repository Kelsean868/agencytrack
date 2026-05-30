// AgencyTrack — Profile v2. The shared profile screen (every role reaches it).
// Faithful to ProfileScreen.jsx: avatar upload, editable identity fields,
// agent logging-mode panel, account info, sign out. Rendered inside the
// role shell (AppShell for agent, ManagerShell for managers). Reuses
// app-shell (AppShell, Eyebrow), manager-v2-shared (ManagerShell), app-tokens.

// Persona records for the two role contexts.
const PROFILE_PEOPLE = {
  agent:   { name: 'Marsha Singh',    initials: 'MS', role: 'Senior Associate', roleKey: 'agent', email: 'marsha.singh@tatillife.com', phone: '+1 868 555 0142', bio: 'L4 advisor · South Branch, Unit S·02. MDRT pace. Morning call-blocks, afternoon fact-finds.', since: '14 Mar 2024', unit: 'S·02', showLogging: true },
  manager: { name: 'Trevor Ramcharan', initials: 'TR', role: 'Branch Manager', roleKey: 'branch', email: 'trevor.ramcharan@tatillife.com', phone: '+1 868 555 0188', bio: 'Branch Manager · South Branch. 28 advisors across three units.', since: '02 Sep 2019', unit: 'South Branch', showLogging: false },
};

function ProfileField({ t, label, value, hint, mono }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: t.inkMute }}>{label}{hint && <span style={{ color: t.inkFaint, fontWeight: 400 }}> · {hint}</span>}</label>
      <div style={{ height: 44, padding: '0 13px', display: 'flex', alignItems: 'center', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 14, color: t.ink, fontFamily: mono ? APP_FONT_MONO : APP_FONT_SANS }}>{value}</div>
    </div>
  );
}

function ProfileBody({ t, who }) {
  const p = PROFILE_PEOPLE[who] || PROFILE_PEOPLE.agent;
  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingRight: 4 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Avatar header */}
        <div className="a-card a-rise" style={{ padding: '28px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ width: 92, height: 92, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 34, fontFamily: APP_FONT_DISPLAY, border: `2px solid ${t.rule}` }}>{p.initials}</div>
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: '50%', background: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', border: `2px solid ${t.surface}` }}>
              <IconPlus size={14} color="#fff" stroke={2.4} />
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.01em' }}>{p.name}</div>
            <span style={{ display: 'inline-block', marginTop: 6, padding: '3px 12px', borderRadius: 999, background: t.tealTint, color: t.teal, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>{p.role}</span>
          </div>
        </div>

        {/* Edit profile */}
        <div className="a-card a-rise" style={{ padding: '18px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Eyebrow t={t}>Edit Profile</Eyebrow>
          <ProfileField t={t} label="Display Name" value={p.name} />
          {who === 'manager' && <ProfileField t={t} label="Unit / Branch" value={p.unit} />}
          <ProfileField t={t} label="Phone" value={p.phone} mono />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: t.inkMute }}>Bio <span style={{ color: t.inkFaint }}>· {p.bio.length}/200</span></label>
            <div style={{ minHeight: 64, padding: '10px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 13.5, color: t.ink, lineHeight: 1.5 }}>{p.bio}</div>
          </div>
          <div style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 13, fontWeight: 700, boxShadow: `0 2px 8px ${t.teal}44`, cursor: 'pointer' }}>
            <IconCheck size={15} color="#fff" stroke={2.4} /> Save Changes
          </div>
        </div>

        {/* Logging mode (agents only) */}
        {p.showLogging && (
          <div className="a-card" style={{ padding: '18px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
              <IconClock size={15} color={t.teal} />
              <Eyebrow t={t}>Logging mode</Eyebrow>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[
                { v: 'weekly', title: 'Weekly', desc: 'Submit a single report each week.', on: false },
                { v: 'daily', title: 'Daily', desc: "Log activity each day; Sunday's aggregator rolls it into the weekly draft.", on: false },
                { v: 'hybrid', title: 'Hybrid', desc: 'Pick whichever fits the week — both stay available.', on: true },
              ].map((o) => (
                <div key={o.v} style={{ display: 'flex', gap: 11, padding: '12px 14px', background: o.on ? t.tealTint : t.surfaceSoft, border: `1px solid ${o.on ? t.teal + '55' : t.rule}`, borderRadius: 11 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${o.on ? t.teal : t.inkDim}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    {o.on && <div style={{ width: 9, height: 9, borderRadius: '50%', background: t.teal }}></div>}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{o.title}</div>
                    <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 2, lineHeight: 1.5 }}>{o.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 13, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: t.inkMute }}>Daily reminder time</label>
                <div style={{ height: 42, marginTop: 6, padding: '0 13px', display: 'flex', alignItems: 'center', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 14, color: t.ink, fontFamily: APP_FONT_MONO }}>5:00 PM</div>
              </div>
              <div style={{ height: 42, padding: '0 16px', display: 'flex', alignItems: 'center', border: `1px solid ${t.teal}`, color: t.teal, borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Save time</div>
            </div>
          </div>
        )}

        {/* Account info */}
        <div className="a-card" style={{ padding: '18px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Eyebrow t={t}>Account Info</Eyebrow>
          {[['Email', p.email], ['Role', p.role], ['Member Since', p.since]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: t.inkMute }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.ink }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Sign out */}
        <div className="a-card" style={{ padding: '18px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 8 }}>
          <Eyebrow t={t}>Account</Eyebrow>
          <div style={{ height: 44, border: `1px solid ${t.danger}55`, color: t.danger, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
            <IconArrowR size={16} color={t.danger} stroke={2.2} /> Sign Out
          </div>
        </div>
      </div>
    </div>
  );
}

// Mobile profile — same content reflowed in MFrame
function ProfileMobile({ t }) {
  const p = PROFILE_PEOPLE.agent;
  return (
    <MFrame t={t}>
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, padding: '8px 16px 12px', background: t.bg, zIndex: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY }}>Profile</div>
      </div>
      <div style={{ position: 'absolute', top: 92, left: 0, right: 0, bottom: 92, overflowY: 'auto', padding: '8px 16px 16px' }}>
        <ProfileBody t={t} who="agent" />
      </div>
      <MNav t={t} active="profile" />
    </MFrame>
  );
}

Object.assign(window, { PROFILE_PEOPLE, ProfileField, ProfileBody, ProfileMobile });
