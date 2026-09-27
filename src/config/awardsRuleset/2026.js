export const DEFAULT_RULESET_2026 = {
  // ── Agent: Advisor of the Month ──
  advisorMonth: {
    excludesBdoDso: true,
    persistGate: 90,
    api:  { threshold: 50000,  inContention: 25000, prize: 'Recognition + Gift' },
    apps: { threshold: 15,     inContention: 8,     prize: 'Recognition + Gift' },
  },

  // ── Agent: Quarterly Awards ──
  quarterlyAward: {
    persistGate: 90,
    api:  { threshold: 125000, inContention: 62500, prize: 'Quarterly Bonus' },
    apps: { threshold: 45,     inContention: 22,    prize: 'Quarterly Bonus' },
  },

  // ── Agent: Annual Persistency Awards ──
  persistencyAward: {
    silver: {
      apiThreshold: 250000,
      appsThreshold: 45,
      persistGate: 92,
      apiInContention: 125000,
      appsInContention: 22,
      prize: 'Silver Trophy + Bonus',
    },
    gold: {
      apiThreshold: 250000,
      appsThreshold: 45,
      persistGate: 95,
      apiInContention: 125000,
      persistInContention: 90,
      prize: 'Gold Trophy + Premium Bonus',
    },
  },

  // ── Agent: Rookie of the Year ──
  rookieAward: {
    maxMonthsInIndustry: 18,
    apiThreshold: 325000,
    appsThreshold: 52,
    persistGate: 95,
    apiInContention: 162500,
    appsInContention: 26,
    prize: 'Rookie Trophy + Premium Recognition',
  },

  // ── Agent: New Business Advisor Award ──
  newBsAward: {
    maxMonthsAtTatil: 18,
    apiThreshold: 250000,
    appsThreshold: 52,
    persistGate: 95,
    apiInContention: 125000,
    appsInContention: 26,
    prize: 'New Advisor Trophy + Bonus',
  },

  // ── Agent: Centurion Award ──
  centurionAward: {
    appsThreshold: 100,
    appsInContention: 50,
    persistGate: 90,
    pppCap: 20,
    prize: 'Centurion Trophy',
  },

  // ── Agent: Agent of the Year ──
  agentOfYearAward: {
    excludesBdoDso: true,
    apiThreshold: 1000000,
    appsThreshold: 50,
    persistGate: 90,
    apiInContention: 500000,
    appsInContention: 25,
    prize: 'Agent of the Year Trophy + Grand Prize',
  },

  // ── Agent: MDRT ──
  // apiThreshold/apiInContention below are IGNORED (PR #984, 2026-09-26) — the
  // MDRT award reads mdrtAwardThresholds() / MDRT_THRESHOLDS_2026 (688,800)
  // instead, since 500,000 here was actually the Tatil company minimum for
  // 5+ years of tenure, not MDRT. Kept only so a stored tenant ruleset that
  // still carries these keys doesn't need a migration; not read anywhere.
  mdrtAward: {
    apiThreshold: 500000,
    apiInContention: 250000,
    prize: 'MDRT Membership + Recognition',
  },

  // ── Agent: Club Tiers (Bronze L3→L1, Silver, Gold) ──
  clubAward: {
    appsMin: 50,
    appsInContention: 25,
    persistGate: 90,
    tiers: [
      { id: 'bronze_club_l3', name: 'Bronze Club — Level 3', apiMin: 250000, apiMax: 350000, apiInContention: 125000, prize: 'Bronze Club Membership'        },
      { id: 'bronze_club_l2', name: 'Bronze Club — Level 2', apiMin: 350000, apiMax: 450000, apiInContention: 175000, prize: 'Bronze Club Membership + Bonus' },
      { id: 'bronze_club_l1', name: 'Bronze Club — Level 1', apiMin: 450000, apiMax: 550000, apiInContention: 225000, prize: 'Bronze Club Level 1 + Trip'      },
      { id: 'silver_club',    name: 'Silver Club',           apiMin: 550000, apiMax: 650000, apiInContention: 275000, prize: 'Silver Club + Premium Trip'      },
      { id: 'gold_club',      name: 'Gold Club',             apiMin: 650000, apiMax: null,   apiInContention: 325000, prize: 'Gold Club + Luxury Trip'         },
    ],
  },

  // ── Manager: Agency Monthly Production Bonus ──
  managerMonthlyBonus: {
    tiers: [
      { minAvgApi: 30000, bonusPct: 1.5 },
      { minAvgApi: 20000, bonusPct: 1.0 },
      { minAvgApi: 15000, bonusPct: 0.75 },
    ],
  },

  // ── Manager: Recruiting Awards ──
  recruitingAwards: [
    { id: 'recruiting_bronze', name: 'Recruiting Award — Bronze', min: 3, max: 4,    prize: 'Bronze Recruiting Award' },
    { id: 'recruiting_silver', name: 'Recruiting Award — Silver', min: 5, max: 6,    prize: 'Silver Recruiting Award' },
    { id: 'recruiting_gold',   name: 'Recruiting Award — Gold',   min: 7, max: null, prize: 'Gold Recruiting Award'   },
  ],

  // ── Manager: Activity Awards ──
  activityAwards: [
    { id: 'activity_bronze',  name: 'Activity Award — Bronze',  target: 40, prize: 'Bronze Activity Award'   },
    { id: 'activity_silver',  name: 'Activity Award — Silver',  target: 50, prize: 'Silver Activity Award'   },
    { id: 'activity_gold',    name: 'Activity Award — Gold',    target: 60, prize: 'Gold Activity Award'     },
    { id: 'highest_activity', name: 'Highest Activity Award',   target: 61, prize: 'Highest Activity Trophy' },
  ],

  // ── Manager: Production Award ──
  managerProductionAward: {
    avgApiThreshold: 250000,
    avgApiInContention: 125000,
    persistGate: 90,
    prize: 'Production Award + Bonus',
  },

  // ── Manager: Persistency Awards ──
  managerPersistencyAward: {
    silver: {
      persistGate: 92,
      avgApiInContention: 125000,
      persistInContention: 85,
      prize: 'Persistency Silver Trophy',
    },
    gold: {
      persistGate: 95,
      avgApiInContention: 125000,
      persistInContention: 90,
      prize: 'Persistency Gold Trophy',
    },
  },

  // ── Manager: Unit of the Year ──
  unitOfYearAward: {
    totalApiThreshold: 2000000,
    avgApiThreshold: 250000,
    agentCountMin: 5,
    newAdvisorsMin: 2,
    persistGate: 90,
    totalApiInContention: 1000000,
    prize: 'Unit of the Year Trophy + Grand Prize',
  },

  // ── Manager: Agency of the Year ──
  agencyOfYearAward: {
    totalApiThreshold: 5000000,
    avgApiThreshold: 250000,
    agentCountMin: 15,
    newAdvisorsMin: 3,
    persistGate: 90,
    totalApiInContention: 2500000,
    prize: 'Agency of the Year Trophy + Grand Prize',
  },
};
