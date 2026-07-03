import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, NumericField } from '../CardStack';
import { SOCIAL_PLATFORMS } from './socialMediaConstants';

/**
 * Wizard v2 step 4 — Social & content.
 *
 * v2 extraction of the legacy StepSocialMedia component (retirement R3).
 * Faithful 1:1 port — same persisted keys (socialPostsTotal /
 * socialEngagementTotal / socialInboxEnquiries / namesFromSocial flat +
 * socialPlatformBreakdown.{facebook,instagram,whatsapp,linkedin} nested),
 * same direct on-change for the flat fields, same nested-spread
 * `handleBreakdownChange` writer, same collapsible platform-breakdown.
 */

const PLATFORM_LABELS = {
  facebook:  'Facebook',
  instagram: 'Instagram',
  whatsapp:  'WhatsApp',
  linkedin:  'LinkedIn',
};

export default function StepSocialContent({ data = {}, onChange }) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const breakdown = data.socialPlatformBreakdown ?? {};

  function handleBreakdownChange(platform, value) {
    onChange('socialPlatformBreakdown', {
      ...breakdown,
      [platform]: value,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card
        badge="Social & Content"
        desc="Content published, engagement received, inbox enquiries, and new names sourced via social this week."
      >
        <div className="flex flex-col gap-4">
          <NumericField
            label="Posts Published"
            name="socialPostsTotal"
            value={data.socialPostsTotal}
            onChange={onChange}
          />
          <NumericField
            label="Engagement (Likes + Comments)"
            name="socialEngagementTotal"
            value={data.socialEngagementTotal}
            onChange={onChange}
          />
          <NumericField
            label="Inbox Enquiries"
            name="socialInboxEnquiries"
            value={data.socialInboxEnquiries}
            onChange={onChange}
            desc="DMs or enquiries that turned into conversations."
          />
          <NumericField
            label="Names from Social"
            name="namesFromSocial"
            value={data.namesFromSocial}
            onChange={onChange}
            desc="New names obtained via social media this week."
          />

          {/* Platform breakdown toggle */}
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-primary self-start"
            aria-expanded={showBreakdown}
          >
            {showBreakdown ? (
              <ChevronUp className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            )}
            {showBreakdown ? 'Hide platform breakdown' : 'Show platform breakdown'}
          </button>

          {showBreakdown && (
            <div className="flex flex-col gap-4 pl-2 border-l-2 border-border/40">
              {SOCIAL_PLATFORMS.map((platform) => (
                <NumericField
                  key={platform}
                  label={PLATFORM_LABELS[platform]}
                  name={platform}
                  value={breakdown[platform] ?? 0}
                  onChange={(_name, value) => handleBreakdownChange(platform, value)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
