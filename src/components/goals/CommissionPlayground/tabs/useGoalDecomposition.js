import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { setGoals, getGoals } from '../../../../services/goalsService';
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
import { savedPlaygroundSettings } from '../../../../utils/playgroundSettings';

const HANDOFF_KEY = 'agencytrack-playground-income-goal';
const HISTORY_RATIO_KEYS = ['ciToSaleRatio', 'dialsToCIRatio'];

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

  // R2-3b (rulings 29-09 and 30-09-2026, option A) — on open, load the saved
  // assumptions, THEN apply the Money Needs hand-off on top. Order, lowest to
  // highest:
  //   defaults → saved assumptions → Money Needs hand-off (once, then removed)
  //   → history ratios (only for the two ratios the agent has NOT saved).
  // The hand-off is removed once applied, so the next open shows the saved
  // assumptions again (nothing else clears it). The inputs render only after
  // this settles (`settingsLoading`), so defaults never flash first. A failed
  // read falls back to the defaults. The pre-tax flag is saved with the
  // assumptions (ruling A+), so a goal sent from Money Needs and then saved is
  // not grossed up for tax a second time on reopen.
  const [settingsLoading, setSettingsLoading] = useState(Boolean(tenantId && agentId));
  const savedRatioKeysRef = useRef(new Set());
  // Which ratios on screen came from the agent's history (not from saved
  // assumptions) — the "From your history" labels follow this, per ratio.
  const [historyRatioKeys, setHistoryRatioKeys] = useState(() => new Set());
  const fromHistory = (key) => historyRatioKeys.has(key);

  useEffect(() => {
    let alive = true;
    const applyHandoff = () => {
      const stored = localStorage.getItem(HANDOFF_KEY);
      if (!stored) return;
      let parsed;
      try {
        parsed = JSON.parse(stored);
      } catch {
        // A malformed hand-off must not hold the tab on its loading state.
        localStorage.removeItem(HANDOFF_KEY);
        return;
      }
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
      localStorage.removeItem(HANDOFF_KEY);
    };
    if (!tenantId || !agentId) {
      applyHandoff();
      setSettingsLoading(false);
      return undefined;
    }
    // A new target (tenant / agent) starts from the defaults, not from the
    // previous target's values (CodeRabbit on #1029).
    setSettingsLoading(true);
    Promise.resolve()
      .then(() => getGoals(tenantId, agentId))
      .then((goals) => {
        if (!alive) return;
        const saved = savedPlaygroundSettings(goals);
        savedRatioKeysRef.current = new Set(HISTORY_RATIO_KEYS.filter((k) => k in saved.inputs));
        setInputs({ ...DEFAULT_DECOMPOSITION_INPUTS, ...saved.inputs });
        setIncomeAmount(saved.amount ?? DEFAULT_DECOMPOSITION_INPUTS.incomeGoal);
        setIncomePeriod(saved.amount != null ? saved.period : DEFAULT_INCOME_GOAL_PERIOD);
        setPtaFlag(saved.preTaxAlreadyApplied);
      })
      .catch(() => {
        // No saved assumptions readable → the defaults.
        if (!alive) return;
        savedRatioKeysRef.current = new Set();
        setInputs({ ...DEFAULT_DECOMPOSITION_INPUTS });
        setIncomeAmount(DEFAULT_DECOMPOSITION_INPUTS.incomeGoal);
        setIncomePeriod(DEFAULT_INCOME_GOAL_PERIOD);
        setPtaFlag(false);
      })
      .finally(() => {
        if (!alive) return;
        applyHandoff();
        setSettingsLoading(false);
      });
    return () => { alive = false; };
  }, [tenantId, agentId]);

  const { autoCiToSale, autoDialsToCI, hasHistory } = useMemo(
    () => deriveRatiosFromHistory(submissions),
    [submissions],
  );

  // A LAYOUT effect: it runs in the same commit that ends the loading state,
  // so the inputs never show the saved/default ratios for a frame before the
  // history ratios land (tests would otherwise race it too).
  useLayoutEffect(() => {
    // Waits for the saved assumptions (R2-3b): a ratio the agent saved wins
    // over the history-derived one.
    if (hasHistory && !settingsLoading) {
      const saved = savedRatioKeysRef.current;
      setHistoryRatioKeys(new Set(HISTORY_RATIO_KEYS.filter((k) => !saved.has(k))));
      setInputs((prev) => ({
        ...prev,
        ...(saved.has('ciToSaleRatio') ? {} : { ciToSaleRatio: parseFloat(autoCiToSale.toFixed(2)) }),
        ...(saved.has('dialsToCIRatio') ? {} : { dialsToCIRatio: parseFloat(autoDialsToCI.toFixed(2)) }),
      }));
    }
  }, [hasHistory, autoCiToSale, autoDialsToCI, settingsLoading]);

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
        playgroundPreTaxAlreadyApplied: preTaxAlreadyApplied,
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
    // hasHistory: at least one ratio on screen came from history (the banner);
    // fromHistory(key): that ratio did (its badge). settingsLoading: the saved
    // assumptions are still loading — render the loading state, not the inputs.
    hasHistory: historyRatioKeys.size > 0, fromHistory, settingsLoading,
    historyWeeks, setField, handleIncomeAmountChange, handleIncomePeriodChange,
    computed, handleRequestConfirm, handleConfirmWrite, handleSaveAssumptions,
  };
}
