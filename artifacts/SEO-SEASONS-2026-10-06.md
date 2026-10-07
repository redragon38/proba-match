# Proba Match — intégrité des saisons et des URLs

Rapport finalisé le 6 octobre 2026. Les vérifications HTTP et navigateur de cette passe ont été exécutées le 5 octobre ; leurs dates exactes restent dans les artefacts. Travail local sur le projet existant issu de `redragon38/proba-match`, branche d’origine `master`, base `f828972`. Aucune nouvelle branche, écriture distante ou mise en production.

## Corrections concrètes

- Un match sans saison explicite était auparavant sélectionné dans toutes les saisons demandées. Il est désormais rattaché uniquement à la saison de configuration ; un avertissement visible précise que cette attribution ne confirme pas sa saison réelle. Les saisons historiques utilisent leurs matchs explicitement identifiés.
- Les totaux de buts et de résultats exploitables excluent les scores manquants, négatifs, non finis ou fractionnaires. Les scores finaux invalides deviennent indisponibles dans la liste, sans suppression de la rencontre.
- Les classements individuels excluent les compteurs invalides et manquants. Un zéro réellement renseigné reste admissible ; il ne remplace jamais une valeur absente. Ces compteurs ne certifient pas un classement officiel complet ni le périmètre de saison/compétition de tous les fournisseurs.
- La projection vers la fiche compétition conserve la date source lorsqu’un horaire de coup d’envoi n’est pas confirmé.
- Une saison demandée indisponible déclenche un message explicite et conserve le repli existant vers la saison courante. Le titre et la description correspondent à la saison effectivement affichée.
- Les redirections d’alias de compétition préservent les filtres de saison et de statut.
- Les paramètres de recherche répétés sont normalisés en choisissant leur première valeur. Les recherches restent limitées à 100 caractères. Les paramètres de pagination non décimaux, comme `1e0` ou `0x1`, renvoient 404.
- Les pages de recherche équipes/joueurs ont un canonical encodé correspondant à leur recherche, restent `noindex, follow` et décrivent leur nombre réel de résultats. La pagination non filtrée conserve ses règles existantes.

Ces changements corrigent des erreurs de données et de navigation ; ils n’ajoutent ni données sportives inventées ni coefficients prédictifs arbitraires. Le moteur actif et ses mesures historiques restent ceux documentés dans les rapports précédents.

## Preuves et contrôles

Les huit tests de régression de `tests/season-query-integrity.test.ts` couvrent le cloisonnement des saisons, les scores invalides et leur projection, les compteurs absents ou nuls, la date source, le repli de saison, les filtres répétés, la pagination et les metadata filtrées.

La fixture navigateur monte le composant réel `CompetitionProfile` et son agrégation avec des données explicitement fictives. Sur sa saison courante : 3 rencontres, 2 résultats exploitables, 13 buts. Sur la saison historique : 1 rencontre, 1 résultat exploitable, 1 but. Le changement de saison, l’absence d’avertissement d’attribution dans l’historique et le message de repli sont contrôlés sur 320, 390, 768 et 1440 px, en thèmes clair et sombre.

| Contrôle | Résultat et périmètre |
| --- | --- |
| Types, lint, tests, compilation | PASS — 277 tests dans 44 fichiers, types, lint et compilation ; journal `SEO-SEASONS-VALIDATION.log` |
| Rendu serveur | PASS — 129 contrôles locaux |
| SEO | PASS — 22 routes, 279 contrôles, aucun FAIL ; WARNING HTTPS attendu sur l’origine locale HTTP |
| Parcours éditoriaux et recherches | PASS — 16 tests Playwright desktop/mobile, dont les nouvelles recherches répétées et erreurs de pagination |
| Sécurité HTTP | PASS — 14 contrôles, aucun échec |
| Responsive global | PASS — 224 vues et 14 séries d’interactions |
| Fiche compétition sur fixture | PASS — 8 vues, 2 changements de sélection et 7 assertions de métriques par vue ; aucun débordement, erreur de page ou violation WCAG automatique détecté |
| Routes sportives avec base réelle | NON TESTÉ — absence de PostgreSQL alimenté et de secrets de production |
| Classement Google, indexation et citations IA | NON MESURÉ EXTERNEMENT — corrections locales, sans revendication de gain |

Les résultats sont conservés dans `SEO-SEASONS-CHECKS.json`, `SEO-SEASONS-seo-audit.json`, `SEO-SEASONS-IMPROVEMENT-SSR.json`, `SEO-SEASONS-security-http.json`, `SEO-SEASONS-responsive.json`, `SEO-SEASONS-COMPETITION-UI.json` et leurs journaux. Les règles WCAG automatiques ne constituent pas une certification exhaustive.

## Limites importantes

Le catalogue sportif réel local reste vide. Les parcours éditoriaux et les contrats HTTP utilisent l’application compilée ; la fixture de compétition utilise un adaptateur de navigation isolé, qui ne valide pas les requêtes serveur avec PostgreSQL. La suite sportive complète reste bloquée par l’absence de match à venir constatée lors de la passe précédente ; elle n’est pas présentée comme réussie ici.

Une saison manquante ne devient pas une saison réellement confirmée. La couverture du calendrier, des classements et des joueurs peut être partielle. Les compteurs individuels ont encore besoin d’un périmètre fournisseur vérifiable avant de constituer un palmarès officiel de compétition.

La baseline prédictive antérieure et les limitations des timestamps historiques restent applicables. Aucun nouveau gain de Brier Score, Log Loss ou calibration n’est annoncé pour cette passe. Le suivi d’indexation et de citations IA doit être effectué après publication, selon `docs/seo-geo-operations.md`.

Référence officielle utilisée pour les URLs : [Google Search Central — structure des URLs](https://developers.google.com/search/docs/crawling-indexing/url-structure).
