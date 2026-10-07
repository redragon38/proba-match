# Plan de secours Aiven — reconstruction sans dump Neon

État le 7 octobre 2026. Ceci est un **audit de possibilité**, pas une restauration de la base de production. Neon affiche toujours `Limit reached` et `ENDPOINT INACTIVE`. Ne pas modifier `DATABASE_URL` de Production. `defaultdb` sur Aiven reste vide. Une base distincte `proba_match_reconstruction_test` a été créée pour les essais ; elle contient actuellement **aucune table** et aucune donnée.

## Ce que le dépôt contient réellement

- Cinq migrations Prisma, 31 modèles, un client PostgreSQL standard. Le schéma peut théoriquement être recréé sur PostgreSQL 18.6. Il n'est pas encore déployé sur Aiven : `prisma migrate status` lancé contre la base de test échoue avant lecture de la base. Le poste d'exécution ne résout pas le domaine Aiven (`TCP_EAI_AGAIN`). Cela ne prouve ni une erreur des migrations, ni une incompatibilité PostgreSQL.
- `scripts/seed-e2e.ts` fournit **des fixtures synthétiques de CI**, limitées par garde à `proba_match_ci_*`. Ne jamais les importer sur Aiven. Aucun seed de production ni dump complet n'a été trouvé.
- OpenFootball : saisons/résultats des cinq championnats configurés ; ESPN : cinq compétitions supplémentaires, résultats, statistiques disponibles et effectifs ; TheSportsDB : profils partiels ; API-Football : détail, événements, compos, blessures selon clé, quota et couverture. Disponibilité et droits des flux au moment du nouvel import **non vérifiés**. Les fichiers de logos et quelques artefacts JSON ne sont pas un export transactionnel de Neon.
- `artifacts/IMPROVEMENT-HISTORICAL-CORPUS.json` contient 1 298 matchs historiques de travail, avec identifiants reconstruits pour analyse, **pas** un snapshot de production. `artifacts/final-data-verification.json` donne, au 26 septembre sur une base locale de production de travail, 7 008 matchs, 129 équipes, 5 compétitions et 0 joueur ; ces chiffres ne sont **pas** les comptes actuels de Neon et ne démontrent aucune égalité avec Aiven.

## Matrice des tables

Les 31 lignes ci-dessous correspondent aux modèles du schéma versionné. Les tables et leurs comptes *réellement présents sur Neon* ne sont pas vérifiables tant que l'endpoint reste inaccessible. « Partiellement » signifie que certains faits peuvent être de nouveau importés ou recalculés, **sans** garantir contenu, identifiants, dates d'observation ni couverture identiques.

| Table | Statut sans Neon | Source/limite déterminante |
| --- | --- | --- |
| ResultObservation | NON RECONSTRUCTIBLE | Dates de réception et payloads de révisions stockés seulement en DB. |
| Country | RECONSTRUCTIBLE PARTIELLEMENT | Pays déduits des compétitions/équipes réimportées ; corpus original non garanti. |
| Competition | RECONSTRUCTIBLE PARTIELLEMENT | OpenFootball/ESPN ; ancien ID peut changer. |
| Season | RECONSTRUCTIBLE PARTIELLEMENT | Années/saisons fournisseurs ; `homeAdvantage` stocké non vérifié. |
| Team | RECONSTRUCTIBLE PARTIELLEMENT | Fournisseurs ; ID et suffixe de slug aléatoires pour nouvelles entités. |
| Player | RECONSTRUCTIBLE PARTIELLEMENT | ESPN, TheSportsDB, API secondaire selon couverture ; club, ID et slug peuvent changer. |
| Coach | RECONSTRUCTIBLE PARTIELLEMENT | Détails fournisseurs sur équipes couvertes ; anciens liens incomplets. |
| Venue | RECONSTRUCTIBLE PARTIELLEMENT | Détails fournisseurs ; historique incomplet. |
| Match | RECONSTRUCTIBLE PARTIELLEMENT | Calendrier/résultats OpenFootball et ESPN ; UUID et slug d'origine non déductibles des seules fixtures. |
| MatchEvent | RECONSTRUCTIBLE PARTIELLEMENT | Enrichissement API secondaire ; événements historiques non garantis. |
| MatchLineup | RECONSTRUCTIBLE PARTIELLEMENT | Enrichissement secondaire ; `publishedAt` original et annonces anciennes perdus. |
| MatchPlayer | RECONSTRUCTIBLE PARTIELLEMENT | Statistiques/performance individuelle disponibles pour certains matchs seulement. |
| TeamStatistics | RECONSTRUCTIBLE PARTIELLEMENT | Enrichissement, ESPN et calculs ; `asOf` original non reconstituable. |
| PlayerStatistics | RECONSTRUCTIBLE PARTIELLEMENT | Effectifs/statistiques ESPN selon couverture ; snapshots `asOf` uniques. |
| Standing | RECONSTRUCTIBLE PARTIELLEMENT | Calcul des résultats disponibles, sans décisions administratives du classement officiel. |
| Injury | RECONSTRUCTIBLE PARTIELLEMENT | API secondaire si disponible ; observations et historique originels manquants. |
| PredictionVersion | RECONSTRUCTIBLE PARTIELLEMENT | Paramètres du modèle dans le code ; dates/versions réellement publiées en DB inconnues. |
| Prediction | NON RECONSTRUCTIBLE | Prévisions figées, cutoff et archive d'entrées propres à Neon. |
| PredictionResult | NON RECONSTRUCTIBLE | Mesures des prévisions **effectivement publiées** requièrent `Prediction`. |
| ModelPerformance | NON RECONSTRUCTIBLE | Métriques publiées et échantillon d'origine non restituables. |
| EloHistory | RECONSTRUCTIBLE PARTIELLEMENT | Replay chronologique possible sur résultats récupérés ; ancien historique exact/observations inconnus. |
| Favorite | NON RECONSTRUCTIBLE | Lignes serveur et anciens IDs ; l'UI actuelle utilise aussi `localStorage`, sans export serveur. |
| NotificationSubscription | NON RECONSTRUCTIBLE | Abonnements, consentements et clés chiffrées propres à Neon. |
| SearchIndex | RECONSTRUCTIBLE PARTIELLEMENT | Index dérivé des nouvelles entités, liens différents si slugs changent. |
| CacheEntry | RECONSTRUCTIBLE PARTIELLEMENT | Catalogue/caches reconstituables ; ancien snapshot et horodatages non garantis. |
| SyncRun | NON RECONSTRUCTIBLE | Exécutions, échecs et logs stockés propres à la production antérieure. |
| FootballIdentity | RECONSTRUCTIBLE PARTIELLEMENT | IDs externes disponibles chez certains fournisseurs ; ancien `entityId` aléatoire perdu. |
| MappingIssue | NON RECONSTRUCTIBLE | Résolutions et corrections manuelles non versionnées. |
| DataSource | RECONSTRUCTIBLE PARTIELLEMENT | URLs et licences du code ; ETag, hash et dates de sync historiques non garantis. |
| ApiQuota | NON RECONSTRUCTIBLE | Consommation journalière réellement comptée par Neon. |
| SyncLock | RECONSTRUCTIBLE À 100 % | Verrou transitoire : repartir sans verrou périmé, sans prétendre préserver une opération antérieure. |

`_prisma_migrations` relève de l'historique Prisma en plus des 31 modèles : les migrations du dépôt peuvent générer un **nouvel historique appliqué sur la base de test**, pas prouver l'état de la source sans inventaire Neon.

## Unicité et SEO

`resolveIdentity()` attribue `randomUUID()` si aucun mapping préalable n'existe ; OpenFootball et ESPN en font autant pour les matchs. Les slugs de match sont souvent cet UUID ; ceux des équipes et joueurs contiennent les huit premiers caractères de l'ID. Les imports conservent l'ancien slug **seulement si** l'entité et son mapping sont déjà présents. Sans `FootballIdentity` Neon ou manifeste des anciennes URL, les mêmes fixtures peuvent générer de nouvelles adresses. `/match/[id]` ne redirige que si l'ancien ID est encore connu ; anciens liens, favoris locaux, canonicals, maillage et sitemap sont donc à risque. Les slugs de compétition calculés depuis le nom sont plus stables, mais pas prouvés identiques.

Le code de reprise durcit maintenant les nouveaux imports publics : si aucun mapping n'existe encore, l'ID reconstruit est deterministe a partir de `(provider, kind, externalId)`. Cela reduit le risque de nouvelles URLs differentes entre deux reconstructions successives, sans pretendre recuperer les anciens UUID Neon deja perdus.

Avant toute Preview publique, obtenir l'inventaire des URL historiques (snapshot source, sitemap archivé complet ou export équivalent), mesurer la correspondance par identifiant externe, vérifier les redirections et les pages indexables. **Aucun inventaire complet de ces URL n'est présent dans les artefacts du dépôt**. Ne pas avancer si des URL indexées disparaissent en masse.

## Prédictions et pertes

Le code n'insère une nouvelle `Prediction` que pour un match futur programmé dans les 21 jours ; il ne recrée pas une ancienne prévision après le résultat. C'est la bonne règle à préserver. Le backtest rétrospectif dans `artifacts/prediction-baseline.json` indique **0 évaluation archivée pré-match** et explicite qu'il ne prouve pas des publications historiques : ne pas l'afficher comme historique récupéré.

**PERDU DÉFINITIVEMENT : non établi.** Neon conserve peut-être les données, mais son endpoint est inaccessible. **Non récupérable autrement à ce jour :** prévisions publiées et leurs archives, résultats/performances attachés, révisions d'observation, consentements/abonnements, favoris serveur, mappings/résolutions manuelles et horodatages de snapshots. **Partiellement reconstructible :** calendrier, résultats, équipes, joueurs, statistiques, événements, classements, Elo et caches, selon les fournisseurs et leurs limites. **Reconstruit dans Aiven : aucun enregistrement pour le moment.**

## Essai Aiven et portes de sortie

1. Base isolée créée : `proba_match_reconstruction_test`. `defaultdb` reste la cible vide d'une restauration native si Neon revient. Aucune variable Vercel ni écriture de production modifiée. La chaîne Aiven de **test uniquement** est dans `.database-migration/reconstruction.env` ignoré par Git, mode 600. Ne jamais l'afficher ni la committer.
2. `prisma migrate status` contre cette base échoue avant la lecture du schéma ; la résolution réseau `TCP_EAI_AGAIN` du poste d'exécution empêche `prisma migrate deploy`. Il serait trompeur de créer les tables à la main dans l'éditeur SQL puis de déclarer les migrations Prisma PASS. Les 31 modèles ne sont donc pas encore créés dans Aiven test.
3. Quand le réseau permet une connexion PostgreSQL directe au **nom de test uniquement** : revérifier l'absence de tables ; exécuter `prisma migrate status`, puis `prisma migrate deploy` (jamais reset). Contrôler l'historique `_prisma_migrations`, les 31 tables et leurs contraintes, puis importer les flux un par un dans l'ordre effectif des scripts (`football:import`, `football:expanded-import`, `football:expanded-players`, `football:players`, enrichissement secondaire si activé). Leurs résultats doivent être mesurés sans réétiqueter le corpus local de septembre comme production actuelle.
4. Mesurer comptes par table, erreurs fournisseurs, IDs/slugs, pages et sitemap sur une **Preview pointant uniquement vers la base test**. Empêcher cron et autres writers de la Preview d'écrire dans Neon ou deux bases. Les tests CI sur base jetable et le build du commit précédent sont verts, mais ne prouvent pas cette Preview.
5. Décider d'une éventuelle bascule seulement après comparaison vérifiable des données et URL essentielles, et récupération ou traitement explicite des historiques irréconstructibles. Ici ces critères ne sont pas atteints. **Recommandation actuelle : attendre Neon**, qui permettrait un dump exact et préserverait le plus d'URL et d'historique.

## Procedure locale Windows ajoutee

Le depot contient `scripts/reconstruct-aiven.ps1` pour lancer la reconstruction depuis un poste qui peut joindre Aiven directement. Le script refuse toute cible qui n'est pas exactement la base de test `proba_match_reconstruction_test`, un hote `.aivencloud.com` et `sslmode=require`.

```powershell
git checkout master
git pull origin master

$SecureUrl = Read-Host "Aiven TEST DATABASE_URL" -AsSecureString
$Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureUrl)
try {
  $env:AIVEN_TEST_DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr)
  powershell -ExecutionPolicy Bypass -File .\scripts\reconstruct-aiven.ps1
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)
  Remove-Item Env:\AIVEN_TEST_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
}
```

Le script installe les dependances exactes, genere Prisma, verifie que la base de test est vide, applique `prisma migrate deploy`, verifie les tables, lance les imports OpenFootball/ESPN/TheSportsDB bornes, reconstruit Elo et sort les compteurs. Il ne lance jamais `migrate reset`, ne touche pas `defaultdb`, ne change aucune variable Vercel et ne bascule pas Production.
