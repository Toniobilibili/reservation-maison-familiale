export const families = ['PUGNET', 'PLAGNOL', 'NGUYEN', 'BRETEAU'] as const;

export type Family = (typeof families)[number];

export const familyStyles: Record<string, { badge: string; cell: string; day: string; label: string }> = {
  NGUYEN: {
    badge: 'bg-yellow-200 text-yellow-950',
    cell: 'border-yellow-400 bg-yellow-100',
    day: 'border-yellow-100 bg-yellow-400 text-yellow-950',
    label: 'NGUYEN',
  },
  PLAGNOL: {
    badge: 'bg-purple-700 text-white',
    cell: 'border-purple-700 bg-purple-100',
    day: 'border-purple-100 bg-purple-700 text-white',
    label: 'PLAGNOL',
  },
  PUGNET: {
    badge: 'bg-[#7a3f16] text-white',
    cell: 'border-[#7a3f16] bg-[#f3dfc8]',
    day: 'border-[#f3dfc8] bg-[#7a3f16] text-white',
    label: 'PUGNET',
  },
  BRETEAU: {
    badge: 'bg-sky-600 text-white',
    cell: 'border-sky-600 bg-sky-100',
    day: 'border-sky-100 bg-sky-600 text-white',
    label: 'BRETEAU',
  },
};

export function normalizeFamily(family?: string | null) {
  return family
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

export function getFamilyStyle(family?: string | null) {
  const normalizedFamily = normalizeFamily(family);

  return (
    familyStyles[normalizedFamily ?? ''] ?? {
      badge: 'bg-slate-200 text-slate-800',
      cell: 'border-slate-300 bg-slate-100',
      day: 'border-slate-300 bg-slate-100 text-slate-800',
      label: family?.trim() || 'Famille',
    }
  );
}

export function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR');
}
