# Migration Neon → Aiven — Proba Match

État au 7 octobre 2026 : **préparée, non effectuée**. Aucun secret ni variable Vercel modifié. Neon conservé.

## Blocage constaté

Neon affiche « Limit reached », quota mensuel de transfert épuisé, 5,62 GB transférés et endpoint inactif. Les logs Vercel confirment `PrismaClientInitializationError`, catégorie `DATABASE_UNREACHABLE`, sur `db:dataset_revision`. Aucun dump natif de production n'est disponible dans le workspace. Les historiques de matchs JSON ne remplacent pas une sauvegarde de la base complète.

Aiven est accessible : PostgreSQL 18.6, service Free en état Running, `defaultdb`, port 16780, SSL require, limite 20 connexions. Une requête SQL en lecture seule confirme **0 table public et 2 connexions** au moment du contrôle. Ne pas diriger la production vers cette base vide.

## Variables réellement utilisées

Recherche effectuée dans Prisma, src, scripts, migrations, configuration, CI et Docker ; les valeurs des secrets n'ont pas été imprimées.

| Variable | Usage applicatif | Où / rôle | Après migration validée |
| --- | --- | --- | --- |
| DATABASE_URL | Oui | `prisma/schema.prisma`, `src/database/client.ts`, services football/prédictions/historique/quotas, scripts et CI | Remplacer par Aiven en Preview, puis Production après validation |
| DATABASE_URL_UNPOOLED | Non | Injectée par l'intégration ; pas de lecture par le code | Conserver temporairement pour source directe / rollback ; nettoyage ultérieur |
| POSTGRES_PRISMA_URL | Non | Aucun appel dans le projet | Nettoyage ultérieur |
| POSTGRES_URL | Non | Aucun appel dans le projet | Nettoyage ultérieur |
| POSTGRES_URL_NON_POOLING | Non | Aucun appel dans le projet | Source directe potentielle pour l'export, à vérifier ; nettoyage ultérieur |
| POSTGRES_URL_NO_SSL | Non | Aucun appel dans le projet | Nettoyage ultérieur ; ne pas l'utiliser pour la migration |
| POSTGRES_PASSWORD | Local seulement | `docker-compose.yml` ; service PostgreSQL local. CI utilise aussi un mot de passe jetable dans sa configuration de service | Variable Vercel inutilisée ; ne pas supprimer la configuration Docker/CI |
| POSTGRES_DATABASE | Non | Aucun appel dans le projet | Nettoyage ultérieur |
| POSTGRES_USER | Non | Aucun appel dans le projet | Nettoyage ultérieur |
| POSTGRES_HOST | Non | Aucun appel dans le projet | Nettoyage ultérieur |
| PGHOST | Non dans l'app | Libpq l'utilise uniquement dans l'outil manuel de transfert préparé ci-dessous | Pas nécessaire dans Vercel ; nettoyage ultérieur |
| PGHOST_UNPOOLED | Non | Aucun appel dans le projet | Nettoyage ultérieur |
| PGDATABASE | Non dans l'app | Libpq dans l'outil manuel | Pas nécessaire dans Vercel ; nettoyage ultérieur |
| PGPASSWORD | Non dans l'app | Libpq dans l'outil manuel ; secret en mémoire uniquement | Pas nécessaire dans Vercel ; nettoyage ultérieur |
| PGUSER | Non dans l'app | Libpq dans l'outil manuel | Pas nécessaire dans Vercel ; nettoyage ultérieur |
| NEON_PROJECT_ID | Non | Aucun appel dans le projet | Nettoyage ultérieur |
| NEON_AUTH_BASE_URL | Non | Aucun appel dans le projet | Nettoyage ultérieur |
| VITE_NEON_AUTH_URL | Non | Aucun appel dans le projet | Nettoyage ultérieur |

Les variables ci-dessus sont indépendantes de `CRON_SECRET`, `ADMIN_SECRET`, `FOOTBALL_API_KEY`, `FOOTBALL_API_PROVIDER`, `OPENFOOTBALL_LEAGUES`, `MATCHSCORE_DEMO`, `NEXT_PUBLIC_SITE_URL`, `CONTACT_EMAIL`, `APP_ENV`, `FOOTBALL_DAILY_BUDGET` et `FOOTBALL_LEAGUES` : **conserver ces dernières**.

Prisma utilise exclusivement `url = env("DATABASE_URL")`. Client standard Prisma 6.19.3, moteur PostgreSQL natif ; aucune dépendance `pg`, driver Neon serverless ou Prisma Accelerate. Le caractère poolé/direct de l'ancienne URL n'est pas confirmé : les valeurs Vercel sont masquées. Pour pg_dump, récupérer la véritable URL **directe** via l'intégration sécurisée.

## Compatibilité et connexions

Le code utilise les types PostgreSQL standards : TEXT, INTEGER, DOUBLE PRECISION, BOOLEAN, TIMESTAMP et JSONB ; PK, contraintes uniques, FK, indexes et fonctions/triggers PL/pgSQL. Aucune extension Neon spécifique n'est déclarée dans les migrations. Il faut encore inventorier les extensions et objets **effectivement installés sur Neon** avant export. Neon indique PostgreSQL 18 ; Aiven 18.6, sans preuve de restauration à ce stade.

`src/database/client.ts` partage désormais le PrismaClient via globalThis **également en production**. Sur Vercel, `src/database/connection.ts` applique `connection_limit=1`, et `pool_timeout=10` lorsque non défini. SSL, identité, database et autres paramètres sont conservés. Le client local reste inchangé.

**Ce plafond est par processus, pas global.** Plus de 20 instances et connexions administratives peuvent toujours saturer Aiven. Après bascule, mesurer les connexions, P2024 et latences ; conserver une marge pour les opérations. Ne pas prétendre que le singleton impose une limite globale de 20 ni introduire PgBouncer sans validation.

Le correctif `757aa049` retire `inputArchive` dans PostgreSQL avant transfert, lit uniquement la dernière prédiction demandée et limite la lecture de l'accueil aux matchs affichés/analysés. Les archives restent intactes. Le cache de catalogue est borné et partagé dans le processus ; il ne persiste pas entre instances Vercel. Le gain réel de trafic n'est pas encore mesuré.

## Procédure manuelle préparée

Prérequis : rendre Neon accessible le temps d'exporter, obtenir les deux véritables chaînes via un canal sécurisé, disposer des clients PostgreSQL **18** (`pg_dump`, `pg_restore`), et arrêter **tous** les writers : crons Vercel, workers, tâches/admin et écritures annexes. Un simple changement de variable de connexion ne remplace pas le transfert des données.

Fournir `OLD_DATABASE_URL` (Neon direct) et `NEW_DATABASE_URL` (Aiven) dans des variables locales sécurisées ou un fichier ignoré `.database-migration/secrets.env`, droits 600. Ce fichier n'est jamais généré avec des identifiants fictifs. Aucun URI complet en arguments shell, log ou fichier suivi. Les chaînes doivent conserver SSL require. Le script traduit la connexion en variables libpq ; les secrets ne sont pas passés dans les arguments de pg_dump/pg_restore.

`scripts/database-transfer.mjs` est **manuel**, absent du build, du démarrage et des handlers publics. Il n'a pas été exécuté contre les bases réelles faute d'export source. Lancer les étapes séquentiellement et interrompre au premier FAIL :

```sh
node --env-file=.database-migration/secrets.env scripts/database-transfer.mjs audit-source
node --env-file=.database-migration/secrets.env scripts/database-transfer.mjs audit-target
# Seulement après arrêt réellement vérifié de tous les writers :
MIGRATION_WRITES_PAUSED=true node --env-file=.database-migration/secrets.env scripts/database-transfer.mjs export
MIGRATION_WRITES_PAUSED=true node --env-file=.database-migration/secrets.env scripts/database-transfer.mjs restore
node scripts/database-transfer.mjs compare
```

Le dump custom omet propriétaires/ACL. Neon reste en lecture seule. La restauration ne fait **aucun --clean / DROP** : elle refuse une destination contenant tables/vues/fonctions/séquences publiques, exige une version cible compatible et restaure en transaction avec arrêt sur erreur. Les erreurs ne sont jamais sérialisées avec leur message/stack sensible.

Les fichiers privés ignorés `.database-migration/` contiennent dump, empreinte SHA-256, manifestes source/cible et comparaison. Export vérifie aussi que la source n'a pas changé pendant le dump. Les manifestes comparent toutes les tables publiques, y compris `_prisma_migrations`, nombres de lignes, empreintes de contenu, colonnes, PK/FK/uniques, indexes, triggers/fonctions/vues et définitions/états de séquences, ainsi que les libellés des enums. Les vues matérialisées ou tables étrangères publiques imposent également une revue manuelle. Les objets non système hors public imposent une revue avant export, pour ne pas les ignorer silencieusement. Les empreintes servent à détecter les différences ; elles ne constituent pas une preuve cryptographique absolue de chaque ligne.

Conserver un second exemplaire sécurisé du dump **hors du workspace temporaire**, et vérifier sa restauration avant bascule. Ne publier ni dump, ni manifestes contenant des définitions potentiellement sensibles, ni certificat privé. Le script n'automatise pas la rétention externe ni l'arrêt des writers. Aucune sauvegarde/restauration réelle n'a été déclarée PASS.

## Validation et bascule

1. Exiger comparaison PASS ; vérifier également les objets SQL et séquences. Toute différence : STOP, identifier sa cause.
2. Avec la vraie URL Aiven, lancer `prisma generate` et `prisma migrate status`. Vérifier notamment la migration `202610060001_result_observations` : ne pas lancer de migrate reset ni appliquer automatiquement une migration à la source. Si une migration est en attente, l'examiner et l'appliquer uniquement à Aiven **après** restauration validée et sauvegarde vérifiée, puis réauditer.
3. Configurer `DATABASE_URL` Aiven en **Preview**, en conservant le noindex et sans créer de branche Git. Vérifier que crons/écritures automatiques ne démarrent pas dans la Preview. Tester accueil, listes, live, recherche, détails réels match/joueur, classements, API et requêtes successives. Ne pas lancer `test:seed` / fixtures synthétiques sur Aiven ou Neon.
4. Exiger types/lint/tests/build, DB/UI et SEO. La CI utilise un PostgreSQL jetable ; elle ne valide pas la migration des données de production.
5. Après validation seulement, remplacer `DATABASE_URL` **Production** et redéployer. Archiver l'ancienne connexion dans un stockage sécurisé ; la variable gérée par l'intégration ne suffit pas à elle seule pour un rollback. Vérifier que la synchronisation d'intégration Neon ne réécrit pas la nouvelle variable.
6. Contrôler les deux domaines, les routes demandées et plusieurs détails réels, les erreurs Vercel, les connexions Aiven, quotas, freshness, cache et requêtes successives. Ne pas qualifier un déploiement READY de stabilité démontrée.
7. Conserver Neon et toutes ses variables jusqu'à stabilité démontrée. Proposer seulement ensuite le nettoyage des variables inutilisées.

## Rollback

Configuration : rétablir l'ancienne DATABASE_URL sécurisée et redéployer. **Neon doit être accessible** : son quota épuisé rend aujourd'hui ce rollback indisponible opérationnellement. Un retour vers Neon après écritures nouvelles sur Aiven nécessite une reprise des deltas ; ne pas perdre ces écritures par une simple bascule. Valider la période d'observation avant de réactiver tous les writers.

## Preuves et limites actuelles

- Correctif incident : CI `37590597225`, jobs quality et database-ui SUCCESS, deployment `dpl_2dDtQmy77e4v38QjFuwQWgqVNUq2` READY.
- Protection Prisma : 319 tests, typecheck, lint et build local PASS ; test de conservation SSL/identité et de plafond du pool.
- Audit Aiven en lecture seule : PASS, 0 table public, PostgreSQL 18.6, 2 connexions au contrôle.
- Export Neon, import/restauration Aiven, comparaison de production, migrations Aiven et Preview Aiven : **NON EFFECTUÉS / BLOQUÉS**.
- Aucune URL DB ni variable Neon supprimée ; aucune migration de données prétendue réussie.

Références : [Aiven pg_dump/pg_restore](https://aiven.io/docs/products/postgresql/howto/migrate-pg-dump-restore), [connexions Prisma v6](https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/databases-connections), [SSL Aiven](https://aiven.io/docs/platform/concepts/tls-ssl-certificates).
