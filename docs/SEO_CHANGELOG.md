# Correctifs du cycle 2

- Reprise des résultats publics confirmés, fenêtre de rattrapage sept jours, identités vérifiées, périodes de score explicites, archivage immuable préservé.
- Verrous de jobs renouvelés sur connexion dédiée, reprises bornées, import partiel503, logs sûrs, import toutes les six heures.
- Révision de données : TTL zéro pour le petit marqueur SQL, lecture mutualisée entre requêtes simultanées et cache long du corpus conservé par révision ; dernière version explicitement dégradée si la base échoue. Deux tests de régression et diagnostic serveur/navigateur.
- Calendrier minuit/fuseau/URL cohérent, filtres explicites préservés ; rattrapage en jours civils parisiens testé aux deux changements d’heure ; cas7% Levante–Athletic testé avec paramètres publiés.
- Bilan projeté côté SQL, métriques complètes côté serveur, vingt lignes transmises et regroupement selon saison enregistrée.
- Profils : nationalités connues traduites, champs absents non inventés, données historiques inutilisées retirées sans changement de rendu ; buteurs et cartons conservés.
- Fiches match : WebPage et BreadcrumbList factuels ; absence de lieu ne produit plus d'Event public incomplet ; enum Schema.org corrigée.
- Surveillance SEO JSON/Markdown/priorités/empreinte/checkpoints/reprise, résolution des href relatifs, absence de faux succès sur audit incomplet.
- Auth GitHub OIDC main/master avec workflow_ref sur même branche ; tests cryptographiques. Vitest borné pour mémoire limitée.
- CI : audit complet du corpus local sans attente réseau publique artificielle, 500 liens supplémentaires explicitement bornés ; test auth interne déterministe.

Aucune migration de schéma, remise à zéro de DB, donnée sportive de production inventée, suppression de fonctionnalité, force-push ou nouveau service payant. Déploiement VPS à effectuer après réconciliation de ses modifications locales.
