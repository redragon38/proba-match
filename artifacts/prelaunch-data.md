# Audit prélancement — données et exploitation

Contrôles du 20 septembre 2026. État de la base locale relevé à 15:05 UTC ; aucune donnée applicative effacée. Cible annoncée : Vercel / probamatch.com. Une configuration dans le dépôt ne prouve pas son activation distante.

| Contrôle | Statut | Preuve / limite |
|---|---|---|
| PostgreSQL et corpus réels | PASS | 7 008 matchs, 129 équipes, 5 compétitions ; OpenFootball et identités persistantes. 0 joueur, aucune clé secondaire configurée localement. |
| Migrations et intégrité | PASS | Migrations appliquées dans une base temporaire ; import, idempotence, ajout et report de match testés. Index matchs/statuts/dates/équipes, standings/saison, recherche et identités présents. |
| Transactions et SQL | PASS | Écriture des détails d’un match transactionnelle ; Prisma et requêtes paramétrées pour quota/verrou. Les noms SQL dynamiques du test proviennent uniquement de son identifiant temporaire généré. |
| Pipeline serveur → DB/cache → interface | PASS | Test isolé réel PostgreSQL + serveur de production : 0–0 initial, réponse fournisseur simulée, persistance, nouvelle révision, invalidation entre processus et score reçu sans rechargement manuel du document. |
| Live et enrichissement | WARNING | Score/minute/buts/cartons/remplacements/stats/compositions/blessures/final/classement testés par réponses contrôlées. Pas de fournisseur live actif localement ; OpenFootball ne fournit pas ces détails. |
| Quota et panne fournisseur | PASS | Réservation atomique, 20 % du budget réservés au live, quota atteint et panne source testés ; dernières données conservées et avertissement affiché. |
| Concurrence des synchronisations | PASS | Verrou partagé PostgreSQL avec bail 30 minutes, renouvellement chaque minute, rejet des chevauchements, libération même en erreur ; test d’intégration et tests unitaires. |
| Worker local | PASS | Heartbeat PostgreSQL daté 15:05:06 UTC, boucle 60 s. Exécution OpenFootball enregistrée à 14:54 UTC. La tâche Windows n’a pas pu être inspectée sous le sandbox ; heartbeat et journaux prouvent uniquement le processus local observé. |
| Planification Vercel | WARNING | Deux crons réellement déclarés, compatibles Hobby. Aucun déploiement MatchScore ni exécution distante attestés. Le cron quotidien secondaire n’assure pas un live continu. |
| Secrets nécessaires locaux | PASS | Présence vérifiée de DATABASE_URL, CRON_SECRET, ADMIN_SECRET sans afficher les valeurs ; clé football absente. Variables distantes : NON TESTÉ. |
| Monitoring protégé | PASS | Nouveau `/api/health` authentifié par CRON_SECRET, no-store et noindex. Tests : 401 sans secret, pas de requête DB avant autorisation, fraîcheur source réelle, quota, cadence Vercel, erreur DB expurgée. |
| Alertes externes / disponibilité distante | NON TESTÉ | Aucun service externe d’alerte configuré ou observé. Le health check doit être relié à un moniteur ; Vercel supervise séparément build et déploiement. |
| Permissions et pooling production | NON TESTÉ | Le rôle local possède superuser/createdb/createrole ; il ne convient pas comme rôle applicatif public. Pooling et rôle du futur fournisseur non accessibles. |
| Sauvegarde / restauration production | NON TESTÉ | Aucun fournisseur PostgreSQL de production ni politique de sauvegarde observés. Le test isolé ne constitue pas une sauvegarde et ne valide pas une restauration du corpus réel. |

## Fréquences effectives et configuration

- **Vercel Hobby déclaré** : OpenFootball `15 5 * * *` (05:15 UTC quotidien) ; secondaire `15 7 * * *` (07:15 UTC quotidien). Exécution dans l’heure prévue selon Vercel, pas de garantie à la minute. Sans clé, le secondaire ne consomme rien. Crons en production uniquement.
- **Worker persistant existant** : boucle toutes les 60 secondes ; OpenFootball toutes les 6 heures, nouvelle tentative après une heure en cas d’import partiel/échec. Les imports ont aussi un TTL de 6 heures (30 jours pour les saisons historiques).
- **Secondaire avec worker et clé** : live et matchs démarrés au plus tôt toutes les 60 secondes ; pré-match dans l’heure avant le coup d’envoi toutes les 5 minutes ; résultats récents toutes les heures ; joueurs et blessures toutes les 6 heures. Appels conditionnés par les matchs, les identités et le budget, donc ces délais ne garantissent pas des données fournisseur.
- **Interface** : vérification de révision toutes les 30 secondes ; polling live toutes les 30 secondes, suspendu dans un onglet masqué et jusqu’à 120 secondes après erreurs. Aucun fournisseur externe n’est appelé par le navigateur.
- **Live Vercel à activer séparément** : un plan permettant les crons fréquents peut utiliser `15 */6 * * *` pour OpenFootball et `* * * * *` pour le secondaire ; alternative : worker persistant. Aucun abonnement ou changement payant effectué.

Les limites Vercel actuelles ont été contrôlées dans la [documentation officielle](https://vercel.com/docs/cron-jobs/usage-and-pricing) : fréquence quotidienne Hobby, minute Pro/Enterprise. Le quota de nombre de jobs indiqué par le skill local est ancien ; il n’a pas été utilisé comme source actuelle.

## Corrections réalisées

- `src/app/api/health/route.ts` et `src/services/football/health.ts` : endpoint avancé protégé ; 503 pour DB/import/fraîcheur indisponibles, avertissements pour fournisseur/quota. La fraîcheur vient des dernières vérifications de chaque source configurée, pas d’un job récent n’ayant effectué aucune requête. Détection d’un worker local absent et d’une synchronisation secondaire absente/en retard.
- `vercel.json` : enrichissement secondaire quotidien ajouté au cron OpenFootball existant.
- `README.md` : cadence exacte, limite du live quotidien, monitoring authentifié, rôle PostgreSQL restreint et sauvegarde/restauration avant ouverture.
- `tests/football-health.test.ts` : cinq scénarios ciblés.

## Tests exécutés

- `FOOTBALL_VERIFY_UI=true npm run test:football-db` : **PASS** sur base temporaire créée puis supprimée par le test. Import, idempotence, report, nouveaux matchs, live complet, récupération des blessures, classement, quota, panne source, cache et rafraîchissement UI automatique. Le corpus applicatif est resté intact.
- Tests health/jobs/worker : **10/10 PASS**. Après la dernière correction ciblée du health : **5/5 PASS** relancés.
- ESLint sur les trois nouveaux fichiers TypeScript : **PASS**.
- Build global et audit SEO final : exécutés par l’audit principal, résultats à consulter dans son rapport. Aucun build supplémentaire lancé par ce sous-audit.

## Restant par priorité

- **P0 conditionnel avant lancement public** : PostgreSQL distant, secrets serveur, migration/import et exécutions cron doivent être configurés et constatés sur la production. Le dépôt seul ne permet pas de déclarer le service déployé et alimenté.
- **P1** : choisir un fournisseur/couverture et un ordonnanceur fréquents si le produit promet du live ; budget 90 requêtes/jour insuffisant pour garantir un rafraîchissement à la minute sur toutes les compétitions. Configurer sauvegarde/restauration, rôle applicatif restreint/pooling et moniteur externe (statut HTTP et JSON warning).
- **P2** : adapter la durée de fraîcheur du cache affiché au choix final d’ordonnancement (actuellement 7 h pour OpenFootball, donc avertissement attendu entre deux crons quotidiens) ; définir une rétention des journaux SyncRun/quotas/cache technique lorsque le volume augmente. Aucun effacement de journaux ou données réalisé.

**Verdict données/exploitation : prêt pour une validation de déploiement, pas de preuve d’automatisation distante ni de live réel à ce stade. NON VÉRIFIÉ EXTERNEMENT : DB/backup/alertes/crons de production.**

## Comparaison externe des données sportives — 19:56 UTC

Lecture seule du [fichier source OpenFootball Ligue 1 2026–2027](https://raw.githubusercontent.com/openfootball/football.json/master/2026-27/fr.1.json), HTTP 200, et des lignes PostgreSQL correspondantes. Aucun appel secondaire ni synchronisation. Preuves et empreinte SHA-256 : `artifacts/prelaunch-source-check.json`.

**PASS — fidélité à la source** : 306 matchs dans le fichier et 306 en base. Noms domicile/extérieur, dates, heures, statut, scores et indicateur d’heure connue concordent pour les 306. Les heures UTC ont été contrôlées par conversion indépendante vers Europe/Paris, sans réutiliser le parseur d’import.

| Échantillon | Date et heure source (Paris) | UTC en base | Statut / score | Contrôle |
|---|---|---|---|---|
| Lille OSC – ES Troyes AC | 13/09/2026 15:00 | 13/09/2026 13:00Z | finished, 2–0 | PASS |
| Le Mans FC – Racing Club de Lens | 13/09/2026 17:15 | 13/09/2026 15:15Z | finished, 2–2 | PASS |
| Stade Brestois 29 – Paris Saint-Germain FC | 13/09/2026 20:45 | 13/09/2026 18:45Z | finished, 0–1 | PASS |
| AS Monaco FC – Racing Club de Lens | 18/09/2026 20:45 | 18/09/2026 18:45Z | scheduled, score absent | PASS pour la fidélité ; résultat fournisseur en retard |
| Paris FC – RC Strasbourg Alsace | 19/09/2026 17:15 | 19/09/2026 15:15Z | scheduled, score absent | PASS pour la fidélité ; résultat fournisseur en retard |

**PASS — classement dérivé** : recalcul indépendant depuis les 36 résultats de la source. Les 18 lignes stockées concordent sur matchs joués, points, buts marqués et encaissés ; total 95 points. Ce test valide le classement calculé à partir des données disponibles, pas un classement officiel intégrant d’éventuelles sanctions ou règles de départage spécifiques.

**WARNING — actualité du fournisseur** : au moment du contrôle, 7 matchs déclarés `scheduled` avaient un coup d’envoi dépassé de plus de 6 heures ; 261 étaient encore à venir. Le dernier résultat fourni date du 13 septembre. La base est fidèle au fichier récupéré le 20 septembre, mais sa récupération réussie ne prouve pas que les résultats sportifs sont à jour. Ce retard ne peut pas être corrigé en inventant les scores ; une source complémentaire ou la mise à jour d’OpenFootball reste nécessaire avant de promettre les résultats du jour ou le live.

## Complément final — 21 septembre 2026

Ajout de `services/football/freshness.ts` après le cache : avertissement en présence de résultats OpenFootball manquants au-delà de 6 h (24 h si heure inconnue), sans changer les scores/statuts. Pas de faux positif pour report/annulation/abandon/final/live ; warning et dégradation existants préservés. `health.ts` vérifie aussi le snapshot déjà lu et signale OPENFOOTBALL_RESULTS_LATE. 15 tests fraîcheur/health PASS.

Health HTTP authentifié sur le build final : 200, status warning, aucune issue, DB disponible, avertissements OPENFOOTBALL_RESULTS_LATE et SECONDARY_NOT_CONFIGURED. Refus anonyme 401 PASS. Intégration DB/UI complète relancée sur ce build : PASS, y compris profil joueur isolé à 320/390/1440 px. Tâche Windows MatchScoreRuntime observée Running et heartbeat récent après relance. Aucun test destructeur sur le corpus réel.
