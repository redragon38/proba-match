# Vérification des synchronisations — 13 septembre 2026

## Complément du 18 septembre 2026

- Administration : état du worker, dernier signal et prochain import, actualisés automatiquement toutes les 30 s ; transition « En retard » → « Actif » testée dans Chrome.
- Les mises à jour de minute/score live ne relancent plus le calcul Elo historique. Les résultats finaux, corrections et annulations restent pris en compte.
- Nettoyage du verrou même si l'écriture du journal échoue ; dates des verrous explicitement en UTC. Test sur PostgreSQL : expiration à 30 minutes et rejet d'un second job après renouvellement du verrou.
- Distinction entre panne réseau et retard fournisseur ; suppression de l'avertissement secondaire après récupération réussie. Nouvelle tentative OpenFootball après 1 h en cas d'import partiellement échoué.
- Reprise Windows configurée toutes les 5 min, en plus de l'ouverture de session, sans instances concurrentes. Avertissements natifs de récupération PostgreSQL correctement gérés ; fichier d'état écrit via un fichier temporaire.
- Après interruption de la machine, PostgreSQL a terminé sa récupération ; serveur HTTP 200 et tâche MatchScoreRuntime Running constatés. Le déclenchement périodique est configuré ; aucun nouveau redémarrage complet de Windows n'a été imposé.
- Build, lint, 75 tests et scénario PostgreSQL/navigateur réussis. Clé secondaire et déploiement distant toujours absents : le live fournisseur demeure simulé dans les tests.

## Périmètre réellement vérifié

Serveur Next compilé en production sur localhost:3000 et PostgreSQL local sur 127.0.0.1:55432. Aucun projet MatchScore dans le compte Vercel connecté (seul un projet sans rapport est présent). Le cron déclaré dans vercel.json n'est donc pas un cron distant activé. Aucune affirmation de disponibilité distante 24 h/24.

DATABASE_URL et CRON_SECRET sont configurés localement ; valeurs secrètes non affichées. FOOTBALL_API_KEY est absent : l'enrichissement live réel est désactivé. Budget secondaire configuré : 90 requêtes/jour, réserve de 20 % pour les appels prioritaires. Ce budget ne garantit pas un live continu.

## Exécution automatique constatée

- Tâche Windows `MatchScoreRuntime` enregistrée avec déclencheur à l'ouverture de session, puis réellement démarrée via le Planificateur ; état Running.
- Superviseur PostgreSQL/Next/worker toutes les 30 s. Arrêt forcé du worker PID 2308 : redémarrage constaté PID 15944, serveur web conservé.
- Heartbeat PostgreSQL du worker constaté à 15:24:21 UTC, statut secondaire disabled ; prochain contrôle OpenFootball à 21:23:22 UTC.
- Exécutions OpenFootball consignées dans SyncRun et `.local/runtime/worker.log`. Les fichiers encore frais produisent zéro appel réseau conformément au TTL.
- Le redémarrage complet de Windows n'a pas été effectué. Ce fonctionnement local exige une machine éveillée, connectée et une session ouverte.

## Cadences du worker

| Donnée / opération | Cadence et conditions |
|---|---|
| OpenFootball, nouveaux matchs/résultats, calendrier des cinq championnats | Au démarrage puis 6 h après le dernier contrôle ; nouvelle tentative 1 h après échec global ; TTL serveur 6 h |
| Boucle secondaire | Départ visé toutes les 60 s, sans chevauchement ; retard possible si un job dépasse 60 s |
| Scores/minute/buts/cartons/remplacements/statistiques/compositions live | Données âgées d'au moins 60 s, traitées au prochain passage ; fournisseur et quota nécessaires |
| Avant-match | Dans l'heure avant le coup d'envoi : données âgées de 5 min ; après l'heure prévue : 60 s, jusqu'à 6 h de retard |
| Score final | Au prochain passage live ; détails finaux manquants récupérés jusqu'à 48 h après le coup d'envoi ; contrôle horaire durant les premières 24 h |
| Joueurs/blessures | TTL 6 h, pour les identités résolues et les données disponibles du fournisseur |
| Classement calculé | À chaque import/résultat publié ; ne comprend pas d'éventuelles sanctions administratives externes |
| Interface ouverte | Vérification de version toutes les 30 s ; pause en arrière-plan, reprise à la visibilité |
| Vercel déclaré, inactif ici | OpenFootball quotidien à 05:15 UTC ; aucun cron live distant configuré |

## Tests

Typecheck, lint, 68 tests unitaires/SQL et compilation de production réussis. Vérification complémentaire de 32 vues bureau/mobile : aucune erreur JavaScript, aucun débordement ni appel navigateur aux fournisseurs externes (`artifacts/openfootball-browser.json`). Test PostgreSQL + navigateur Chrome avec données fournisseur simulées dans une base temporaire distincte :

1. Score 0–0 enregistré et affiché ; cache du serveur déjà chargé.
2. Réponse simulée API-Football 1–0, minute 30, but, carton et remplacement, possession 60/40, compositions.
3. Vrai service syncSecondary exécuté, écritures relationnelles et snapshot PostgreSQL contrôlés.
4. La page déjà ouverte affiche 1–0 et l'événement sans clic ni rechargement du document.
5. Score final 2–0 reçu, classement relationnel et snapshot mis à jour (3 points), interface actualisée.
6. Nouveau match OpenFootball ajouté : apparition automatique dans la liste. Horaire modifié d'une heure : même identifiant, attribut datetime actualisé dans la page ouverte.
7. Blessure importée puis retirée après réponse fournisseur réussie ; cohérence table Injury et snapshot vérifiée.
8. Quota épuisé : aucun nouvel appel externe, données conservées et état dégradé. Panne OpenFootball : données conservées.
9. Route cron protégée : 401 sans secret, 200 avec secret (secondaire désactivé sur le serveur de test).

Les scénarios simulés valident la chaîne logicielle, pas la couverture ni les délais réels du fournisseur. OpenFootball ne fournit pas de live. Le fournisseur secondaire reste nécessaire pour les minutes, événements, compositions, statistiques avancées et blessures.
