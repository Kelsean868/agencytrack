// History v2 — shared model, sample data, anchor strip, year heatmap.
//
// The repo's History tab today is a flat card list with status pills and an
// eye-icon drill. v2 makes the year visible at a glance, anchors the page
// in YTD totals + streak + best week, and lets users filter, search, and
// spot exception weeks (drafts, unlocked) without opening the drawer.

// ──────────────────────────────────────────────────────────────────────────
// Sample year — 47 submitted weeks of 2026 + WK 48 in flight.
// Deterministic generation so screenshots are stable.
// ──────────────────────────────────────────────────────────────────────────
function _seeded(i) {
  // simple deterministic pseudo-noise in [0,1)
  const x = Math.sin((i + 1) * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}
function _weekStartingFor(weekNum) {
  // Compute the Sunday for weekNum (1-based) of 2026.
  // 2026 starts on Thursday, so week 1's Sunday = Jan 4.
  const baseSunday = new Date(Date.UTC(2026, 0, 4));
  baseSunday.setUTCDate(baseSunday.getUTCDate() + (weekNum - 1) * 7);
  const d = baseSunday;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function _monthShort(weekNum) {
  const d = new Date(Date.UTC(2026, 0, 4));
  d.setUTCDate(d.getUTCDate() + (weekNum - 1) * 7);
  return ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getUTCMonth()];
}

const HIST_WEEK_TARGET = 18000; // weekly API floor

function buildHistorySample() {
  const weeks = [];
  for (let wk = 1; wk <= 48; wk++) {
    const noise = _seeded(wk);
    // shape API: ramp up early year, hot midyear, dip late summer, climb back
    const monthBoost = Math.sin((wk / 52) * Math.PI * 2) * 0.5 + 0.7; // 0.2..1.2
    const baseApi = HIST_WEEK_TARGET * (0.55 + monthBoost * 0.8 + noise * 0.3);
    let api = Math.round(baseApi / 100) * 100;
    let apps = Math.max(1, Math.round(api / 8400 + (noise - 0.5)));
    let cis = Math.max(apps, Math.round(apps * (1.5 + noise)));
    let calls = Math.max(15, Math.round(cis * (8 + noise * 6)));
    let ffi = Math.max(2, Math.round(cis * (1.4 + noise * 0.6)));
    let overall = Math.max(4, Math.min(10, Math.round(api / 4000)));
    let status = 'submitted';
    let isAwardEligible = api >= HIST_WEEK_TARGET && noise < 0.7;
    let isBest = false;
    let unlockedBy = null;

    // overrides for narrative beats
    if (wk === 44) {           // BEST WEEK — hottest sale of the year
      api = 28100; apps = 4; cis = 5; calls = 52; ffi = 6; overall = 9;
      isAwardEligible = true; isBest = true;
    }
    if (wk === 45) {           // UNLOCKED — manager unlocked, agent hasn't resubmitted
      api = 8000; apps = 1; cis = 1; calls = 21; ffi = 2; overall = 5;
      isAwardEligible = false; status = 'unlocked'; unlockedBy = 'T. Ramcharan';
    }
    if (wk === 46) {           // DRAFT — partially filled in this week, never finished
      api = 14200; apps = 2; cis = 2; calls = 31; ffi = 3; overall = 6;
      isAwardEligible = false;
    }
    if (wk === 47) {           // SUBMITTED — last good week
      api = 24400; apps = 3; cis = 4; calls = 47; ffi = 5; overall = 8;
      isAwardEligible = true;
    }
    if (wk === 48) {           // IN FLIGHT — current week, draft
      api = 18400; apps = 2; cis = 3; calls = 38; ffi = 4; overall = 0;
      status = 'draft'; isAwardEligible = false;
    }
    if (wk === 13 || wk === 27) {  // a couple of mid-year drafts to surface in the heatmap
      status = 'draft'; api = Math.round(api * 0.6 / 100) * 100; isAwardEligible = false;
    }

    weeks.push({
      week: wk,
      weekStarting: _weekStartingFor(wk),
      month: _monthShort(wk),
      api, apps, cis, calls, ffi,
      overall,
      status, isAwardEligible, isBest, unlockedBy,
      note: wk === 47 ? 'Eagles Club pacer week — referrals from the Persaud family converted.' : null,
    });
  }
  return weeks;
}

const HIST_WEEKS = buildHistorySample();

// Derived anchor stats
function buildHistoryAnchor(weeks, target) {
  const submitted = weeks.filter(w => w.status === 'submitted');
  const drafts    = weeks.filter(w => w.status === 'draft');
  const unlocked  = weeks.filter(w => w.status === 'unlocked');
  const award     = submitted.filter(w => w.isAwardEligible);
  const ytdApi    = submitted.reduce((s, w) => s + w.api, 0);

  // Longest streak — consecutive submitted weeks anywhere in the year
  let streak = 0, longest = 0;
  for (const w of weeks) {
    if (w.status === 'submitted') { streak++; longest = Math.max(longest, streak); }
    else streak = 0;
  }

  // Current streak — consecutive submitted weeks ending at the most recent
  // SUBMITTED week (we exclude the current in-flight draft so the streak
  // doesn't artificially read as 0 just because this week isn't done yet).
  const sortedByWeek = [...weeks].sort((a, b) => b.week - a.week);
  let current = 0;
  let foundFirstSubmitted = false;
  for (const w of sortedByWeek) {
    if (!foundFirstSubmitted) {
      // Skip leading non-submitted weeks (the current draft, etc.)
      if (w.status === 'submitted') {
        foundFirstSubmitted = true;
        current = 1;
      }
    } else {
      if (w.status === 'submitted') current++;
      else break;
    }
  }

  const bestWeek = submitted.reduce((a, b) => (b.api > a.api ? b : a), submitted[0]);
  const avgApi = submitted.length ? Math.round(ytdApi / submitted.length / 100) * 100 : 0;
  return {
    ytdApi, weeksSubmitted: submitted.length, drafts: drafts.length, unlocked: unlocked.length,
    awardEligible: award.length, longestStreak: longest, currentStreak: current,
    bestWeek, avgApi,
    streakToRecord: Math.max(0, longest - current),
    atPersonalBest: current >= longest && longest > 0,
  };
}

const HIST_ANCHOR = buildHistoryAnchor(HIST_WEEKS, HIST_WEEK_TARGET);
const HIST_AGENT = 'Marsha Singh';

// Manager view
const HIST_MANAGER = {
  name: 'T. Ramcharan',
  role: 'Unit Manager',
};

// Helpers
function fmtTtdK(n) {
  if (n >= 1_000_000) return `TTD ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000)    return `TTD ${(n / 1000).toFixed(0)}K`;
  if (n >= 1000)      return `TTD ${(n / 1000).toFixed(1)}K`;
  return `TTD ${Math.round(n).toLocaleString()}`;
}
function fmtTtdShort(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000)    return `${(n / 1000).toFixed(0)}K`;
  if (n >= 1000)      return `${(n / 1000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}
function weekLabel(w) {
  // "Wk 47 · Sun 16 Nov"
  const d = new Date(w.weekStarting + 'T12:00:00Z');
  const day = d.toLocaleDateString('en-TT', { day: '2-digit', month: 'short' });
  return `Wk ${String(w.week).padStart(2,'0')} · Sun ${day}`;
}

// ──────────────────────────────────────────────────────────────────────────
// HistoryAnchorStrip — YTD hero + chip row of streak / best / drafts / etc.
// ──────────────────────────────────────────────────────────────────────────
function HistoryAnchorStrip({ t, anchor, year, agent, mobile = false }) {
  const goalApi = HIST_WEEK_TARGET * 52;
  const pct = Math.min(100, Math.round((anchor.ytdApi / goalApi) * 100));
  return (
    <div className="a-card a-rise" style={{
      position: 'relative', overflow: 'hidden',
      padding: mobile ? '14px 16px' : '18px 22px',
      flexShrink: 0,
      background: t.surface, border: `1px solid ${t.teal}55`, borderRadius: 14,
      boxShadow: `0 6px 18px ${t.mode === 'light' ? 'rgba(1,105,111,0.08)' : 'rgba(0,0,0,0.4)'}`,
    }}>
      <div className="a-glow-soft" style={{
        position: 'absolute', top: -70, right: -70, width: 240, height: 240,
        background: `radial-gradient(circle, ${t.tealTint} 0%, transparent 65%)`,
        pointerEvents: 'none',
      }}></div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <Eyebrow t={t} color={t.teal}>YOUR YEAR · {year} · {anchor.weeksSubmitted} of 52 WEEKS SUBMITTED</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
            <div style={{
              fontSize: mobile ? 36 : 44, fontWeight: 700, color: t.ink,
              letterSpacing: '-0.028em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1,
            }}>{fmtTtdK(anchor.ytdApi)}</div>
            <div style={{ fontSize: 11, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>
              YTD API · AVG {fmtTtdK(anchor.avgApi)}/WK
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 6, lineHeight: 1.45 }}>
            On track for <b style={{ color: t.ink }}>{fmtTtdK(Math.round((anchor.ytdApi / anchor.weeksSubmitted) * 52))}</b> if the pace holds through year-end.
          </div>
        </div>
        {!mobile && (
          <div style={{ textAlign: 'right' }}>
            <Eyebrow t={t} color={t.gold}>YEAR-END TARGET</Eyebrow>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.022em', lineHeight: 1, marginTop: 6 }}>
              {fmtTtdK(goalApi)}
            </div>
            <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 5, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>{pct}% of pace</div>
          </div>
        )}
      </div>

      <div style={{ position: 'relative', marginTop: 14, height: 8, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
        <div className="a-progress-grow" style={{
          width: `${pct}%`, height: 8,
          background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`,
          borderRadius: 999, transformOrigin: 'left center',
        }}></div>
      </div>

      {/* Chip row */}
      <div style={{ position: 'relative', display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {/* Streak — beefed up double-stat chip with flame icon */}
        <div style={{
          padding: '8px 12px',
          background: anchor.atPersonalBest ? t.goldTint : t.surfaceSoft,
          border: `1px solid ${anchor.atPersonalBest ? t.gold + '55' : t.rule}`,
          borderRadius: 9, display: 'flex', alignItems: 'center', gap: 10,
          position: 'relative', overflow: 'hidden',
        }}>
          {anchor.atPersonalBest && (
            <div className="a-glow-soft" style={{
              position: 'absolute', inset: -10, borderRadius: 12,
              background: `radial-gradient(circle, ${t.goldTint} 0%, transparent 60%)`,
              pointerEvents: 'none',
            }}></div>
          )}
          {/* Flame */}
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: anchor.currentStreak > 0
              ? `linear-gradient(180deg, ${t.gold}, ${t.warning})`
              : t.surfaceMute,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', flexShrink: 0, position: 'relative',
            boxShadow: anchor.currentStreak > 0 ? `0 2px 6px ${t.warning}55` : 'none',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" stroke="none">
              <path d="M12 2c-1 4-4 5-4 9 0 3 2 5 4 5s4-2 4-5c0-1 0-2 1-3 1 2 3 4 3 7 0 4-3 7-7 7-3.8 0-7-3-7-7 0-5 4-7 6-13z" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: anchor.atPersonalBest ? t.gold : t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.14em' }}>
                {anchor.atPersonalBest ? 'PERSONAL BEST · LIVE' : 'STREAK'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
              <span style={{
                fontSize: 16, fontWeight: 700, color: t.ink,
                fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.018em', lineHeight: 1,
              }}>{anchor.currentStreak}</span>
              <span style={{ fontSize: 9, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>wks now</span>
              <span style={{ fontSize: 9, color: t.inkDim, fontFamily: APP_FONT_MONO }}>·</span>
              <span style={{
                fontSize: 14, fontWeight: 700, color: t.gold,
                fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em', lineHeight: 1,
              }}>{anchor.longestStreak}</span>
              <span style={{ fontSize: 9, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>best</span>
            </div>
            {!anchor.atPersonalBest && anchor.streakToRecord > 0 && (
              <div style={{ fontSize: 9, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em', marginTop: 3 }}>
                {anchor.streakToRecord} wks to record
              </div>
            )}
            {anchor.atPersonalBest && (
              <div style={{ fontSize: 9, color: t.gold, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em', marginTop: 3, fontWeight: 700 }}>
                ★ NEW PERSONAL BEST
              </div>
            )}
          </div>
        </div>

        {/* Other chips */}
        {[
          { eye: 'BEST WEEK',       val: fmtTtdK(anchor.bestWeek.api),  tone: t.gold, link: `Wk ${anchor.bestWeek.week}` },
          { eye: 'AWARD WEEKS',     val: `${anchor.awardEligible}`,     tone: t.gold },
          { eye: 'DRAFTS',          val: `${anchor.drafts}`,            tone: anchor.drafts > 0 ? t.warning : t.inkMute },
          { eye: 'UNLOCKED',        val: `${anchor.unlocked}`,          tone: anchor.unlocked > 0 ? t.warning : t.inkMute },
        ].map((c, i) => (
          <div key={i} style={{
            padding: '7px 11px', background: t.surfaceSoft, border: `1px solid ${t.rule}`,
            borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: c.tone, flexShrink: 0 }}></div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.12em' }}>{c.eye}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em', marginTop: 2 }}>
                {c.val}{c.link && <span style={{ fontSize: 9, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginLeft: 5 }}>· {c.link}</span>}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Find start..end (1-based week numbers, inclusive) of the longest streak
function findLongestStreakRange(weeks) {
  let bestLen = 0, bestStart = 0, bestEnd = 0;
  let curStart = 0, curLen = 0;
  for (const w of weeks) {
    if (w.status === 'submitted') {
      if (curLen === 0) curStart = w.week;
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
        bestEnd = w.week;
      }
    } else {
      curLen = 0;
    }
  }
  return { start: bestStart, end: bestEnd, length: bestLen };
}

// ──────────────────────────────────────────────────────────────────────────
// YearHeatmap — 52 small squares, one per week. Color intensity = API vs
// target. Award-eligible weeks get a gold halo. Drafts/unlocked use border
// markers. Month labels above show the boundaries. A gold underline marks
// the longest submission streak run.
// ──────────────────────────────────────────────────────────────────────────
function YearHeatmap({ t, weeks, target, focusedWeek = null, mobile = false }) {
  const sq = mobile ? 13 : 17;
  const gap = mobile ? 2 : 3;
  // Find month boundaries — when month changes between consecutive weeks
  const monthBoundaries = [];
  let lastMonth = null;
  weeks.forEach((w, i) => {
    if (w.month !== lastMonth) {
      monthBoundaries.push({ index: i, month: w.month });
      lastMonth = w.month;
    }
  });
  const longestRange = findLongestStreakRange(weeks);

  function colorFor(w) {
    if (!w) return t.surfaceMute;
    if (w.status === 'unlocked') return t.warningTint;
    if (w.status === 'draft' && w.week !== 48) return t.surfaceMute;
    // Current week (48) – pulsing teal
    if (w.week === 48) return t.tealTint;
    // Intensity scale
    const ratio = Math.min(1.4, w.api / target);
    if (ratio >= 1.2) return t.teal;
    if (ratio >= 1.0) return t.teal + 'CC';
    if (ratio >= 0.8) return t.teal + '88';
    if (ratio >= 0.6) return t.teal + '55';
    return t.teal + '33';
  }

  const totalCols = 52;
  const longestPxStart = (longestRange.start - 1) * (sq + gap);
  const longestPxWidth = (longestRange.length * sq) + ((longestRange.length - 1) * gap);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Month label row */}
      <div style={{ position: 'relative', height: 14 }}>
        {monthBoundaries.map((m, i) => (
          <span key={i} style={{
            position: 'absolute', left: m.index * (sq + gap),
            fontSize: 9, fontWeight: 700, color: t.inkFaint,
            fontFamily: APP_FONT_MONO, letterSpacing: '0.1em',
          }}>{m.month}</span>
        ))}
      </div>
      {/* Squares */}
      <div style={{ position: 'relative', display: 'flex', gap, alignItems: 'center', flexWrap: 'nowrap' }}>
        {Array.from({ length: totalCols }).map((_, i) => {
          const w = weeks[i];  // may be undefined for future weeks
          const isFocused = focusedWeek && w?.week === focusedWeek;
          return (
            <div key={i} style={{
              position: 'relative',
              width: sq, height: sq, flexShrink: 0,
              background: colorFor(w),
              borderRadius: 3,
              border: w?.status === 'unlocked' ? `1.5px solid ${t.warning}` : w?.status === 'draft' && w.week !== 48 ? `1px dashed ${t.ruleStrong}` : 'none',
              boxShadow: isFocused ? `0 0 0 2px ${t.ink}` : 'none',
              cursor: w ? 'pointer' : 'default',
            }}>
              {/* Gold dot for award-eligible */}
              {w?.isAwardEligible && (
                <div style={{
                  position: 'absolute', top: -2, right: -2,
                  width: 5, height: 5, borderRadius: '50%',
                  background: t.gold, border: `1px solid ${t.surface}`,
                }}></div>
              )}
              {/* Best week — gold ring */}
              {w?.isBest && (
                <div className="a-glow-soft" style={{
                  position: 'absolute', inset: -3, borderRadius: 5,
                  border: `1.5px solid ${t.gold}`, pointerEvents: 'none',
                }}></div>
              )}
              {/* Current week — breathing teal */}
              {w?.week === 48 && (
                <div className="a-breathe" style={{
                  position: 'absolute', inset: 0, borderRadius: 3,
                  border: `1.5px solid ${t.teal}`, pointerEvents: 'none',
                }}></div>
              )}
            </div>
          );
        })}
        {/* Longest-streak underline */}
        {longestRange.length >= 3 && (
          <div style={{
            position: 'absolute', left: longestPxStart, bottom: -6,
            width: longestPxWidth, height: 3,
            background: `linear-gradient(90deg, ${t.gold}AA, ${t.gold})`,
            borderRadius: 2,
            boxShadow: `0 1px 4px ${t.gold}55`,
          }}></div>
        )}
      </div>
      {/* Streak callout */}
      {longestRange.length >= 3 && (
        <div style={{
          position: 'relative', marginTop: 4, fontSize: 9.5,
          color: t.gold, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em',
          left: longestPxStart, width: longestPxWidth,
          textAlign: 'center', fontWeight: 700,
        }}>
          ★ {longestRange.length}-WK BEST · WK {String(longestRange.start).padStart(2,'0')}–{String(longestRange.end).padStart(2,'0')}
        </div>
      )}
      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
        {[
          { color: t.teal + '33', label: '< 60% target' },
          { color: t.teal + '88', label: '60–100%' },
          { color: t.teal,        label: '≥ 100%' },
        ].map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: l.color }}></div>
            <span style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>{l.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 9, height: 9, borderRadius: 2, background: 'transparent', border: `1.5px dashed ${t.ruleStrong}` }}></div>
          <span style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>DRAFT</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 9, height: 9, borderRadius: 2, background: t.warningTint, border: `1.5px solid ${t.warning}` }}></div>
          <span style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>UNLOCKED</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: t.gold }}></div>
          <span style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>AWARD-ELIGIBLE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 14, height: 3, borderRadius: 2, background: t.gold }}></div>
          <span style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>LONGEST STREAK</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  HIST_AGENT, HIST_MANAGER, HIST_WEEKS, HIST_ANCHOR, HIST_WEEK_TARGET,
  fmtTtdK, fmtTtdShort, weekLabel,
  HistoryAnchorStrip, YearHeatmap,
});
