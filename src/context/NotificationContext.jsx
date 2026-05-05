import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, orderBy, limit, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import {
  markRead as svcMarkRead,
  markAllRead as svcMarkAllRead,
} from '../services/notificationService';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user, tenantId } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.uid || !tenantId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, `tenants/${tenantId}/notifications`),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[Notifications] listener error:', err.code, err.message, err);
        setError('Failed to load notifications.');
        setLoading(false);
      }
    );

    return unsub;
  }, [user?.uid, tenantId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = useCallback(async (notificationId) => {
    if (!tenantId) return;
    try {
      await svcMarkRead(tenantId, notificationId);
    } catch (e) {
      console.error(e);
    }
  }, [tenantId]);

  const markAllRead = useCallback(async () => {
    if (!user?.uid || !tenantId) return;
    try {
      await svcMarkAllRead(tenantId, user.uid);
    } catch (e) {
      console.error(e);
    }
  }, [user?.uid, tenantId]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, error, markRead, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
