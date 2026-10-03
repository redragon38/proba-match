# RAPPORT CORRECTION PROBA MATCH

État vérifié le 3 octobre 2026 dans `/workspace/proba-match`, à partir du commit réel `f53cc0c` de `redragon38/proba-match`, branche distante `master`. Le projet existant est conservé ; le cloud ne constitue pas une installation sur le PC Windows.

## Score initial et score final

**Score initial : 82/100, communiqué par l’utilisateur.** Le barème, les pondérations et les 19 notes initiales ne figurent pas dans les rapports du repository. Une demande de ces éléments est restée sans réponse. **Score final comparable : non calculable**, plutôt qu’une note inventée. Les gains ci-dessous sont des corrections démontrées ; ils ne peuvent pas être traduits honnêtement en points du précédent audit. Aucun 100/100 n’est revendiqué.

## Tableau avant / après

N/D signifie « non disponible dans le barème précédent », et non zéro. La confiance porte sur les contrôles décrits, pas sur une garantie exhaustive.

| Catégorie | Avant | Après | Gain | Confiance et justification |
|---|---:|---:|---:|---|
| Design | N/D | N/D | N/D | Élevée pour la non-régression : identité conservée, vues sombre/clair, typographie secondaire portée à 12 px. |
| UX | N/D | N/D | N/D | Élevée : parcours critiques, états vides et recherche en erreur testés ; détails des matchs conservés dans leurs onglets. |
| Mobile | N/D | N/D | N/D | Élevée en Chromium : navigation et favori ; appareils physiques non testés. |
| Responsive | N/D | N/D | N/D | Élevée : 210 vues de 320 à 1440 px, sans débordement. |
| Fluidité | N/D | N/D | N/D | Moyenne : interactions et absence d’erreurs d’hydratation vérifiées ; INP terrain inconnu. |
| Performance | N/D | N/D | N/D | Moyenne : mesures locales p50/p95, cache instrumenté ; capacité publique et CrUX inconnus. |
| SEO technique | N/D | N/D | N/D | Élevée localement : 8 504 pages, 119 040 contrôles et 49 070 liens supplémentaires sans erreur. Indexation Google non vérifiée. |
| Contenu SEO | N/D | N/D | N/D | Moyenne : contenu réel, protections des pages faibles et métadonnées vérifiées ; pertinence éditoriale et classement non certifiés. |
| Accessibilité | N/D | N/D | N/D | Moyenne : 32 vues axe supplémentaires sans violation, clavier et reflow 320/640 px testés ; lecteur d’écran et zoom physique restent à faire. |
| Sécurité | N/D | N/D | N/D | Moyenne : 14 contrôles HTTP, authentification, CSP et limiters PostgreSQL concurrents ; scripts inline Next.js encore autorisés. |
| Matchs | N/D | N/D | N/D | Élevée pour les contrats : 14 317 matchs validés, relations/statuts/scores ; exactitude éditoriale des sources non garantie. |
| Statistiques | N/D | N/D | N/D | Élevée pour null/0 et relations : correction des blocs ESPN entièrement vides, sans inventer de statistique. |
| Joueurs | N/D | N/D | N/D | Moyenne : 3 994 joueurs contrôlés, 20 photos sur 20 valides ; toutes les photos et les transferts ne sont pas certifiés. |
| Probabilités | N/D | N/D | N/D | Élevée pour la non-régression : moteur conservé, calcul chronométré et présentation E2E vérifiée ; aucun résultat sportif garanti. |
| Navigation | N/D | N/D | N/D | Élevée : parcours match/équipe/joueur, mobile, favoris et liens internes testés. |
| Recherche | N/D | N/D | N/D | Élevée : accents conservés, fautes simples tolérées et recherche vide/en erreur testée. |
| Cohérence données | N/D | N/D | N/D | Élevée sur les règles automatisées : zéro échec et zéro avertissement dans le corpus local ; couverture des providers explicitée. |
| Qualité technique | N/D | N/D | N/D | Élevée localement : typecheck, lint, 204 tests, build et contrats DB/UI ; exécution CI distante à confirmer après push. |
| Préparation production | N/D | N/D | N/D | Moyenne : import séparé, health protégé et runbook ; identité légale, exploitation et métriques externes restent nécessaires. |

## Corrections réalisées

- Suppression du `postbuild` important les données. `npm run build` construit seulement l’application. `npm run football:initialize` réutilise l’initialisation idempotente, les retries bornés et les jobs existants. Commande manuelle exécutée : état READY. Le build final passe avec une URL PostgreSQL volontairement inaccessible et sans clé fournisseur.
- Configuration légale centralisée dans `src/lib/legal.ts` et `.env.example`. Les champs absents sont signalés comme informations non fournies ; aucune identité ou adresse n’a été fabriquée. Notices de sources et de collecte optionnelle actualisées.
- CI avec PostgreSQL, secrets exclusivement de test et fixtures isolées déterministes. Réparation des hypothèses E2E erronées sur les compositions, les logos et les fournisseurs. Correction de l’auditeur ajoutant deux fois le match du jour déjà présent dans le sitemap : unicité vérifiée entre URLs distinctes. Pas de `continue-on-error`.
- CSP couvrant les directives demandées, origines d’images explicites, absence de `unsafe-eval` en production, HSTS et upgrade HTTPS réservés à la production HTTPS. Les scripts et styles inline restent nécessaires à l’architecture actuelle.
- Réutilisation du limiter admin PostgreSQL ; collecteur Web Vitals optionnel également limité dans PostgreSQL. Vérification concurrente de 20 tentatives admin et 65 envois métriques dans une base jetable, sans toucher aux utilisateurs.
- Observabilité bornée des API importantes, DB, cache, transports fournisseurs et calcul des prédictions : durées, p50/p95, erreurs, logs lents structurés sans secret ni requête utilisateur. Compteurs en mémoire limités au processus courant, non présentés comme des métriques globales distribuées.
- Health check authentifié : fraîcheur réelle, providers, derniers jobs, dernière réussite/erreur, éléments importés, durée, seuils de retard/échecs/cache/API lente. Les statistiques des jobs portent sur les 50 derniers runs, sans prétendre couvrir tout l’historique.
- Health allégé après une lenteur mesurée : PostgreSQL renvoie uniquement date de révision et présence de résultats en retard, sans transférer le snapshot joueurs/matchs. Dix scénarios SQL isolés valident les délais stricts 6 h/24 h, les horaires inconnus, les résultats finis et les sources secondaires. Dix lectures locales alternées : p50/p95 **655/852 ms** pour l’ancien payload complet, **86/105 ms** pour la projection. Dix requêtes health authentifiées à chaud : **88/148 ms**, zéro erreur. Les alertes métier restent visibles.
- Administration : colonnes fournisseur, durée et éléments importés. Les joueurs importés ne sont plus comptés sous une étiquette trompeuse « matchs ».
- Validateur en lecture seule des joueurs, matchs, statistiques, relations, IDs externes, valeurs numériques et dates. Alias `data:validate-players`, `data:validate-matches`, `data:validate-stats`. Photos : échantillon optionnel borné, sans parcourir toutes les ressources externes.
- Correction de 115 blocs statistiques historiques ESPN présentant une possession 0–0 avec toutes les valeurs à zéro : traités comme données indisponibles à la lecture et lors des nouveaux imports. Les zéros réellement rapportés restent des zéros ; aucune migration destructive.
- Recherche tolérant une faute simple en repli lorsque la recherche normale ne trouve rien ; limitation des recherches floues aux petits catalogues plutôt qu’aux milliers de matchs.
- Textes secondaires CSS auparavant à 5–11 px portés à 12 px, avec libellés SVG portés à 12 unités dans les styles concernés, sans refonte du design ni suppression de fonctionnalités.
- Collecteur first-party LCP/INP/CLS/FCP/TTFB, désactivé par défaut. Envoie uniquement nom/valeur, sans URL, identifiant utilisateur ou cookie. Validation stricte, taille bornée, origine vérifiée et limiter distribué. Ce mécanisme ne constitue pas des données CrUX ni une base analytique durable.
- Audit SEO complet allégé en mémoire : analyse du véritable HTML serveur et HEAD des liens supplémentaires, sans supprimer les contrôles ni les URLs du sitemap.
- Couverture supplémentaire des erreurs API, états sans base, thèmes, CSP, console, clavier et reflow. Runbook d’exploitation et preuves compactes conservés.

## Tests et mesures

| Contrôle | Résultat réellement observé |
|---|---|
| Typecheck / lint | PASS ; aucun avertissement lint. |
| Unit | PASS : 204 tests, 36 fichiers. |
| Integration DB/UI | PASS dans une base isolée : import, idempotence, reprise, quotas, échec fournisseur, actualisation UI, worker et limiters distribués. |
| E2E fixtures CI | PASS : 40 ; 2 ignorés conditionnels, car des matchs existent aujourd’hui. |
| E2E corpus réel local | PASS : 40 ; mêmes 2 ignorés, distincts de tests réussis. |
| Empty states sans DB | PASS : 6 vues ; recherche vide, absence de lineup/statistiques également couvertes. |
| Responsive | PASS : 210 vues, 14 interactions, sombre/clair, 320/360/375/390/430/768/1440 px. |
| Accessibilité | PASS sur le périmètre testé : 32 vues axe supplémentaires, zéro violation ; clavier et reflow via E2E. |
| SEO complet local | PASS : 8 504 pages, 119 040 contrôles, 49 070 liens supplémentaires ; aucune erreur ni avertissement. |
| Sécurité HTTP | PASS : 14 contrôles. |
| Data quality | PASS : 10 compétitions, 262 équipes, 3 994 joueurs, 14 317 matchs ; zéro échec/avertissement. 20 photos échantillonnées valides. |
| Build final | PASS avec DB inaccessible et sans clé provider ; aucune importation postbuild. |
| Administration / health final | PASS fonctionnel : login et page authentifiée 200 ; durée/éléments visibles ; health 200 avec statut WARNING explicite. |
| CI GitHub | PASS sur le commit `95a50d2`, run [37148064457](https://github.com/redragon38/proba-match/actions/runs/37148064457), jobs `quality` et `database-ui`. L’optimisation finale du health attend sa propre exécution après push. |

Dernière sonde locale : 180 requêtes, concurrence 4, aucune erreur. Accueil p50/p95 **264/354 ms**, matchs **225/257 ms**, API matchs **33/41 ms**, recherche fautive **17/28 ms**, recherche joueurs **18/33 ms**, page match **156/189 ms**, API match **11/17 ms**, API compétition **11/16 ms**, page joueur **56/71 ms**. Une seconde sonde après rafraîchissement à 3 994 joueurs confirme zéro erreur : accueil p50/p95 **301/511 ms**, API recherche fautive **25/39 ms**, API matchs **39/61 ms**. Cache dataset de cette seconde sonde : **106 hits / 107 lectures**, soit **99,07 %**, chargement froid autour de 876 ms. Révision DB p50/p95 **5,62/21,65 ms**. Les audits publics tournaient aussi sur la machine ; ces séries ne permettent pas de calculer un gain frontend comparable. Ces mesures sont locales, dépendantes de la machine et du corpus ; ce ne sont ni des SLO publics ni un stress test production.

Audit frontend de trois pages dans Chromium : zéro erreur de page, zéro image cassée, polices chargées. À froid sur l’accueil, 11 ressources JS réellement chargées, environ **260 Ko compressés / 946 Ko décodés**, CSS environ **16 Ko compressés / 76 Ko décodés**. Les pages suivantes partagent le cache navigateur ; leurs transferts ne sont donc pas comparables à un premier chargement. Aucun score Lighthouse ou CWV terrain n’a été inventé. Après la dernière correction typographique : 210 vues responsive et 32 vues axe de nouveau PASS ; 8 E2E ciblés PASS. Footer mesuré à 12 px et 9 vues complémentaires sans débordement. Les labels SVG sont exprimés dans le repère du graphique ; leur taille physique dépend de sa réduction. Les initiales décoratives de badges restent proportionnelles et `aria-hidden`.

## Production

| Critère | État |
|---|---|
| Build séparé de l’import | PASS local, démontré sans DB joignable. |
| Monitoring | PASS pour le code, les tests et le health ; alertes externes et conservation des logs à configurer. |
| Data freshness | WARNING : le health détecte `OPENFOOTBALL_RESULTS_LATE` et `SECONDARY_NOT_CONFIGURED` ; il ne prétend pas que toutes les données sont à jour. |
| Health | PASS fonctionnel, authentifié ; santé métier WARNING. |
| CSP | WARNING : directives complètes et compatibilité testée, mais `unsafe-inline` reste autorisé. |
| Déploiement public de ces changements | Commits `b737a22` puis `95a50d2` déployés avec succès par Vercel ; 30 parcours publics de nouveau PASS sur la typographie finale, 14 contrôles de sécurité HTTP publics PASS. Health optimisé : déploiement à confirmer après push. |

## P0 restants

Aucun défaut P0 détecté sur le périmètre testé. Ce constat n’est pas un audit de sécurité exhaustif.

## P1 restants

- Fournir et faire valider les vraies informations légales : éditeur, responsable publication, adresse, contact, immatriculation si applicable, adresse de l’hébergeur et politique réelle de conservation des logs.
- Configurer une source live avec ses droits et quotas si une couverture live continue est attendue. Vercel Hobby et un cron quotidien ne démontrent pas une mise à jour à la minute. Corriger le retard réel détecté par les jobs, sans masquer l’avertissement.
- Vérifier l’exploitation réelle : logs Vercel privés actuellement inaccessibles, alertes externes, sauvegardes/restauration PostgreSQL, budget et responsabilité des jobs. La disponibilité technique du health ne prouve pas une supervision active.

## P2 restants

- CSP avec nonce/hash strict : chantier à évaluer avec les scripts Next.js et JSON-LD actuels ; pas de changement risquant une régression pour gagner des points.
- Affiner le bundle client seulement après profilage des composants coûteux ; aucun retrait spéculatif de fonctionnalité.
- Les bucket rate-limit partagés expirent logiquement ; leur purge physique périodique reste à prévoir si l’administration ou la collecte optionnelle génère beaucoup de clés.
- Surveiller les cold starts : la projection du health est optimisée, mais sa première requête locale complète reste à 756 ms, incluant l’initialisation du serveur et de Prisma.
- Vérification éditoriale exhaustive des photos, transferts et statistiques historiques ; les contrôles structurels ne peuvent la remplacer.

## Éléments impossibles à valider automatiquement ici

Informations légales personnelles, pertinence des droits/licences de données, Search Console, CrUX/CWV terrain, Rich Results Test externe, logs privés Vercel, lecteur d’écran humain, appareils physiques, zoom réel 200/400 %, preuve de restauration d’une sauvegarde production. La charge publique n’a pas été testée conformément à la demande. Le domaine canonique existant est conservé.

La collecte Web Vitals reste **désactivée** jusqu’à validation de la conservation et de l’accès aux logs. Les nouvelles variables et procédures sont détaillées dans [PRODUCTION-RUNBOOK.md](PRODUCTION-RUNBOOK.md).

## SEO POST-MODIFICATION

Build, Metadata, URLs, Canonical, Sitemap, Robots, Maillage, Images, Mobile, Structured Data et Erreurs techniques : **PASS localement**. Indexation : **PASS pour les directives**, **NON VÉRIFIÉ EXTERNEMENT pour Google**. Performance : **PASS pour les mesures locales**, **NON TESTÉ pour les CWV terrain**. Audit public après déploiement à confirmer séparément. Aucun changement de domaine ou retrait de fonctionnalité ; les blocs statistiques indisponibles ne deviennent pas des données indexables inventées.

## Verdict

**TRÈS BON — QUELQUES POINTS RESTENT.** Les corrections vérifiées améliorent le projet réel. Les informations légales, l’exploitation effective, les métriques terrain et la CSP inline empêchent de revendiquer 100/100 ou « uniquement des vérifications externes ».

Preuves : [HARDENING-EVIDENCE.json](HARDENING-EVIDENCE.json), [HARDENING-PLAN.md](HARDENING-PLAN.md), [PRODUCTION-RUNBOOK.md](PRODUCTION-RUNBOOK.md). Les rapports volumineux locaux sont conservés dans `.local/hardening/` sans secrets ni fichiers `.env` dans Git.
