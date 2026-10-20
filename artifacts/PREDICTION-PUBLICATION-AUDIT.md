# Publication progressive des prédictions — 20 octobre 2026

Le profil transmis par le VPS échantillonne 5,65 secondes : 60,2 % idle,
avec du temps dans Prisma et le moteur. Il ne prouve pas à lui seul la cause
de tous les délais. Le code retenait néanmoins toutes les publications dans
une transaction pouvant durer 30 minutes et transférait des archives JSON
complètes lors de lectures dont seul l'identifiant était nécessaire.

## Correction

- Calcul et sérialisation hors transaction ; corpus préparé une seule fois.
- Matchs les plus proches publiés en premier, une transaction de 30 secondes
  maximum par publication. Un échec ultérieur ne supprime pas les commits précédents.
- INSERT paramétré avec archive JSON sérialisée, sans retour du payload ; conflit
  ignoré, contraintes et triggers d'intégrité conservés.
- Lectures d'existence limitées à l'identifiant ; mise à jour du marqueur limitée
  à sa clé en retour, sans retransfert du catalogue complet.
- Vérification du propriétaire et de l'expiration du verrou avant chaque commit.
- CPU du worker fixé à 1 dans Compose. Déploiement : arrêt du worker et du scheduler
  avant compilation ; application publique conservée pendant la compilation.

## Validation locale

- PASS : production build, typecheck, 395 tests dans 69 fichiers.
- PASS : PostgreSQL isolé avec migrations et triggers réels ; archive conservée,
  conflit ignoré, modification et insertion tardive interdites.
- PASS : calcul hors transaction, ordre par coup d'envoi, commit précédent conservé
  après erreur suivante, publication refusée après perte du verrou.
- PASS : syntaxe Bash ; application du patch depuis quatre versions précédentes,
  réexécution, conservation Caddy/env, refus d'un conflit local.
- PASS : audit SEO local, 24 pages, 297 contrôles, 14 vues navigateur, aucune erreur.
- PASS : sécurité HTTP, 18 contrôles ; composants de prédiction avec/sans archive
  à 390 et 1440 pixels, sans débordement ni erreur JavaScript.
- WARNING : lint sans erreur, deux avertissements img préexistants sur les images OG.
- WARNING : suite Playwright générale interrompue après deux échecs : catalogue
  local sans match mis en avant ; ancien libellé du bouton de recherche. Elle
  n'est pas déclarée valide. Les tests ciblés de publication et de composants passent.

## SEO POST-MODIFICATION

PASS local : Build, Indexation, Metadata, URLs, Canonical, Sitemap, Robots,
Maillage, Images, Mobile, Structured Data et contrôles techniques de l'audit SEO.
WARNING : Performance (aucune mesure CWV terrain), HTTPS local non applicable,
suite navigateur générale partielle et avertissements lint mentionnés ci-dessus.
NON TESTÉ : nouveau déploiement VPS, publication effective en production,
Search Console et CWV terrain — NON VÉRIFIÉ EXTERNEMENT pour ce correctif.

Une lecture publique avant déploiement répond HTTP 200 pour Brest–Nice mais
ne contient toujours aucun élément de probabilité. Le script de déploiement
exige un traitement réussi puis vérifie cette page contre l'application.
Le succès local ne constitue donc pas une confirmation de résolution en production.
