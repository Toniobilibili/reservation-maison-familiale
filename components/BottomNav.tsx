'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';

const items = [
  { href: '/', label: 'Accueil', icon: 'home' },
  { href: '/calendar', label: 'Calendrier', icon: 'calendar' },
  { href: '/book', label: 'Réserver', icon: 'plus' },
  { href: '/info', label: 'Infos', icon: 'info' },
];

function NavIcon({ name }: { name: string }) {
  const commonProps = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

  if (name === 'home') {
    return <svg {...commonProps}><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></svg>;
  }
  if (name === 'calendar') {
    return <svg {...commonProps}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M16 2.5v4M8 2.5v4M3 9h18" /></svg>;
  }
  if (name === 'plus') {
    return <svg {...commonProps}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>;
  }
  if (name === 'info') {
    return <svg {...commonProps}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>;
  }
  return <svg {...commonProps}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>;
}

export function BottomNav() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const links = profile?.role === 'admin' ? [...items, { href: '/admin', label: 'Admin', icon: 'admin' }] : items;
  const gridColumns = links.length === 5 ? 'grid-cols-5' : 'grid-cols-4';

  return (
    <nav aria-label="Navigation principale" className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200/80 bg-white/90 shadow-[0_-10px_30px_rgba(15,23,42,0.1)] backdrop-blur-xl sm:hidden">
      <div className={`safe-bottom mx-auto grid max-w-lg ${gridColumns} gap-1 px-3 pt-2`}>
        {links.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-1.5 text-xs font-semibold leading-none transition active:scale-95 ${
                isActive ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
