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
    <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Image src="/logo.jpg" alt="AgapAI" width={36} height={36} className="rounded-lg" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-wider uppercase">
            Agap<span className="text-red-500">AI</span>
          </h1>
          <p className="text-[12px] text-neutral-500 mt-1.5">Sign in to the command center</p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl p-6 border border-white/10 shadow-2xl"
          style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase mb-1.5 block">Email</label>
              <input type="email" placeholder="dispatcher@agapai.ph" value={email} onChange={e => setEmail(e.target.value)} required
                autoComplete="email"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-[13px] text-white placeholder-neutral-600
                  outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-all
                  autofill:!bg-white/5 autofill:!text-white" />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase mb-1.5 block">Password</label>
              <input type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} required
                autoComplete="current-password"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-[13px] text-white placeholder-neutral-600
                  outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-all
                  autofill:!bg-white/5 autofill:!text-white" />
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <p className="text-[11px] text-red-400">{error}</p>
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-white text-black font-bold text-[13px] rounded-lg transition-all hover:bg-neutral-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b]">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Demo credentials */}
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <span className="text-[9px] text-neutral-500">Demo</span>
            <span className="text-[10px] text-neutral-400 font-mono">dispatcher@agapai.ph</span>
            <span className="text-[9px] text-neutral-600">/</span>
            <span className="text-[10px] text-neutral-400 font-mono">agapai123</span>
          </div>
        </div>
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
      <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[12px] text-neutral-500">Loading...</p>
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
