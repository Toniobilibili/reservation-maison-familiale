# Initialisation du repo Git et push vers GitHub
# À exécuter après l'installation de Git

# Initialiser le repo git
git init

# Ajouter tous les fichiers
git add .

# Premier commit
git commit -m "Initial commit: Application de réservation maison familiale"

# Créer le repo GitHub (remplacer NOM_REPO par le nom souhaité)
# gh repo create NOM_REPO --public --source=. --remote=origin --push

echo "Repo GitHub créé et code poussé !"
echo "URL du repo: https://github.com/VOTRE_USERNAME/NOM_REPO"