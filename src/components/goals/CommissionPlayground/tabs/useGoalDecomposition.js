import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { setGoals } from '../../../../services/goalsService';
import {
  getUserPrefs, setCommissionScenarios, COMMISSION_SCENARIO_CAP,
} from '../../../../services/userPrefsService';
import {
  decomposeFromIncome,
  deriveRatiosFromHistory,
  DEFAULT_DECOMPOSITION_INPUTS,
} from '../../../../utils/goalDecomposition';
import {
  DEFAULT_INCOME_GOAL_PERIOD,
  toAnnualIncomeGoal,
} from '../../../../utils/playgroundPeriods';

/**
 * useGoalDecomposition — every read, derivation, handler and write of the
 * Commission playground's Goal Decomposition tab (R2-7). Moved VERBATIM out of
 * GoalDecompositionTab so the Nexus tab and the FR layout (look="fr") run ONE
 * code path; the characterization suite
 * (__tests__/CommissionPlayground.characterization.test.jsx) pins that the
 * Nexus output did not change.
 *
 * @param {{ submissions?: object[], agentId: string, tenantId: string,
 *           onGoalSaved?: Function }} args
 */
export default function useGoalDecomposition({ submissions = [], agentId, tenantId, onGoalSaved }) {
  const { user, userProfile } = useAuth();
  const [inputs, setInputs]                     = useState(DEFAULT_DECOMPOSITION_INPUTS);
  const [freqKey, setFreqKey]                   = useState('annual');
  const [saving, setSaving]                     = useState(false);
  const [savedGoals, setSavedGoals]             = useState(false);
  const [savedAssumptions, setSavedAssumptions] = useState(false);
  const [error, setError]                       = useState('');
  const [showConfirm, setShowConfirm]           = useState(false);
  const [preTaxAlreadyApplied, setPtaFlag]      = useState(false);
  // R2-3: the income goal as the agent TYPED it, plus its period. The annual
  // `inputs.incomeGoal` every reader uses is always amount × divisor(period);
  // the three writers (field edits via setIncomeEntry, the Money Needs
  // hand-off, scenario apply) always set all three together.
  const [incomeAmount, setIncomeAmount]         = useState(DEFAULT_DECOMPOSITION_INPUTS.incomeGoal);
  const [incomePeriod, setIncomePeriod]         = useState(DEFAULT_INCOME_GOAL_PERIOD);

  const setIncomeEntry = (amount, period) => {
    setIncomeAmount(amount);
    setIncomePeriod(period);
    setInputs((prev) => ({ ...prev, incomeGoal: toAnnualIncomeGoal(amount, period) }));
  };

  // ── R-06: saved scenario chips (agent-private, own-write) ──────────────────
  // Persisted on the shared `users/{uid}/prefs/app` doc via userPrefsService
  // (merge-write). That rules arm is `request.auth.uid == uid` for read AND
  // write with NO manager arm, so scenarios are private by construction — no
  // firestore.rules change, no index, no shared/manager visibility to leak.
  const [scenarios, setScenarios]     = useState([]);
  const [scenarioSaving, setScenSaving] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState(null);

  // `mutatedRef` closes a hydration RACE: a slow getUserPrefs resolving AFTER the
  // agent has already saved or deleted locally would otherwise clobber that
  // mutation with pre-mutation server state. Once any local mutation has
  // happened, hydration results are ignored (the local list is authoritative —
  // it is also what was just written).
  const mutatedRef = useRef(false);

  useEffect(() => {
    if (!tenantId || !user?.uid) return undefined;
    let alive = true;
    getUserPrefs(tenantId, user.uid)
      .then((prefs) => {
        if (!alive || mutatedRef.current) return;   // unmounted, or a local write already won
        setScenarios(Array.isArray(prefs?.commissionScenarios) ? prefs.commissionScenarios : []);
      })
      // Degrade silently to "no scenarios" — never block the playground on a
      // prefs read (same contract as the nav-prefs consumers).
      .catch(() => { /* no-op */ });
    return () => { alive = false; };
  }, [tenantId, user?.uid]);

  const persistScenarios = async (next) => {
    // Capture the pre-optimistic state so a failed write can be ROLLED BACK —
    // otherwise the chip row keeps showing a scenario that was never persisted,
    // i.e. the UI lies about server state until the next reload.
    const prevScenarios = scenarios;
    const prevActiveId  = activeScenarioId;
    mutatedRef.current = true;
    setScenarios(next);           // optimistic — the chip row is a preference, not money
    setScenSaving(true);
    try {
      await setCommissionScenarios(tenantId, user.uid, next);
    } catch {
      setScenarios(prevScenarios);
      setActiveScenarioId(prevActiveId);
      setError('Could not save the scenario — check your connection and try again.');
    } finally {
      setScenSaving(false);
    }
  };

  const handleScenarioSave = (label) => {
    const entry = {
      id: `sc-${Date.now()}`,
      label,
      savedAt: new Date().toISOString(),   // client ISO — never a serverTimestamp inside an array
      inputs: { ...inputs },
      freqKey,
    };
    setActiveScenarioId(entry.id);
    persistScenarios([...scenarios, entry].slice(0, COMMISSION_SCENARIO_CAP));
  };

  const handleScenarioApply = (s) => {
    // Merge over the defaults so a scenario saved before a new input key was
    // added still applies cleanly (missing key → default, never undefined).
    const next = { ...DEFAULT_DECOMPOSITION_INPUTS, ...(s.inputs || {}) };
    setInputs(next);
    // Scenarios store the ANNUAL income goal only (no period) — they load as
    // annual, the same value the agent saved (R2-3 decision 3).
    setIncomeAmount(next.incomeGoal);
    setIncomePeriod(DEFAULT_INCOME_GOAL_PERIOD);
    if (s.freqKey) setFreqKey(s.freqKey);
    setActiveScenarioId(s.id);
  };

  const handleScenarioDelete = (id) => {
    if (activeScenarioId === id) setActiveScenarioId(null);
    persistScenarios(scenarios.filter((s) => s.id !== id));
  };

  useEffect(() => {
    const stored = localStorage.getItem('agencytrack-playground-income-goal');
    if (stored) {
      const parsed = JSON.parse(stored);
      const isObj = parsed !== null && typeof parsed === 'object';
      const val = isObj ? parseFloat(parsed.value) : parseFloat(parsed);
      const flag = isObj && parsed.preTaxAlreadyApplied === true;
      if (val > 0) {
        // The Money Needs hand-off is an annual figure → period Annual.
        setIncomeAmount(val);
        setIncomePeriod(DEFAULT_INCOME_GOAL_PERIOD);
        setInputs((prev) => ({ ...prev, incomeGoal: toAnnualIncomeGoal(val, DEFAULT_INCOME_GOAL_PERIOD) }));
        setPtaFlag(flag);
      }
    }
  }, []);

  const { autoCiToSale, autoDialsToCI, hasHistory } = useMemo(
    () => deriveRatiosFromHistory(submissions),
    [submissions],
  );

  useEffect(() => {
    if (hasHistory) {
      setInputs((prev) => ({
        ...prev,
        ciToSaleRatio:  parseFloat(autoCiToSale.toFixed(2)),
        dialsToCIRatio: parseFloat(autoDialsToCI.toFixed(2)),
      }));
    }
  }, [hasHistory, autoCiToSale, autoDialsToCI]);

  const setField = (key) => (value) => {
    if (key === 'taxRate') setPtaFlag(false);
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  // Editing the amount OR its period changes the annual income goal, so either
  // clears the Money Needs pre-tax flag — same contract as the old direct edit.
  const handleIncomeAmountChange = (amount) => {
    setPtaFlag(false);
    setIncomeEntry(amount, incomePeriod);
  };
  const handleIncomePeriodChange = (period) => {
    setPtaFlag(false);
    setIncomeEntry(incomeAmount, period);
  };

  const computed = useMemo(
    () => decomposeFromIncome({ ...inputs, preTaxAlreadyApplied }),
    [inputs, preTaxAlreadyApplied],
  );

  const handleRequestConfirm = () => {
    const api = computed.apiToWrite;
    if (!api || api <= 0 || !isFinite(api)) return;
    setError('');
    setShowConfirm(true);
  };

  const handleConfirmWrite = async () => {
    // Defensive guard — handleRequestConfirm already validates, but protect
    // against any state race between the confirm dialog opening and submission.
    const api = computed.apiToWrite;
    if (!api || api <= 0 || !isFinite(api)) { setShowConfirm(false); return; }
    setSaving(true);
    setError('');
    try {
      const name = userProfile?.name ?? userProfile?.email ?? 'Agent';
      await setGoals(tenantId, agentId, {
        personalAnnualAPI:  computed.apiToWrite,
        personalAnnualApps: computed.applications,
      }, user.uid, name);
      setShowConfirm(false);
      setSavedGoals(true);
      onGoalSaved?.();
      setTimeout(() => setSavedGoals(false), 2500);
    } catch (e) {
      setError(e.message ?? 'Failed to save goals.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAssumptions = async () => {
    setSaving(true);
    setError('');
    try {
      const name = userProfile?.name ?? userProfile?.email ?? 'Agent';
      await setGoals(tenantId, agentId, {
        playgroundIncomeGoal:      inputs.incomeGoal,
        playgroundIncomeGoalPeriod: incomePeriod,
        playgroundTaxRate:         inputs.taxRate,
        playgroundRenewalIncome:   inputs.renewalIncome,
        playgroundSettlementRate:  inputs.settlementRate,
        playgroundCommissionRate:  inputs.commissionRate,
        playgroundAvgPolicyAPI:    inputs.avgPolicyAPI,
        playgroundPersistencyRate: inputs.persistencyRate,
        playgroundCiToSaleRatio:   inputs.ciToSaleRatio,
        playgroundDialsToCIRatio:  inputs.dialsToCIRatio,
        playgroundProspectRatio:   inputs.prospectRatio,
      }, user.uid, name);
      setSavedAssumptions(true);
      setTimeout(() => setSavedAssumptions(false), 2500);
    } catch (e) {
      setError(e.message ?? 'Failed to save assumptions.');
    } finally {
      setSaving(false);
    }
  };

  const historyWeeks = Math.min((submissions ?? []).filter((s) => s.status === 'submitted').length, 12);

  return {
    inputs, freqKey, setFreqKey, saving, savedGoals, savedAssumptions, error,
    showConfirm, setShowConfirm, preTaxAlreadyApplied, incomeAmount, incomePeriod,
    scenarios, scenarioSaving, activeScenarioId,
    handleScenarioSave, handleScenarioApply, handleScenarioDelete,
    hasHistory, historyWeeks, setField, handleIncomeAmountChange, handleIncomePeriodChange,
    computed, handleRequestConfirm, handleConfirmWrite, handleSaveAssumptions,
  };
}
