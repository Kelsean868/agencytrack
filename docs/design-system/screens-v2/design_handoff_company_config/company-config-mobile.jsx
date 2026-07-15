// Company Config — mobile: grouped section list → drill-in.
// Uses MFrame/MContent from app-mobile.jsx; admin-specific header + nav here.

function AdminMHeader({ t, title, sub, back }) {
  return (
    <div style={{ position: 'absolute', top: 44, left: 0, right: 0, padding: '14px 20px 12px', background: t.bg, zIndex: 5 }}>
      {back && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 700, color: t.teal, marginBottom: 6, minHeight: 20 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.teal} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 6 9 12 15 18" /></svg>
          {back}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          {sub && <div style={{ fontSize: 10.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>{sub}</div>}
          <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.018em', fontFamily: APP_FONT_DISPLAY, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        </div>
        {!back && (
          <div style={{ width: 36, height: 36, borderRadius: 10, background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{ADMIN.initials}</div>
        )}
      </div>
    </div>
  );
}

function AdminMNav({ t, active = 'config' }) {
  const tabs = [
    { key: 'home',   label: 'Overview', Icon: IconHome },
    { key: 'config', label: 'Config',   Icon: IconSettings },
    { key: 'users',  label: 'Users',    Icon: IconUsers },
    { key: 'audit',  label: 'Audit',    Icon: IconHistory },
  ];
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 28, background: t.surface, borderTop: `1px solid ${t.rule}`, boxShadow: t.mode === 'light' ? '0 -2px 16px rgba(40,37,29,0.06)' : '0 -2px 16px rgba(0,0,0,0.4)', zIndex: 15 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', padding: '10px 8px 8px' }}>
        {tabs.map((tab) => {
          const on = active === tab.key;
          return (
            <div key={tab.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 44, justifyContent: 'flex-end' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <tab.Icon size={22} color={on ? t.teal : t.inkFaint} stroke={2} />
                {on && <div style={{ position: 'absolute', width: 36, height: 36, top: -7, left: '50%', transform: 'translateX(-50%)', background: t.tealTint, borderRadius: 999, zIndex: -1 }}></div>}
              </div>
              <div style={{ fontSize: 10.5, fontWeight: on ? 700 : 600, color: on ? t.teal : t.inkMute }}>{tab.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SECTION LIST — grouped, teal dot = customized, chevron drills in ──────
function CfgMobileList({ t }) {
  return (
    <MFrame t={t}>
      <AdminMHeader t={t} title="Company Config" sub={`${ADMIN.company} · Tenant admin`} />
      <MContent headerHeight={122}>
        <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', background: t.surface, borderRadius: 11, border: `1.5px solid ${t.ruleStrong}`, flexShrink: 0 }}>
            <IconSearch size={15} color={t.inkMute} />
            <div style={{ flex: 1, fontSize: 13, color: t.inkFaint }}>Find a setting…</div>
          </div>
          {CFG_NAV.map((g) => (
            <div key={g.title} style={{ flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, padding: '4px 4px 7px' }}>{g.title}</div>
              <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13, overflow: 'hidden' }}>
                {g.items.map((it, i) => (
                  <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', borderTop: i === 0 ? 'none' : `1px solid ${t.rule}`, minHeight: 22 }}>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: t.ink }}>{it.label}</div>
                    {it.dot && <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.teal }}></div>}
                    <IconChevR size={15} color={t.inkDim} stroke={2.2} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px', flexShrink: 0 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.teal }}></div>
            <div style={{ fontSize: 10.5, color: t.inkFaint }}>customized for {ADMIN.company}</div>
          </div>
        </div>
      </MContent>
      <AdminMNav t={t} active="config" />
    </MFrame>
  );
}

// ── DRILL-IN — Targets & Minimums on a phone ──────────────────────────────
function MBandCard({ t, b, last }) {
  return (
    <div style={{ padding: '11px 14px', borderTop: `1px solid ${t.rule}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <IconDrag t={t} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{b.band}</span>
        <span style={{ fontSize: 11, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{b.range[0]}–{b.range[1]} MO</span>
        <div style={{ flex: 1 }}></div>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: t.teal }}>Edit</span>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 7, paddingLeft: 21 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>ANNUAL FLOOR</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO, marginTop: 2 }}>{b.floor}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>WEEKLY · ÷48</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.inkMute, fontFamily: APP_FONT_MONO, marginTop: 2 }}>{b.weekly}</div>
        </div>
      </div>
    </div>
  );
}

function CfgMobileSection({ t }) {
  return (
    <MFrame t={t}>
      <AdminMHeader t={t} title="Targets & Minimums" back="Company Config" />
      <MContent headerHeight={128}>
        <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 130 }}>
          {/* tenure bands */}
          <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ padding: '12px 15px 8px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>TENURE-BAND MINIMUMS</div>
            </div>
            {TENURE_BANDS.map((b, i) => <MBandCard key={b.band} t={t} b={b} />)}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '12px 15px', borderTop: `1px solid ${t.rule}`, color: t.inkMute, fontSize: 12.5, fontWeight: 700, minHeight: 20 }}>
              <IconPlus size={13} color={t.inkMute} /> Add band
            </div>
          </div>
          {/* pace — the overridden field, with provenance + reset */}
          <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13, padding: '12px 15px', flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, marginBottom: 8 }}>PACE & WARNINGS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.teal }}></div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: t.ink }}>Pace-warning threshold</div>
                </div>
                <div style={{ fontSize: 11, color: t.inkFaint, marginTop: 3, lineHeight: 1.4 }}>AT FLOOR below this share of band minimum.</div>
              </div>
              <CcField t={t} value="85" suffix="%" changed width={72} />
            </div>
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.rule}` }}>
              <div style={{ fontSize: 11, color: t.inkMute }}>Changed by <b style={{ color: t.ink, fontWeight: 600 }}>Alicia Gopaul</b> · 12 Jun 2026</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: t.teal, marginTop: 4, minHeight: 18 }}>
                <IconReset color={t.teal} /> Reset to default (80%)
              </div>
            </div>
          </div>
          {/* clubs — coming soon */}
          <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13, padding: '12px 15px', flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, marginBottom: 8 }}>CLUB & COMPANY THRESHOLDS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: t.inkMute }}>MDRT threshold</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO, marginTop: 3 }}>TTD 1.02M</div>
              </div>
              <SoonChip t={t} />
            </div>
          </div>
        </div>
      </MContent>
      {/* sticky save above the nav */}
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 104, zIndex: 14 }}>
        <div style={{ padding: '13px 0', background: t.teal, color: '#fff', borderRadius: 12, fontSize: 14, fontWeight: 700, textAlign: 'center', boxShadow: `0 6px 18px ${t.teal}55`, minHeight: 18 }}>Save changes</div>
      </div>
      <AdminMNav t={t} active="config" />
    </MFrame>
  );
}

Object.assign(window, { AdminMHeader, AdminMNav, CfgMobileList, CfgMobileSection, MBandCard });
