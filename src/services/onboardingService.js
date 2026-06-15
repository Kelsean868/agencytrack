import { createMoneyNeeds, updateExpenseGroup } from './moneyNeedsService';
import { setGoals } from './goalsService';
import { createYearPlan } from './yearPlanService';
import { commitPlan } from './commitPlanService';
import { deriveAnnualApps } from '../lib/deriveApps';
import { updateUserProfile } from './userService';

export async function saveWizardMoneyNeeds(tenantId, uid, year, { monthly }) {
  const existing = await createMoneyNeeds(tenantId, uid, year);

  const monthlyAmt = parseFloat(monthly) || 0;
  const updatedGroup = {
    lineItems: [{
      id:               'wiz-income-target',
      label:            'Monthly income target',
      amount:           monthlyAmt,
      frequency:        'M',
      annualizedAmount: monthlyAmt * 12,
      isCustom:         true,
    }],
    subCalculatorRefs: [],
    groupAnnualTotal:  monthlyAmt * 12,
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
