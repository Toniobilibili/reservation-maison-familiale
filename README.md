# Maison Familiale

Application PWA simple pour gérer les réservations d’une maison de vacances familiale.

## Stack
- Next.js
- TypeScript
- Tailwind CSS
- Supabase Auth + Base de données
- PWA installable iPhone / Android

## Démarrage local

1. Copier l’exemple d’environnement :

```bash
cp .env.local.example .env.local
```

2. Remplir les variables Supabase dans `.env.local` :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. Installer les dépendances :

```bash
npm install
```

4. Lancer le serveur de développement :

```bash
npm run dev
```

5. Ouvrir l’application :

```
http://localhost:3000
```

## Configuration Supabase

1. Créez un projet sur Supabase.
2. Dans `Settings > API`, copiez `URL` et `anon public`.
3. Créez le schéma SQL dans Supabase SQL Editor avec `sql/setup.sql`.
4. Dans `Authentication > Users`, créez manuellement un utilisateur `admin` et un ou plusieurs `member`.
5. Ajoutez un enregistrement dans `public.profiles` pour chaque utilisateur avec le même `id` que l’utilisateur Supabase.
   - `id`: UUID du user Supabase
   - `full_name`: Nom complet
   - `role`: `admin` ou `member`

## Rôle admin / membre

- `admin` : voit l’espace admin, peut valider/refuser/supprimer des demandes.
- `member` : peut consulter les réservations, envoyer une demande.

## PWA

L’application est configurée comme PWA avec un `manifest.json` et des icônes.

### Ajouter sur Android

1. Ouvrir l’application dans Chrome.
2. Cliquer sur le bouton `Installer` ou `Ajouter à l’écran d’accueil`.

### Ajouter sur iPhone

1. Ouvrir l’application dans Safari.
2. Cliquer sur le bouton Partager.
3. Choisir `Sur l’écran d’accueil`.

## Déploiement sur Vercel

1. Créez un compte gratuit sur Vercel.
2. Importez ce dépôt.
3. Dans les paramètres du projet, ajoutez les variables d’environnement :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Déployez. Vercel détecte automatiquement Next.js.

## Améliorations possibles

- Ajouter un vrai calendrier visuel mois par mois.
- Permettre la création d’un profil utilisateur dans l’app.
- Ajouter des notifications email via Supabase Functions.
- Ajouter des filtres de disponibilité dans la page réservation.
- Gérer plusieurs maisons ou périodes ouvertes/fermées.
