// src/app/dashboard/page.tsx
// Dashboard with optional dispatcher auth gate.

'use client';

import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import DispatchView from '../../views/DispatchView';

function LoginGate({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '360px', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Agap<span style={{ color: '#ef4444' }}>AI</span> Dispatcher</h1>
          <p style={{ color: '#71717a', fontSize: '14px' }}>Sign in to access the command center</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="email"
            placeholder="Dispatcher email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            aria-label="Email"
            style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', color: '#fafafa', outline: 'none' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            aria-label="Password"
            style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', color: '#fafafa', outline: 'none' }}
          />
          {error && <p style={{ color: '#f87171', fontSize: '12px' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{ background: '#fafafa', color: '#09090b', fontWeight: 600, borderRadius: '8px', border: 'none', padding: '12px', fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: '#52525b' }}>
          Demo: dispatcher@agapai.ph
        </p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [loginDone, setLoginDone] = useState(false);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090b', color: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid #27272a', borderTopColor: '#fafafa', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#71717a', fontSize: '14px' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Allow viewing without login for demo (DEMO_OPEN_MUTATIONS=true on Vercel)
  // But show a login prompt if not authenticated
  if (!user && !loginDone) {
    const demoOpen = process.env.NEXT_PUBLIC_DEMO_OPEN === 'true';
    if (!demoOpen) {
      return <LoginGate onLogin={() => setLoginDone(true)} />;
    }
  }

  return <DispatchView />;
}
