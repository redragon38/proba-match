# Prédictions : perte du verrou confirmée sur le VPS

## Preuve fournie par le propriétaire

Le diagnostic PostgreSQL du 20 octobre 2026 indique zéro prédiction pour Brest–Nice,
21 prédictions au total et deux traitements predictions terminés en échec avec
SYNC_LEASE_LOST. Un troisième traitement est encore running lors de la lecture.
Cette erreur annule la transaction de publication avant sa validation.
Elle confirme une perte du bail ; elle ne précise pas à elle seule si le
renouvellement a échoué par attente de pool, indisponibilité DB ou changement d'owner.

## Défaut corrigé

footballJob réservait un PrismaClient distinct au renouvellement uniquement si
VERCEL était défini. Sur le VPS, renouvellement, publication longue et requêtes
cron concurrentes partageaient le même pool. Une attente ou erreur de renouvellement
marque irréversiblement le bail perdu et empêche la publication.

- Réserver une connexion de renouvellement distincte sur toutes les plateformes,
  limitée à une connexion, après acquisition du verrou seulement.
- Établir cette connexion et confirmer immédiatement la propriété avant le travail.
- Ne pas empiler plusieurs renouvellements si une requête est lente.
- Arrêter le timer, attendre le renouvellement en cours, libérer uniquement son
  propre token et fermer le client même si la libération échoue.
- Garder la protection fail-closed : aucun bail expiré ou remplacé n'est ignoré.
- Journaliser les échecs de renouvellement et changements de propriétaire avec
  des codes contrôlés, sans message brut, URL ni identifiant de connexion.
- Le script reconnaît les fichiers des trois versions connues (fc9214f, b938676,
  c20da88), applique les modifications manquantes et refuse les conflits locaux.
  Il vérifie Brest–Nice sans cache puis affiche les codes sûrs du worker en cas d'échec.

## Validation

- PASS : 392 tests, 69 fichiers ; TypeScript et build de production réussis.
- PASS : tests ciblés du bail : VPS sans VERCEL et pool principal indisponible,
  renouvellements sur 90 secondes simulées via la connexion indépendante,
  propriétaire remplacé (publication empêchée), renouvellements lents sans
  chevauchement, erreur de connexion, nettoyage et absence de client créé si occupé.
  Ce sont des tests avec adaptateurs et horloge isolés, pas une mesure PostgreSQL VPS.
- PASS : lint sans erreur ; deux avertissements img préexistants sur les images OG.
- PASS : syntaxe Bash du script complet.
- PASS : application réelle du préfixe Bash de patch depuis les trois versions,
  deuxième application idempotente et refus de conflit sans écrasement.
  Banc Windows Git Bash : chemin de travail et contrôle commit remplacés par un
  dossier et un arbre Git isolés ; install/chmod remplacé par mkdir pour les ACL Windows.
  Docker, appel du traitement et contrôle de la page sur Ubuntu restent à vérifier.
- PASS : 18 contrôles HTTP de sécurité sur le serveur de production local.

## SEO POST-MODIFICATION

Build : PASS. Indexation : NON VÉRIFIÉE EXTERNEMENT. Metadata, URLs, Canonical,
Sitemap, Robots, Maillage, Images, Mobile, Structured Data, Erreurs techniques :
PASS sur le périmètre local sans base : 299 contrôles, 24 pages, 14 vues navigateur,
aucun échec, avertissement ou lien cassé découvert.
Performance : NON TESTÉ pour le VPS et les CWV terrain. Aucun contenu, routing,
metadata, coefficient ni archive existante n'a été modifié dans cette phase.

## Limite de validation externe

Pas d'accès direct à la base ou au Docker du VPS dans cette session. La disparition
de SYNC_LEASE_LOST et l'affichage des probabilités doivent être confirmés par la
sortie du script : status success, compteurs de publication et predictionVisible true.
Ne pas supprimer manuellement le verrou ni forcer la publication sans sa vérification.
