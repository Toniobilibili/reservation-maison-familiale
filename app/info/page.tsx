'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProtectedPage } from '@/components/ProtectedPage';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import type { InfoItem } from '@/lib/types';

const defaultInfos: InfoItem[] = [
  { id: 'adresse', title: 'Adresse', text: '12 route de la Plage, 83400 Hyères', sort_order: 1, created_at: '', updated_at: '' },
  { id: 'wifi', title: 'Wi-Fi', text: 'Nom : MaisonFamille / Code : Vacances2026', sort_order: 2, created_at: '', updated_at: '' },
  { id: 'arrivee', title: 'Arrivée', text: 'Arrivée possible après 16h. Clés dans la boîte à code.', sort_order: 3, created_at: '', updated_at: '' },
  { id: 'depart', title: 'Départ', text: 'Départ avant 11h. Merci de laisser la maison propre.', sort_order: 4, created_at: '', updated_at: '' },
  { id: 'regles', title: 'Règles', text: 'Pas de fêtes bruyantes, respect des voisins, animaux sur accord.', sort_order: 5, created_at: '', updated_at: '' },
  { id: 'contacts', title: 'Contacts utiles', text: 'Propriétaire : 06 00 00 00 00 / Assistance : 06 11 11 11 11', sort_order: 6, created_at: '', updated_at: '' },
];

export default function InfoPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [infos, setInfos] = useState<InfoItem[]>(defaultInfos);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInfos() {
      const { data, error: loadError } = await supabase
        .from('info_items')
        .select('id, title, text, sort_order, created_at, updated_at')
        .order('sort_order', { ascending: true });

      if (data && data.length > 0) {
        setInfos(data as InfoItem[]);
      }

      if (loadError) {
        console.error(loadError.message);
        setError("Les infos par défaut sont affichées. La table Supabase info_items n'est peut-être pas encore créée.");
      }

      setLoading(false);
    }

    loadInfos();
  }, []);

  function updateInfo(id: string, field: 'title' | 'text', value: string) {
    setInfos((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  async function saveInfo(item: InfoItem) {
    setSavingId(item.id);
    setMessage(null);
    setError(null);

    const { error: saveError } = await supabase
      .from('info_items')
      .update({
        title: item.title,
        text: item.text,
      })
      .eq('id', item.id);

    if (saveError) {
      setError(saveError.message);
    } else {
      setMessage(`"${item.title}" a été mis à jour.`);
    }

    setSavingId(null);
  }

  return (
    <ProtectedPage>
      <AppShell title="Infos pratiques">
        <div className="space-y-4">
          {isAdmin ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
              <h2 className="text-lg font-semibold text-slate-900">Modification des infos</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Les changements enregistrés seront visibles par toute la famille.</p>
              {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
              {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
            </section>
          ) : null}

          {loading ? <p className="text-sm text-slate-600">Chargement des infos...</p> : null}

          <div className="grid gap-4 md:grid-cols-2">
            {infos.map((item) => (
              <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
                {isAdmin ? (
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-slate-700">
                      Titre
                      <input
                        type="text"
                        value={item.title}
                        onChange={(event) => updateInfo(item.id, 'title', event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Contenu
                      <textarea
                        value={item.text}
                        onChange={(event) => updateInfo(item.id, 'text', event.target.value)}
                        rows={4}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => saveInfo(item)}
                      disabled={savingId === item.id}
                      className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {savingId === item.id ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-sm font-semibold text-slate-900">{item.title}</h2>
                    <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-600">{item.text}</p>
                  </>
                )}
              </article>
            ))}
          </div>
        </div>
      </AppShell>
    </ProtectedPage>
  );
}
