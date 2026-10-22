# Réconciliation et déploiement du VPS — 22 octobre 2026

L’archive téléchargée depuis le VPS a été comparée à sa base Git `46210153` et au code validé de `main`. Elle contient 37 fichiers suivis modifiés et 13 nouveaux fichiers applicatifs/tests. Les empreintes originales sont dans `ops/vps-reconciliation-2026-10-22.sha256` ; l’archive brute reste privée et hors Git.

La fusion conserve les redirections HTTP/www directes de Caddy, le worker à un CPU, la publication des prédictions deux fois par heure et le moniteur SEO quotidien. Elle conserve aussi les imports principaux toutes les six heures ajoutés sur GitHub.

Les archives de saisons et leur maillage/sitemap, la protection contre un faux catalogue vide lors d’une panne, la lecture de l’historique de prédiction et la publication progressive avec transactions courtes sont intégrées. La préparation du corpus Elo est partagée par lot, sans changer les coefficients ni les règles d’abstention. Une régression compare les prédictions et leurs archives complètes avec le calcul individuel.

Les conflits sont résolus en gardant les jours civils/fuseaux et le marqueur de révision sans TTL de `main`. Le bilan public garde sa projection SQL et ses métriques/pagination côté serveur ; la projection VPS complémentaire reste disponible pour l’administration. Le bail dédié, son fencing et son nettoyage validés de `main` sont conservés. Les tests de publication vérifient maintenant l’insertion SQL immuable avec `ON CONFLICT DO NOTHING`. Le test DB/UI reste isolé des fournisseurs publics.

## Commande à lancer dans Ubuntu sur le VPS

```bash
cd /opt/proba-match/app && sudo git fetch origin refs/heads/main:refs/remotes/origin/main && deploy_script=$(mktemp /tmp/proba-match-deploy.XXXXXX) && sudo git show origin/main:scripts/deploy-reviewed-vps.sh > "$deploy_script" && sudo bash "$deploy_script"
```

Le script vérifie que le commit, la branche et les 50 fichiers correspondent à l’archive examinée. Un fichier inconnu ou modifié provoque un arrêt avant toute modification. Les deux sauvegardes Caddy non suivies connues restent en place.

Il crée une sauvegarde privée, incluant `.env.vps`, sous `/opt/proba-match/backups/`, et une branche Git locale conservant les adaptations originales. Cette branche n’est pas envoyée sur GitHub. Il avance ensuite `main`, construit les images avant de remplacer les conteneurs, valide Caddy, lance Compose et attend la santé des services. Le cache HTML est régénéré ; les ressources statiques existantes sont conservées. Caddy est redémarré pour lire sa configuration montée.

Aucun `reset`, `clean`, `down`, retrait de volume ou réinitialisation de base. La migration standard `prisma migrate deploy` reste celle du service Compose existant. Le script s’arrête sur une erreur ; la sauvegarde et la branche locale restent récupérables. Ne pas répéter la commande aveuglément après un échec : fournir sa sortie pour poursuivre à partir de l’étape réelle.

Le script et sa répétition isolée ne prouvent pas un déploiement du VPS. Après exécution, vérifier le SHA affiché, l’état Compose, les journaux des imports et le site public. Les mesures et validations du précédent audit sont conservées dans `SEO_AUDIT_FINAL.md` ; les nouvelles preuves de fusion sont dans `artifacts/vps-reconciliation-validation.json`.

La première CI de fusion valide 439 unités, 76 E2E (deux ignorés), le build et PostgreSQL/UI. Son crawl complet découvre deux métadonnées identiques pour deux horaires distincts dans le corpus isolé. Le correctif conserve l’heure réellement connue dans les métadonnées et ne la fabrique jamais pour un horaire inconnu. Les 13 tests ciblés passent ; la validation complète du candidat suivant est consignée dans la preuve JSON. Le contrôle HTTP de sécurité couvre également le nouveau cron SEO authentifié.
