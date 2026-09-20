# SEO / Blog — Mise en production

Le prototype stocke les articles dans `localStorage`.

Pour que chaque nouvel article soit réellement indexable :
1. Stocker les articles dans PostgreSQL/Supabase ou un CMS.
2. Générer des URL réelles du type `/blog/mon-slug`.
3. Rendre le contenu côté serveur ou statiquement (Next.js est adapté).
4. Régénérer automatiquement `sitemap.xml` après publication.
5. Utiliser le vrai domaine pour les canonical.
6. Héberger les images sur un CDN avec texte alternatif.
7. Structurer les articles avec H1, H2 et H3.
8. Ajouter des liens internes vers catégories, produits et pages professionnelles.
9. Publier des contenus originaux et réellement utiles.

Le prototype comprend déjà meta title, meta description, slug, mot-clé principal, date, auteur, catégories, canonical, JSON-LD Article, recherche, filtres, maillage vers le catalogue, robots.txt et sitemap.xml de base.
