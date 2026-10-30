# KINVINS.CD — Phase 13 : Portail KIN PRO

Pages : dashboard, catalogue PRO, commande rapide, commandes, récurrence, devis, factures, crédit, offres et profil entreprise.

Admin : `/admin/admin-pro.html` pour validation, offre, remise, crédit, délais et devis.

Tarifs par défaut : Essentiel 5/6/8 %, Business 8/10/12 %, Premium 12/14/16 % selon quantité. Les prix sont calculés côté PostgreSQL.

Installation : exécuter le contenu de `supabase/pro_portal_phase13.sql`. Les nouveaux comptes PRO utilisent Supabase Auth et sont créés `pending` jusqu'à validation Admin.
