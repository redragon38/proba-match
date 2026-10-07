# Suivi du push — 7 octobre 2026

Le workflow du commit `ddac131` a révélé une assertion d'intégration obsolète : la fraîcheur des résultats surveille désormais tous les fournisseurs, mais le test PostgreSQL attendait encore l'exclusion d'ESPN et des snapshots secondaires. Les attentes sont corrigées sans changer le comportement de production.

Un test exécute la requête SQL réelle dans PGlite et compare ses résultats au calcul en mémoire : trois fournisseurs de matchs, trois sources de snapshots, horaires connus/inconnus, seuils de 6 h/24 h à une milliseconde près et six statuts, soit 486 scénarios.

Validation locale : 310 tests dans 48 fichiers réussis, typecheck et lint ciblé réussis. Le résultat PostgreSQL/Prisma/UI du nouveau workflow reste à vérifier après le push. Le précédent job quality avait réussi types, lint, tests et build ; sa suite navigateur était encore en cours au moment de cette correction.

Vercel a confirmé le déploiement de production READY pour `ddac131`. La présence des variables PostgreSQL de production est confirmée, mais les outils disponibles ne fournissent pas de valeur utilisable pour la connexion directe. Aucune migration distante, sauvegarde ou restauration n'a donc été exécutée. Appliquer `npm run db:migrate` depuis un environnement disposant de cette connexion après vérification de la sauvegarde/restauration ; ne pas remplacer cette opération par une migration aveugle au build.

SEO POST-MODIFICATION : aucune page, metadata, URL, règle d'indexation ou donnée structurée modifiée. Les contrôles SEO locaux de la livraison précédente restent la référence ; indexation, mobile et performances terrain NON VÉRIFIÉS EXTERNEMENT dans cette passe de correction des tests.
