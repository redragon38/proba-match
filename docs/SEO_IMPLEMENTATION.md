# Implémentation et exploitation SEO

## Corrections livrées

| Problème | Solution / fichiers principaux | Validation |
|---|---|---|
| DB indisponible | services/football/index.ts : erreur temporaire explicite à froid, dernière copie conservée si disponible ; shell éditorial tolérant conservé | dataset-outage, dataset-availability, shell-outage |
| Origine VPS | lib/seo.ts : proba-match.com en secours production et pour anciens alias ; configuration HTTPS explicite respectée | seo.test |
| Schema.org | lib/sports-structured-data.ts : seuls statuts existants et confirmés ; compétition référencée avec about plutôt qu'isPartOf, réservé aux CreativeWork | sports-entities + moniteur |
| Archives de saisons | Canonique autonome ?saison=année pour saison documentée, sitemap et liens HTML ; filtres/années invalides restent noindex | season-seo, competition-view et tests navigateur |
| Pagination des matchs | Canonique et titre propres à chaque page du catalogue complet, sitemap paginé ; filtres noindex et pagination invalide/hors limites en 404 | season-seo et tests HTTP existants |
| Bilan très lourd | services/performance-view.ts : projection serveur limitée aux matchs évalués, calcul séparé des non-évaluables, aucune archive ni journal de révisions dans les props ; appliqué au bilan public et à l'administration | parité de toutes les métriques, test de volume, fixture navigateur avec filtres |
| Dates sitemap coûteuses | lib/sitemap-lastmod.ts : index des dates en un passage ; dates par saison sans confondre les archives et la saison courante | sitemap-lastmod, season-seo, benchmark |
| Horloge et dates accueil | home-predictions.ts et app/page.tsx : horloge courante pour les candidats, résultats valides uniquement, validation stricte de date civile | home-predictions, factual-dates, calendrier |
| Cache des révisions | api/updates : no-store et noindex également sur réponses vides/erreurs | navigateur et sécurité HTTP |
| Fraîcheur lisible par machine | SourceBanner : balise time avec datetime ISO ; affichage français Europe/Paris conservé | audit et moniteur |
| Comparateur vide | Sélecteurs masqués en l'absence de profils ; explication de l'état vide conservée | tests navigateur sans base |
| Surveillance | lib/seo-monitor.mjs, scripts/seo-monitor.mjs, api/cron/seo, ops/vps-crontab | fixtures HTTP et contrôle d'authentification |
| Outil d'audit | verify-seo : échantillonnage explicite, limites de liens et couverture des liens entrants non surestimée | audit public et local |

Les calculs du modèle, seuils de qualité, archives immuables, scores, classements,
URL existantes, secrets et domaine choisi ne sont pas remplacés par des données artificielles.
La checklist React a été appliquée aux composants modifiés : réduction des props,
calculs serveur, hooks stables, labels, navigation clavier et absence de nouvelle bibliothèque UI.

## Surveillance périodique

Le cron existant appelle `/api/cron/seo` à **03:35, heure du conteneur**. Il s'agit
d'une configuration livrée, pas d'une exécution de production déjà observée.
La route exige CRON_SECRET, n'accepte pas d'URL de crawl fournie par le visiteur,
et utilise un verrou indépendant de celui des imports sportifs.

Elle contrôle 24 pages représentatives, sans appeler les fournisseurs sportifs :
statuts, robots, sitemap, metadata, canonicals, H1, français, JSON-LD, liens,
timestamp du catalogue et variation de plus de 25 % du nombre d'URL du sitemap.
Le rapport inclut footballHealth : fraîcheur des sources et échecs de sync.
Les logs ne contiennent que des codes/compteurs. Le dernier rapport est stocké
sous CacheEntry `seo:monitor` ; aucun endpoint public ne l'expose.

La variation du sitemap n'est pas une mesure de l'index Google. Les candidats
orphelins sont explicitement incertains dans un crawl partiel. Aucun e-mail ou
service payant n'est activé.

## Exécution manuelle

Avec Node.js installé et le projet disponible :

```bash
VERIFY_URL=https://proba-match.com SEO_MONITOR_REPORT=artifacts/seo-monitor.json npm run seo:monitor
```

Options : `SEO_MAX_PAGES` (60 par défaut, maximum 10 000), `SEO_DELAY_MS` (200 par
défaut), `SEO_CANONICAL_ORIGIN` si un serveur local est contrôlé avec la canonique
de production. JSON et Markdown sont écrits au chemin indiqué. Un code de sortie
non nul signale des erreurs techniques ; les avertissements seuls ne bloquent pas.

Audit navigateur plus poussé :

```bash
VERIFY_URL=https://proba-match.com SEO_REQUIRE_HTTPS=true SEO_CANONICAL_ORIGIN=https://proba-match.com SEO_AUDIT_MAX_PAGES=40 SEO_AUDIT_MAX_LINKS=60 npm run test:seo
```

Sans limites explicites, l'audit navigateur conserve son mode complet. Pour un
grand catalogue, le lancer hors pic et surveiller la charge ; un crawl exhaustif
n'est pas nécessaire à chaque contrôle quotidien.

## Déploiement VPS Ubuntu

Ne pas faire de reset de base ni écraser .env.vps ou Caddyfile. La commande ci-dessous
applique exclusivement les fichiers runtime connus, après vérification de leur
contenu et sauvegarde ; elle refuse un conflit local au lieu de l'écraser.
Le script est réexécutable et accepte aussi un correctif partiellement appliqué.

```bash
sudo bash -c '
set -euo pipefail
cd /opt/proba-match/app
git fetch origin codex/prediction-history-coverage
revision=$(git rev-parse FETCH_HEAD)
deploy_script=$(mktemp)
trap "rm -f -- \"$deploy_script\"" EXIT
git show "${revision}:scripts/deploy-seo-fix.sh" > "$deploy_script"
bash "$deploy_script" "$revision"
'
```

Le worker et le scheduler sont arrêtés pendant la compilation pour libérer le CPU.
L'application publique reste démarrée jusqu'au remplacement. Les contrôles internes
portent sur accueil, canonique, robots, sitemap et taille du bilan (< 1 Mo).
Le scheduler redémarre ensuite. Le cache public peut encore servir l'ancienne
page pendant cinq minutes. Un échec avant remplacement relance les services
de fond ; ce mécanisme n'est pas une restauration automatique des sources.
Sauvegardes : `.local/seo-backups/`.

Aucune migration DB n'est nécessaire pour les changements de cette mission SEO.
L'index de prédictions avait été réparé séparément lors du dépannage précédent.

## Suivi Search Console après déploiement

Conserver un relevé daté avant déploiement puis comparer des périodes de 28 jours,
en tenant compte du calendrier sportif et des compétitions : clics, impressions,
CTR, position moyenne, pages indexées/exclues, erreurs d'exploration et CWV.
Segmenter guides, compétitions/saisons, équipes, joueurs et matchs.

Vérifier le sitemap et inspecter quelques canoniques, dont une saison historique.
Une ancienne URL HTTP/www redirigée peut légitimement rester exclue comme
« page avec redirection » : c'est la destination HTTPS qui doit être examinée.
Vérifier les requêtes ayant beaucoup d'impressions et un CTR faible avant de
modifier à nouveau les titres. Aucun accès Search Console ni résultat de trafic
n'est revendiqué ici.
