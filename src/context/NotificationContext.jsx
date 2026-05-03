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

const TENANT_ID = import.meta.env.VITE_TENANT_ID;

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, `tenants/${TENANT_ID}/notifications`),
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
  }, [user?.uid]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = useCallback(async (notificationId) => {
    try {
      await svcMarkRead(TENANT_ID, notificationId);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user?.uid) return;
    try {
      await svcMarkAllRead(TENANT_ID, user.uid);
    } catch (e) {
      console.error(e);
    }
  }, [user?.uid]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, error, markRead, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
