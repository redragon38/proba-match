# Initialisation des compétitions sur Vercel

Le 3 octobre 2026, le commit `6bd5477` était déployé avec succès sur Vercel, mais `https://proba-match.vercel.app/competitions` ne contenait aucune des cinq nouvelles compétitions. Le cloud local répondait avec les dix compétitions. Cause vérifiée : le déploiement du code n'avait pas initialisé les données de la base utilisée par le site public.

Correction : le hook npm `postbuild` initialise les données manquantes uniquement lorsque `VERCEL_ENV=production`. Il utilise la connexion PostgreSQL déjà configurée dans le contexte de build Vercel. Les previews, builds locaux et CI ne se connectent pas à la base via ce hook. Aucun endpoint public non authentifié n'est ajouté ; aucun secret n'est ajouté au dépôt.

L'initialisation conserve les imports et identités existants, complète les quatre saisons ESPN des cinq compétitions, puis les effectifs par lots de 30 clubs. Un corpus déjà initialisé est vérifié sans téléchargement ni réimport. Les échecs ou verrous empêchent de déclarer une initialisation réussie ; les données déjà persistées restent disponibles pour une reprise au déploiement suivant. Les rafraîchissements ultérieurs utilisent les crons et worker existants.

Cette première initialisation ajoute du temps au build de production. Elle nécessite `DATABASE_URL` disponible au build et l'accès réseau à `site.api.espn.com`. Elle écrit les données importées dans la base de production, sans suppression du corpus existant et sans changement de schéma.

Validation locale : typecheck PASS ; lint PASS avec l'avertissement préexistant `opengraph-image.tsx` ; 190 tests sur 33 fichiers PASS. Les dix nouveaux tests couvrent le garde production, les données déjà prêtes, les saisons/plusieurs lots manquants, la reprise après réponse partielle ou erreur de persistance et les échecs bornés. Le hook réel, exécuté avec le garde production contre la base cloud déjà complète, répond `READY` sans réimport.

## SEO POST-MODIFICATION

Les routes, composants et métadonnées ne sont pas modifiés. Les contrats SEO des nouvelles données sont couverts par [l'audit précédent](EXPANDED-LEAGUES-AUDIT.md). Le build local optimisé et son hook preview sont PASS (`SKIPPED`, sans import). Le contrôle réel du hook sur la base cloud complète est PASS (`READY`, sans réimport). L'import ajoute les routes liées aux nouvelles données conformément à `indexablePaths`, sans modifier la politique d'indexation.

## Résultat sur le site public

Le premier déploiement d'initialisation (`b78a15b`) a importé les compétitions et une partie des effectifs, puis a échoué. Les journaux privés Vercel nécessitent un jeton absent de cette session (réponse API 403) ; la cause détaillée de cet arrêt n'est donc pas affirmée. Le garde d'initialisation a été corrigé pour reprendre les sources/saisons manquantes sur trois tentatives et les joueurs sur huit lots maximum, avec cinq secondes de pause après un échec. Aucun lot déjà enregistré n'est réimporté tant que son cache est valide ; une réussite exige les contrôles de persistance complets.

Déploiement Vercel du commit `ec9e99b` : **SUCCESS**, environnement Production, deployment GitHub `6828166524`. Le domaine réel `https://proba-match.vercel.app` contient désormais les dix compétitions. Son catalogue retourne 3 995 joueurs au contrôle, dont Lionel Messi en MLS et Cristiano Ronaldo en Arabie saoudite.

Vérification directe dans Chromium du domaine public : **30 vues PASS**, dont les cinq compétitions à 390 et 1 440 px, puis une équipe, un joueur, un match terminé avec onglet statistiques et la saison 2023 de chaque ligue. Les quatre saisons sont proposées, les liens sont réels et répondent HTTP 200, les cinq logos sont chargés. Les pages de compétitions passent axe WCAG A/AA, sans erreur JavaScript ni débordement horizontal. Le proxy HTTPS du cloud nécessite `ignoreHTTPSErrors` dans Chromium ; les requêtes HTTPS curl/Python utilisent leur magasin de confiance normal. Cette vérification navigateur n'est pas un audit indépendant du certificat TLS public.

Robots public : `Allow: /`, restriction `/api/`, référence au sitemap canonique. Sitemap public : **8 637 URL uniques**, toutes sur le domaine canonique, incluant les cinq nouvelles compétitions. Il ne s'agit pas d'un crawl HTTP exhaustif de ces 8 637 URL publiques ; le crawl exhaustif local des données étendues reste documenté dans le rapport précédent.

| SEO POST-MODIFICATION | Statut | Portée |
| --- | --- | --- |
| Build | PASS | Build optimisé, postbuild preview et déploiement Vercel réussi |
| Indexation | PASS | Politique locale précédente ; compétitions présentes dans le sitemap public |
| Metadata | PASS | Contrats locaux précédents ; mêmes templates conservés |
| URLs | PASS | Trente vues publiques et liens réels vérifiés |
| Canonical | PASS | Les cinq compétitions ont le domaine canonique attendu |
| Sitemap | PASS | XML public, unicité, domaine et cinq nouvelles compétitions |
| Robots | PASS | Règles publiques lues directement |
| Maillage | PASS | Liens vers équipes, joueurs, matchs et saisons testés ; pas de nouveau crawl public exhaustif |
| Images | PASS | Les cinq logos publics chargés |
| Mobile | PASS | Cinq compétitions à 390 px, sans débordement ni violations axe |
| Performance | NON TESTÉ | Pas de nouvelle mesure publique de performance ni de CWV terrain |
| Structured Data | PASS | Contrats locaux précédents, templates inchangés ; Rich Results Test externe NON TESTÉ |
| Erreurs techniques | PASS | Vues publiques HTTP 200 et console des compétitions sans erreur |

Les contrôles GitHub Actions `quality` et `database-ui` échouaient déjà sur le commit antérieur `6bd5477` et échouent aussi sur `b78a15b` (respectivement aux étapes e2e et DB/UI). Ils ne sont pas présentés comme validés par cette correction. Les tests locaux et l'état du déploiement Vercel sont rapportés séparément.

Preuves détaillées conservées hors Git : `.local/public-expanded-results.json` et `.local/public-expanded-competitions.png`. Les futurs rafraîchissements continuent d'utiliser les crons et le worker configurés.
