# KINVINS.CD — Phase 11 : correction panier

## Problème corrigé
Le clic sur « Voir le panier » donnait l'impression que le panier se vidait.

Le panier n'était pas supprimé de `localStorage`.
`cart.html` s'affichait simplement avant la fin du chargement des produits Supabase.
Comme `cartRows()` ne trouvait pas encore les IDs produits dans `PRODUCTS`, il rejetait
les lignes et affichait « Votre panier est vide ».

## Correction
- état `KIN_PRODUCTS_LOADING`
- écran « Chargement du panier… »
- re-rendu automatique après chargement Supabase
- conservation des quantités de `kin-cart`
- synchronisation du drawer, badge, panier et checkout
- prix promo correctement utilisé dans le sous-total
- synchronisation entre onglets via l'événement `storage`

Aucune migration SQL Supabase n'est nécessaire.
