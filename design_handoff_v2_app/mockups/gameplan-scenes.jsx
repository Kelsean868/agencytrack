// Game Plan v2 — scenes. Desktop (AppShell) + mobile (MFrame) wrappers around
// the page bodies. `page` selects which step body to show; the hub shows its
// own rail, sub-pages get a compact rail above the body.

function GamePlanDesktopScene({ t, page = 'hub', managerView = false, fresh = false, profile }) {
  const data = PLAN_SAMPLE;
  const activeKey = page === 'money' ? 'money' : 'lookahead';

  const titles = {
    hub:     { title: 'Game Plan',   sub: `${data.agent} · ${data.today} · build your ${data.year}` },
    money:   { title: 'Money Needs', sub: `Step 1 · Game Plan · ${data.year} worksheet` },
    year:    { title: 'Year Plan',   sub: `Step 2 · Game Plan · split your commission target` },
    monthly: { title: 'Monthly Plan',sub: `Step 3 · Game Plan · target vs actual by month` },
  };
  const mgrTitle = { title: `${data.agent} · Game Plan`, sub: `Viewing as ${data.manager.name} · ${data.manager.role.toLowerCase()} · review her shared plan` };
  const head = managerView ? mgrTitle : titles[page];

  return (
    <AppShell t={t} active={activeKey} title={head.title} subtitle={head.sub}>
      <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {managerView && <PlanManagerBanner t={t} data={data} />}
        <PlanAnchorStrip t={t} data={data} managerView={managerView} />

        {managerView ? (
          <HubBody t={t} data={data} managerView />
        ) : page === 'hub' ? (
          <HubBody t={t} data={data} />
        ) : (
          <>
            <StepRail t={t} current={page} />
            {page === 'money'   && <MoneyNeedsPage  t={t} data={data} fresh={fresh} />}
            {page === 'year'    && <YearPlanPage    t={t} data={data} profile={profile} />}
            {page === 'monthly' && <MonthlyPlanPage t={t} data={data} />}
          </>
        )}
      </div>
    </AppShell>
  );
}

function GamePlanMobileScene({ t, page = 'hub' }) {
  const data = PLAN_SAMPLE;
  const subs = { hub: `${data.year} PLAN`, money: 'STEP 1 · MONEY NEEDS', year: 'STEP 2 · YEAR PLAN', monthly: 'STEP 3 · MONTHLY' };
  const titles = { hub: 'Game Plan', money: 'Money Needs', year: 'Year Plan', monthly: 'Monthly Plan' };
  return (
    <MFrame t={t}>
      <MHeader t={t} title={titles[page]} sub={subs[page]} />
      <MContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PlanAnchorStrip t={t} data={data} mobile />
          {page === 'hub'     && <HubBody         t={t} data={data} mobile />}
          {page === 'money'   && <MoneyNeedsPage  t={t} data={data} mobile />}
          {page === 'year'    && <YearPlanPage    t={t} data={data} mobile />}
          {page === 'monthly' && <MonthlyPlanPage t={t} data={data} mobile />}
        </div>
      </MContent>
      <MNav t={t} active="more" />
    </MFrame>
  );
}

Object.assign(window, { GamePlanDesktopScene, GamePlanMobileScene });
