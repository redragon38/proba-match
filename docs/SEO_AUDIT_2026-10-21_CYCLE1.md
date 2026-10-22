# Audit SEO final — 21 octobre 2026

## Périmètre et méthode

Dépôt téléchargé : `redragon38/proba-match`, à partir de `origin/master`.
Travail sur `main` demandé explicitement. Stack constatée : Next.js 16.3.8,
React 19, TypeScript, Prisma 6.19.3, PostgreSQL, Vitest et Playwright.
Le dépôt comportait déjà un moteur Elo–Poisson, des contrôles temporels, une
politique SEO centralisée et un audit Playwright : ces mécanismes ont été conservés.

Le site public et le build local sont deux objets de validation distincts.
Le site public n'est pas réputé déployé avec ce correctif avant preuve d'un déploiement.
Aucun accès à la base de production, au cron de production, à Search Console ou
à CrUX n'a été utilisé. Aucun import sportif ni changement de données en production.

## Anomalies confirmées et corrections

| Sujet | Avant, constaté dans le code | Après |
| --- | --- | --- |
| Scores exacts | Répartition des arrondis à 100 % pour les cinq scores, mais arrondi individuel ailleurs | Même formatage individuel dans les scénarios et la grille ; somme arrondie éventuellement différente de 100 %, expliquée |
| Distributions de buts | Arrondi réparti entre catégories, distinct des probabilités du même événement dans les autres sections | Formatage centralisé de chaque événement ; barres basées sur la valeur brute |
| Probabilités incorrectes | Une distribution positive pouvait être renormalisée arbitrairement | Rejet des valeurs hors [0,1], non finies et des sommes différentes de 1 au-delà de 1e-8 |
| API du jour | Date par défaut UTC et comparaison de sous-chaînes UTC | Jour et sélection en Europe/Paris ; fuseau et date explicités dans la réponse ; dates seules préservées |
| Date de prédiction | Jour du serveur combiné avec une heure de Paris | Jour et heure calculés en Europe/Paris, fuseau visible |
| Fiche équipe | Historique cumulé sans bornes ; moyennes présentées comme saison courante | Filtre de saison commun au bilan et au graphique, bornes du bilan et couverture partielle explicites |
| Classement | Nombre de résultats et vérification des résultats non affichés | Compétition, saison, nombre distinct de résultats disponibles, source, vérification réelle ou mention indisponible |
| Agrégation classement | Un identifiant répété pouvait compter plusieurs fois | Déduplication par identifiant ; filtre de saison explicite disponible |
| Crawler | Requêtes sans temporisation ni reprise bornée | Temporisation, requêtes séquentielles, timeout, retries bornés, limites explicites, découverte de fiches hors sitemap, URL finale et redirection enregistrées |
| Surveillance | Audit manuel/CI existant | Workflow hebdomadaire borné ; option de santé authentifiée pour la fraîcheur et les synchronisations |
| Mobile 320 px | Accueil et liste de matchs élargissaient le document à 530 px | Colonne de grille `minmax(0, 1fr)` ; reflow validé sur le build reconstruit |

Le 1N2 conserve sa répartition d'affichage à 100 % uniquement pour une distribution
mathématiquement valide. Les paramètres et les probabilités du moteur ne sont pas modifiés.
L'abstention pour données insuffisantes est conservée. Les fiches sans prédiction
disposaient déjà des faits disponibles, résultats, liens et explications : aucune
probabilité artificielle n'a été ajoutée.

## URL, sitemap, robots, canonical et métadonnées

Les tests réels GET/HEAD du domaine ont confirmé HTTP 200 pour `/robots.txt` et
`/sitemap.xml`. Le XML téléchargé et parsé contient **5 030 URL**, sans que ce nombre
ne soit assimilé à autant de pages auditées en détail.
Robots autorise les pages publiques, bloque `/api/` et déclare
`https://proba-match.com/sitemap.xml`.

Première passe publique : **30 pages**, **444 contrôles**, **14 vues navigateur**,
**35 liens supplémentaires** testés, aucun échec. Les URL exactes et chaque contrôle
figurent dans `artifacts/seo-production-2026-10-21.json.gz`.
Cette passe couvre les routes principales et les premières pages de pagination.
Le crawler a ensuite été enrichi pour prioriser une fiche de chaque famille
match/équipe/joueur/compétition dans les audits bornés.
Seconde passe publique représentative : **30 pages, 454 contrôles, 18 vues navigateur**,
aucun échec, 35 liens supplémentaires sans erreur ni redirection. Elle inclut
`/match/1ad0e317-5556-84e4-8222-e1197f8bd204`,
`/equipe/olympique-de-marseille-55d90959`, `/joueur/abraham-marcus-60ae872b`
et `/competition/ligue-1`. Preuves : `artifacts/seo-production-entities-2026-10-21.json.gz`.

Le match exact demandé a été inspecté séparément en production, HTTP 200 :
`/match/f851aa7b-6ca9-8a6f-882d-2c70049afe79`. L'écart est reproduit :
1–0 = 8 % dans les cinq scénarios, 7 % dans la grille. L'URL est self-canonical.
La capture textuelle est dans `artifacts/seo-target-match-2026-10-21.json`.
Les variantes `http://proba-match.com/` et `https://www.proba-match.com/`
répondent en 301 directement vers `https://proba-match.com/`.
Les deux crawls publics représentent **34 chemins distincts**, plus le match ciblé,
soit **35 pages publiques distinctes** inspectées. Les JSON complets sont compressés
sans perte en `.json.gz` ; les originaux restent disponibles dans `.local/evidence/`.

Première passe locale sans base : **24 pages**, **299 contrôles**, **14 vues**,
aucun échec ; détails dans `artifacts/seo-local-2026-10-21.json.gz`.
La présence des avertissements HTTPS local et absence de jeton de santé est attendue.

Sur les pages contrôlées : titres/descriptions présents et uniques, canonical,
HTML sans JavaScript, H1, langue, JSON-LD, Open Graph, images, liens et non-indexation
des routes privées sont vérifiés par le script. Aucun modèle de métadonnées,
canonical, sitemap ou robots n'a été remplacé sans défaut confirmé.
Les données structurées ont passé le contrôle de syntaxe/type et les correspondances
visibles implémentées par l'audit ; cela ne remplace pas Google Rich Results Test.

Pas de lien cassé ni de redirection parmi les liens effectivement testés dans ces
premières passes. L'absence d'erreur sur cet échantillon ne prouve pas l'absence
d'erreur sur les 5 030 URL. La détection des pages orphelines est explicitement
incomplète lorsque l'audit est borné.

## Données et synchronisation

Les saisons des vues compétition et des tableaux de classement étaient déjà filtrées.
Les fiches équipe avaient un historique cumulé distinct : elles permettent maintenant
de choisir sa saison et affichent les bornes exactes du bilan disponible.
Les sanctions et règles officielles restent signalées comme non garanties dans les
classements recalculés ; aucune règle sportive n'est inventée.

Le pipeline existant possède transactions, verrou renouvelé, quota, observation des
résultats, enregistrement des échecs, cache et contrôles de fraîcheur. Il est conservé,
avec ses tests existants. Sa bonne exécution en production reste NON VÉRIFIÉE EXTERNEMENT.
La surveillance peut appeler `/api/health` avec `SEO_HEALTH_TOKEN` ; sans jeton elle
émet un avertissement et ne prétend pas avoir contrôlé la fraîcheur.

## Validation et environnement isolé

`npm ci` et génération Prisma réussis. Audit npm : aucune vulnérabilité parmi les
dépendances de production ; six alertes élevées dans l'outillage de développement
(chaîne braces/micromatch/fast-glob/ESLint et Vite). Aucun `audit fix --force` ni
changement majeur de framework appliqué pour masquer ces alertes.

Suite complète : **67 fichiers, 387 tests réussis**, commande
`npm test -- --maxWorkers=1 --testTimeout=30000`.
Première exécution : deux dépassements du délai de 5 secondes (logos et replay
historique), puis réussite complète avec 30 secondes ; ce sont des essais consignés,
pas des tests supprimés.

Le typecheck et le premier build de production ont réussi.
Le second build final a également réussi ; les cinq suites ciblées relancées après
l'harmonisation des distributions passent, **22 tests sur 22**.
Le script de sécurité HTTP passe ses **18 contrôles** (`artifacts/security-http.json`).
L'intégration PostgreSQL passe : verrou, reprise après échec, deux cycles automatiques
à horloge accélérée, idempotence, report de rencontre, score/minute/événements,
statistiques/compositions, blessures/récupération, classement, quotas et panne fournisseur.
Ce test utilisait encore une expiration de verrou de 30 minutes alors que le contrat
actuel est deux minutes renouvelées : son assertion et son scénario de chevauchement
ont été corrigés ; aucun délai du verrou de production n'a changé.
Deux sélecteurs E2E visaient l'ancien nom accessible du bouton de recherche : ils
visent maintenant son nom réel incluant les matchs. Les tests ne sont pas supprimés.

Audit complet local sur fixtures : **600 pages, 8 996 contrôles, 2 615 liens supplémentaires**.
Aucun lien cassé ni redirection ; deux débordements détectés à 390 px, sur l'accueil
et sur la fiche équipe. Les corrections sont la grille mobile et la largeur maximale
du sélecteur de saison. Après reconstruction : **40 pages, 602 contrôles, 18 vues**,
80 liens supplémentaires, **aucun échec**. Cet audit ciblé vérifie les quatre familles
sportives, les pages touchées et les contrats globaux. Le rapport complet antérieur
conserve les deux échecs initiaux : ils ne sont pas effacés des preuves.

La passe E2E complète a exécuté 72 cas : 64 réussis, 2 ignorés conditionnellement et
6 échecs (débordements et anciens sélecteurs). La reprise des trois suites concernées
a confirmé 12 cas corrigés, et révélé deux erreurs CSP Analytics après interaction.
La CSP autorise maintenant les sous-domaines régionaux `analytics.google.com` ;
Analytics conserve la mesure des visites avec les fonctionnalités publicitaires Google
Signals/personnalisation désactivées afin de ne plus appeler les pixels d'audience
que la politique bloquait. Ce réglage suit la
[documentation Google](https://developers.google.com/tag-platform/security/guides/privacy).
Le crawler enregistre désormais également les erreurs de console CSP/hydratation.

Validation de livraison après ce dernier correctif : **build réussi avec TypeScript**,
lint **0 erreur / 2 avertissements Open Graph existants**, **26 tests ciblés réussis**,
**14 E2E sur 14 réussis** sur ordinateur/mobile et **18 contrôles de sécurité réussis**.
La reprise E2E couvre tous les six cas échoués de la passe complète ; le bilan
consolidé est 70 cas validés et deux ignorés conditionnellement (le scénario d'accueil
vide ne s'applique pas aux fixtures du jour), sans prétendre à une nouvelle passe
unique de 72 cas. Aucun échec de validation ne reste ouvert dans le périmètre testé.
Le crawler final, incluant les erreurs CSP, a de nouveau validé **40 pages / 602
contrôles / 18 vues / 80 liens supplémentaires**, sans échec ; preuve :
`artifacts/seo-local-delivery-2026-10-21.json.gz`.

### SEO POST-MODIFICATION — périmètre testé

| Contrôle | État | Limite ou preuve |
| --- | --- | --- |
| Build, TypeScript | PASS | Build final de production local |
| Indexation | PASS / NON TESTÉ | Directives contrôlées ; indexation Google non accessible |
| Metadata, URLs, Canonical | PASS | Audits publics et locaux ; toutes les familles échantillonnées |
| Sitemap, Robots | PASS | XML, unicité, HTTPS public, lastmod et HTTP ; corpus complet public non crawlé |
| Maillage | PASS / WARNING | 2 615 liens locaux et liens publics testés ; orphelins publics non exhaustifs |
| Images, Structured Data | PASS | Dimensions/alt, images sociales, JSON-LD dans les audits |
| Mobile | PASS | Reflow 320/640 px, vues 390/1 440 px et E2E corrigés |
| Performance | WARNING | Mesures labo disponibles ; INP/CWV terrain NON TESTÉS |
| Erreurs techniques | PASS | Aucun échec final local ; santé production authentifiée NON TESTÉE |

Les journaux des différentes tentatives restent dans `.local-*.log` (ignorés par Git).
Les rapports `.json.gz` contiennent les URL exactes, contrôles, métadonnées et mesures ;
la compression conserve leurs données intégralement.
Le lint ne présente aucune erreur, avec deux avertissements existants sur les
éléments `img` nécessaires aux images Open Graph.
Les tests ajoutés couvrent saisons/doublons, comptage de classement, valeurs
invalides, cohérence d'arrondi, minuit, changements d'heure et dates seules,
retries réseau et périodes visibles.

Une instance PostgreSQL 17.10 locale a été préparée dans `.local/` (ignoré par Git),
liée uniquement à `127.0.0.1:55440`, base `proba_match_ci_seo`. Les cinq migrations
et le seed de test existant ont réussi : 288 rencontres et 256 joueurs synthétiques,
uniquement dans cette base de test. Le premier essai de cluster Windows utilisait
WIN1252 ; un nouveau cluster UTF-8 a corrigé ce problème d'environnement, sans
modifier une base existante ni le schéma de production.

## Surveillance et reproduction

Audit complet local : `npm run test:seo`, serveur de production déjà démarré.
L'audit suit toutes les URL du sitemap et les fiches publiques découvertes ; la
concurrence des requêtes de contrôle est limitée à une.
Configuration : `VERIFY_URL`, `SEO_CANONICAL_ORIGIN`, `SEO_REQUIRE_HTTPS`,
`SEO_REPORT`, `SEO_DELAY_MS`, `SEO_MAX_PAGES`, `SEO_LINK_LIMIT`.
L'absence de limite explicite conserve le mode complet. Les limites et troncatures
sont inscrites dans le rapport. Les dates lastmod présentes sont contrôlées, jamais
fabriquées ni remises artificiellement à aujourd'hui.

Le workflow `seo-monitor.yml` prévoit une exécution hebdomadaire, 40 pages,
80 liens supplémentaires, délai de 500 ms, et archivage du rapport même en échec.
Il peut utiliser le secret GitHub `CRON_SECRET` s'il existe pour le contrôle de santé.
Il ne crée aucun service payant et ne bloque pas l'application.

## Performance et limites externes

Les rapports navigateur conservent LCP, CLS, poids JavaScript et débordements pour
390 et 1 440 px. Ce sont des mesures ponctuelles de laboratoire, pas des Core Web
Vitals au 75e percentile. L'INP terrain n'est pas disponible. Aucun score Lighthouse
ni gain avant/après n'est inventé. Les agrégations de classement restent côté serveur
et réutilisent leur cache ; le compteur ajouté est transmis avec les tableaux.
Sur la seconde passe publique : LCP observé de 272 à 1 864 ms, CLS maximal
0,01075 et JavaScript transféré de 161 660 à 183 843 octets sur ces 18 vues.
Ces mesures décrivent la version publique observée, pas un gain attribuable au correctif.

Restent à vérifier avec les accès appropriés : corpus de production complet,
exactitude des données du fournisseur,
sanctions officielles, santé authentifiée, exécution réelle des cron, Search Console,
CrUX, Rich Results Test et résultat du déploiement.
Le dépôt avait `master` comme branche par défaut et aucune branche `main` ; pousser
sur `main` ne prouve pas que l'hébergeur suit cette branche ni que le planning GitHub
s'exécute sur cette branche. Vérifier ce rattachement avant de conclure à une mise en ligne.

## Publication GitHub et contrôle après envoi

Correctifs publiés sur `main` : commit `5ad57d5ac195ef322cca536d1f17199578265c33`.
L'arbre publié correspond exactement à l'index Git local validé
(`bcfb880bf2105cc3cc62edf0edce66b710c4c79d`). La copie locale suit `origin/main`
et ne contient aucun changement non publié. Aucun force-push.
L'envoi a utilisé la connexion du plugin GitHub ; Git Credential Manager local ne
disposait pas d'une authentification utilisable.

Contrôle GitHub du commit après publication : contexte **Vercel = failure**,
avec pour destination la page officielle
[Deployment blocked](https://vercel.com/knowledge/why-is-my-account-deployment-blocked).
Ce statut externe ne fournit pas la cause précise du blocage du compte. Aucun
déploiement de ce correctif n'est confirmé et aucune modification de facturation
ou dépense n'a été effectuée. Vérifier le compte/projet Vercel et la branche de
production ; le site public accessible pendant l'audit reste une preuve distincte
des validations locales. Cette intervention extérieure reste ouverte.

## Fichiers modifiés

`src/lib/probability-format.ts`, `src/lib/match-date.ts`,
`src/services/derived-standings.ts`, `src/services/football/catalog.ts`,
`src/services/football/read-model.ts`, `src/app/api/matches/today/route.ts`,
`src/features/matches/probability-summary.tsx`,
`src/features/profiles/team-profile.tsx`, `src/features/profiles/standings.tsx`,
`scripts/verify-seo.mjs`, `scripts/seo-http.mjs`,
`.github/workflows/seo-monitor.yml`, tests associés et rapports dans `artifacts/`.
S'ajoutent `src/app/mobile.css`, `scripts/seed-e2e.ts` (saison explicite des seules
fixtures synthétiques), `scripts/verify-football-db.ts` et les sélecteurs E2E corrigés.
Dernier correctif : `src/lib/security-policy.ts`, `src/components/deferred-analytics.tsx`
et `tests/security-headers.test.ts`.
