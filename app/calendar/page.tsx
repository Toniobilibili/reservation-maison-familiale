'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProtectedPage } from '@/components/ProtectedPage';
import { supabase } from '@/lib/supabaseClient';
import type { Reservation } from '@/lib/types';
import { ReservationCard } from '@/components/ReservationCard';
import { families, formatDate, getFamilyStyle, getFamilyVisualStyle } from '@/lib/families';
import { defaultFamilyPeriods, getPeriodForDate, isPeriodEnd, isPeriodStart } from '@/lib/planning';
import type { FamilyPeriod, FamilySetting } from '@/lib/types';

const weekdayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

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

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function getBarPosition(startDate: string, endDate: string, week: Date[]) {
  const weekStart = week[0];
  const weekEnd = week[6];
  const start = parseDateKey(startDate) < weekStart ? weekStart : parseDateKey(startDate);
  const end = parseDateKey(endDate) > weekEnd ? weekEnd : parseDateKey(endDate);
  const offset = daysBetween(weekStart, start);
  const span = daysBetween(start, end) + 1;

  return {
    left: `calc(${offset} * 14.2857% + 2px)`,
    width: `calc(${span} * 14.2857% - 4px)`,
  };
}

function getEasterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function holidaysForYear(year: number) {
  const easterSunday = getEasterSunday(year);

  return {
    [`${year}-01-01`]: "Jour de l'an",
    [getDateKey(addDays(easterSunday, 1))]: 'Lundi de Pâques',
    [`${year}-05-01`]: 'Fête du Travail',
    [`${year}-05-08`]: 'Victoire 1945',
    [getDateKey(addDays(easterSunday, 39))]: 'Ascension',
    [getDateKey(addDays(easterSunday, 50))]: 'Lundi de Pentecôte',
    [`${year}-07-14`]: 'Fête nationale',
    [`${year}-08-15`]: 'Assomption',
    [`${year}-11-01`]: 'Toussaint',
    [`${year}-11-11`]: 'Armistice',
    [`${year}-12-25`]: 'Noël',
  } as Record<string, string>;
}

const zoneCVacations: Array<{ start: string; end: string; label: string }> = [
  { start: '2025-10-18', end: '2025-11-03', label: 'Vacances de la Toussaint · Zone C' },
  { start: '2025-12-20', end: '2026-01-05', label: 'Vacances de Noël · Zone C' },
  { start: '2026-02-21', end: '2026-03-09', label: "Vacances d'hiver · Zone C" },
  { start: '2026-04-18', end: '2026-05-04', label: 'Vacances de printemps · Zone C' },
  { start: '2026-07-04', end: '2026-09-01', label: "Vacances d'été · Zone C" },
  { start: '2026-10-17', end: '2026-11-02', label: 'Vacances de la Toussaint · Zone C' },
  { start: '2026-12-19', end: '2027-01-04', label: 'Vacances de Noël · Zone C' },
  { start: '2027-02-06', end: '2027-02-22', label: "Vacances d'hiver · Zone C" },
  { start: '2027-04-03', end: '2027-04-19', label: 'Vacances de printemps · Zone C' },
  { start: '2027-07-03', end: '2027-09-01', label: "Vacances d'été · Zone C" },
];

function schoolVacationsForYear(year: number) {
  const vacations: Record<string, string> = {};

  zoneCVacations.forEach(({ start, end, label }) => {
    const current = parseDateKey(start);
    const last = parseDateKey(end);

    while (current <= last) {
      if (current.getFullYear() === year) vacations[getDateKey(current)] = label;
      current.setDate(current.getDate() + 1);
    }
  });

  return vacations;
}

export default function CalendarPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthIndex, setMonthIndex] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [familyPeriods, setFamilyPeriods] = useState<FamilyPeriod[]>(defaultFamilyPeriods);
  const [familySettings, setFamilySettings] = useState<FamilySetting[]>([]);

  useEffect(() => {
    async function loadReservations() {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, start_date, end_date, status, guests, comment, user_id, created_at, updated_at, profiles(full_name, first_name, family)')
        .order('start_date', { ascending: true });

      if (data) {
        setReservations(
          data.map((item: any) => {
            const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;

            return {
              ...item,
              user_full_name: profile?.full_name ?? 'Famille',
              user_first_name: profile?.first_name ?? undefined,
              user_family: profile?.family ?? undefined,
            };
          })
        );
      }
      if (error) {
        console.error(error.message);
      }

      const { data: periodData } = await supabase
        .from('family_periods')
        .select('id, year, family, label, start_date, end_date, created_at, updated_at')
        .eq('year', year)
        .order('start_date', { ascending: true });

      if (periodData && periodData.length > 0) {
        setFamilyPeriods(periodData as FamilyPeriod[]);
      }
      const { data: settingData } = await supabase.from('family_settings').select('family, label, bg_color, border_color, text_color, updated_at').order('family');
      if (settingData) setFamilySettings(settingData as FamilySetting[]);
      setLoading(false);
    }
    loadReservations();
  }, [year]);

  const holidays = useMemo(() => holidaysForYear(year), [year]);
  const schoolVacations = useMemo(() => schoolVacationsForYear(year), [year]);

  const reservedMap = useMemo(() => {
    const map: Record<string, Reservation[]> = {};

    reservations.forEach((reservation) => {
      if (reservation.status === 'rejected') {
        return;
      }

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

  const grid = useMemo(() => getCalendarGrid(year, monthIndex), [monthIndex, year]);
  const monthStart = useMemo(() => new Date(year, monthIndex, 1), [monthIndex, year]);
  const monthEnd = useMemo(() => new Date(year, monthIndex + 1, 0), [monthIndex, year]);

  const monthReservations = useMemo(
    () =>
      reservations.filter((reservation) => {
        if (reservation.status === 'rejected') {
          return false;
        }

        const reservationStart = parseDateKey(reservation.start_date);
        const reservationEnd = parseDateKey(reservation.end_date);
        return reservationStart <= monthEnd && reservationEnd >= monthStart;
      }),
    [monthEnd, monthStart, reservations]
  );

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

  return (
    <ProtectedPage>
      <AppShell title="Calendrier">
        <div className="space-y-5 sm:space-y-6">
          <div className="flex items-center justify-between gap-3">
            <button onClick={goPreviousMonth} className="h-11 w-11 rounded-2xl border border-slate-200 bg-white text-lg font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
              ←
            </button>
            <h2 className="min-w-0 flex-1 text-center text-lg font-semibold capitalize text-slate-900 sm:text-xl">{monthLabel}</h2>
            <button onClick={goNextMonth} className="h-11 w-11 rounded-2xl border border-slate-200 bg-white text-lg font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
              →
            </button>
          </div>

          <section className="-mx-1 rounded-3xl border border-slate-200 bg-white p-2 shadow-soft sm:mx-0 sm:p-5">
            <div className="mb-4 flex flex-col gap-3">
              <h3 className="text-lg font-semibold capitalize text-slate-900 sm:text-xl">{monthLabel}</h3>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                <h4 className="text-sm font-semibold text-slate-900">Demandes du planning JPEG</h4>
                <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">
                  Intérieur de la case : couleur de la famille ayant une réservation.
                </p>
                <p className="text-xs leading-5 text-slate-600 sm:text-sm">
                  Encadrement extérieur : planning « Programme familial » issu du JPEG envoyé par Laurent.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-emerald-700">
                  <span className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-3 py-1.5">Vacances scolaires · Zone C</span>
                  <span className="text-slate-500">Les jours concernés sont marqués en vert.</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                  {families.map((family) => {
                    const familyStyle = getFamilyStyle(family);
                    const familySetting = familySettings.find((setting) => setting.family === family);
                    const visualStyle = familySetting
                      ? { borderColor: familySetting.border_color, color: familySetting.text_color }
                      : { borderColor: familyStyle.border, color: familyStyle.text };
                    return (
                      <span key={family} className="rounded-xl border-2 bg-white px-3 py-1.5 text-xs font-semibold" style={visualStyle}>
                        {familyStyle.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-px text-center text-[10px] font-semibold uppercase text-slate-500 sm:gap-1 sm:text-xs">
              {weekdayNames.map((name) => (
                <div key={name} className="py-1 sm:py-2">
                  {name}
                </div>
              ))}
            </div>

            <div className="space-y-px sm:space-y-1">
              {grid.map((week, weekIndex) => {
                const weekStart = week[0];
                const weekEnd = week[6];
                const weekPeriods = familyPeriods.filter((period) => parseDateKey(period.start_date) <= weekEnd && parseDateKey(period.end_date) >= weekStart);
                const weekReservations = reservations.filter((reservation) => reservation.status !== 'rejected' && parseDateKey(reservation.start_date) <= weekEnd && parseDateKey(reservation.end_date) >= weekStart);

                return <div key={`week-${weekIndex}`} className="relative grid grid-cols-7 gap-px sm:gap-1">
                {week.map((day) => {
                  const key = getDateKey(day);
                  const isCurrentMonth = day.getMonth() === monthIndex;
                  const holidayLabel = holidays[key];
                  const schoolVacationLabel = schoolVacations[key];
                  const dayReservations = reservedMap[key];
                  const isReserved = Boolean(dayReservations?.length);
                  const familyPeriod = getPeriodForDate(familyPeriods, key);
                  const periodStyle = getFamilyStyle(familyPeriod?.family);
                  const periodSetting = familySettings.find((setting) => setting.family === familyPeriod?.family);
                  const periodStart = isPeriodStart(familyPeriod, key);
                  const periodEnd = isPeriodEnd(familyPeriod, key);
                  const periodLabel = periodStart ? `${familyPeriod?.family} · ${familyPeriod?.label}` : null;
                  const hasMultiDayReservation = dayReservations?.some((reservation) => reservation.start_date !== reservation.end_date);
                  const hasMultiDayPeriod = Boolean(familyPeriod && familyPeriod.start_date !== familyPeriod.end_date);

                  return (
                    <div
                      key={`${weekIndex}-${key}`}
                      className={`min-h-[112px] border p-1 text-left transition sm:min-h-[148px] sm:p-2 ${
                        familyPeriod
                          ? `${periodStyle.cell} ${periodStart ? 'rounded-l-2xl border-l-4' : 'border-l-0'} ${periodEnd ? 'rounded-r-2xl border-r-4' : 'border-r-0'} border-y-2`
                          : holidayLabel || schoolVacationLabel
                          ? 'rounded-xl border-emerald-300 bg-emerald-50 text-slate-900'
                          : 'rounded-xl border-slate-200 bg-white text-slate-700'
                      } ${isCurrentMonth ? '' : 'opacity-40'}`}
                      style={periodSetting ? { backgroundColor: periodSetting.bg_color, borderColor: periodSetting.border_color, color: periodSetting.text_color } : undefined}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-semibold sm:text-sm">{day.getDate()}</span>
                        {holidayLabel ? <span className="hidden rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-semibold uppercase text-white sm:inline">Férié</span> : null}
                        {schoolVacationLabel ? <span className="hidden rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold uppercase text-white sm:inline">Zone C</span> : null}
                      </div>
                      {periodLabel && !hasMultiDayPeriod ? <p className="mt-1 truncate text-[8px] font-bold uppercase leading-3 sm:text-[10px]" title={periodLabel}>{periodLabel}</p> : null}
                      <div className="mt-1 min-w-0 space-y-1 text-[10px] leading-3 sm:mt-2 sm:text-xs sm:leading-4">
                        {isReserved && !hasMultiDayReservation ? (
                          dayReservations.map((reservation) => {
                            const person = reservation.user_first_name ?? reservation.user_full_name ?? 'Famille';
                            const reservationFamily = reservation.user_family;

                            return (
                              <div key={reservation.id} className="rounded-lg border px-1.5 py-1 shadow-sm" style={getFamilyVisualStyle(reservationFamily)} title={person}>
                                <p className="truncate font-bold">{person}</p>
                              </div>
                            );
                          })
                        ) : !hasMultiDayPeriod && (holidayLabel || schoolVacationLabel) ? (
                          <p className="truncate text-emerald-700">{holidayLabel ?? schoolVacationLabel}</p>
                        ) : (
                          <p className="text-slate-500">Libre</p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {weekPeriods.map((period) => {
                  const style = getFamilyStyle(period.family);
                  const setting = familySettings.find((item) => item.family === period.family);
                  const position = getBarPosition(period.start_date, period.end_date, week);
                  return <div key={`period-bar-${weekIndex}-${period.id}`} className="pointer-events-none absolute top-8 z-10 overflow-hidden rounded-lg border-2 px-1.5 py-1 text-[9px] font-bold leading-3 shadow-sm sm:px-2 sm:text-[11px] sm:leading-4" style={{ ...position, backgroundColor: setting?.bg_color ?? style.background, borderColor: setting?.border_color ?? style.border, color: setting?.text_color ?? style.text }} title={`${period.family} · ${period.label}`}><span className="block truncate">{period.family} · {period.label}</span></div>;
                })}
                {weekReservations.map((reservation) => {
                  const style = getFamilyStyle(reservation.user_family);
                  const position = getBarPosition(reservation.start_date, reservation.end_date, week);
                  const person = reservation.user_first_name ?? reservation.user_full_name ?? 'Famille';
                  return <div key={`reservation-bar-${weekIndex}-${reservation.id}`} className="pointer-events-none absolute top-[4.5rem] z-10 overflow-hidden rounded-lg border-2 px-1.5 py-1 text-[9px] font-bold leading-3 shadow-sm sm:px-2 sm:text-[11px] sm:leading-4" style={{ ...position, backgroundColor: style.background, borderColor: style.border, color: style.text }} title={`${person} · ${formatDate(reservation.start_date)} → ${formatDate(reservation.end_date)}`}><span className="block truncate">{person} · {reservation.guests} pers.</span></div>;
                })}
                </div>;
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-900">Réservations du mois</h3>
              <p className="text-sm leading-6 text-slate-600">Détails des réservations qui touchent {monthLabel}.</p>
            </div>
            {loading ? (
              <p className="text-sm text-slate-600">Chargement du calendrier...</p>
            ) : monthReservations.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600 shadow-soft">
                Aucune réservation sur ce mois.
              </div>
            ) : (
              <div className="space-y-4">
                {monthReservations.map((reservation) => (
                  <ReservationCard key={reservation.id} reservation={reservation} />
                ))}
              </div>
            )}
          </section>
        </div>
      </AppShell>
    </ProtectedPage>
  );
}
