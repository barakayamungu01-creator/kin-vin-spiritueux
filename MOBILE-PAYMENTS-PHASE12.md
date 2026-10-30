# KINVINS.CD — Phase 12 Mobile Money

Méthodes : M-Pesa, Airtel Money, Orange Money, paiement à la livraison.

Mode test :
- déployer les Edge Functions
- `supabase secrets set PAYMENT_MODE=mock`
- les paiements Mobile Money deviennent SUCCESS après ~8 secondes.

Mode live :
- onboarding marchand requis chez chaque opérateur ;
- renseigner uniquement des secrets Supabase Edge Functions ;
- ne jamais mettre les secrets opérateur dans `assets/*.js`.
