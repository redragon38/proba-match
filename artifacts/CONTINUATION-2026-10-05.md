# Proba Match — deuxième passe du 5 octobre 2026

Travail sur la copie locale du dépôt `redragon38/proba-match`, issue de `master` (`f828972`). Aucune nouvelle branche, aucun envoi GitHub ni déploiement. Cette passe complète `IMPROVEMENTS-2026-10-05.md` ; ses preuves propres portent le préfixe `CONTINUATION-`.

## Corrections effectuées

- **Statistiques joueurs** : les notes calculées refusent les minutes/notes non finies ou négatives, les notes hors de l’échelle 0–10, les compteurs non entiers/négatifs, les buts supérieurs aux tirs et les titularisations supérieures aux apparitions. Les données essentielles manquantes restent indisponibles. Les heuristiques valides conservent leurs coefficients ; elles ne deviennent pas des probabilités de performance future.
- **Présentation des nombres** : NaN et les infinis deviennent « Non disponible », au lieu de s’afficher comme des statistiques.
- **Moyennes d’équipe** : chaque indicateur compte uniquement les matchs terminés avec résultat valide, antérieurs à la date de calcul, dont la statistique est documentée et valide. Possession hors 0–100, tirs non entiers/négatifs et valeurs non finies sont exclus. Un vrai zéro reste un zéro. Le filtre domicile/extérieur agit sur les moyennes et leur échantillon ; le pourcentage de possession porte son unité.
- **Fiche équipe** : nombre de matchs documentés visible par indicateur, dernier résultat confirmé, ordre chronologique par timestamp réel. Sur petit écran, deux cartes côte à côte puis une carte large rendent les mentions d’indisponibilité lisibles.
- **Comparateur** : un index des rencontres par équipe remplace les parcours répétés du corpus entier. Aucun historique ni fonctionnalité de comparaison n’est supprimé.
- **Évaluation** : nouvel outil de sélection temporelle des paramètres, sans écriture de prédictions de production ni modification automatique du moteur.

## Comparaison temporelle reproductible

Commande :

```sh
npm run models:validate -- artifacts/IMPROVEMENT-HISTORICAL-CORPUS.json --reconstructed --output=artifacts/CONTINUATION-MODEL-VALIDATION.json
```

Trois candidats prédéfinis : `goalStrength` 0,8 (référence), 0,6 et 1 ; avantage domicile 60 et demi-vie 60 jours conservés. Les prévisions de chaque candidat utilisent uniquement l’historique disponible avant leur propre coup d’envoi. Pour chaque période juillet–juin, le candidat est sélectionné par Log Loss sur les prévisions antérieures dont le résultat était disponible à la frontière, puis évalué sur la période suivante. Au moins 200 observations d’entraînement sont requises. Les candidats sont comparés sur les mêmes matchs ; les données de test ne servent pas à choisir le candidat. Les périodes insuffisantes ne produisent aucune métrique. Les identifiants dupliqués, prévisions postérieures au kickoff, résultats incohérents et frontières invalides sont refusés.

| Période de test        | Historique évaluable | Matchs de test | Coefficient retenu |
| ---------------------- | -------------------: | -------------: | -----------------: |
| Juillet 2023–juin 2024 |                  329 |            278 |                0,8 |
| Juillet 2024–juin 2025 |                  607 |            299 |                0,8 |
| Juillet 2025–juin 2026 |                  906 |            298 |                0,8 |

Sur ces **875 matchs**, sélection et référence sont identiques : Brier **0,602451**, Log Loss **1,006136**, accuracy **50,4 %**, MAE domicile **0,985872**, extérieur **0,956248**, score exact **9,83 %**. Ces chiffres ne portent pas sur le même échantillon que la baseline globale précédente de 1 204 matchs ; ils ne doivent pas être comparés directement à ses moyennes.

**Aucun gain d’exactitude démontré.** Le moteur actif `elo-poisson-1.3.0` conserve donc ses paramètres. Ce corpus public a déjà été exploré pendant l’audit ; il ne constitue pas un jeu final indépendant réservé. Ses heures réelles de publication manquent : le mode reconstruit reste exploratoire et ne certifie pas l’absence de fuite liée aux fournisseurs. Le mode strict exécuté sur le même corpus produit **zéro observation et des métriques nulles**. L’empreinte SHA-256 du fichier et les métriques d’entraînement/test par période sont enregistrées dans les rapports JSON.

## Performance mesurée

Microbenchmark local sur 1 298 rencontres et 29 équipes, sept séries de 20 calculs, ordre alterné. Sorties strictement identiques entre l’ancien parcours et l’index, avec les mêmes nouvelles règles statistiques dans les deux versions. Médiane par calcul : **126,74 ms avant, 11,82 ms après**. Cette mesure isole la fonction du comparateur ; ce n’est ni une mesure de chargement des pages, ni un test de charge, ni une mesure de Core Web Vitals terrain. Voir `CONTINUATION-COMPARISON-BENCHMARK.json` et `scripts/benchmark-comparison.ts`.

## SEO POST-MODIFICATION et vérifications

| Contrat                                    | État                                   | Preuve et portée                                                                                                          |
| ------------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Build                                      | PASS                                   | Production Next 16.3.8 ; Prisma généré                                                                                    |
| Types / lint                               | PASS                                   | `CONTINUATION-VALIDATION.log`, `CONTINUATION-LINT.log`                                                                    |
| Tests unitaires / intégration              | PASS                                   | **239 tests, 40 fichiers** ; validation temporelle, valeurs invalides, équivalence du comparateur et HTML de fiche équipe |
| Indexation                                 | PASS local / NON VÉRIFIÉ EXTERNEMENT   | Politique d’indexation conservée ; contenu sportif vide hors index                                                        |
| Metadata / URLs / canonical                | PASS local                             | Audit SEO de 20 routes, 217 contrôles, zéro échec                                                                         |
| Sitemap / robots                           | PASS local                             | Contrats HTTP et SEO ; aucun changement de domaine                                                                        |
| Maillage / images                          | PASS local partiel                     | Liens et attributs vérifiés dans les pages accessibles ; catalogue réel absent                                            |
| Mobile                                     | PASS local                             | 154 vues responsive, 14 interactions ; huit vues ciblées de fiche équipe                                                  |
| Structured Data                            | PASS syntaxe / NON VÉRIFIÉ EXTERNEMENT | JSON-LD de l’application accessible parsé ; éligibilité Rich Results non certifiée                                        |
| Accessibilité ciblée                       | PASS au contrôle                       | Huit vues de fiche équipe, zéro violation WCAG A/AA détectée par axe ; aucune certification exhaustive                    |
| Erreurs techniques                         | PASS local partiel                     | Build, HTTP, tests navigateur du guide, filtres de fiche équipe ; zéro erreur JS sur la fixture                           |
| Sécurité HTTP                              | PASS au contrôle                       | 14 contrôles, zéro échec ; aucune certification globale                                                                   |
| Performance                                | WARNING                                | Microbenchmark de fonction ; CWV terrain et charge non mesurés                                                            |
| GEO / visibilité des moteurs               | NON VÉRIFIÉ EXTERNEMENT                | Aucune mesure de citations, classement ou trafic                                                                          |
| Parcours avec vraie base / synchronisation | NON TESTÉ                              | PostgreSQL et secrets non configurés                                                                                      |
| Suite E2E sportive complète                | NON VALIDÉE                            | Blocage connu : absence de matchs réels dans la base locale                                                               |
| Exactitude réelle supérieure               | NON DÉMONTRÉE                          | Candidats testés sans gain ; aucune promotion                                                                             |

L’audit SEO comporte un avertissement HTTPS attendu sur localhost. Les quatre tests E2E guide/méthodologie passent. Le contrôle HTTP sans navigateur vérifie 20 routes et 113 assertions.

La vérification ciblée de fiche équipe monte le **composant réel** avec les styles du build et une fixture explicitement fictive, isolée de la base. Elle vérifie 320, 390, 768 et 1 440 px dans les thèmes clair/sombre, trois choix de lieu par vue et neuf assertions statistiques par vue. Elle ne teste pas le routing complet avec des données réelles. Le script, la fixture, les captures et `CONTINUATION-TEAM-UI.json` sont fournis. La lecture visuelle a confirmé que « Non disponible » reste lisible sur mobile après correction.

Les limites externes et les actions d’installation du premier rapport demeurent : PostgreSQL, vraies coordonnées publiques, ingestion horodatée, tests DB/UI réels, contrôle du déploiement et suivi des prévisions futures. Les changements ne sont pas encore présents sur GitHub ou en production.
