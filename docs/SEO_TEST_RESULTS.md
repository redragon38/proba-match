# Validation SEO — 20 octobre 2026

## Résultats et périmètres

| Contrôle | Résultat | Limite |
|---|---|---|
| Build de production Next.js | PASS | Build local, pas déploiement VPS |
| TypeScript | PASS | tsc --noEmit |
| ESLint | PASS avec 2 WARNING | Deux img natifs des images Open Graph préexistants ; zéro erreur |
| Tests unitaires/intégration | PASS : 409 tests, 75 fichiers | Corpus contrôlés ; inclut PostgreSQL isolé, disponibilité, dates, metadata, métriques et moniteur |
| Playwright desktop/mobile | PASS : 50, SKIP : 22, échec final : 0 | Les 22 scénarios exigent un catalogue sportif réel absent de la base locale ; ils ne sont pas comptés comme validés |
| Fixture du bilan | PASS | Filtres de version et retour à toutes les versions, 390/1440 px, zéro erreur JS/débordement |
| SEO local | PASS : 24 pages, 299 contrôles, 14 vues navigateur | Aucun catalogue de production chargé ; canoniques HTTPS de production, serveur local HTTP |
| Sécurité HTTP | PASS : 19 contrôles | Inclut refus sans authentification du nouveau cron SEO |
| Moniteur CLI local | PASS : 23 pages, 5 URL de sitemap, zéro erreur/avertissement | Canonique proba-match.com explicitement indiquée pour ce serveur local |
| Script de déploiement | PASS | Syntaxe Bash, patch runtime, réexécution, conservation Caddy/.env, refus des conflits ; Docker distant non exécuté |
| Google Search Console / CrUX | NON TESTÉ | Aucun accès authentifié |

Les tests navigateur ont initialement relevé des sélecteurs obsolètes et des
préconditions de catalogue non satisfaites. Les sélecteurs ont été corrigés ; les
cas exigeant des données réelles sont maintenant explicitement ignorés quand le
catalogue est vide. Les contrôles des états vides restent exécutés. Une fixture
distincte teste les interactions du bilan sans API sportive externe.

Le lancement d'un serveur HTTP local supplémentaire simulant une base inaccessible
a été refusé par le contrôle automatique d'autorisation (`blocked by policy`).
Cette action n'a pas été contournée. La panne DB et le maintien de la dernière
copie sont vérifiés par tests isolés ; un statut HTTP 500/503 correspondant n'est
pas présenté comme observé.

## Production avant déploiement du correctif

- Sitemap : 4 826 URL observées ; 40 pages contrôlées en profondeur, 601 contrôles,
  18 vues navigateur ; 60 liens supplémentaires vérifiés, zéro lien cassé et zéro
  redirection interne sur ce sous-ensemble. 374 liens découverts restent non vérifiés.
- L'unique FAIL « chaque URL du sitemap a un lien entrant » était une conclusion
  invalide dans un échantillon. L'outil corrigé distingue couverture partielle et
  véritable absence de liens. Aucun nombre de pages orphelines confirmées n'est annoncé.
- WARNING de poids HTML : bilan des prédictions, 18 669 207 octets.
- HTTP bare, HTTP www et HTTPS www : 301 directe vers https://proba-match.com/.
  HTTPS bare : 200. Match inexistant contrôlé : 404.
- Vue ponctuelle de l'accueil à 390 px : LCP 1 016 ms, CLS 0,000492 ; absence
  d'erreur JS, de débordement et de violation axe dans cette vue. Mesure ponctuelle
  de navigateur, pas un percentile réel ni une preuve de CWV terrain satisfaisants.

## Mesures après correction, environnement contrôlé

Fixture synthétique de **5 288 matchs** : données du bilan sérialisées avant
projection **21 922 305 octets**, après projection **2 223 octets**. Les journaux
et matchs non évalués ne traversent plus la frontière serveur/client ; le nombre
de non-évaluables reste calculé séparément. Les tests vérifient l'égalité des
métriques complètes et l'absence de mutation de l'archive d'entrée.

Sur cette même fixture : calcul des dates de sitemap de référence **393,55 ms**,
index en un passage **42,91 ms**, mêmes valeurs. Ce benchmark local n'est ni une
mesure du VPS ni une mesure de chargement du site public.

Lighthouse **13.5.0**, accueil local sans base sportive, preset desktop :

| Catégorie / mesure | Observation |
|---|---|
| Performance | 100/100 |
| Accessibilité | 100/100 |
| Bonnes pratiques | 100/100 |
| SEO | 69/100 : seul audit en échec, page bloquée à l'indexation par noindex |
| LCP | 532,54 ms |
| CLS | 0 |
| Total Blocking Time | 0 ms |

Le noindex de cet accueil vide est intentionnel et conservé : le retirer pour
améliorer le score de test contredirait la politique de qualité. Ces scores ne
décrivent pas la production. Le test mobile n'a pas produit de trace exploitable
après deux tentatives (`NO_NAVSTART`) ; aucun score performance mobile valide
n'est annoncé. Le TBT ne remplace pas une mesure INP terrain.

## Comptages des changements

- Dix groupes de défauts runtime corrigés : panne DB, domaine de secours,
  statuts JSON-LD, archives de saisons, payload du bilan, coût du sitemap,
  sélection temporelle d'accueil, cache de révisions, comparateur vide, pagination canonique des matchs.
- Trois groupes d'enrichissements : timestamp machine, surveillance quotidienne,
  audit borné avec périmètre honnête et tests complémentaires.
- Liens cassés observés/corrigés : **0/0**. Ajout de liens contextuels vers les saisons.
- Métadonnées : trois politiques améliorées (origine canonique globale,
  canonical/indexation par saison, pagination du calendrier). Pas de prétendu comptage des titres modifiés
  dans Google, ni de réécriture massive de descriptions déjà correctes.
- Sitemap et robots : URL publiques conservées ; dates significatives, archives
  documentées et règles de noindex cohérentes vérifiées par tests.

## SEO POST-MODIFICATION

PASS local : Build, Indexation selon règles, Metadata, URLs, Canonical, Sitemap,
Robots, Maillage contrôlé, Images dans le périmètre testé, Mobile, Structured Data,
contrôles de sécurité et erreurs techniques ciblées.

WARNING : Performance (mesures de laboratoire uniquement), deux avertissements
lint OG, 22 cas navigateur sans leurs prérequis de base, crawl public échantillonné,
test Lighthouse mobile inexploitable, contrôle HTTP de panne refusé par l'outil.

NON TESTÉ / NON VÉRIFIÉ EXTERNEMENT : déploiement de ces changements sur le VPS,
réduction effective du bilan public après déploiement, première exécution du cron
SEO, couverture globale des prédictions, CTR et indexation Google, CWV terrain.

## Commandes reproductibles

```bash
npm run typecheck
npm run lint
npm test -- --maxWorkers=2
npm run build
npm run start
npm run test:seo
npm run test:e2e
VERIFY_URL=http://localhost:3000 node scripts/verify-security.mjs
```

Dans cette session Windows, les exécutables Node des dépendances ont été appelés
directement lorsque npm n'était pas dans PATH. Les rapports synthétiques et les
mesures sélectionnées sont conservés dans artifacts/SEO-MISSION-EVIDENCE.json.
