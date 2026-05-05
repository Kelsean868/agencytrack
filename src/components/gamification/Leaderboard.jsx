import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, where, onSnapshot, getDocs } from 'firebase/firestore';
import { Flame, Trophy, ClipboardList, Zap } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { getLastNSundays } from '../../utils/dateHelpers';
import { computeWeeklyChampions } from '../../utils/weeklyChampions';
import { formatCurrency, formatDateFriendly } from '../../utils/formatters';

function ChampionCard({ Icon, label, champion, format }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-[var(--color-surface)] border border-primary/20 p-3 min-h-[44px]">
      <p className="text-[10px] font-bold uppercase tracking-wide text-primary flex items-center gap-1">
        <Icon size={12} />
        <span>{label}</span>
      </p>
      {champion ? (
        <>
          <p className="text-sm font-bold text-ink truncate">{champion.agentName}</p>
          <p className="text-xs text-ink-muted">{format(champion.value)}</p>
        </>
      ) : (
        <p className="text-xs text-ink-muted italic">No data yet</p>
      )}
    </div>
  );
}

function WeeklyChampionsBanner({ champions, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 mb-4">
        <div className="h-3 w-36 rounded bg-primary/20 animate-pulse mb-3" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-primary/10 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!champions) return null;

  const { topAPI, topApps, topActivity, weekStarting } = champions;
  const weekLabel = weekStarting
    ? formatDateFriendly(weekStarting)
    : '';

  const cards = [
    { Icon: Trophy,        label: 'Top API',      champion: topAPI,      format: (v) => formatCurrency(Math.round(v)) },
    { Icon: ClipboardList, label: 'Top Apps',     champion: topApps,     format: (v) => String(v) },
    { Icon: Zap,           label: 'Top Activity', champion: topActivity, format: (v) => String(v) },
  ];

  const hasAnyData = topAPI || topApps || topActivity;

  return (
    <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 mb-4">
      <p className="text-xs font-bold uppercase tracking-wide text-primary mb-0.5">
        Last Week's Champions
      </p>
      <p className="text-[10px] text-ink-muted mb-3">
        {hasAnyData ? `Week of ${weekLabel}` : 'No submissions recorded last week'}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {cards.map((card) => (
          <ChampionCard
            key={card.label}
            Icon={card.Icon}
            label={card.label}
            champion={card.champion}
            format={card.format}
          />
        ))}
      </div>
    </div>
  );
}

function AgentAvatar({ photoURL, name, size = 36 }) {
  const initials = (name ?? 'A')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return photoURL ? (
    <img
      src={photoURL}
      alt={name}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
    />
  ) : (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'var(--color-primary)', color: '#fff',
        fontSize: size * 0.36, fontWeight: 700,
      }}
    >
      {initials}
    </div>
  );
}

const LEVEL_COLORS = {
  Rookie:    'bg-border/60 text-ink-muted',
  Associate: 'bg-primary/10 text-primary',
  Pro:       'bg-warning/15 text-warning',
  Elite:     'bg-success/15 text-success',
  Legend:    'bg-danger/15 text-danger',
};

function LevelChip({ title }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${LEVEL_COLORS[title] ?? LEVEL_COLORS.Rookie}`}>
      {title ?? 'Rookie'}
    </span>
  );
}

function LeaderRow({ entry, rank, isCurrentUser, photoURL }) {
  const badgeCount = (entry.badges ?? []).length;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
        isCurrentUser ? 'border-primary bg-primary/5' : 'border-border bg-[var(--color-surface)]'
      }`}
    >
      <div className="w-6 flex items-center justify-center shrink-0">
        {rank === 1
          ? <Trophy size={16} className="text-warning" />
          : <span className={`text-sm font-bold ${rank <= 3 ? 'text-primary' : 'text-ink-muted'}`}>{rank}</span>
        }
      </div>

      <AgentAvatar photoURL={photoURL} name={entry.agentName} size={36} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-semibold truncate ${isCurrentUser ? 'text-primary' : 'text-ink'}`}>
            {entry.agentName ?? 'Agent'}
          </p>
          <LevelChip title={entry.levelTitle} />
          {(entry.weeklyStreak ?? 0) >= 4 && (
            <Flame size={13} className="text-warning shrink-0" title={`${entry.weeklyStreak}-week streak`} />
          )}
        </div>
        {badgeCount > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            <Trophy size={10} className="text-warning" />
            <p className="text-[10px] text-ink-muted">{badgeCount} badge{badgeCount !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-ink">{(entry.points ?? 0).toLocaleString()}</p>
        <p className="text-[10px] text-ink-muted">pts</p>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const { user, role, tenantId } = useAuth();
  const [docs, setDocs]                   = useState([]);
  const [photoMap, setPhotoMap]           = useState({});
  const [prevSubs, setPrevSubs]           = useState([]);
  const [championsLoading, setChampionsLoading] = useState(true);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');

  const isManager = role && ['unit_manager', 'branch_manager', 'super_admin'].includes(role);

  // Previous week's Sunday — stable across renders
  const prevSunday = useMemo(() => getLastNSundays(2)[1], []);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(
      collection(db, `tenants/${tenantId}/leaderboard`),
      orderBy('points', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[Leaderboard]', err);
        setError('Failed to load leaderboard.');
        setLoading(false);
      }
    );
    return unsub;
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    getDocs(collection(db, `tenants/${tenantId}/users`))
      .then((snap) => {
        const map = {};
        snap.forEach((d) => {
          if (d.data().photoURL) map[d.id] = d.data().photoURL;
        });
        setPhotoMap(map);
      })
      .catch(() => {});
  }, [tenantId]);

  // Fetch previous week's submitted submissions for champions banner
  useEffect(() => {
    if (!tenantId) return;
    setChampionsLoading(true);
    getDocs(
      query(
        collection(db, `tenants/${tenantId}/submissions`),
        where('weekStarting', '==', prevSunday),
        where('status', '==', 'submitted')
      )
    )
      .then((snap) => {
        setPrevSubs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
      .catch(() => {})
      .finally(() => setChampionsLoading(false));
  }, [prevSunday, tenantId]);

  const champions = useMemo(
    () => computeWeeklyChampions(prevSubs, prevSunday),
    [prevSubs, prevSunday]
  );

  const { competition, branchUnit } = useMemo(() => ({
    competition: docs.filter((d) => !d.isBranchManagerUnit),
    branchUnit:  docs.filter((d) => d.isBranchManagerUnit),
  }), [docs]);

  const myRank = useMemo(
    () => competition.findIndex((d) => d.userId === user?.uid) + 1 || null,
    [competition, user?.uid]
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-border/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">{error}</div>
    );
  }

  if (competition.length === 0 && branchUnit.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <WeeklyChampionsBanner champions={champions} loading={championsLoading} />
        <div className="card text-center py-10">
          <p className="text-sm text-ink-muted">No leaderboard data yet. Submit your first report to appear here!</p>
        </div>
      </div>
    );
  }

  const myEntry = competition.find((d) => d.userId === user?.uid);

  // Agent view — champions banner + own rank card + full competition list
  if (!isManager) {
    return (
      <div className="flex flex-col gap-4">
        <WeeklyChampionsBanner champions={champions} loading={championsLoading} />

        {myRank && (
          <div className="card flex flex-col items-center py-5">
            <AgentAvatar photoURL={photoMap[user?.uid]} name={myEntry?.agentName} size={48} />
            <p className="text-xs uppercase tracking-wide text-ink-muted mt-3 mb-1">Your Rank</p>
            <p className="text-4xl font-bold text-primary">#{myRank}</p>
            <p className="text-sm text-ink-muted mt-0.5">of {competition.length} agent{competition.length !== 1 ? 's' : ''}</p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {competition.map((entry, i) => (
            <LeaderRow key={entry.id} entry={entry} rank={i + 1} isCurrentUser={entry.userId === user?.uid} photoURL={photoMap[entry.userId]} />
          ))}
        </div>
      </div>
    );
  }

  // Manager view — champions banner + full competition + separated branch unit section
  return (
    <div className="flex flex-col gap-3">
      <WeeklyChampionsBanner champions={champions} loading={championsLoading} />

      <div className="flex flex-col gap-2">
        {competition.map((entry, i) => (
          <LeaderRow key={entry.id} entry={entry} rank={i + 1} isCurrentUser={entry.userId === user?.uid} photoURL={photoMap[entry.userId]} />
        ))}
      </div>

      {branchUnit.length > 0 && (
        <div className="mt-2">
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-2">Branch Unit — not in competition</p>
          <div className="flex flex-col gap-2 opacity-60">
            {branchUnit.map((entry, i) => (
              <LeaderRow key={entry.id} entry={entry} rank={i + 1} isCurrentUser={entry.userId === user?.uid} photoURL={photoMap[entry.userId]} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
