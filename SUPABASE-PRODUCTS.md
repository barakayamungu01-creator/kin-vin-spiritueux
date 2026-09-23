# KINVINS.CD — Phase 2 : Produits Supabase

1. Supabase > SQL Editor : exécuter `supabase/products_phase2.sql`.
2. Si Supabase affiche l'avertissement RLS, choisir **Run and enable RLS**.
3. Dans `assets/supabase-config.js`, mettre vos mêmes :
   - Project URL
   - Publishable key
4. Ne jamais mettre de `sb_secret_...` ni `service_role` dans le frontend.
5. Tester le catalogue public.
6. Se connecter à `/admin/login.html`.
7. Tester ajout, modification et suppression dans `/admin/admin-products.html`.

Le public ne peut lire que les produits actifs.
Seuls les comptes `admin` et `super_admin` actifs peuvent écrire dans `products`.

Pour cette phase, les images produits Supabase utilisent une URL.
L'upload direct d'images sera ajouté avec Supabase Storage à l'étape suivante.
