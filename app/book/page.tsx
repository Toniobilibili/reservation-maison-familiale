'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { ProtectedPage } from '@/components/ProtectedPage';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import type { Reservation } from '@/lib/types';
import { formatDate, getFamilyStyle, getFamilyVisualStyle } from '@/lib/families';

const weekdayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const statusLabel: Record<string, string> = {
  approved: 'Validée',
  pending: 'En attente',
  rejected: 'Refusée',
};

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCalendarGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const firstDay = first.getDay();
  const start = new Date(first);
  start.setDate(first.getDate() - ((firstDay + 6) % 7));

  const weeks: Date[][] = [];
  const current = new Date(start);

  for (let week = 0; week < 6; week += 1) {
    const days: Date[] = [];
    for (let day = 0; day < 7; day += 1) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(days);
  }

  return weeks;
}

function DateField({
  label,
  value,
  onChange,
  reservationsByDate,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  reservationsByDate: Record<string, Reservation[]>;
}) {
  const selectedDate = value ? parseDateKey(value) : new Date();
  const [isOpen, setIsOpen] = useState(false);
  const [monthIndex, setMonthIndex] = useState(selectedDate.getMonth());
  const [year, setYear] = useState(selectedDate.getFullYear());

  useEffect(() => {
    if (!value) {
      return;
    }

    const nextSelectedDate = parseDateKey(value);
    setMonthIndex(nextSelectedDate.getMonth());
    setYear(nextSelectedDate.getFullYear());
  }, [value]);

  const grid = useMemo(() => getCalendarGrid(year, monthIndex), [monthIndex, year]);
  const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  function goPreviousMonth() {
    if (monthIndex === 0) {
      setMonthIndex(11);
      setYear((prev) => prev - 1);
    } else {
      setMonthIndex((prev) => prev - 1);
    }
  }

  function goNextMonth() {
    if (monthIndex === 11) {
      setMonthIndex(0);
      setYear((prev) => prev + 1);
    } else {
      setMonthIndex((prev) => prev + 1);
    }
  }

  return (
    <div className="relative block text-sm font-medium text-slate-700">
      <p>{label}</p>
      <div className="mt-2 flex w-full items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 transition focus-within:border-brand-500">
        <button type="button" onClick={() => setIsOpen((prev) => !prev)} className="min-h-[50px] flex-1 px-4 py-3 text-left font-semibold">
          {value ? formatDate(value) : 'jj/mm/aaaa'}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="mr-2 grid h-10 w-10 place-items-center rounded-xl text-slate-900 transition hover:bg-white"
          aria-label={`Ouvrir le calendrier ${label.toLowerCase()}`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path d="M7 2v3M17 2v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </button>
      </div>
      {isOpen ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-full min-w-[300px] rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-soft">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button type="button" onClick={goPreviousMonth} className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-lg font-semibold transition hover:bg-slate-50">
              ←
            </button>
            <p className="text-sm font-semibold capitalize">{monthLabel}</p>
            <button type="button" onClick={goNextMonth} className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-lg font-semibold transition hover:bg-slate-50">
              →
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-slate-500">
            {weekdayNames.map((name) => (
              <div key={name} className="py-1">
                {name}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.flat().map((day) => {
              const key = getDateKey(day);
              const isCurrentMonth = day.getMonth() === monthIndex;
              const reservation = reservationsByDate[key]?.[0];
              const isReserved = Boolean(reservation);
              const familyStyle = getFamilyStyle(reservation?.user_family);
              const isSelected = value === key;

              return (
                <button
                  key={key}
                  type="button"
                  disabled={isReserved}
                  onClick={() => {
                    onChange(key);
                    setIsOpen(false);
                  }}
                  title={isReserved ? `${familyStyle.label} - ${reservation?.user_first_name ?? reservation?.user_full_name ?? 'Famille'}` : undefined}
                  className={`h-10 rounded-xl border text-sm font-semibold transition ${
                    isReserved
                      ? `${familyStyle.day} cursor-not-allowed`
                      : isSelected
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-brand-400 hover:bg-brand-50'
                  } ${isCurrentMonth ? '' : 'opacity-40'}`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadReservations() {
      const { data } = await supabase
        .from('reservations')
        .select('id, start_date, end_date, status, guests, comment, user_id, created_at, updated_at, profiles(full_name, first_name, family)')
        .eq('status', 'approved')
        .order('start_date', { ascending: true });
      if (data) {
        setReservations(data.map((item: any) => ({
          ...item,
          user_full_name: item.profiles?.full_name ?? 'Famille',
          user_first_name: item.profiles?.first_name ?? undefined,
          user_family: item.profiles?.family ?? undefined,
        })));
      }

      const { data: ownData } = await supabase
        .from('reservations')
        .select('id, start_date, end_date, status, guests, comment, user_id, created_at, updated_at')
        .eq('user_id', user!.id)
        .order('start_date', { ascending: true });

      if (ownData) {
        setMyReservations(ownData as Reservation[]);
      }
    }
    if (user) loadReservations();
  }, [user]);

  async function deleteOwnReservation(id: string) {
    if (!window.confirm('Supprimer cette réservation ?')) {
      return;
    }

    setDeletingId(id);
    const { error: deleteError } = await supabase
      .from('reservations')
      .delete()
      .eq('id', id)
      .eq('user_id', user?.id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setMyReservations((current) => current.filter((reservation) => reservation.id !== id));
      setReservations((current) => current.filter((reservation) => reservation.id !== id));
      setSuccess('Réservation supprimée.');
    }

    setDeletingId(null);
  }

  useEffect(() => {
    if (!user) {
      router.replace('/signin');
    }
  }, [router, user]);

  const reservationsByDate = useMemo(() => {
    const map: Record<string, Reservation[]> = {};

    reservations.forEach((reservation) => {
      const current = parseDateKey(reservation.start_date);
      const end = parseDateKey(reservation.end_date);

      while (current <= end) {
        const key = getDateKey(current);
        map[key] = map[key] || [];
        map[key].push(reservation);
        current.setDate(current.getDate() + 1);
      }
    });

    return map;
  }, [reservations]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!startDate || !endDate) {
      setError('Veuillez renseigner les dates.');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setError("La date de départ doit être après la date d'arrivée.");
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
      setError("Cette période chevauche une réservation validée. Choisissez d'autres dates.");
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
        <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField label="Date d'arrivée" value={startDate} onChange={setStartDate} reservationsByDate={reservationsByDate} />
            <DateField label="Date de départ" value={endDate} onChange={setEndDate} reservationsByDate={reservationsByDate} />
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
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Commentaire (optionnel)
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
            />
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Envoi...' : 'Envoyer la demande'}
          </button>
        </form>
        <section className="mt-5 space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Mes demandes</h2>
            <p className="mt-1 text-sm text-slate-600">Vous pouvez supprimer vos propres réservations.</p>
          </div>
          {myReservations.length === 0 ? <p className="text-sm text-slate-600">Aucune demande personnelle.</p> : myReservations.map((reservation) => (
            <div key={reservation.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{formatDate(reservation.start_date)} → {formatDate(reservation.end_date)}</p>
                <p className="mt-1 text-sm text-slate-600">{statusLabel[reservation.status]} · {reservation.guests} personne{reservation.guests > 1 ? 's' : ''}</p>
              </div>
              <button
                type="button"
                onClick={() => deleteOwnReservation(reservation.id)}
                disabled={deletingId === reservation.id}
                className="min-h-10 w-full rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {deletingId === reservation.id ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          ))}
        </section>
        <section className="mt-5 space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Réservations déjà faites</h2>
            <p className="mt-1 text-sm text-slate-600">Les dates validées apparaissent avec la couleur de chaque famille.</p>
          </div>
          {reservations.length === 0 ? <p className="text-sm text-slate-600">Aucune réservation validée.</p> : reservations.map((reservation) => {
            const familyStyle = getFamilyStyle(reservation.user_family);
            return <div key={reservation.id} className={`rounded-2xl border p-3 ${familyStyle.cell}`} style={getFamilyVisualStyle(reservation.user_family)}>
              <p className="text-base font-semibold"><span className="font-bold">{familyStyle.label}</span> <span className="opacity-80">·</span> {reservation.user_first_name ?? reservation.user_full_name}</p>
              <p className="text-sm">{formatDate(reservation.start_date)} → {formatDate(reservation.end_date)}</p>
            </div>;
          })}
        </section>
      </AppShell>
    </ProtectedPage>
  );
}
