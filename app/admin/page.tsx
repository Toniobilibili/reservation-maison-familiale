'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProtectedPage } from '@/components/ProtectedPage';
import { supabase } from '@/lib/supabaseClient';
import type { Reservation } from '@/lib/types';
import { ReservationCard } from '@/components/ReservationCard';

export default function AdminPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, start_date, end_date, status, guests, comment, user_id, profiles(full_name)')
        .order('created_at', { ascending: false });
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
      setLoading(false);
    }
    loadAll();
  }, []);

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    setActionLoading(id);
    const { error } = await supabase.from('reservations').update({ status }).eq('id', id);
    if (error) {
      console.error(error.message);
    } else {
      setReservations((current) => current.map((reservation) => (reservation.id === id ? { ...reservation, status } : reservation)));
    }
    setActionLoading(null);
  }

  async function removeReservation(id: string) {
    setActionLoading(id);
    const { error } = await supabase.from('reservations').delete().eq('id', id);
    if (error) {
      console.error(error.message);
    } else {
      setReservations((current) => current.filter((reservation) => reservation.id !== id));
    }
    setActionLoading(null);
  }

  const pending = reservations.filter((reservation) => reservation.status === 'pending');
  const history = reservations.filter((reservation) => reservation.status !== 'pending');

  async function clearAllReservations() {
    const confirmed = window.confirm('Supprimer toutes les réservations existantes ? Cela ne peut pas être annulé.');
    if (!confirmed) {
      return;
    }
    setActionLoading('clear-all');
    const { error } = await supabase.from('reservations').delete();
    if (error) {
      console.error(error.message);
    } else {
      setReservations([]);
    }
    setActionLoading(null);
  }

  return (
    <ProtectedPage adminOnly>
      <AppShell title="Espace admin">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Demandes en attente</h2>
                <p className="mt-2 text-sm text-slate-600">Validez ou refusez les nouvelles demandes.</p>
              </div>
              <button
                onClick={clearAllReservations}
                disabled={actionLoading === 'clear-all'}
                className="rounded-3xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {actionLoading === 'clear-all' ? 'Suppression...' : 'Supprimer toutes les réservations'}
              </button>
            </div>
          </section>

          {loading ? (
            <p className="text-sm text-slate-600">Chargement des demandes...</p>
          ) : pending.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600 shadow-soft">
              Aucune demande en attente.
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map((reservation) => (
                <div key={reservation.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-soft">
                  <ReservationCard reservation={reservation} />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => updateStatus(reservation.id, 'approved')}
                      disabled={actionLoading === reservation.id}
                      className="rounded-3xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Valider
                    </button>
                    <button
                      onClick={() => updateStatus(reservation.id, 'rejected')}
                      disabled={actionLoading === reservation.id}
                      className="rounded-3xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-slate-900">Historique</h2>
            <p className="mt-2 text-sm text-slate-600">Toutes les réservations validées ou refusées.</p>
          </section>

          {loading ? null : history.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600 shadow-soft">
              Aucune réservation historique.
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((reservation) => (
                <div key={reservation.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-soft">
                  <ReservationCard reservation={reservation} />
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => removeReservation(reservation.id)}
                      disabled={actionLoading === reservation.id}
                      className="rounded-3xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedPage>
  );
}
