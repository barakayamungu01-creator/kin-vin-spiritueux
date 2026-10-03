STRUCTURE NORMALISEE DES IMAGES PRODUITS

- Un dossier par SKU du catalogue CSV.
- Nom du dossier : SKU exact (ex. HEN-XO-750).
- Images : SKU-01.ext, SKU-02.ext, etc.
- Les extensions originales sont conservées.
- Les doublons binaires exacts sont supprimés uniquement dans un même produit.
- image-map.csv : correspondance ancien nom -> nouveau nom.
- index-produits.csv : index des 24 produits dans l'ordre du fichier catalogue.

AJOUT DES FONDS BLANCS — 26 SEPTEMBRE 2026

- 55 images dans les 24 dossiers produits d'origine.
- 14 images transparentes et 1 image sur fond gris ont été retouchées.
- 40 images déjà sur fond blanc sont conservées à l'identique.
- Les noms, extensions et chemins des 55 images sont conservés.
- Toutes les images sont désormais opaques, avec un fond visuellement blanc.
- Les empreintes sha256 des fichiers présents ont été mises à jour dans image-map.csv.
- retouches-fond-blanc.csv liste les images, traitements, dimensions et empreintes avant/après.

Les retouches ont été effectuées par IA, avec pour consigne d'ajouter un fond
blanc opaque en conservant le produit, son emballage, ses couleurs et son cadrage.
Les fichiers retouchés ont été agrandis par le moteur. Certains petits caractères
d'étiquette, motifs et reflets ont été réinterprétés, notamment sur les Blue Label.
Vérifier ces détails par comparaison avec les photos sources avant publication.
Le fond est visuellement blanc; il n'est pas un aplat #FFFFFF uniforme pixel par pixel.

Pour l'intégration, conserver les mêmes dossiers et noms de fichiers.
