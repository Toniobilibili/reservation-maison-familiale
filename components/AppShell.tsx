'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { BottomNav } from '@/components/BottomNav';
import { supabase } from '@/lib/supabaseClient';

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const { profile } = useAuth();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/signin');
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-4xl flex-col px-4 pb-24 pt-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Maison Familiale</p>
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            {profile ? <p className="mt-1 text-sm text-slate-600">Connecté en tant que {profile.role}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm sm:inline-block">
              Accueil
            </Link>
            <button onClick={handleSignOut} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm">
              Se déconnecter
            </button>
          </div>
        </header>
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
