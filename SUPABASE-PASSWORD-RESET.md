# KINVINS.CD — Réinitialisation du mot de passe Admin

Pages :
- `/admin/forgot-password.html`
- `/admin/update-password.html`

Dans Supabase → Authentication → URL Configuration :

Site URL :
`https://kinvins.cd`

Redirect URLs :
- `https://kinvins.cd/admin/update-password.html`
- `http://localhost:8080/admin/update-password.html`
- éventuellement `https://www.kinvins.cd/admin/update-password.html`

Le flux utilise Supabase Auth recovery puis la mise à jour du mot de passe avec le jeton reçu.
