'use client';

import type { Reservation } from '@/lib/types';
import { formatDate, getFamilyStyle } from '@/lib/families';
import { formatTime } from '@/lib/planning';

const statusStyle: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
};

const statusLabel: Record<string, string> = {
  pending: 'En attente',
  approved: 'Validée',
  rejected: 'Refusée',
};

export function ReservationCard({ reservation }: { reservation: Reservation }) {
  const familyStyle = getFamilyStyle(reservation.user_family);
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
            <span className={`rounded-full px-3 py-1 text-sm ${familyStyle.badge}`}>{familyStyle.label}</span>
            <span>{reservation.user_first_name ?? reservation.user_full_name ?? 'Famille'}</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {formatDate(reservation.start_date)} → {formatDate(reservation.end_date)}
            {reservation.start_time || reservation.end_time ? ` · ${formatTime(reservation.start_time) ?? '--:--'} - ${formatTime(reservation.end_time) ?? '--:--'}` : ''}
          </p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[reservation.status]}`}>
          {statusLabel[reservation.status]}
        </span>
      </div>
      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        <p>Type : {reservation.reservation_type ?? 'Séjour'}</p>
        <p>Invités : {reservation.guests}</p>
        {reservation.comment ? <p className="break-words">Commentaire : {reservation.comment}</p> : null}
      </div>
    </article>
  );
}
