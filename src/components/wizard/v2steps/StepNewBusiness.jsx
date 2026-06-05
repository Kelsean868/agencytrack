import React, { useState, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { Card, NumericField, CurrencyField, SuggestedField } from '../CardStack';
import {
  computeLumpsumCredit,
  computeLumpsumCommission,
  validatePppIncrease,
} from '../../../lib/schema/weeklyReport.computations';
import { MIN_PPP_INCREASE } from '../../../lib/schema/weeklyReport';
import { formatCurrency } from '../../../utils/formatters';

/**
 * Wizard v2 step 7 — New business this week.
 *
 * v2 extraction of the legacy Step4ClosingSales component (retirement pass).
 * Faithful 1:1 port — SAME persisted keys (newCIBooked / oldCIBooked /
 * ciConducted / newBusiness.{apps,api} / livesSold / pppIncreases.{apps,
 * apiIncrease} / lumpsums.grossAmount), SAME on-change writers (nbChange /
 * pppChange / lmpsChange spread the nested object exactly as the legacy
 * component did), SAME suggested derivation (suggestedCiConducted =
 * newCIBooked + oldCIBooked), SAME collapse-state + PPP-minimum warning.
 *
 * ONE deliberate change vs the legacy file: the duplicate `id="apps"`
 * collision is fixed. Legacy gave both the New Business "Applications
 * Written" field AND the PPP "Number of PPP increases" field `name="apps"`
 * with no `inputId`, so both rendered `<input id="apps">` + two
 * `<label htmlFor="apps">` resolving to the FIRST input (a11y violation +
 * label-based test/SR mis-targeting — the MEDIUM duplicate-id FU). Here each
 * gets a unique `inputId` (`newBusinessApps` / `pppApps`). The `name="apps"`
 * stays — it is the nested-object field key consumed by nbChange/pppChange,
 * NOT the DOM id — so the persisted shape is byte-identical.
 */
export default function StepNewBusiness({ data, onChange }) {
  const [pppExpanded, setPppExpanded] = useState(
    () => (data.pppIncreases?.apiIncrease > 0 || data.pppIncreases?.apps > 0)
  );
  const [lumpsumsExpanded, setLumpsumsExpanded] = useState(
    () => (data.lumpsums?.grossAmount > 0)
  );

  const suggestedCiConducted = useMemo(
    () => (data.newCIBooked ?? 0) + (data.oldCIBooked ?? 0),
    [data.newCIBooked, data.oldCIBooked]
  );

  const lmpsGross  = data.lumpsums?.grossAmount ?? 0;
  const lmpsCredit = computeLumpsumCredit(lmpsGross);
  const lmpsComm   = computeLumpsumCommission(lmpsGross);

  const pppApps = data.pppIncreases?.apps ?? 0;
  const pppInc  = data.pppIncreases?.apiIncrease ?? 0;
  const pppAvgPerApp = pppApps > 0 ? pppInc / pppApps : null;
  const pppWarn = pppInc > 0 && pppAvgPerApp !== null && !validatePppIncrease(pppAvgPerApp);

  function nbChange(field, value) {
    onChange('newBusiness', { ...data.newBusiness, [field]: value });
  }
  function pppChange(field, value) {
    onChange('pppIncreases', { ...data.pppIncreases, [field]: value });
  }
  function lmpsChange(field, value) {
    onChange('lumpsums', { ...data.lumpsums, [field]: value });
  }

  function removePPP() {
    onChange('pppIncreases', { apps: 0, apiIncrease: 0 });
    setPppExpanded(false);
  }
  function removeLumpsums() {
    onChange('lumpsums', { grossAmount: 0 });
    setLumpsumsExpanded(false);
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Closing Interviews */}
      <Card badge="Closing Interviews" desc="A CI is a scheduled meeting where you present the solution and ask for the sale.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="New CIs Booked"
            name="newCIBooked"
            value={data.newCIBooked}
            onChange={onChange}
            desc="Closing interview appointments booked this week with new prospects."
          />
          <NumericField
            label="Old CIs Booked"
            name="oldCIBooked"
            value={data.oldCIBooked}
            onChange={onChange}
            desc="Closing interview appointments booked this week with previously seen prospects."
          />
          <SuggestedField
            label="CIs Conducted"
            name="ciConducted"
            value={data.ciConducted}
            onChange={onChange}
            suggestion={suggestedCiConducted}
            note="adjust if different"
            desc="Total closing interviews actually completed this week."
          />
        </div>
      </Card>

      {/* New Business — always visible, primary production source */}
      <Card badge="New Business" desc="New policy applications sold this week.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="Applications Written"
            name="apps"
            inputId="newBusinessApps"
            value={data.newBusiness?.apps ?? 0}
            onChange={nbChange}
            desc="Number of new policy applications completed and submitted."
          />
          <NumericField
            label="Lives Sold"
            name="livesSold"
            value={data.livesSold}
            onChange={onChange}
            desc="Total lives covered across all applications sold this week."
          />
          <CurrencyField
            label="API (TTD)"
            name="api"
            inputId="newBusinessApi"
            value={data.newBusiness?.api ?? 0}
            onChange={nbChange}
            desc="Annual Premium Income from new business applications sold this week."
          />
        </div>
      </Card>

      {/* PPP Increases — always visible; CTA in collapsed state, fields in expanded state */}
      <Card
        badge="PPP Increases"
        desc={`Minimum ${formatCurrency(MIN_PPP_INCREASE)} API increase per application.`}
      >
        {!pppExpanded ? (
          <button
            type="button"
            onClick={() => setPppExpanded(true)}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/30 bg-card-raised text-primary text-sm font-semibold hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            <Plus size={16} />
            Add PPP details
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex justify-end -mt-1">
              <button
                type="button"
                onClick={removePPP}
                className="flex items-center gap-1 text-xs text-ink-muted hover:text-danger transition-colors"
              >
                <X size={12} />
                Remove
              </button>
            </div>
            <NumericField
              label="Number of PPP increases"
              name="apps"
              inputId="pppApps"
              value={data.pppIncreases?.apps ?? 0}
              onChange={pppChange}
              desc="Count of clients whose policy premiums were increased this week."
            />
            <CurrencyField
              label="Total API increase (TTD)"
              name="apiIncrease"
              inputId="pppApiIncrease"
              value={data.pppIncreases?.apiIncrease ?? 0}
              onChange={pppChange}
              desc="Combined annual premium increase across all PPP transactions."
            />
            {pppWarn && (
              <p className="text-xs text-warning-ink font-medium">
                Average {formatCurrency(Math.round(pppAvgPerApp))} per application is below the{' '}
                {formatCurrency(MIN_PPP_INCREASE)} minimum — check your figures.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Lumpsums — always visible; CTA in collapsed state, fields in expanded state */}
      <Card
        badge="Lumpsums"
        desc="10% API credit · 0.5% commission (fixed rates)."
      >
        {!lumpsumsExpanded ? (
          <button
            type="button"
            onClick={() => setLumpsumsExpanded(true)}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/30 bg-card-raised text-primary text-sm font-semibold hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            <Plus size={16} />
            Add lumpsum details
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex justify-end -mt-1">
              <button
                type="button"
                onClick={removeLumpsums}
                className="flex items-center gap-1 text-xs text-ink-muted hover:text-danger transition-colors"
              >
                <X size={12} />
                Remove
              </button>
            </div>
            <CurrencyField
              label="Gross lumpsum amount (TTD)"
              name="grossAmount"
              inputId="lumpsumGrossAmount"
              value={data.lumpsums?.grossAmount ?? 0}
              onChange={lmpsChange}
              desc="Total lumpsum premium collected this week."
            />
            {lmpsGross > 0 && (
              <div className="flex flex-col gap-1.5 pt-1 border-t border-primary/20">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-muted">API credit (10%)</span>
                  <span className="font-semibold text-primary">{formatCurrency(lmpsCredit)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-muted">Commission (0.5%)</span>
                  <span className="font-semibold text-primary">{formatCurrency(lmpsComm)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

    </div>
  );
}
