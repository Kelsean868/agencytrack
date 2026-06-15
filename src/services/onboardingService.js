import { createMoneyNeeds, updateExpenseGroup } from './moneyNeedsService';
import { setGoals } from './goalsService';
import { createYearPlan } from './yearPlanService';
import { commitPlan } from './commitPlanService';
import { deriveAnnualApps } from '../lib/deriveApps';
import { updateUserProfile } from './userService';

export async function saveWizardMoneyNeeds(tenantId, uid, year, { monthly }) {
  const existing = await createMoneyNeeds(tenantId, uid, year);

  const monthlyAmt    = parseFloat(monthly) || 0;
  const existingGroup = existing.expenseGroups?.livingExpenses ?? { lineItems: [], subCalculatorRefs: [] };

  // Upsert the wizard item — preserve any other items already in the group
  const otherItems = (existingGroup.lineItems ?? []).filter((i) => i.id !== 'wiz-income-target');
  const wizItem = {
    id:               'wiz-income-target',
    label:            'Monthly income target',
    amount:           monthlyAmt,
    frequency:        'M',
    annualizedAmount: monthlyAmt * 12,
    isCustom:         true,
  };
  const mergedItems = [...otherItems, wizItem];

  const updatedGroup = {
    ...existingGroup,
    lineItems:        mergedItems,
    groupAnnualTotal: mergedItems.reduce((sum, i) => sum + (i.annualizedAmount ?? 0), 0),
  };

  const fullGroups = {
    ...(existing.expenseGroups ?? {}),
    livingExpenses: updatedGroup,
  };
  await updateExpenseGroup(tenantId, uid, year, 'livingExpenses', updatedGroup, fullGroups);
}

export async function saveWizardGamePlan(tenantId, uid, year, userName, { annualAPI, avgPolicyAPI }) {
  await setGoals(tenantId, uid, { playgroundAvgPolicyAPI: avgPolicyAPI }, uid, userName ?? '');
  await createYearPlan(tenantId, uid, year);
  const annualApps = deriveAnnualApps(annualAPI, avgPolicyAPI);
  await commitPlan(tenantId, uid, year, { annualAPI, annualApps });
}

export async function saveWizardProfile(tenantId, uid, { phone, bio }) {
  const fields = {};
  if (phone !== undefined) fields.phone = phone;
  if (bio   !== undefined) fields.bio   = bio;
  if (Object.keys(fields).length === 0) return;
  await updateUserProfile(tenantId, uid, fields);
}
