import type { FamilyPeriod } from '@/lib/types';

export const defaultFamilyPeriods: FamilyPeriod[] = [
  { id: '2025-noel', year: 2026, family: 'PUGNET', label: 'Vacances de Noël', start_date: '2025-12-20', end_date: '2026-01-05', created_at: '', updated_at: '' },
  { id: '2026-hiver', year: 2026, family: 'BRETEAU', label: "Vacances d'hiver", start_date: '2026-02-07', end_date: '2026-03-09', created_at: '', updated_at: '' },
  { id: '2026-paques', year: 2026, family: 'PLAGNOL', label: 'Week-end de Pâques', start_date: '2026-04-03', end_date: '2026-04-06', created_at: '', updated_at: '' },
  { id: '2026-mai', year: 2026, family: 'PUGNET', label: 'Week-end de mai', start_date: '2026-05-01', end_date: '2026-05-03', created_at: '', updated_at: '' },
  { id: '2026-ascension', year: 2026, family: 'BRETEAU', label: 'Ascension', start_date: '2026-05-14', end_date: '2026-05-17', created_at: '', updated_at: '' },
  { id: '2026-pentecote', year: 2026, family: 'NGUYEN', label: 'Pentecôte', start_date: '2026-05-23', end_date: '2026-05-25', created_at: '', updated_at: '' },
  { id: '2026-ete-1', year: 2026, family: 'PUGNET', label: 'Vacances été', start_date: '2026-07-04', end_date: '2026-07-18', created_at: '', updated_at: '' },
  { id: '2026-ete-2', year: 2026, family: 'BRETEAU', label: 'Vacances été', start_date: '2026-07-18', end_date: '2026-08-01', created_at: '', updated_at: '' },
  { id: '2026-ete-3', year: 2026, family: 'NGUYEN', label: 'Vacances été', start_date: '2026-08-01', end_date: '2026-08-15', created_at: '', updated_at: '' },
  { id: '2026-ete-4', year: 2026, family: 'PLAGNOL', label: 'Vacances été', start_date: '2026-08-15', end_date: '2026-08-29', created_at: '', updated_at: '' },
  { id: '2026-09-29', year: 2026, family: 'PUGNET', label: 'Week-end familial', start_date: '2026-08-29', end_date: '2026-08-30', created_at: '', updated_at: '' },
  { id: '2026-09-05', year: 2026, family: 'BRETEAU', label: 'Week-end familial', start_date: '2026-09-05', end_date: '2026-09-06', created_at: '', updated_at: '' },
  { id: '2026-09-12', year: 2026, family: 'NGUYEN', label: 'Week-end familial', start_date: '2026-09-12', end_date: '2026-09-13', created_at: '', updated_at: '' },
  { id: '2026-09-19', year: 2026, family: 'PLAGNOL', label: 'Week-end familial', start_date: '2026-09-19', end_date: '2026-09-20', created_at: '', updated_at: '' },
  { id: '2026-09-26', year: 2026, family: 'PUGNET', label: 'Week-end familial', start_date: '2026-09-26', end_date: '2026-09-27', created_at: '', updated_at: '' },
];

export function getPeriodForDate(periods: FamilyPeriod[], dateKey: string) {
  return periods.find((period) => period.start_date <= dateKey && period.end_date >= dateKey);
}

export function isPeriodStart(period: FamilyPeriod | undefined, dateKey: string) {
  return Boolean(period && period.start_date === dateKey);
}

export function isPeriodEnd(period: FamilyPeriod | undefined, dateKey: string) {
  return Boolean(period && period.end_date === dateKey);
}

export function formatTime(time?: string | null) {
  return time ? time.slice(0, 5) : null;
}
