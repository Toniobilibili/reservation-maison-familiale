'use client';

import type { Reservation } from '@/lib/types';

const statusStyle: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
};

export function ReservationCard({ reservation }: { reservation: Reservation }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{reservation.user_full_name ?? 'Famille'}</p>
          <p className="mt-1 text-sm text-slate-600">
            {reservation.start_date} → {reservation.end_date}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[reservation.status]}`}>
          {reservation.status === 'approved' ? 'Validée' : reservation.status === 'rejected' ? 'Refusée' : 'En attente'}
        </span>
      </div>
      <div className="mt-3 space-y-2 text-sm text-slate-600">
        <p>Invités : {reservation.guests}</p>
        {reservation.comment ? <p>Commentaire : {reservation.comment}</p> : null}
      </div>
    </article>
  );
}
