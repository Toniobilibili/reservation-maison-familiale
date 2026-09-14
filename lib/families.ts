export const families = ['PUGNET', 'PLAGNOL', 'NGUYEN', 'BRETEAU'] as const;

export type Family = (typeof families)[number];

export const familyStyles: Record<string, { badge: string; cell: string; day: string; label: string; background: string; border: string; text: string }> = {
  NGUYEN: {
    badge: 'bg-yellow-200 text-yellow-950',
    cell: 'border-yellow-400 bg-yellow-100',
    day: 'border-yellow-100 bg-yellow-400 text-yellow-950',
    label: 'NGUYEN',
    background: '#fef3c7',
    border: '#ca8a04',
    text: '#713f12',
  },
  PLAGNOL: {
    badge: 'bg-purple-700 text-white',
    cell: 'border-purple-700 bg-purple-100',
    day: 'border-purple-100 bg-purple-700 text-white',
    label: 'PLAGNOL',
    background: '#f3e8ff',
    border: '#7e22ce',
    text: '#581c87',
  },
  PUGNET: {
    badge: 'bg-orange-500 text-white',
    cell: 'border-orange-500 bg-orange-50',
    day: 'border-orange-50 bg-orange-500 text-white',
    label: 'PUGNET',
    background: '#fff7ed',
    border: '#f97316',
    text: '#c2410c',
  },
  BRETEAU: {
    badge: 'bg-sky-600 text-white',
    cell: 'border-sky-600 bg-sky-100',
    day: 'border-sky-100 bg-sky-600 text-white',
    label: 'BRETEAU',
    background: '#e0f2fe',
    border: '#0284c7',
    text: '#0c4a6e',
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
      background: '#f1f5f9',
      border: '#cbd5e1',
      text: '#334155',
    }
  );
}

export function getFamilyVisualStyle(family?: string | null) {
  const style = getFamilyStyle(family);
  return {
    backgroundColor: style.background,
    borderColor: style.border,
    color: style.text,
  };
}

export function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR');
}
