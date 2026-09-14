'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { AppShell } from '@/components/AppShell';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/signin');
    }
  }, [loading, user, router]);

  return (
    <AppShell title="Bienvenue">
      <div className="space-y-5 sm:space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-brand-200 bg-brand-50 p-5 shadow-soft sm:p-7">
          <div className="relative z-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">La maison vous attend</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">Organisez votre prochain séjour à Villeneuve.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">Retrouvez les dates déjà occupées et faites votre demande en quelques instants.</p>
            <button
              onClick={() => router.push('/book')}
              className="mt-5 min-h-11 w-full rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.99] sm:w-auto"
            >
              Faire une demande
            </button>
          </div>
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full border-[18px] border-white/60" aria-hidden="true" />
          <div className="absolute -bottom-16 right-20 h-32 w-32 rounded-full border-[14px] border-brand-200/70" aria-hidden="true" />
        </section>
      </div>
    </AppShell>
  );
}
