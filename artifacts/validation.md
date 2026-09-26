# Validation OpenFootball — 13 septembre 2026

- TypeScript et lint réussis ; compilation Next.js de production réussie.
- 68 tests unitaires et SQL réussis (9 fichiers).
- Tests sur PostgreSQL isolé réussis : import, équipes et matchs sans doublons, correction de date/score, absence de clé secondaire, enrichissement contrôlé, données fraîches, quota épuisé, panne OpenFootball.
- 32 vues navigateur réussies (16 routes en 1440 et 390 px), sans erreur JavaScript, débordement global, données de démonstration ou appel fournisseur par le navigateur. Actualisation du score vérifiée après avancement du temps ; rapport dans `openfootball-browser.json`.
- Import public réel : 7 008 matchs, 129 équipes, 5 compétitions, 20 saisons de compétition (2023/24 à 2026/27), 20 fichiers OpenFootball. 10 762 observations Elo et 51 prédictions enregistrées au dernier contrôle.
- Seconde exécution à données fraîches : 0 écriture de match, 0 requête externe, aucun doublon. Revalidation ultérieure : 5 fichiers inchangés, aucune réimportation.
- PostgreSQL 17.6 local : écoute sur 127.0.0.1:55432, authentification par secret généré dans `.env` ignoré par Git. Runtime et base dans `.local/postgres`, également ignorés.
- Serveur de production disponible sur http://localhost:3000 ; worker local démarré pour la synchronisation. Ces processus doivent être relancés après arrêt/redémarrage du PC.

## Relancer sur cette machine

Depuis la racine du projet, PowerShell :

```powershell
& .local/postgres/package/native/bin/pg_ctl.exe -D .local/postgres/data -l .local/postgres/server.log -o '-p 55432 -h 127.0.0.1' -w start
npm run start
# Dans un second terminal :
npm run football:worker
```

Ne pas réinitialiser la base déjà remplie. Avant un nouveau `npm run build` sous Windows, arrêter le serveur et le worker afin de libérer le moteur Prisma, puis les relancer.

## Limites

Aucune clé secondaire réelle n’est configurée : live détaillé, effectifs, blessures et statistiques avancées restent indisponibles, avec des états explicites. L’enrichissement a été testé avec des réponses contrôlées ; aucun appel API-Football payant n’a été effectué. OpenFootball est une source contributive sans garantie de direct. Aucun gain de précision prédictive, test de charge massif, déploiement distant ou certification d’accessibilité n’est revendiqué.

Les anciens rapports d’accessibilité et de démonstration dans `artifacts` concernent la version précédente ; le rapport navigateur OpenFootball est celui de cette migration.
