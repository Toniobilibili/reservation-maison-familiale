'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';

const items = [
  { href: '/', label: 'Accueil' },
  { href: '/calendar', label: 'Calendrier' },
  { href: '/book', label: 'Réserver' },
  { href: '/info', label: 'Infos' },
];

export function BottomNav() {
  const pathname = usePathname();
  const { profile } = useAuth();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur-md sm:hidden">
      <div className="mx-auto flex max-w-lg justify-between px-4 py-3">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={`text-xs font-semibold ${pathname === item.href ? 'text-brand-600' : 'text-slate-500'}`}>
            {item.label}
          </Link>
        ))}
        {profile?.role === 'admin' ? (
          <Link href="/admin" className={`text-xs font-semibold ${pathname === '/admin' ? 'text-brand-600' : 'text-slate-500'}`}>
            Admin
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
