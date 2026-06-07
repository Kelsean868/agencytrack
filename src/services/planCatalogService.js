import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';

function cfgRef(tenantId) {
  return doc(db, 'tenants', tenantId, 'config', 'policyPlans');
}

function empty() {
  return { plans: [], pendingReview: [] };
}

/**
 * Returns { plans, pendingReview }. Tolerates missing doc (returns empty).
 */
export async function getPolicyPlans(tenantId) {
  const snap = await getDoc(cfgRef(tenantId));
  if (!snap.exists()) return empty();
  const data = snap.data();
  return {
    plans: data.plans ?? [],
    pendingReview: data.pendingReview ?? [],
  };
}

/**
 * Add a new catalog plan (isActive: true, id: UUID).
 */
export async function addPlan(tenantId, { name, class: policyClass, productLine }) {
  const ref = cfgRef(tenantId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? (snap.data().plans ?? []) : [];
    const newPlan = {
      id: crypto.randomUUID(),
      name: name.trim(),
      class: policyClass,
      productLine,
      isActive: true,
    };
    if (snap.exists()) {
      tx.update(ref, { plans: [...current, newPlan] });
    } else {
      tx.set(ref, { plans: [newPlan], pendingReview: [] });
    }
  });
}

/**
 * Update an existing plan's editable fields (name, class, productLine).
 * Finds by id; all other plans unchanged.
 */
export async function updatePlan(tenantId, planId, updates) {
  const ref = cfgRef(tenantId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Plan catalog not initialized.');
    const plans = snap.data().plans ?? [];
    const idx = plans.findIndex((p) => p.id === planId);
    if (idx < 0) throw new Error(`Plan ${planId} not found.`);
    const updated = plans.map((p, i) =>
      i === idx ? { ...p, ...updates } : p
    );
    tx.update(ref, { plans: updated });
  });
}

/**
 * Soft-delete: sets isActive=false on the plan matching planId.
 */
export async function deactivatePlan(tenantId, planId) {
  const ref = cfgRef(tenantId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Plan catalog not initialized.');
    const plans = snap.data().plans ?? [];
    const updated = plans.map((p) =>
      p.id === planId ? { ...p, isActive: false } : p
    );
    tx.update(ref, { plans: updated });
  });
}

/**
 * Promote a pendingReview entry to the plans[] catalog.
 * Removes from pendingReview; adds to plans with given class + productLine.
 */
export async function promotePendingPlan(tenantId, pendingName, { policyClass, productLine }) {
  const normalized = pendingName.trim().toLowerCase();
  const ref = cfgRef(tenantId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Plan catalog not initialized.');
    // Use ?? instead of destructuring defaults: Firestore can store explicit null
    // for missing arrays, which destructuring `= []` won't catch (only undefined triggers it).
    const data = snap.data();
    const plans         = data.plans         ?? [];
    const pendingReview = data.pendingReview ?? [];
    const entry = pendingReview.find(
      (p) => p.name.trim().toLowerCase() === normalized
    );
    if (!entry) throw new Error(`Pending plan "${pendingName}" not found.`);
    const newPlan = {
      id: crypto.randomUUID(),
      name: entry.name,
      class: policyClass,
      productLine,
      isActive: true,
    };
    tx.update(ref, {
      plans: [...plans, newPlan],
      pendingReview: pendingReview.filter(
        (p) => p.name.trim().toLowerCase() !== normalized
      ),
    });
  });
}

/**
 * Remove a pendingReview entry by name (case-insensitive trimmed match).
 */
export async function dismissPendingPlan(tenantId, pendingName) {
  const normalized = pendingName.trim().toLowerCase();
  const ref = cfgRef(tenantId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Plan catalog not initialized.');
    const pendingReview = snap.data().pendingReview ?? [];
    tx.update(ref, {
      pendingReview: pendingReview.filter(
        (p) => p.name.trim().toLowerCase() !== normalized
      ),
    });
  });
}
