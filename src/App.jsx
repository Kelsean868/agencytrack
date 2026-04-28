import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center"
    style={{ backgroundColor: 'var(--color-bg)' }}>
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent
        rounded-full animate-spin mx-auto mb-4" />
      <p style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
        Loading AgencyTrack...
      </p>
    </div>
  </div>
);

const LoginScreen = () => (
  <div className="min-h-screen flex items-center justify-center p-4"
    style={{ backgroundColor: 'var(--color-bg)' }}>
    <div className="card w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: 'var(--color-primary)' }}>
          <span className="text-white text-2xl font-bold"
            style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>AT</span>
        </div>
        <h1 className="text-2xl mb-1">AgencyTrack</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Tatil Life — Sales Portal
        </p>
      </div>
      <div className="rounded-lg p-4 text-center"
        style={{
          backgroundColor: 'var(--color-primary-tint)',
          border: '1px solid var(--color-primary)'
        }}>
        <p style={{ color: 'var(--color-primary)', fontSize: '0.875rem', fontWeight: 500 }}>
          Phase 1 in progress — Auth coming next
        </p>
      </div>
    </div>
  </div>
);

const Dashboard = ({ user }) => (
  <div className="min-h-screen p-8" style={{ backgroundColor: 'var(--color-bg)' }}>
    <div style={{ maxWidth: '56rem', margin: '0 auto' }}>
      <h1 className="text-3xl mb-2">Welcome to AgencyTrack ✅</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
        Firebase connected · User: {user?.email}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {[
          'Design system ✅',
          'Firebase ✅',
          'Auth — Phase 2'
        ].map((item) => (
          <div key={item} className="card">
            <p style={{ fontWeight: 500 }}>{item}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen />;
  return <Dashboard user={user} />;
}