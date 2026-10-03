# Audit du contenu automatisé Proba Match — 3 octobre 2026

Base auditée : commit GitHub `cdd7ed5`, puis corrections ciblées décrites ci-dessous.
Environnement : Node 24, PostgreSQL 17 isolé, 7 008 matchs OpenFootball, 129 équipes,
5 compétitions, aucun joueur dans le snapshot importé. Aucun secret ni contenu de `.env`
n'est inclus dans ce rapport. Aucun service public n'a été modifié pendant les tests.

## Applicabilité de la mise à jour Google

Les exigences de valeur utilisateur, d'exactitude, de transparence et de cohérence
des métadonnées s'appliquent aux pages programmatiques et aux explications statistiques.
Le moteur Elo–Poisson et les textes construits par règles ne sont pas des appels à une IA
générative. Aucun SDK, endpoint ou appel LLM n'a été trouvé dans le code applicatif.

La publication précise datée du **1er octobre 2026 n'a pas pu être confirmée** :
le proxy renvoie HTTP 403 pour les documents officiels suivants. Ce rapport n'est
donc pas une certification d'une mise à jour Google datée, ni une garantie de classement.

- https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- https://developers.google.com/search/docs/essentials/spam-policies

L'audit traite les exigences concrètes de la demande sans assimiler automatisation à spam.
Les domaines nécessaires ont été ajoutés au brouillon réseau ; cela ne prouve pas leur
activation dans l'instance courante.

## Contenu automatisé détecté

L'indexabilité indiquée ci-dessous est celle de la production. La preview cloud est
intentionnellement noindex et son sitemap est vide.

| Type / fichiers | Source → données → méthode → pages | Indexable | Risque et diagnostic |
| --- | --- | --- | --- |
| Import et pages programmatiques : `src/services/football/providers/openfootball.ts`, `openfootball-sync.ts`, `local-store.ts`, `read-model.ts` | OpenFootball → calendrier, scores, clubs, saisons → validation et snapshot PostgreSQL → matchs, équipes, compétitions, catalogues | Selon les règles de `src/lib/seo.ts` | Les contributions ne garantissent pas le direct. Pas de génération de prose pour remplir les pages. |
| Enrichissement : `providers/apiFootball.ts`, `providers/thesportsdb.ts`, `match-profiles.ts` | API-Football / TheSportsDB → stats, joueurs, compositions → normalisation et identités contrôlées → joueurs et onglets match | Profils individuels : ≥ 5 apparitions ; démo exclue | Facultatif, non configuré dans cette base. Les profils communautaires indiquent leurs limites et n'inventent pas de stats. |
| Calcul et explications : `src/prediction-engine/index.ts`, `insights.ts`, `src/lib/probability-format.ts` | Résultats antérieurs → Elo, récence, lieu, buts → Elo–Poisson et règles factuelles → probabilités / facteurs / scores possibles | Dépend de la page match ; pas d'indexation séparée | Estimations, pas résultats observés. Minimum 5 résultats par équipe ; facteurs quantifiés, pas de LLM. Moteur inchangé. |
| Interprétation statistique : `src/features/matches/match-statistics.tsx`, `src/services/statistics.ts`, `derived-standings.ts`, `competition-view.ts` | Scores/statistiques observés → seuils, moyennes et classement → profils, comparateurs, H2H | Équipes / compétitions sous conditions ; comparateurs noindex | Seuils explicités, xG absents restent absents. Défaut H2H « inconnu = 0 » corrigé. |
| Metadata et partage : `src/lib/seo.ts`, `src/app/{match,equipe,joueur,competition}/…/page.tsx`, `layout.tsx`, `opengraph-image.tsx` | Noms, date, source → templates courts → title / description / OG / Twitter | Suit la page | Pas de keywords artificiels, faux score ou faux auteur ; origine canonique centralisée. 25 descriptions/titles dynamiques distincts vérifiés. |
| Schémas : `src/components/json-ld.tsx`, `breadcrumbs.tsx`, `src/app/layout.tsx`, pages entités | Données visibles → objets Schema.org échappés → WebSite, BreadcrumbList, SportsTeam, SportsEvent, Person | Présents aussi sur des pages noindex réelles | Pas de notes, avis, prix ou auteur inventés. Heure inconnue : date source seulement, pas le repère technique de midi. |
| Images : `src/components/ui.tsx`, `provider-image.tsx`, pages joueur et performances | Club / joueur réel → alt descriptif, dimensions → logos et portraits | Suit la page | Pas de bourrage SEO ; placeholders visuels distingués des photos. Aucun portrait réel disponible dans cette base. |
| Sitemap : `src/app/sitemap.ts`, `src/lib/seo.ts` | Snapshot → critères partagés → URL uniques et timestamp match réel | Production uniquement | Démo exclue, entités faibles filtrées ; aucun ajout massif d'URL effectué. |

Inventaire des routes de production et de leur valeur :

| Routes | Volume observé / possible | Valeur propre et politique |
| --- | --- | --- |
| `/`, `/matchs`, `/live`, `/equipes`, `/joueurs`, `/competitions`, `/classements`, `/a-propos`, `/methodologie` | 9 types statiques, plus pagination catalogue (6 pages équipes actuellement) | Calendrier, résultats, catalogue, comparaisons, sources et méthode ; catalogues vides exclus selon règles existantes. |
| `/equipe/[slug]` | 129 | Matchs, forme, buts, classement, liens ; index si ≥ 5 rencontres. Dix profils échantillonnés : 1 804–2 623 caractères de contenu principal. |
| `/competition/[slug]` | 5 | Résultats, calendrier, équipes, classement par saison ; index si rencontres disponibles ; variantes de saison noindex. Cinq pages : 3 598–3 901 caractères. |
| `/match/[id]` | 7 008 | Identité, date, résultat/statut, historique et projections disponibles ; dix pages échantillonnées : 1 053–1 139 caractères. Index réservé aux événements, compositions ou statistiques détaillées. Aucun match éligible dans l'import OpenFootball de cette instance. |
| `/joueur/[slug]` | 0 actuellement, extensible par enrichissement | Profils, stats et historique lorsqu'observés ; index si ≥ 5 apparitions, sans texte de remplissage pour un profil incomplet. Non vérifié avec des joueurs réels ici. |
| Recherche, favoris, paramètres, comparateurs, administration, contact, pages légales | Routes utilitaires | Noindex existant préservé. Entités et pages de catalogue inexistantes : 404. |

La politique match est conservatrice : des pages utiles restent noindex sans données avancées.
Ce choix préexistant n'est pas une preuve de spam ; il n'a pas été élargi arbitrairement.

## Scaled content

**PASS sur le périmètre inspecté.** Les templates présentent des données propres aux
rencontres, équipes et saisons. Pas d'appel LLM, de paraphrase massive, de texte SEO de
remplissage ni de variations artificielles de mots-clés détectés. Les 25 pages échantillonnées
ont des contenus distincts. Les catalogues vides et profils insuffisants ne sont pas
automatiquement poussés dans le sitemap. Aucun jugement de Google n'est inféré de cet audit.

## Contenu

- **Exactitude : PASS pour la correction et les données contrôlées, WARNING pour la couverture externe.**
  7 008 dates de match valides, aucune référence d'équipe absente ; 5 485 matchs terminés,
  aucun score manquant dans ceux-ci. Le défaut H2H était reproductible avec des scores
  incomplets, même si ce snapshot ne contient pas ce cas. Fournisseurs avancés non vérifiés.
- **Utilité : PASS.** Pages fondées sur calendriers, résultats, historique, calculs et limites.
- **Duplication : PASS sur les 25 échantillons et les pages contrôlées par l'audit SEO.**
  Templates partagés mais valeurs et contenus distincts ; paramètres canonisés, pas de texte paraphrasé.
- **Valeur utilisateur : PASS.** Les pages répondent à un but sportif précis sans paragraphes
  artificiels. Les informations absentes restent indisponibles.

La fraîcheur est présentée comme une synchronisation réelle du snapshot, pas une garantie
que chaque événement est à jour. La source OpenFootball ne simule pas le direct. Les blessures,
compositions et stats avancées ne sont pas inventées. Les espérances du modèle ne sont pas
présentées comme des xG observés. Les seuils des lectures statistiques sont expliqués.

## Metadata automatique

- **Titles : PASS** sur les pages contrôlées ; noms et dates issus des données.
- **Meta descriptions : PASS** sur les pages contrôlées ; pas de promesse de score/statistique inventée.
- **Open Graph : PASS** sur les pages contrôlées ; origine, descriptions et image cohérentes.

Les 25 titres/descriptions d'entités échantillonnés sont distincts et ne contiennent
ni `undefined`, ni `NaN`, ni `Invalid Date`. Pas d'abstraction de sanitation ajoutée
sans défaut démontré. Les profils joueurs réels restent non vérifiés dans cette instance.

## Structured Data

**PASS sur le code et les pages contrôlées ; WARNING pour la validation externe.**
WebSite, BreadcrumbList, SportsTeam, SportsEvent et Person seulement. Pas de Product,
Offer, Review, AggregateRating, Article, VideoObject, faux auteur ou fausse note.
Le schéma match omet le lieu absent et ne présente pas midi UTC comme une heure réelle
lorsque le coup d'envoi est inconnu. Les données structurées reflètent l'identité visible.
Les champs facultatifs restent omis lorsqu'absents. Aucun correctif de schéma justifié.
La syntaxe valide n'implique pas l'éligibilité aux résultats enrichis Google ; le Rich Results
Test public est **NON VÉRIFIÉ EXTERNEMENT**, comme Person sur des joueurs réels ici.

E-commerce / Merchant Center / flux produits : **NON APPLICABLE** ; rien créé.

## Alt images

**PASS pour les images contrôlées et le code.** Logos nommés, portraits attribués au joueur,
pas de liste de mots-clés. Les graphiques utilisent des libellés accessibles. Portraits réels
non testés faute de joueurs dans le snapshot. Aucun changement de design ou d'images.

## Transparence

Nécessaire : **PARTIELLEMENT**. Une précision dans la méthodologie est utile pour distinguer
calcul statistique, explications par règles et IA générative. Elle a été ajoutée une seule fois.
Pas de label « généré par IA » appliqué aux pages ; pas de fausse attribution humaine.
Proba Match est identifié comme produit ; sources, calculs, limites, confiance et historique
sont déjà expliqués. L'identité légale de l'exploitant reste à fournir par celui-ci avant ouverture
publique ; elle n'a pas été inventée.

## Modifications réalisées

| Fichier | Problème | Modification | Justification / priorité |
| --- | --- | --- | --- |
| `src/services/statistics.ts` | Score inconnu assimilé à zéro dans H2H | `recordedGoals` calcule uniquement sur des scores complets, entiers, positifs ou nuls ; aucun résultat valide → null | Exactitude des contenus automatiques, **P1** |
| `src/features/matches/match-detail.tsx` | Moyenne divisée par toutes les rencontres, même sans score | Total et moyenne sur le sous-ensemble connu ; nombre de scores disponibles indiqué ; liste des confrontations conservée | Inconnu ≠ 0, sans perte de fonctionnalités, **P1** |
| `src/app/methodologie/page.tsx` | Mode de fabrication du texte pas explicitement distingué d'un LLM | Paragraphe court : calcul Elo–Poisson automatique, explications par règles, sans IA générative | Compréhension du « comment », **P2** |
| `tests/recorded-goals.test.ts` | Régression des cas manquants non couverte | 3 tests : résultats incomplets, absence totale, vrai 0–0 et nombres invalides | Preuve ciblée du correctif, **P1** |
| `artifacts/AUTOMATED-CONTENT-AUDIT.md` | Audit à rendre inspectable | Inventaire, décisions, preuves et limites consignés | Traçabilité |

Avant : `[2–1, ?–4, 0–0, 3–?]` produisait 10 buts et une moyenne de 2,5.
Après : seuls `[2–1, 0–0]` participent au calcul : 3 buts, moyenne 1,5,
deux scores connus sur quatre rencontres. Aucun résultat connu : indisponible, pas zéro.
Ces cas de test sont contrôlés ; ils ne sont pas présentés comme des résultats sportifs réels.

## Éléments déjà conformes

Moteur PredictionEngine, paramètres/calibration, APIs, sources et données, routing, design,
probabilités, xG, seuils des lectures statistiques, cache, titres/descriptions/social existants,
alt, canonicals, JSON-LD, robots et politique sitemap conservés. Aucun nouveau catalogue,
auteur, service IA ou contenu générique. Absences, lineups et notes ne deviennent pas des
certitudes. Démo explicitement fictive et exclue de la production. Pas de traitement IA par visite.

## Tests

Toutes les commandes ci-dessous ont été exécutées ; les limites sont conservées.

- Typecheck : **PASS**, `npm run typecheck`.
- Lint : **PASS**, `npm run lint` ; un avertissement préexistant dans `opengraph-image.tsx`.
- Tests unitaires : **PASS**, `npm test` : 31 fichiers, **169 tests**.
- Build : **PASS**, `npm run build` et build de validation avec `APP_ENV=production`.
- Tests navigateur : **FAIL**, `npm run test:e2e` : **36 réussis, 2 échoués sur 38**,
  aucun test ignoré. Le même scénario desktop/mobile exige au moins 4 matchs contenant
  des profils joueurs ; aucun joueur n'est présent dans le snapshot OpenFootball.
  L'absence de données n'a pas été masquée par un skip ou des données inventées.
- SEO post-modification : **PASS local**, `npm run test:seo` avec build/runtime production,
  origine canonique `https://proba-match.vercel.app` : **158 pages, 2 044 contrôles,
  10 vues navigateur, 0 échec, 0 avertissement** ; **1 170 liens découverts**, 1 013 cibles
  supplémentaires vérifiées, aucun lien cassé ni redirection interne découverte.
  Le résultat n'établit pas l'état du déploiement public.
- Tests DB/UI : la suite `test:football-db` échoue avant cette mission sur le mock
  d'enrichissement API-Football (`scripts/verify-football-db.ts:309`, partial vs success).
  Le mock renvoie des fixtures pour les nouveaux endpoints de détails ; ce défaut indépendant
  n'a pas été changé dans une mission SEO sans changement d'API/DB.

Preuve additionnelle : 10 équipes, 10 matchs et 5 compétitions rendus sans JavaScript,
titres/descriptions distincts, noms cohérents avec le snapshot, aucune valeur invalide dans
les metadata. Pas de profils joueurs réels à échantillonner.

Le premier essai de simulation production avec un build preview mélangeait meta index et
en-têtes noindex. C'était une configuration de test incohérente, pas un correctif applicatif
à réaliser : le contrôle a été relancé avec build et runtime tous deux en mode production.
La preview finale reste noindex ; les mesures locales ne sont pas des Core Web Vitals terrain.

**SEO POST-MODIFICATION**

| Contrat | Résultat |
| --- | --- |
| Build | PASS |
| Indexation | PASS local en production ; preview volontairement noindex |
| Metadata / Open Graph | PASS sur les pages auditées |
| URLs / 404 / redirects locaux | PASS |
| Canonical | PASS, origine existante conservée |
| Sitemap | PASS, URLs uniques et pages éligibles ; vide en preview |
| Robots | PASS, ressources et noindex crawlables |
| Maillage | PASS, aucun lien cassé ni page du sitemap orpheline dans le contrôle |
| Images | PASS, alt et dimensions ; portraits réels NON TESTÉS |
| Mobile | PASS, vues 390/1440 et tests complémentaires jusqu'à 375/768/1024 ; aucun débordement dans l'audit |
| Performance | PASS pour les budgets locaux du runner ; CWV terrain NON VÉRIFIÉS EXTERNEMENT |
| Structured Data | PASS syntaxe/code ; Rich Results Test NON VÉRIFIÉ EXTERNEMENT |
| Erreurs techniques | PASS audit SEO ; WARNING couverture joueurs / échec DB préexistant décrit plus haut |

Les sorties détaillées de l'exécution restent dans les fichiers locaux ignorés
`.local/seo-after.json`, `.local/content-samples.json`, `.local/content-inventory.json`,
`test-results/` et `playwright-report/`. Le rapport Git conserve les résultats agrégés,
sans exposer des fichiers de configuration ou des secrets.

## Actions manuelles

- Pour confirmer la publication précise du 1er octobre, appliquer l'accès réseau à
  `developers.google.com` (ajout enregistré) ou fournir le lien/document officiel exact.
- Avant une ouverture publique, compléter l'identité réelle de l'exploitant mentionnée comme
  manquante dans les mentions légales. Ne pas inventer d'auteur ni d'expertise.
- Pour valider des profils joueurs réels, configurer les sources d'enrichissement choisies et
  vérifier leurs droits ; aucune clé n'est requise pour le calendrier/résultats OpenFootball.
- Sur le déploiement réel seulement, refaire le test SEO HTTPS, vérifier les redirections et
  utiliser Search Console / Rich Results Test / CrUX pour les contrôles externes.

Git : les seuls changements à publier sont les quatre fichiers code/tests décrits et
ce rapport. Le push demandé vise la branche principale existante `master`, sans force,
à partir du checkout cloud `work`. Le résultat du push est communiqué dans le compte rendu final.
