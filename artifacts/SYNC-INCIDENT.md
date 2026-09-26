# Vérification ciblée de synchronisation — 26 septembre 2026

## Cause constatée

Le 21 septembre à 09:23 (Paris), le worker était actif : le dernier contrôle OpenFootball
avait réussi à 08:59:04, sans verrou bloqué ni erreur fournisseur. L'horodatage des données
08:58:51 était cohérent avec l'intervalle fournisseur de six heures. Les 30 secondes affichées
concernent les lectures de l'API interne, pas les imports OpenFootball.

À la reprise du 26 septembre, aucun serveur/worker du projet ne tournait. Le fichier d'état du
superviseur datait du 21 septembre. PostgreSQL était également arrêté ; son journal confirme
un arrêt non propre et une récupération au démarrage. La cause exacte de cet arrêt système
n'est pas établie. Un lancement Windows a aussi renvoyé 0xC0000142 ; le lancement suivant a
réussi. Un état de tâche Windows « Running » seul n'a pas été accepté comme preuve de santé.

## Corrections limitées à la synchronisation

- Prochaine échéance calculée depuis les contrôles persistés des sources : un redémarrage
  ne repousse plus automatiquement le prochain import de six heures.
- Erreurs de heartbeat récupérables, jobs indépendants, heartbeat maintenu pendant les imports
  longs ; états RUNNING / DEGRADED / STOPPED exposés par le health authentifié.
- Compteurs de nouveaux matchs, modifications, résultats modifiés, sources inchangées et
  sources sautées : un import sans nouveauté est identifiable.
- Alerte admin « Synchronisation en retard », explication des deux fréquences, sans refonte.
- Démarrage Windows non interactif et journal des démarrages du superviseur/processus enfants.

Principaux fichiers : `scripts/football-worker.ts`, `src/services/football/worker-loop.ts`,
`openfootball-sync.ts`, `worker-health.ts`, `health.ts`, `src/app/admin/page.tsx`,
`scripts/supervise-local.ps1`, `scripts/install-local-autostart.ps1`.

## Preuves réelles

- Reprise automatique : job commencé le 26/09 à 13:14:46, terminé avec succès à **13:16:48**
  (Paris). Cinq sources, 1 752 matchs importés, zéro nouveau match, **49 résultats modifiés**.
- Les cinq fichiers ont ensuite été relus en HTTP 200 et parsés : leur SHA-256 correspond
  exactement au contenu enregistré par l'import. Aucun succès déduit du seul statut HTTP.
- Horodatage des données : 13:15:49 ; révision du snapshot DB : 13:15:52.
  API interne et interface concordantes, sans rechargement du document.
- Requêtes navigateur réelles `/api/updates` espacées d'environ 30 secondes, HTTP 200,
  aucune erreur JavaScript observée pendant ce contrôle.
- Après redémarrage, nouveau PID worker 24652 ; cycles terminés à 13:22:30, 13:23:30,
  13:24:30 et 13:25:30. Prochaine échéance conservée : **19:14:55**.
- Tâche `MatchScoreRuntime` Running, processus web/worker présents, heartbeat récent,
  health authentifié : worker RUNNING, aucune erreur bloquante, aucun verrou restant.
- Health et cron privés renvoient 401 sans secret. Admin reste noindex.

Les observations détaillées sont dans `sync-incident-evidence.json` (sans secrets).

## Tests et limites

PASS : lint, typecheck du build, build de production, 38 tests unitaires ciblés.
PASS : intégration PostgreSQL isolée + navigateur de production local : erreur → libération
du lock → nouveau job ; deux imports automatiques avec horloge accélérée ; score 0–0 → 1–0
en DB/API/UI ; nouvelle rencontre dans sa date/compétition ; report d'horaire ; score final,
classement, événements, compositions, blessures, quota et panne fournisseur.
Les scénarios métier simulés n'ont pas modifié la base réelle.

Deux cycles de scheduler réels ont été observés. Deux imports espacés de six heures n'ont
pas été attendus : cette séquence a été vérifiée avec horloge accélérée en base isolée.
Pas d'audit général : contrôle ciblé du rendu, polling, admin, authentification health/cron,
robots et sitemap. Production Vercel : **NON VÉRIFIÉE EXTERNEMENT** dans cette intervention.

Fréquences locales : boucle/heartbeat 60 s ; OpenFootball 6 h après chaque contrôle de source,
déclenchement au prochain cycle ; reprise après échec 1 h ; frontend 30 s lorsque visible.
L'API secondaire est désactivée faute de clé : aucun live réel ne peut être promis.
Le health conserve les avertissements OPENFOOTBALL_RESULTS_LATE et SECONDARY_NOT_CONFIGURED.

Fermer le terminal n'arrête pas la tâche Windows cachée. Éteindre/mettre en veille le PC
interrompt les synchronisations locales. Le démarrage est prévu à l'ouverture de session,
avec vérification de relance de la tâche toutes les cinq minutes. Ce dispositif local ne
constitue pas un hébergement permanent.
