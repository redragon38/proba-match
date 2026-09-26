# MatchScore

Plateforme française gratuite d’information football : scores, statistiques, profils, classements, comparaisons et projections. Aucun pari, paiement, bookmaker ou conseil de mise.

## Démarrer le projet

Prérequis : Node.js 22 ou 24 et npm. Le développement a été vérifié sous Windows avec Node.js 24.

```sh
npm install
npm run db:generate
npm run dev
```

Ouvrir **http://localhost:3000** après configuration de PostgreSQL et import OpenFootball (voir ci-dessous). Aucune clé API n’est nécessaire pour les données de base.

## Fonctionnalités livrées

- Accueil, matchs par date, filtres pays/compétition/statut/favoris, pagination des catalogues.
- Page match : aperçu, prédiction expliquée, statistiques, compositions sur terrain, événements, confrontations directes, performances individuelles observées.
- Profils équipe/joueur, effectifs, absences disponibles, données saisonnières et historique des relevés joueurs.
- Compétitions, calendrier/résultats, classement, buteurs disponibles.
- Comparateurs d’équipes et de joueurs, statistiques par 90 minutes, radar et graphiques SVG accessibles.
- Recherche instantanée dans le catalogue chargé et favoris locaux sans compte.
- Polling du backend partagé ; notifications locales sur autorisation, pendant que la page Favoris reste ouverte.
- Moteur Elo–Poisson déterministe, confiance de qualité des données, explications calculées, version et empreinte des entrées.
- Prédictions réelles persistées avant match ; protection PostgreSQL contre modification/suppression/écriture tardive ; évaluation après résultat.
- Backtest chronologique, Brier Score, Log Loss, précision et calibration multiclasses ; filtres compétition/mois/confiance.
- Administration authentifiée : quotas, synchronisations, historique d’erreurs, import par date, enrichissement explicite.
- Thèmes clair/sombre, navigation mobile, pages de confidentialité, méthodologie, métadonnées, sitemap et données structurées.

## Données gratuites et stockage local

```text
OpenFootball → import serveur → PostgreSQL → cache → services/API MatchScore → frontend
API-Football → enrichissement ciblé ──────────┘
```

Le frontend ne contacte aucun fournisseur. Sans clé secondaire, calendriers, résultats, équipes, classements calculés et projections restent disponibles après import. Le mode démonstration exige `MATCHSCORE_DEMO=true` **et un serveur de développement sans base** ; il n’est jamais servi en production.

### Configuration et commandes

Copier `.env.example` dans `.env`, puis configurer PostgreSQL. Les secrets restent côté serveur.

| Variable                      | Usage                                                  |
| ----------------------------- | ------------------------------------------------------ |
| `DATABASE_URL`                | Connexion PostgreSQL requise pour les données réelles  |
| `OPENFOOTBALL_LEAGUES`        | `fr.1,en.1,de.1,es.1,it.1` par défaut                  |
| `FOOTBALL_API_PROVIDER`       | `api-football`, adaptateur secondaire disponible       |
| `FOOTBALL_API_KEY`            | Facultative ; vide désactive l’enrichissement          |
| `FOOTBALL_DAILY_BUDGET`       | 90 appels/jour UTC ; 20 % réservés aux matchs en cours |
| `CRON_SECRET`, `ADMIN_SECRET` | Deux secrets indépendants d’au moins 32 caractères     |
| `NEXT_PUBLIC_SITE_URL`        | URL publique canonique                                 |
| `CONTACT_EMAIL`               | Contact public facultatif                              |
| `MATCHSCORE_DEMO`             | Démonstration explicite en développement uniquement    |

```sh
docker compose up -d
npm run db:migrate
npm run football:import       # quatre saisons, ligues configurées
npm run football:sync         # saison actuelle
npm run football:sync -- --force # revalidation anticipée (ETag conservé)
npm run football:rebuild-elo
npm run football:worker       # planificateur en premier plan
npm run test:football-db      # base de test isolée, créée puis supprimée
npm run build
npm run start
```

Les commandes football chargent `.env` automatiquement (Node 22 récent / 24). `football:validate` vérifie un fichier public sans écrire en base. L’import est également accessible dans `/admin` ; privilégier la CLI pour un historique volumineux pouvant dépasser la durée maximale d’une fonction hébergée.

### Identités, qualité et historique

Les nouveaux IDs internes sont des UUID ; `FootballIdentity` conserve les correspondances par fournisseur et type (équipe, compétition, joueur, match). Les IDs historiques API-Football restent compatibles avec les liens et prédictions existants. Les noms ne sont rapprochés que dans un périmètre contrôlé ; les cas ambigus apparaissent dans `/admin` pour confirmation.

Pour les cinq championnats aller-retour supportés, l’identité d’une rencontre utilise compétition, saison, domicile et extérieur, indépendamment de la date et de la journée. Un report met donc à jour le match. Deux rencontres avec la même paire ordonnée dans un fichier rendent celui-ci invalide : les coupes/replays exigent un adaptateur distinct.

Chaque fichier est validé avant import : dates, heures, équipes distinctes, scores entiers positifs ou nuls, doublons. La progression est reprise fichier par fichier. Un échec conserve le snapshot publié précédent ; les upserts permettent de reprendre les écritures relationnelles partielles. Les saisons historiques restent en tables relationnelles et dans le snapshot de lecture. Les classements sont calculés sans sanctions administratives ni départages propres aux ligues.

Les heures locales des ligues sont converties en UTC. Une date sans heure reçoit un repère technique à midi UTC, explicitement marqué `kickoffKnown=false` : l’interface affiche « Heure à confirmer » et aucune prédiction avant match n’est publiée pour cette rencontre. L’Elo est rejoué dans les jobs, seules les observations modifiées sont réécrites. Les prédictions sont calculées depuis l’historique local et sauvegardées avant match, sans antidatage.

### Cache, enrichissement et quotas

Le snapshot durable `football:dataset` se trouve dans PostgreSQL. Un cache mémoire borné regroupe les lectures concurrentes et sert le dernier relevé pendant la revalidation. Aucun chargement public ne déclenche de requête externe. Redis n’est pas nécessaire dans cette version.

Les jobs partagent un bail renouvelé, évitant les écrasements entre sources. OpenFootball est revalidé toutes les six heures ; les saisons anciennes au maximum une fois par mois (hors `--force`). ETag évite les transferts inutiles. Le secondaire ne cherche des identifiants manquants que pour des rencontres proches ; cette découverte est mémorisée une heure. Les détails sont récupérés par lots de vingt, avec TTL d’une minute en direct, cinq minutes avant match et confirmation après rencontre. L’historique ancien n’est pas enrichi automatiquement. Joueurs et blessures : six heures, uniquement pour les entités associées.

Le quota PostgreSQL est réservé atomiquement avant chaque appel, pages comprises. Un quota atteint ou une panne conserve les résultats locaux et affiche l’indisponibilité des statistiques. Les données live/confirmées secondaires ont priorité sur OpenFootball. Le coût fournisseur dépend des jobs et matchs suivis, pas du nombre de visiteurs.

### Planification

`vercel.json` prépare une synchronisation OpenFootball quotidienne à **05:15 UTC**, compatible avec une cadence quotidienne. Le worker local propose OpenFootball toutes les six heures et un contrôle secondaire toutes les minutes. Les appels inutiles sont évités par les TTL, les plages de matchs et le quota.

Sous Windows, `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-local-autostart.ps1` installe et démarre la tâche `MatchScoreRuntime` à l’ouverture de session, avec une tentative de reprise toutes les cinq minutes si elle s’arrête. Son superviseur vérifie PostgreSQL local, Next et le worker toutes les 30 secondes et relance les processus arrêtés. Ne pas lancer simultanément `npm start` ou un autre worker. Désactiver temporairement cette tâche pendant un build, puis la réactiver et la démarrer. Le PC doit rester allumé, connecté et la session ouverte ; ceci ne constitue pas un hébergement distant. Les journaux sont dans `.local/runtime/`, les exécutions dans `SyncRun`, le dernier contrôle du worker dans `CacheEntry` (`football:worker`).

Le navigateur vérifie `/api/updates` toutes les 30 secondes et renouvelle automatiquement les données des pages, y compris les nouveaux matchs et changements de calendrier. La version publiée dans PostgreSQL invalide le cache mémoire entre processus. Test complet isolé : `$env:FOOTBALL_VERIFY_UI='true'; npm run test:football-db` (build préalable). État et fréquences détaillés : `artifacts/automatic-sync.md`.

Routes protégées par `Authorization: Bearer <CRON_SECRET>` : `/api/cron/openfootball`, `/api/cron/fixtures`, `/api/cron/standings`, `/api/cron/live`. Les deux premières variantes statiques réutilisent le même job ; les classements dérivent des résultats importés. `/api/cron/sync` conserve la compatibilité avec l’enrichissement secondaire. Une cadence hébergée plus fréquente exige un planificateur adapté. Aucun déploiement distant n’est effectué automatiquement.

### Source et licence

[OpenFootball / football.json](https://github.com/openfootball/football.json) distribue ses données sous [CC0-1.0](https://github.com/openfootball/football.json/blob/master/LICENSE.md). Les URLs de chaque fichier, licence, ETag, empreinte et dernière synchronisation sont conservés dans `DataSource`. Le JSON est régénéré quotidiennement, mais la fraîcheur des sources amont dépend des contributions : OpenFootball ne garantit pas le direct ni l’exhaustivité des résultats. Les statistiques avancées ne sont jamais inventées.

## Moteur statistique v1

Code dans `src/prediction-engine` ; explications publiques sur `/methodologie`.

- Elo initial 1 500, K = 24, avantage domicile 60 points ; correction logarithmique de marge.
- Jusqu’à 20 matchs par équipe, minimum 5 ; demi-vie temporelle 60 jours.
- Pondération du lieu et correction modérée de force adverse.
- Espérance = combinaison attaque propre / défense adverse, puis ajustement Elo borné.
- Deux Poisson indépendantes, matrice 0–30, normalisation ; somme `P(1)+P(N)+P(2)=1` testée.
- Confiance séparée de la probabilité, reflétant quantité, récence, disponibilité et stabilité des données.
- Pas de modèle aléatoire, ni d’explication sans entrée correspondante.

La v1 n’est pas un modèle entraîné et validé sur toutes les compétitions. Les absences, la fatigue et les compositions n’affectent pas arbitrairement la force. Les compositions améliorent la qualité des informations et peuvent produire une version distincte. Possession/tirs/corners/cartons **projetés** sont « Données insuffisantes » tant qu’un modèle défendable n’existe pas. Les statistiques **observées** sont affichées quand la source les fournit.

L’indice joueur est une heuristique descriptive adaptée au poste, avec métriques par 90 minutes. Les données essentielles manquantes bloquent le calcul. L’indice « à suivre » intègre la part de titularisations, sans prétendre être une probabilité d’homme du match.

### Historique et backtest

```sh
npm run backtest
npm run backtest -- chemin/vers/matchs-normalises.json
```

Le fichier d’entrée doit être un tableau de `Match` normalisés (voir `src/types/football.ts`). Le résultat détaillé est écrit dans `backtest-results.json`, ignoré par Git.

Le backtest exclut les rencontres dont le résultat n’aurait pas été disponible : statut terminé et coup d’envoi au moins trois heures avant le cutoff. Les profils saisonniers actuels, blessures et compositions tardives ne sont pas utilisés. Ce délai conservateur ne remplace pas un journal bitemporel des corrections fournisseur ; les imports doivent être audités.

La performance réelle utilise les prédictions `initial` évaluées (jusqu’aux 10 000 dernières), pas les reconstitutions. Brier : somme des trois erreurs quadratiques, moyenne par match, étendue 0–2. Calibration : trois issues par match, tranches de dix points, avec effectifs visibles.

## Tests et qualité

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run start
npm run test:e2e
npm run test:visual
npm run backtest
```

`npm run check` regroupe TypeScript, lint, tests et build. Les tests SQL exécutent les véritables migrations PostgreSQL dans PGlite : ils couvrent l’écriture avant match, l’immutabilité et les contraintes. Cela ne remplace pas un test de connexion Prisma vers votre serveur PostgreSQL.

Playwright utilise Chrome installé sous Windows et Chromium sous Linux. Définir `PLAYWRIGHT_CHANNEL=chromium` pour forcer Chromium ; installer au besoin avec `npx playwright install chromium`. Les tests parcourent desktop et mobile, filtres, navigation, favoris persistants, thèmes, scores, protection admin et pages principales. Le script visuel génère captures et rapport axe dans `artifacts/`.

Les tests de fournisseur utilisent des réponses contrôlées. Aucun appel authentifié à un service réel n’est nécessaire dans la CI. Une clé API et une base réelle sont nécessaires pour vérifier l’intégration de production de bout en bout.

## Architecture

```text
src/app/                    Routes SSR, metadata et endpoints protégés
src/components/             Navigation, primitives, graphiques, provenance
src/features/               Matchs, profils, comparaison, recherche, administration
src/services/football/      Contrat fournisseur, mappings, synchronisation, persistance
src/services/predictions.ts Historique prédictif réel
src/prediction-engine/      Elo, Poisson, confiance, joueurs, évaluation, backtest
src/database/               Client Prisma
src/types/                  Modèles normalisés indépendants de l’API
src/lib/                    Formats français, dictionnaire i18n initial, auth, logs
prisma/                     Schéma et migrations SQL
scripts/                    Synchronisation, backfill, backtest et audit visuel
tests/                      Tests unitaires, SQL et E2E
```

La frontière i18n est préparée dans `src/lib/i18n.ts`. Toute l’interface actuelle est française ; ajouter une langue exige encore d’externaliser les autres libellés dans les dictionnaires.

Le modèle de lecture conserve les saisons configurées et l’accueil reçoit une projection réduite des données. La base relationnelle conserve l’historique importé. Pour des millions de matchs, faire évoluer les listes vers des requêtes paginées serveur, les profils vers des agrégats pré-calculés, le moteur vers des états incrémentaux par équipe et les synchronisations vers une file de travail. L’index de recherche et les index relationnels sont déjà prévus ; le catalogue client actuel ne prétend pas être validé à cette échelle.

## Déploiement

1. Relier ce dépôt à Vercel, preset Next.js.
2. Configurer les variables serveur et une base PostgreSQL accessible.
3. Exécuter `npm run db:migrate` une fois dans une étape de livraison disposant de l’accès base.
4. Build : `npm run build`. La génération Prisma est incluse, aucune migration destructive au build.
5. Configurer le planificateur, importer l’historique et vérifier `/admin`.
6. Renseigner les coordonnées réelles de l’éditeur/hébergeur dans les mentions légales et vérifier les droits de diffusion du fournisseur.

Aucun déploiement distant n’est déclenché par les scripts d’installation. Les pages légales sont une préparation technique : elles indiquent explicitement les informations d’exploitant encore inconnues. Aucun outil publicitaire ou analytique tiers n’est actif. Les notifications push quand le site est fermé et les comptes visiteurs ne sont pas activés ; leur schéma est préparé.

### Synchronisation et supervision en production

`vercel.json` reste compatible Hobby : OpenFootball quotidien à 05:15 UTC et enrichissement secondaire quotidien à 07:15 UTC (sans clé, aucune requête secondaire). Hobby déclenche dans l’heure prévue, sans garantie à la minute. Cette configuration quotidienne ne fournit pas un suivi live continu. Pour le live, utiliser un worker persistant existant ou, avec un plan autorisant cette fréquence, remplacer les schedules par `15 */6 * * *` pour OpenFootball et `* * * * *` pour `/api/cron/live`. Aucun changement de plan ou abonnement n’est automatique. Vérifier les exécutions dans Vercel après déploiement ; les previews ne déclenchent pas les crons.

Un moniteur externe peut interroger `/api/health` avec `Authorization: Bearer <CRON_SECRET>`, idéalement toutes les 5 minutes. Sans authentification : 401. Une base inaccessible, un import absent ou des sources trop anciennes : 503. Une clé secondaire absente, un quota épuisé ou une erreur fournisseur : JSON `status: warning`, à configurer également comme alerte. Le résultat ne contient ni URL de connexion ni secret. Un succès de job sans requête fournisseur ne masque pas une source périmée. Les journaux des jobs sont conservés dans `SyncRun` et consultables dans l’administration. Aucun service externe d’alerte n’est activé par ce code.

Avant ouverture publique, configurer les sauvegardes automatiques et la rétention chez le fournisseur PostgreSQL, puis tester une restauration dans une base distincte. Le dépôt ne prouve aucune sauvegarde distante. Employer un rôle applicatif restreint et une connexion adaptée au pooling serverless ; conserver un rôle de migration séparé. Ne jamais copier le compte PostgreSQL superutilisateur local comme compte de production.

## Références

- [Documentation Next.js](https://nextjs.org/docs/app)
- [Documentation API-Football](https://www.api-football.com/documentation-v3)
- [Optimisation du quota API-Football](https://www.api-football.com/news/post/how-to-optimize-api-sports-calls-and-quota-usage)

Les guides correspondant exactement à Next.js installé sont aussi disponibles dans `node_modules/next/dist/docs/`.

## Évolution produit — septembre 2026

L’application existante est conservée et enrichie : cartes de direct en tête d’accueil, `/live` avec filtres et favoris, catalogue `/equipes`, recherche instantanée dans le header (Ctrl/Cmd K), compétitions repliables et favoris prioritaires, partage natif ou copie de lien, liens des compositions vers les profils disponibles, et fils d’Ariane structurés.

L’accueil expose la forme calculée sur cinq matchs, les analyses disponibles et une synthèse des performances. Les fiches joueurs montrent les notes par rencontre lorsqu’elles existent. Les compétitions ajoutent passeurs, attaque et défense rapportées au nombre de matchs. Les sous-classements domicile, extérieur et cinq derniers matchs sont explicitement calculés sur le catalogue synchronisé : ils ne remplacent pas le classement officiel.

Le navigateur interroge `/api/live` avec les IDs nécessaires, sans recharger le document ni relancer le fournisseur externe. Le polling de scores est suspendu dans un onglet masqué, possède un timeout et un délai progressif après erreur. Les derniers scores restent affichés. Les changements de score sont mis en évidence. Les événements conservent leur provenance ; la mi-temps est déterminée par le statut du fournisseur, jamais par la seule minute 45. Le calendrier et les heures de match s’adaptent au fuseau du navigateur après l’hydratation (premier rendu Europe/Paris).

La version `elo-poisson-1.1.0` utilise les ratings adverses connus **avant chaque rencontre historique**. Un indice de forme sur dix matchs au maximum compare le résultat à l’attente Elo, avec demi-vie de 30 jours. Le multiplicateur de forme vaut `exp(0.12 × (forme domicile − forme extérieur) / 100)` dans l’ajustement Elo borné existant. Les paramètres sont sauvegardés avec la version. Cet ajustement reste expérimental : aucune supériorité n’est revendiquée sans validation réelle. Les blessures et les compositions ne sont toujours pas transformées en effets de force non validés.

Les anciennes versions et instantanés restent immuables. La fiche match expose uniquement l’historique réellement enregistré ; le mode fictif n’invente pas de courbe de publication. Les performances se filtrent par version, période, compétition, mois et qualité des informations, avec synthèses par groupe et exactitude mensuelle. Les probabilités affichées utilisent l’arrondi par plus grands restes pour totaliser exactement 100 %.

La synchronisation traite d’abord les détails live. Un échec de détail conserve les scores récupérés et signale les détails incomplets. Une migration supplémentaire indexe statut/date des matchs et saison/position des classements.

La connexion administrateur est limitée à dix tentatives par dix minutes. PostgreSQL partage le compteur entre instances via `CacheEntry` ; sans base, un compteur local borné est utilisé. Sur Vercel, le compartiment est calculé à partir de l’adresse fournie par la plateforme, puis haché avec la clé administrateur. Ailleurs, un compartiment global est appliqué : adapter explicitement cette politique avant d’utiliser un autre proxy. Aucun secret ni adresse IP brute n’est journalisé. Une base indisponible bloque la vérification plutôt que de désactiver la limite.

`CONTACT_EMAIL` configure le lien public de contact. Sans valeur, la page explique que le canal est indisponible. L’interface d’analytics émet uniquement des événements locaux nommés (`match_opened`, `team_opened`, `player_opened`, `search`, `favorite_added`), sans requête réseau, identifiant personnel ou texte recherché. Aucun collecteur n’est activé.

Validation étendue : `npm run test:e2e`, `npm run test:visual`, `VISUAL_THEME=dark npm run test:visual` (PowerShell : `$env:VISUAL_THEME='dark'; npm run test:visual`), puis `node scripts/responsive-check.mjs`. Ce dernier couvre 320, 375, 390, 430, 768, 1024, 1280, 1440 et 1920 pixels. Les rapports sont dans `artifacts/` ; ils décrivent des contrôles locaux, pas une certification d’accessibilité ou un test de charge à grande échelle.
