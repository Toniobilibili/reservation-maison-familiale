'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/components/AuthContext';
import { AppShell } from '@/components/AppShell';
import type { Reservation } from '@/lib/types';
import { formatDate } from '@/lib/families';
import { getFamilyStyle, getFamilyVisualStyle } from '@/lib/families';

const statusLabel: Record<string, string> = {
  approved: 'Validée',
  pending: 'En attente',
  rejected: 'Refusée',
};

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/signin');
    }
  }, [loading, user, router]);

  useEffect(() => {
    async function loadUpcoming() {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, start_date, end_date, status, guests, comment, user_id, created_at, updated_at, profiles(full_name, first_name, family)')
        .eq('status', 'approved')
        .order('start_date', { ascending: true })
        .limit(3);

      if (data) {
        setReservations(
          data.map((item: any) => ({
            ...item,
            user_full_name: item.profiles?.full_name ?? 'Famille',
            user_first_name: item.profiles?.first_name ?? undefined,
            user_family: item.profiles?.family ?? undefined,
          }))
        );
      }
      if (error) {
        console.error(error.message);
      }
      setFetching(false);
    }
    if (user) {
      loadUpcoming();
    }
  }, [user]);

  const summary = useMemo(() => reservations.slice(0, 3), [reservations]);

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

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-base font-bold text-slate-900">Prochaine réservation</p>
              <h2 className="mt-1 text-sm font-medium text-slate-500">À venir</h2>
            </div>
            <button onClick={() => router.push('/calendar')} className="hidden text-sm font-semibold text-brand-700 hover:text-brand-800 sm:block">
              Voir le calendrier
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {fetching ? (
              <p className="text-sm text-slate-500">Chargement...</p>
            ) : summary.length ? (
              summary.map((reservation) => (
                <div key={reservation.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-900"><span className="h-2.5 w-2.5 shrink-0 rounded-full border" style={getFamilyVisualStyle(reservation.user_family)} aria-hidden="true" /><span className="truncate">{getFamilyStyle(reservation.user_family).label} · {reservation.user_first_name ?? reservation.user_full_name}</span></p>
                      <p className="text-sm text-slate-600">
                        {formatDate(reservation.start_date)} → {formatDate(reservation.end_date)}
                      </p>
                    </div>
                    <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                      {statusLabel[reservation.status]}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">Aucune réservation validée pour le moment.</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
