'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { BottomNav } from '@/components/BottomNav';
import { supabase } from '@/lib/supabaseClient';

const desktopLinks = [
  { href: '/calendar', label: 'Calendrier' },
  { href: '/book', label: 'Réserver' },
  { href: '/info', label: 'Infos' },
];

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useAuth();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/signin');
  }

  const links = profile?.role === 'admin' ? [...desktopLinks, { href: '/admin', label: 'Admin' }] : desktopLinks;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-3 pb-24 pt-3 sm:px-6 sm:pb-8 sm:pt-6 lg:px-8">
        <header className="mb-4 space-y-3 sm:mb-7 sm:space-y-4">
          <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/90 bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Maison Villeneuve</p>
              <h1 className="mt-1 text-[1.65rem] font-semibold leading-tight text-slate-900 sm:text-3xl">{title}</h1>
              {profile ? <p className="mt-1 truncate text-sm text-slate-600">Connecté en tant que {profile.family ?? profile.full_name} {profile.first_name ? `- ${profile.first_name}` : ''}</p> : null}
            </div>
            <button
              onClick={handleSignOut}
              className="min-h-11 w-full rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 active:scale-[0.99] sm:w-auto"
            >
              Se déconnecter
            </button>
          </div>

          <nav className="hidden rounded-3xl border border-slate-200 bg-white p-2 shadow-soft sm:flex">
            {links.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex-1 rounded-2xl px-4 py-2.5 text-center text-sm font-semibold transition ${
                    isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="flex-1">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
