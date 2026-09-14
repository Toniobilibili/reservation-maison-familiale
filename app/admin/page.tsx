'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { createWorker } from 'tesseract.js';
import { AppShell } from '@/components/AppShell';
import { ProtectedPage } from '@/components/ProtectedPage';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import type { Reservation } from '@/lib/types';
import type { FamilyPeriod, PlanningImport } from '@/lib/types';
import { ReservationCard } from '@/components/ReservationCard';
import { defaultFamilyPeriods } from '@/lib/planning';

type OcrPeriod = Omit<FamilyPeriod, 'id' | 'created_at' | 'updated_at'> & { id: string };

function normalizedLineMonth(line: string, monthNumbers: Record<string, number>) {
  const normalizedLine = line.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return Object.entries(monthNumbers).find(([month]) => normalizedLine.includes(month.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))?.[1];
}

function parseOcrPeriods(text: string, year: number, families: string[]): OcrPeriod[] {
  const normalizedFamilies = families.map((family) => ({ original: family, normalized: family.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() }));
  const periods: OcrPeriod[] = [];
  const datePattern = /(\d{1,2})\s*(?:[./-]\s*(\d{1,2})(?:[./-]\s*(\d{2,4}))?|\s*(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s*(\d{2,4})?)/gi;
  const monthNumbers: Record<string, number> = {
    janvier: 1,
    février: 2,
    fevrier: 2,
    mars: 3,
    avril: 4,
    mai: 5,
    juin: 6,
    juillet: 7,
    août: 8,
    aout: 8,
    septembre: 9,
    octobre: 10,
    novembre: 11,
    décembre: 12,
    decembre: 12,
  };

  text.split(/\r?\n/).forEach((line, index) => {
    const matches = [...line.matchAll(datePattern)];
    const buildDate = (day: string, month: number, yearText?: string) => {
      const parsedYear = yearText ? Number(yearText.length === 2 ? `20${yearText}` : yearText) : year;
      return `${parsedYear}-${String(month).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`;
    };
    const parenthesizedDates = line.match(/\((\d{1,2}(?:\/\d{1,2}){1,3})\)/)?.[1]?.split('/');
    const contextMonth = normalizedLineMonth(line, monthNumbers);
    const normalizedLine = line.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    let startDate = '';
    let endDate = '';
    if (parenthesizedDates && parenthesizedDates.length >= 2 && contextMonth) {
      startDate = buildDate(parenthesizedDates[0], contextMonth);
      endDate = buildDate(parenthesizedDates[parenthesizedDates.length - 1], contextMonth);
    } else {
      if (matches.length < 2) return;
      const toDate = (match: RegExpMatchArray) => {
        const month = match[2] ? Number(match[2]) : monthNumbers[match[4].toLowerCase()];
        return buildDate(match[1], month, match[3] ?? match[5]);
      };
      startDate = toDate(matches[0]);
      endDate = toDate(matches[1]);
    }
    const textAfterColon = line.match(/[:：]\s*([^()]+)/)?.[1]?.trim() ?? '';
    const detectedFamily = textAfterColon.replace(/[.,;:]+$/, '').trim();
    const family = normalizedFamilies.find((candidate) => normalizedLine.includes(candidate.normalized))?.original ?? detectedFamily;
    const label = line
      .replace(datePattern, '')
      .replace(/[:：].*$/, '')
      .replace(new RegExp(families.join('|'), 'ig'), '')
      .replace(/[|;,:-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^_?du\s+au$/i, '')
      .trim() || `Période importée ${index + 1}`;
    if (startDate <= endDate) periods.push({ id: `ocr-${index}`, year, family, label, start_date: startDate, end_date: endDate });
  });
  return periods;
}

export default function AdminPage() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'member'>('member');
  const [userCreateLoading, setUserCreateLoading] = useState(false);
  const [userCreateError, setUserCreateError] = useState<string | null>(null);
  const [userCreateSuccess, setUserCreateSuccess] = useState<string | null>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [periods, setPeriods] = useState<FamilyPeriod[]>(defaultFamilyPeriods);
  const [periodForm, setPeriodForm] = useState({ id: '', year: '2026', family: 'PUGNET', label: '', start_date: '', end_date: '' });
  const [periodMessage, setPeriodMessage] = useState<string | null>(null);
  const [planningImage, setPlanningImage] = useState<string | null>(null);
  const [planningFileName, setPlanningFileName] = useState('');
  const [planningYear, setPlanningYear] = useState('2027');
  const [planningImports, setPlanningImports] = useState<PlanningImport[]>([]);
  const [ocrPeriods, setOcrPeriods] = useState<OcrPeriod[]>([]);
  const [ocrText, setOcrText] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, start_date, end_date, status, guests, comment, user_id, created_at, updated_at, profiles(full_name, first_name, family)')
        .order('created_at', { ascending: false });
      if (data) {
        setReservations(
          data.map((item: any) => ({
            ...item,
            user_full_name: item.profiles?.full_name ?? 'Famille',
            user_first_name: item.profiles?.first_name ?? undefined,
            user_family: item.profiles?.family ?? undefined,
          }))
        );
      }
      if (error) {
        console.error(error.message);
      }
      const { data: periodData } = await supabase.from('family_periods').select('id, year, family, label, start_date, end_date, created_at, updated_at').order('start_date', { ascending: true });
      if (periodData && periodData.length > 0) setPeriods(periodData as FamilyPeriod[]);
      const { data: importData } = await supabase.from('planning_imports').select('id, year, file_name, image_url, status, extracted_periods, created_by, created_at').order('created_at', { ascending: false });
      if (importData) setPlanningImports(importData as PlanningImport[]);
      setLoading(false);
    }
    loadAll();
  }, []);

  async function savePeriod(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPeriodMessage(null);
    const payload = { year: Number(periodForm.year), family: periodForm.family, label: periodForm.label, start_date: periodForm.start_date, end_date: periodForm.end_date };
    const query = periodForm.id && !periodForm.id.startsWith('2026-')
      ? supabase.from('family_periods').update(payload).eq('id', periodForm.id)
      : supabase.from('family_periods').insert(payload).select().single();
    const { data, error } = await query;
    if (error) {
      setPeriodMessage(error.message);
      return;
    }
    const saved = (periodForm.id && !periodForm.id.startsWith('2026-') ? { ...payload, id: periodForm.id } : data) as FamilyPeriod;
    setPeriods((current) => periodForm.id && !periodForm.id.startsWith('2026-') ? current.map((period) => period.id === periodForm.id ? { ...period, ...saved } : period) : [...current, saved]);
    setPeriodForm({ id: '', year: periodForm.year, family: periodForm.family, label: '', start_date: '', end_date: '' });
    setPeriodMessage('Période enregistrée.');
  }

  async function deletePeriod(id: string) {
    if (!window.confirm('Supprimer cette période ?')) return;
    if (id.startsWith('2026-')) {
      setPeriods((current) => current.filter((period) => period.id !== id));
      return;
    }
    const { error } = await supabase.from('family_periods').delete().eq('id', id);
    if (error) {
      setPeriodMessage(error.message);
      return;
    }
    setPeriods((current) => current.filter((period) => period.id !== id));
  }

  async function handlePlanningImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPlanningFileName(file.name);
    setOcrPeriods([]);
    setOcrText('');
    setOcrError(null);
    setOcrLoading(true);
    setOcrProgress(0);
    const reader = new FileReader();
    reader.onload = () => setPlanningImage(String(reader.result));
    reader.readAsDataURL(file);
    try {
      const worker = await createWorker('fra', 1, { logger: (message) => setOcrProgress(Math.round((message.progress ?? 0) * 100)) });
      const result = await worker.recognize(file);
      await worker.terminate();
      setOcrText(result.data.text);
      const families = [...new Set(periods.map((item) => item.family).filter(Boolean))];
      setOcrPeriods(parseOcrPeriods(result.data.text, Number(planningYear), families));
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : 'La lecture OCR a échoué.');
    } finally {
      setOcrLoading(false);
    }
  }

  async function savePlanningImport() {
    if (!planningImage || !planningFileName || !user) return;
    const extractedPeriods = (ocrPeriods.length > 0 ? ocrPeriods : periods
      .filter((period) => period.year === Number(planningYear) && !period.id.startsWith(String(planningYear))))
      .map(({ id, ...period }) => period);
    const { data, error } = await supabase.from('planning_imports').insert({
      year: Number(planningYear),
      file_name: planningFileName,
      image_url: planningImage,
      status: extractedPeriods.length > 0 ? 'validated' : 'draft',
      extracted_periods: extractedPeriods,
      created_by: user.id,
    }).select('id, year, file_name, image_url, status, extracted_periods, created_by, created_at').single();
    if (data) setPlanningImports((current) => [data as PlanningImport, ...current]);
    if (!error && extractedPeriods.length > 0) {
      const { error: deleteError } = await supabase.from('family_periods').delete().eq('year', Number(planningYear));
      const { data: syncedPeriods, error: syncError } = deleteError
        ? { data: null, error: deleteError }
        : await supabase.from('family_periods').insert(extractedPeriods).select('id, year, family, label, start_date, end_date, created_at, updated_at');
      if (syncError) {
        setPeriodMessage(syncError.message);
        return;
      }
      if (syncedPeriods) setPeriods((current) => [...current.filter((period) => period.year !== Number(planningYear)), ...(syncedPeriods as FamilyPeriod[])]);
    }
    setPeriodMessage(error ? error.message : extractedPeriods.length > 0 ? 'Import enregistré et planning synchronisé automatiquement.' : 'Import enregistré en brouillon. Ajoutez les périodes dans le planning avant de synchroniser le calendrier.');
  }

  async function removeReservation(id: string) {
    if (!window.confirm('Supprimer cette réservation ?')) {
      return;
    }

    setReservationError(null);
    setActionLoading(id);
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sessionData.session?.access_token ?? ''}` },
      body: JSON.stringify({ id }),
    });
    const result = await response.json();
    if (!response.ok) {
      setReservationError(result.error ?? 'Impossible de supprimer la réservation.');
    } else if (!result.deleted) {
      setReservationError('La réservation est introuvable ou déjà supprimée.');
    } else {
      setReservations((current) => current.filter((reservation) => reservation.id !== id));
    }
    setActionLoading(null);
  }

  async function removeAllReservations() {
    if (reservations.length === 0 || !window.confirm(`Supprimer les ${reservations.length} réservations ? Cette action est irréversible.`)) {
      return;
    }

    setReservationError(null);
    setActionLoading('all');
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sessionData.session?.access_token ?? ''}` },
      body: JSON.stringify({ all: true }),
    });
    const result = await response.json();
    if (!response.ok) {
      setReservationError(result.error ?? 'Impossible de supprimer les réservations.');
    } else if (!result.deleted) {
      setReservationError('Aucune réservation supprimée.');
    } else {
      setReservations([]);
    }
    setActionLoading(null);
  }

  async function createFamilyUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserCreateError(null);
    setUserCreateSuccess(null);
    setUserCreateLoading(true);

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (sessionError || !token || !user) {
      setUserCreateError('Session admin introuvable. Reconnectez-vous.');
      setUserCreateLoading(false);
      return;
    }

    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: newUserEmail,
        password: newUserPassword,
        fullName: newUserFullName,
        role: newUserRole,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setUserCreateError(result.error ?? 'Impossible de créer le compte.');
      setUserCreateLoading(false);
      return;
    }

    setUserCreateSuccess(`Compte créé pour ${newUserFullName}.`);
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserFullName('');
    setNewUserRole('member');
    setUserCreateLoading(false);
  }

  return (
    <ProtectedPage adminOnly>
      <AppShell title="Espace admin">
        <div className="space-y-5 sm:space-y-6">
          <nav aria-label="Raccourcis administrateur" className="flex gap-2 overflow-x-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-soft">
            <a href="#planning-import" className="flex min-h-11 shrink-0 items-center gap-2 rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
              <span aria-hidden="true">▣</span>
              Importer un planning
            </a>
            <a href="#family-periods" className="flex min-h-11 shrink-0 items-center rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
              Gérer les souhaits
            </a>
            <a href="#all-reservations" className="flex min-h-11 shrink-0 items-center rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
              Toutes les réservations
            </a>
          </nav>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
            <h2 className="text-lg font-semibold text-slate-900">Créer un compte famille</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Seul un administrateur connecté peut créer un compte.</p>

            <form onSubmit={createFamilyUser} className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Nom complet
                <input
                  type="text"
                  value={newUserFullName}
                  onChange={(event) => setNewUserFullName(event.target.value)}
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(event) => setNewUserEmail(event.target.value)}
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Mot de passe
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(event) => setNewUserPassword(event.target.value)}
                  minLength={6}
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Rôle
                <select
                  value={newUserRole}
                  onChange={(event) => setNewUserRole(event.target.value as 'admin' | 'member')}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
                >
                  <option value="member">Membre</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <div className="sm:col-span-2">
                {userCreateError ? <p className="mb-3 text-sm text-rose-600">{userCreateError}</p> : null}
                {userCreateSuccess ? <p className="mb-3 text-sm text-emerald-700">{userCreateSuccess}</p> : null}
                <button
                  type="submit"
                  disabled={userCreateLoading}
                  className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {userCreateLoading ? 'Création...' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </section>

          <section id="family-periods" className="scroll-mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
            <h2 className="text-lg font-semibold text-slate-900">Souhaits des familles</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Ajoutez ou corrigez les périodes souhaitées par une famille. Ces périodes ne créent pas de réservation individuelle.</p>
            <form onSubmit={savePeriod} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-sm font-medium text-slate-700">Année<input type="number" value={periodForm.year} onChange={(event) => setPeriodForm({ ...periodForm, year: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" /></label>
              <label className="block text-sm font-medium text-slate-700">Famille<select value={periodForm.family} onChange={(event) => setPeriodForm({ ...periodForm, family: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><option>PUGNET</option><option>PLAGNOL</option><option>NGUYEN</option><option>BRETEAU</option></select></label>
              <label className="block text-sm font-medium text-slate-700">Libellé<input required value={periodForm.label} onChange={(event) => setPeriodForm({ ...periodForm, label: event.target.value })} placeholder="Vacances été" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" /></label>
              <label className="block text-sm font-medium text-slate-700">Début<input required type="date" value={periodForm.start_date} onChange={(event) => setPeriodForm({ ...periodForm, start_date: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" /></label>
              <label className="block text-sm font-medium text-slate-700">Fin<input required type="date" value={periodForm.end_date} onChange={(event) => setPeriodForm({ ...periodForm, end_date: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" /></label>
              <div className="flex items-end gap-2"><button type="submit" className="min-h-11 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white">{periodForm.id ? 'Modifier' : 'Ajouter'}</button>{periodForm.id ? <button type="button" onClick={() => setPeriodForm({ id: '', year: periodForm.year, family: periodForm.family, label: '', start_date: '', end_date: '' })} className="min-h-11 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Annuler</button> : null}</div>
            </form>
            {periodMessage ? <p className="mt-3 text-sm text-slate-600">{periodMessage}</p> : null}
            <div className="mt-5 space-y-2">
              {periods.map((period) => <div key={period.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-700"><strong>{period.family}</strong> · {period.label} · {period.start_date} → {period.end_date}</p><div className="flex gap-2"><button type="button" onClick={() => setPeriodForm({ id: period.id, year: String(period.year), family: period.family, label: period.label, start_date: period.start_date, end_date: period.end_date })} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">Modifier</button><button type="button" onClick={() => deletePeriod(period.id)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">Supprimer</button></div></div>)}
            </div>
          </section>

          <section id="planning-import" className="scroll-mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
            <h2 className="text-lg font-semibold text-slate-900">Importer un planning JPEG</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Importez le JPEG du programme familial de Laurent. Le texte est reconnu localement, puis les dates détectées restent modifiables avant la synchronisation du planning.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_2fr]">
              <label className="block text-sm font-medium text-slate-700">Année<input type="number" value={planningYear} onChange={(event) => setPlanningYear(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" /></label>
              <label className="block text-sm font-medium text-slate-700">Image JPEG<input type="file" accept="image/jpeg,image/jpg" onChange={handlePlanningImage} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" /></label>
            </div>
            {planningImage ? <Image src={planningImage} alt={`Aperçu du planning ${planningYear}`} width={1200} height={800} unoptimized className="mt-4 max-h-80 w-full rounded-2xl border border-slate-200 object-contain" /> : null}
            {ocrLoading ? <p className="mt-4 text-sm text-slate-600">Lecture OCR en cours... {ocrProgress}%</p> : null}
            {ocrError ? <p className="mt-4 text-sm text-rose-600">{ocrError}</p> : null}
            {ocrText ? <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Afficher le texte détecté</summary><pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-slate-600">{ocrText}</pre></details> : null}
            {ocrPeriods.length > 0 ? <div className="mt-4 space-y-3"><h3 className="text-sm font-semibold text-slate-900">Périodes détectées à vérifier</h3>{ocrPeriods.map((period, index) => <div key={period.id} className="grid gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:grid-cols-4"><input aria-label="Famille détectée" value={period.family} onChange={(event) => setOcrPeriods((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, family: event.target.value } : item))} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm" placeholder="Famille" /><input aria-label="Libellé détecté" value={period.label} onChange={(event) => setOcrPeriods((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm" placeholder="Libellé" /><input aria-label="Date de début détectée" type="date" value={period.start_date} onChange={(event) => setOcrPeriods((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, start_date: event.target.value } : item))} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm" /><input aria-label="Date de fin détectée" type="date" value={period.end_date} onChange={(event) => setOcrPeriods((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, end_date: event.target.value } : item))} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm" /></div>)}</div> : null}
            <button type="button" onClick={savePlanningImport} disabled={!planningImage || ocrLoading} className="mt-4 min-h-11 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Enregistrer le planning détecté</button>
            {planningImports.length > 0 ? <div className="mt-5 space-y-2"><h3 className="text-sm font-semibold text-slate-900">Historique des imports</h3>{planningImports.map((planningImport) => <div key={planningImport.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"><span>{planningImport.year} · {planningImport.file_name}</span><span className="font-semibold">{planningImport.status === 'validated' ? 'Validé' : 'Brouillon'}</span></div>)}</div> : null}
          </section>

          <section id="all-reservations" className="scroll-mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Toutes les réservations</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Consultez et supprimez chaque réservation, ou videz toute la liste.</p>
              </div>
              <button
                type="button"
                onClick={removeAllReservations}
                disabled={loading || reservations.length === 0 || actionLoading === 'all'}
                className="min-h-11 rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading === 'all' ? 'Suppression...' : 'Tout supprimer'}
              </button>
            </div>
            {reservationError ? <p className="mt-3 text-sm text-rose-600">Impossible de supprimer la réservation : {reservationError}</p> : null}
          </section>

          {loading ? null : reservations.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600 shadow-soft">
              Aucune réservation.
            </div>
          ) : (
            <div className="space-y-4">
              {reservations.map((reservation) => (
                <div key={reservation.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-3 shadow-soft sm:p-4">
                  <ReservationCard
                    reservation={reservation}
                    actions={(
                      <button
                        type="button"
                        onClick={() => removeReservation(reservation.id)}
                        disabled={actionLoading === reservation.id || actionLoading === 'all'}
                        className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                      >
                        Supprimer
                      </button>
                    )}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedPage>
  );
}
