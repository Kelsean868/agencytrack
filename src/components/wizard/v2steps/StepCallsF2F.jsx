/**
 * Track J Wizard v2 PR1 — Activity step 3 of 5: "Calls & face-to-face".
 *
 * v2 re-pagination of:
 *   - legacy Step2Telephone's three call Cards + total-calls summary
 *   - legacy Step1Prospecting's "Face-to-Face" Card
 *
 * Identical field markup as the legacy steps — same `NumericField`s,
 * same `name` keys, same parent `onChange` flow, same total-calls
 * derivation logic. Persisted fields unchanged.
 *
 * Pure re-fan; legacy `Step1Prospecting.jsx` + `Step2Telephone.jsx`
 * are intentionally NOT modified.
 */

import React, { useMemo } from 'react';
import { Card, NumericField } from '../CardStack';

export default function StepCallsF2F({ data, onChange }) {
  const total = useMemo(
    () =>
      (data.referralCalls ?? 0) +
      (data.followUpCalls ?? 0) +
      (data.coldCalls ?? 0) +
      (data.seminarTradeshowCalls ?? 0) +
      (data.serviceCalls ?? 0),
    [data.referralCalls, data.followUpCalls, data.coldCalls, data.seminarTradeshowCalls, data.serviceCalls]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Telephone Cards (lifted from legacy Step2Telephone) */}
      <Card badge="Referral & Follow-Up" desc="Calls made to warm contacts — referrals and prior conversations.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="Referral Calls"
            name="referralCalls"
            value={data.referralCalls}
            onChange={onChange}
            desc="Calls to names given to you by existing clients or contacts."
          />
          <NumericField
            label="Follow-Up Calls"
            name="followUpCalls"
            value={data.followUpCalls}
            onChange={onChange}
            desc="Calls to prospects you have already contacted before."
          />
        </div>
      </Card>

      <Card badge="Outbound & Events" desc="Cold outreach and event follow-up calls made this week.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="Cold Calls"
            name="coldCalls"
            value={data.coldCalls}
            onChange={onChange}
            desc="Calls to completely new, uncontacted prospects."
          />
          <NumericField
            label="Seminar / Tradeshow Calls"
            name="seminarTradeshowCalls"
            value={data.seminarTradeshowCalls}
            onChange={onChange}
            desc="Follow-up calls to names collected from seminars or tradeshows."
          />
        </div>
      </Card>

      <Card badge="Service Calls" desc="Calls to existing clients for servicing purposes.">
        <NumericField
          label="Service Calls"
          name="serviceCalls"
          value={data.serviceCalls}
          onChange={onChange}
          desc="Calls made to existing policyholders for service or retention."
        />
      </Card>

      {total > 0 && (
        <Card variant="teal">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-primary">Total Calls This Week</span>
            <span className="text-2xl font-bold text-primary">{total}</span>
          </div>
        </Card>
      )}

      {/* Face-to-Face Card (lifted from legacy Step1Prospecting) */}
      <Card badge="Face-to-Face" desc="Direct in-person prospecting contacts made this week.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="F2F Attempts"
            name="f2fAttempts"
            value={data.f2fAttempts}
            onChange={onChange}
            desc="Total in-person prospecting attempts made."
          />
          <NumericField
            label="F2F Contacts"
            name="f2fContacts"
            value={data.f2fContacts}
            onChange={onChange}
            desc="Attempts that resulted in a meaningful conversation."
          />
        </div>
      </Card>
    </div>
  );
}
