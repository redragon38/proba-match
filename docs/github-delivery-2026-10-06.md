# Livraison GitHub du 6 octobre 2026

Le push sur la branche principale `master` a été explicitement demandé après la livraison du ZIP. Les rapports datés de la passe précédente décrivent un travail alors local sans push ; ce document décrit la préparation de la livraison GitHub ultérieure. La base distante vérifiée avant préparation est `f828972efc6413d34523d646e162a8fb54c75439`.

Les 155 fichiers source du patch cumulatif ont été comparés octet par octet à la version validée du projet. Aucun nouveau dépôt, branche de travail, force-push ou modification de base distante n’est demandé. Le projet conserve son architecture et son identité visuelle.

## Validation disponible

Types, lint, 306 tests dans 47 fichiers et build : réussis localement. SEO : 279 contrôles sur 22 routes ; rendu serveur : 129 contrôles ; HTTP sécurité : 14 contrôles ; parcours ciblés : 22 tests ; responsive : 224 vues ; quatre composants remplis : 32 vues sur fixtures explicites. Les journaux sélectionnés et rapports sont dans `artifacts/`. Les captures et le reste des journaux sont conservés dans le ZIP livré.

La suite sportive complète n’est pas certifiée localement : elle échoue sur un catalogue sans match à venir faute de PostgreSQL alimenté. Le pipeline existant fournit une base PostgreSQL de CI et ses propres fixtures ; son résultat doit être lu séparément après le push. Aucun succès CI ou déploiement n’est déduit des tests locaux.

## Migration nécessaire

Avant d’activer les imports avec cette version sur la base hébergée, sauvegarder et vérifier la restauration, puis appliquer les migrations avec `npm run db:migrate` dans l’environnement configuré avec la bonne `DATABASE_URL`. La table `ResultObservation` est utilisée par la nouvelle synchronisation ; sans la migration `202610060001_result_observations`, celle-ci échouera. Le build Vercel configuré n’exécute pas automatiquement cette migration. Aucun accès ni changement de PostgreSQL distant n’est réalisé lors de cette livraison GitHub.

Les instructions détaillées figurent dans [les opérations d’audit](audit-fixes-operations.md). La présence et la supervision du worker live restent à vérifier. Un éventuel déploiement automatique lié au push ne prouve ni l’application des migrations ni le bon fonctionnement des imports.

## Précision du moteur

Version `elo-poisson-1.4.0` : contrats temporels, résultat réglementaire, archive des entrées et abstention renforcés. Aucun gain de précision réelle n’est démontré. Les probabilités sont identiques sur le support historique reconstruit commun et le corpus strict observé demeure insuffisant. Voir [le registre des 31 constats](../artifacts/AUDIT-FIX-2026-10-06.md).
