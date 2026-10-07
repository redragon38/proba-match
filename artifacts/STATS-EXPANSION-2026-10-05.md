# Proba Match — statistiques et lisibilité, 5 octobre 2026

Projet existant `redragon38/proba-match`, base `master` à `f828972`. Travail local, sans nouvelle branche, sans écriture distante ni déploiement. Cette passe complète les audits et baselines précédents, sans remplacement du moteur actif `elo-poisson-1.3.0` ni modification de ses coefficients.

## Informations ajoutées

- Trois scores les plus probables visibles immédiatement, cinq dans les détails, chacun accompagné de sa probabilité.
- Dix-sept lectures supplémentaires : nombre de buts de chaque équipe (0, 1, 2, 3+), victoire de chaque équipe par 1, 2 ou 3+ buts, total d'au moins 2, 3 ou 4 buts.
- Tableau de scores de 25 cases : les catégories 4+ regroupent toute la queue restante, sans supprimer les scores élevés.
- Plage contiguë de buts la plus courte couvrant au moins 80 % de la masse du modèle. Son explication distingue cette masse d'une garantie ou de la qualité des informations.
- Analogie de 100 rencontres comparables et explications simples des facteurs archivés : force Elo et terrain, attaque, défense, forme corrigée des adversaires. Aucune contribution chiffrée par facteur n'est inventée.

Ces événements sont tous dérivés de la même distribution Poisson. Ils ne constituent ni des modèles indépendants, ni de nouvelles preuves d'exactitude. Les marges de victoire sont des probabilités sur l'ensemble du match, et ne sont pas conditionnées à une victoire.

## Statistiques observées et sécurité des chiffres

Trois ratios descriptifs sont calculés uniquement si les compteurs sources sont exploitables : part des tirs cadrés, passes réussies, duels gagnés. Un dénominateur nul ne produit aucune proportion inventée. Le glossaire explique les principales statistiques, les xG observés et leurs différences avec les buts attendus avant match.

La validation commune au match et aux résumés d'équipe refuse valeurs négatives, non finies, pourcentages hors domaine et compteurs non entiers. Les doublons contradictoires deviennent indisponibles. Les composantes dépassant leurs totaux sont écartées. Un vrai zéro reste un zéro ; une valeur absente reste absente. Aucun compteur observé ni score de période n'est présenté sur un match programmé.

Les probabilités individuelles très petites sont affichées « < 1 % » et celles proches de 100 « > 99 % ». Le résultat 1N2 conserve un arrondi cohérent totalisant 100 %. Une partition incohérente est refusée, pas corrigée silencieusement.

## Comparaison temporelle du modèle de scores

Une correction des petits scores Dixon-Coles a été comparée au Poisson actif, avec les buts attendus existants. Il ne s'agit pas d'un entraînement complet Dixon-Coles. Les paramètres candidats étaient fixés avant sélection : rho 0, −0,05, −0,10 et 0,03. Sélection sur les périodes antérieures puis test sur la période suivante ; minimum 200 prédictions communes en entraînement. Référence mathématique : [Michels, Ötting et Karlis, page 4](https://arxiv.org/pdf/2307.02139).

| Modèle sur 875 matchs de test temporel | Brier 1N2 ↓ | Log Loss ↓ | Résultat le plus probable correct |
| --- | ---: | ---: | ---: |
| Poisson de référence | 0,602451 | 1,006136 | 50,40 % |
| Correction sélectionnée sur le passé | 0,602582 | 1,006328 | 50,29 % |

La correction testée dégrade légèrement les deux critères probabilistes : elle reste un outil de recherche et n'est pas intégrée au moteur actif. Cette expérience ne démontre pas que toute variante Dixon-Coles serait moins bonne.

## Évaluation des événements dérivés

Les scripts enregistrent Brier binaire, Log Loss binaire, fréquence moyenne prévue et observée, dix classes de calibration et erreur de calibration pondérée. Le Brier binaire ne doit pas être comparé directement au Brier 1N2.

| Événement, mêmes 875 matchs | Prévision moyenne | Fréquence observée | Brier binaire ↓ |
| --- | ---: | ---: | ---: |
| Au moins 2 buts | 76,86 % | 77,03 % | 0,180186 |
| Au moins 3 buts | 53,84 % | 53,49 % | 0,251378 |
| Au moins 4 buts | 32,31 % | 31,89 % | 0,217703 |

La plage de buts contient en moyenne 84,41 % de la masse calculée et couvre 82,51 % des résultats observés. Une proximité des moyennes ne prouve pas la calibration individuelle ; les classes détaillées et leurs effectifs figurent dans les fichiers JSON.

**Limites déterminantes :** corpus historique réel de 1 298 matchs de Ligue 1, déjà exploré lors des passes antérieures, donc pas un jeu de test indépendant. Le mode reconstruit n'a pas les timestamps réels de publication des résultats : ces chiffres sont exploratoires, pas une certification de précision en production. Le mode strict par défaut produit zéro prédiction évaluable et des métriques indisponibles sur ce corpus ; aucune disponibilité historique n'est inventée. Aucune hausse de précision réelle n'est revendiquée.

## Validation

- PASS : contrôle TypeScript, lint, 254 tests sur 41 fichiers, compilation de production (`STATS-EXPANSION-VALIDATION.log`).
- PASS : SEO local (20 routes, 217 contrôles, 8 vues navigateur), rendu serveur (20 routes, 113 contrôles), sécurité HTTP (14 contrôles), guide de lecture (4 tests de parcours), responsive (154 vues, 14 séries d’interactions).
- PASS : huit vues des composants enrichis, aucun débordement, aucune erreur navigateur et aucune violation détectée par les contrôles automatiques WCAG retenus. Cela ne constitue pas une certification exhaustive d’accessibilité.
- Les contrôles navigateur et HTTP de cette passe sont enregistrés dans `STATS-EXPANSION-CHECKS.json` et `STATS-EXPANSION-UI.json` : leurs périmètres précis et résultats font foi.
- Les composants enrichis sont vérifiés sur des données de démonstration explicites à quatre largeurs, dans les deux thèmes. Cela ne certifie pas les données de production ni les parcours nécessitant PostgreSQL.
- NON TESTÉ : synchronisation et parcours sportifs complets avec base réelle et secrets de production, déploiement, indexation Google, visibilité GEO, Core Web Vitals en conditions réelles. Les audits SEO locaux ne prouvent pas ces résultats externes.

## Fichiers reproductibles

`STATS-EXPANSION-MODEL-COMPARISON.json` et `STATS-EXPANSION-EVENT-EVALUATION.json` contiennent les évaluations reconstruites ; `STATS-EXPANSION-STRICT-MODELS.json` et `STATS-EXPANSION-STRICT-EVENTS.json` contiennent les refus stricts. Les scripts `compare-score-models.ts` et `evaluate-derived-events.ts` fonctionnent en mode strict par défaut ; `--reconstructed` est un choix explicite. Le manifeste `STATS-EXPANSION-CHANGED-FILES.json` et le patch livrés décrivent l'ensemble des changements depuis la base.
