'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('loading');
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setStatus('error');
      setError(authError.message);
      return;
    }

    setStatus('sent');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <h1 className="text-2xl font-bold tracking-tight">Nat Life</h1>
          <p className="mt-1 text-sm text-slate-500">
            Dashboard de gestion multi-société
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="natacha@fka-holding.com"
              />
            </div>

            <button type="submit" disabled={status === 'loading'} className="btn-primary w-full">
              {status === 'loading' ? 'Envoi...' : 'Recevoir un lien magique'}
            </button>

            {status === 'sent' && (
              <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
                Lien envoyé. Consulte tes emails et clique pour te connecter.
              </p>
            )}

            {status === 'error' && error && (
              <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
