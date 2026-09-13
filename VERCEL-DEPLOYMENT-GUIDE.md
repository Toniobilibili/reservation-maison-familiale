# 🚀 Guide Déploiement Vercel - Étape par Étape

## Prérequis
- ✅ Repo GitHub configuré : https://github.com/Toniobilibili/reservation-maison-familiale
- ✅ Application testée localement : http://localhost:3000
- ✅ Build réussi : `npm run build` fonctionne

## Étape 1 : Créer un compte Vercel
1. Allez sur https://vercel.com
2. Cliquez "Sign Up" (gratuit)
3. Connectez-vous avec votre compte GitHub

## Étape 2 : Importer votre projet
1. Dans le dashboard Vercel, cliquez "Import Project"
2. Sélectionnez "From Git Repository"
3. Choisissez votre repo : `reservation-maison-familiale`
4. Cliquez "Import"

## Étape 3 : Configurer le déploiement
### Framework Preset : Next.js (automatique)
### Root Directory : ./ (laisser par défaut)

### Variables d'environnement (OBLIGATOIRE) :
Ajoutez ces 2 variables :

```
NEXT_PUBLIC_SUPABASE_URL=https://nmwmwvrhlzddtzeuxbes.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5td213dnJobHpkZHR6ZXV4YmVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NDExMDMsImV4cCI6MjA5MzMxNzEwM30.SOalGa_pGd5K0KkpqCEBn12laOgxs5DPyQwLhGH64OE
```

### Build Settings :
- Build Command : `npm run build` (automatique)
- Output Directory : .next (automatique)
- Node.js Version : 24.x (spécifié dans package.json)

## Étape 4 : Déployer
1. Cliquez "Deploy"
2. Attendez ~2-3 minutes
3. Votre site sera accessible sur une URL comme :
   `https://reservation-maison-familiale.vercel.app`

## Étape 5 : Vérifier le déploiement
1. Cliquez sur l'URL générée
2. Testez l'inscription/connexion
3. Vérifiez le calendrier
4. Testez une réservation

## 🔧 Dépannage
Si le déploiement échoue :
1. Vérifiez les logs dans l'onglet "Functions"
2. Assurez-vous que les variables d'environnement sont correctes
3. Vérifiez que Supabase est accessible

## 📱 Partage avec la famille
Une fois déployé, partagez l'URL Vercel avec votre famille.
Ils pourront s'inscrire et utiliser l'application sur mobile !