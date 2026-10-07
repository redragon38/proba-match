# Déploiement et limites des corrections d’audit — 6 octobre 2026

## Migration et réception réelle

Après sauvegarde vérifiée de PostgreSQL, installer avec `npm ci`, générer Prisma et appliquer les migrations avec `npm run db:migrate`. La migration `202610060001_result_observations` crée un journal append-only protégé contre UPDATE/DELETE. Aucun timestamp ancien n’est reconstruit par la migration SQL.

Lors d’un prochain import, les payloads avec un ancien `resultObservedAt` réel conservent cette première observation. Les anciens scores sans date de réception sont enregistrés seulement au moment de cette ingestion. Les versions déjà perdues ne peuvent pas être récupérées. Le journal conserve aussi les retraits de résultats, corrections de période et changements d’identités/coup d’envoi.

La nouvelle table complète les révisions des payloads. Elle ne remplace pas une politique de sauvegarde, les droits SQL restreints ni la conservation des preuves fournisseur. L’archivage ne couvre pas toutes les publications de compositions et blessures : le moteur n’ajuste toujours pas ses buts à partir de ces facteurs.

## Moteur 1.4.0

Les coefficients sportifs restent ceux du moteur 1.3 : avantage 60, demi-vie 60 jours, forme 30 jours, K24, shrinkage 0,8. Les changements portent sur le contrat temporel et l’abstention, pas sur un nouvel entraînement prétendument optimal.

Le score du moteur et de l’évaluation est réglementaire. FT explicitement identifié ou bloc fournisseur `fulltime` valide ; AET/PEN sans score90 ne sont pas utilisés. Les résultats legacy de période inconnue restent exclus en mode strict. Le mode reconstruit peut traiter un legacy sans période explicite, uniquement pour recherche et avec cette hypothèse déclarée. Un résultat explicitement inconnu ou prolongé sans score90 reste exclu.

L’historique conserve la politique intercompétitions/multisaisons existante, avec pondération temporelle. Ce transfert n’est pas validé comme optimal ; une comparaison de politiques doit précéder un filtrage arbitraire. Le terrain neutre confirmé annule le bonus et le filtre de lieu du match cible. Le terrain inconnu conserve l’hypothèse domicile explicitée, sans être présenté comme confirmé.

À chaque réception, l’Elo incorpore l’état connu. Un retard ou une correction déclenche un repli chronologique des résultats alors disponibles ; les ratings enregistrés aux kickoffs passés restent ceux connus à cet instant. Les événements de réception exactement au kickoff arrivent après la capture pré-match.

La quantité effective des poids est `(somme w)^2 / somme(w^2)`. Le minimum existant de cinq observations est aussi exigé en quantité effective. Cette règle conservatrice fait refuser certains historiques admis auparavant ; ce n’est pas un seuil appris ou une preuve de meilleure exactitude. La confiance reste une heuristique : quantité effective, récence, stabilité, composition confirmée et couverture de champs. Les absences/xG ne modifient pas les lambdas ; aucune disponibilité manquante n’est inventée.

Chaque nouveau payload de prédiction stocke ses paramètres, cutoff, mode de disponibilité, cible et entrées. Les archives sont retirées des props publiques pour éviter de charger le navigateur avec l’historique complet. Export local autorisé :

```sh
node --conditions=react-server --import tsx scripts/export-prediction.ts IDENTIFIANT prediction.json
node --import tsx scripts/replay-prediction.ts prediction.json
```

Le premier exige DATABASE_URL et refuse d’écraser un fichier. Le replay utilise le code de cette version ; préserver cette release pour rejouer après une future modification d’algorithme. Les anciennes prédictions sans paquet d’entrée ne sont pas rétroactivement reproductibles.

## Statistiques et historiques

Les classements joueurs réels exigent un périmètre confirmé compétition/saison/équipe. Les réponses API-Football multi-blocs sont sélectionnées sur ces identifiants ; deux blocs correspondants ou un mapping inconnu rendent le relevé non certifié. Les anciennes données et certains relevés ESPN restent visibles avec un avertissement, mais ne deviennent pas des classements de compétition ni des archives de saison supposées.

Le snapshot porte des dates distinctes de réception des résultats/calendrier et effectifs ; une publication globale n’est plus décrite comme la fraîcheur de chaque score. Les détails explicitement fournis, même vides, remplacent les anciens champs ; les anciennes relations de compositions et performances retirées sont supprimées dans la même transaction. Un endpoint non fourni conserve l’ancienne valeur, son timestamp, sa source par champ et un marqueur de fallback. Un fallback legacy sans source par champ ne devient pas une attribution certaine dans le comparateur. La signification contractuelle des vides de chaque fournisseur reste à vérifier avec des réponses réelles.

L’historique de prédictions montre jusqu’aux cent snapshots les plus récents, dans l’ordre chronologique. Les évaluations n’ont plus de plafond global de 10 000 ; elles peuvent inclure plusieurs versions du même match et l’interface expose le nombre de matchs distincts. Le chargement complet peut devenir coûteux : mesurer PostgreSQL et le payload avant optimisation. Les relevés joueurs sélectionnent le dernier par saison, sans un plafond préalable de 300, et respectent la date du snapshot affiché.

Le comparateur équipes peut limiter les deux historiques à leur intersection temporelle réelle. Sans intersection, aucune valeur comparée n’est produite. Chaque moyenne indique son propre n, ses dates et ses sources ; les fenêtres identiques n’assurent pas des compétitions/adversaires de même force. Les relevés joueurs affichent saison, compétition, équipe et réception quand le périmètre est confirmé ; des périmètres inconnus ou distincts déclenchent un avertissement.

Les tests de grands historiques passent par un adaptateur de requêtes isolé : 140 snapshots, 10 002 prédictions réparties sur deux versions et 350 relevés d’une saison suivis d’une précédente. Ils vérifient la logique des services et les paramètres de requête, pas les latences ni le plan d’exécution PostgreSQL réel.

## Import, pannes et live

La persistance du catalogue, des relations et observations se déroule dans une seule transaction. Le snapshot public est écrit à la fin et l’objet mémoire n’est mis à jour qu’après commit. Une limite de 30 minutes, cohérente avec le lease existant, borne cette transaction ; mesurer durée, verrous et pool sur une base représentative. Cette stratégie privilégie l’intégrité, sans gain de vitesse annoncé. Un staging par génération sera préférable si les budgets réels l’exigent.

Deux tests avec adaptateur transactionnel vérifient le retrait des relations, la conservation d’une révision de terrain sans changement de score et le refus de publication après remplacement du token. Cet adaptateur ne simule pas les verrous PostgreSQL.

Le champ SQL historique `MatchLineup.publishedAt` est une date de réception/fallback legacy, pas une preuve universelle de publication fournisseur ; les archives de nouvelles prédictions et les dates de détail portent le contrat actuel.

Le heartbeat perdu ou non renouvelé invalide le contexte du job. La publication vérifie le token et l’expiration sous verrou SQL, dans la même transaction. Les nouvelles prédictions, résultats d’évaluation, performances et marqueurs publics passent eux aussi par une transaction clôturée avec ce fence ; l’évaluation utilise le client transactionnel pour voir ses propres écritures. Les tests d’adaptateur vérifient le refus de commit avec token remplacé ou expiré. Un ancien writer échoue sans publier sa transaction. Vérifier les pertes de réseau et deux processus réels avant production ; les tests locaux du guard et du rollback ne reproduisent pas toute la concurrence PostgreSQL.

Une panne de base sur processus froid déclenche désormais une erreur temporaire au lieu d’un faux catalogue vide pouvant fabriquer des 404. Les API surveillées répondent 503. Pour les pages Next, l’erreur passe par la frontière d’erreur du framework : contrôler le statut 5xx et l’absence de 404 avec PostgreSQL indisponible avant publication ; cette réponse n’est pas certifiée ici comme 503. Le dernier dataset en mémoire reste le fallback d’un processus chaud, pas un backup durable.

Le cron quotidien du ZIP ne prouve pas un live continu. Déployer/superviser le worker existant (`npm run football:worker`), adapter sa cadence aux quotas et contrôler le heartbeat via l’administration. Le texte public distingue polling et réception fournisseur. Aucun worker distant n’a été installé dans cette passe. Les notifications interrogent les favoris ciblés et restent locales à la page ouverte.

## Validation prospective à effectuer

Les rapports `AUDIT-FIX-MODELS-observed.json` et `AUDIT-FIX-MODELS-reconstructed.json` comparent l’ancien moteur archivé, le nouveau et deux baselines utilisant uniquement les résultats passés de la ligue. Les métriques sont comparées sur support commun. Le corpus a déjà servi à l’exploration ; ce n’est pas un holdout inédit. Les baselines de fréquence utilisent les moyennes de buts de ligue pour les mesures de buts, pas un modèle appris supplémentaire.

Avant toute sélection de modèle, fixer et enregistrer un protocole daté : ligues, dates de collecte, résultat90, versions, critères d’exclusion, minimum de couverture et découpage temporel. Les événements observés après une frontière ne doivent pas entrer dans sa calibration. Réserver une période future jamais explorée et figer les paramètres avant son ouverture. Comparer également les taux d’abstention, pas seulement les matchs conservés.

Mesurer Brier/log loss, calibration par issue et ligue avec effectifs, MAE, score exact, couverture et retards. Quantifier l’incertitude avec des blocs temporels conservant les dépendances ; le nombre de blocs et les faibles effectifs doivent être publiés. Aucun intervalle prospectif n’est fabriqué à partir de zéro observation. Les ablations joueurs/xG et Dixon-Coles restent des recherches non déployées.

## Contrôles externes restants

Base PostgreSQL réelle, migration/restauration, réponses fournisseurs, scheduler, quotas, concurrence, latences SQL, sauvegardes, indexation Search Console, citations IA et Core Web Vitals terrain : NON VÉRIFIÉS EXTERNEMENT. Ne pas utiliser les fixtures comme preuve de production.
