// AgencyTrack — User Management v2. The manager "Team" tab + tenant-admin
// "All Users" surface (UserManagementPanel + EditUserDrawer). Roster table
// with role/branch/status filters, invite CTA, and a full edit drawer
// (identity, role, scope, tenure, commission, activity-standard override,
// logging mode, active/reset/deactivate). Wraps ManagerShell. Reuses
// app-tokens + manager-v2-shared (ManagerShell).

const UM_ROLES = {
  agent:          { label: 'Agent',          fg: 'teal' },
  unit_manager:   { label: 'Unit Manager',   fg: 'teal' },
  branch_manager: { label: 'Branch Manager', fg: 'gold' },
  sales_manager:  { label: 'Sales Manager',  fg: 'gold' },
  cro:            { label: 'CRO',            fg: 'teal' },
  tenant_admin:   { label: 'Tenant Admin',   fg: 'ink' },
};

const UM_USERS = [
  { name: 'Marsha Singh',     email: 'marsha.singh@tatillife.com',   role: 'agent',          branch: 'South', unit: 'S·02', status: 'active', last: '2h ago',  since: 'Mar 2024' },
  { name: 'Riaz Khan',        email: 'riaz.khan@tatillife.com',      role: 'unit_manager',   branch: 'South', unit: 'S·02', status: 'active', last: '1h ago',  since: 'Jan 2021' },
  { name: 'Anand Persad',     email: 'anand.persad@tatillife.com',   role: 'agent',          branch: 'South', unit: 'S·01', status: 'active', last: '4h ago',  since: 'Aug 2022' },
  { name: 'Camille Rampersad',email: 'camille.r@tatillife.com',      role: 'unit_manager',   branch: 'South', unit: 'S·01', status: 'active', last: 'Today',   since: 'Jun 2019' },
  { name: 'Selina Mohammed',  email: 'selina.m@tatillife.com',       role: 'agent',          branch: 'South', unit: 'S·03', status: 'active', last: '1d ago',  since: 'Nov 2023' },
  { name: 'Anessa Baptiste',  email: 'anessa.b@tatillife.com',       role: 'cro',            branch: 'South', unit: '—',    status: 'active', last: '20m ago', since: 'Feb 2020' },
  { name: 'Trevor Ramcharan', email: 'trevor.r@tatillife.com',       role: 'branch_manager', branch: 'South', unit: '—',    status: 'active', last: 'Today',   since: 'Sep 2019' },
  { name: 'Avinash Maharaj',  email: 'avinash.m@tatillife.com',      role: 'agent',          branch: 'South', unit: 'S·02', status: 'active', last: '6h ago',  since: 'May 2025' },
  { name: 'Priya Naidu',      email: 'priya.naidu@tatillife.com',    role: 'agent',          branch: 'South', unit: 'S·01', status: 'inactive', last: '3w ago', since: 'Oct 2024' },
  { name: 'Kamla Singh',      email: 'kamla.singh@tatillife.com',    role: 'agent',          branch: 'South', unit: 'S·01', status: 'active', last: '2d ago',  since: 'Feb 2023' },
  { name: 'Felix Mahadeo',    email: 'felix.mahadeo@tatillife.com',  role: 'sales_manager',  branch: 'All',   unit: '—',    status: 'active', last: 'Today',   since: 'Apr 2016' },
  { name: 'Jamal Khan',       email: 'jamal.khan@tatillife.com',     role: 'agent',          branch: 'South', unit: 'S·03', status: 'active', last: '5h ago',  since: 'Jul 2025' },
];

function umTone(t, key) { return key === 'gold' ? t.gold : key === 'ink' ? t.ink : t.teal; }
function umBg(t, key) { return key === 'gold' ? t.goldTint : key === 'ink' ? t.surfaceMute : t.tealTint; }

function RoleChip({ t, role }) {
  const m = UM_ROLES[role] || { label: role, fg: 'teal' };
  return <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: 999, background: umBg(t, m.fg), color: umTone(t, m.fg), fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap' }}>{m.label}</span>;
}

function UserAvatar({ t, name, status }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: APP_FONT_DISPLAY, opacity: status === 'inactive' ? 0.5 : 1 }}>{initials}</div>
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: status === 'active' ? t.success : t.inkFaint, border: `2px solid ${t.surface}` }}></div>
    </div>
  );
}

// ── Edit user drawer ──────────────────────────────────────────────────────
function EditUserDrawer({ t, name }) {
  const u = UM_USERS.find((x) => x.name === name) || UM_USERS[0];
  const Row = ({ label, value, mono, hint }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: t.inkMute }}>{label}{hint && <span style={{ color: t.inkFaint, fontWeight: 400 }}> · {hint}</span>}</label>
      <div style={{ height: 42, padding: '0 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 13.5, color: t.ink, fontFamily: mono ? APP_FONT_MONO : APP_FONT_SANS }}>
        <span>{value}</span>
      </div>
    </div>
  );
  const Select = ({ label, value }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: t.inkMute }}>{label}</label>
      <div style={{ height: 42, padding: '0 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 13.5, color: t.ink }}>
        <span>{value}</span><IconChevD size={14} color={t.inkMute} stroke={2.2} />
      </div>
    </div>
  );
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(2px)', animation: 'app-fade-in 280ms ease both', zIndex: 20 }}></div>
      <div className="a-card" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 460, background: t.surface, borderLeft: `1px solid ${t.rule}`, zIndex: 21, display: 'flex', flexDirection: 'column', animation: 'app-slide-in 320ms cubic-bezier(0.22,1,0.36,1) both', boxShadow: '-12px 0 40px rgba(0,0,0,0.16)' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${t.rule}` }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.inkMute, cursor: 'pointer' }}>✕ Close</span>
          <div style={{ flex: 1 }}></div>
          <RoleChip t={t} role={u.role} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <UserAvatar t={t} name={u.name} status={u.status} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.01em' }}>{u.name}</div>
              <div style={{ fontSize: 11.5, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{u.email}</div>
            </div>
          </div>

          <Eyebrow t={t}>Identity</Eyebrow>
          <Row label="Display name" value={u.name} />
          <Row label="Email" value={u.email} mono />

          <Eyebrow t={t}>Role &amp; scope</Eyebrow>
          <Select label="Role" value={(UM_ROLES[u.role] || {}).label || u.role} />
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}><Select label="Branch" value={u.branch} /></div>
            <div style={{ flex: 1 }}><Select label="Unit" value={u.unit} /></div>
          </div>

          <Eyebrow t={t}>Tenure &amp; comp</Eyebrow>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}><Row label="Contract start" value={u.since} hint="drives API floor" /></div>
            <div style={{ flex: 1 }}><Row label="Commission rate" value="38%" mono /></div>
          </div>

          {/* Activity standard override */}
          <div style={{ padding: '13px 15px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>Activity standard override</div>
                <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 2 }}>Uses company floor unless overridden</div>
              </div>
              <div style={{ width: 44, height: 26, borderRadius: 999, background: t.surfaceMute, position: 'relative', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, padding: '14px 20px', borderTop: `1px solid ${t.rule}`, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', gap: 9 }}>
            <div style={{ flex: 1, height: 44, background: t.teal, color: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: `0 2px 8px ${t.teal}44` }}><IconCheck size={15} color="#fff" stroke={2.4} /> Save changes</div>
            <div style={{ height: 44, padding: '0 16px', border: `1px solid ${t.rule}`, color: t.inkMute, borderRadius: 10, display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Reset password</div>
          </div>
          <div style={{ height: 40, border: `1px solid ${t.danger}44`, color: t.danger, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            {u.status === 'active' ? 'Deactivate user' : 'Reactivate user'}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────
function UserManagementScene({ t, scope = 'manager', drawer = null }) {
  const active = UM_USERS.filter((u) => u.status === 'active').length;
  const filters = ['All roles', 'Agents', 'Managers', 'CRO'];
  const title = scope === 'admin' ? 'All Users' : 'Team';
  const sub = scope === 'admin' ? 'Every user across the tenant' : 'Your branch — South';
  return (
    <ManagerShell t={t} active={scope === 'admin' ? 'users' : 'team'} title={title} subtitle={sub} teamView>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden', position: 'relative' }}>
        {/* Stat + actions strip */}
        <div className="a-card a-rise" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 24, padding: '15px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
          {[['USERS', UM_USERS.length, t.teal], ['ACTIVE', active, t.success], ['INACTIVE', UM_USERS.length - active, t.inkMute]].map(([k, v, c]) => (
            <div key={k}>
              <div style={{ fontSize: 24, fontWeight: 700, color: c, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, marginTop: 4 }}>{k}</div>
            </div>
          ))}
          <div style={{ flex: 1 }}></div>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 220, padding: '9px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
            <IconSearch size={14} color={t.inkMute} />
            <span style={{ fontSize: 12.5, color: t.inkFaint }}>Search users…</span>
          </div>
          <div className="a-card" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: t.teal, color: '#fff', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', boxShadow: `0 2px 8px ${t.teal}44` }}>
            <IconPlus size={15} color="#fff" stroke={2.4} /> Invite user
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ flexShrink: 0, display: 'flex', gap: 4, padding: 4, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10, alignSelf: 'flex-start' }}>
          {filters.map((f, i) => (
            <div key={f} style={{ padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: i === 0 ? t.surface : 'transparent', color: i === 0 ? t.ink : t.inkMute, border: i === 0 ? `1px solid ${t.rule}` : '1px solid transparent' }}>{f}</div>
          ))}
        </div>

        {/* Table */}
        <div style={{ flex: 1, minHeight: 0, border: `1px solid ${t.rule}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '9px 16px', background: t.surfaceSoft, borderBottom: `1px solid ${t.rule}` }}>
            <div style={{ flex: 1, fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>USER</div>
            <div style={{ width: 130, fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>ROLE</div>
            <div style={{ width: 120, fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>BRANCH · UNIT</div>
            <div style={{ width: 90, fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>STATUS</div>
            <div style={{ width: 80, fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, textAlign: 'right' }}>LAST</div>
            <div style={{ width: 18 }}></div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {UM_USERS.map((u, i) => (
              <div key={u.email} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: i < UM_USERS.length - 1 ? `1px solid ${t.rule}` : 'none', background: drawer === u.name ? t.tealTint : (i % 2 ? t.surfaceSoft : t.surface), cursor: 'pointer', opacity: u.status === 'inactive' ? 0.7 : 1 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  <UserAvatar t={t} name={u.name} status={u.status} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{u.name}</div>
                    <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                  </div>
                </div>
                <div style={{ width: 130 }}><RoleChip t={t} role={u.role} /></div>
                <div style={{ width: 120, fontSize: 12, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{u.branch}{u.unit !== '—' ? ` · ${u.unit}` : ''}</div>
                <div style={{ width: 90 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: u.status === 'active' ? t.success : t.inkFaint, fontFamily: APP_FONT_MONO }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: u.status === 'active' ? t.success : t.inkFaint }}></span>
                    {u.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ width: 80, textAlign: 'right', fontSize: 11, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{u.last}</div>
                <div style={{ width: 18, display: 'flex', justifyContent: 'flex-end' }}><IconChevR size={15} color={t.inkFaint} stroke={2.4} /></div>
              </div>
            ))}
          </div>
        </div>

        {drawer && <EditUserDrawer t={t} name={drawer} />}
      </div>
    </ManagerShell>
  );
}

Object.assign(window, { UM_ROLES, UM_USERS, RoleChip, UserAvatar, EditUserDrawer, UserManagementScene });
