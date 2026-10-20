# Prédictions manquantes — diagnostic et correctif

## Cause reproduite

Le 20 octobre 2026, les routes publiques du site montrent seulement cinq résultats
par équipe pour Brest et Nice en Ligue 1. La fiche du 23 octobre ne contient pas
de prédiction archivée. La quantité effective, pondérée par ancienneté et lieu,
est inférieure à cinq : le moteur refuse correctement ce corpus trop court.
Les imports OpenFootball ordinaires chargent seulement la saison courante.

Reproduction locale avec le corpus public et le moteur 1.4 inchangé :
- 48 résultats Ligue 1 disponibles dans l'API publique : aucune projection Brest–Nice.
- Ajout des résultats réels 2025/26, identités des équipes vérifiées : projection
  calculable, 20 observations sélectionnées par équipe, confiance 42/100.
- Cette reproduction n'est pas une prédiction publiée et n'alimente aucun bilan.
  Les résultats importés sont reçus maintenant, jamais antidatés.

Source historique :
https://raw.githubusercontent.com/openfootball/football.json/master/2025-26/fr.1.json

## Changements

- Le traitement dédié importe la saison précédente des championnats OpenFootball
  configurés si leur source historique n'a pas encore été importée avec succès.
  Les échecs restent réessayables. Il ne recharge pas un historique déjà présent.
- Un seul passage de prédictions après import ; aucun calcul ajouté aux requêtes SSR.
- Lecture du corpus relationnel complet plutôt que dépendance au snapshot d'affichage.
- Réparation des entrées et publication protégées par le verrou partagé des imports
  et vérification du bail dans la transaction de réparation.
- Publication VPS à :17 et :47 de chaque heure, au lieu d'une fois par jour.
- Retour des compteurs du traitement : eligible (fenêtre temporelle et heure connue),
  existing (initiales déjà archivées pour cette version), created (nouvelles initiales),
  unavailable (sans initiale et moteur ne pouvant pas calculer). Les mises à jour
  liées aux compositions ne sont pas comptées comme nouvelles initiales.
- État busy explicite si un import détient le verrou ; aucune exécution concurrente forcée.
- Message d'absence plus précis sur la fiche match, sans prétendre que cinq résultats
  bruts garantissent une prédiction. Les coefficients et seuils sont conservés.
- Déploiement ciblé avec sauvegarde et vérification de patch, sans toucher à Caddy,
  aux variables privées, à la branche VPS ou aux autres fichiers modifiés.

## Vérifications

- PASS : suite Vitest finale, 68 fichiers et 382 tests, avec deux workers.
  Un passage simultané au build a dépassé le délai de cinq secondes sur deux
  tests temporels ; la suite complète relancée sans concurrence du build passe.
- PASS : TypeScript et build de production Next.js 16.3.8.
- PASS : lint sans erreur ; deux avertissements préexistants img dans les images OG.
- PASS : 299 contrôles SEO sur 24 pages sans base locale, 14 vues navigateur,
  aucun échec, avertissement, lien cassé ou redirection interne découvert.
- PASS : 8 tests Playwright desktop/mobile (guides, navigation et rendu sans JS).
- PASS : composant MatchDetail réel avec fixture synthétique, états avec/sans
  prédiction, 390 et 1440 px : trois probabilités si présentes, message d'absence
  sinon, aucun débordement ni erreur JavaScript.
- PASS : 18 contrôles HTTP de sécurité sur le serveur de production local.
- PASS : patch de déploiement vérifié contre une copie des fichiers de la base
  Git fc9214f ; aucun fichier Caddy ou env inclus dans le patch.
- NON TESTÉ : intégration Prisma vers PostgreSQL du VPS, exécution du script Docker
  sous Ubuntu et quantité réelle de nouvelles prédictions après déploiement.
  Les tests de service utilisent un adaptateur isolé ; aucun secret ou accès DB VPS local.

## SEO POST-MODIFICATION

- Build : PASS.
- Indexation : WARNING, contenu utile ajouté après archivage, indexation Google
  effective NON VÉRIFIÉE EXTERNEMENT.
- Metadata, URLs, Canonical, Sitemap, Robots, Maillage, Images, Mobile,
  Structured Data, Erreurs techniques : PASS pour les routes locales auditées.
  Les fiches sportives avec base réelle ne sont pas couvertes par cet audit sans base.
- Performance : NON TESTÉ pour les CWV terrain et la charge après import réel.
- Search Console, CrUX et Rich Results Test : NON VÉRIFIÉS EXTERNEMENT.

## Exploitation

Le script scripts/deploy-prediction-fix.sh reçoit le SHA récupéré par git fetch.
Il applique uniquement les sept fichiers applicatifs/de configuration du correctif,
construit et remplace app/worker/scheduler, puis appelle le traitement authentifié
depuis le worker, sans exposer le secret. Un verrou occupé est réessayé jusqu'à
trois minutes. Un résultat failed/partial fait échouer explicitement le script.
Le cache HTML public peut conserver l'ancien affichage pendant cinq minutes.

Un match terminé, une heure inconnue, une rencontre à plus de 21 jours ou un vrai
manque d'historique exploitable peuvent encore ne pas avoir de prédiction. Ne jamais
fabriquer de prévision rétroactive pour compléter les anciennes rencontres.

La demande d'amélioration SEO globale reste distincte et à poursuivre après cette
correction prioritaire ; le présent audit sert à vérifier l'absence de régression.
