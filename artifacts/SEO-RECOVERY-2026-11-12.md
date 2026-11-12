# SEO POST-MODIFICATION — 12 novembre 2026

## État et limites

Le domaine confirmé par le propriétaire est https://proba-match.com.
Le dépôt a été récupéré depuis redragon38/proba-match, branche master,
base fc9214f. Les fichiers Docker/Caddy indiquent un déploiement VPS.
Ils ne prouvent pas l'état des conteneurs actuellement déployés.

Une requête HTTPS directe Node a reçu une réponse HTTP 502 avec une page
nginx/1.29.8. Les requêtes suivantes vers l'accueil, robots.txt, sitemap.xml,
www et HTTP ont échoué avec ECONNREFUSED. Le relevé horodaté reproductible
est dans availability-2026-11-12.json. Ces observations sont faites depuis
cet environnement : elles ne prouvent ni une panne permanente pour tous les
visiteurs, ni la cause exacte de la baisse des impressions. Les journaux du
VPS et Search Console restent nécessaires.

## Corrections locales

- siteOrigin utilise désormais le domaine personnalisé en production Node,
  APP_ENV et Vercel, même sans NEXT_PUBLIC_SITE_URL. L'ancien comportement
  pouvait produire localhost sur VPS ou l'ancien domaine Vercel.
- Les anciennes valeurs probamatch.com, www.probamatch.com,
  proba-match.vercel.app et www.proba-match.com sont normalisées vers
  https://proba-match.com. La validation HTTPS reste active et les previews
  conservent leur noindex.
- Les redirections de l'application convergent directement vers le domaine
  personnalisé en conservant le chemin ; les règles Caddy existantes sont conservées.
- L'exemple d'environnement et la CI utilisent le domaine confirmé.
- Tests de non-régression pour l'origine VPS, robots, canonical et redirections.

Ces corrections protègent les métadonnées, le sitemap et JSON-LD lorsque
l'environnement est absent ou ancien. La valeur actuellement utilisée sur le
VPS n'a pas été inspectée : aucun mauvais canonical en production n'est affirmé.
Ces corrections ne réparent pas à elles seules une panne du serveur.

## Validation

| Contrôle | Statut | Preuve ou limite |
| --- | --- | --- |
| Tests unitaires | PASS | 65 fichiers, 376 tests, Vitest avec configLoader native et pool threads |
| TypeScript | PASS | tsc --noEmit après génération du client Prisma |
| Lint | WARNING | 0 erreur, 2 avertissements img préexistants dans les images Open Graph |
| Build | NON TESTÉ intégralement | Compilation Next 16.3.8 réussie ; phase TypeScript du build bloquée par spawn EPERM ; contrôle TypeScript séparé réussi |
| Indexation | NON VÉRIFIÉ EXTERNEMENT | Accès public en échec dans les sondes ; Search Console indisponible |
| Metadata / Canonical / URLs | PASS en tests | Domaine personnalisé, validation d'origine, redirections ; HTML déployé non vérifié |
| Sitemap / Robots | PASS en tests | Référence du sitemap canonique et exclusion des previews ; XML public non récupérable |
| Maillage / Images / Mobile | NON TESTÉ | Audit navigateur bloqué par spawn EPERM au lancement de Chrome |
| Performance | NON TESTÉ | Aucun résultat CWV terrain ou Lighthouse revendiqué |
| Structured Data | NON TESTÉ sur HTML | Origine partagée corrigée ; rendu et Rich Results non vérifiés |
| Erreurs techniques | FAIL dans les sondes publiques | 502 observée puis connexions refusées ; cause serveur non identifiée |
| E2E / DB réelle | NON TESTÉ | Build complet et navigateur bloqués ; aucune base de production utilisée |
| Push / Déploiement | NON EFFECTUÉ | Push de contrôle refusé faute d'authentification GitHub ; pas d'accès VPS |

git diff --check est passé. Les premières tentatives de Vitest en forks
étaient bloquées par spawn EPERM ; la suite complète a ensuite réussi avec
les threads, sans modification des dépendances ni de la configuration suivie.
L'audit scripts/verify-seo.mjs a été lancé, mais Chrome ne peut pas démarrer
dans cet environnement. Aucun ancien rapport n'est présenté comme un audit
de cette modification.

## Rétablissement restant

1. Fournir un accès GitHub autorisé pour publier la branche préparée.
2. Ouvrir le terminal du VPS et relever l'état avec
   `docker compose -f compose.production.yml ps -a`, puis examiner localement
   les journaux récents des services app, cache et caddy. Ne pas publier de
   secrets ni supprimer les volumes. Vérifier disque, mémoire et services
   avant de choisir un redémarrage ou une reconstruction.
3. Contrôler que .env.vps contient APP_ENV=production et
   NEXT_PUBLIC_SITE_URL=https://proba-match.com sans divulguer ses autres valeurs.
4. Déployer le commit validé sur la branche réellement suivie par le VPS
   (bootstrap-vps.sh mentionne fix/real-player-stat-sync), puis vérifier
   l'accueil, une fiche match, healthz.txt, robots.txt et sitemap.xml.
5. Refaire le build complet, l'audit SEO et les E2E dans un environnement
   disposant de PostgreSQL et Chrome. Pour l'audit public, définir
   VERIFY_URL=https://proba-match.com, SEO_CANONICAL_ORIGIN=https://proba-match.com
   et SEO_REQUIRE_HTTPS=true, puis exécuter npm run test:seo.
6. Dans Search Console : comparer les impressions sur des journées terminées,
   examiner Statistiques sur l'exploration, Indexation des pages, Actions
   manuelles et Problèmes de sécurité ; lancer une inspection en direct après
   rétablissement. Aucun délai de retour des impressions n'est garanti.
