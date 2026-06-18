// Mock fixture for TeamPerfRoster preview and tests.
// Edge cases per brief:
//   pn — pctOfAnnualGoal: null (no committed target → "—")
//   tg — persistency: null, all production null (no settled book + no activity → all "—")
export const MOCK_ROWS = [
  { id:'sm', name:'Selina Mohammed',  role:null, unit:'S·01', contractDate:new Date(2019,10, 4).getTime(), submittedAPI:412000, submittedApps:128, issuedAPI:371000, issuedApps:112, persistency: 94, pctOfAnnualGoal:103 },
  { id:'ap', name:'Anand Persad',     role:'UM', unit:'S·02', contractDate:new Date(2017, 3,18).getTime(), submittedAPI:288000, submittedApps: 94, issuedAPI:246000, issuedApps: 79, persistency: 86, pctOfAnnualGoal: 78 },
  { id:'ms', name:'Marsha Singh',     role:null, unit:'S·02', contractDate:new Date(2021, 1, 9).getTime(), submittedAPI:264000, submittedApps: 84, issuedAPI:224400, issuedApps: 71, persistency: 91, pctOfAnnualGoal:106 },
  { id:'dl', name:'Devin Lewis',      role:null, unit:'S·03', contractDate:new Date(2023, 2,27).getTime(), submittedAPI:118000, submittedApps: 37, issuedAPI:100300, issuedApps: 31, persistency: 72, pctOfAnnualGoal: 54 },
  { id:'pn', name:'Priya Naidu',      role:null, unit:'S·01', contractDate:new Date(2024, 8, 2).getTime(), submittedAPI: 96000, submittedApps: 30, issuedAPI: 81600, issuedApps: 25, persistency: 78, pctOfAnnualGoal:null },
  { id:'rb', name:'Rohan Boodoo',     role:null, unit:'S·02', contractDate:new Date(2022, 6,15).getTime(), submittedAPI:154000, submittedApps: 48, issuedAPI:130900, issuedApps: 41, persistency: 88, pctOfAnnualGoal: 77 },
  { id:'kr', name:'Kavita Ramnarine', role:'UM', unit:'S·03', contractDate:new Date(2016, 0,11).getTime(), submittedAPI:301000, submittedApps: 94, issuedAPI:256000, issuedApps: 80, persistency: 93, pctOfAnnualGoal: 91 },
  { id:'jk', name:'Jared Khan',       role:null, unit:'S·01', contractDate:new Date(2025, 0, 6).getTime(), submittedAPI: 62000, submittedApps: 19, issuedAPI: 52700, issuedApps: 16, persistency: 84, pctOfAnnualGoal: 41 },
  { id:'lj', name:'Leah Joseph',      role:null, unit:'S·03', contractDate:new Date(2020, 7,22).getTime(), submittedAPI:208000, submittedApps: 65, issuedAPI:176800, issuedApps: 55, persistency: 96, pctOfAnnualGoal:110 },
  { id:'oa', name:'Omar Ali',         role:null, unit:'S·02', contractDate:new Date(2018, 9, 3).getTime(), submittedAPI:176000, submittedApps: 55, issuedAPI:150000, issuedApps: 47, persistency: 90, pctOfAnnualGoal: 73 },
  { id:'tg', name:'Tessa Garcia',     role:null, unit:'S·01', contractDate:new Date(2024, 3,29).getTime(), submittedAPI:   null, submittedApps:null, issuedAPI:   null, issuedApps:null, persistency:null, pctOfAnnualGoal:null },
];
