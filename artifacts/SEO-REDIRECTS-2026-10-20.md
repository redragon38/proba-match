# SEO POST-MODIFICATION — 20 octobre 2026

Projet téléchargé depuis redragon38/proba-match, branche master.
Architecture : Next.js 16 / React 19, Prisma / PostgreSQL, Docker Compose,
Caddy (TLS et redirections), Nginx (cache), app, worker et scheduler.
Le bootstrap VPS référence fix/real-player-stat-sync et /opt/proba-match/app.
La référence Vercel dans AGENTS.md est historique : la demande utilisateur et
la production actuelle établissent le VPS et https://proba-match.com comme cible.

## Diagnostic observé en production avant modification

- http://proba-match.com/ : 308 vers https://proba-match.com/.
- http://www.proba-match.com/ : 308 vers HTTPS www puis 301 vers HTTPS sans www.
- https://www.proba-match.com/ : 301 vers https://proba-match.com/.
- https://proba-match.com/ : 200, canonical https://proba-match.com.
- robots.txt : 200, pages publiques autorisées, sitemap sur le domaine canonique.
- sitemap.xml : 200, origine canonique dans les URL observées.

La capture Search Console signale des URL sources de redirection : leur exclusion
est attendue. Elle ne démontre pas une erreur d'indexation de la destination.
L'ancienne exploration de HTTPS sans www ne décrit pas son état actuel (200).

## Correction et preuves

Seul Caddyfile change le comportement : un bloc HTTP explicite redirige les deux
hôtes directement vers HTTPS sans www en 301, chemin et paramètres conservés.
Le bloc HTTPS public et la gestion des certificats restent en place.

- PASS : adaptation et validation du fichier complet avec Caddy 2.10.0.
- PASS : six requêtes HTTP locales sur les routes réellement adaptées par Caddy,
  deux hôtes, accueil, chemin d'équipe et chemin avec paramètres : 301 et Location
  exacts. Pour le banc local sur port 18080, HTTPS automatique désactivé ;
  le fichier de production est validé séparément sans cette adaptation locale.
- PASS : git diff --check.
- NON TESTÉ : build, typecheck, lint et audit navigateur test:seo ; aucun code
  applicatif, dépendance, contenu ou metadata n'a changé. Docker absent localement.
- PASS avant déploiement : URLs, canonical d'accueil, robots et accès sitemap.
- WARNING : indexation effective et nouvelle exploration Search Console nécessitent
  une inspection par le propriétaire ; accès au compte NON VÉRIFIÉ EXTERNEMENT.
- NON TESTÉ : metadata de toutes les pages, maillage, images, mobile, performance,
  structured data et erreurs navigateur ; aucun score CWV déduit de ces requêtes.
- NON TESTÉ : nouvelle redirection sur le VPS tant que la commande n'est pas exécutée.

## Déploiement ciblé Ubuntu

Depuis le chemin du bootstrap, récupérer uniquement Caddyfile de la branche du
correctif, sauvegarder l'ancien fichier, valider puis recharger Caddy. Aucun build
de l'application ni migration de base nécessaire. Conserver la branche VPS actuelle.
Après rechargement : vérifier les trois variantes et inspecter l'accueil HTTPS
sans www dans Search Console. Le statut « Page avec redirection » des variantes
reste normal ; demander l'indexation de la destination si nécessaire.

Références :
- https://developers.google.com/search/docs/crawling-indexing/301-redirects
- https://caddyserver.com/docs/automatic-https
- https://caddyserver.com/docs/caddyfile/directives/redir
