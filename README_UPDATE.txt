KINVINS.CD — PATCH PHASE 11

Corrige le bug :
Ajouter au panier → Voir le panier → panier faussement vide.

Aucune mise à jour Supabase SQL nécessaire.

Copiez le patch dans :
C:\Users\user\Documents\kinvins_cd

Puis :
git add -A
git commit -m "Phase 11 - correction persistance panier"
git push

Test :
1. Ouvrir le catalogue.
2. Ajouter 2 produits.
3. Vérifier le compteur du panier.
4. Ouvrir le tiroir panier.
5. Cliquer « Voir le panier ».
6. Les mêmes produits et quantités doivent être visibles.
7. Actualiser cart.html : le panier doit rester présent.
