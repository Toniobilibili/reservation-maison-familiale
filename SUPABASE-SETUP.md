# Étapes pour configurer Supabase en production

## 1. Créer un projet Supabase
1. Allez sur https://supabase.com
2. Créez un compte ou connectez-vous
3. Cliquez "New project"
4. Remplissez :
   - Name: reservation-maison-prod
   - Database Password: [mot de passe fort]
   - Region: EU West (London) ou France Central

## 2. Configurer la base de données
1. Dans l'onglet "SQL Editor", exécutez le contenu du fichier `sql/setup.sql`
2. Vérifiez que les tables sont créées dans "Table Editor"

## 3. Récupérer les clés API
1. Allez dans "Settings" > "API"
2. Copiez :
   - Project URL
   - anon/public key

## 4. Variables d'environnement pour Vercel
Dans Vercel, ajoutez ces variables :
- NEXT_PUBLIC_SUPABASE_URL=your-project-url
- NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key