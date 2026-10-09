# Proba Match — reprise du 9 octobre 2026

## Dépôt et production retrouvés

Dépôt : https://github.com/redragon38/proba-match ; branche master ; checkout initial propre.
HEAD initial et distant : 66b45d20cde37bc2dfa43c71bea95541a9fb6ac8.
Dernier déploiement identifié : dpl_CZvuBqqJvURqDmSiyTVfbP5izdPg, Production READY, même commit.
Documents consultés : AGENTS.md, docs/MIGRATION-NEON-AIVEN.md, docs/github-followup-2026-10-07.md, artifacts/STATS-EXPANSION-2026-10-05.md et scripts/services actuels.
Aiven est la base déclarée par le propriétaire. Le fournisseur réellement ciblé par DATABASE_URL en Production reste non vérifiable : variables sensibles masquées, aucune URL PostgreSQL injectée dans ce workspace. AIVEN_DATABASE_URL est une variable distincte utilisée par les outils de reconstruction, pas par le client Prisma de lecture du site. Aucune bascule, restauration ni migration distante exécutée.

Les trois domaines répondent HTTP 200 via le mode secours OpenFootball. Cela n'est pas une preuve de connexion DB : l'API /api/live signale explicitement l'absence de joueurs/compositions/statistiques avancées. /joueurs ne comporte aucun lien joueur. /api/updates retourne HTTP 503, reproduit sur les trois domaines. Un détail match et ses onglets joueurs/statistiques ont également été contrôlés, sans lien joueur. Preuves HTTP : REPRISE-PRODUCTION-HTTP-2026-10-09.json.

## Correctifs réellement appliqués

- ESPN : périmètre équipe/compétition/saison vérifié transmis à la persistance, permettant l'écriture des vrais relevés PlayerStatistics et leur affichage historique.
- Import des effectifs : priorité aux équipes jamais synchronisées puis aux relevés les plus anciens, lecture groupée des marqueurs au lieu d'une requête par équipe.
- ESPN : portraits reçus conservés, valeurs numériques utilisées si présentes, côté manquant conservé comme null et unité de possession explicite.
- API-Football : numeric passes.accuracy traité comme nombre de passes réussies ; pourcentage calculé seulement avec un dénominateur valide, ou lu lorsque explicitement suffixed %. Un blanc reste inconnu.
- API-Football : noms des métriques avancées et des passes/centres normalisés uniquement lorsqu'ils sont réellement transmis. Aucun xG/xGOT/xA/PPDA/xT fabriqué.
- Sync secondaire : freshness des effectifs/absences écrite après publication ; une écriture ratée reste réessayable. Persistance des profils limitée aux identités concernées.
- Cron match-window : budget de durée explicite, statut partial si les sous-jobs ne réussissent pas, suppression de neuf enrichissements complets d'effectifs dans la même fenêtre. Le cron live conserve son enrichissement existant.
- UI : formation et absence de composition expliquées, passes réussies et xA affichés lorsqu'ils existent, groupe avancé avec définitions, statistiques du match sélectionné distinctes du relevé saisonnier sur la page joueur.
- Historique joueur : DISTINCT ON exécuté dans PostgreSQL, avec scope et cutoff vérifiés, pour éviter le transfert de tous les anciens snapshots puis le dédoublonnage client.
- CLI : commande football:expanded-players exposée ; le build reste prisma generate + next build, sans import football.
- Tests : correction d'un test d'indisponibilité qui effectuait involontairement des appels réseau ; couverture des passes réussies/pourcentages, métriques avancées absentes, SQL réel et parcours joueur dans un match terminé.

Les prédictions et leur modèle n'ont pas été modifiés. Les imports de validation ont utilisé les writers existants et une base locale isolée. Aucun joueur inventé n'a été ajouté à la production.

## Validation sur données ESPN réelles — exclusivement base isolée

Import existant de Liga Portugal : 1 224 matchs sur quatre saisons, 8 requêtes ; import de trois effectifs : 3 requêtes.
Players avant : 0 ; après : 87 ; avec équipe : 87 ; avec statistiques fournies : 79 ; PlayerStatistics : 79 ; FootballIdentity joueur ESPN : 87.
Braga : 29 ; FC Famalicao : 26 ; Gil Vicente : 32. Les 8 autres profils n'ont aucun compteur fourni, donc aucun relevé saisonnier inventé.
Navigations navigateur réelles : Braga → Bernardo, Famalicao → Lazar Carevic, Gil Vicente → Lucão. Profil, relevé identifié et historique saisonnier visibles : PASS.
Preuves : REPRISE-REAL-PLAYERS-2026-10-09.json.
Ces nombres ne sont PAS les volumes de Production. Les photos, lineups et statistiques avancées ne sont pas déduites de ces effectifs.

## Tests

Typecheck PASS ; lint PASS ; 334 tests unitaires / 55 fichiers PASS.
PostgreSQL isolé : 5 migrations appliquées et migrate status à jour ; test:football-db avec FOOTBALL_VERIFY_UI=true PASS (writers, reprise, idempotence, scores/minutes/événements/stats/lineups, blessures, quotas, authentification et refresh UI).
E2E complet : 62 PASS et 2 SKIP conditionnels ; suite ciblée finale joueurs/stats : 6 PASS desktop/mobile, dont match terminé → titulaire → profil → statistiques du match.
SQL historique : cas réels PostgreSQL/PGlite avec scope invalide, cutoff, conflits de date, saisons anciennes et paramètre contenant une apostrophe : PASS.
Build final PASS ; serveur Next de production démarré et testé sur bases locales isolées.
Sécurité HTTP : 14 contrôles PASS sur serveur local.

## SEO POST-MODIFICATION

597 pages SSR ; 8 955 contrôles ; 18 vues navigateur ; 2 290 liens additionnels vérifiés ; 0 FAIL, 0 lien cassé. Rapport compact : REPRISE-SEO-2026-10-09.json ; preuve exhaustive locale : .local/REPRISE-SEO-full-2026-10-09.json.
Build PASS ; Indexation PASS local ; Metadata PASS ; URLs PASS ; Canonical PASS ; Sitemap PASS ; Robots PASS ; Maillage PASS ; Images PASS selon audit ; Mobile PASS ; Performance WARNING (CWV terrain non mesurés) ; Structured Data PASS ; Erreurs techniques PASS local.
HTTPS local WARNING attendu. Search Console/CrUX/performances et erreurs de fonctions Production : NON VÉRIFIÉS EXTERNEMENT. Aucun nouveau déploiement n'a été effectué.

## Blocages restants, non masqués par les succès locaux

DATABASE_URL du workspace : MISSING. En Production, DATABASE_URL, CRON_SECRET, FOOTBALL_API_KEY, FOOTBALL_API_PROVIDER, NEXT_PUBLIC_SITE_URL, APP_ENV et AIVEN_DATABASE_URL : PRESENT (métadonnées uniquement).
Authentification officielle API Aiven : 403 Authentication failed. Aucun secret de connexion obtenu. Aucun identifiant ou mot de passe inclus dans ce rapport.
Logs Vercel Production : 403 Forbidden ; CLI Vercel non installé et aucune identité Vercel configurée dans l'environnement. Nombre réel de Prisma errors, P2024, connexions Aiven et durée/CPU des fonctions inconnus.
Dernier SyncRun de Production, volumes DB et migrations distantes non vérifiés. Une configuration cron quotidienne ne garantit pas un live continu ; aucun worker distant vérifié.
Il faut injecter la Service URI PostgreSQL Aiven du service Proba Match comme secret DATABASE_URL de cet environnement et fournir l'accès observabilité Vercel. Puis vérifier les données/migrations avant tout changement de connexion Production, reprendre les imports existants et tester les routes réelles.

## Git et verdict

Correctifs conservés localement sur master ; aucun push ni nouveau déploiement, car la stabilité DB Production exigée avant le push n'est pas établie.
Patch reviewable : REPRISE-CORRECTIFS-2026-10-09.patch.
MISSION BLOQUÉE pour la mise en Production : accès DB manquant/authentification Aiven refusée, logs Vercel refusés, joueurs toujours absents du site public et /api/updates encore en 503.
