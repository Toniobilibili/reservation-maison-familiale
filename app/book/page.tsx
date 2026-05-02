'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { ProtectedPage } from '@/components/ProtectedPage';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabaseClient';

export default function BookPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [guests, setGuests] = useState(2);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/signin');
    }
  }, [router, user]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!startDate || !endDate) {
      setError('Veuillez renseigner les dates.');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setError('La date de départ doit être après la date d’arrivée.');
      return;
    }

    if (!user) {
      setError('Utilisateur non connecté.');
      return;
    }

    setLoading(true);

    const { data: conflicts, error: conflictError } = await supabase
      .from('reservations')
      .select('id')
      .eq('status', 'approved')
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    if (conflictError) {
      setError(conflictError.message);
      setLoading(false);
      return;
    }

    if (conflicts && conflicts.length > 0) {
      setError('Cette période chevauche une réservation validée. Choisissez d’autres dates.');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('reservations').insert({
      user_id: user.id,
      start_date: startDate,
      end_date: endDate,
      guests,
      comment,
      status: 'pending',
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setSuccess('Demande envoyée. Elle est en attente de validation.');
    setStartDate('');
    setEndDate('');
    setGuests(2);
    setComment('');
    setLoading(false);
  }

  return (
    <ProtectedPage>
      <AppShell title="Faire une demande">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Date d’arrivée
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Date de départ
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Nombre de personnes
            <input
              type="number"
              min={1}
              max={12}
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              required
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Commentaire (optionnel)
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
            />
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-3xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Envoi...' : 'Envoyer la demande'}
          </button>
        </form>
      </AppShell>
    </ProtectedPage>
  );
}
