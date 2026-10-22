# Vérifications finales — publication du 22 octobre 2026

Code testé : 43850598cf0162fe7606f4d4483ad877a615d9af. [CI finale](https://github.com/redragon38/proba-match/actions/runs/39669708252) : quality et database-ui réussis. Les captures publiques sont du 21 octobre ; elles précèdent le déploiement du candidat.

| Vérification | Résultat | Preuve / limites |
| --- | --- | --- |
| npm run check local et CI | PASS | TypeScript, lint zéro erreur/deux avertissements img préexistants, 427 tests/79 fichiers, build de production ; artifacts/seo-mission2-check-delivery.log |
| E2E CI | 74 réussis, 2 ignorés | Scénario conditionnel journée vide desktop/mobile ignoré car les fixtures ont des rencontres aujourd’hui |
| PostgreSQL/Prisma/UI isolé | PASS | Deux imports automatiques, bail/reprise, idempotence, live, résultats, blessures, quotas/panne, nouvelle rencontre et nouvel horaire visibles automatiquement, profils 320/390/1440 px, administration/worker |
| SEO build final | 600 pages, 9599 contrôles, 20 vues, zéro échec | Seul avertissement : jeton de santé authentifiée absent ; corpus isolé, pas le VPS |
| Rendu profils | PASS | HTML équipe et sept onglets match avant/après identique ; événements conservés |
| SQL projeté | PASS | Requête réellement exécutée dans PGlite ; intégration PostgreSQL complète distincte ci-dessus |
| E2E local initial | 20/20 PASS | Desktop/mobile ; artifacts/seo-mission2-e2e.log ; précède les derniers ajustements |
| Sécurité HTTP locale | 18/18 PASS | artifacts/seo-mission2-security-http.json |
| SEO local initial sans DB | 24 pages, 303 contrôles, 16 vues, zéro échec | Périmètre antérieur ; rapport compressé conservé |
| Crawl public complet | 6635 pages, 96598 contrôles | Ancienne version : 4728 Event sans lieu, 1227 avertissements de poids ; rapport brut conservé |
| Maillage public | Zéro cassé sur 500 HEAD, zéro orphelin recalculé | 46146 liens découverts ; échantillon supplémentaire explicitement limité ; résolution des liens relatifs corrigée |
| Google Rich Results | URL publique FAIL / code candidat PASS | Résultats externes liés dans SEO_AUDIT_FINAL.md ; CODE ne prouve pas un déploiement |
| PageSpeed public | Accueil mobile/desktop : quatre scores 100 | LCP mobile 1426 ms, desktop 421 ms ; aucune donnée terrain ; aucune amélioration candidate déduite |
| Sonde publique après push | Sept routes HTTP 200 | Fiche cible contient encore SportsEvent : ancienne version ; seo-mission2-postpush-public.json |
| VPS / santé authentifiée / Search Console | NON VÉRIFIÉS | Archive de modifications non récupérée, accès privés absents |
| Vercel | Statut failure | Lien officiel de compte bloqué ; ne renseigne pas le déploiement Docker |

## Échecs intermédiaires résolus

Vitest non borné épuisait la mémoire : un worker/30 s, sans retrait de tests. Une projection de profil supprimait des événements utiles : conservation des événements et vérification exacte du rendu.

La CI DB/UI a révélé un vrai cache de marqueur périmé. Retirer seulement la fenêtre stale ne suffisait pas : le TTL de dix secondes masquait encore un nouvel import. Le marqueur a maintenant TTL zéro et coalescence concurrente ; le corpus complet conserve son cache par version. Tests à 1 ms et validation réelle de la nouvelle rencontre et du changement d’horaire passent.

L’import externe partiel garde son statut 503 ; l’authentification réussie est testée sur le cron interne déterministe. L’origine localhost:3001 est configurée dans le serveur CI isolé pour respecter la protection same-origin de production. Les décalages de dates civiles lors des changements d’heure ont deux régressions dédiées.

Les démarrages locaux finaux ont été refusés par le contrôle automatique (« blocked by policy »). Aucun contournement : la CI existante a exécuté et réussi l’intégration PostgreSQL/UI complète. Les serveurs locaux et le cluster de test sont arrêtés.

Le premier crawl interrompu n’est pas compté. La seconde passe a réellement terminé le corpus public. Les rapports antérieurs et les essais CI sont identifiés séparément ; aucun test ignoré ou résultat ancien n’est compté comme réussite finale.
