# SEO et visibilité dans les réponses IA

Les mêmes contenus sont servis aux visiteurs et aux robots. Le rendu serveur rend les explications accessibles sans JavaScript. Aucun texte caché, instruction destinée à manipuler une IA, avis, auteur ou résultat de mesure fictif n’est ajouté.

## Contenus et responsabilités

- `/methodologie` documente les règles effectivement utilisées par le moteur.
- `/comprendre-probabilites` explique la lecture des estimations avec six questions et réponses visibles.
- `/lexique-football` définit 24 termes avec leurs limites. Le balisage `DefinedTermSet` correspond aux définitions affichées.
- `/sources-donnees` décrit les intégrations présentes, les limites de couverture et le sens des dates.
- `editorialReviewedAt` dans `src/lib/editorial.ts` est une date de révision du texte. Ne la changer que lorsque les contenus concernés sont effectivement revus. Si les pages évoluent séparément, remplacer cette date partagée par des dates par page.

Le graphe `WebSite` / `Organization` identifie la marque Proba Match ; il n’invente pas une société enregistrée ni une équipe éditoriale. Les coordonnées légales et de contact restent à renseigner avec des informations réelles.

## Avant et après publication

1. Configurer l’origine canonique réelle dans `NEXT_PUBLIC_SITE_URL`. Le domaine retenu reste `https://proba-match.vercel.app` ; aucune migration de domaine n’est effectuée par cette passe.
2. Renseigner uniquement les vrais jetons `GOOGLE_SITE_VERIFICATION` et `BING_SITE_VERIFICATION`, si la validation HTML est choisie. Les laisser vides ne prétend pas valider la propriété du site.
3. Exécuter `npm run check`, puis lancer le serveur de production local et `npm run test:seo`. Tester également `npm run test:e2e -- tests/e2e/editorial-geo.spec.ts tests/e2e/reading-guide.spec.ts`. Les parcours liés aux matchs nécessitent une base isolée réellement alimentée.
4. Après déploiement, exécuter `VERIFY_URL=https://proba-match.vercel.app SEO_CANONICAL_ORIGIN=https://proba-match.vercel.app SEO_REQUIRE_HTTPS=true npm run test:seo`. Vérifier séparément les redirections HTTP et variantes de domaine sur l’hébergeur.
5. Dans Search Console, inspecter les cinq guides éditoriaux, vérifier le canonical choisi et soumettre `/sitemap.xml`. Vérifier le réglage d’inclusion dans les fonctionnalités de recherche générative lorsqu’il est proposé. Une URL dans le sitemap ne garantit pas l’indexation.
6. Dans Bing Webmaster Tools, soumettre le sitemap et examiner l’indexation ainsi que les rapports AI Performance disponibles. Contrôler que les protections CDN/WAF autorisent réellement les robots de recherche vérifiés, y compris OAI-SearchBot pour la recherche ChatGPT. L’autorisation des robots de recherche et celle de l’entraînement sont des choix différents ; ne pas remplacer aveuglément la politique actuelle.

Les dates de synchronisation des matchs ne sont pas utilisées comme `lastmod` : elles peuvent changer sans modification significative. Réintroduire un `lastmod` sportif uniquement avec un horodatage fiable des changements de contenu. Ne pas inventer `priority`, dates de publication ou fréquences de mise à jour.

## Mesurer des effets réels

Conserver une baseline avant publication et comparer des périodes de durée comparable, en séparant les requêtes de marque, pays, appareils et types de pages. Documenter la saisonnalité sportive et les dates de déploiement.

| Mesure | Source | Limite |
| --- | --- | --- |
| Pages indexées, canonical choisi, erreurs d’exploration | Search Console / Bing Webmaster Tools | Dépend de l’accès propriétaire ; les audits locaux ne remplacent pas ces rapports |
| Impressions, clics, CTR et requêtes | Search Console | La position moyenne dépend du mélange de requêtes et n’est pas une promesse de classement |
| Citations et pages utilisées dans les réponses IA | AI Performance de Bing lorsque disponible | Périmètre de couverture limité aux services et rapports concernés |
| Visites référées et engagement | Outil analytique réellement configuré | Une citation peut ne produire aucune visite ; une visite n’indique pas toutes les citations |
| LCP, INP, CLS terrain | CrUX / Search Console / RUM réellement activé | Une mesure locale ne constitue pas une validation des Core Web Vitals terrain |

Un jeu fixe de requêtes utilisateur peut compléter le suivi manuel des citations : consigner date, moteur, langue, pays, question et URL citée. Ne pas automatiser des recherches massives ni présenter ces observations comme un classement stable de toutes les réponses IA.

## Références officielles vérifiées le 5 octobre 2026

- [Google : optimisation des fonctionnalités génératives](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [Google : fonctionnalités IA et site Web](https://developers.google.com/search/docs/appearance/ai-features)
- [Google : sitemap et dates significatives](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google : mises à jour de documentation](https://developers.google.com/search/updates) — suppression de la fonctionnalité de résultats enrichis FAQ en 2026. Le JSON-LD FAQ décrit les réponses visibles ; aucun résultat enrichi n’est promis.
- [OpenAI : robots et contrôles d’exploration](https://developers.openai.com/api/docs/bots)
- [Bing : rapport AI Performance](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c)

Google n’utilise pas `llms.txt` comme levier de classement ou de visibilité. Aucun fichier de ce type ni « schema IA » n’est requis par ces recommandations. Les contenus ajoutés répondent aux questions sur le fonctionnement propre de Proba Match, sans multiplier les pages pour des variantes de mots-clés.
