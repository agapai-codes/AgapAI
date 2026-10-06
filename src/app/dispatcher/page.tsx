// src/app/dispatcher/page.tsx
// Dispatcher command center with role-based auto-redirect.

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '../../hooks/useAuth';
import DispatchView from '../../views/DispatchView';

/** One shared sign-in treatment for both roles: dark console, hairline card,
 *  tracked labels, mono values. Demo credentials always visible. */
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
    <div className="flex min-h-[calc(100dvh_-_var(--banner-h,0px))] items-center justify-center bg-surface-0 px-4 py-10">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Identity */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--line)] bg-surface-2 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
            <Image src="/emblem.png" alt="AgapAI emblem" width={32} height={32} className="rounded-md" />
          </div>
          <h1 className="text-2xl font-extrabold uppercase tracking-[0.16em]">
            Agap<span className="text-[var(--critical)]">AI</span>
          </h1>
          <p className="data-label mt-2">Dispatcher access</p>
        </div>

        {/* Card */}
        <div className="panel p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="dispatcher-email" className="data-label mb-1.5 block">
                Email
              </label>
              <input
                id="dispatcher-email"
                type="email"
                placeholder="dispatcher@agapai.ph"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="field"
              />
            </div>

            <div>
              <label htmlFor="dispatcher-password" className="data-label mb-1.5 block">
                Password
              </label>
              <input
                id="dispatcher-password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="field"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.1)] px-3 py-2"
              >
                <p className="text-[13px] text-[var(--critical)]">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black"
                    aria-hidden
                  />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Demo credentials */}
        <div className="mt-4 flex justify-center">
          <p className="chip chip-neutral mono normal-case tracking-normal">
            <span className="text-ink-3">Demo</span>
            dispatcher@agapai.ph <span className="text-ink-3">/</span> agapai123
          </p>
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
      <div className="flex min-h-[calc(100dvh_-_var(--banner-h,0px))] items-center justify-center bg-surface-0">
        <div className="text-center" role="status" aria-label="Loading">
          <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-ink-1" />
          <p className="data-label">Loading</p>
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
