# KINVINS.CD — Phase 3 : Import automatique des produits et photos

## Ce qui est ajouté

- `/admin/admin-product-import.html`
- import CSV, XLS, XLSX, XLSM et ODS
- dossier complet de photos via le sélecteur de dossier du navigateur
- correspondance automatique par SKU
- plusieurs photos par produit
- Supabase Storage bucket `product-images`
- table `public.product_images`
- image principale recopiée automatiquement dans `products.image_url`
- upsert des produits par `sku`
- prévisualisation et validation avant import
- progression et journal d'erreurs

## Convention photos

Pour le SKU :

`HEN-XO-700`

les noms acceptés comprennent notamment :

- `HEN-XO-700.jpg`
- `HEN-XO-700_1.jpg`
- `HEN-XO-700_2.jpg`
- `HEN-XO-700-main.webp`

La photo exacte `SKU.ext` est prioritaire.

## Installation SQL

Dans Supabase SQL Editor, copier **le contenu** de :

`supabase/product_import_storage_phase3.sql`

puis exécuter.

Ne pas taper seulement le nom du fichier dans SQL Editor.

## Modèle CSV

`data/product_import_template.csv`

Colonnes principales :

- sku
- name
- brand
- category
- subcategory
- origin
- volume
- abv
- price
- promo_price
- stock
- badge
- description
- active
- featured
- image_url

## Limites images

- JPEG
- PNG
- WebP
- maximum 5 Mo par fichier

Les images du catalogue sont placées dans un bucket public pour permettre leur affichage rapide.
Les opérations d'upload / remplacement / suppression sont réservées par RLS aux comptes `admin` et `super_admin`.

## Dépendance Excel

La page importe les fichiers Excel avec SheetJS CE 0.20.3 chargé depuis le CDN officiel SheetJS.
Les CSV continuent d'être lisibles même si le module Excel externe n'est pas disponible.
