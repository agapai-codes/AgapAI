// src/app/responder/page.tsx
// Responder mobile interface with role-based auto-redirect.

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import ResponderView from '../../views/ResponderView';

function ResponderLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/responder-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || 'Login failed');
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
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Agap<span style={{ color: '#ef4444' }}>AI</span> Responder</h1>
          <p style={{ color: '#71717a', fontSize: '14px' }}>Sign in to view assigned incidents</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required aria-label="Email"
            style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', color: '#fafafa', outline: 'none' }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required aria-label="Password"
            style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', color: '#fafafa', outline: 'none' }} />
          {error && <p style={{ color: '#f87171', fontSize: '12px' }}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{ background: '#3b82f6', color: '#fff', fontWeight: 600, borderRadius: '8px', border: 'none', padding: '12px', fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: '#52525b' }}>
          Demo: dispatcher@agapai.ph / agapai123
        </p>
      </div>
    </div>
  );
}

export default function ResponderPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [loginDone, setLoginDone] = useState(false);

  // Auto-redirect dispatchers to /dispatcher
  useEffect(() => {
    if (!loading && user && (user.role === 'dispatcher' || user.role === 'admin')) {
      router.replace('/dispatcher');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090b', color: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#71717a' }}>Loading...</p>
      </div>
    );
  }

  // Dispatchers get redirected; responders see the view
  if (!user && !loginDone) {
    return <ResponderLogin onLogin={() => setLoginDone(true)} />;
  }

  return <ResponderView />;
}
