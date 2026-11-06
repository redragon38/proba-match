# SEO POST-MODIFICATION — 6 novembre 2026

## Diagnostic et correction

La chute Search Console commence visuellement le 1er novembre. Le rapport d'indexation fourni date du 23 octobre : il ne prouve pas une désindexation en novembre. Le sitemap a été lu par Google le 5 novembre (capture propriétaire).

Défaut identifié dans `src/services/football/index.ts` : lorsque DATABASE_URL est configuré mais que `readLocalDataset()` renvoie un snapshot sans équipes ni matchs (notamment si CacheEntry football:dataset est absent), cette réponse était mémorisée comme un succès et remplaçait lastDataset. Les pages pouvaient alors annoncer noindex, retourner 404 pour des entités existantes et réduire le sitemap aux pages éditoriales.

Correction : rejeter le snapshot vide AVANT sa mise en cache. Avec un snapshot valide déjà chargé, conserver les dernières données et signaler le mode dégradé. Sur un processus froid, propager FOOTBALL_TEMPORARILY_UNAVAILABLE au lieu d'inventer un catalogue vide. Cette branche produit une erreur serveur ; elle n'ajoute pas de réponse HTTP 503 personnalisée. Sans DATABASE_URL, le comportement existant est conservé.

Deux tests de régression couvrent le démarrage sans snapshot et la disparition du snapshot après une lecture valide, y compris la conservation exacte des chemins du sitemap. Aucun changement d'URL, de domaine, de critère d'indexation ou de données sportives. Autres modifications déjà présentes dans le workspace conservées.

Cette vulnérabilité à un snapshot absent est démontrée dans le code et les tests ; son occurrence sur le VPS le 1er novembre n'est PAS établie. Le correctif n'est pas déployé. Le dernier snapshot de secours reste en mémoire du processus : il ne survit pas à un redémarrage.

## Vérifications

L'environnement ne fournit pas npm. Les commandes équivalentes ont été exécutées avec node et les CLI installées dans node_modules : tsc --noEmit, eslint ., vitest run, prisma generate, next build, next start, verify-seo.mjs, Playwright et verify-security.mjs.

- Typecheck : PASS.
- Lint : PASS, 2 avertissements existants no-img-element dans les images Open Graph.
- Tests unitaires : 76 fichiers, 428 tests PASS avec maxWorkers=2. Une première exécution parallèle a dépassé 5 secondes sur un test de temporalité ; ce test et la suite complète ont ensuite passé sans changement du test.
- Build de production : PASS, Prisma Client généré puis Next.js 16.3.8 compilé.
- Audit SEO contre le serveur de production local : 24 pages, 297 contrôles, 14 vues navigateur, aucun FAIL ni WARNING machine. Portée : catalogue local vide, 5 URL éditoriales dans le sitemap ; ce résultat n'est pas un audit des 7 131 URL publiques.
- Sécurité HTTP : 19 contrôles PASS, aucun échec.
- E2E : 56 PASS, 22 SKIP, aucun échec ; scénarios ignorés faute de catalogue football local. Les fixtures UI contrôlées ont passé sur desktop et mobile.
- Responsive étendu : PASS, 224 vues et 14 interactions sur sept largeurs (320 à 1440 px), deux thèmes ; aucun échec. Aucun profil joueur réel disponible localement.

## Statuts

| Catégorie | État | Portée et limites |
|---|---|---|
| Build | PASS | Build de production local et typecheck |
| Indexation | WARNING | Régression de snapshot couverte ; indexation Google après correction NON VÉRIFIÉE EXTERNEMENT |
| Metadata | PASS | Pages locales auditées ; profils réels non audités localement |
| URLs | PASS | Contrats HTTP locaux, 404 et redirections testés ; aucune migration |
| Canonical | PASS | Pages locales auditées ; origine proba-match.com conservée |
| Sitemap | WARNING | Audit local conforme et chemins préservés dans le test de panne ; catalogue réel non testé avec une DB locale |
| Robots | PASS | Contrats locaux ; aucun changement des règles |
| Maillage | PASS | 25 liens découverts, aucune cible cassée, aucune cible restante non contrôlée sur ce corpus local |
| Images | PASS | Alt/dimensions et image sociale sur le corpus local ; médias des profils réels non couverts |
| Mobile | PASS | Audit navigateur à 390 et 1440 px sans débordement ni erreur JS ; voir responsive ci-dessous |
| Performance | WARNING | Mesures locales sur catalogue vide seulement ; CWV terrain NON TESTÉS |
| Structured Data | PASS | JSON-LD local valide ; Rich Results Test NON VÉRIFIÉ EXTERNEMENT |
| Erreurs techniques | WARNING | Aucune erreur dans l'audit local ; lint avec 2 avertissements existants ; panne DB réelle et historique VPS NON TESTÉS |

## Actions de production restantes

Déployer le correctif dans l'environnement VPS existant, puis relancer `VERIFY_URL=https://proba-match.com SEO_REQUIRE_HTTPS=true npm run test:seo` avec le shell de l'hébergeur. Ne pas déclencher une panne ni vider le snapshot de production pour tester.

Consulter les logs app/worker/Nginx du 31 octobre au 3 novembre : erreurs dataset_read_failed, redémarrages, statut et volume des publications football:dataset, réponses 5xx/404 aux Googlebots vérifiés. Inspecter dans Search Console les URL ayant perdu leurs impressions, leurs canonicals, dernières explorations et les rapports actions manuelles/sécurité. Sans ces preuves, ne pas attribuer toute la chute à ce défaut.

Base PostgreSQL isolée et contrats DB/UI avec données réelles : NON TESTÉS (aucune DB locale configurée). Accès Search Console direct, journaux VPS et effet du correctif sur Google : NON VÉRIFIÉS EXTERNEMENT. Aucune garantie de retour des impressions.

## Livraison GitHub

Le correctif a été réappliqué sur origin/main bcaf384 dans un worktree isolé, en préservant les correctifs plus récents de lecture des révisions. Sur cette base : typecheck PASS, lint des deux fichiers PASS, 16 tests ciblés PASS. Les résultats complets ci-dessus concernent le workspace initial audité ; le build et l'audit navigateur complets n'ont pas été relancés sur cette nouvelle base distante. Aucun déploiement VPS effectué.
