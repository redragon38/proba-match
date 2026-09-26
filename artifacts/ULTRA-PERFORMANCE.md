# Proba Match — passe de performance finale

## Correction des écrans match et joueurs (26 septembre 2026)

Le match réel Troyes–Marseille du 11 octobre avait cinq résultats antérieurs côté Troyes et 107 côté Marseille : le modèle pouvait calculer une projection, mais la fenêtre de synchronisation de sept jours l'excluait. La fenêtre passe à 21 jours ; un lancement du job a archivé 67 nouvelles projections dans PostgreSQL en 6,2 secondes, dont celle de ce match. Le rendu de la fiche lit directement son historique archivé, sans charger toutes les prédictions. L'onglet statistiques montre les résultats antérieurs réels lorsque la source ne fournit pas de statistiques de match ; les états vides des joueurs et compositions indiquent précisément la limite de la source. Aucun effectif ni événement n'a été inventé.

Après cette synchronisation, l'accueil envoyait toutes les projections au navigateur : 427 866 octets. Le filtrage sur les matchs visibles ramène le HTML à 267 452 octets et la médiane HTTP locale chaude de 108,7 à 90,2 ms (huit appels après préchauffage). Fiche Troyes–Marseille : 35,0 ms sur la prédiction, 30,2 ms sur les statistiques ; `/joueurs` : 17,6 ms. Ces mesures locales ne représentent ni la latence Vercel ni les Core Web Vitals terrain. Le corpus local possède toujours zéro joueur ; les profils et statistiques détaillées dépendent d'une source secondaire autorisée et configurée.

## Mise à jour après la correction des journées vides

Le 26 septembre 2026, la source locale n'a aucune rencontre du 21 septembre au 8 octobre pour les cinq championnats suivis. L'accueil affiche désormais la journée réelle la plus proche (20 résultats du 20 septembre), et l'onglet « À venir » les rencontres du 9 octobre. Mesures locales sur le nouveau build, huit appels consécutifs par route après le premier : `/` 83,2 ms médians pour 296 727 octets, `/?statut=scheduled` 62,2 ms pour 257 186 octets, `/joueurs` 16,5 ms et `/api/matches` 10,6 ms. L'augmentation du poids de l'accueil correspond à des rencontres et scores réels rendus dans le HTML. Les autres chiffres de ce rapport décrivent la passe précédente et les mesures de processus froid n'ont pas été répétées après cet ajout. SEO : 158 pages et 2 042 contrôles sans échec ; 30 E2E et 141 tests unitaires réussis. Les joueurs restent indisponibles tant que la source secondaire n'est pas configurée.

Mesures du 26 septembre 2026 sur `next start` local, PostgreSQL local, 7 008 matchs, 129 équipes, 60 prédictions et aucun joueur disponible. Les mesures HTTP sont faites sur `localhost`, sans limitation réseau ni CPU ; elles ne représentent pas la latence de Vercel ou des utilisateurs. Les fichiers `ultra-*.json` et `response-ultra-*.json` conservent les échantillons. Les processus froids ont été relancés séparément sur le port 3002. Aucune requête de charge n'a visé la production ou un fournisseur externe.

## Performance Summary

- Goulots confirmés : filtre SQL `IN` de 7 008 identifiants pour seulement 60 prédictions (53,3 ms médians côté fonction DB), classement des formes de 129 équipes avec 129 balayages de l'historique (29,6 ms), reconstruction/normalisation de l'index de recherche à chaque requête (7,9 ms pour une recherche), tri des matchs avec `Date.parse` répété (8,9 ms), calcul de tous les classements à chaque vue (11,2 ms).
- Corrections : lecture et filtre local des prédictions quand le catalogue dépasse 1 000 matchs ; regroupement de la forme en un passage ; index de recherche normalisé mémorisé par snapshot ; date de match calculée une fois avant le tri ; classements mémorisés par snapshot. Une nouvelle version de données possède de nouveaux tableaux et provoque un recalcul. Les jeux de démonstration mutables ne sont pas mémorisés.
- Sur les mêmes parcours locaux, médianes HTTP : accueil 111,44 → 58,62 ms, fiche match 70,21 → 28,58 ms, classements 45,28 → 35,94 ms, recherche API 12,90 → 4,88 ms, liste API 12,80 → 8,90 ms. Les réponses ont conservé exactement le même nombre d'octets pour ces parcours. `/matchs` varie de 48,32 à 55,77 ms dans cette série ; aucune amélioration n'y est revendiquée.
- Limites : chargement initial du snapshot JSON complet depuis PostgreSQL ~156 ms ; processus froid local 1,07–1,59 s ; HTML de `/classements` 408 883 octets ; JS de l'accueil mobile 249 584 octets transférés. La lecture sans filtre de `Prediction` est rapide pour 60 lignes aujourd'hui mais devra être re-profilée si la table grossit fortement.

## Sub-Millisecond Operations

Médianes de 12 exécutions en processus, après préchauffage, sur le même snapshot réel. Elles excluent HTTP, réseau et rendu React.

| Opération | Avant | Après | < 1 ms vérifié |
|---|---:|---:|---|
| Cache L1, valeur déjà chargée | 0,001 ms | 0,001 ms | Oui |
| Index de recherche déjà chargé | 3,300 ms | 0,289 ms | Oui |
| Filtrage de recherche catalogue | 7,864 ms | 0,481 ms | Oui |
| Autocomplétion | non mesuré | 0,637 ms | Oui |
| Vue des classements déjà calculée | 11,240 ms | 0,001 ms | Oui |
| Sélection de tous les matchs | 8,940 ms | 4,629 ms | Non |
| Forme des équipes pour l'accueil | 29,556 ms | 5,181 ms | Non |
| Lecture des prédictions, fonction + DB | 53,305 ms | 5,517 ms | Non |

## Server Routes

« Froid » = premier appel dans un nouveau processus Next local ; « chaud » = médiane de cinq requêtes sur le serveur local persistant après préchauffage. Les deux colonnes viennent donc de séries distinctes. Temps total HTTP local, pas temps CPU serveur. Cache L1 : vérifié séparément par une lecture de snapshot suivie de 10 appels concurrents ; le temps DB n'a pas été isolé route par route et n'est pas inventé.

| Route | Froid | Chaud | Cache hit | Temps DB dans la route | Payload |
|---|---:|---:|---|---|---:|
| `/` | 1 587 ms | 58,62 ms | L1 chaud | non isolé | 215 460 o |
| `/matchs` | 1 398 ms | 55,77 ms | L1 chaud | non isolé | 206 882 o |
| `/live` | 1 267 ms | 15,76 ms | L1 chaud | non isolé | 68 398 o |
| `/classements` | 1 463 ms | 35,94 ms | L1 chaud | non isolé | 408 883 o |
| `/recherche?q=paris` | 1 343 ms | 13,92 ms | L1 chaud | non isolé | 67 664 o |
| `/api/matches` | 1 385 ms | 8,90 ms | L1 chaud | non isolé | 13 451 o |
| `/api/search?q=paris` | 1 069 ms | 4,88 ms | L1 chaud | non isolé | 2 062 o |
| Fiche match réelle | 1 547 ms | 28,58 ms | L1 chaud | non isolé | 280 826 o |
| Fiche équipe réelle | 1 306 ms | 27,93 ms | L1 chaud | non isolé | 214 949 o |

21 parcours/routes HTTP ont été sondés. Le détail joueur n'a pas pu être mesuré : le jeu local contient zéro joueur. Sous 1/10/50 lectures simultanées de `/api/matches?statut=scheduled`, p50 9,68/33,61/166,67 ms, p95 9,68/52,31/255,85 ms, 0 erreur. Ce test est local et non représentatif d'une capacité de production.

## Database

- `EXPLAIN ANALYZE` local sur la nouvelle lecture des 60 prédictions : tri + `Seq Scan`, 0,386 ms d'exécution PostgreSQL (1,125 ms de planification) ; l'appel Prisma complet médian vaut 5,517 ms. Le balayage séquentiel est adapté à cette petite table. Aucun index ajouté sans justification.
- La lecture du marqueur de révision prend 0,788 ms médians en processus ; le chargement d'un snapshot complet prend 156,243 ms. Ce coût est porté par les premiers appels ou changements de révision, pas par chaque réponse chaude.
- Aucun N+1 ajouté. Les prédictions restent pré-calculées par la synchronisation. Le test PostgreSQL isolé couvre synchronisation, score live, classement, quota et mise à jour UI.
- Pooling et latence DB dans l'environnement Vercel réel : **NON VÉRIFIÉ EXTERNEMENT**.

## Cache

- L1 : `MemoryCache` borné à deux snapshots, TTL 15 s, stale-while-revalidate et single-flight existants ; index et classements dérivés mémorisés par identité des tableaux de snapshot. Changement de révision ⇒ nouveau snapshot ⇒ nouveau calcul. Les réponses privées restent hors cache public.
- Cache partagé/source : `CacheEntry` PostgreSQL ; Redis non installé, car aucun résultat de profilage ne le justifie. Les lectures HTTP de `/api/updates` restent `no-store`.
- Sonde locale dans un nouveau processus : 11 appels à `getDataset`, 1 lecture du payload, 2 lectures du marqueur, zéro appel fournisseur, révision identique. Cela ne constitue pas un taux de hit de production. Les caches mémoire ne sont pas partagés entre instances Vercel.

## Frontend

- Aucun JavaScript, composant, image ou police supprimé sans preuve d'un bénéfice sûr. Le poids JS mesuré est inchangé : accueil mobile 249 584 octets, `/matchs` 250 052 octets, recherche 154 943 octets.
- Mesures navigateur local mobile 390 px : accueil LCP 576 ms avant/après, CLS 0 ; desktop accueil LCP 492 → 448 ms, CLS 0. Ces observations uniques, sans limitation réseau, **ne sont pas des Core Web Vitals terrain**. INP non mesuré.
- 196 vues responsive et 36 vues accessibilité sans échec. Fiche joueur indisponible dans les données locales.

## External Providers

Les routes publiques sondées lisent DB/cache locaux. Les appels OpenFootball et API-Football sont dans la synchronisation serveur, pas dans les requêtes utilisateur ordinaires. Aucune modification fournisseur dans cette passe. Temps et quotas en production : **NON VÉRIFIÉ EXTERNEMENT**.

## Validation

| Contrôle | Résultat |
|---|---|
| Typecheck | PASS |
| Lint | PASS |
| Tests unitaires | PASS — 142/142, puis 7 tests ciblés après les derniers ajustements |
| Build de production | PASS — Next.js 16.3.5 |
| E2E desktop/mobile | PASS — 30/30 |
| Contrat PostgreSQL/UI isolé | PASS |
| SEO local | PASS — 158 pages, 2 042 contrôles, 0 échec/avertissement |
| Sécurité HTTP | PASS — 14/14 |
| Responsive | PASS — 196 vues, 0 échec |
| Accessibilité/identité | PASS — 36 vues, 0 échec |

**SEO POST-MODIFICATION** — Build, Indexation, Metadata, URLs, Canonical, Sitemap, Robots, Maillage, Images, Mobile, Structured Data et Erreurs techniques : PASS local. Performance : WARNING (snapshot froid, HTML classements, JS). Régressions SEO détectées : aucune. Corrections SEO : aucune nécessaire. Vérifications manuelles : Vercel déployé, HTTPS/www, Search Console, PageSpeed/CrUX et INP terrain — **NON VÉRIFIÉ EXTERNEMENT**.

## Final Performance Verdict

**OPTIMIZED WITH REMAINING BOTTLENECKS**. Les goulots mesurés et sûrs à corriger ont diminué nettement sans perte de fonctionnalité. Le démarrage à froid, le snapshot complet et la taille des pages riches restent visibles ; leur réduction exige une conception plus large ou des mesures en production. Aucun résultat local ne prouve une réponse HTTP ou une page en moins de 1 ms.
