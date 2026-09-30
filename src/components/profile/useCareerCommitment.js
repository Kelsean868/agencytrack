import { useState, useEffect } from 'react';
import { getGoals, setGoals, getCompanyMinimums } from '../../services/goalsService';
import { getMoneyNeeds } from '../../services/moneyNeedsService';
import { resolveAnnualAPIFloor, FLAT_ANNUAL_API_FALLBACK } from '../../utils/tenureFloors';
import { useAuth } from '../../context/AuthContext';

/**
 * useCareerCommitment — the Career portal's annual-commitment data and
 * handlers (R2-10). Moved VERBATIM out of CareerPortal's GoalsSection so the
 * Nexus scorecards and the FR bullets share one read / edit / save / nudge
 * path. Pinned by CareerPortal.characterization.test.jsx (same service calls,
 * same arguments).
 *
 * @param {number} careerYear  the year the Money-needs requirement is read for
 */
export default function useCareerCommitment(careerYear) {
  const { user: authUser, userProfile, tenantId } = useAuth();
  const [goals, setGoalsState]         = useState(null);
  const [minimums, setMinimums]        = useState(null);
  const [editing, setEditing]          = useState(false);
  const [saving, setSaving]            = useState(false);
  const [saveError, setSaveError]      = useState('');
  const [moneyNeedsRequired, setMoneyNeedsRequired] = useState(0);
  const [showNudge, setShowNudge]      = useState(false);
  const [pendingDraft, setPendingDraft]= useState(null);
  const [draft, setDraft] = useState({
    personalAnnualAPI:         '',
    personalAnnualApps:        '',
    personalAnnualPersistency: '',
  });

  useEffect(() => {
    if (!authUser?.uid || !tenantId) return;
    Promise.all([
      getGoals(tenantId, authUser.uid).catch(() => null),
      getCompanyMinimums(tenantId).catch(() => ({ annualAPI: 200000, annualApps: 40, persistency: 90 })),
      getMoneyNeeds(tenantId, authUser.uid, careerYear).catch(() => null),
    ]).then(([g, mins, mn]) => {
      setGoalsState(g);
      setMinimums(mins);
      setMoneyNeedsRequired(parseFloat(mn?.firstYearCommissionsRequired) || 0);
      setDraft({
        personalAnnualAPI:         g?.personalAnnualAPI         ?? '',
        personalAnnualApps:        g?.personalAnnualApps        ?? '',
        personalAnnualPersistency: g?.personalAnnualPersistency ?? '',
      });
    });
  }, [authUser?.uid, tenantId, careerYear]);

  async function doSave(draftToSave) {
    setSaving(true); setSaveError('');
    try {
      const name = userProfile?.name ?? userProfile?.email ?? 'Agent';
      await setGoals(tenantId, authUser.uid, {
        personalAnnualAPI:         draftToSave.personalAnnualAPI,
        personalAnnualApps:        draftToSave.personalAnnualApps,
        personalAnnualPersistency: draftToSave.personalAnnualPersistency,
      }, authUser.uid, name);
      const updated = await getGoals(tenantId, authUser.uid);
      setGoalsState(updated);
      setEditing(false);
    } catch (e) {
      setSaveError(e.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  const handleSave = async () => {
    if (!tenantId) return;
    const api = parseFloat(draft.personalAnnualAPI) || 0;
    if (moneyNeedsRequired > 0 && api < moneyNeedsRequired) {
      setPendingDraft({ ...draft }); setShowNudge(true); return;
    }
    await doSave(draft);
  };

  const mins  = minimums ?? { annualAPI: 200000, annualApps: 40, persistency: 90 };
  const resolvedAnnualAPIFloor = resolveAnnualAPIFloor({
    contractStartDate: userProfile?.contractStartDate ?? null,
    tenureApiFloors: mins.tenureApiFloors,
    fallback: FLAT_ANNUAL_API_FALLBACK,
  });
  const mgr  = { api: goals?.targetAnnualAPI ?? 0, apps: goals?.targetAnnualApps ?? 0, persistency: goals?.targetAnnualPersistency ?? 0 };
  const mine = { api: goals?.personalAnnualAPI ?? 0, apps: goals?.personalAnnualApps ?? 0, persistency: goals?.personalAnnualPersistency ?? 0 };

  return {
    goals, minimums, editing, setEditing, saving, saveError, setSaveError, draft, setDraft,
    showNudge, setShowNudge, pendingDraft, setPendingDraft, moneyNeedsRequired,
    doSave, handleSave, mins, resolvedAnnualAPIFloor, mgr, mine,
  };
}
