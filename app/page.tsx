'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/components/AuthContext';
import { AppShell } from '@/components/AppShell';
import type { Reservation } from '@/lib/types';

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
        .select('id, start_date, end_date, status, guests, comment, user_id, created_at, updated_at, profiles(full_name)')
        .eq('status', 'approved')
        .order('start_date', { ascending: true })
        .limit(3);
      if (data) {
        setReservations(
          data.map((item: any) => ({
            ...item,
            user_full_name: item.profiles?.full_name ?? 'Famille',
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

  const summary = useMemo(
    () => reservations.slice(0, 3),
    [reservations]
  );

  return (
    <AppShell title="Bienvenue">
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Prochaines réservations</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">À venir</h2>
            </div>
            <button onClick={() => router.push('/book')} className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
              Faire une demande
            </button>
          </div>
          <div className="mt-5 space-y-4">
            {fetching ? (
              <p className="text-sm text-slate-500">Chargement...</p>
            ) : summary.length ? (
              summary.map((reservation) => (
                <div key={reservation.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{reservation.user_full_name}</p>
                      <p className="text-sm text-slate-600">{reservation.start_date} → {reservation.end_date}</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">{statusLabel[reservation.status]}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">Aucune réservation validée pour le moment.</p>
            )}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <button onClick={() => router.push('/book')} className="rounded-3xl bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5">
            <p className="text-sm font-semibold text-slate-900">Faire une demande</p>
            <p className="mt-2 text-sm text-slate-500">Choisir vos dates et envoyer une demande.</p>
          </button>
          <button onClick={() => router.push('/calendar')} className="rounded-3xl bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5">
            <p className="text-sm font-semibold text-slate-900">Voir le calendrier</p>
            <p className="mt-2 text-sm text-slate-500">Consulter les disponibilités validées.</p>
          </button>
          <button onClick={() => router.push('/info')} className="rounded-3xl bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5">
            <p className="text-sm font-semibold text-slate-900">Infos pratiques</p>
            <p className="mt-2 text-sm text-slate-500">Adresse, wifi, consignes et contacts utiles.</p>
          </button>
        </section>
      </div>
    </AppShell>
  );
}
