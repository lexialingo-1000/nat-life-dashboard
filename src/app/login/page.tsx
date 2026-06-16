'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Step = 'email' | 'otp';
type Status = 'idle' | 'loading' | 'error';

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const requestCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('loading');
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (authError) {
      setStatus('error');
      setError(authError.message);
      return;
    }

    setStatus('idle');
    setStep('otp');
  };

  const verifyCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('loading');
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.verifyOtp({
      email,
      token: code.replace(/\s/g, ''),
      type: 'email',
    });

    if (authError) {
      setStatus('error');
      setError(authError.message);
      return;
    }

    window.location.href = '/';
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <h1 className="text-2xl font-bold tracking-tight">Nat Life</h1>
          <p className="mt-1 text-sm text-zinc-500">Dashboard de gestion multi-société</p>

          {step === 'email' && (
            <form onSubmit={requestCode} className="mt-6 space-y-4">
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
                {status === 'loading' ? 'Envoi...' : 'Recevoir un code par email'}
              </button>

              {status === 'error' && error && (
                <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>
              )}
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={verifyCode} className="mt-6 space-y-4">
              <p className="text-sm text-zinc-600">
                Un code à 6 chiffres a été envoyé à <span className="font-medium">{email}</span>.
                Saisis-le ci-dessous (le code expire après 1 heure).
              </p>

              <div>
                <label htmlFor="code" className="mb-1 block text-sm font-medium">
                  Code de vérification
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={10}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="input text-center text-lg font-mono tracking-[0.5em]"
                  placeholder="123456"
                />
              </div>

              <button type="submit" disabled={status === 'loading'} className="btn-primary w-full">
                {status === 'loading' ? 'Vérification...' : 'Se connecter'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setError(null);
                  setStatus('idle');
                }}
                className="block w-full text-center text-xs text-zinc-500 underline-offset-2 hover:underline"
              >
                Utiliser une autre adresse email
              </button>

              {status === 'error' && error && (
                <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
