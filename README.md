# KIN Vins & Spiritueux — Projet e-commerce complet

## Pages
- `index.html` — accueil
- `catalogue.html` — catalogue
- `product.html?id=1` — fiche produit
- `cart.html` — panier
- `checkout.html` — checkout
- `confirmation.html` — confirmation de commande
- `login.html` — connexion / création de compte
- `account.html` — espace client
- `b2b.html` — espace professionnel
- `admin.html` — dashboard admin
- `stock.html` — gestion du stock
- `orders.html` — gestion des commandes
- `deliveries.html` — gestion des livraisons

## Fichiers partagés
- `assets/styles.css`
- `assets/app.js`
- `data/products.json`

## Lancer le site
Vous pouvez ouvrir `index.html` directement, mais pour un comportement plus proche de la production :

```bash
python -m http.server 8080
```

Puis :
`http://localhost:8080`

## Fonctionnalités de démonstration
- responsive desktop / tablette / mobile
- contrôle d'âge
- catalogue + recherche + tri + filtres
- fiche produit dynamique via `?id=`
- panier partagé entre pages avec `localStorage`
- checkout et confirmation
- compte client de démonstration
- formulaires B2B
- dashboard admin
- stock, commandes, livraisons

## Important avant production
Ce projet est un frontend de démonstration. Il faut connecter :
- un vrai backend
- PostgreSQL / Supabase
- authentification sécurisée
- paiements Mobile Money / cartes
- gestion serveur du stock
- commandes réelles
- notifications SMS / WhatsApp / email
- rôles admin
- conformité légale et contrôle d'âge réel


## Comptes ajoutés
- `register.html` — création de compte individuel
- `account.html` — espace individuel dédié
- `pro-register.html` — création de compte professionnel
- `pro-offers.html` — sélection et changement d’offre KIN PRO
- `pro-account.html` — tableau de bord professionnel
- `pro-orders.html` — historique des commandes professionnelles
- `pro-profile.html` — profil entreprise
- `login.html` — connexion séparée particulier / professionnel

### Important sur l’authentification
La création de comptes de cette version est un **prototype frontend** utilisant `localStorage`. Elle permet de tester les parcours mais ne doit pas être utilisée telle quelle en production. Les mots de passe ne doivent jamais être stockés ainsi dans le site final : utilisez un backend d’authentification sécurisé (par exemple Supabase Auth ou une API serveur).

### Offres KIN PRO de démonstration
Les formules Essentiel, Business et Premium, ainsi que les remises affichées, sont des exemples configurables et non des conditions commerciales définitives.

## Gestion des produits depuis l'administration
- `admin-products.html` : liste des produits, recherche, modification et suppression.
- `admin-product-new.html` : ajout d'un produit.
- `admin-product-new.html?id=3` : modification du produit ayant l'ID 3.

Les produits sont enregistrés dans `localStorage` pour cette version de démonstration.
Ils alimentent automatiquement le catalogue, les fiches produits, le panier et le stock.
Une image peut être fournie par URL/chemin relatif ou sous forme de petit fichier local.

## Blog et SEO
- `blog.html` : journal public.
- `article.html?slug=...` : article dynamique de démonstration.
- `admin-blog.html` : liste et gestion des articles.
- `admin-article-new.html` : création / modification.
- `robots.txt` et `sitemap.xml` : base SEO technique.
- `SEO-BLOG.md` : recommandations de production.

Les articles du prototype sont enregistrés dans `localStorage`. Pour le référencement réel des nouveaux articles, utilisez un backend avec rendu serveur ou génération statique.

## Gestion des bannières
- `admin-banners.html` : liste des bannières.
- `admin-banner-new.html` : création d'une bannière.
- `admin-banner-new.html?id=1` : modification.
- Emplacements disponibles : hero accueil, promo accueil, haut catalogue, haut blog, haut KIN PRO.
- Image desktop + image mobile.
- Titre, sous-titre, bouton, lien, alt, ordre, activation et dates de diffusion.

Dans le prototype les bannières sont stockées dans `localStorage`.
En production, stockez-les en base de données et les images sur un stockage/CDN.

## Gestion des clients
- `admin-clients.html` : liste des clients particuliers et professionnels.
- `admin-client.html` : création d'un client.
- `admin-client.html?id=3` : consultation / modification.
- Recherche, filtres, statut, tags, notes, fidélité, historique de commandes et export CSV.
- Champs spécifiques comptes Pro : entreprise, contact, NIF, offre Pro, limite de crédit.

Les données clients sont enregistrées dans `localStorage` dans ce prototype.
En production, les comptes, rôles et données personnelles doivent être gérés par un backend sécurisé avec permissions d'accès.


## Nouvelle identité
- Nom du site / domaine : `kinvins.cd`
- Logo : **KIN VINS & SPIRITUEUX**
- Domaine canonique : `https://kinvins.cd`
- Email de contact : `contact@kinvins.cd`

## Administration sécurisée
- `/admin/login.html` : connexion administrateur.
- `/admin/` : espace d'administration.
- `ADMIN-SECURITY.md` : instructions détaillées.
- `supabase/admin_security.sql` : schéma de rôles et règles RLS de départ.
- Le lien Admin n'est plus affiché dans la navigation publique.
- En production, l'administration reste verrouillée tant que Supabase n'est pas configuré.
