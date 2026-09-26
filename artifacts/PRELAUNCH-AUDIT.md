# Audit final pré-lancement — MatchScore / probamatch.com

Complément du 26 septembre : intégration de la marque **Proba Match** et contrôles locaux
[branding, SEO, accessibilité et performances](PROBA-MATCH-AUDIT.md). Ce complément ne lève
pas les blocages de production, de couverture fournisseur ou d'informations éditeur ci-dessous.

Contrôles réalisés les 20 et 21 septembre 2026. Build final de production servi localement sur http://localhost:3000. Domaine cible confirmé par le propriétaire : https://probamatch.com ; hébergement cible Vercel. Aucune publication distante effectuée pendant cet audit.

## VERDICT DE LANCEMENT

**PAS PRÊT AU LANCEMENT**

Les contrôles locaux passent après correction, mais la chaîne de production publique n’est pas opérationnelle et vérifiée : DNS non résolu lors du contrôle, aucun projet MatchScore dans l’équipe Vercel accessible, aucune DB de production/sauvegarde observée. Les résultats du fournisseur sont en retard et aucune clé secondaire ne permet actuellement de garantir le live. Les informations d’éditeur et droits de diffusion doivent encore être confirmés.

PASS = vérifié dans le périmètre indiqué ; WARNING = limite ou amélioration ; FAIL = problème affectant le lancement ; NON TESTÉ = accès ou environnement manquant. Un PASS local ne vaut pas validation de production.

## P0 — BLOQUANTS

- **FAIL — chaîne publique absente/non opérationnelle.** `probamatch.com` et `www.probamatch.com` répondaient « nom DNS inexistant » le 20 septembre. L’équipe Vercel accessible contient uniquement un autre projet, pas MatchScore/ProbaMatch. Aucune base PostgreSQL de production ni exécution des crons distants n’a été observée. Il faut connecter le domaine, préparer la DB et déployer avant toute validation publique.
- Aucun autre P0 de code détecté dans les contrôles locaux exécutés. Cela ne constitue pas une certification de sécurité.

## P1 — AVANT LANCEMENT

- **FAIL — promesse de résultats actuels/live non satisfaite.** La base est fidèle à OpenFootball, mais le fichier Ligue 1 contrôlé le 20 septembre garde 7 rencontres passées sans résultat ; dernier résultat au 13 septembre. Clé secondaire absente. Les détails live réels et joueurs ne sont donc pas disponibles. L’interface et le health signalent désormais ce retard au lieu de confondre import récent et score récent.
- **FAIL — informations de publication incomplètes.** Identité/coordonnées de l’éditeur, responsable de publication, contact et détails de l’hébergeur restent à compléter. Les textes signalent clairement ces absences ; aucune identité fictive ajoutée. Vérifier les licences de données et les droits sur les logos/photos.
- **NON TESTÉ — sauvegardes, restauration, rôle DB limité, pooling et alertes de production.** Le compte PostgreSQL local est administrateur et ne doit pas être repris tel quel comme rôle applicatif public.
- **WARNING — livraison versionnée.** Le dépôt contient encore les fichiers applicatifs non suivis. Aucun commit, push, suppression ou réinitialisation effectué. Sauvegarder/versionner la livraison avant de raccorder une CI de production.

## P2 — APRÈS LANCEMENT / AVANT MONTÉE EN CHARGE

- Vérifier les limites anti-abus/WAF Vercel sur les APIs publiques et mesurer une charge réaliste. L’admin dispose déjà d’une limitation partagée en DB ; les lectures publiques sont bornées/cachées et ne déclenchent pas le fournisseur.
- Renforcer éventuellement la CSP de scripts par nonce/hash et la révocation des sessions administrateur. La CSP actuelle protège objets, base, formulaires et framing ; elle ne revendique pas une protection exhaustive contre XSS. Une copie d’une session stateless reste valable jusqu’à expiration ou rotation du secret.
- Suivre les mesures terrain, la couverture des données et les alertes. Le snapshot serveur complet reste acceptable pour 7 008 matchs mais sa croissance et ses lectures doivent être mesurées. Fractionner les sitemaps si leur volume le justifie ; le sitemap actuel reste très inférieur à 50 000 URLs.
- Quelques fermetures anticipées de flux ont été journalisées pendant les navigations/annulations de requêtes de test ; aucun échec de page ou erreur navigateur associé dans les audits finaux. À surveiller dans les logs distants.

## SEO

| Contrôle | Statut | Preuve et limite |
|---|---|---|
| Google Search Essentials | WARNING | Exigences techniques et contenu contrôlés localement ; Googlebot public/indexation non accessibles avant déploiement. |
| Crawl/indexation | WARNING | Pages indexables publiques, SSR, HTTP 200 et absence de noindex accidentel vérifiés. L’indexation Google réelle n’est pas prouvée. |
| robots.txt | PASS | Ressources et pages publiques crawlables ; API exclue ; sitemap HTTPS canonique. Previews sans référence au sitemap, noindex lisible par les crawlers. |
| sitemap.xml | PASS | XML valide, URLs uniques HTTPS probamatch.com, pages indexables/canoniques, aucun lien cassé/redirect ; génération dynamique. |
| URLs/canonical/duplication | PASS | Origine unifiée ; paramètres de filtres canonicalisés ; pagination auto-canonique ; redirections d’alias et slash contrôlées. Redirection www → domaine nu testée en HTTP local avec Host explicite, 308 et query conservée. |
| Metadata/titles/descriptions | PASS | Métadonnées serveur, titres/descriptions uniques sur les pages indexables du catalogue ; partage social cohérent. |
| H1/hiérarchie/langue | PASS | H1 et hiérarchie contrôlés sans JavaScript ; lang fr, viewport, dates françaises. |
| Contenu/données utiles | WARNING | Résultats, historique et calculs transparents. Source sportive en retard ; absence de joueurs réels/enrichissement. Pages trop faibles exclues de l’indexation. |
| Spam/programmatique | PASS | Aucun faux avis/note, bourrage de mots-clés ou cloaking détecté dans les zones inspectées ; demo explicitement désactivée en production. Éligibilité d’indexation fondée sur les données disponibles. |
| Maillage/navigation | PASS | 1 164 liens découverts, 1 006 cibles supplémentaires contrôlées, aucun lien cassé ni redirection interne ; pages sitemap accessibles par liens HTML. |
| Rendu JavaScript | PASS | Contenu principal et metadata présents sans JS ; hydratation et parcours testés avec JS. |
| Structured Data/breadcrumbs | PASS | JSON-LD valide, URLs absolues, breadcrumbs cohérents ; aucun avis/prix inventé. SportsTeam ne promet pas un rich result Google. Rich Results Test distant NON TESTÉ. |
| Open Graph/identité | PASS | Titres/descriptions/URLs/images sociales vérifiés ; icône/manifest et marque MatchScore cohérents. Le domaine choisi ne change pas automatiquement la marque. |
| 404/redirections | PASS | URLs inexistantes match/joueur/équipe/compétition et pages hors catalogue en vrai HTTP 404 ; redirects permanents vérifiés. |
| Internationalisation | PASS | Version française unique ; pas de faux hreflang ni pages traduites dupliquées. |
| Filtres/recherche/favoris/admin | PASS | Non-indexation ou canonical appropriée ; aucune recherche/favoris/admin dans le sitemap. |
| Environnements | PASS | Tests preview/staging : noindex global et metadata, sitemap vide ; origine localhost/vercel.app refusée pour Vercel production. À recontrôler après déploiement. |
| Core Web Vitals terrain | NON TESTÉ | NON VÉRIFIÉ EXTERNEMENT : CrUX/INP terrain/PageSpeed. Aucune note Lighthouse inventée. |

Audit final : **159 pages, 2 057 contrôles, 10 vues axe/navigateur, 0 FAIL et 0 WARNING automatisés**. Le 21 septembre, aucune rencontre du jour : les pages match ont été couvertes en complément par les parcours responsive et l’intégration DB/UI, qui découvrent un match du catalogue. Le catalogue réel n’a aucun joueur : profil joueur contrôlé avec fixture isolée à 320/390/1440 px, sans l’exposer dans l’application réelle.

## SÉCURITÉ

| Contrôle | Statut | Preuve et limite |
|---|---|---|
| OWASP | WARNING | Audit ciblé du contrôle d’accès, auth, validation, injections, erreurs, secrets et dépendances selon OWASP Top 10:2025 ; pas un pentest exhaustif distant. |
| Secrets/NEXT_PUBLIC/Git | PASS | Dernier scan : 449 fichiers publiables et 29 assets, aucun secret connu ou format sensible détecté. Seul NEXT_PUBLIC_SITE_URL public. .env ignoré ; aucun secret configuré dans les 27 JS du build final. Historique distant inaccessible. |
| Admin/auth/sessions | PASS | Connexion réelle HTTP 200, vue privée authentifiée, refus anonymes, expiration/signature strictes ; cookie HttpOnly/Secure/SameSite Strict ; logout et suppression du cookie testés. |
| API/cron/health | PASS | 14 probes anonymes/headers sans échec ; secret exigé serveur, routes sensibles ne lancent aucun travail sans autorisation. Health privé et no-store. |
| Validation/XSS/CSRF/CORS | PASS | Corps JSON lus avec limite réelle en streaming, schémas admin stricts, origine contrôlée ; entrées invalides/JSON malformé/type incorrect/taille excessive refusés ; React et JSON-LD échappés ; pas de CORS privé permissif. |
| Injections/SSRF | PASS | Prisma/requêtes paramétrées, pas d’URL de téléchargement arbitraire proposée aux visiteurs ; domaines fournisseurs fixes/contrôlés. Aucun test destructeur externe. |
| DB/cache privé | PASS | Transactions/verrous et invalidation testés en base isolée ; favoris en lookup privé no-store, administration non mise en cache public. |
| Headers | PASS | CSP de base, nosniff, framing, Referrer/Permissions Policy vérifiés sur build ; HSTS conditionné à production HTTPS. Certificat/HSTS déployé NON TESTÉ. |
| Dépendances/supply chain | PASS | npm audit : 0 vulnérabilité signalée, 565 dépendances. Lockfile présent ; aucune nouvelle dépendance ni migration majeure. |
| Abus/charge publique | WARNING | WAF et limites distribuées de la future infrastructure à vérifier. Aucun visiteur ne consomme directement le quota fournisseur via les endpoints de lecture. |
| Erreurs/logs | PASS | Réponses de refus génériques, pas de stack/secret exposé lors des probes ; logs structurés limités aux événements/codes/compteurs. |

20 tests ciblés sécurité ont passé ; ils sont inclus dans la suite globale. Contrôles supplémentaires : 11 probes d’entrées et redirection, 0 échec ; session admin réelle sans afficher ses secrets.

## PERFORMANCE

| Contrôle | Statut | Preuve |
|---|---|---|
| Build/typecheck/lint | PASS | Commandes existantes exécutées, dernier build Next 16.3.5 réussi ; lint et typecheck réussis après dernières corrections. |
| Payload/recherche | PASS | HTML 4 469 306 → **73 518 octets**. Recherche complète côté serveur, 25 résultats par page, annulation des réponses obsolètes. |
| Payload/favoris | PASS | HTML 4 435 361 → **31 493 octets**. Seuls les identifiants locaux nécessaires sont résolus via API, pas tout le catalogue dans le HTML. |
| Payload/compétitions | PASS | HTML Ligue 1 **130 484**, Premier League **136 100**, La Liga **138 221 octets** ; saison complète calculée serveur, seuls les éléments affichés transmis. |
| Bundle | WARNING | 1 175 942 octets JS cumulés pour 27 fichiers, non chargés tous sur une page ; maximum observé 249 290 octets JS encodés sur les vues SEO mesurées. Mesures réseau/mobile réelles restent nécessaires. |
| Images | PASS | 129 logos WebP, environ 1,1 Mo au total, maximum 17,4 Ko ; tailles/alt/fallback présents, aucun logo cassé détecté dans les vues finales. |
| Mesures locales | PASS | Sur 10 navigations locales : LCP observé 84–688 ms ; CLS observé 0–0,0042. Mesures de navigation brèves, réseau local, sans throttling, parfois pendant d’autres contrôles. Ce ne sont pas les CWV terrain ni une garantie mobile. |
| Lighthouse/INP terrain | NON TESTÉ | Lighthouse absent ; aucun score généré. PageSpeed/CrUX à exécuter après déploiement, INP non mesuré ici. |
| DB | WARNING | Index/migrations/intégrité et pipeline vérifiés, projections client réduites ; aucun test de charge d’une DB distante ni plan d’exécution en production. |

## UX / CONFORMITÉ

| Contrôle | Statut | Preuve et limite |
|---|---|---|
| Desktop/mobile/dark/light | PASS | **210 vues**, thèmes clair/sombre ; largeurs 320, 360, 375, 390, 430, 768, 1440 px ; 14 interactions recherche clavier/menu ; aucun débordement ni erreur JS/asset détecté. |
| Parcours fonctionnels | PASS | **26 E2E** : calendrier, filtres, détails match, favoris, préférences, comparateurs, recherche/pagination/réponses concurrentes, saisons, 404, admin protégé, actualisation automatique. |
| Accessibilité de base | PASS | Axe WCAG A/AA sans violation dans les vues SEO testées, navigation clavier/menu, focus, labels, alt et headings contrôlés. Pas une certification WCAG complète. |
| Timezone/locale | PASS | UTC en stockage, affichage local français ; tests minuit Paris/New York/Tokyo et changement d’heure ; comparaison indépendante des heures source Paris/UTC. |
| Analytics/consentement/publicité | PASS | Analytics actuel = événement local sans réseau/identifiant ; aucun tiers publicitaire/mesure d’audience chargé ; AdSlot inactif avec espace réservé. Revoir le consentement avant activation de traceurs. |
| PWA/offline | PASS | Manifest/icône présents ; aucun service worker installé par le projet, pas de vieux cache offline à migrer. Aucune PWA ajoutée inutilement. |
| Informations légales/contact | FAIL | Placeholders explicites encore présents ; hébergement cible mis à jour selon confirmation du propriétaire et lookup des favoris expliqué. Compléter avec des informations réelles et validation appropriée. |
| Données fictives/debug | PASS | Fixtures réservées aux tests/démo explicite hors production ; logs utiles conservés, pas de debugger ni bouton factice identifié dans les parcours. |

## PRODUCTION / DONNÉES

| Contrôle | Statut | Preuve et limite |
|---|---|---|
| Domaine/DNS/HTTPS public | NON TESTÉ | Origine préparée ; DNS non résolu au contrôle. Certificat, HTTP→HTTPS et rattachement Vercel non validables avant configuration. |
| Déploiement/variables distantes | NON TESTÉ | Aucun projet MatchScore dans le compte Vercel accessible ; variables Production/Preview et logs de déploiement non observés. |
| PostgreSQL production/backup | NON TESTÉ | DB locale fonctionnelle ; DB managée, pooling, rôles, sauvegarde et restauration distante à configurer/vérifier. |
| Corpus/fidélité | PASS | 7 008 matchs, 129 équipes, 5 compétitions. Comparaison lecture seule : 306 matchs Ligue 1 concordants avec source officielle OpenFootball ; 18 lignes classement recalculées indépendamment. |
| Fraîcheur/live/joueurs | WARNING | Source en retard, 0 joueur réel, clé secondaire absente ; avertissement d’actualité ajouté après le cache et dans health. Données jamais inventées. |
| Jobs/configuration | WARNING | Deux crons Vercel déclarés, compatibles cadence Hobby ; aucune exécution distante observée. Worker persistant local et heartbeat opérationnels. |
| Cache/transactions/quota/fallback | PASS | Intégration finale sur DB temporaire : import idempotent, report/ajout match, score/minute/événements/stats/compos/blessures/final/classement, quota/panne, cache entre processus et rafraîchissement UI automatique. Corpus réel conservé. |
| Monitoring | WARNING | /api/health protégé et testé : HTTP 200, status warning, OPENFOOTBALL_RESULTS_LATE et SECONDARY_NOT_CONFIGURED. Aucun service d’alerte externe raccordé. Surveiller le JSON en plus du code HTTP. |
| CI | NON TESTÉ | Workflow présent ; exécution GitHub distante non observée. |

Fréquences : Vercel OpenFootball quotidien **05:15 UTC**, secondaire quotidien **07:15 UTC** (Hobby : fenêtre d’exécution d’une heure, pas garantie à la minute). Le cron secondaire quotidien n’assure pas le live continu. Worker persistant : boucle **60 s**, OpenFootball **6 h**, retry échec **1 h** ; secondaire live **60 s**, pré-match **5 min**, résultats **1 h**, joueurs/blessures **6 h**, sous conditions de couverture/quota. Navigateur : lecture DB/cache **30 s**, ralentissement sur erreurs/inactivité. Un live fréquent sur Vercel exige un ordonnanceur adapté et un budget fournisseur suffisant ; aucun abonnement payant modifié.

## CORRECTIONS EFFECTUÉES

- Recherche/favoris/compétitions : `services/search-index.ts`, `services/competition-view.ts`, `/api/search`, pages et composants associés ; données bornées sans retirer le catalogue complet.
- Auth/API : `lib/auth.ts`, `lib/request-body.ts`, routes admin ; sessions strictes et entrées bornées/validées.
- Déploiement/SEO : `lib/deployment.ts`, `lib/seo.ts`, layout/robots/sitemap, `next.config.ts` ; origine probamatch.com, protection preview, 308 www, headers.
- Exploitation : `/api/health`, `services/football/health.ts`, `freshness.ts`, `index.ts`, `vercel.json` ; monitoring et avertissement des résultats manquants malgré un import récent.
- Pages de transparence adaptées aux faits connus ; pas d’informations juridiques inventées.
- Tests de non-régression ajoutés, audit responsive débarrassé d’anciennes URLs de démonstration, baseline permanente consignée dans AGENTS.md.

## TESTS ET PREUVES

- Suite globale : **114 tests PASS**, puis **15 tests ciblés fraîcheur/health PASS** après dernière correction (certains déjà présents dans les 114).
- **26 E2E PASS** après optimisation ; **210 vues + 14 interactions PASS** sur le dernier build ; **14 probes sécurité PASS** et **11 probes entrées/redirect PASS**.
- Typecheck, lint, build production : PASS. Intégration **DB/UI finale PASS le 21 septembre**, dans une base temporaire supprimée ensuite, jamais le corpus applicatif.
- Artefacts : `seo-audit.json`, `responsive.json`, `security-http.json`, `security-secrets.json`, `client-secrets-check.json`, `prelaunch-inputs.json`, `prelaunch-admin-session.json`, `performance-payloads.json`, `prelaunch-source-check.json` et captures `prelaunch-*.png`.
- Sous-rapports : `prelaunch-security.md`, `prelaunch-data.md`, `prelaunch-performance.md`. Le présent rapport consolide les résultats finaux et remplace leurs mentions intermédiaires « après build ».

## NON TESTABLE LOCALEMENT

**NON VÉRIFIÉ EXTERNEMENT** : déploiement MatchScore, variables et crons Vercel effectifs, DNS/TLS de production, DB/backup/restauration/alertes distants, indexation et actions manuelles Search Console, Rich Results Test, PageSpeed/CrUX/CWV terrain, couverture live d’un abonnement fournisseur, validation juridique des informations/conditions/droits.

## ACTIONS MANUELLES POUR LE PROPRIÉTAIRE — MAXIMUM 10

1. Rattacher le domaine détenu `probamatch.com` au nouveau projet Vercel MatchScore et configurer les DNS indiqués par Vercel ; choisir le domaine nu canonique.
2. Provisionner PostgreSQL managé avec rôle applicatif limité, pooling adapté et sauvegardes automatiques ; effectuer une restauration dans un environnement séparé.
3. Configurer les variables Vercel Production/Preview : DATABASE_URL distinctes, secrets longs CRON_SECRET/ADMIN_SECRET, NEXT_PUBLIC_SITE_URL=https://probamatch.com ; aucune clé privée NEXT_PUBLIC.
4. Versionner le projet, appliquer les migrations et réaliser l’import initial, puis déployer ; vérifier logs de build, DB et exécutions authentifiées des deux crons.
5. Choisir une source secondaire autorisée, sa couverture et son quota ; configurer une cadence adaptée au live si cette fonctionnalité doit être proposée au lancement.
6. Fournir l’identité/contact réels et compléter les pages légales ; confirmer les droits de diffusion des données et logos avant publication.
7. Raccorder un moniteur au health authentifié et configurer les alertes DB/source/quota/site indisponible ; surveiller aussi les échecs de déploiement.
8. Sur la production, lancer `VERIFY_URL=https://probamatch.com SEO_CANONICAL_ORIGIN=https://probamatch.com SEO_REQUIRE_HTTPS=true npm run test:seo` (adapter les variables au shell) ; vérifier HTTP/HTTPS, www/non-www et alias vercel.app.
9. Valider la propriété Search Console, soumettre le sitemap, inspecter accueil/équipe/match ; examiner indexation/exclusions, CWV, actions manuelles et sécurité.
10. Mesurer PageSpeed mobile/desktop sur accueil, match, équipe, joueur lorsqu’il existe et compétition ; utiliser Rich Results Test pour les breadcrumbs et autres types réellement pris en charge, sans supposer un rich result SportsTeam.

## SEO POST-MODIFICATION

Build PASS ; Indexation WARNING (Google non vérifié) ; Metadata PASS ; URLs PASS local ; Canonical PASS local ; Sitemap PASS local ; Robots PASS local ; Maillage PASS ; Images PASS ; Mobile PASS ; Performance WARNING (terrain non mesuré) ; Structured Data PASS local ; Erreurs techniques PASS sur les parcours finaux.

Régressions corrigées : corps de session trop permissif, volumes HTML excessifs, risque d’indexation preview, absence de signal sur les scores source en retard. Pas de FAIL automatisé restant ; les bloqueurs opérationnels et éditoriaux ci-dessus empêchent le verdict « prêt ».

Référentiels consultés : [Google Search Essentials](https://developers.google.com/search/docs/essentials), [politiques antispam Google](https://developers.google.com/search/docs/essentials/spam-policies), [types de données structurées pris en charge](https://developers.google.com/search/docs/appearance/structured-data/search-gallery), [OWASP Top 10:2025](https://top10.owasp.org/2025/), [cadences et limites Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing). Ces références orientent les contrôles ; elles ne garantissent ni indexation ni absence de vulnérabilité.
