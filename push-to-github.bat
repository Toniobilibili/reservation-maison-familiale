@echo off
echo ========================================
echo  PUSH DU PROJET VERS GITHUB
echo ========================================

cd "c:\Users\Tonio\Documents\Application Villeneuve"

echo.
echo 1. Initialisation du repo git...
git init

echo.
echo 2. Ajout des fichiers...
git add .

echo.
echo 3. Premier commit...
git commit -m "Initial commit: Application PWA de réservation maison familiale"

echo.
echo 4. Configuration du remote...
git remote add origin https://github.com/Toniobilibili/reservation-maison-familiale.git

echo.
echo 5. Push vers GitHub...
git push -u origin main

echo.
echo ========================================
echo  SUCCES ! Votre code est sur GitHub
echo  URL: https://github.com/Toniobilibili/reservation-maison-familiale
echo ========================================

pause