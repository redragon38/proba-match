# Proba Match — branding, SEO, accessibilité et performances

Vérification du 26 septembre 2026 sur le build de production local, http://localhost:3000.
Domaine canonique conservé : https://probamatch.com. Aucun déploiement effectué.

## Branding Proba Match

| Élément | Résultat |
|---|---|
| Logo principal sombre et clair | Intégré, variantes extraites du fichier officiel sans redessin ni recoloration |
| Icône compacte mobile | Intégrée depuis la déclinaison fournie |
| Favicon / Apple touch icon | Intégrés, fichiers PNG 32 et 180 px, réponses HTTP 200 |
| Manifest / PWA | Nom Proba Match, icônes PNG 192 et 512 px accessibles |
| Header desktop / mobile | Vérifiés visuellement et automatiquement |
| Dark / light mode | Vérifiés, sans changement des couleurs globales |
| Open Graph | Logo officiel et message social, 1200 × 630, réponse HTTP 200 |
| Footer, pages légales, admin, metadata et JSON-LD | Marque publique remplacée |
| Anciennes occurrences publiques | Aucune détectée dans le code rendu ni dans les 36 vues inspectées |

Les clés localStorage, noms de tables, variables techniques et tâche Windows existants sont
conservés. Les rapports historiques ne sont pas réécrits. Le master fourni est une planche JPG,
pas un SVG ; le dérivé PWA 512 px est agrandi depuis l'icône raster fournie, sans détail inventé.

Fichiers : `public/brand/*`, `src/components/shell.tsx`, `src/app/sport.css`,
`src/app/icon.png`, `src/app/apple-icon.png`, `src/app/manifest.ts`,
`src/app/opengraph-image.tsx`. L'ancien `src/app/icon.svg` a été remplacé.
`scripts/prepare-brand.mjs` reproduit les extractions depuis la planche 1536 × 768.

## Diagnostic SEO

Stack existante : Next.js 16.3.5 App Router, React 19, TypeScript, Prisma/PostgreSQL,
cache de snapshot versionné et worker séparé. Rendu serveur, routes métiers existantes,
metadata centralisées dans `src/lib/seo.ts`, sitemap dynamique via `indexablePaths`.

PASS local : 159 pages et 2 055 contrôles ; 1 169 liens découverts, aucun lien cassé ni
redirection inutile. Titles/descriptions, canonicals, robots, sitemap, rendu sans JS,
noindex des pages privées/faibles, 404 et JSON-LD vérifiés. Les images de marque ont des
dimensions et des URLs stables ; robots.txt ne bloque pas leurs ressources.

Les deux annonces ont été vérifiées auprès de Google :

- [September 2026 spam update](https://status.search.google.com/incidents/XhUDXP7A67iHCD2kmbVu) : lancement mondial le 24 septembre, toutes langues, déploiement annoncé jusqu'à deux semaines. L'annonce n'introduit pas de règle technique spécifique à ajouter au site.
- [Web multimodal dans Search Console](https://developers.google.com/search/blog/2026/09/web-multimodal-in-sc) : nouveau filtre de performance pour les recherches visuelles. Cette fonction de reporting n'impose pas une modification du code.

Contrôle fondé sur les [politiques antispam](https://developers.google.com/search/docs/essentials/spam-policies)
et les [recommandations images](https://developers.google.com/search/docs/appearance/google-images).
Aucun cloaking, bourrage de mots-clés, faux avis, redirection trompeuse, contenu parasite ou
génération massive de textes SEO détecté dans le code inspecté. Les fiches utilisent les
données football avec attribution et limites ; les matchs sans enrichissement restent noindex.
Les filtres sont canonicalisés, les paginations utiles ont leurs propres canonicals.
Les onglets/menus masqués servent l'interface, sans contenu caché destiné au classement.

Non applicable : avis, produits/prix, articles IA, sitemap image spécialisé, ajout de balisage
pour « forcer » Lens. Aucun changement de code n'est nécessaire pour les annonces Google seules.
Backlinks, historique public du domaine, actions manuelles et indexation effective :
**NON VÉRIFIÉS EXTERNEMENT**.

## Modifications SEO

| Fichiers | Problème et correction | Raison |
|---|---|---|
| `src/lib/seo.ts`, `src/app/layout.tsx` | Ancien nom remplacé dans metadata, descriptions et WebSite JSON-LD | Identité cohérente |
| Pages métier, À propos, Contact, Méthodologie, légales, admin, composants de profils | Libellés publics Proba Match | Cohérence du contenu visible avec les metadata |
| `src/components/shell.tsx`, `src/app/sport.css` | Logo officiel avec variantes et dimensions fixes | Alt descriptif, responsive, stabilité visuelle |
| `manifest.ts`, icônes et `opengraph-image.tsx` | Ancienne identité graphique remplacée | Identité navigateur, PWA et partage |

Canonicals, politique d'indexation, sitemap et robots déjà corrects : conservés.
Aucune nouvelle page SEO, aucun texte artificiellement rallongé, aucune information légale inventée.

## Accessibilité

PASS : 36 vues axe WCAG A/AA, incluant les critères 2.1/2.2 disponibles, sans violation détectée.
Pages : Accueil, Matchs, Live, Classements, Équipes, Joueurs, Comparateur, Recherche et fiche
match ; deux thèmes et deux largeurs. Contrôles supplémentaires du header à 320 et 768 px.
Recherche clavier, focus initial et fermeture Échap, menu mobile et absence de débordement
vérifiés. Le bouton de menu annonce désormais « Fermer » lorsqu'il est ouvert et référence
la sidebar via aria-controls. Logo nommé Proba Match, lien d'accueil explicite.

Aucun problème bloquant restant détecté dans ce périmètre. Une passe axe ne constitue pas
une certification WCAG ; parcours exhaustif avec lecteurs d'écran réels non effectué.

## Frontend

Logos horizontaux WebP : 10,2 et 8,9 ko ; dimensions réservées, aucun CLS mesuré sur les vues
de performance. Aucun ajout de dépendance, police, script tiers ou refonte des composants.
La recherche conserve debounce 180 ms, minimum deux caractères, annulation et limite dix résultats.
Les listes paginées et projections de données existantes sont conservées.

Accueil mobile : LCP local 664 → 764 ms ; desktop : 520 → 608 ms. CLS : 0 → 0.
JavaScript accueil : 249 290 → 249 420 octets compressés observés. Ces captures isolées,
sans throttling et prises à des heures différentes, ne prouvent pas un gain frontend ; la
légère hausse de LCP reste à contrôler sur réseau mobile réel. Aucune mesure INP terrain.
Les mesures restent sous 2,5 s localement, sans garantie sur la production.

## Serveur

Médianes locales de sept lectures après une première requête ; valeurs en millisecondes.
Les variations modestes entre deux séries ne sont pas des gains causaux démontrés.

| Route | Avant | Après | Travail principal identifié dans le code |
|---|---:|---:|---|
| `/` | 145 | 135 | Rendu React, lectures des projections et assemblage des données |
| `/api/live` | 8 | 9 | Révision DB et projection du cache |
| `/api/updates` | 4 | 3 | Lecture indexée du marqueur |
| `/api/matches/today` | 6 | 5 | Filtrage du snapshot |
| `/api/search?q=paris` | 19 | 14 | Construction/filtrage du catalogue serveur |
| `/api/matches/:id` | 5 | 4 | Recherche dans le snapshot |
| `/api/teams/:id` | 5 | 4 | Recherche dans le snapshot |
| `/api/competitions/:id` | 4 | 4 | Recherche dans le snapshot |
| `/match/:id` | 88 | 72 | Rendu et lecture des projections sauvegardées |
| `/performance-modele` | 40 | 36 | Lecture des évaluations et rendu |

Après modification, les cinq lectures live simultanées ont toutes répondu 200 en 10–33 ms.
Pas de stress test externe. Le corpus du jour était vide : ce test ne reproduit pas un soir
avec cent matchs live. Première lecture de l'accueil : 631 ms ; aucune route ne dépassait
régulièrement 500 ms dans la série chaude. La ventilation DB/cache/calcul par requête HTTP
n'a pas été instrumentée ; les mesures DB/cache ci-dessous sont distinctes.

## Base de données et prédiction

Correction de la lecture N+1 dans `src/services/predictions.ts` : les prédictions non évaluées
des matchs terminés sont chargées en un lot puis regroupées par match. Les colonnes inutiles
ont été retirées des lectures de projections. Les probabilités, règles d'insertion immuable,
cutoffs, évaluations et historiques sont inchangés.

Mesure en lecture seule sur 200 matchs réels terminés : **200 requêtes / 237,3 ms →
1 requête / 4,2 ms**, résultats identiques. Cet échantillon ne contenait aucune prédiction
en attente ; un test dédié vérifie aussi l'association correcte de deux prédictions en
attente à deux scores différents. Ce chiffre ne représente pas la durée totale d'un import.

Aucun index ajouté sans justification. EXPLAIN ANALYZE utilise `Match_status_kickoff_idx`
pour la plage de matchs planifiés (0,075 ms, résultat vide dans l'échantillon). La petite
table CacheEntry est parcourue séquentiellement en 0,058 ms : pas de ralentissement justifiant
un changement. Clés uniques et index existants vérifiés sur matchs, équipes, joueurs,
identités fournisseur, prédictions et cache. Le modèle réel reste calculé lors des jobs,
les requêtes utilisateur lisent les prédictions persistées.

## Cache

Stratégie conservée : snapshot PostgreSQL, révision partagée, mémoire bornée, single-flight,
revalidation et fallback vers la dernière donnée connue. Les jobs fournisseur restent séparés
des lectures utilisateurs ; aucune requête fournisseur n'est nécessaire sur les routes live.

Sonde de onze lectures dont dix simultanées : un chargement du payload, deux lectures du
marqueur observées, même révision pour tous les appels. Cette observation n'est pas un taux
de hit de production. Tests isolés : score et nouveau match propagés DB → cache → API → UI,
fallback quota et panne fournisseur, reprise de scheduler et libération de verrou validés.

## Vérifications

| Contrôle | Résultat |
|---|---|
| Build de production / typecheck / lint | PASS |
| Unitaires | PASS — 132 tests |
| PostgreSQL isolé + UI | PASS |
| E2E desktop/mobile | PASS — 22 ; quatre scénarios dépendant des rencontres du jour ignorés |
| SEO | PASS — 159 pages, 2 055 contrôles, aucun échec |
| Accessibilité ciblée | PASS — 36 vues |
| Sécurité ciblée | PASS — 14 contrôles |
| Responsive élargi | PASS — 210 vues, sept largeurs, deux thèmes et 14 parcours clavier/menu |
| Performance locale | PASS pour les mesures exécutées ; limites documentées ci-dessus |
| Lighthouse | NON TESTÉ — absent localement, aucune dépendance ajoutée uniquement pour un score |

Le test E2E attendait auparavant `/api/live?ids=...` même lorsque la liste était vide : il
contrôle désormais le polling global `/api/updates`, HTTP 200, no-store et révision, sans
rechargement du document. Le test responsive suit désormais le bouton via aria-controls
car son libellé accessible change correctement entre ouvrir et fermer.

### SEO POST-MODIFICATION

Build, Indexation locale, Metadata, URLs, Canonical, Sitemap, Robots, Maillage, Images, Mobile,
Structured Data et contrôles techniques : PASS dans le périmètre testé. Performance : WARNING
pour les mesures terrain manquantes et la légère variation de LCP local. Aucune régression
SEO détectée. Indexation Google et performances réelles : **NON VÉRIFIÉES EXTERNEMENT**.

## Actions manuelles

Dans Search Console après déploiement : vérifier la propriété probamatch.com, soumettre
/sitemap.xml, inspecter les canonicals et le rendu de pages représentatives, vérifier les
exclusions intentionnelles, actions manuelles et problèmes de sécurité. Comparer les
performances avant/après le déploiement de la spam update sans attribuer toute variation
au code. Consulter le filtre Web multimodal lorsqu'il est disponible et alimenté en trafic.

## À faire après déploiement

Relancer `test:seo` avec VERIFY_URL=https://probamatch.com et SEO_REQUIRE_HTTPS=true.
Vérifier HTTPS, variantes HTTP/www, cache/CDN, logos et image sociale publics, robots et
sitemap de production, noindex des previews. Mesurer PageSpeed, CWV CrUX (LCP/INP/CLS),
latences Vercel, cold starts, plans/index PostgreSQL et hit/miss sur la vraie charge.
Search Console, PageSpeed, TLS public, DB/cache de production : **NON VÉRIFIÉS EXTERNEMENT**.

Limite métier préexistante : OpenFootball peut fournir des résultats incomplets ; sans API
secondaire configurée, aucun live enrichi ne peut être promis. Les avertissements restent visibles.
Les réserves du [rapport pré-lancement](PRELAUNCH-AUDIT.md), notamment la chaîne publique,
la DB distante et les informations d'éditeur manquantes, ne sont pas levées par ces tests locaux.
L'état DNS/Vercel constaté dans cet ancien rapport n'a pas été revérifié pendant cette mission.

Preuves : `seo-audit.json`, `brand-accessibility.json`, `responsive.json`,
`response-before.json`, `response-after.json`, `database-performance.json`,
`cache-performance.json`, captures `brand-*.png` et rapports Playwright.
