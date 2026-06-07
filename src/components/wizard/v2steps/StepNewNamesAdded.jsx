import React, { useMemo } from 'react';
import { Card, NumericField, ReadOnlyField, SuggestedField } from '../CardStack';

/**
 * Wizard v2 step 5 — New names added.
 *
 * v2 extraction of the legacy Step5NewNames component (retirement R3).
 * Faithful 1:1 port — same persisted keys (referralsSought /
 * referralsObtained / namesFromColdCanvass / namesFromOther / oldNamesPool /
 * portfolioClientsIdentified), same direct on-change, same lastWeek-derived
 * `suggestedPool` (= max(0, lastWeek.oldNamesPool + new names − calls used)),
 * same auto-pulled "From Events" ReadOnly fields, same totalNewNames banner.
 * Consumes `lastWeekData` exactly as the legacy step did (wizard passes it via
 * the `needsLastWeekData` flag).
 */
export default function StepNewNamesAdded({ data = {}, onChange, lastWeekData }) {
  const totalFromEvents = useMemo(
    () =>
      (data.namesFromSeminarsConducted ?? 0) +
      (data.namesFromSeminarsAttended ?? 0) +
      (data.namesFromTradeshowsConducted ?? 0) +
      (data.namesFromTradeshowsAttended ?? 0),
    [
      data.namesFromSeminarsConducted,
      data.namesFromSeminarsAttended,
      data.namesFromTradeshowsConducted,
      data.namesFromTradeshowsAttended,
    ]
  );

  const suggestedPool = useMemo(() => {
    const lastPool = lastWeekData?.oldNamesPool ?? 0;
    const newNames =
      (data.referralsObtained ?? 0) +
      (data.namesFromColdCanvass ?? 0) +
      (data.namesFromOther ?? 0) +
      totalFromEvents;
    const callsUsed =
      (data.referralCalls ?? 0) +
      (data.followUpCalls ?? 0) +
      (data.coldCalls ?? 0) +
      (data.seminarTradeshowCalls ?? 0);
    return Math.max(0, lastPool + newNames - callsUsed);
  }, [
    lastWeekData?.oldNamesPool,
    data.referralsObtained,
    data.namesFromColdCanvass,
    data.namesFromOther,
    totalFromEvents,
    data.referralCalls,
    data.followUpCalls,
    data.coldCalls,
    data.seminarTradeshowCalls,
  ]);

  const totalNewNames = useMemo(
    () =>
      (data.referralsObtained ?? 0) +
      (data.namesFromColdCanvass ?? 0) +
      (data.namesFromOther ?? 0) +
      totalFromEvents,
    [data.referralsObtained, data.namesFromColdCanvass, data.namesFromOther, totalFromEvents]
  );

  return (
    <div className="flex flex-col gap-4">
      <Card badge="Referrals" desc="Names obtained from existing clients and contacts this week.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="Referrals Sought"
            name="referralsSought"
            value={data.referralsSought}
            onChange={onChange}
            desc="Number of times you asked a client or contact for a referral."
          />
          <NumericField
            label="Referrals Obtained"
            name="referralsObtained"
            value={data.referralsObtained}
            onChange={onChange}
            desc="Actual names received from referral requests this week."
          />
        </div>
      </Card>

      <Card badge="From Events" desc="Names auto-pulled from your seminar and tradeshow entries in Step 1.">
        <div className="flex flex-col gap-4">
          <ReadOnlyField
            label="From Seminars Conducted"
            value={data.namesFromSeminarsConducted ?? 0}
          />
          <ReadOnlyField
            label="From Seminars Attended"
            value={data.namesFromSeminarsAttended ?? 0}
          />
          <ReadOnlyField
            label="From Tradeshows Conducted"
            value={data.namesFromTradeshowsConducted ?? 0}
          />
          <ReadOnlyField
            label="From Tradeshows Attended"
            value={data.namesFromTradeshowsAttended ?? 0}
          />
        </div>
      </Card>

      <Card badge="Other Sources" desc="Names obtained through cold canvassing or other means.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="Names from Cold Canvass"
            name="namesFromColdCanvass"
            value={data.namesFromColdCanvass}
            onChange={onChange}
            desc="Names collected through door-to-door or direct cold outreach."
          />
          <NumericField
            label="Names from Other Sources"
            name="namesFromOther"
            value={data.namesFromOther}
            onChange={onChange}
            desc="Names from any other source not covered above."
          />
        </div>
      </Card>

      <Card badge="Names Pool" desc="Running total of prospects available to contact.">
        <div className="flex flex-col gap-4">
          <SuggestedField
            label="Old Names Pool (Carry-Over)"
            name="oldNamesPool"
            value={data.oldNamesPool}
            onChange={onChange}
            suggestion={suggestedPool}
            note="based on last week + new names − calls made"
            desc="Total names from previous weeks not yet approached."
          />
          <NumericField
            label="Portfolio Clients Identified"
            name="portfolioClientsIdentified"
            value={data.portfolioClientsIdentified}
            onChange={onChange}
            desc="Existing clients identified as opportunities for additional products."
          />
        </div>
      </Card>

      {totalNewNames > 0 && (
        <Card variant="teal">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-primary">New Names Added This Week</span>
            <span className="text-2xl font-bold text-primary">{totalNewNames}</span>
          </div>
        </Card>
      )}
    </div>
  );
}
