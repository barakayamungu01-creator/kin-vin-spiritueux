# KINVINS.CD — Phase 4 : upload d'une image depuis le formulaire produit

Le formulaire `/admin/admin-product-new.html` envoie maintenant directement les photos
dans le bucket Supabase Storage `product-images`.

## Prérequis
La migration Produits + Images (Phase 2/3) doit avoir été exécutée.

## Utilisation
1. Se connecter à `/admin/login.html`.
2. Ouvrir `/admin/admin-product-new.html`.
3. Renseigner le produit.
4. Choisir un JPG/PNG/WebP de 5 Mo maximum.
5. Enregistrer.

Le site crée/met à jour le produit, envoie la photo dans Supabase Storage,
met à jour `products.image_url` et synchronise `product_images`.

Le chemin de fichier est versionné à chaque remplacement afin d'éviter qu'une ancienne
photo reste visible à cause du cache CDN.

## Image inaccessible
Si une ancienne URL est cassée, le catalogue masque automatiquement l'icône d'image
cassée et affiche le visuel bouteille KIN par défaut.
