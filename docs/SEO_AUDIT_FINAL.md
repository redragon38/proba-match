# Audit SEO et fiabilité — Proba Match, 21 octobre 2026, cycle 2

Suite du 22 octobre : les adaptations du VPS sont maintenant reçues et réconciliées. Ce rapport conserve les mesures de son candidat d’origine ; voir [la livraison VPS](VPS_DEPLOYMENT_2026-10-22.md) et artifacts/vps-reconciliation-validation.json pour la nouvelle fusion.

Rapport finalisé le 22 octobre 2026 ; captures publiques du 21 octobre.

État : code livré sur main, SHA 43850598cf0162fe7606f4d4483ad877a615d9af. Validation locale et GitHub Actions réussie. Déploiement VPS non confirmé.
L'audit précédent est conservé dans `SEO_AUDIT_2026-10-21_CYCLE1.md`. Ses résultats ne remplacent pas les validations de ce cycle.

## Périmètre et architecture

Next.js 16.3.8, React 19, TypeScript 5.9, App Router, composants serveur/client, Prisma 6.19.3 et PostgreSQL. Sources existantes : OpenFootball, ESPN, FotMob et API-Football facultatif avec quotas. Le moteur Elo–Poisson, les archives immuables, les abstentions et les URL existantes sont conservés.
Le cache combine révision PostgreSQL, cache mémoire, réponses HTTP et, sur le VPS, Nginx/Caddy. Les tâches du VPS passent par un worker séparé et un ordonnanceur Docker. Aucun changement de technologie, migration de schéma, service payant ou réinitialisation de production.

Variables nécessaires selon le déploiement : `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`, `ADMIN_SECRET`; `USE_AIVEN_DATABASE`/`AIVEN_DATABASE_URL` si activés; `FOOTBALL_API_KEY` facultatif; sélections des ligues/fournisseurs existantes. Aucune valeur secrète n'est incluse dans ce rapport.

## Pourquoi des corrections précédentes paraissent absentes

La copie du VPS n'est pas identique à `main` : le statut Git transmis dans cette conversation liste 37 fichiers suivis modifiés et plusieurs services non suivis, dont `performance-view`, `home-predictions`, `prediction-history` et un moniteur SEO. L'archive `/home/ubuntu/proba-match-vps-review.tar.gz`, créée par l'utilisateur, n'a pas été transférée dans ce workspace. Aucun accès SSH, DB ou logs privés du VPS n'est disponible.

Il serait incorrect d'écraser cette copie ou d'attribuer au code de `main` tous les comportements de production. Aucun `reset --hard`, nettoyage destructif, suppression de données ni écrasement des adaptations VPS n'a été effectué. La variante publique légère du bilan est cohérente avec des modifications locales possibles, mais leur implémentation exacte n'est pas connue.

L'API GitHub confirme aussi `default_branch: master`. Les nouveaux workflows de surveillance placés sur `main` ne deviennent pas automatiquement des tâches planifiées de la branche par défaut. Le connecteur ne propose pas la modification de ce réglage ; le navigateur intégré n'a pas de session GitHub connectée et affiche la page Settings inaccessible. Cette action reste à faire dans les réglages du dépôt. L'authentification OIDC était limitée à `master`; elle accepte désormais `main` et `master`, avec signature, audience, dépôt, expiration et branche du workflow vérifiés.

La configuration GitHub/Vercel et le déploiement Docker sur VPS sont des circuits distincts. Le statut Vercel en échec du cycle précédent ne prouve pas un échec de Docker. Le statut du code livré a été relevé : GitHub Actions réussit, Vercel échoue avec le lien officiel de compte bloqué. Aucun déploiement n’est déduit d’un simple push.

### Rafraîchissement après publication d’un import

Le test PostgreSQL/UI révèle aussi un défaut applicatif : après un import réussi à 19:43:37 UTC, le navigateur garde le catalogue de 19:43:22 malgré une réponse RSC HTTP 200 ; une requête HTML fraîche contient pourtant la nouvelle rencontre. Le cache du marqueur de révision accepte encore une valeur expirée pendant vingt secondes après dix secondes de TTL. Un rafraîchissement déclenché par la nouvelle révision peut ainsi récupérer l’ancien snapshot et attendre le cycle suivant.

Le retrait de la seule fenêtre périmée n’a pas suffi : le TTL de dix secondes pouvait encore masquer un import publié entre deux requêtes. La correction finale ne conserve plus le marqueur entre les requêtes. Elle lit la petite ligne SQL indexée à chaque demande, mutualise les demandes simultanées et conserve le cache long du corpus complet par version. Le coût est une petite vérification SQL par requête, sans transfert du corpus quand la version ne change pas ; les mesures du VPS restent à relever après déploiement. En cas de panne, la dernière version est conservée et explicitement dégradée. Deux tests de régression couvrent attente/concurrence/nouvelle révision et repli sur panne. La validation finale passe : 427 tests / 79 fichiers, TypeScript, lint, build et intégration PostgreSQL/UI. Le test vérifie réellement la nouvelle rencontre et son changement d’horaire sans rechargement manuel. Le défaut n’est pas masqué par une augmentation des délais. Preuve : artifacts/seo-mission2-cache-refresh-diagnostic.json.

## Constats publics initiaux

Les captures exactes et mesures sont conservées dans `artifacts/seo-mission2-initial-probe.json`.
Les routes `/`, `/matchs`, `/live`, `/competitions`, `/equipes`, `/joueurs`, `/classements`, `/analyses`, `/comparateur/equipes`, `/methodologie`, `/comprendre-probabilites`, `/lexique-football`, `/bilan-predictions`, `/robots.txt`, `/sitemap.xml` et la fiche Levante–Athletic répondent HTTP 200 lors de la sonde initiale. `/api/health` exige une authentification et renvoie 401 sans secret : ce n'est pas une panne démontrée.

Le catalogue public annonce `updatedAt: 2026-10-21T07:56:16.330Z` pendant la sonde, alors que `/api/updates` indique une révision de cache plus récente. Une révision de cache n'est pas une preuve d'import réussi de tous les résultats. L'avertissement de retard est réellement présent. Son origine opérationnelle exacte exige les logs privés ; les défauts de code ci-dessous sont, eux, confirmés.

### Résultats manquants : preuve de source, pas inférence temporelle

Sur les cinq rencontres renvoyées pour le 19 octobre, trois restent `scheduled` sans score. Les fichiers OpenFootball consultés n'ont effectivement pas encore de score pour ces trois rencontres. Une réponse FotMob HTTP 200 du 21 octobre, dont le marqueur final est explicitement `FT`, confirme :

| Match local | Rencontre | Score confirmé par FotMob |
| --- | --- | --- |
| `86ab7308-f693-8414-9eb5-41294b67428d` | Getafe CF – Rayo Vallecano de Madrid | 1–1 |
| `1b6eb14f-33d7-88f9-b5ac-480c87800d9f` | AC Monza – Cagliari Calcio | 4–0 |
| `17800367-d6b6-8ce6-918b-16159151bf62` | Parma Calcio 1913 – Torino FC | 0–3 |

Preuves : `seo-mission2-source-comparison.json`, `seo-mission2-fotmob-comparison.json`, `seo-mission2-past-matches.json`. Les URL sources et dates d'observation y figurent. Ces scores ne sont pas inscrits manuellement en production : ils servent aux tests de non-régression et seront importés par le flux normal après déploiement, si la source les confirme encore.

## Correctifs de synchronisation

- Bail : renouvellement par une connexion Prisma dédiée sur VPS comme sur Vercel, une seule requête de renouvellement à la fois, libération/fermeture garantie. La perte du bail interdit la publication. Ce risque de famine de pool est confirmé dans le code, sans prétendre que les logs du VPS en prouvent l'occurrence.
- Retours cron : un résultat partiel/échoué, même imbriqué, renvoie HTTP 503 et `no-store`, au lieu d'être déclaré réussi par HTTP 200. Les erreurs restent génériques publiquement ; codes sûrs, source, compteurs et durée sont journalisés.
- OpenFootball/ESPN : deux reprises au maximum, backoff, timeout, respect de `Retry-After`, arrêt sur erreurs permanentes. Un délai fournisseur supérieur à 30 secondes attend le prochain job plutôt que d'être ignoré. Les requêtes réellement tentées sont comptées. La réservation de quotas API-Football n'est pas modifiée.
- Le planning du dépôt importait une fois par jour, malgré une échéance de fraîcheur de six heures. L'import principal est désormais prévu toutes les six heures. C'est une correction du planning versionné, pas la preuve que le planning réellement installé sur le VPS a changé.
- Le mode rapide FotMob ne reprenait que les huit dernières heures : une rencontre manquée sortait de sa fenêtre. Le rattrapage quotidien existant reprend désormais les sept derniers jours, avec dix dates UTC au maximum, une requête de listing par date, un rythme limité, aucune concurrence non bornée.
- Trois alias exacts, vérifiés sur les réponses réelles, réparent l'association de noms. L'horaire et les deux équipes doivent toujours correspondre et le candidat être unique. Aucun rapprochement approximatif n'est ajouté.
- Les nouveaux résultats portent leur vraie source FotMob et leurs révisions d'observation. Le marqueur explicite `FT` certifie le résultat réglementaire ; un statut final sans période claire ne fabrique pas un score à 90 minutes. Les matchs reportés/annulés ne sont pas sélectionnés comme résultats à terminer.
- OpenFootball ne rétrograde plus un résultat enrichi confirmé en calendrier programmé, et préserve sa période/son détail de score. Un résultat réglementaire confirmé ultérieurement peut enrichir une période jusque-là inconnue.
- Après réception d'un résultat final : persistance, actualisation Elo et évaluation des seules prédictions déjà archivées. Aucun pronostic rétrospectif n'est créé. Les rencontres non associées rendent le résultat de synchronisation partiel.

Les tests avec les trois réponses réelles vérifient l'association, le résultat FT, la persistance déclenchée, le recalcul demandé et l'idempotence d'une seconde exécution. La couche de stockage du test est simulée ; cela ne constitue pas une écriture observée sur le VPS.

## Dates et probabilités

Les paramètres de date sont validés, les fuseaux invalides reviennent à Europe/Paris. L'interface distingue le jour actuel, le jour sélectionné, le calendrier complet et le fuseau d'affichage des horaires. Le calendrier non filtré garde toutes les dates ; une date explicite reste dans l'URL. Une horloge client suit le jour même sans nouvelle révision des données ; le rafraîchissement serveur au changement de jour respecte le filtre explicite. Les dates du bilan utilisent aussi Europe/Paris pour éviter un décalage SSR/navigateur près de minuit.

Tests : 23 h 59, minuit, changements d'heure été/hiver, validation calendaire, plusieurs fuseaux ; sur mobile/desktop, horloge contrôlée, changement de jour et requête RSC de rafraîchissement réellement observée sans changement du paramètre `date`.

La correction d'arrondi du cycle précédent est conservée. Le cas `/match/f851aa7b-6ca9-8a6f-882d-2c70049afe79` est vérifié avec les paramètres réellement publiés : `expectedHome=1.399692705313297`, `expectedAway=1.5366951694991`. Le score 1–0 vaut environ `0.074263540188123`, donc **7 %** dans les différentes sections. La somme de la distribution et celle du 1N2 sont vérifiées. Aucune probabilité n'est ajustée arbitrairement. Le formatage commun et la répartition entière du 1N2 restent en place. L'incohérence 8 %/7 % ne se reproduit pas dans la version publique observée.

Le rattrapage avait aussi un décalage d’un jour près des changements d’heure : le 26 octobre 2026 à 22:30 UTC moins sept jours donnait le 20 octobre au lieu du 19 ; le 23 mars à 22:30 UTC plus sept jours donnait le 31 mars au lieu du 30. La tâche utilise maintenant un instant de départ figé et une addition de jours civils parisiens, plutôt que de périodes de 24 heures en UTC. Les deux régressions sont testées. Preuve : seo-mission2-cron-dst.json.

## Bilan et performances

Le bilan public initial répond HTTP 200, en 52 011 octets, avec zéro prédiction initiale évaluée et 3 024 rencontres terminées non évaluables. Le qualifier actuellement de page démesurée serait un faux positif. Il n'est pas licite de reconstruire des prédictions après les matchs pour remplir ce bilan.

Le code de `main` présentait néanmoins un défaut de croissance : lecture Prisma de payloads complets (archives d'entraînement comprises), puis transmission de tout l'historique au composant client pour une pagination seulement visuelle.

La lecture publique utilise maintenant une projection PostgreSQL sans archives ni facteurs textuels, avec le résultat actuel confirmé et l'année réelle de la saison. La lecture des archives immuables n'est pas supprimée de la base. Une erreur SQL n'est plus remplacée silencieusement par un faux historique vide sur ce chemin public.

Les filtres, métriques, calibration, référence uniforme et regroupements sont calculés sur **toute** la sélection côté serveur. Seules vingt lignes d'historique et les équipes/matchs nécessaires à ces lignes sont transmis au client. Les contrôles de filtre et de pagination restent utilisables, avec état dans l'URL. Les saisons MLS/Brésil ne sont plus arbitrairement regroupées selon un mois de juillet européen. Les petits échantillons restent signalés.

Comparaison de sérialisation, sur les fixtures de test existantes, en retirant aussi les archives de la représentation ancienne pour une comparaison honnête :

| Mesure | Avant | Après |
| --- | ---: | ---: |
| Octets des props équivalentes | 799 359 | 37 699 |
| Évaluations globales utilisées | 217 | 217 |
| Lignes transmises pour la page | Tout l'historique | 20 |

Réduction observée sur ce test : 95,28 %. Ce n'est ni une mesure de gain sur le VPS, ni un score Lighthouse, ni un Core Web Vital terrain. Preuve : `seo-mission2-performance-benchmark.json`. La projection SQL est exécutée dans PGlite : jointures, score actuel et absence d'archives dans le résultat sont contrôlés.

Le crawl public complet couvre 6 635 pages, dont 1 227 dépassent le budget indicatif de 1 Mo de HTML ; le maximum atteint 2 887 462 octets. Les fiches sérialisent encore des détails historiques inutilisés. La projection des profils retire désormais ces compositions/performances historiques et les entités sans rapport, tout en conservant les scores, saisons, statistiques, effectifs, blessures, adversaires et détails du match consulté. Un test compare exactement le rendu HTML de la fiche équipe avant/après. Cette réduction de données ne prétend pas mesurer un gain sur le VPS. Le composant Web Vitals existant reste disponible selon sa configuration ; les agrégats privés et Search Console sont inaccessibles, tandis que PageSpeed n’affiche aucune donnée CrUX pour le domaine. INP et conformité au 75e percentile restent NON VÉRIFIÉS EXTERNEMENT.

## Classements, profils et contenu

Les corrections précédentes des saisons, compteurs et doublons sont conservées et repassent les tests. Les classements calculés restent présentés comme Proba Match, avec source, période, couverture, nombre de résultats et limites sur sanctions/départages. Un classement recalculé n'est pas transformé en classement officiel.

Les abstentions légitimes et les statistiques absentes ne sont pas remplacées par zéro ni par une estimation inventée. Les sections factuelles, liens d'équipes/compétitions, calendriers et résultats disponibles restent accessibles. Les profils de joueurs traduisent les nationalités connues. Le stade et l'entraîneur ne produisent plus une accumulation de champs vides dans l'en-tête d'équipe. Le périmètre saisonnier et les statistiques réellement présentes sont conservés.

Les pages de compétition possèdent déjà sélecteur de saison, résultats/calendrier, tableaux et couverture. Les guides, définitions, FAQ, méthodologie et liens de transparence existants sont vérifiés ; aucun contenu générique massif ni témoignage artificiel n'est ajouté. Les fiches pauvres ne sont pas désindexées en masse.

## SEO technique et exploration

Le sitemap initial est un XML valide : 5 030 URL uniques, toutes sous `https://proba-match.com`, 571 080 octets. Il est très inférieur aux limites de 50 000 URL et 50 Mo ; aucune segmentation artificielle n'est nécessaire. La politique `indexablePaths`, les dates de modification réelles et les URL existantes sont conservées.

Le robots.txt répond 200 et contient `Allow: /`, `Disallow: /api/`, ainsi que le sitemap canonique. Il ne bloque ni les pages importantes ni les ressources de rendu. Les 6 635 pages explorées répondent correctement et passent les contrôles de rendu sans JS, titres/descriptions uniques des pages indexables, H1, images et directives. Le crawl contient 96 598 contrôles. Les liens supplémentaires sont échantillonnés : 500 requêtes HEAD, aucun lien cassé ni redirection ; les 46 146 liens découverts ne sont donc pas tous individuellement vérifiés.

L'outil existant est amélioré : JSON et Markdown, filtre de priorité `SEO_PRIORITY`, budget HTML configurable `SEO_MAX_HTML_BYTES`, temps réseau hors délai volontaire du crawler, progression sauvegardée tous les 250 documents, état explicite d'audit incomplet. La taille élevée seule reste un avertissement. La surveillance réutilise une empreinte d'état, conservée dans le cache du workflow, et n'ajoute aucun envoi de messages ni service payant. Le JSON garde tous les contrôles même si le Markdown est filtré.

Concurrence de chaque crawler : une requête HTTP à la fois, pauses configurables, reprises bornées. Une passe publique complète et une passe ciblée sont exécutées séparément, sans test de charge. Les URL et éventuelles troncatures sont consignées dans leurs rapports.

Références de méthode : [Google — sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap?hl=en), [web.dev — Core Web Vitals](https://web.dev/articles/vitals). Les objectifs LCP/INP/CLS de terrain ne sont pas remplacés par les mesures locales.


### Résultats externes et données structurées

Le test Google sur la fiche Levante–Athletic publiée signale un SportsEvent invalide : lieu obligatoire absent. Le crawl retrouve 4 728 contrôles en échec pour cette même règle sur les pages publiques. Aucun lieu ni adresse ne doit être inventé. La fiche est une page d'information et publie maintenant un WebPage factuel, relié aux équipes et à la compétition, avec BreadcrumbList. Le helper événement interne conserve ses faits mais ne publie plus de statut Schema.org inexistant (EventCompleted/EventInProgress), ni isPartOf sur Event hors domaine.

La validation Google du **code candidat** produit un BreadcrumbList valide et aucun élément invalide. Il s'agit du mode CODE, pas d'une confirmation du déploiement sur l'URL. Preuves et liens : [test de l'URL publique](https://search.google.com/test/rich-results/result?id=NqRsPv6SR8hm1qWus6DEUw), [test du code corrigé](https://search.google.com/test/rich-results/result?id=x9kA_TByTWf8tzxCVx1-qw), artifacts/seo-mission2-google-rich-results.json.

[PageSpeed Insights public du 21 octobre, 21:01 Paris](https://pagespeed.web.dev/analysis/https-proba-match-com/ufl6ifmz63?form_factor=mobile), Lighthouse 13.5.0 : accueil mobile 100/100 en performance, accessibilité, bonnes pratiques et SEO ; FCP 1 051 ms, LCP 1 426 ms, TBT 0 ms, CLS 0. Ordinateur : mêmes quatre scores 100, FCP 327 ms, LCP 421 ms, TBT 64 ms, CLS 0. Ce sont les résultats du site déjà publié, avant ce déploiement, et d'une seule page. Le panneau terrain affiche « Aucune donnée ». Aucun INP ou p75 n'est inventé. Ces scores ne valident pas les données structurées des fiches de matchs.

Les redirections HTTP/www sont vérifiées en une étape vers HTTPS canonique ; /matchs/ renvoie 308 vers /matchs puis 200. Le contrôle de maillage initial contenait 270 faux candidats orphelins : il ignorait les href relatifs de pagination et certaines variantes avec paramètres. Le crawler est corrigé et testé. Le recalcul hors ligne de tous les liens capturés, en résolvant chaque lien depuis sa page et en conservant les paramètres, ne laisse aucun candidat orphelin. Le rapport brut est conservé sans falsification ; la preuve du recalcul est séparée.

L'ancien premier crawl interrompu après plus de 3 000 pages n'est pas compté. Le nouveau crawl reprend des checkpoints de 500 pages ; son rapport final porte completed:true et 6 635 pages. Les avertissements de poids et les SportsEvent publics restent visibles jusqu'au déploiement vérifié.

## Résultats finaux de validation

Code livré : [43850598](https://github.com/redragon38/proba-match/commit/43850598cf0162fe7606f4d4483ad877a615d9af), sur main. Base du cycle : 46210153. **65 fichiers de code, configuration et tests** modifiés, hors documents/preuves ; liste exacte dans artifacts/seo-mission2-changed-files.json.

- **npm run check : PASS**, TypeScript, lint zéro erreur/deux avertissements Open Graph img préexistants, **427 tests / 79 fichiers**, build de production. Preuve locale : artifacts/seo-mission2-check-delivery.log.
- **[GitHub Actions final](https://github.com/redragon38/proba-match/actions/runs/39669708252) : deux jobs PASS**, quality et database-ui. Même total de 427 unités ; **74 E2E réussis**, deux ignorés car les fixtures ont déjà des matchs aujourd’hui (scénario de journée vide, desktop/mobile). Aucun ignoré n’est compté comme réussi.
- **PostgreSQL/UI réel isolé : PASS**. Sources de test contrôlées, deux imports automatiques sur horloge accélérée, persistance/idempotence, reprise de bail après échec, score/minute/événements/statistiques/compositions, blessures/rétablissement, résultat final/classement, quota/panne, apparition automatique d’une nouvelle rencontre, décalage d’horaire, profils à 320/390/1440 px et administration/état du worker. Ce n’est pas un test de l’ordonnanceur ni de la base du VPS.
- **SEO du build final : 600 pages, 9 599 contrôles, 20 vues navigateur, zéro échec**, aucun lien cassé/redirection ni orphelin du sitemap. Seul avertissement : jeton de santé authentifiée absent. Le corpus est synthétique et isolé. Preuve : artifacts/seo-mission2-ci-quality.json.
- Premières passes locales complémentaires : 20 E2E desktop/mobile et 18 contrôles HTTP sécurité réussis ; SEO sans DB de 24 pages/303 contrôles/16 vues sans échec. Ces périmètres précédaient certains derniers ajustements et ne remplacent pas la CI finale.
- **Public avant déploiement : 6 635 pages, 96 598 contrôles, 20 vues**. Les 4 728 échecs Event et 1 227 avertissements de poids restent ceux de l’ancienne version publiée. Aucun lien cassé sur les 500 liens supplémentaires vérifiés ; les 46 146 liens découverts ne sont pas tous individuellement sondés. Zéro orphelin après recalcul correct des liens relatifs. Rapports bruts conservés, sans les réécrire comme s’ils validaient le candidat.
- **Google Rich Results : URL publique FAIL, code candidat PASS**. **PageSpeed accueil mobile/ordinateur : quatre scores 100 mesurés**, avant déploiement du candidat ; aucune donnée terrain disponible. Les liens et métriques exacts figurent plus haut et dans les preuves JSON.
- **Déploiement : NON CONFIRMÉ**. Le statut Vercel du code livré est failure avec le lien officiel de compte bloqué ; il ne prouve pas un échec de Docker sur VPS. Santé authentifiée, logs/DB/SSH du VPS, Search Console et CWV terrain restent NON VÉRIFIÉS EXTERNEMENT.

### Échecs intermédiaires et vérification de leurs corrections

Une première suite Vitest non bornée a épuisé la mémoire ; un worker et un délai de 30 s permettent maintenant la suite complète, sans retirer d’assertion. Un test de rendu a détecté la perte des buteurs après retrait d’événements historiques : les événements ont été conservés, puis les rendus équipe et sept onglets de match passent à l’identique.

Le test DB/UI exigeait initialement HTTP 200 d’un import externe sur une fixture sans identité réelle, alors que les imports partiels renvoient correctement 503. L’autorisation réussie est désormais vérifiée sur un traitement interne déterministe. Les attentes instantanées de cache ont ensuite révélé le vrai marqueur ancien ; le retrait de son TTL, testé même après 1 ms, corrige le scénario complet. Enfin, le serveur isolé n’avait pas d’origine publique et refusait correctement la session admin : la CI configure localhost:3001, sans modifier les protections de production. Historique exact : seo-mission2-ci-attempts.json ; diagnostic serveur/navigateur séparé.

Le contrôle automatique a refusé les démarrages locaux finaux, avec pour seul motif « blocked by policy ». Aucun contournement : le PostgreSQL et le serveur de production de la CI existante ont fourni l’intégration complète autorisée. Le cluster local lancé pour l’audit est arrêté proprement ; aucune base de production n’a été touchée.

## SEO POST-MODIFICATION

| Domaine | État | Preuve / limite |
| --- | --- | --- |
| Build | PASS | 427 unités, TypeScript, lint et build ; CI verte |
| Indexation | PASS directives / NON TESTÉ Google | 6 635 documents publics ; Search Console inaccessible |
| Metadata, URLs, Canonical | PASS | Public complet et build final isolé |
| Sitemap, Robots | PASS | 5 030 URL publiques uniques, XML/cibles/règles ; contrats CI |
| Maillage | PASS périmètre / WARNING exhaustivité | Zéro orphelin recalculé ; 500 HEAD supplémentaires, pas les 46 146 variantes |
| Images | PASS contrôles automatiques | Attributs, ressources et vues navigateur ; aucune nouvelle image inventée |
| Structured Data | PASS candidat / FAIL version publique | Google CODE valide ; ancien Event public sans lieu vérifié, déploiement à contrôler |
| Mobile | PASS ciblé | 74 E2E, 20 vues SEO/axe, profils DB à 320/390/1440 px |
| Performance | WARNING | PSI accueil 100 mesuré, props bilan réduites de 95,28 % sur fixture ; poids VPS après déploiement et INP terrain inconnus |
| Erreurs techniques | PASS isolé / WARNING production | DB/UI et reprise validés ; authentification santé/logs/version VPS non vérifiés |

## Interventions encore nécessaires hors du workspace

1. Récupérer l’archive /home/ubuntu/proba-match-vps-review.tar.gz et réconcilier les modifications du VPS avant déploiement. La commande tar transmise couvre src/tests/scripts/package.json et le patch, mais pas Caddyfile, compose.production.yml, ops/vps-crontab ni .dockerignore : sauvegarde et revue séparées nécessaires. Préserver les secrets dans un espace privé ; aucun reset/clean/stash automatique du serveur.
2. Déployer après réconciliation, reconstruire l’ordonnanceur pour le crontab modifié, observer les logs et lancer le rattrapage authentifié normal. Confirmer la persistance réelle des trois résultats et la fraîcheur. Ne pas remplacer l’absence de source par un score ou un backtest inventé.
3. Choisir main comme branche par défaut GitHub ou maintenir explicitement le workflow sur la branche choisie. Le réglage observé reste master ; une configuration planifiée n’est pas une exécution réelle observée.
4. Vérifier le SHA réellement déployé, refaire l’audit public et Google en mode URL, mesurer les fiches allégées, consulter Search Console et les CWV terrain avec les accès disponibles.

## Traçabilité

L’audit précédent est conservé séparément. Les résultats de ce cycle ne réutilisent pas ses succès. Les preuves durables portent le préfixe seo-mission2 ; le rapport public complet est compressé, avec synthèse lisible et recalcul de maillage distinct. Les captures brutes locales restent dans .local/mission2. Le code et les tests sont publiés sans force-push ; la documentation et les preuves suivent dans un commit séparé, sans modification du code validé.

Le contrôle public après publication répond HTTP 200 sur l’accueil, les matchs, le bilan, les compétitions, les équipes, les joueurs et la fiche cible. Cette fiche contient encore SportsEvent : le déploiement du correctif n’est pas confirmé. Aucun succès de CI ou de push ne vaut preuve de déploiement du VPS.
