'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProtectedPage } from '@/components/ProtectedPage';
import { supabase } from '@/lib/supabaseClient';
import type { Reservation } from '@/lib/types';
import { ReservationCard } from '@/components/ReservationCard';

const weekdayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

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

function holidaysForYear(year: number) {
  return {
    [`${year}-01-01`]: "Jour de l'an",
    [`${year}-05-01`]: 'Fête du Travail',
    [`${year}-05-08`]: 'Victoire 1945',
    [`${year}-07-14`]: 'Fête nationale',
    [`${year}-08-15`]: 'Assomption',
    [`${year}-11-01`]: 'Toussaint',
    [`${year}-11-11`]: 'Armistice',
    [`${year}-12-25`]: 'Noël',
  } as Record<string, string>;
}

export default function CalendarPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthIndex, setMonthIndex] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  const displayReservations = reservations;

  useEffect(() => {
    async function loadReservations() {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, start_date, end_date, status, guests, comment, user_id, profiles(full_name)')
        .order('start_date', { ascending: true });

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
    loadReservations();
  }, []);

  const holidays = useMemo(() => holidaysForYear(year), [year]);

  const reservedMap = useMemo(() => {
    const map: Record<string, Reservation[]> = {};

    displayReservations.forEach((reservation) => {
      if (reservation.status === 'rejected') {
        return;
      }
      const current = new Date(reservation.start_date);
      const end = new Date(reservation.end_date);

      while (current <= end) {
        const key = getDateKey(current);
        map[key] = map[key] || [];
        map[key].push(reservation);
        current.setDate(current.getDate() + 1);
      }
    });

    return map;
  }, [displayReservations]);

  const grid = useMemo(() => getCalendarGrid(year, monthIndex), [monthIndex, year]);

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

  const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  const todaysReservations = displayReservations.filter((reservation) => reservation.status !== 'rejected');

  return (
    <ProtectedPage>
      <AppShell title="Calendrier">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button onClick={goPreviousMonth} className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 transition hover:bg-slate-50">
                ←
              </button>
              <h2 className="text-lg font-semibold text-slate-900">{monthLabel}</h2>
              <button onClick={goNextMonth} className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 transition hover:bg-slate-50">
                →
              </button>
              </div>
            </div>

          <section className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Prochaines réservations</h3>
              <p className="mt-2 text-sm text-slate-600">Détails des réservations saisies.</p>
            </div>
            {loading ? (
              <p className="text-sm text-slate-600">Chargement du calendrier...</p>
            ) : todaysReservations.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600 shadow-soft">
                Aucune réservation pour le moment.
              </div>
            ) : (
              <div className="space-y-4">
                {todaysReservations.map((reservation) => (
                  <ReservationCard key={reservation.id} reservation={reservation} />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">{monthLabel}</h3>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">Férié</span>
                <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-800">Réservé</span>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-slate-500">
              {weekdayNames.map((name) => (
                <div key={name} className="py-1 text-[10px] sm:py-2 sm:text-xs">
                  {name}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((week, weekIndex) =>
                week.map((day) => {
                  const key = getDateKey(day);
                  const isCurrentMonth = day.getMonth() === monthIndex;
                  const holidayLabel = holidays[key];
                  const dayReservations = reservedMap[key];
                  const isReserved = Boolean(dayReservations?.length);
                  const reservedLabel = isReserved ? dayReservations[0].user_full_name : null;

                  return (
                    <div
                      key={`${weekIndex}-${key}`}
                      className={`min-h-[60px] rounded-2xl border p-2 text-left transition sm:min-h-[88px] sm:rounded-3xl sm:p-3 ${
                        isReserved
                          ? 'border-rose-300 bg-rose-50 text-slate-900'
                          : holidayLabel
                          ? 'border-emerald-300 bg-emerald-50 text-slate-900'
                          : 'border-slate-200 bg-white text-slate-700'
                      } ${isCurrentMonth ? '' : 'opacity-50'}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-semibold sm:text-sm">{day.getDate()}</span>
                        {holidayLabel ? (
                          <span className="rounded-full bg-emerald-700 px-1 py-0.5 text-[8px] font-semibold uppercase text-white sm:px-2 sm:py-0.5 sm:text-[10px]">
                            Férié
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 min-h-[28px] text-[9px] leading-3 sm:mt-2 sm:min-h-[34px] sm:text-[11px] sm:leading-5">
                        {isReserved ? (
                          <>
                            <p className="font-semibold text-rose-700">Réservé</p>
                            <p className="text-slate-700">{reservedLabel}</p>
                          </>
                        ) : holidayLabel ? (
                          <p className="text-emerald-700">{holidayLabel}</p>
                        ) : (
                          <p className="text-slate-500">Libre</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </AppShell>
    </ProtectedPage>
  );
}
