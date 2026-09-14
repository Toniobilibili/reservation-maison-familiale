'use client';

import type { Reservation } from '@/lib/types';
import type { ReactNode } from 'react';
import { formatDate, getFamilyStyle, getFamilyVisualStyle } from '@/lib/families';

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

export function ReservationCard({ reservation, actions }: { reservation: Reservation; actions?: ReactNode }) {
  const familyStyle = getFamilyStyle(reservation.user_family);
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
            <span className={`rounded-full border px-3 py-1 text-sm ${familyStyle.badge}`} style={getFamilyVisualStyle(reservation.user_family)}>{familyStyle.label}</span>
            <span>{reservation.user_first_name ?? reservation.user_full_name ?? 'Famille'}</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {formatDate(reservation.start_date)} → {formatDate(reservation.end_date)}
          </p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[reservation.status]}`}>
          {statusLabel[reservation.status]}
        </span>
      </div>
      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        {reservation.comment ? <p className="break-words">Commentaire : {reservation.comment}</p> : null}
      </div>
      {actions ? <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">{actions}</div> : null}
    </article>
  );
}
