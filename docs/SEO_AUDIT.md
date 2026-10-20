# Audit initial Proba Match — 20 octobre 2026

## Périmètre et preuves

Dépôt `redragon38/proba-match`, branche existante `codex/prediction-history-coverage`.
Référence avant cette mission : `56b47e1`. Site : https://proba-match.com.
L'inventaire porte sur les routes App Router, profils, services d'import/cache,
métadonnées, JSON-LD, sécurité, configuration VPS et tests. Le dépôt comptait
326 fichiers dans les répertoires applicatifs/scripts/tests inventoriés.

Le sitemap public observé contient **4 826 URL** : 4 338 matchs, 135 équipes,
267 joueurs, six compétitions et les pages/catalogues/archives paginées restants.
Ce nombre est une observation du sitemap, pas le nombre de pages indexées par Google.
Le contrôle approfondi initial porte sur **40 pages représentatives**, **60 liens
supplémentaires** et **18 vues navigateur**. Il reste 374 liens découverts non
contrôlés dans ce passage borné. Aucun lien cassé ni redirection interne n'a été
observé parmi les 60 liens contrôlés. Ce n'est pas un crawl exhaustif des 4 826 URL.

## Architecture

| Élément | Constat |
|---|---|
| Framework | Next.js 16.3.8, React 19, TypeScript, App Router |
| Rendu | SSR dynamique ; composants client pour filtres, tableaux et favoris |
| Données | Prisma 6, PostgreSQL ; catalogue CacheEntry et corpus relationnel |
| Sources | OpenFootball, ESPN et enrichissements configurables ; aucune donnée inventée |
| Hébergement réel | VPS Ubuntu : Docker Compose, Caddy TLS, cache Nginx, app et worker séparés |
| Planification | crond Alpine ; routes internes protégées par CRON_SECRET |
| Cache | Révision DB, cache mémoire, cache HTML Nginx 5 minutes, ressources statiques séparées |
| SEO existant | src/lib/seo.ts, sitemap dynamique, robots, JSON-LD, breadcrumbs, contrôles automatisés |
| Configuration | DATABASE_URL/AIVEN selon sélection, NEXT_PUBLIC_SITE_URL, APP_ENV ; clés fournisseurs optionnelles |

Les secrets ne sont pas reproduits. Le domaine explicitement demandé par le
propriétaire est proba-match.com ; la mention Vercel historique d'AGENTS.md n'est
pas la cible de ce déploiement.

## Défauts confirmés et priorités

| Priorité | Défaut / pages | Cause et impact probable |
|---|---|---|
| P0 | Fiches dynamiques pendant une panne DB à froid | Un échec DB devenait un catalogue vide ; une ressource existante pouvait être traitée comme absente. Reproduit par tests isolés, pas par une panne provoquée en production. |
| P1 | Canonique de secours globale | Sans configuration VPS, fallback localhost ; un ancien domaine configuré renvoyait Vercel. Risque de signaux contradictoires. L'origine publique observée est actuellement correcte. |
| P1 | JSON-LD des matchs | EventCompleted et EventInProgress n'existent pas dans EventStatusType ; isPartOf n'est pas une propriété de SportsEvent. Défauts confirmés par Schema.org ; ne concernent pas le score visible. |
| P1 | Anciennes saisons de compétitions | Canonique de la saison courante et noindex systématique, malgré classements historiques disponibles ; archives accessibles seulement via sélection JavaScript. |
| P1 | /matchs?page=N | Métadonnées statiques de la première page pour des listes différentes ; pagination hors limites ramenée silencieusement à la dernière page. |
| P2 | /bilan-predictions | **18 669 207 octets de HTML** pendant l'audit navigateur. Transmission de tous les matchs terminés et de leurs journaux de révision à un composant qui n'en utilise qu'une partie. HTTP 200 confirmé : le dépassement d'une limite d'outil n'est pas une panne serveur. |
| P2 | /sitemap.xml | Recherche/filtrage du corpus pour chaque URL lors du calcul des dates ; coût inutile lorsque l'historique augmente. |
| P2 | Accueil | Fenêtre des analyses fondée sur data.updatedAt plutôt que sur l'heure courante ; dates impossibles normalisées par Date au lieu d'être rejetées. |
| P2 | /api/updates | Réponses sans base ou en erreur sans politique no-store cohérente. |
| P2 | Surveillance | Pas de rapport global périodique réunissant liens, métadonnées, sitemap, volume indexable et état des synchronisations. |
| P3 | Comparateur vide | Menus de sélection vides présentés sans profils disponibles. |

L'échec « every sitemap page has an incoming link » de l'audit borné était une
limite de l'outil : on ne peut pas établir l'absence de liens entrants depuis
des pages qui n'ont pas été visitées. L'outil est corrigé pour le signaler comme
couverture partielle, sans déclarer ces pages orphelines.

## Points déjà satisfaisants conservés

- URLs UUID des matchs conservées : pas de migration risquée ni rupture d'anciens liens.
- Politique de noindex pour recherches/préférences et fiches trop peu documentées.
- HTML français, métadonnées réutilisables, pagination canonique, descriptions factuelles.
- Organization/WebSite, SportsTeam, Person, SportsEvent et breadcrumbs existants.
- Guides méthodologie, probabilités, lexique et sources déjà structurés et liés.
- Images à dimensions réservées, chargement différé existant, sécurité CSP et administration protégée.
- Source et couverture des données affichées, résultats sauvegardés conservés en cas de panne.
- Pas de génération massive d'articles ni de modification artificielle des dates.

Le sitemap unique est conservé : 4 826 URL et sa taille restent très inférieures
aux limites 50 000 URL / 50 Mo. Le moniteur sait également lire un index de sitemaps
pour une segmentation future, sans imposer de nouvelles URLs maintenant.

## Limites et données sportives

Une vérification distincte des prédictions a trouvé 17 présences sur 23 matchs
à venir ; les absences ne prouvent pas toutes une panne. Horaire inconnu,
historique pondéré insuffisant et fenêtre de publication sont des conditions
réelles. Les statistiques possession/tirs exigent une source d'enrichissement.
La mission SEO ne remplace pas ces données par des valeurs supposées.

Pas d'accès authentifié à Search Console, à la base VPS ni aux logs actualisés.
La couverture globale des prédictions, le dernier import réellement réussi et
les CWV terrain sont donc **NON VÉRIFIÉS EXTERNEMENT** dans cette mission.

## Références officielles consultées

- [Google : canonicals](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google : sitemaps et lastmod](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google : règles des données structurées](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Google : événements et limites des résultats enrichis](https://developers.google.com/search/docs/appearance/structured-data/event)
- [Schema.org EventStatusType](https://schema.org/EventStatusType)
- [Schema.org isPartOf : domaine CreativeWork](https://schema.org/isPartOf)
- Documentation generateMetadata de Next.js 16.3.8 installée dans node_modules/next/dist/docs.

Le balisage d'un match ne garantit ni un résultat enrichi, ni un classement Google.
