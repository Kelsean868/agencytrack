import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';

/**
 * The agent's own points-engine doc, `tenants/{tid}/leaderboard/{uid}` — the
 * same doc (and the same listener shape) MyPointsCard reads. Read-only.
 *
 * Returns { loading, error, entry, retry }. `entry` is null when the doc does
 * not exist yet (no report submitted), which the Trophy room shows as
 * "everything locked", not as an error.
 */
export default function useMyLeaderboardEntry(tenantId, uid) {
  const [state, setState] = useState({ loading: true, error: false, entry: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!tenantId || !uid) {
      setState({ loading: true, error: false, entry: null });
      return undefined;
    }
    setState({ loading: true, error: false, entry: null });
    const unsub = onSnapshot(
      doc(db, `tenants/${tenantId}/leaderboard/${uid}`),
      (snap) => setState({ loading: false, error: false, entry: snap.exists() ? snap.data() : null }),
      () => setState({ loading: false, error: true, entry: null }),
    );
    return unsub;
  }, [tenantId, uid, attempt]);

  return { ...state, retry: () => setAttempt((a) => a + 1) };
}
