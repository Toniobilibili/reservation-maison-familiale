'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.replace('/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-3 py-5 sm:px-4 sm:py-8">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Maison Villeneuve</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Connexion</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Connectez-vous pour gérer ou demander une réservation.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 sm:mt-7">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-500"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-500"
            />
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
        <p className="mt-4 text-xs leading-5 text-slate-500">Utilise tes identifiants pour accéder à la maison familiale.</p>
        <p className="mt-4 text-center text-sm text-slate-600">
          Pas encore de compte ?{' '}
          <button type="button" onClick={() => router.push('/signup')} className="font-semibold text-brand-700 hover:underline">
            S&apos;inscrire
          </button>
        </p>
      </div>
    </main>
  );
}
