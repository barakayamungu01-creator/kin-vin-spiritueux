# KINVINS.CD — Phase 9 : visuel principal modifiable depuis l'Admin

## Résultat

Les trois bouteilles graphiques du Hero ont été supprimées.

La zone droite de la page d'accueil utilise maintenant une vraie image gérée depuis :

`/admin/admin-banners.html`

Créer ou modifier une bannière avec l'emplacement :

`Accueil — Visuel principal`

## Supabase

Exécuter dans Supabase SQL Editor :

`supabase/banners_phase9.sql`

Le script crée :

- `public.site_banners`
- le bucket public `site-banners`
- les politiques RLS
- un visuel `home_visual` par défaut

## Images

Desktop :
- recommandé : 1920×700
- maximum : 700 Ko

Mobile :
- recommandé : 750×900 ou 828×1000
- maximum : 700 Ko

La bannière desktop fournie avec cette phase fait 1920×700 et environ 196 Ko.

## Administration

Admin → Bannières → Modifier « Accueil — Visuel principal »

Vous pouvez :
- changer l'image desktop ;
- changer l'image mobile ;
- activer/désactiver ;
- planifier les dates ;
- ajouter un lien au clic ;
- régler l'overlay ;
- modifier le texte alternatif.

Les modifications sont centralisées dans Supabase et deviennent visibles pour tous les visiteurs.
