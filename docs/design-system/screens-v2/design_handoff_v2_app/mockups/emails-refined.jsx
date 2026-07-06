// Refined email templates — polished, on-brand revisions of:
//   • sunday-nudge   — weekly report opens
//   • monday-nudge   — urgent: 2 hours left
//   • password-reset / welcome
// Plus two obviously-needed companions for the Phase 5 notification system:
//   • submission-received  — confirmation + week-at-a-glance
//   • manager-escalation   — agent missed deadline (sent to upline)
//
// Design system: 4px teal accent bar (or red for urgent), AT monogram lockup,
// eyebrow pill, large display headline (Helvetica Neue), body, metadata strip,
// solid teal CTA, refined footer.

// Shared paddings.
const PAD_X = 36;

function RefinedSundayNudge({ userName = 'Marsha', weekStarting = 'May 25' }) {
  return (
    <EmailFrame accentColor={EMAIL.teal} accentHeight={4}>
      {/* Header — brand lockup */}
      <tr><td style={{ padding: `26px ${PAD_X}px 0` }}>
        <BrandLockup size="md" tone="ink" />
      </td></tr>

      {/* Hero */}
      <tr><td style={{ padding: `28px ${PAD_X}px 0` }}>
        <Eyebrow>Weekly Report</Eyebrow>
        <h1 style={{
          margin: '14px 0 0',
          fontSize: 30,
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: '-0.022em',
          color: EMAIL.ink,
          fontFamily: FONT,
        }}>Your weekly report is open.</h1>
        <p style={{
          margin: '14px 0 0',
          fontSize: 15.5,
          lineHeight: 1.6,
          color: EMAIL.ink,
          fontFamily: FONT,
        }}>
          Hi {userName}, your activity report for the week of <strong style={{ fontWeight: 600 }}>{weekStarting}</strong> is ready to fill in.
          It takes about 5 minutes, and submitting before Monday 9&nbsp;AM keeps your numbers accurate and your manager informed.
        </p>
      </td></tr>

      {/* Metadata strip */}
      <tr><td style={{ padding: `22px ${PAD_X}px 0` }}>
        <MetaStrip items={[
          { label: 'Week of',    value: 'May 25 — May 31' },
          { label: 'Due',        value: 'Mon Jun 2', sub: '9:00 AM AST' },
          { label: 'Last week',  value: 'Submitted', color: EMAIL.success, sub: 'TTD 18,400 API' },
        ]} />
      </td></tr>

      {/* CTA */}
      <tr><td style={{ padding: `22px ${PAD_X}px 4px` }}>
        <CTAButton label="Open weekly report" />
      </td></tr>

      {/* Helper text */}
      <tr><td style={{ padding: `14px ${PAD_X}px 30px` }}>
        <p style={{
          margin: 0,
          fontSize: 12.5,
          lineHeight: 1.55,
          color: EMAIL.inkMute,
          fontFamily: FONT,
        }}>
          Or paste this link into your browser:&nbsp;
          <span style={{ color: EMAIL.teal, wordBreak: 'break-all' }}>agencytrack.vercel.app/wizard</span>
        </p>
      </td></tr>

      <RefinedFooter recipient={`${userName.toLowerCase()}@tatillife.co.tt`} />
    </EmailFrame>
  );
}

function RefinedMondayNudge({ userName = 'Marsha', weekStarting = 'May 25' }) {
  return (
    <EmailFrame accentColor={EMAIL.danger} accentHeight={4}>
      {/* Header */}
      <tr><td style={{ padding: `26px ${PAD_X}px 0` }}>
        <BrandLockup size="md" tone="ink" />
      </td></tr>

      {/* Hero */}
      <tr><td style={{ padding: `28px ${PAD_X}px 0` }}>
        <Eyebrow color={EMAIL.danger} bg={EMAIL.dangerTint} dot>Action Required · Deadline Today</Eyebrow>
        <h1 style={{
          margin: '14px 0 0',
          fontSize: 38,
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: '-0.028em',
          color: EMAIL.ink,
          fontFamily: FONT,
        }}>2 hours left to submit.</h1>
        <p style={{
          margin: '16px 0 0',
          fontSize: 15.5,
          lineHeight: 1.6,
          color: EMAIL.ink,
          fontFamily: FONT,
        }}>
          Hi {userName}, your activity report for the week of <strong style={{ fontWeight: 600 }}>{weekStarting}</strong> is due at
          <strong style={{ fontWeight: 600 }}>&nbsp;9:00 AM today</strong>. Submit before the deadline or your report will be marked late
          and your branch manager will be notified.
        </p>
      </td></tr>

      {/* Metadata strip — danger-styled status */}
      <tr><td style={{ padding: `22px ${PAD_X}px 0` }}>
        <MetaStrip items={[
          { label: 'Week of', value: 'May 25 — May 31' },
          { label: 'Deadline', value: '9:00 AM', sub: 'In ~2 hours' },
          { label: 'Status', value: 'Not submitted', color: EMAIL.danger, sub: 'Late after 9 AM' },
        ]} />
      </td></tr>

      {/* CTA */}
      <tr><td style={{ padding: `22px ${PAD_X}px 4px` }}>
        <CTAButton label="Submit now" color={EMAIL.danger} />
      </td></tr>

      {/* Helper text */}
      <tr><td style={{ padding: `14px ${PAD_X}px 30px` }}>
        <p style={{
          margin: 0,
          fontSize: 12.5,
          lineHeight: 1.55,
          color: EMAIL.inkMute,
          fontFamily: FONT,
        }}>
          Need more time? Reply to this email and your manager will be notified to extend your deadline.
        </p>
      </td></tr>

      <RefinedFooter recipient={`${userName.toLowerCase()}@tatillife.co.tt`} />
    </EmailFrame>
  );
}

function RefinedPasswordReset({ userName = 'Marsha' }) {
  return (
    <EmailFrame accentColor={EMAIL.teal} accentHeight={4}>
      {/* Header */}
      <tr><td style={{ padding: `26px ${PAD_X}px 0` }}>
        <BrandLockup size="md" tone="ink" />
      </td></tr>

      {/* Hero */}
      <tr><td style={{ padding: `28px ${PAD_X}px 0` }}>
        <Eyebrow>Account · Welcome</Eyebrow>
        <h1 style={{
          margin: '14px 0 0',
          fontSize: 30,
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: '-0.022em',
          color: EMAIL.ink,
          fontFamily: FONT,
        }}>Set your password.</h1>
        <p style={{
          margin: '14px 0 0',
          fontSize: 15.5,
          lineHeight: 1.6,
          color: EMAIL.ink,
          fontFamily: FONT,
        }}>
          Hi {userName}, your AgencyTrack account at Tatil Life has been created.
          Choose a password below to sign in and start submitting your weekly activity reports.
        </p>
      </td></tr>

      {/* CTA */}
      <tr><td style={{ padding: `24px ${PAD_X}px 4px` }}>
        <CTAButton label="Set my password" />
      </td></tr>

      {/* Manual link block */}
      <tr><td style={{ padding: `18px ${PAD_X}px 0` }}>
        <div style={{
          background: EMAIL.surfaceSoft,
          border: `1px solid ${EMAIL.border}`,
          borderRadius: 10,
          padding: '14px 16px',
        }}>
          <div style={{
            fontSize: 9.5, fontWeight: 700, color: EMAIL.inkFaint,
            letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6,
            fontFamily: FONT,
          }}>Or paste this link</div>
          <div style={{
            fontSize: 13, color: EMAIL.teal, wordBreak: 'break-all',
            fontFamily: "'JetBrains Mono', 'Menlo', monospace",
          }}>agencytrack.vercel.app/reset?token=8f4a91c2…</div>
        </div>
      </td></tr>

      {/* Security note */}
      <tr><td style={{ padding: `16px ${PAD_X}px 30px` }}>
        <p style={{
          margin: 0,
          fontSize: 12.5,
          lineHeight: 1.55,
          color: EMAIL.inkMute,
          fontFamily: FONT,
        }}>
          This link expires in <strong style={{ color: EMAIL.ink, fontWeight: 600 }}>1 hour</strong>.
          If you didn't expect this email, you can safely ignore it — no account changes were made.
        </p>
      </td></tr>

      <RefinedFooter recipient={`${userName.toLowerCase()}@tatillife.co.tt`} />
    </EmailFrame>
  );
}

function RefinedSubmissionReceived({ userName = 'Marsha', weekStarting = 'May 25' }) {
  // Snapshot stat tile
  const Stat = ({ label, value, sub }) => (
    <td style={{ padding: '14px 14px', width: '25%', verticalAlign: 'top' }}>
      <div style={{
        fontSize: 9.5, fontWeight: 700, color: EMAIL.inkFaint,
        letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6,
        fontFamily: FONT,
      }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 700, color: EMAIL.ink,
        letterSpacing: '-0.02em', lineHeight: 1.1, fontFamily: FONT,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: EMAIL.inkMute, marginTop: 3, fontFamily: FONT }}>{sub}</div>}
    </td>
  );

  return (
    <EmailFrame accentColor={EMAIL.success} accentHeight={4}>
      <tr><td style={{ padding: `26px ${PAD_X}px 0` }}>
        <BrandLockup size="md" tone="ink" />
      </td></tr>

      <tr><td style={{ padding: `28px ${PAD_X}px 0` }}>
        <Eyebrow color={EMAIL.success} bg={EMAIL.successTint}>Report Received</Eyebrow>
        <h1 style={{
          margin: '14px 0 0',
          fontSize: 30, fontWeight: 700, lineHeight: 1.15,
          letterSpacing: '-0.022em', color: EMAIL.ink, fontFamily: FONT,
        }}>Thanks, your week is in.</h1>
        <p style={{
          margin: '14px 0 0',
          fontSize: 15.5, lineHeight: 1.6, color: EMAIL.ink, fontFamily: FONT,
        }}>
          Hi {userName}, we received your activity report for the week of <strong style={{ fontWeight: 600 }}>{weekStarting}</strong> at
          <strong style={{ fontWeight: 600 }}>&nbsp;8:42 AM on Monday Jun 2</strong>. Here's the snapshot your manager will see.
        </p>
      </td></tr>

      {/* Snapshot panel */}
      <tr><td style={{ padding: `22px ${PAD_X}px 0` }}>
        <table role="presentation" width="100%" cellSpacing="0" cellPadding="0" style={{
          borderCollapse: 'collapse', background: EMAIL.surfaceSoft,
          borderRadius: 10, border: `1px solid ${EMAIL.border}`,
        }}>
          <tbody>
            <tr>
              <Stat label="API"   value="TTD 21,800" sub="+18% vs LW" />
              <Stat label="Apps"  value="3" sub="2 lives" />
              <Stat label="FFI"   value="6" sub="4 conducted" />
              <Stat label="CI"    value="4" sub="50% close" />
            </tr>
          </tbody>
        </table>
      </td></tr>

      {/* Secondary CTA — view on dashboard */}
      <tr><td style={{ padding: `22px ${PAD_X}px 4px` }}>
        <CTAButton label="View on dashboard" />
      </td></tr>

      <tr><td style={{ padding: `14px ${PAD_X}px 30px` }}>
        <p style={{
          margin: 0, fontSize: 12.5, lineHeight: 1.55, color: EMAIL.inkMute, fontFamily: FONT,
        }}>
          Spot a mistake? You can re-open this week's report from your dashboard until <strong style={{ color: EMAIL.ink, fontWeight: 600 }}>Wed 5 PM</strong>.
        </p>
      </td></tr>

      <RefinedFooter recipient={`${userName.toLowerCase()}@tatillife.co.tt`} />
    </EmailFrame>
  );
}

function RefinedManagerEscalation({ managerName = 'Trevor', agentName = 'Kareem Mohammed', weekStarting = 'May 25' }) {
  return (
    <EmailFrame accentColor={EMAIL.warning} accentHeight={4}>
      <tr><td style={{ padding: `26px ${PAD_X}px 0` }}>
        <BrandLockup size="md" tone="ink" />
      </td></tr>

      <tr><td style={{ padding: `28px ${PAD_X}px 0` }}>
        <Eyebrow color={EMAIL.warning} bg={EMAIL.warningTint} dot>Team Alert · Missed Deadline</Eyebrow>
        <h1 style={{
          margin: '14px 0 0',
          fontSize: 28, fontWeight: 700, lineHeight: 1.18,
          letterSpacing: '-0.022em', color: EMAIL.ink, fontFamily: FONT,
        }}>{agentName} missed the weekly deadline.</h1>
        <p style={{
          margin: '14px 0 0',
          fontSize: 15.5, lineHeight: 1.6, color: EMAIL.ink, fontFamily: FONT,
        }}>
          Hi {managerName}, {agentName} did not submit a weekly activity report for the week of
          <strong style={{ fontWeight: 600 }}>&nbsp;{weekStarting}</strong>. The deadline passed at 9:00 AM today.
        </p>
      </td></tr>

      {/* Agent context */}
      <tr><td style={{ padding: `22px ${PAD_X}px 0` }}>
        <MetaStrip items={[
          { label: 'Agent',      value: 'K. Mohammed', sub: 'Unit · South 02' },
          { label: 'Week',       value: 'May 25', sub: 'Due Mon 9 AM' },
          { label: 'This quarter', value: '2nd miss', color: EMAIL.danger, sub: '92% on-time YTD' },
        ]} />
      </td></tr>

      {/* CTAs */}
      <tr><td style={{ padding: `22px ${PAD_X}px 4px` }}>
        <table role="presentation" cellSpacing="0" cellPadding="0"><tbody><tr>
          <td style={{ paddingRight: 10 }}>
            <CTAButton label="Open compliance panel" />
          </td>
          <td>
            <table role="presentation" cellSpacing="0" cellPadding="0"><tbody><tr>
              <td style={{
                borderRadius: 8,
                background: EMAIL.surface,
                border: `1px solid ${EMAIL.borderStrong}`,
              }}>
                <a href="#" style={{
                  display: 'inline-block', padding: '13px 22px',
                  fontSize: 14.5, fontWeight: 600, letterSpacing: '0.005em',
                  color: EMAIL.ink, textDecoration: 'none', borderRadius: 8,
                  fontFamily: FONT, lineHeight: 1,
                }}>Send private nudge</a>
              </td>
            </tr></tbody></table>
          </td>
        </tr></tbody></table>
      </td></tr>

      <tr><td style={{ padding: `14px ${PAD_X}px 30px` }}>
        <p style={{
          margin: 0, fontSize: 12.5, lineHeight: 1.55, color: EMAIL.inkMute, fontFamily: FONT,
        }}>
          You will receive one escalation per missed deadline. After 3 misses in a quarter,
          a copy is also sent to the branch manager.
        </p>
      </td></tr>

      <RefinedFooter recipient={`${managerName.toLowerCase()}@tatillife.co.tt`} />
    </EmailFrame>
  );
}

Object.assign(window, {
  RefinedSundayNudge,
  RefinedMondayNudge,
  RefinedPasswordReset,
  RefinedSubmissionReceived,
  RefinedManagerEscalation,
});
