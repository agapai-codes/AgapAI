// src/app/dispatcher/page.tsx
// Dispatcher command center with role-based auto-redirect.

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
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
    <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center">
      <div className="w-full max-w-sm mx-auto px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
            <Image src="/logo.jpg" alt="AgapAI" width={32} height={32} className="rounded-lg" />
          </div>
          <h1 className="text-xl font-extrabold tracking-wider uppercase">
            Agap<span className="text-red-500">AI</span>
          </h1>
          <p className="text-[11px] text-neutral-500 mt-1">Sign in to the command center</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input type="email" placeholder="Dispatcher email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-[13px] text-white placeholder-neutral-600 outline-none focus:border-white/20 transition-colors" />
          </div>
          <div>
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-[13px] text-white placeholder-neutral-600 outline-none focus:border-white/20 transition-colors" />
          </div>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-white text-black font-bold text-[13px] rounded-lg transition-all hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center mt-6 text-[10px] text-neutral-600">
          Demo: dispatcher@agapai.ph / agapai123
        </p>
      </div>
    </div>
  );
}

export default function DispatcherPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [loginDone, setLoginDone] = useState(false);

  // Auto-redirect responders to /responder
  useEffect(() => {
    if (!loading && user && user.role === 'responder') {
      router.replace('/responder');
    }
  }, [user, loading, router]);

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

  // Responders get redirected; dispatchers see the dashboard
  if (!user && !loginDone) {
    return <LoginGate onLogin={() => setLoginDone(true)} />;
  }

  return <DispatchView />;
}
