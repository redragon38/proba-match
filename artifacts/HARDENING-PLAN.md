# État des problèmes — durcissement Proba Match

Baseline : `f53cc0c` (master GitHub), checkout cloud `/workspace/proba-match`.
Le score global 82/100 est fourni par le demandeur ; le barème et les notes détaillées de l'audit ne figurent pas dans le dépôt. Ne pas fabriquer une comparaison chiffrée.

| Problème | Présent au départ | Correction | Vérification |
|---|---|---|---|
| Import ESPN dans postbuild | Oui | Commande explicite football:initialize, cron/worker conservés | Build sans DB/provider + tests bootstrap |
| Éditeur/contact/coordonnées absents | Oui, données personnelles non disponibles | Configuration publique centralisée, champs absents explicites | Tests légaux, pages navigateur |
| CSP partielle | Oui | Directives explicites et HTTPS seulement sur production Vercel | Tests headers + navigateur hydratation |
| CI E2E catalogue vide | Oui, rapport GitHub relu | PostgreSQL isolé et fixtures synthétiques gardées hors production | Exécution CI et E2E |
| DB/UI cron secret absent | Oui | Secret uniquement de test dans le processus isolé | Contrats DB/UI |
| Possession ESPN 0–0 / bloc zéro | Oui, 115 lignes locales | Normalisation import et lecture du stock existant | Contrôle données + régression null vs zéro |
| Cache sans compteurs | Oui | Compteurs bornés, scope par processus | Tests coalescence/échec, sonde locale |
| API/DB/moteur sans durée visible | Oui | Mesures bornées et Server-Timing | Sonde locale et health protégé |
| Sync compte joueurs absent | Oui | Champ historique SyncRun.matches compte les éléments du job | Tests / health |
| Recherche faute simple | Oui | Repli borné, accents déjà gérés | Tests typo et charge recherche |
| Texte secondaire 10–11px | Oui, 100 déclarations | 12px sans changement d'identité | Matrice responsive / axe / reflow |
| Admin limiter multi-instance | Déjà corrigé | PostgreSQL partagé conservé | Contrats sécurité |
| Catalogue/comparateurs gros payload | Déjà corrigé | Pagination existante conservée | E2E / payloads |
| Domaine/canonical/sitemap centralisés | Déjà corrigé | Domaine actuel conservé | Audit SEO complet |
| Favoris/probabilités/tabs | Fonctionnels | Contrats existants conservés | E2E / tests moteur |
| CrUX/Search Console/lecteurs écran | Accès absent | Checklist et limites explicites | Action humaine, aucun PASS fictif |
