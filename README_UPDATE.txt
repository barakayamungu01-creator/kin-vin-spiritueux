KINVINS.CD — PATCH PHASE 5

Ce patch ajoute :
- admin/forgot-password.html
- admin/update-password.html
- lien "Mot de passe oublié ?" sur admin/login.html

Il NE modifie PAS :
- assets/supabase-config.js

Après copie :
1. Supabase > Authentication > URL Configuration
2. Site URL : https://kinvins.cd
3. Redirect URLs :
   https://kinvins.cd/admin/update-password.html
   http://localhost:8080/admin/update-password.html

Puis :
git add -A
git commit -m "Ajout reinitialisation mot de passe admin"
git push
