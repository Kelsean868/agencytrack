/**
 * LX fixture double for `src/services/policiesService.js`. Reads return the
 * shared award-lens fixtures (placeholder names, made-up numbers); every
 * write REJECTS, so a stray click in the harness can never write anywhere.
 */
import { POLICIES } from '../../../../src/lib/__tests__/fixtures/awardLensFixtures.js';

function fixtureCase() {
  return new URLSearchParams(window.location.search).get('case') ?? 'campaign';
}

export async function getOwnPolicies() {
  const c = fixtureCase();
  if (c === 'empty') return [];
  if (c === 'error') throw new Error('Offline fixture — simulated load failure');
  if (c === 'loading') return new Promise(() => {});
  return POLICIES.map((p) => ({ ...p }));
}

const refuse = async () => { throw new Error('Offline fixture — writes are disabled'); };
export const createPolicy = refuse;
export const transitionPolicyStatus = refuse;
export async function getPolicyHistory() { return []; }
