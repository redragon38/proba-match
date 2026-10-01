# Proba Match — modèle de prédiction (1er octobre 2026)

Le moteur audité avant changement était `elo-poisson-1.1.0`. Il utilise les résultats antérieurs, un Elo initial de 1 500 (K = 24, avantage domicile de 60 points), jusqu'à 20 matchs récents par équipe (demi-vie de 60 jours), une pondération domicile/extérieur et par force adverse, un indice de forme ajusté à l'Elo (10 matchs, demi-vie de 30 jours), puis deux lois de Poisson indépendantes. L'attaque et la défense entrent dans les buts attendus à 60 % / 40 %. Ces paramètres ont été fixés avant le présent audit : leur présence ne prouve pas leur optimalité.

| Facteur | Usage actuel | Qualité / limite |
| --- | --- | --- |
| Elo, résultat et écart de buts | Oui | Scores OpenFootball ; anciennes corrections de résultats non horodatées. |
| Forme, récence, lieu et force adverse | Oui | Calculés uniquement sur les résultats historiques disponibles. |
| Buts marqués/encaissés | Oui | Source historique disponible, mais score parfois publié tardivement. |
| Classement et face-à-face | Non | Affichés ailleurs ; pas de poids caché dans le modèle. |
| xG, statistiques avancées, blessures, suspensions, repos, gardien | Non | Indisponibles ou non validés pour cet historique. Aucune valeur n'est inventée. |
| Compositions | Qualité des informations seulement | Aucune composition historique disponible ; pas d'ajustement de force inventé. |
| Joueurs | Non dans les probabilités | Les effectifs ne fournissent pas de statistiques fiables d'avant-match. |

La base contient 7 008 matchs, dont 5 485 scores terminés, sans xG ni compositions historiques exploitables. `PredictionVersion`, les instantanés immuables, le cutoff, le hash des entrées, les résultats et l'évaluation existent déjà. Une contrainte PostgreSQL interdit les insertions ou modifications d'une prédiction après le coup d'envoi. Il y a 91 prédictions pré-match archivées mais **aucune encore évaluée** ; il serait trompeur de présenter le backtest reconstruit comme la performance publique de ces prédictions.

La [baseline](prediction-baseline.json) est un backtest rétrospectif chronologique sur 5 089 matchs avec la convention préexistante « résultat précédent disponible 3 h après son coup d'envoi ». La date réelle de publication des résultats OpenFootball n'est pas conservée. Un second test impose un embargo de 24 h et sépare la sélection de paramètres (avant 2025), la validation (2025) et le test final (2026). Ces tests ne prouvent pas, à eux seuls, l'absence complète de corrections rétrospectives des données source.

Le modèle proposé `elo-poisson-1.2.0` réduit le rapport entre les buts attendus à 0,8 de sa valeur logarithmique. Le [rapport comparatif](prediction-backtest.json) sélectionne ce paramètre sur la seule période d'entraînement. Le test 2026 (1 155 matchs) passe de 0,6137 à 0,6075 en Brier et de 1,0258 à 1,0159 en log-loss ; l'exactitude 1N2 reste 50,8 %. L'amélioration rétrospective est modeste et ne garantit pas la performance future. Les xG, compositions historiques, blessures et statistiques de joueurs ne sont pas inventés ni utilisés comme signaux prédictifs.
