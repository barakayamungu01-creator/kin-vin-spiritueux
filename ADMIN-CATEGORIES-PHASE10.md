# KINVINS.CD — Phase 10 : catégories administrables

## Admin
Nouvelle entrée :
`Admin → Catégories`

Pages :
- `/admin/admin-categories.html`
- `/admin/admin-category.html?key=vins`

Vous pouvez modifier :
- image
- numéro
- titre
- sous-titre
- lien
- ordre
- statut actif / masqué
- texte alternatif

## Supabase
Exécuter le contenu de :
`supabase/categories_phase10.sql`

Créé :
- `public.site_categories`
- bucket public `category-images`
- RLS admin / super_admin

## Images
Recommandé :
- 1200×800
- WebP/JPG/PNG
- maximum 700 Ko

Les 6 images par défaut sont déjà incluses dans :
`assets/images/categories/`
