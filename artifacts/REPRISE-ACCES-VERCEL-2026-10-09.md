# Accès Vercel et diagnostic Aiven

La connexion Vercel autorise les modifications de variables et la création de déploiements, mais refuse l'accès HTTP aux Previews protégées (`read_protection_bypass`, HTTP 403). Les logs de build retournent 404 avec et sans le teamId connu. Ne pas désactiver Deployment Protection pour contourner ce refus.

## Actions effectuées

- `AIVEN_DATABASE_URL` existante étendue de Production à Production + Preview, sans changement de valeur.
- `PROBA_DB_DIAGNOSTICS_TOKEN` créée, sensible, Preview uniquement. Aucun secret stocké dans ce rapport.
- `PROBA_DB_DIAGNOSTICS_ENABLED=false` créée en Preview (réservée, non utilisée par le diagnostic minimal).
- Diagnostic minimal Next.js en Preview : `dpl_FvU7oFeyfDzB2371xNHJwbFrTTHA`, READY, sans alias Production. Endpoint `/api/audit`, authentifié par un jeton temporaire, Cache-Control no-store, transaction PostgreSQL READ ONLY, timeout connexion/requêtes 10 secondes. Retourne uniquement le fournisseur, tables, comptes et état des migrations ; jamais l'URI.
- Premier essai minimal sans Next.js : `dpl_ErF2B9KpZCpxv9dgJSUUiLENVG7y`, ERROR NEXT_NO_VERSION. Remplacé par le diagnostic Next.js ; aucun impact Production.

## Résultat vérifié

La lecture de la Preview a été refusée par Vercel avant l'exécution du diagnostic. La connexion Aiven et ses volumes restent donc inconnus, malgré READY.

Les trois domaines Production continuent de servir `/joueurs` en mode secours OpenFootball, sans lien joueur ; `/api/updates` retourne 503. Aucun changement de DATABASE_URL Production, aucune migration ou écriture distante, aucune reconstruction exécutée.

## Reprise nécessaire

### Nouvelle vérification après confirmation utilisateur des accès

L'équipe et le projet sont bien identifiés. Avec le teamId explicite, la création de Preview retourne désormais `403 forbidden: You don't have permission to create a Preview Deployment for this Vercel project: proba-match`. La lecture de la Preview reste refusée ; la consultation des logs Production retourne aussi 403. La consultation du déploiement avec le slug explicite retourne 404. Ces résultats ne constituent pas un accès opérationnel rétabli.

Le workspace n'a toujours aucun secret DATABASE_URL, AIVEN_DATABASE_URL ou VERCEL_TOKEN configuré ; environnement révision 8, observations à jour. Ne pas répéter les demandes de reconnexion à l'identique : un accès Vercel effectif pour cette équipe, ou une identité CLI distincte autorisée et configurée, est nécessaire.

### Diagnostic après authentification Vercel CLI

L'authentification par appareil Vercel CLI a réussi pour le compte propriétaire et l'équipe `redragon38s-projects`. Un diagnostic Next.js protégé a comparé les deux connexions depuis une Function Vercel, avec transaction `READ ONLY`, délais de 10 secondes et sans retourner les mots de passe.

- `DATABASE_URL` Production : Neon, base `neondb`, rôle `neondb_owner`, connexion refusée avec le code PostgreSQL `53000` (ressources/quota).
- `AIVEN_DATABASE_URL` : Aiven, base `defaultdb`, rôle `avnadmin`, connexion refusée avec `28P01` (authentification PostgreSQL invalide).
- Le compte Aiven utilise GitHub OAuth. Le mot de passe de compte communiqué comme mot de passe Aiven ne permet pas l'authentification API et n'est pas le mot de passe PostgreSQL du service.

La cible Neon a été ajoutée temporairement à Preview pour cette comparaison, puis ramenée à Production uniquement. Aucune requête d'écriture, migration, reconstruction ou bascule de `DATABASE_URL` n'a été exécutée.

Action externe nécessaire : dans Aiven Console, se connecter via GitHub au projet correspondant au service `pg-29e0de3f-project-6d77`, réinitialiser ou recopier le mot de passe de service du rôle `avnadmin`, puis remplacer `AIVEN_DATABASE_URL` dans Vercel. Le diagnostic pourra alors vérifier tables, migrations et volumes avant toute bascule Production.

Réautoriser l'application Vercel pour le projet proba-match et l'équipe redragon38s-projects, comme demandé explicitement par l'erreur Vercel. Ensuite lire le diagnostic via l'accès Vercel authentifié. Le jeton peut être remplacé et le diagnostic redéployé si la session qui le détient est terminée.

Ne basculer la connexion Production qu'après vérification des tables, migrations, données et historique de prédictions. Si Aiven est vide, préserver Neon et préparer une restauration ou une reconstruction séparée explicitement documentée avant la bascule. Reprendre ensuite les imports joueurs corrigés et vérifier les données dans la vraie UI. Supprimer les variables et déploiements temporaires après le diagnostic ; la disponibilité des opérations de suppression n'est pas établie avec cette connexion.
