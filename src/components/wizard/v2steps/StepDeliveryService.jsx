import React, { useMemo } from 'react';
import { Card, NumericField, CurrencyField, SuggestedField } from '../CardStack';

/**
 * Wizard v2 step 8 — Delivery & service.
 *
 * v2 extraction of the legacy Step6DeliveriesService component (retirement
 * pass). Faithful 1:1 port — SAME persisted keys, SAME on-change logic, SAME
 * lastWeek-derived suggestion (suggestedOutstanding = max(0,
 * lastWeekData.policiesOutstanding + policiesReceived - policiesDelivered)),
 * SAME `hasServiceWork` Yes/No toggle gating the conditional service block.
 * Consumes `lastWeekData` exactly as the legacy step did (the wizard passes
 * it via the `needsLastWeekData` flag).
 */
export default function StepDeliveryService({ data, onChange, lastWeekData }) {
  const suggestedOutstanding = useMemo(
    () =>
      Math.max(
        0,
        (lastWeekData?.policiesOutstanding ?? 0) +
          (data.policiesReceived ?? 0) -
          (data.policiesDelivered ?? 0)
      ),
    [lastWeekData?.policiesOutstanding, data.policiesReceived, data.policiesDelivered]
  );

  return (
    <div className="flex flex-col gap-4">
      <Card badge="Policy Deliveries" desc="Policies received from the company and delivered to clients this week.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="New Policies Received"
            name="policiesReceived"
            value={data.policiesReceived}
            onChange={onChange}
            desc="Policies approved and received from the company this week."
          />
          <NumericField
            label="Policies Delivered"
            name="policiesDelivered"
            value={data.policiesDelivered}
            onChange={onChange}
            desc="Policies successfully handed to clients this week."
          />
          <SuggestedField
            label="Total Policies Outstanding"
            name="policiesOutstanding"
            value={data.policiesOutstanding}
            onChange={onChange}
            suggestion={suggestedOutstanding}
            note="adjust if different"
            desc="All received but undelivered policies, including from prior weeks."
          />
        </div>
      </Card>

      <Card badge="Service Work" desc="Did you carry out any service work with existing clients this week?">
        <div className="flex gap-3 mt-1">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => onChange('hasServiceWork', v)}
              className={`flex-1 h-11 rounded-lg border font-semibold text-sm transition-colors ${
                data.hasServiceWork === v
                  ? 'border-primary bg-primary dark:bg-primary-dark text-white'
                  : 'border-border bg-card text-ink hover:border-primary/60'
              }`}
            >
              {v ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </Card>

      {data.hasServiceWork && (
        <>
          <Card badge="Service Contacts" desc="Client contacts made for servicing purposes this week.">
            <div className="flex flex-col gap-4">
              <NumericField
                label="Total Service Contacts Made"
                name="serviceContacts"
                value={data.serviceContacts}
                onChange={onChange}
                desc="Existing clients or orphans contacted for service this week."
              />
              <NumericField
                label="Premium Collection Meetings"
                name="premiumCollectionMeetings"
                value={data.premiumCollectionMeetings}
                onChange={onChange}
                desc="Meetings specifically for collecting outstanding premium payments."
              />
            </div>
          </Card>

          <Card badge="Policy Changes & Requests" desc="Administrative requests and policy amendments submitted.">
            <div className="flex flex-col gap-4">
              <NumericField
                label="Withdrawal & Loan Requests"
                name="withdrawalsLoans"
                value={data.withdrawalsLoans}
                onChange={onChange}
                desc="Client requests for policy withdrawals or loans submitted."
              />
              <NumericField
                label="Surrender Requests"
                name="surrenders"
                value={data.surrenders}
                onChange={onChange}
                desc="Client requests to surrender their policy submitted."
              />
              <NumericField
                label="Policy Change Forms Submitted"
                name="policyChanges"
                value={data.policyChanges}
                onChange={onChange}
                desc="Amendments — increases, beneficiary changes, address updates, etc."
              />
            </div>
          </Card>

          <Card badge="Reviews & Orphans" desc="Annual reviews and orphan client activity this week.">
            <div className="flex flex-col gap-4">
              <NumericField
                label="Annual Reviews Conducted"
                name="annualReviews"
                value={data.annualReviews}
                onChange={onChange}
                desc="Scheduled annual policy reviews completed with existing clients."
              />
              <NumericField
                label="Orphan Reviews Conducted"
                name="orphanReviews"
                value={data.orphanReviews}
                onChange={onChange}
                desc="Service reviews completed with orphan clients this week."
              />
              <NumericField
                label="Orphans Adopted"
                name="orphansAdopted"
                value={data.orphansAdopted}
                onChange={onChange}
                desc="Orphan clients formally adopted into your portfolio this week."
              />
            </div>
          </Card>

          <Card badge="Reinstatements & Renewals" desc="Lapsed policies reinstated and renewal premiums collected.">
            <div className="flex flex-col gap-4">
              <NumericField
                label="Reinstatement Applications Submitted"
                name="reinstatementsSubmitted"
                value={data.reinstatementsSubmitted}
                onChange={onChange}
                desc="Applications submitted to reinstate a lapsed policy."
              />
              <CurrencyField
                label="Service API Reinstated (TTD)"
                name="reinstatementAPI"
                value={data.reinstatementAPI}
                onChange={onChange}
                desc="Total API of all reinstated policies submitted this week."
              />
              <CurrencyField
                label="Renewal Premiums Collected (TTD)"
                name="renewalPremiumsCollected"
                value={data.renewalPremiumsCollected}
                onChange={onChange}
                desc="Total renewal premium payments collected from clients this week."
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
