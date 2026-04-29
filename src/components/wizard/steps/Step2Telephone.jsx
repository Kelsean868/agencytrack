import { useMemo } from 'react';
import { Card, NumericField } from '../CardStack';

export default function Step2Telephone({ data, onChange }) {
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
    </div>
  );
}
