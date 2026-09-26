/**
 * awardLensFixtures — shared fixtures for the Policy Ledger award lens (L1):
 * the engine tests, the component tests and the design-check harness
 * (scripts/verification/ledger-l1-fixture-harness.jsx) all render these.
 *
 * Placeholder names and made-up policy numbers only — no client data.
 * "Today" is 26 Sep 2026; the latest head-office export is 15 Sep 2026.
 */
import { RULE_7_CREDIT_TABLE } from '../../policyCampaignLens';

export const TODAY = '2026-09-26';
export const EXPORT_DATE = '2026-09-15';

export const CHRISTMAS = Object.freeze({
  id: 'xmas26',
  name: 'Christmas Campaign & Retreat',
  shortName: 'Christmas',
  startDate: '2026-07-01',
  endDate: '2026-12-31',
  structure: 'qualify',
  suppressesAwardCash: true,
  persistencyGate: { threshold: 90, basis: 'finalMonth' },
  tiers: [
    { level: 1, name: 'Champion', api: 275_000, apps: 35, cash: 7_000 },
    { level: 2, name: 'VIP', api: 375_000, apps: 35, cash: 20_000 },
    { level: 3, name: 'Premier', api: 475_000, apps: 35, cash: 30_000 },
    { level: 4, name: 'Elite', api: 675_000, apps: 35, cash: 52_000 },
    { level: 5, name: 'Pioneer', api: 825_000, apps: 35, cash: 70_000 },
  ],
  credit: { table: RULE_7_CREDIT_TABLE, incPppAppThreshold: 2400 },
});

const base = (over) => ({
  productLine: 'life',
  isSelfOrFamily: false,
  newBusinessType: 'nb_ordinary',
  exportDate: EXPORT_DATE,
  importSource: 'oipa_import',
  statusSource: 'oipa_import',
  ...over,
});

export const POLICIES = Object.freeze([
  base({ id: 'A', ownerName: 'Policyholder A', policyNumber: 'FX0002381', planName: 'Life', status: 'settled', proposedAPI: 24_600, dateIssued: '2026-08-12' }),
  base({ id: 'B', ownerName: 'Policyholder B', policyNumber: 'FX0002396', planName: 'Life', status: 'settled', proposedAPI: 31_200, dateIssued: '2026-09-03' }),
  // Self-confirmed, issued AFTER the 15 Sep export → provably not on the HO list.
  base({ id: 'C', ownerName: 'Policyholder C', policyNumber: 'FX0002410', planName: 'Critical illness', status: 'settled', proposedAPI: 18_146, dateIssued: '2026-09-18', importSource: null, exportDate: null, statusSource: 'agent' }),
  base({ id: 'D', ownerName: 'Policyholder D', policyNumber: 'FX0002415', planName: 'Life', status: 'submitted', proposedAPI: 36_000, dateSubmitted: '2026-09-15', importSource: null, exportDate: null, statusSource: 'agent' }),
  base({ id: 'F', ownerName: 'Policyholder F', policyNumber: 'FX0002390', planName: 'Life', status: 'ntu', proposedAPI: 12_000, dateIssued: '2026-08-20', replacedBy: 'FX0002403' }),
  base({ id: 'G', ownerName: 'Policyholder G', policyNumber: 'FX0002398', planName: 'Life', status: 'settled', proposedAPI: 13_200, dateIssued: '2026-08-30', isSelfOrFamily: true }),
  base({ id: 'H', ownerName: 'Policyholder H', policyNumber: 'FX0001190', planName: 'Life', status: 'settled', proposedAPI: 88_000, dateIssued: '2019-03-02' }),
  base({ id: 'I', ownerName: 'Policyholder I', policyNumber: 'FX0002302', planName: 'Life', status: 'settled', proposedAPI: 9_000, dateIssued: '2026-05-10' }),
  base({ id: 'M', ownerName: 'Policyholder M', policyNumber: 'FX0000077', planName: 'Motor', productLine: 'motor', status: 'settled', proposedAPI: 500, dateIssued: '2026-09-01' }),
]);
