// Leaderboard screen — ports the kiosk's centerpiece podium layout into the
// app at daily-use scale. Desktop + mobile, light + dark.

const LB_AGENTS = [
  { rank: 1, name: 'Marsha Singh',    unit: 'S·02', api: 487000, apps: 41 },
  { rank: 2, name: 'Anand Persad',    unit: 'S·01', api: 442000, apps: 36 },
  { rank: 3, name: 'Selina Mohammed', unit: 'S·03', api: 396000, apps: 38 },
  { rank: 4, name: 'Riaz Khan',       unit: 'S·02', api: 358000, apps: 30 },
  { rank: 5, name: 'Kamla Singh',     unit: 'S·01', api: 312000, apps: 27 },
  { rank: 6, name: 'Trevor Ramnauth', unit: 'S·03', api: 287000, apps: 24 },
  { rank: 7, name: 'Avinash Maharaj', unit: 'S·02', api: 254000, apps: 22 },
  { rank: 8, name: 'Hema Lakhan',     unit: 'S·01', api: 231000, apps: 21 },
];

const LB_PERIODS = [
  { k: 'WK',  label: 'Week' },
  { k: 'MTD', label: 'Month' },
  { k: 'QTD', label: 'Quarter' },
  { k: 'YTD', label: 'Year', active: true },
];

// Gold / silver / bronze radial gradient (matches kiosk Medal component)
function medalGrad(rank) {
  if (rank === 1) return 'radial-gradient(circle at 32% 28%, #fde68a 0%, #f59e0b 50%, #b45309 100%)';
  if (rank === 2) return 'radial-gradient(circle at 32% 28%, #f1f5f9 0%, #94a3b8 50%, #475569 100%)';
  return 'radial-gradient(circle at 32% 28%, #fed7aa 0%, #c08d6b 50%, #92400e 100%)';
}
function medalGlowColor(rank, t) {
  if (rank === 1) return 'rgba(245, 158, 11, 0.45)';
  if (rank === 2) return 'rgba(148, 163, 184, 0.4)';
  return 'rgba(192, 141, 107, 0.4)';
}

function MedalCoin({ rank, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: medalGrad(rank),
      color: 'white', fontWeight: 800, fontSize: size * 0.4,
      letterSpacing: '-0.04em', fontFamily: APP_FONT_DISPLAY,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `inset 0 -2px 4px rgba(0,0,0,0.18), inset 0 2px 4px rgba(255,255,255,0.4)`,
      position: 'relative', flexShrink: 0,
      textShadow: '0 1px 2px rgba(0,0,0,0.25)',
    }}>
      <span style={{ position: 'relative', zIndex: 1 }}>{rank}</span>
      <span style={{
        position: 'absolute', top: '6%', left: '18%', width: '38%', height: '24%',
        borderRadius: '50%', background: 'rgba(255,255,255,0.42)', filter: 'blur(2px)',
      }}></span>
    </div>
  );
}

function PeriodChips({ t, periods }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
      {periods.map(p => (
        <div key={p.k} style={{
          padding: '7px 14px', borderRadius: 7,
          fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em',
          background: p.active ? t.teal : 'transparent',
          color: p.active ? '#fff' : t.inkMute,
          fontFamily: APP_FONT_MONO,
          boxShadow: p.active ? `0 2px 6px ${t.teal}44` : 'none',
          transition: 'all 200ms ease',
        }}>{p.k}</div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// DESKTOP — full podium + tail
// ──────────────────────────────────────────────────────────────────────────
function LeaderboardDesktop({ t }) {
  const podium = LB_AGENTS.slice(0, 3);
  const tail   = LB_AGENTS.slice(3, 8);
  const maxApi = LB_AGENTS[0].api;

  return (
    <AppShell t={t} active="awards" title="Leaderboard" subtitle="South Branch · Year to date · 28 agents">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Header — title block + period chips */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <Eyebrow t={t} color={t.gold}>★ Top of the board · YTD</Eyebrow>
            <div style={{ fontSize: 28, fontWeight: 700, color: t.ink, letterSpacing: '-0.022em', fontFamily: APP_FONT_DISPLAY, marginTop: 6 }}>
              Who's leading the year.
            </div>
          </div>
          <PeriodChips t={t} periods={LB_PERIODS} />
        </div>

        {/* Podium — 3 hero cards, center #1 elevated */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr 1fr', gap: 14, alignItems: 'end' }}>
          {[podium[1], podium[0], podium[2]].map((a, i) => {
            const isCenter = i === 1;
            const trueRank = a.rank;
            const glow = medalGlowColor(trueRank, t);
            return (
              <div key={a.rank} className={'a-card a-scale-in a-d-' + (i + 1)} style={{
                padding: isCenter ? '20px 22px' : '16px 18px',
                background: t.surface,
                border: `1px solid ${trueRank === 1 ? t.gold + '55' : t.rule}`,
                borderRadius: 14,
                position: 'relative', overflow: 'hidden',
                transform: isCenter ? 'translateY(-8px)' : 'translateY(0)',
                boxShadow: isCenter
                  ? `0 12px 28px ${glow}, 0 0 0 1px ${t.gold}33 inset`
                  : `0 4px 12px ${glow}33`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              }}>
                {/* Corner glow */}
                <div style={{
                  position: 'absolute', top: -50, right: -50, width: 200, height: 200,
                  background: `radial-gradient(circle, ${glow}, transparent 65%)`,
                  pointerEvents: 'none', opacity: 0.8,
                }}></div>

                {/* Medal + label */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MedalCoin rank={trueRank} size={isCenter ? 32 : 26} />
                  <div style={{
                    fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em',
                    color: trueRank === 1 ? t.gold : t.inkMute,
                    textTransform: 'uppercase', fontFamily: APP_FONT_MONO,
                  }}>
                    {trueRank === 1 ? 'Champion' : trueRank === 2 ? 'Runner-up' : 'Third place'}
                  </div>
                </div>

                {/* Avatar with halo on #1 */}
                <div style={{ position: 'relative', marginTop: 14 }}>
                  {trueRank === 1 && (
                    <div className="a-glow-soft" style={{
                      position: 'absolute', inset: -10,
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
                      pointerEvents: 'none',
                    }}></div>
                  )}
                  <div style={{
                    width: isCenter ? 60 : 48, height: isCenter ? 60 : 48, borderRadius: '50%',
                    background: t.tealTint, color: t.teal,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: isCenter ? 17 : 14, fontFamily: APP_FONT_DISPLAY,
                    border: `2px solid ${trueRank === 1 ? t.gold : trueRank === 2 ? '#94a3b8' : '#c08d6b'}`,
                    boxShadow: trueRank === 1 ? `0 0 16px ${glow}` : `0 0 8px ${glow}`,
                    position: 'relative',
                  }}>{a.name.split(' ').map(s => s[0]).join('')}</div>
                </div>

                <div style={{
                  marginTop: 12, fontSize: isCenter ? 18 : 16, fontWeight: 700,
                  color: t.ink, letterSpacing: '-0.012em', fontFamily: APP_FONT_DISPLAY,
                  position: 'relative',
                }}>{a.name}</div>
                <div style={{
                  fontSize: 10.5, color: t.inkFaint, marginTop: 3,
                  fontFamily: APP_FONT_MONO, letterSpacing: '0.06em',
                  position: 'relative',
                }}>{a.unit}</div>

                <div style={{
                  marginTop: 12, fontSize: isCenter ? 24 : 20, fontWeight: 700,
                  color: trueRank === 1 ? t.gold : t.teal,
                  fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.022em', lineHeight: 1,
                  position: 'relative',
                }}>{ttd(a.api)}</div>
                <div style={{
                  fontSize: 10.5, color: t.inkFaint, marginTop: 4,
                  fontFamily: APP_FONT_MONO, letterSpacing: '0.06em',
                  position: 'relative',
                }}>{a.apps} APPS</div>
              </div>
            );
          })}
        </div>

        {/* Tail — ranks 4-8 */}
        <div style={{
          background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12,
          overflow: 'hidden', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '11px 18px', borderBottom: `1px solid ${t.rule}`, background: t.surfaceSoft }}>
            <Eyebrow t={t} color={t.inkMute}>Ranks 4 – 8</Eyebrow>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {tail.map((a, i) => (
              <div key={a.rank} className={'a-fade-up a-d-' + (i + 4)} style={{
                display: 'grid', gridTemplateColumns: '40px 1.5fr 0.7fr 1.4fr 0.6fr',
                alignItems: 'center', padding: '10px 18px',
                borderBottom: i < tail.length - 1 ? `1px solid ${t.rule}` : 'none',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_DISPLAY, textAlign: 'center' }}>{a.rank}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: t.tealTint,
                    color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 11.5, fontFamily: APP_FONT_DISPLAY,
                  }}>{a.name.split(' ').map(s => s[0]).join('')}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.ink }}>{a.name}</div>
                    <div style={{ fontSize: 10.5, color: t.inkFaint, marginTop: 1, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>{a.unit}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: t.inkMute, textAlign: 'right', fontFamily: APP_FONT_MONO }}>{a.apps} apps</div>
                <div style={{ padding: '0 16px' }}>
                  <div style={{ height: 4, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                    <div className="a-progress-grow" style={{ width: `${(a.api / maxApi) * 100}%`, height: 4, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius: 999 }}></div>
                  </div>
                </div>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: t.teal, textAlign: 'right',
                  fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em',
                }}>{ttd(a.api)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MOBILE — #1 hero card + #2/#3 side-by-side + tail list
// ──────────────────────────────────────────────────────────────────────────
function LeaderboardMobile({ t }) {
  const hero = LB_AGENTS[0];
  const second = LB_AGENTS[1];
  const third  = LB_AGENTS[2];
  const tail = LB_AGENTS.slice(3, 7);
  const maxApi = hero.api;
  const heroGlow = medalGlowColor(1, t);

  return (
    <MFrame t={t}>
      <MHeader t={t} title="Leaderboard" sub="YTD · SOUTH BRANCH" />
      <MContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Period chips */}
          <PeriodChips t={t} periods={LB_PERIODS} />

          {/* #1 hero card */}
          <div className="a-scale-in" style={{
            padding: '18px 18px 20px', background: t.surface,
            border: `1px solid ${t.gold}55`, borderRadius: 14,
            position: 'relative', overflow: 'hidden',
            boxShadow: `0 8px 24px ${heroGlow}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          }}>
            <div style={{
              position: 'absolute', top: -50, right: -50, width: 200, height: 200,
              background: `radial-gradient(circle, ${heroGlow}, transparent 65%)`,
              pointerEvents: 'none', opacity: 0.85,
            }}></div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MedalCoin rank={1} size={28} />
              <div style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em',
                color: t.gold, textTransform: 'uppercase', fontFamily: APP_FONT_MONO,
              }}>Champion</div>
            </div>
            <div style={{ position: 'relative', marginTop: 10 }}>
              <div className="a-glow-soft" style={{
                position: 'absolute', inset: -8,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${heroGlow} 0%, transparent 70%)`,
                pointerEvents: 'none',
              }}></div>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: t.tealTint, color: t.teal,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 17, fontFamily: APP_FONT_DISPLAY,
                border: `2px solid ${t.gold}`, position: 'relative',
                boxShadow: `0 0 16px ${heroGlow}`,
              }}>{hero.name.split(' ').map(s => s[0]).join('')}</div>
            </div>
            <div style={{
              marginTop: 12, fontSize: 18, fontWeight: 700, color: t.ink,
              letterSpacing: '-0.012em', fontFamily: APP_FONT_DISPLAY, position: 'relative',
            }}>{hero.name}</div>
            <div style={{
              fontSize: 10.5, color: t.inkFaint, marginTop: 3,
              fontFamily: APP_FONT_MONO, letterSpacing: '0.06em', position: 'relative',
            }}>{hero.unit}</div>
            <div style={{
              marginTop: 10, fontSize: 26, fontWeight: 700, color: t.gold,
              fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.022em', lineHeight: 1,
              position: 'relative',
            }}>{ttd(hero.api)}</div>
            <div style={{
              fontSize: 10.5, color: t.inkFaint, marginTop: 4,
              fontFamily: APP_FONT_MONO, letterSpacing: '0.06em', position: 'relative',
            }}>{hero.apps} APPS</div>
          </div>

          {/* #2 + #3 side-by-side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            {[second, third].map((a, idx) => {
              const g = medalGlowColor(a.rank, t);
              const borderColor = a.rank === 2 ? '#94a3b8' : '#c08d6b';
              return (
                <div key={a.rank} className={'a-rise a-d-' + (idx + 1)} style={{
                  padding: '13px 13px', background: t.surface,
                  border: `1px solid ${borderColor}44`, borderRadius: 12,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                  position: 'relative', overflow: 'hidden',
                  boxShadow: `0 4px 12px ${g}`,
                }}>
                  <div style={{
                    position: 'absolute', top: -40, right: -40, width: 140, height: 140,
                    background: `radial-gradient(circle, ${g}, transparent 65%)`,
                    pointerEvents: 'none', opacity: 0.7,
                  }}></div>
                  <MedalCoin rank={a.rank} size={26} />
                  <div style={{
                    marginTop: 10, width: 40, height: 40, borderRadius: '50%',
                    background: t.tealTint, color: t.teal,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 12, fontFamily: APP_FONT_DISPLAY,
                    border: `2px solid ${borderColor}`,
                    position: 'relative',
                  }}>{a.name.split(' ').map(s => s[0]).join('')}</div>
                  <div style={{
                    marginTop: 8, fontSize: 13, fontWeight: 700, color: t.ink,
                    letterSpacing: '-0.005em', position: 'relative',
                  }}>{a.name}</div>
                  <div style={{
                    fontSize: 9.5, color: t.inkFaint, marginTop: 2,
                    fontFamily: APP_FONT_MONO, position: 'relative',
                  }}>{a.unit}</div>
                  <div style={{
                    marginTop: 8, fontSize: 16, fontWeight: 700, color: t.teal,
                    fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.018em', lineHeight: 1,
                    position: 'relative',
                  }}>{ttd(a.api)}</div>
                </div>
              );
            })}
          </div>

          {/* Tail */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: APP_FONT_MONO }}>Ranks 4 – 7</div>
            <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11, overflow: 'hidden' }}>
              {tail.map((a, i, arr) => (
                <div key={a.rank} className={'a-fade-up a-d-' + (i + 3)} style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '11px 13px',
                  borderBottom: i < arr.length - 1 ? `1px solid ${t.rule}` : 'none',
                }}>
                  <div style={{ width: 18, textAlign: 'center', fontSize: 12, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_DISPLAY }}>{a.rank}</div>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', background: t.tealTint, color: t.teal,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY,
                  }}>{a.name.split(' ').map(s => s[0]).join('')}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: t.inkFaint, marginTop: 1, fontFamily: APP_FONT_MONO }}>{a.unit}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY }}>{ttd(a.api)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MContent>
      <MNav t={t} active="ranks" />
    </MFrame>
  );
}

Object.assign(window, { LeaderboardDesktop, LeaderboardMobile, MedalCoin, PeriodChips });
