'use client';

import { AppShell } from '@/components/AppShell';
import { ProtectedPage } from '@/components/ProtectedPage';

const infos = [
  { title: 'Adresse', text: '12 route de la Plage, 83400 Hyères' },
  { title: 'Wi-Fi', text: 'Nom : MaisonFamille / Code : Vacances2026' },
  { title: 'Arrivée', text: 'Arrivée possible après 16h. Clés dans la boîte à code.' },
  { title: 'Départ', text: 'Départ avant 11h. Merci de laisser la maison propre.' },
  { title: 'Règles', text: 'Pas de fêtes bruyantes, respect des voisins, animaux sur accord.' },
  { title: 'Contacts utiles', text: 'Propriétaire : 06 00 00 00 00 / Assistance : 06 11 11 11 11' },
];

export default function InfoPage() {
  return (
    <ProtectedPage>
      <AppShell title="Infos pratiques">
        <div className="space-y-4">
          {infos.map((item) => (
            <article key={item.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
              <h2 className="text-sm font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
            </article>
          ))}
        </div>
      </AppShell>
    </ProtectedPage>
  );
}
