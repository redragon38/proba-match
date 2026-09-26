# MatchScore — audit et évolution du produit

## Périmètre

Amélioration du dépôt existant, sans réinitialisation. Les routes de matchs, équipes, joueurs, compétitions, comparateurs, favoris, méthodologie, administration et performance sont conservées.

## Constats et corrections

| Constat initial | Résultat |
| --- | --- |
| Accueil dominé par la présentation du modèle | Cartes live prioritaires, calendrier avant le bloc éditorial, forme des clubs et synthèse du modèle |
| Direct accessible seulement par un filtre | Route `/live`, filtres pays/compétition/favoris, changements de score signalés |
| Actualisation par `router.refresh()` | Polling ciblé, sans rechargement du document, pause en arrière-plan, timeout et délai après échec |
| Équipes peu accessibles depuis la navigation | Catalogue `/equipes`, recherche, liens directs desktop et menu mobile |
| Recherche nécessitant une navigation | Fenêtre clavier Ctrl/Cmd K, résultats par type, annulation des recherches précédentes, Échap et restauration du focus |
| Groupes de matchs toujours ouverts | Sections repliables et compétitions favorites prioritaires |
| Petites lignes de matchs difficiles à lire sur mobile | Noms et scores agrandis, probabilités sur une seconde ligne |
| Arrondis différents entre blocs | Arrondi commun par plus grands restes, somme affichée de 100 % |
| Minute 45 assimilée à une mi-temps | Phase issue du statut HT du fournisseur |
| Historique prédictif non visible sur la fiche | Instantanés sauvegardés présentés dans l’ordre chronologique, sans inventer un historique de publication en démo |
| Risque de masquer les prédictions d’une ancienne version | Lecture du dernier instantané disponible, avec conservation et affichage de sa version |
| Force adverse recalculée au moment de la prédiction cible | Rating d’avant chaque rencontre utilisé dans les observations historiques |
| Forme sans indice explicite ajusté à l’adversaire | Indice versionné, récence pondérée et effet limité sur les buts attendus |
| Lecture du modèle peu segmentée | Périodes, versions, exactitude mensuelle et résultats par compétition/mois/qualité |
| Sous-classements absents | Domicile, extérieur et cinq derniers matchs, signalés comme calculs sur le catalogue disponible |
| Accès administrateur sans limitation d’essais | Dix tentatives par dix minutes, compteur partagé PostgreSQL ou local borné sans base |
| Échec des détails pouvant empêcher la sauvegarde des scores | Scores conservés, détails live prioritaires et avertissement de synchronisation partielle |
| Débordements sur petit écran | Pied de page repliable, cartes de performance contraintes et tableaux dans leurs conteneurs défilants |

## Vérifications

Les tests existants sont conservés. Les nouveaux tests couvrent l’arrondi, les sous-classements, l’indice de forme et le limiteur, ainsi que les parcours de direct, recherche, repliage, historique absent et actualisation sans rechargement. Le test de polling accélère le temps après hydratation et vérifie qu’un marqueur du document reste intact après le changement de score.

Les rapports `responsive.json`, `accessibility.json`, `accessibility-dark.json` et `validation.md` documentent la dernière exécution. Les neuf largeurs demandées sont couvertes par le contrôle responsive. Les tableaux volontairement défilables peuvent contenir des cellules hors du viewport sans provoquer de défilement de la page entière.

## Limites explicites

- Aucune clé API-Football ou base PostgreSQL distante n’a été fournie. Le fournisseur est testé avec des réponses contrôlées, les migrations avec PGlite ; l’intégration externe authentifiée reste à vérifier après configuration.
- Les statistiques de démonstration sont fictives et signalées. Elles ne servent pas à revendiquer la précision du modèle 1.1.
- Blessures, compositions, xG et fatigue ne produisent pas d’effets inventés sur les probabilités. Leur exploitation prédictive demande des données horodatées et une validation réelle.
- Le modèle de lecture reste borné à 2 000 matchs. L’historique relationnel et les index préparent la suite ; aucun test de charge à des millions de lignes n’est revendiqué.
- Notifications locales consenties et architecture de stockage sont présentes ; les push lorsque le site est fermé et les comptes visiteurs ne sont pas activés.
- Contact configurable par `CONTACT_EMAIL`. Aucun envoi, collecteur analytics, publicité réelle ou déploiement distant n’est activé automatiquement.
