# Proba Match — améliorations et SEO POST-MODIFICATION

Base : branche principale GitHub `master`, commit `f828972`. Travail sur une copie locale extraite de cette version. Architecture, design global, sources, routes existantes et fonctionnalités conservés. Aucun déploiement et aucune modification distante dans cette session.

## Changements

### SEO et lisibilité pour les moteurs de réponse

- Nouveau guide `/comprendre-probabilites` : réponses directes, exemples explicitement illustratifs, lexique, distinction entre buts attendus et xG, calibration et sources. Contenu serveur, sans dépendance à JavaScript pour sa lecture.
- Maillage depuis l’accueil, les matchs, la méthodologie et le pied de page. Sections ancrées et liens de sources réelles. Pas de pages générées en masse, de faux auteurs, de fausses notes ou de balisage « spécial IA ».
- Résumé de chaque match avec équipes, compétition, date, état et score enregistré lorsqu’il est valide. États annulé/reporté/abandonné et horaires inconnus explicitement distingués.
- Métadonnées, canonical et partage social différenciés pour contact, pages légales, recherche, favoris, paramètres et les deux comparateurs. Ces pages restent hors index.
- Indexation des pages explicatives indépendante de PostgreSQL. Pages sportives vides et démonstration hors index ; previews/staging toujours noindex et sans sitemap public.
- Résultats sans statistiques avancées éligibles seulement si les deux équipes possèdent au moins cinq résultats antérieurs. Sitemap et métadonnées partagent cette règle. Le calcul du contexte du sitemap utilise un parcours chronologique au lieu d’une recherche de tout l’historique par URL.
- URL du match et liens d’équipes ajoutés au SportsEvent existant, sans inventer de stade, d’adresse ou d’offre de billets. JSON-LD syntaxiquement vérifié ; aucune promesse de résultat enrichi.

Références officielles utilisées :

- https://developers.google.com/search/docs/appearance/ai-features?hl=fr
- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://developers.google.com/search/docs/appearance/snippet
- Documentation de `next@16.3.8` installée dans le projet.

Google indique que les fondamentaux SEO s’appliquent à ses fonctionnalités génératives et qu’aucun fichier llms.txt ni schema spécifique n’est nécessaire. La lisibilité et la provenance sont améliorées ici ; la visibilité GEO n’est pas mesurée.

### Présentation

Guide avec sommaire, cartes explicatives, lexique et grille adaptée aux petits écrans. Encadré pédagogique sur l’accueil. Le niveau faible/moyen décrit la qualité des informations ; l’indice technique /100 est conservé uniquement dans les détails. Les styles utilisent les couleurs et surfaces existantes. Le guide et la méthodologie ont été vérifiés sur 16 vues (320, 390, 768 et 1440 pixels ; clair/sombre), sans débordement, erreur JavaScript ou violation WCAG A/AA détectée par axe. Quatre tests de navigation du guide passent en desktop/mobile.

### Fiabilité statistique

- Baseline sauvegardée avant modifications : `IMPROVEMENT-BASELINE.json`, 204 tests initiaux passants.
- Version `elo-poisson-1.3.0` : aucune modification arbitraire des coefficients Elo/forme/Poisson ou du paramètre de réduction des buts 0,8 de la version 1.2.
- `resultObservedAt` date la réception locale de la révision actuelle d’un résultat. Une correction du score, des équipes ou du kickoff réinitialise sa disponibilité. Une synchronisation identique conserve sa date. Les premiers imports sont datés au moment réel de réception, jamais rétrodatés.
- Le moteur réel utilise exclusivement les résultats disponibles avant la prédiction. Le replay retire scores, événements, compositions et statistiques du match cible. Le mode de reconstruction est séparé, explicite et exploratoire. La démonstration est toujours identifiée comme fictive.
- Refus des dates invalides, résultats invalides, identités incohérentes, doublons éligibles, appels après kickoff, horaires inconnus en mode strict, échantillons inférieurs à cinq matchs et historiques dont le résultat le plus récent d’une équipe dépasse 180 jours.
- Tris temporels par instant réel, y compris avec différents fuseaux horaires. L’empreinte comprend les identités de la cible, les paramètres et les dates de disponibilité.
- MAE buts domicile/extérieur/total, exactitude du score le plus probable et calibration séparée 1/N/2. Les compteurs de buts et de scores sont indépendants des compteurs 1N2 ; absence de valeurs = indisponible, pas zéro.
- Les prévisions archivées restent immuables. L’évaluation utilise le résultat actuellement confirmé ; une correction ou un abandon ne doit pas conserver une performance calculée sur un résultat devenu faux.
- Résultats malformés exclus des classements et résumés d’équipes ; moyennes avancées débarrassées des valeurs non finies.
- Masses Poisson réutilisées entre les cases de la matrice, sans modifier les probabilités.

## Comparaison mesurée

Corpus public existant : 1 298 rencontres de Ligue 1, quatre saisons. Résultats réellement historiques, sans journal original de disponibilité. Les chiffres suivants décrivent uniquement une reconstruction exploratoire.

Le corpus normalisé est inclus dans `IMPROVEMENT-HISTORICAL-CORPUS.json`. Source : OpenFootball `football.json`, commit `e6744429ee395bc86f247348c6184bb08d4eb361`, saisons 2022–2025. Reproduction : `npm run backtest -- artifacts/IMPROVEMENT-HISTORICAL-CORPUS.json --reconstructed`, puis sans ce dernier argument pour constater l’absence de métriques certifiables en mode strict.

| Mesure            |    Avant |    Après |
| ----------------- | -------: | -------: |
| Matchs évaluables |    1 208 |    1 204 |
| Brier Score       | 0,597812 | 0,598391 |
| Log Loss          | 0,999686 | 1,000470 |
| Accuracy 1N2      |  51,41 % |  51,33 % |

Ces lignes portent sur des supports différents : il serait incorrect d’en déduire une régression ou un gain du modèle. Sur les 1 204 matchs communs, l’écart maximal des probabilités 1N2 est **0**. Quatre projections sont retirées par la limite de récence de l’historique. Aucune meilleure exactitude n’est revendiquée.

Le mode strict produit **zéro match évaluable** sur ce corpus dépourvu de `resultObservedAt` : ses métriques sont nulles. Les archives de production et leurs performances ne sont pas accessibles ici. Voir `IMPROVEMENT-COMPARISON.json`.

Microbenchmark local de 300 matrices Poisson par série, cinq séries : médiane avant 66,71 ms ; après 55,55 ms. Mesure exploratoire de cette fonction sur cette machine, pas de temps de réponse du site, de test de charge ou de Core Web Vitals terrain.

## Vérification et limites

Les preuves de cette session sont `IMPROVEMENT-SSR.json`, `IMPROVEMENT-CHECKS.json`, `IMPROVEMENT-BASELINE.json`, `IMPROVEMENT-COMPARISON.json` et les logs de validation fournis. Les rapports antérieurs du dépôt ne doivent pas servir à certifier les modifications présentes.

| Contrat                       | État                                   | Preuve / limite                                                                                                     |
| ----------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Build                         | PASS                                   | Build de production, Next 16.3.8, Prisma généré                                                                     |
| Types et lint                 | PASS                                   | Contrôles du projet                                                                                                 |
| Tests                         | PASS                                   | 217 tests unitaires/intégration ; quatre tests navigateur du guide                                                  |
| Indexation                    | PASS local / NON VÉRIFIÉ EXTERNEMENT   | Trois pages explicatives indexables ; contenu sportif vide noindex                                                  |
| Metadata                      | PASS local                             | Titres et descriptions distincts sur 20 routes                                                                      |
| URLs / canonical              | PASS local                             | Canonicals vérifiés, route match inexistante HTTP 404                                                               |
| Sitemap / robots              | PASS local                             | Pages explicatives présentes, absence de blocage global                                                             |
| Maillage                      | PASS partiel                           | Liens ajoutés ; crawl du catalogue réel non exécuté                                                                 |
| Images                        | PASS local                             | Attributs et dimensions dans l’audit SEO local ; catalogue réel non disponible                                      |
| Mobile                        | PASS local                             | 154 vues responsive / 14 interactions ; 16 vues ciblées guide/méthodologie                                          |
| Performance                   | WARNING                                | Microbenchmark seulement ; pas de CWV terrain ni de charge                                                          |
| Structured Data               | PASS syntaxe / NON VÉRIFIÉ EXTERNEMENT | JSON-LD parsé ; éligibilité Rich Results non testée                                                                 |
| Sécurité HTTP                 | PASS                                   | 14 contrôles, zéro échec ; aucune certification globale                                                             |
| Dépendances production        | PASS au contrôle                       | npm audit : zéro vulnérabilité connue remontée                                                                      |
| Erreurs techniques            | PASS local partiel                     | Types/tests/build, HTTP et absence d’erreurs navigateur sur les vues vérifiées ; parcours sportifs réels non testés |
| Exactitude des prédictions    | NON DÉMONTRÉE                          | Probabilités identiques sur support commun ; archives production indisponibles                                      |
| Base / synchronisation réelle | NON TESTÉ                              | PostgreSQL et secrets non configurés ; contrats testés localement                                                   |

Le téléchargement standard de Chromium a échoué avec une archive tronquée. Un Chromium 153 issu du paquet officiel @sparticuz/chromium a ensuite été obtenu et lancé dans un dossier d’outils séparé, sans dépendance ajoutée au projet.

`test:seo` passe : 20 routes, 217 contrôles, huit vues navigateur, zéro échec ; un avertissement HTTPS attendu sur localhost. `responsive-check` passe : 154 vues et 14 interactions, catalogue vide. Les 16 vues guide/méthodologie passent ; quatre tests E2E ciblés passent. La suite E2E complète a été arrêtée au premier test exigeant des matchs réels (base vide) : elle reste non validée. `test:football-db` est bloqué par `DATABASE_NOT_CONFIGURED`. Le contrôle HTTP complémentaire passe sur 20 routes / 113 assertions. Les parcours statistiques avec une vraie base restent à vérifier.

Preuves supplémentaires : `seo-audit.json`, `responsive.json`, `IMPROVEMENT-READING-VISUAL.json`, `IMPROVEMENT-VALIDATION.log` et `IMPROVEMENT-READING-E2E.log`.

Actions restantes après installation : configurer PostgreSQL et les vraies coordonnées publiques ; synchroniser les résultats pour établir les timestamps ; lancer les contrôles DB et navigateur ; vérifier le site déployé dans Search Console, Rich Results Test et les données terrain. Les prévisions futures seront évaluées après leurs résultats sur une période séparée, par compétition et par issue.

La deuxième passe et ses vérifications actualisées sont documentées dans `CONTINUATION-2026-10-05.md` (239 tests, sélection temporelle et fiche équipe). Les nombres ci-dessus décrivent la première passe.
