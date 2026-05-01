import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Flame, Trophy } from 'lucide-react';
import { db, tenantId } from '../../firebase';
import { useAuth } from '../../context/AuthContext';

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

function LeaderRow({ entry, rank, isCurrentUser }) {
  const badgeCount = (entry.badges ?? []).length;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
        isCurrentUser ? 'border-primary bg-primary/5' : 'border-border bg-white'
      }`}
    >
      <div className="w-6 flex items-center justify-center shrink-0">
        {rank === 1
          ? <Trophy size={16} className="text-warning" />
          : <span className={`text-sm font-bold ${rank <= 3 ? 'text-primary' : 'text-ink-muted'}`}>{rank}</span>
        }
      </div>

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
  const { user, role } = useAuth();
  const [docs, setDocs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  const isManager = role && ['unit_manager', 'branch_manager', 'super_admin'].includes(role);

  useEffect(() => {
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
  }, []);

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
      <div className="card text-center py-10">
        <p className="text-sm text-ink-muted">No leaderboard data yet. Submit your first report to appear here!</p>
      </div>
    );
  }

  // Agent view — own rank card + full competition list
  if (!isManager) {
    return (
      <div className="flex flex-col gap-4">
        {myRank && (
          <div className="card text-center">
            <p className="text-xs uppercase tracking-wide text-ink-muted mb-1">Your Rank</p>
            <p className="text-4xl font-bold text-primary">#{myRank}</p>
            <p className="text-sm text-ink-muted mt-0.5">of {competition.length} agent{competition.length !== 1 ? 's' : ''}</p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {competition.map((entry, i) => (
            <LeaderRow key={entry.id} entry={entry} rank={i + 1} isCurrentUser={entry.userId === user?.uid} />
          ))}
        </div>
      </div>
    );
  }

  // Manager view — full competition + separated branch unit section
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {competition.map((entry, i) => (
          <LeaderRow key={entry.id} entry={entry} rank={i + 1} isCurrentUser={entry.userId === user?.uid} />
        ))}
      </div>

      {branchUnit.length > 0 && (
        <div className="mt-2">
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-2">Branch Unit — not in competition</p>
          <div className="flex flex-col gap-2 opacity-60">
            {branchUnit.map((entry, i) => (
              <LeaderRow key={entry.id} entry={entry} rank={i + 1} isCurrentUser={entry.userId === user?.uid} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
