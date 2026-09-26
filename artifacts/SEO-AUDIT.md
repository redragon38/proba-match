# MatchScore — audit SEO du 20 septembre 2026

Mise à jour du 26 septembre : la marque publique est désormais **Proba Match**. La baseline
brand/SEO/accessibilité/performance est complétée par [l'audit Proba Match](PROBA-MATCH-AUDIT.md)
(159 pages, 2 055 contrôles SEO, 210 vues responsive). Les vérifications externes restent requises.

**SEO GLOBAL : prêt avec avertissements pour le déploiement.** Aucun FAIL dans l’audit final local. Ce résultat ne valide pas une publication publique : le domaine HTTPS, le contact et les informations de l’éditeur doivent être renseignés, puis les contrôles externes effectués.

## Périmètre et preuves

- Application existante Next.js 16.3.5 / React 19 / TypeScript ; App Router, SSR dynamique, Prisma/PostgreSQL, cache serveur et API interne. OpenFootball est la source principale ; fournisseur secondaire facultatif. Pas d’appel fournisseur depuis le frontend.
- Routes : accueil, matchs, live, catalogues équipes/joueurs/compétitions, fiches dynamiques équipe/joueur/compétition/match, classements, comparateurs, recherche, favoris, paramètres, performance, méthodologie, à-propos, contact, pages légales et admin. API de consultation, administration et synchronisation cron séparées.
- Politique metadata et indexation mutualisée dans src/lib/seo.ts ; sitemap dynamique lié à cette politique. Catalogues paginés avec liens HTML et canonicals distinctes. Recherche, favoris, paramètres, admin, comparateurs et fiches insuffisantes restent non indexables.
- 160 pages, 1919 contrôles, 1171 liens internes distincts, 12 vues navigateur avec axe. Résultat : zéro FAIL, six WARNING (origine locale et cinq payloads lourds).
- Typecheck, lint, build de production, 83 tests unitaires et 20 tests E2E : PASS.
- Base PostgreSQL isolée + navigateur : imports, changements de date, nouveaux matchs, scores/minute/événements/statistiques/compositions, blessures, score final/classement, quota, cache et actualisation automatique : PASS. Fixtures contrôlées, pas une preuve de disponibilité des données live du fournisseur.
- Les rapports machine sont seo-audit.json et seo-audit-first-pass.json. Ce dernier correspond à la première passe après les premières corrections, pas à l’état initial du projet.

## Résultats par catégorie

| Catégorie | État | Observation |
|---|---|---|
| Crawl / indexation | WARNING | Contrôles locaux conformes ; indexation Google et domaine public non vérifiés. |
| robots.txt | PASS | 200, ressources de rendu autorisées, sitemap référencé, noindex des pages privées lisible. |
| sitemap.xml | WARNING | 148 URLs canoniques indexables contrôlées ; origine localhost à remplacer par le domaine HTTPS. |
| URLs | WARNING | Routes stables, pagination crawlable ; identifiants historiques conservés pour ne pas casser les liens. |
| Canonical | WARNING | Absolues et cohérentes ; domaine HTTPS définitif à configurer avant le build public. |
| Titles | PASS | Titres distincts pour les pages indexables explorées et les pages de catalogue. |
| Meta descriptions | PASS | Descriptions propres aux pages indexables, sans duplication détectée. |
| Headings | PASS | Un H1 sur les pages contrôlées, deux équipes dans le H1 des matchs, niveaux corrigés. |
| Contenu | WARNING | Données et limites explicites ; contact et mentions de l’éditeur encore à compléter. |
| Maillage interne | PASS | 1171 liens distincts contrôlés, aucun lien cassé ni redirection inutile détectée. |
| Images | WARNING | Alt, dimensions et image sociale contrôlés ; optimisation WebP/AVIF configurée, photos fournisseur non mesurées. |
| Performances | WARNING | Payloads fortement réduits ; recherche/favoris et trois compétitions restent lourds. |
| Core Web Vitals | NON TESTÉ | Pas de CrUX terrain ni INP fiable ; observations locales LCP/CLS uniquement. |
| Mobile | PASS | Parcours et absence de débordement testés sur mobile ; pages principales également vérifiées sur ordinateur. |
| HTTPS | NON TESTÉ | Serveur local HTTP ; certificat, mixed content public, HSTS et variantes de domaine non vérifiés. |
| JavaScript / rendu | PASS | Contenu principal et liens présents sans JS ; hydratation et parcours navigateur contrôlés. |
| Données structurées | WARNING | JSON-LD valide et contenu réel ; éligibilité Google et Rich Results Test non vérifiés extérieurement. |
| Breadcrumbs | PASS | Fils d’Ariane liés et BreadcrumbList sur les fiches réelles. |
| Open Graph | PASS | Titre, description, URL et image disponibles ; image sociale testée HTTP 200. |
| 404 | PASS | Sept variantes inexistantes testées en HTTP 404, interface 404 fonctionnelle. |
| Redirections | WARNING | Slash final et alias de match contrôlés ; HTTP/HTTPS et www/non-www à vérifier sur l’hébergeur. |
| Duplication | PASS | Canonicals des filtres, pagination distincte, recherche/favoris et contenu insuffisant en noindex. |
| Internationalisation | PASS | Site français, lang=fr ; aucun hreflang artificiel ajouté. |
| Accessibilité de base | PASS | Aucune violation axe WCAG A/AA sur les 12 vues contrôlées ; tests clavier et formulaires passés. |
| UX | PASS | 20 tests de parcours desktop/mobile passés, fonctions principales conservées. |
| Sécurité technique | PASS | Secrets configurés absents des bundles clients, .env ignorés, cron non authentifiés en 401, en-têtes de sécurité présents. Portée : contrôles élémentaires, pas un pentest. |
| Spam SEO | PASS | Aucun dispositif de spam détecté dans le code inspecté ; pas de pages IA destinées au SEO ni avis artificiels. |
| Build | PASS | Build de production, TypeScript, lint et 83 tests unitaires passent. |
| Erreurs console | PASS | Aucune erreur JavaScript dans les vues auditées et les parcours testés. |
| Pages dynamiques | PASS | Metadata, sitemap, 404 et profils testés ; profil joueur vérifié avec données contrôlées dans une base isolée. |

## Corrections effectuées

- Canonicals, descriptions et partage social centralisés ; validation de l’origine publique ; images Open Graph explicites sur les pages enfants.
- Sitemap sans catalogue joueurs vide, inclusion du live et de la pagination, retrait du plafond arbitraire de 1 000 matchs éligibles. Dates lastmod réservées aux dates réellement connues des matchs, pas au rafraîchissement de toutes les pages éditoriales.
- Robots laisse lire les noindex ; API en X-Robots-Tag noindex/nofollow.
- Chargement global déplacé vers l’administration pour éviter l’envoi prématuré d’un HTTP 200 sur les routes inexistantes. Les pages publiques rendent leur HTML complet.
- Pagination des catalogues navigable sans JS ; alias de match redirigés vers la route canonique ; titres de matchs datés et H1 regroupant les deux équipes.
- Données client limitées aux besoins des catalogues, profils et performances ; calculs de classements/comparaisons déplacés côté serveur, résultats équivalents vérifiés par tests. Lectures de dataset mutualisées dans une requête React.
- Hiérarchie des titres des états vides corrigée, images fournisseur optimisées lorsque prises en charge, variantes de .env exclues du suivi, texte des sources légales corrigé sans inventer l’identité de l’éditeur.
- Anciens tests E2E dépendant de faux matchs mis à jour pour les données disponibles. Scénarios détaillés de live conservés dans le test PostgreSQL isolé.

## Mesures de performance, limites et avertissements

HTML non compressé observé avant/après, sur le même corpus (le contenu du jour peut évoluer) :

| Route | Avant corrections | Après |
|---|---:|---:|
| /joueurs | 4 429 341 octets | 60558 octets |
| /competitions | 4 433 132 octets | 64407 octets |
| /classements | 4 456 245 octets | 397241 octets |
| /comparateur/equipes | 4 452 171 octets | 191695 octets |
| /comparateur/joueurs | 4 428 644 octets | 61915 octets |

Observations Playwright sur localhost, Chrome sans limitation réseau/CPU, une navigation par vue : LCP 96–944 ms, CLS observé 0. Ce ne sont **ni des scores Lighthouse, ni des percentiles utilisateurs, ni une validation des CWV**. INP non mesuré de manière représentative. Lighthouse n’est pas installé ; aucun score inventé.

Les pages recherche/favoris transmettent encore environ 4,4 Mo de HTML non compressé ; Premier League, Liga et Serie A environ 1,09 Mo. Leur découpage via une pagination/recherche serveur constitue une amélioration recommandée, avec tests dédiés pour préserver recherches, favoris et saisons. Elles ne présentent pas d’erreur fonctionnelle dans les parcours testés.

## Problèmes critiques et importants restants

1. Aucun problème critique corrigeable automatiquement restant détecté dans les contrôles locaux. Ne pas publier avec NEXT_PUBLIC_SITE_URL=http://localhost:3000 : configurer le domaine HTTPS réel puis reconstruire.
2. Contact public non configuré et informations de l’éditeur/hébergeur encore incomplètes. L’identité et les coordonnées ne peuvent pas être inventées. Vérifier les droits de diffusion des données et médias selon les licences applicables.
3. Payloads encore lourds indiqués ci-dessus. Les identifiants stables déjà utilisés dans certaines URLs sont conservés ; une migration d’URL nécessiterait une table de redirections et ses tests.
4. Données avancées/live dépendantes d’un fournisseur secondaire non configuré ; aucune statistique fictive n’a été ajoutée pour enrichir artificiellement le contenu.

## Vérifications impossibles localement et actions après déploiement

**NON VÉRIFIÉ EXTERNEMENT** : Search Console, indexation effective, CrUX, PageSpeed Insights, Rich Results Test, certificat TLS, redirections HTTP/HTTPS et www/non-www. La CI est configurée mais son exécution sur GitHub n’a pas été observée ici.

Après déploiement :

1. Configurer l’origine HTTPS définitive, reconstruire et vérifier une seule variante canonique avec redirections directes.
2. Lancer l’audit en mode strict : VERIFY_URL=https://domaine-réel SEO_REQUIRE_HTTPS=true npm run test:seo (adapter la syntaxe au shell).
3. Vérifier la propriété du domaine dans Search Console, soumettre /sitemap.xml et inspecter des URLs représentatives. Examiner indexation/exclusions, CWV, améliorations, actions manuelles et sécurité.
4. Exécuter PageSpeed mobile/desktop et Rich Results Test ; mesurer LCP/INP/CLS terrain quand le trafic le permet. Ne pas conclure sur la seule mesure localhost.
5. Renseigner contact et mentions de publication, contrôler les images réelles et les conditions des fournisseurs, puis vérifier l’exécution CI et ses rapports.

## Contrainte permanente et SEO POST-MODIFICATION

AGENTS.md impose les vérifications après toute modification importante et un audit global lors des changements d’architecture/metadata/routing. npm run test:seo et tests/seo.test.ts codifient les contrôles ; la CI lance audit SEO et E2E, avec un job PostgreSQL/UI séparé. Une CI sans données ne prouve pas les pages riches : le test DB/UI fournit ce complément ; le contrôle sur le véritable catalogue reste nécessaire.

Build PASS ; Indexation WARNING ; Metadata PASS ; URLs WARNING ; Canonical WARNING ; Sitemap WARNING ; Robots PASS ; Maillage PASS ; Images WARNING ; Mobile PASS ; Performance WARNING ; Structured Data WARNING ; Erreurs techniques PASS.

Régressions trouvées puis corrigées : partage social des pages enfants et hiérarchie des états vides. Aucun FAIL final. Vérifications manuelles : domaine, Google, identité/contact, données réelles et images fournisseur.

## Références officielles

- [Google : JavaScript et SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google : création et soumission des sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google : robots meta et indexation](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- [web.dev : Web Vitals et mesures terrain](https://web.dev/articles/vitals)

## SEO POST-MODIFICATION — Logos et thème sportif (20 septembre 2026)

Modifications : 129 écussons réels locaux WebP (1 116 226 octets au total, maximum 17 430 octets), registre exact pays/nom, composant TeamBadge partagé avec alt/dimensions/fallback, recherche rapide/favoris/comparateur ; palette sombre centralisée et thème clair conservé. Logo JSON-LD absolu et couleurs du manifest alignées.

| Contrôle | Résultat |
|---|---|
| Build, TypeScript, lint | PASS |
| Indexation | WARNING — domaine public HTTPS à configurer et vérifier |
| Metadata | PASS |
| URLs, Canonical, Sitemap | WARNING — contrôles locaux PASS ; origine publique non vérifiée |
| Robots, Maillage interne | PASS |
| Images | PASS — 129 fichiers valides, dimensions/alt et chargement testés |
| Mobile | PASS — 390/1440 px, contrôle complémentaire à 320 px |
| Performance | WARNING — HTML volumineux préexistant sur recherche/favoris et trois compétitions |
| Structured Data | PASS local — JSON-LD et logo absolu vérifiés |
| Erreurs techniques | PASS |

Vérifications exécutées : 85 tests unitaires, 20 tests E2E, 36 vues clair/sombre sans erreur JS, débordement, logo cassé ni violation axe WCAG A/AA. Échec réseau image simulé : initiales affichées correctement. Favori équipe et autocomplete contrôlés avec un logo réel. Build final, typecheck et lint réussis. Manifest final et URL absolue du logo SportsTeam contrôlés sur le serveur relancé.

Audit SEO final : 160 pages, 1 919 contrôles, 12 vues navigateur, 1 171 liens découverts ; aucun FAIL, lien cassé ou redirection interne. Six WARNING : origine HTTPS et poids HTML de /recherche (4 469 306 octets), /favoris (4 435 361), Premier League (1 097 928), La Liga (1 100 291), Serie A (1 097 003). Rapports : artifacts/seo-audit.json et artifacts/brand-verification.json.

Aucune régression détectée sur les contrôles exécutés. Les futurs clubs sans correspondance exacte conservent leurs initiales ; un logo fournisseur reste prioritaire. Sources et provenance épinglées dans public/team-logos/sources.json ; les droits des marques restent ceux des titulaires et la disponibilité du dépôt ne vaut pas licence.

NON VÉRIFIÉ EXTERNEMENT : production HTTPS, Search Console, indexation Google, PageSpeed/CrUX, Core Web Vitals terrain et Rich Results Test. Les actions après déploiement du rapport initial restent applicables.

## Validation finale consolidée — 21 septembre 2026

Voir `artifacts/PRELAUNCH-AUDIT.md`. Dernier build/typecheck/lint PASS ; 159 pages et 2 057 contrôles SEO sans échec/avertissement automatisé ; 210 vues responsive, 14 interactions et 26 E2E PASS. Intégration DB/UI finale PASS après ajout de l’avertissement de résultats en retard. Origine canonique préparée : https://probamatch.com. Production distante, Google et CWV terrain : NON VÉRIFIÉ EXTERNEMENT.

SEO POST-MODIFICATION : Build PASS ; Indexation WARNING ; Metadata PASS ; URLs/Canonical/Sitemap/Robots PASS local ; Maillage/Images/Mobile PASS ; Performance WARNING terrain ; Structured Data PASS local ; Erreurs techniques PASS dans les parcours finaux. Le verdict de lancement est PAS PRÊT AU LANCEMENT pour les raisons opérationnelles, données et publication détaillées dans le rapport final.
