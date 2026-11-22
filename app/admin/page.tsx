'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { createWorker } from 'tesseract.js';
import { AppShell } from '@/components/AppShell';
import { ProtectedPage } from '@/components/ProtectedPage';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import type { Reservation } from '@/lib/types';
import type { FamilyPeriod, PlanningImport } from '@/lib/types';
import { ReservationCard } from '@/components/ReservationCard';
import { defaultFamilyPeriods, getPlanningYears, mergeFamilyPeriodsWithDefaults } from '@/lib/planning';
import { planningNameFamilies } from '@/lib/families';

type OcrPeriod = Omit<FamilyPeriod, 'id' | 'created_at' | 'updated_at'> & { id: string };

function parseScheduleOcrPeriods(text: string, year: number, families: string[]): OcrPeriod[] {
  const months: Record<string, number> = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
  const monthPattern = Object.keys(months).join('|');
  const datePattern = new RegExp(`(\\d{1,2})\\s*(?:[./-]\\s*(\\d{1,2})(?:[./-]\\s*(\\d{2,4}))?|\\s*(${monthPattern})\\s*(\\d{2,4})?)`, 'gi');
  const officialSchoolHolidayDates: Record<number, Record<string, { start: string; end: string }>> = {
    // Dates officielles 2026-2027 pour la zone C du planning familial.
    2027: {
      noel: { start: '2026-12-19', end: '2027-01-04' },
      hiver: { start: '2027-02-06', end: '2027-02-22' },
      printemps: { start: '2027-04-03', end: '2027-04-19' },
    },
  };
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const rosterPeople = Object.entries(planningNameFamilies).map(([key, person]) => ({ key, ...person }));
  const normalizedFamilies = families.map((family) => ({ original: family, normalized: normalize(family).toUpperCase() }));
  const periods: OcrPeriod[] = [];
  let currentSection = 'Période importée';
  const normalizedDocument = normalize(text);
  const makeDate = (dayText: string, month: number, yearText?: string) => {
    const printedYear = yearText ? Number(yearText.length === 2 ? `20${yearText}` : yearText) : year;
    const dateYear = year;
    const date = new Date(Date.UTC(dateYear, month - 1, Number(dayText)));
    if (date.getUTCFullYear() !== dateYear || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== Number(dayText)) return null;
    return { value: `${dateYear}-${String(month).padStart(2, '0')}-${String(Number(dayText)).padStart(2, '0')}`, printedYear };
  };

  // Les week-ends d'automne sont souvent reconnus comme une phrase continue avec plusieurs dates et prénoms.
  const personAlternation = rosterPeople.map(({ key }) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const autumnAssignments = new RegExp(`\\b(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})\\s*:\\s*(${personAlternation})\\b`, 'gi');
  for (const match of normalizedDocument.matchAll(autumnAssignments)) {
    const [, day, monthText, printedYearText, personName] = match;
    const person = rosterPeople.find(({ key }) => key === personName.toLowerCase());
    if (!person) continue;
    const start = makeDate(day, Number(monthText), printedYearText);
    if (!start) continue;
    const checkout = new Date(`${start.value}T00:00:00Z`);
    checkout.setUTCDate(checkout.getUTCDate() + 7);
    const yearNote = start.printedYear !== year ? ` — année lue ${start.printedYear}, corrigée à ${year}, à vérifier` : '';
    periods.push({
      id: `ocr-autumn-${periods.length}`,
      year,
      family: person.family,
      label: `Week-end d'automne — ${person.display}${yearNote}`,
      start_date: start.value,
      end_date: checkout.toISOString().slice(0, 10),
    });
  }

  text.split(/\r?\n/).forEach((line, index) => {
    const normalized = normalize(line);
    if (normalized.includes('week-end') && normalized.includes('automne')) currentSection = "Week-end d'automne";
    else if (normalized.includes('vacances') && normalized.includes('ete')) currentSection = "Vacances d'été";
    else if (normalized.includes('paques')) currentSection = 'Week-end de Pâques';
    else if (normalized.includes('ascension')) currentSection = 'Ascension';
    else if (normalized.includes('pentecote')) currentSection = 'Pentecôte';
    else if (normalized.includes('vacances') && normalized.includes('noel')) currentSection = 'Vacances de Noël';
    else if (normalized.includes('vacances') && normalized.includes('hiver')) currentSection = "Vacances d'hiver";
    else if (normalized.includes('vacances') && normalized.includes('printemps')) currentSection = 'Vacances de printemps';

    if (currentSection === "Week-end d'automne") return;

    const person = rosterPeople.find(({ key }) => new RegExp(`\\b${key}\\b`, 'i').test(normalized));
    const knownFamily = normalizedFamilies.find(({ normalized: family }) => normalized.toUpperCase().includes(family));
    if (!person && !knownFamily) return;

    const groupedDays = normalized.match(new RegExp(`((?:\\d{1,2}\\s*\\/\\s*)+\\d{1,2})\\s*(${monthPattern})\\s*(\\d{4})?`, 'i'));
    let start: ReturnType<typeof makeDate> = null;
    let end: ReturnType<typeof makeDate> = null;
    if (groupedDays) {
      const days = groupedDays[1].split('/').map((day) => day.trim());
      const month = months[groupedDays[2]];
      start = makeDate(days[0], month, groupedDays[3]);
      end = makeDate(days[days.length - 1], month, groupedDays[3]);
    } else {
      const matches = [...line.matchAll(datePattern)];
      if (matches.length >= 2) {
        const toDate = (match: RegExpMatchArray, inheritedMonth?: number) => {
          const month = match[2] ? Number(match[2]) : match[4] ? months[normalize(match[4])] : inheritedMonth;
          return month ? makeDate(match[1], month, match[3] ?? match[5]) : null;
        };
        start = toDate(matches[0]);
        end = toDate(matches[1], start ? Number(start.value.slice(5, 7)) : undefined);
      } else if (matches.length === 1 && (/week[- ]?end/.test(normalized) || currentSection === "Week-end d'automne")) {
        const match = matches[0];
        const month = match[2] ? Number(match[2]) : match[4] ? months[normalize(match[4])] : undefined;
        start = month ? makeDate(match[1], month, match[3] ?? match[5]) : null;
        if (start) {
          const checkout = new Date(`${start.value}T00:00:00Z`);
          checkout.setUTCDate(checkout.getUTCDate() + 7);
          end = { value: checkout.toISOString().slice(0, 10), printedYear: year };
        }
      }
    }
    if (!start || !end) {
      const section = normalize(currentSection);
      const holidayKey = section.includes('noel') ? 'noel'
        : section.includes('hiver') ? 'hiver'
          : section.includes('printemps') ? 'printemps'
            : null;
      const dates = holidayKey ? officialSchoolHolidayDates[year]?.[holidayKey] : undefined;
      if (dates) {
        start = { value: dates.start, printedYear: year };
        end = { value: dates.end, printedYear: year };
      }
    }
    if (!start || !end || start.value > end.value) return;

    const family = person?.family ?? knownFamily?.original ?? person?.display ?? '';
    const personLabel = person?.display ?? family;
    const yearNote = start.printedYear !== year ? ` — année lue ${start.printedYear}, corrigée à ${year}, à vérifier` : '';
    periods.push({
      id: `ocr-${index}-${periods.length}`,
      year,
      family,
      label: `${currentSection} — ${personLabel}${yearNote}`,
      start_date: start.value,
      end_date: end.value,
    });
  });
  return periods.sort((first, second) => first.start_date.localeCompare(second.start_date));
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
  const periodFormRef = useRef<HTMLFormElement>(null);
  const periodLabelRef = useRef<HTMLInputElement>(null);
  const [planningImage, setPlanningImage] = useState<string | null>(null);
  const [planningFileName, setPlanningFileName] = useState('');
  const [planningYear, setPlanningYear] = useState(() => String(new Date().getFullYear() + 1));
  const [planningImports, setPlanningImports] = useState<PlanningImport[]>([]);
  const [ocrPeriods, setOcrPeriods] = useState<OcrPeriod[]>([]);
  const [ocrText, setOcrText] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [planningSaveLoading, setPlanningSaveLoading] = useState(false);
  const [planningSaveMessage, setPlanningSaveMessage] = useState<string | null>(null);
  const [planningSaveError, setPlanningSaveError] = useState<string | null>(null);

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
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (sessionError || !accessToken) throw new Error('Reconnectez-vous pour charger les périodes du planning.');
        const response = await fetch('/api/family-periods', { headers: { Authorization: `Bearer ${accessToken}` } });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? 'Le planning enregistré n’a pas pu être chargé.');
        setPeriods(mergeFamilyPeriodsWithDefaults((result.periods ?? []) as FamilyPeriod[]));
      } catch (error) {
        setPeriodMessage(error instanceof Error ? error.message : 'Le planning enregistré n’a pas pu être chargé.');
      }
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
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) throw new Error('Session administrateur expirée. Reconnectez-vous puis réessayez.');
      const isSavedPeriod = periodForm.id && !defaultFamilyPeriods.some((period) => period.id === periodForm.id);
      const response = await fetch('/api/admin/family-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action: 'save', ...(isSavedPeriod ? { id: periodForm.id } : {}), ...payload }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Impossible d’enregistrer la période.');
      const saved = result.period as FamilyPeriod;
      setPeriods((current) => mergeFamilyPeriodsWithDefaults([
        ...current.filter((period) => period.id !== periodForm.id),
        saved,
      ]));
      setPeriodForm({ id: '', year: periodForm.year, family: periodForm.family, label: '', start_date: '', end_date: '' });
      setPeriodMessage('Période enregistrée.');
    } catch (error) {
      setPeriodMessage(error instanceof Error ? error.message : 'Impossible d’enregistrer la période.');
    }
  }

  async function deletePeriod(id: string) {
    if (!window.confirm('Supprimer cette période ?')) return;
    if (defaultFamilyPeriods.some((period) => period.id === id)) {
      setPeriods((current) => current.filter((period) => period.id !== id));
      return;
    }
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) throw new Error('Session administrateur expirée. Reconnectez-vous puis réessayez.');
      const response = await fetch('/api/admin/family-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action: 'delete', id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Impossible de supprimer la période.');
      setPeriods((current) => current.filter((period) => period.id !== id));
    } catch (error) {
      setPeriodMessage(error instanceof Error ? error.message : 'Impossible de supprimer la période.');
    }
  }

  function startEditingPeriod(period: FamilyPeriod) {
    setPeriodForm({ id: period.id, year: String(period.year), family: period.family, label: period.label, start_date: period.start_date, end_date: period.end_date });
    setPeriodMessage(`Modification de « ${period.label} » : modifiez les champs du formulaire puis enregistrez.`);
    window.requestAnimationFrame(() => {
      periodFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      periodLabelRef.current?.focus({ preventScroll: true });
    });
  }

  async function handlePlanningImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPlanningFileName(file.name);
    setOcrPeriods([]);
    setOcrText('');
    setOcrError(null);
    setPlanningSaveMessage(null);
    setPlanningSaveError(null);
    setOcrLoading(true);
    setOcrProgress(0);
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
        const pageCanvases: HTMLCanvasElement[] = [];
        const pageTexts: string[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Impossible de préparer une page du PDF.');
          await page.render({ canvasContext: context, viewport }).promise;
          pageCanvases.push(canvas);
          const content = await page.getTextContent();
          const lines = new Map<number, string[]>();
          content.items.forEach((item) => {
            if (!('str' in item) || !('transform' in item) || !item.str.trim()) return;
            const y = Math.round(item.transform[5]);
            lines.set(y, [...(lines.get(y) ?? []), item.str.trim()]);
          });
          pageTexts.push([...lines.entries()].sort(([a], [b]) => b - a).map(([, words]) => words.join(' ')).join('\n'));
          setOcrProgress(Math.round((pageNumber / pdf.numPages) * 30));
        }
        setPlanningImage(pageCanvases[0]?.toDataURL('image/jpeg', 0.85) ?? null);
        let activePageIndex = 0;
        const worker = await createWorker('fra', 1, {
          logger: (message) => {
            const pageProgress = message.progress ?? 0;
            setOcrProgress(30 + Math.round(((activePageIndex + pageProgress) / pageCanvases.length) * 70));
          },
        });
        const results: string[] = [];
        for (let index = 0; index < pageCanvases.length; index += 1) {
          activePageIndex = index;
          const embeddedText = pageTexts[index].trim();
          const result = embeddedText.length > 30
            ? embeddedText
            : (await worker.recognize(pageCanvases[index])).data.text;
          results.push(`Page ${index + 1}\n${result}`);
          setOcrProgress(30 + Math.round(((index + 1) / pageCanvases.length) * 70));
        }
        await worker.terminate();
        const text = results.join('\n\n');
        setOcrText(text);
        const families = [...new Set(periods.map((item) => item.family).filter(Boolean))];
        setOcrPeriods(parseScheduleOcrPeriods(text, Number(planningYear), families));
      } else {
        setPlanningImage(await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Impossible de lire le fichier image.'));
          reader.readAsDataURL(file);
        }));
        const worker = await createWorker('fra', 1, { logger: (message) => setOcrProgress(Math.round((message.progress ?? 0) * 100)) });
        const result = await worker.recognize(file);
        await worker.terminate();
        setOcrText(result.data.text);
        const families = [...new Set(periods.map((item) => item.family).filter(Boolean))];
        setOcrPeriods(parseScheduleOcrPeriods(result.data.text, Number(planningYear), families));
      }
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : 'La lecture OCR a échoué.');
    } finally {
      setOcrLoading(false);
    }
  }

  async function savePlanningImport() {
    setPlanningSaveMessage(null);
    setPlanningSaveError(null);
    if (!planningImage || !planningFileName) {
      setPlanningSaveError('Choisissez un document et attendez la fin de sa lecture.');
      return;
    }
    if (!user) {
      setPlanningSaveError('La session administrateur est introuvable. Reconnectez-vous puis réessayez.');
      return;
    }

    setPlanningSaveLoading(true);
    try {
      const extractedPeriods = (ocrPeriods.length > 0 ? ocrPeriods : periods
        .filter((period) => period.year === Number(planningYear) && !period.id.startsWith(String(planningYear))))
        .map(({ id, ...period }) => period);
      const invalidPeriod = extractedPeriods.find((period) => !period.family || !period.start_date || !period.end_date || period.end_date < period.start_date);
      if (invalidPeriod) {
        setPlanningSaveError(`Vérifiez la famille et les dates de « ${invalidPeriod.label} » avant l’enregistrement.`);
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) throw new Error('Session administrateur expirée. Reconnectez-vous puis réessayez.');

      const response = await fetch('/api/admin/planning-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          year: Number(planningYear),
          fileName: planningFileName,
          imageUrl: planningImage,
          extractedPeriods,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? `Le serveur a refusé l’enregistrement (${response.status}).`);
      if (extractedPeriods.length > 0 && (!Array.isArray(result.periods) || result.periods.length !== extractedPeriods.length)) {
        throw new Error('Le serveur a accepté l’import, mais toutes les périodes ne sont pas confirmées en base. Réessayez avant de quitter cette page.');
      }

      if (result.planningImport) setPlanningImports((current) => [result.planningImport as PlanningImport, ...current]);
      if (Array.isArray(result.periods) && result.periods.length > 0) {
        setPeriods((current) => [...current.filter((period) => period.year !== Number(planningYear)), ...(result.periods as FamilyPeriod[])]);
      }
      setPlanningSaveMessage(extractedPeriods.length > 0
        ? `Planning enregistré : ${result.periods.length} période${result.periods.length > 1 ? 's' : ''} synchronisée${result.periods.length > 1 ? 's' : ''}.`
        : 'Import enregistré en brouillon. Ajoutez les périodes dans le planning avant de synchroniser.');
    } catch (error) {
      console.error('Échec de l’enregistrement du planning', error);
      setPlanningSaveError(error instanceof Error ? error.message : 'Une erreur inattendue a empêché l’enregistrement.');
    } finally {
      setPlanningSaveLoading(false);
    }
  }

  async function removeReservation(id: string) {
    if (!window.confirm('Supprimer cette réservation ?')) {
      return;
    }

    setReservationError(null);
    setActionLoading(id);
    const { data, error } = await supabase.from('reservations').delete().eq('id', id).select('id');
    if (error) {
      setReservationError(error.message);
    } else if (!data?.length) {
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
    const { data, error } = await supabase.from('reservations').delete().not('id', 'is', null).select('id');
    if (error) {
      setReservationError(error.message);
    } else if (!data?.length) {
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

  const periodYears = getPlanningYears().sort((first, second) => second - first);
  const importYears = getPlanningYears();

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
            {periodForm.id ? <p className="mt-4 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800">Modification en cours · changez les dates ou le libellé, puis cliquez sur « Modifier » pour enregistrer.</p> : null}
            <form ref={periodFormRef} onSubmit={savePeriod} className={`mt-5 grid gap-4 rounded-2xl p-2 sm:grid-cols-2 lg:grid-cols-3 ${periodForm.id ? 'border-2 border-indigo-200 bg-indigo-50/50' : ''}`}>
              <label className="block text-sm font-medium text-slate-700">Année<input type="number" value={periodForm.year} onChange={(event) => setPeriodForm({ ...periodForm, year: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" /></label>
              <label className="block text-sm font-medium text-slate-700">Famille<select value={periodForm.family} onChange={(event) => setPeriodForm({ ...periodForm, family: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><option>PUGNET</option><option>PLAGNOL</option><option>NGUYEN</option><option>BRETEAU</option></select></label>
              <label className="block text-sm font-medium text-slate-700">Libellé<input ref={periodLabelRef} required value={periodForm.label} onChange={(event) => setPeriodForm({ ...periodForm, label: event.target.value })} placeholder="Vacances été" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" /></label>
              <label className="block text-sm font-medium text-slate-700">Début<input required type="date" value={periodForm.start_date} onChange={(event) => setPeriodForm({ ...periodForm, start_date: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" /></label>
              <label className="block text-sm font-medium text-slate-700">Fin<input required type="date" value={periodForm.end_date} onChange={(event) => setPeriodForm({ ...periodForm, end_date: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" /></label>
              <div className="flex items-end gap-2"><button type="submit" className="min-h-11 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white">{periodForm.id ? 'Modifier' : 'Ajouter'}</button>{periodForm.id ? <button type="button" onClick={() => setPeriodForm({ id: '', year: periodForm.year, family: periodForm.family, label: '', start_date: '', end_date: '' })} className="min-h-11 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Annuler</button> : null}</div>
            </form>
            {periodMessage ? <p className="mt-3 text-sm text-slate-600">{periodMessage}</p> : null}
            <div className="mt-5 space-y-2">
              {periodYears.map((year) => {
                const yearPeriods = periods.filter((period) => period.year === year);
                return (
                  <details key={year} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-800">
                      <span>{year}</span>
                      <span className="text-xs font-medium text-slate-500">{yearPeriods.length} période{yearPeriods.length > 1 ? 's' : ''}</span>
                    </summary>
                    <div className="space-y-2 border-t border-slate-200 p-3">
                      {yearPeriods.length === 0 ? <p className="px-1 py-2 text-sm text-slate-500">Aucune période enregistrée pour {year}.</p> : yearPeriods.map((period) => <div key={period.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-700"><strong>{period.family}</strong> · {period.label} · {period.start_date} → {period.end_date}</p><div className="flex gap-2"><button type="button" onClick={() => startEditingPeriod(period)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">Modifier</button><button type="button" onClick={() => deletePeriod(period.id)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">Supprimer</button></div></div>)}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>

          <section id="planning-import" className="scroll-mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
            <h2 className="text-lg font-semibold text-slate-900">Importer un planning</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Importez une image JPEG ou un PDF du programme familial. Le texte est reconnu localement, puis les périodes datées restent modifiables avant leur synchronisation.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_2fr]">
              <label className="block text-sm font-medium text-slate-700">Année du planning<select value={planningYear} onChange={(event) => setPlanningYear(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">{importYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
              <label className="block text-sm font-medium text-slate-700">Document (JPEG ou PDF)<input type="file" accept="image/jpeg,image/jpg,application/pdf,.pdf" onChange={handlePlanningImage} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" /></label>
            </div>
            {planningImage ? <Image src={planningImage} alt={`Aperçu du planning ${planningYear}`} width={1200} height={800} unoptimized className="mt-4 max-h-80 w-full rounded-2xl border border-slate-200 object-contain" /> : null}
            {ocrLoading ? <p className="mt-4 text-sm text-slate-600">Lecture OCR en cours... {ocrProgress}%</p> : null}
            {ocrError ? <p className="mt-4 text-sm text-rose-600">{ocrError}</p> : null}
            {ocrText ? <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Afficher le texte détecté</summary><pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-slate-600">{ocrText}</pre></details> : null}
            {ocrPeriods.length > 0 ? <div className="mt-4 space-y-3"><h3 className="text-sm font-semibold text-slate-900">Périodes détectées à vérifier</h3><p className="text-xs leading-5 text-slate-600">Les prénoms identifiés sont associés à leur famille selon la liste enregistrée des occupants. Vérifiez ou corrigez cette proposition avant l’enregistrement. Pour 2027, Noël, l’hiver et le printemps sont complétés selon le calendrier officiel de la zone C ; les autres périodes sans dates restent exclues.</p>{ocrPeriods.map((period, index) => <div key={period.id} className="grid gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:grid-cols-4"><select aria-label="Famille détectée" value={period.family} onChange={(event) => setOcrPeriods((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, family: event.target.value } : item))} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm">{['PUGNET', 'PLAGNOL', 'NGUYEN', 'BRETEAU'].map((family) => <option key={family} value={family}>{family}</option>)}</select><input aria-label="Libellé détecté" value={period.label} onChange={(event) => setOcrPeriods((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm" placeholder="Libellé" /><input aria-label="Date de début détectée" type="date" value={period.start_date} onChange={(event) => setOcrPeriods((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, start_date: event.target.value } : item))} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm" /><input aria-label="Date de fin détectée" type="date" value={period.end_date} onChange={(event) => setOcrPeriods((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, end_date: event.target.value } : item))} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm" /></div>)}</div> : null}
            <button type="button" onClick={savePlanningImport} disabled={!planningImage || ocrLoading || planningSaveLoading} className="mt-4 min-h-11 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{planningSaveLoading ? 'Enregistrement en cours…' : 'Enregistrer le planning détecté'}</button>
            {planningSaveError ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{planningSaveError}</p> : null}
            {planningSaveMessage ? <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{planningSaveMessage}</p> : null}
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
