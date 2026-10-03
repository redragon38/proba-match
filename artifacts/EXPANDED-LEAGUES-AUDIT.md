# Cinq compétitions supplémentaires — 3 octobre 2026

Import réel dans la base PostgreSQL du workspace cloud, depuis ESPN. Les cinq compétitions existantes OpenFootball restent présentes.

| Compétition | Équipes actuelles | Équipes sur l'historique | Rencontres | Joueurs actuels |
| --- | ---: | ---: | ---: | ---: |
| Liga Portugal | 18 | 25 | 1 224 | 558 |
| Eredivisie | 18 | 24 | 1 233 | 530 |
| Brasileirão | 20 | 29 | 1 523 | 939 |
| Saudi Pro League | 18 | 25 | 1 224 | 591 |
| Major League Soccer | 30 | 30 | 2 105 | 962 |
| Total ajouté | 104 | 133 | 7 309 | 3 580 |

Historique : saisons 2023 à 2026 (2023/2024 à 2026/2027 pour Portugal, Pays-Bas et Arabie saoudite). 6 356 rencontres comportent des statistiques réellement fournies. Les effectifs et statistiques individuelles concernent la saison courante ; les effectifs historiques complets ne sont pas importés. Le calendrier disponible dépend de la publication par ESPN.

Calendriers, scores, classements dérivés des rencontres de saison régulière, statistiques d'équipes, confrontations, effectifs et statistiques de saison des joueurs, probabilités et Elo sont intégrés aux écrans existants. Les rencontres de playoffs sont conservées dans l'historique sans modifier les classements de saison régulière. Le classement MLS est global, sans reproduction des conférences ni des décisions disciplinaires officielles. Les matchs All-Star sont exclus. Les clubs canadiens de MLS conservent leur pays réel.

Cinq logos de compétitions et 132 écussons de clubs sont servis localement. Les sources sont consignées avec les images. Le dernier club historique sans écusson fourni conserve le fallback existant. ESPN est un fournisseur distinct : les conditions ESPN s'appliquent, sans attribution CC0. Les valeurs absentes (xG, xA, certaines compositions, blessures, notes ou statistiques individuelles) restent indisponibles. Aucun direct garanti ni données inventées.

## Synchronisation et installation

Le worker existant et les endpoints cron protégés prennent en charge les nouvelles compétitions. Calendriers courants : cache 6 heures ; anciennes saisons : 30 jours ; effectifs : 24 heures. Les profils sont traités par lots avec couverture des cinq ligues. Verrou partagé, validation des réponses, identités stables et conservation des données existantes en cas d'erreur. L'absence de clé API-Football n'empêche pas ces imports.

Après migrations et configuration PostgreSQL, pour initialiser une autre base :

```bash
node --env-file-if-exists=.env --conditions=react-server --import tsx scripts/football.ts expanded-import
node --env-file-if-exists=.env --conditions=react-server --import tsx scripts/football.ts expanded-players
```

Répéter la deuxième commande jusqu'à `remaining: 0` avec zéro échec. Puis `npm run football:worker` pour le processus continu, ou utiliser les cron existants et configurés sur l'hébergeur. En environnement avec proxy, utiliser `NODE_USE_ENV_PROXY=1` et autoriser `site.api.espn.com`. Le worker configuré n'est pas une preuve d'exécution sur Vercel.

La base cloud contient les données importées, mais Git ne transfère pas PostgreSQL. Le déploiement public et son import doivent être vérifiés séparément. Aucun secret ni dump de données personnelles n'est commité.

## Vérifications

- Typecheck et tests unitaires : PASS, 180 tests sur 32 fichiers. Lint : PASS avec un avertissement préexistant dans `opengraph-image.tsx`.
- Tests PostgreSQL isolés existants et DB/UI : PASS. Nouveau contrat ESPN : PASS (quatre saisons, cache, réimport sans doublon, statistiques, erreurs, verrou, pays partagé et relations de clubs).
- Sécurité : PASS, 14 contrôles ciblés.
- Tests navigateur complets : 36 PASS, 2 cas conditionnels ignorés (accueil vide inapplicable quand des matchs existent).
- Vérification des cinq compétitions : 50 vues sur 390 et 1 440 px, compétitions actuelles et anciennes saisons, équipes, joueurs et statistiques de matchs : PASS. Images chargées, absence de débordement horizontal et d'erreur JavaScript. Pagination et recherche de joueurs : PASS.

## SEO POST-MODIFICATION

Résultats de l'audit local en mode production et validation finale consignés ci-dessous. Les previews restent noindex avec sitemap vide. Aucun changement du domaine canonique ou de l'identité légale.

Audit de production local : 8 610 pages vérifiées (dont les 8 599 URL du sitemap), 111 953 contrôles, zéro FAIL, 12 vues navigateur avec axe WCAG A/AA. Après un crash du navigateur lié au volume de l'audit, les contrôles enregistrés ont été conservés et les pages restantes vérifiées sur le même build, avec renouvellement des contextes. Les assertions de pages, métadonnées et contrats globaux sont conservées.

58 310 liens découverts : les chemins déjà audités sont réutilisés et 3 136 chemins supplémentaires vérifiés, sans lien cassé ni redirection. Les dizaines de milliers de combinaisons de query/onglets ne sont pas toutes demandées individuellement : canonical et onglets sont couverts par les contrats globaux et les tests UI ciblés. Cette adaptation est explicitement consignée dans le rapport local ; elle ne vaut pas une vérification HTTP exhaustive de chaque variante.

L'unique WARNING de budget HTML concernait le comparateur joueurs (1 880 181 octets). Correction : seules les deux fiches sélectionnées et un index léger de sélection sont envoyés ; les statistiques réelles sont conservées. Sur le dernier build, la comparaison Cristiano Ronaldo / Lionel Messi produit 353 780 octets. Vérification à 390 et 1 440 px : statistiques conformes à la base, recherche et changement de joueur effectifs, zéro erreur JavaScript, zéro débordement et zéro violation axe WCAG A/AA. Douze tests de navigation supplémentaires passent sur le build final. Les pages indexables et leur politique SEO ne changent pas dans cette dernière correction.

| Critère | Statut | Preuve / limite |
| --- | --- | --- |
| Build | PASS | Compilation de production finale et TypeScript |
| Indexation | PASS | Règles d'indexation auditées ; preview noindex |
| Metadata | PASS | Titles/descriptions uniques des pages indexables ; homonymes distingués par club |
| URLs | PASS | Toutes les URL du sitemap et chemins supplémentaires audités |
| Canonical | PASS | Domaine conservé ; contrôles de variantes filtrées |
| Sitemap | PASS | XML valide, URL uniques, pages reliées par des liens crawlables |
| Robots | PASS | Production accessible aux robots ; preview bloquée |
| Maillage | WARNING | Chemins vérifiés sans lien cassé ; toutes les variantes de query non demandées individuellement |
| Images | PASS | Logos locaux chargés et images de partage accessibles |
| Mobile | PASS | 50 vues des nouvelles compétitions, 12 vues globales et comparateur ciblé |
| Performance | WARNING | Budget HTML corrigé ; aucun CWV terrain mesuré |
| Structured Data | PASS | Contrôles JSON-LD locaux ; validation Google externe non effectuée |
| Erreurs techniques | PASS | Statuts, véritables 404, console et tests pertinents |

Le serveur cloud a été relancé sur `0.0.0.0:3000` avec le build preview. Huit routes, dont les cinq compétitions, répondent HTTP 200 dans le navigateur ; metadata noindex et sitemap vide vérifiés. Le processus de synchronisation `npm run football:worker` a également été démarré.

Rapports détaillés conservés dans le workspace ignoré par Git : `.local/seo-expanded-complete.json`, `.local/expanded-ui-results.json`, `.local/expanded-comparator-results.json`. Le premier conserve l'avertissement de l'ancien comparateur ; le dernier atteste la correction mesurée.

Déploiement public, TLS/redirections publiques, Search Console, PageSpeed Insights, CrUX et Rich Results Test : **NON VÉRIFIÉ EXTERNEMENT**. Les mesures locales ne constituent pas des Core Web Vitals terrain.
