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
  // R2-10 (additive; the Nexus scorecards ignore these): the FR Career shows a
  // loading state, and a Retry when the goals read failed. The read itself and
  // its fallback to "no goals" are unchanged.
  const [loaded, setLoaded]            = useState(false);
  const [loadFailed, setLoadFailed]    = useState(false);
  const [reloadToken, setReloadToken]  = useState(0);
  const retry = () => { setLoaded(false); setLoadFailed(false); setReloadToken((n) => n + 1); };

  useEffect(() => {
    if (!authUser?.uid || !tenantId) return undefined;
    // A retry or a year change can start a second read before the first ends;
    // only the latest run may set state (CodeRabbit on #1026).
    let active = true;
    Promise.all([
      getGoals(tenantId, authUser.uid).catch(() => { if (active) setLoadFailed(true); return null; }),
      getCompanyMinimums(tenantId).catch(() => ({ annualAPI: 200000, annualApps: 40, persistency: 90 })),
      getMoneyNeeds(tenantId, authUser.uid, careerYear).catch(() => null),
    ]).then(([g, mins, mn]) => {
      if (!active) return;
      setGoalsState(g);
      setMinimums(mins);
      setMoneyNeedsRequired(parseFloat(mn?.firstYearCommissionsRequired) || 0);
      setDraft({
        personalAnnualAPI:         g?.personalAnnualAPI         ?? '',
        personalAnnualApps:        g?.personalAnnualApps        ?? '',
        personalAnnualPersistency: g?.personalAnnualPersistency ?? '',
      });
      setLoaded(true);
    });
    return () => { active = false; };
  }, [authUser?.uid, tenantId, careerYear, reloadToken]);

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
    loaded, loadFailed, retry,
  };
}
