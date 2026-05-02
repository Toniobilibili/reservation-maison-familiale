# 👥 Gestion des utilisateurs

## Créer des comptes pour la famille

### Via l'application (recommandé)
1. Allez sur votre site déployé
2. Cliquez "Créer un compte"
3. Inscrivez chaque membre de la famille avec :
   - Email personnel
   - Mot de passe fort
   - Nom complet

### Via Supabase Dashboard (admin)
1. Allez dans votre projet Supabase > "Authentication" > "Users"
2. Cliquez "Add user"
3. Remplissez email et mot de passe
4. Dans "Table Editor" > "profiles", ajoutez le profil avec :
   - id: (auto-généré)
   - full_name: "Prénom Nom"
   - role: "member" (ou "admin" pour vous)

## Rôles disponibles
- **admin**: Peut voir et gérer toutes les réservations
- **member**: Peut créer ses propres réservations

## Sécurité
- Chaque utilisateur ne voit que ses propres réservations
- L'admin voit tout le monde
- Les réservations sont automatiquement approuvées