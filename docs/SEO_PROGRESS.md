# Mission SEO — suivi

Objectif : audit du dépôt et du site public, correction des défauts confirmés,
surveillance réutilisable, tests, rapports et commande de déploiement Ubuntu.
Travail sur la branche existante codex/prediction-history-coverage ; aucun reset de base.

## Audit initial réalisé

- Architecture : Next.js 16.3.8 App Router, React 19, Prisma 6/PostgreSQL ;
  application et worker Docker, scheduler Alpine, Nginx et Caddy sur VPS.
- Lecture de la politique SEO, des routes, services de cache/import, profils,
  JSON-LD, sitemap, robots, configuration et tests. Documentation Next installée
  et recommandations Google/Schema.org consultées.
- Public : sitemap environ 4 800 URL ; couverture des prédictions échantillonnée
  séparément (17/23 disponibles). Pas d'accès authentifié à Search Console ni VPS.
- Aucun secret lu ou divulgué ; les contrôles publics restent en lecture seule.

## Défauts confirmés traités

1. P1 — EventCompleted/EventInProgress absents d'EventStatusType Schema.org.
2. P1 — Origine de secours historique Vercel/localhost incompatible avec le VPS
   quand la variable d'origine est absente ou conserve un ancien domaine.
3. P2 — entityContentModifiedAt refiltre tous les matchs par URL du sitemap.
4. P2 — Accueil : sélection éditoriale fondée sur la date du snapshot au lieu de
   l'horloge ; les dates choisies par le visiteur doivent rester explicites.
5. P2 — Surveillance globale et comparaison du volume indexable à compléter.
6. P2 — Tests navigateur : ancien libellé de recherche ; prérequis de catalogue
   absent à distinguer des défauts de l'interface.
7. P0/P2 — Gestion de panne DB à froid et payload du bilan de 18,7 Mo corrigés.
8. P1 — Archives de saisons et pagination des matchs : métadonnées, canonicals et maillage.

## Livrables créés

- docs/SEO_AUDIT.md : état initial, preuves, priorités et périmètre.
- docs/SEO_IMPLEMENTATION.md : changements, exploitation et déploiement.
- docs/SEO_TEST_RESULTS.md : validations exécutées et limites.
- Audit public 40 pages/60 liens/18 vues ; local 24 pages/299 contrôles/14 vues.
- 409 tests unitaires/intégration ; navigateur 50 PASS, 22 SKIP sans base réelle.
- Build/typecheck/lint et tests de déploiement ; preuves dans artifacts/SEO-MISSION-EVIDENCE.json.
- Script scripts/deploy-seo-fix.sh et commande Ubuntu documentée ; branche existante conservée.

## Après livraison : actions du propriétaire

1. Exécuter la commande de déploiement documentée et transmettre ses contrôles finaux.
2. Vérifier la nouvelle taille du bilan public après expiration du cache.
3. Observer la première exécution du cron SEO ; pas encore exécuté en production ici.
4. Relever Search Console/CrUX et la couverture des prédictions dans la base réelle.

Les CWV terrain, CTR et indexation effective Google resteront non vérifiés sans
accès aux rapports correspondants. Aucun score ou résultat sportif ne sera inventé.
