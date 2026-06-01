/**
 * Track J Wizard v2 PR1 — Activity step 1 of 5: "Letters & outreach".
 *
 * v2 re-pagination of the legacy Step1Prospecting's "Letters & Outreach"
 * Card. Identical field markup as the legacy step — same `NumericField`s,
 * same `name` keys (`prospectingLettersSent`, `prospectingEmailsSent`),
 * same parent `onChange` flow. Persisted fields unchanged.
 *
 * Pure re-fan; the legacy `Step1Prospecting.jsx` file is intentionally
 * NOT modified (CLAUDE.md "Step1–9 NEVER modified" rule + brief's
 * easy-revert property). Lifting the JSX here keeps the legacy file's
 * git blame clean for the easy-revert path: revert WizardForm.jsx +
 * delete v2steps/ to restore the 9-step flow.
 */

import React from 'react';
import { Card, NumericField } from '../CardStack';

export default function StepLettersOutreach({ data, onChange }) {
  return (
    <div className="flex flex-col gap-4">
      <Card badge="Letters & Outreach" desc="Outgoing letters and emails sent to prospects this week.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="Prospecting Letters Sent"
            name="prospectingLettersSent"
            value={data.prospectingLettersSent}
            onChange={onChange}
          />
          <NumericField
            label="Prospecting Emails Sent"
            name="prospectingEmailsSent"
            value={data.prospectingEmailsSent}
            onChange={onChange}
          />
        </div>
      </Card>
    </div>
  );
}
