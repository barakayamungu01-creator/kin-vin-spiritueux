# Administration sécurisée — KINVINS.CD

## Ce qui a changé

- Le lien **Admin** a été retiré de la navigation publique.
- Les anciennes URLs admin à la racine redirigent vers `/admin/login.html`.
- L'administration réelle se trouve maintenant dans `/admin/`.
- Toutes les pages admin chargent un garde d'authentification.
- Les pages admin ont `noindex,nofollow,noarchive`.
- Cloudflare reçoit des en-têtes `no-store` pour `/admin/*`.
- Le mode par défaut est `locked` : personne ne peut se connecter sur le domaine public tant que Supabase n'est pas configuré.

## Tester localement

Dans `admin/config.js`, mettre temporairement :

```js
mode: "demo"
```

Le mode démo fonctionne uniquement :
- en `file://`
- sur `localhost`
- sur `127.0.0.1`

Identifiants démo locaux :

- email : `admin@kinvins.cd`
- mot de passe : `KIN-DEMO-LOCAL`

Ne jamais utiliser le mode `demo` sur le site public.

## Activer Supabase

1. Créer un projet Supabase.
2. Exécuter `supabase/admin_security.sql`.
3. Créer votre utilisateur administrateur dans Supabase Auth.
4. Donner à son profil le rôle `admin` ou `super_admin`.
5. Copier `admin/config.example.js` vers `admin/config.js` et renseigner :
   - URL du projet Supabase ;
   - clé publique `anon`.
6. Passer `mode` à `"supabase"`.

## Important

Ce garde JavaScript protège l'interface, mais la vraie sécurité doit rester dans Supabase :
- RLS activée ;
- rôles vérifiés ;
- aucune clé `service_role` dans le navigateur ;
- toutes les données sensibles protégées par des politiques serveur.
