'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProtectedPage } from '@/components/ProtectedPage';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import type { Reservation } from '@/lib/types';
import type { FamilyPeriod, FamilySetting, PlanningImport } from '@/lib/types';
import { ReservationCard } from '@/components/ReservationCard';
import { defaultFamilyPeriods } from '@/lib/planning';

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
  const [periods, setPeriods] = useState<FamilyPeriod[]>(defaultFamilyPeriods);
  const [periodForm, setPeriodForm] = useState({ id: '', year: '2026', family: 'PUGNET', label: '', start_date: '', end_date: '' });
  const [periodMessage, setPeriodMessage] = useState<string | null>(null);
  const [planningImage, setPlanningImage] = useState<string | null>(null);
  const [planningFileName, setPlanningFileName] = useState('');
  const [planningYear, setPlanningYear] = useState('2027');
  const [familySettings, setFamilySettings] = useState<FamilySetting[]>([]);
  const [planningImports, setPlanningImports] = useState<PlanningImport[]>([]);

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
      const { data: settingData } = await supabase.from('family_settings').select('family, label, bg_color, border_color, text_color, updated_at').order('family');
      if (settingData) setFamilySettings(settingData as FamilySetting[]);
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

  function handlePlanningImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPlanningFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setPlanningImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function savePlanningImport() {
    if (!planningImage || !planningFileName || !user) return;
    const { data, error } = await supabase.from('planning_imports').insert({
      year: Number(planningYear),
      file_name: planningFileName,
      image_url: planningImage,
      status: 'draft',
      extracted_periods: [],
      created_by: user.id,
    }).select('id, year, file_name, image_url, status, extracted_periods, created_by, created_at').single();
    if (data) setPlanningImports((current) => [data as PlanningImport, ...current]);
    setPeriodMessage(error ? error.message : 'Import enregistré en brouillon. Corrigez les périodes ci-dessus puis validez-les.');
  }

  async function saveFamilySetting(setting: FamilySetting) {
    const { error } = await supabase.from('family_settings').upsert({
      family: setting.family,
      label: setting.label,
      bg_color: setting.bg_color,
      border_color: setting.border_color,
      text_color: setting.text_color,
    });
    setPeriodMessage(error ? error.message : `Couleurs de ${setting.family} enregistrées.`);
  }

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    setActionLoading(id);
    const { error } = await supabase.from('reservations').update({ status }).eq('id', id);
    if (error) {
      console.error(error.message);
    } else {
      setReservations((current) => current.map((reservation) => (reservation.id === id ? { ...reservation, status } : reservation)));
    }
    setActionLoading(null);
  }

  async function removeReservation(id: string) {
    setActionLoading(id);
    const { error } = await supabase.from('reservations').delete().eq('id', id);
    if (error) {
      console.error(error.message);
    } else {
      setReservations((current) => current.filter((reservation) => reservation.id !== id));
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

  const pending = reservations.filter((reservation) => reservation.status === 'pending');
  const history = reservations.filter((reservation) => reservation.status !== 'pending');

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
            <a href="#pending-reservations" className="flex min-h-11 shrink-0 items-center rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
              Réservations
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

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
            <h2 className="text-lg font-semibold text-slate-900">Familles et couleurs</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Modifiez les couleurs utilisées dans la légende, les périodes et les réservations.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {familySettings.map((setting) => <div key={setting.family} className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><strong className="text-sm">{setting.family}</strong><span className="h-7 w-7 rounded-full border" style={{ backgroundColor: setting.bg_color, borderColor: setting.border_color }} /></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><label>Fond<input type="color" value={setting.bg_color} onChange={(event) => setFamilySettings((current) => current.map((item) => item.family === setting.family ? { ...item, bg_color: event.target.value } : item))} className="mt-1 h-9 w-full rounded-lg" /></label><label>Bordure<input type="color" value={setting.border_color} onChange={(event) => setFamilySettings((current) => current.map((item) => item.family === setting.family ? { ...item, border_color: event.target.value } : item))} className="mt-1 h-9 w-full rounded-lg" /></label><label>Texte<input type="color" value={setting.text_color} onChange={(event) => setFamilySettings((current) => current.map((item) => item.family === setting.family ? { ...item, text_color: event.target.value } : item))} className="mt-1 h-9 w-full rounded-lg" /></label></div><button type="button" onClick={() => saveFamilySetting(setting)} className="mt-3 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white">Enregistrer</button></div>)}
            </div>
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
            <p className="mt-2 text-sm leading-6 text-slate-600">Importez une image des souhaits familiaux. Elle sert à préparer des périodes de familles, pas à créer des réservations pour des personnes. L’image est prévisualisée et conservée en brouillon ; aucun planning existant n’est écrasé.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_2fr]">
              <label className="block text-sm font-medium text-slate-700">Année<input type="number" value={planningYear} onChange={(event) => setPlanningYear(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" /></label>
              <label className="block text-sm font-medium text-slate-700">Image JPEG<input type="file" accept="image/jpeg,image/jpg" onChange={handlePlanningImage} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" /></label>
            </div>
            {planningImage ? <img src={planningImage} alt={`Aperçu du planning ${planningYear}`} className="mt-4 max-h-80 w-full rounded-2xl border border-slate-200 object-contain" /> : null}
            <button type="button" onClick={savePlanningImport} disabled={!planningImage} className="mt-4 min-h-11 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Enregistrer le brouillon</button>
            {planningImports.length > 0 ? <div className="mt-5 space-y-2"><h3 className="text-sm font-semibold text-slate-900">Historique des imports</h3>{planningImports.map((planningImport) => <div key={planningImport.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"><span>{planningImport.year} · {planningImport.file_name}</span><span className="font-semibold">{planningImport.status === 'validated' ? 'Validé' : 'Brouillon'}</span></div>)}</div> : null}
          </section>

          <section id="pending-reservations" className="scroll-mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Demandes en attente</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Validez ou refusez les nouvelles demandes.</p>
            </div>
          </section>

          {loading ? (
            <p className="text-sm text-slate-600">Chargement des demandes...</p>
          ) : pending.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600 shadow-soft">
              Aucune demande en attente.
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map((reservation) => (
                <div key={reservation.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-3 shadow-soft sm:p-4">
                  <ReservationCard reservation={reservation} />
                  <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                    <button
                      onClick={() => updateStatus(reservation.id, 'approved')}
                      disabled={actionLoading === reservation.id}
                      className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Valider
                    </button>
                    <button
                      onClick={() => updateStatus(reservation.id, 'rejected')}
                      disabled={actionLoading === reservation.id}
                      className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
            <h2 className="text-lg font-semibold text-slate-900">Historique</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Toutes les réservations validées ou refusées.</p>
          </section>

          {loading ? null : history.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600 shadow-soft">
              Aucune réservation historique.
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((reservation) => (
                <div key={reservation.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-3 shadow-soft sm:p-4">
                  <ReservationCard reservation={reservation} />
                  <div className="mt-4">
                    <button
                      onClick={() => removeReservation(reservation.id)}
                      disabled={actionLoading === reservation.id}
                      className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60 sm:w-auto"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedPage>
  );
}
