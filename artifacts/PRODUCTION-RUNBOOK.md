# Production et vérifications — Proba Match

## Build et maintenance

`npm run build` génère Prisma et compile Next.js. Aucun `postbuild` ne lance d'import ou n'écrit dans PostgreSQL. Les migrations restent une opération explicite (`npm run db:migrate`).

Pour une base déjà migrée, `NODE_USE_ENV_PROXY=1 npm run football:initialize` initialise/reprend les quatre saisons et effectifs des cinq ligues ajoutées. Cette commande vise la **DATABASE_URL réellement configurée** : vérifier l'environnement avant son lancement. Aucun endpoint public d'initialisation n'est ajouté. Le script réutilise les identités persistées, les lots bornés, la reprise et les retries existants. Son échec ne fait pas échouer un build.

L'entretien courant reste assuré par les crons protégés existants et `npm run football:worker`. Les verrous PostgreSQL empêchent les écritures concurrentes. La présence d'une configuration cron ne prouve pas son exécution : regarder les `SyncRun`, les timestamps des `DataSource` et le health.

## Observabilité

`GET /api/health` nécessite `Authorization: Bearer <CRON_SECRET>` ; ne jamais partager la valeur ni la mettre dans une URL. 401 sans authentification, 503 si indisponible ou source hors délai, 200 avec `status: warning` pour couverture secondaire absente/quotas/données retardées. Le contenu ne comporte ni connexion DB, SQL ni stack trace.

Le rapport donne les timestamps réels, la durée du dernier job observé, les éléments importés, la dernière réussite/erreur dans les 50 jobs récents, les compteurs de cache et les p50/p95 de l'instance. **Les compteurs mémoire ne sont pas des métriques globales Vercel**. Le champ historique `SyncRun.matches` compte les joueurs pour les jobs d'effectifs ; l'interface l'appelle « Éléments importés ».

Seuils : source >7h dans le worker cloud ou >26h avec cron quotidien Vercel ; trois jobs consécutifs partiels/échoués d'une source dans la fenêtre observée ; opération >1000ms ; live secondaire >5min en worker, >26h avec cadence Vercel actuelle. Le cron quotidien ne promet donc pas du live continu. La clé/abonnement fournisseur reste nécessaire pour les détails temps réel.

Logs JSON : `FOOTBALL_JOB_FAILED`, codes contrôlés, `OPERATION_THRESHOLD`. Durées DB révision/chargement, API listes/recherche/live, calcul prédictif et transports ESPN/OpenFootball. Conserver une alerte externe authentifiée sur le health et une alerte de taux 5xx dans les outils de l'hébergeur. Ces alertes ne sont pas déclarées actives sans configuration réelle.

## Données

`npm run data:validate` contrôle en lecture seule IDs/slugs, noms, équipes/compétitions, dates/timezone/statuts/scores, futur terminé, relations, valeurs finies/non négatives, possession et cohérence de participations. Les aliases `data:validate-players`, `data:validate-matches`, `data:validate-stats` exécutent le même contrôle complet ; éviter trois scans inutiles.

`NODE_USE_ENV_PROXY=1 npm run data:validate -- --photos` ajoute un maximum de 20 HEAD avec timeout de 5s sur des domaines de photos connus, sans suivre les redirections. Cela ne garantit pas toutes les photos. Rapport local : `.local/hardening/data-quality.json` ; code de sortie non nul sur FAIL, WARNING conservé explicitement. Les transferts et appartenances saisonnières historiques nécessitent les sources : une FK valide ne les certifie pas.

Les blocs ESPN impossibles entièrement à zéro avec possession 0–0 sont retirés des détails affichés à la lecture et à l'import. La donnée brute stockée n'est pas destructivement réécrite ; les prochains imports persistent le résultat normalisé. Les autres zéros restent de vrais zéros et les valeurs inconnues ne sont pas remplacées par zéro.

## Mesures de performance

`npm run test:load` n'accepte que HTTP loopback. Maximum quatre requêtes simultanées, 20 mesures par route ; pages accueil/matchs/match/joueur et API match/recherche/compétition, suivant ce qui existe. Il n'existe pas d'API dédiée joueurs ; la recherche Joueur et la page réelle sont mesurées. Ne pas extrapoler cette sonde à la capacité de production. Résultat : `.local/hardening/load.json`.

Collecte Web Vitals disponible mais **désactivée par défaut**. Activer `NEXT_PUBLIC_WEB_VITALS_ENABLED=true` uniquement après avoir confirmé la politique légale de conservation et l'accès aux logs, puis reconstruire/déployer. Le navigateur envoie seulement nom/valeur (LCP, INP, CLS, FCP, TTFB), sans URL, requête, identifiant utilisateur, cookie ni ID de métrique. `/api/vitals` impose origine, taille, schéma strict, nombres finis, limite PostgreSQL partagée (60/min) et fermeture en cas d'erreur. Les journaux techniques restent soumis à la politique réelle de l'hébergeur. Analyser des percentiles avec un effectif et une période documentés ; ne jamais inventer un score CrUX à partir de logs locaux.

## Légal et domaine

Valeurs publiques à fournir dans les paramètres de déploiement : `LEGAL_EDITOR_NAME`, `LEGAL_PUBLICATION_DIRECTOR`, `LEGAL_EDITOR_ADDRESS`, `CONTACT_EMAIL`, `LEGAL_HOST_ADDRESS`, `LEGAL_LOG_RETENTION` (durée réelle et exercice des droits). `LEGAL_REGISTRATION` seulement si applicable ; `LEGAL_HOST_NAME` si l'hébergement change. Aucune identité ni adresse n'est devinée. Validation humaine des obligations légales et licences ESPN/API-Sports/TheSportsDB/logos/photos requise.

Le domaine demeure `https://proba-match.vercel.app`. Le changement futur passe par `NEXT_PUBLIC_SITE_URL` et la configuration DNS/TLS/hébergeur. La politique canonical/metadata/OG/sitemap/robots est centralisée ; tester previews noindex et leur sitemap vide après chaque changement d'environnement.

## Contrôles externes et manuels

- Search Console : propriété, sitemap, indexation/exclusions, actions manuelles/sécurité, CWV ; aucune propriété accessible n'est présumée.
- CrUX/PSI/Rich Results Test : mesures réelles datées ; aucune note terrain déduite d'une sonde locale.
- NVDA + Firefox/Chrome, VoiceOver + Safari, TalkBack + Chrome : parcours accueil → recherche → match/onglets → probabilités → équipe/joueur → favoris ; vérifier titres, annonces de mises à jour, focus du dialogue/Escape et lecture des tableaux.
- Zoom navigateur physique 200%/400% et appareils réels : compléter les tests automatisés de reflow 640/320px.
- Hébergement : logs, alertes, cron réussi, erreurs fournisseur, budget, sauvegarde DB et restauration isolée. L'absence d'accès aux logs/sauvegardes est une limite, pas un PASS.
- CSP : toutes les familles de directives sont explicites, mais `unsafe-inline` reste autorisé pour les scripts de Next et JSON-LD client. Une politique à nonce nécessiterait la propagation jusque dans ces composants et un audit spécifique ; ce résidu est WARNING, pas une certification.

The health endpoint projects only the dataset revision and late-result boolean in PostgreSQL; it does not transfer the full player/match snapshot. Existing 6h/24h OpenFootball deadlines remain unchanged and are covered by the disposable DB integration suite. Process telemetry is local to each instance; warm local timing is not a production SLO.
