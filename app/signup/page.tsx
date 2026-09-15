'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { families } from '@/lib/families';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [family, setFamily] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: `${firstName} - ${family}`, first_name: firstName, family },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.replace('/');
      return;
    }

    setSuccess('Compte créé. Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.');
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-3 py-5 sm:px-4 sm:py-8">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Maison Villeneuve</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Inscription</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Crée ton compte pour demander une réservation.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 sm:mt-7">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-500" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Prénom
            <input type="text" value={firstName} onChange={(event) => setFirstName(event.target.value)} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-500" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Mot de passe
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-500" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Famille
            <select value={family} onChange={(event) => setFamily(event.target.value)} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-500">
              <option value="">Sélectionner une famille</option>
              {families.map((familyName) => <option key={familyName} value={familyName}>{familyName}</option>)}
            </select>
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-600">
          Déjà un compte ?{' '}
          <button type="button" onClick={() => router.push('/signin')} className="font-semibold text-brand-700 hover:underline">Se connecter</button>
        </p>
      </div>
    </main>
  );
}