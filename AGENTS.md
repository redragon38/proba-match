<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Contrainte permanente : SEO et non-régression

Après toute modification importante (page, routing, navigation, HTML, design, fonctionnalité,
API affectant le rendu, images, dépendance majeure, metadata, sitemap, domaine ou authentification) :

1. Terminer la modification, identifier les pages et composants touchés.
2. Lancer typecheck, lint, tests pertinents et build de production.
3. Auditer les pages touchées ET les contrats globaux : statut HTTP, rendu sans JS,
   title/description uniques, canonical, H1/hiérarchie, liens, images, robots, sitemap,
   JSON-LD, partage social, mobile, console et poids/performance.
4. Lancer `npm run test:seo` contre le serveur de production local démarré. Le test écrit
   `artifacts/seo-audit.json`. Compléter par `npm run test:e2e` et les tests DB/UI si concernés.
   Une refonte/routing/migration/metadata globale exige l'audit complet, pas seulement un échantillon.
5. Corriger les régressions sûres et retester. Ne pas supprimer de fonctionnalité ni inventer
   données, notes, auteurs, avis, scores Lighthouse ou résultats de mesure.
6. Au déploiement : `VERIFY_URL=https://domaine-réel SEO_REQUIRE_HTTPS=true npm run test:seo`
   (syntaxe d'environnement adaptée au shell). Vérifier aussi les variantes www/HTTP sur l'hébergeur.
7. Fournir un mini rapport **SEO POST-MODIFICATION**, avec PASS/WARNING/FAIL/NON TESTÉ pour
   Build, Indexation, Metadata, URLs, Canonical, Sitemap, Robots, Maillage, Images, Mobile,
   Performance, Structured Data, Erreurs techniques ; régressions, corrections et actions manuelles.
   Tout service inaccessible : **NON VÉRIFIÉ EXTERNEMENT**. Les CWV terrain ne se déduisent
   jamais d'un test local. Un critère validé devient le minimum attendu pour la suite.

Utiliser `src/lib/seo.ts` pour la politique metadata/indexation et `indexablePaths` pour le sitemap.
Une nouvelle route indexable doit avoir un lien crawlable et être couverte par l'audit.
Conserver les secrets hors des fichiers suivis et des sorties de tests. Ne pas changer le domaine
ni les informations légales sans données réelles. Le rapport de référence est `artifacts/SEO-AUDIT.md`.

## Baseline pré-lancement et production

Le domaine canonique choisi est `https://proba-match.vercel.app`, hébergement cible Vercel ; la marque
du produit est Proba Match (logo officiel fourni le 26 septembre 2026). Conserver les identifiants
techniques internes existants. Les previews/staging doivent rester noindex et hors sitemap.
Après une modification importante des API, de l’authentification, de la DB ou des performances,
effectuer aussi les contrôles ciblés de sécurité, validation, quotas, cache et données réelles.
Utiliser `scripts/verify-security.mjs` et `scripts/responsive-check.mjs` lorsque les zones concernées
changent ; tester les contrats DB/UI dans une base isolée. Ne jamais tester destructivement une
production ni exposer les secrets dans les sorties. PASS exige une preuve réelle, sinon WARNING,
FAIL ou NON TESTÉ. Maintenir les exigences de `artifacts/PRELAUNCH-AUDIT.md` sans audit global
inutile pour une modification triviale. Ne pas assimiler une configuration cron à une exécution
observée, une mesure locale à des Core Web Vitals terrain, ni un build valide à un déploiement.
