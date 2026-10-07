# SEO POST-MODIFICATION — faits et identités sportives

5 octobre 2026. Suite de la passe SEO/GEO sur le projet existant `redragon38/proba-match`, base `master` à `f828972`. Changements locaux, sans nouvelle branche, publication GitHub ou déploiement. Le moteur probabiliste et ses paramètres ne changent pas.

## Corrections utiles

1. **Identités reliées** : les pages de clubs définissent un identifiant `SportsTeam` stable. Les équipes domicile/extérieur des `SportsEvent` et les affiliations des joueurs réutilisent ces mêmes identifiants et URLs. Les joueurs ont un identifiant `Person` et une URL canonique explicites. Les objets sont reliés à leur page principale, sans lien `sameAs` inventé.
2. **Faits lisibles sur les clubs** : un résumé affiche l’équipe, le pays, la compétition du catalogue et le nombre de résultats terminés avec un score exploitable. Le texte précise que l’historique peut regrouper plusieurs saisons et ne garantit pas la couverture complète du club. Il est présent dans le rendu serveur et repris dans la description SEO. Aucune probabilité de victoire n’est déduite de ce nombre.
3. **Dates honnêtes** : un coup d’envoi dont l’heure n’est pas connue conserve uniquement la date source vérifiée. L’heure interne provisoire ne devient pas une heure publiée dans le balisage. Sans date source, la date est omise et le texte indique « date à confirmer ». Les titres de matchs emploient la même règle.
4. **Dates impossibles refusées** : 30 février, heure 24:00, heure sans fuseau confirmé et valeurs invalides ne sont pas publiées comme DateTime. L’information manquante ne devient pas une date normalisée silencieusement par JavaScript.
5. **Profils joueurs plus fiables** : une date de naissance impossible ou future est écartée, y compris du texte rendu. L’âge utilise les anniversaires calendaires à la date de référence des données, au lieu d’une division du nombre de jours par 365,2425. Une référence invalide laisse l’âge indisponible. Le calcul utilise la date UTC du jeu de données ; pour un 29 février, l’anniversaire en année non bissextile est atteint le 1er mars dans cette règle.
6. **Correspondances manquantes** : un profil joueur sans équipe résolue retourne 404 plutôt que d’accéder à une équipe inexistante. Il est exclu du sitemap avec la même condition. Une rencontre sans participants résolus ne produit pas d’objet événement contenant des URLs « undefined ».
7. **URLs d’image contrôlées** : le JSON-LD conserve les images HTTPS publiques et les chemins locaux de la même origine. Les liens à protocole dangereux, contenant un nom d’utilisateur ou mot de passe, ou à origine déguisée sont écartés. Le mécanisme existant d’échappement des scripts JSON-LD est conservé.
8. **Statuts sans invention** : reports et annulations gardent les valeurs Schema.org correspondantes. Une rencontre abandonnée n’est pas transformée en événement normalement programmé et aucun statut « terminé » non standard n’est inventé.

Les informations fictives de démonstration ne deviennent pas des entités sportives publiées comme réelles. Aucun auteur, partenaire, adresse de stade, billetterie, note ou résultat de mesure externe n’est ajouté pour compléter artificiellement un balisage.

## Vérifications

`SEO-ENTITIES-VALIDATION.log` contient le contrôle TypeScript, le lint, **269 tests sur 43 fichiers** et la compilation de production. Les huit nouveaux tests couvrent notamment : identifiants communs, heures inconnues, calendriers impossibles, équipes non résolues, images dangereuses, anniversaires et couverture réellement disponible.

Les contrôles HTTP et navigateur de cette passe sont consignés dans `SEO-ENTITIES-CHECKS.json`, `SEO-ENTITIES-seo-audit.json`, `SEO-ENTITIES-IMPROVEMENT-SSR.json`, `SEO-ENTITIES-responsive.json` et les journaux associés. Le résultat de ces fichiers fait foi. Le résumé d’équipe est aussi vérifié sur une fixture explicitement fictive qui emploie le composant réel : cela ne constitue pas une validation de la base sportive de production.

| Domaine | Statut / périmètre |
| --- | --- |
| Build, types, lint, tests | PASS — validation locale ci-dessus |
| Metadata, canonical, URLs, erreurs techniques | Audit local HTTP/SEO dans les artefacts de cette passe ; pages sportives réelles avec PostgreSQL non disponibles ici |
| Indexation, sitemap et robots | Contrats locaux et tests ; règles de démonstration et preview/staging conservées ; indexation réelle NON VÉRIFIÉE EXTERNEMENT |
| Structured Data | Tests des objets et identifiants ; aucune certification externe de résultats enrichis |
| Maillage, images et mobile | Contrôles locaux plus fixture du composant de club ; crédits et sources existants conservés |
| Performance | Budgets locaux conservés ; aucune amélioration de vitesse ni de Core Web Vitals terrain annoncée |
| Sécurité HTTP | Contrôles locaux ; URLs des images structurées validées |
| Parcours sportifs et DB | NON VALIDÉS sans base alimentée. La suite complète de la passe précédente s’était arrêtée sur l’absence de match à venir ; elle n’est pas présentée comme réussie |
| Classement Google et citations IA | NON VÉRIFIÉS EXTERNEMENT — à mesurer après publication |

## Résultats des contrôles après compilation

PASS : 22 routes et 279 contrôles SEO (zéro FAIL ; un WARNING HTTPS attendu sur l’origine locale HTTP), 129 contrôles de rendu serveur, 14 contrôles HTTP de sécurité, 8 parcours éditoriaux desktop/mobile, 224 vues responsive et 14 séries d’interactions clavier/menu. Les huit vues du composant d’équipe réel sur une fixture de démonstration passent aussi, avec trois filtres de lieu et neuf assertions de métriques par vue, sans débordement, erreur de page ou violation automatique détectée.

Ces contrôles ne remplacent pas les parcours sportifs avec PostgreSQL. Le navigateur teste ici les contrats globaux et éditoriaux de l’application locale compilée ; la fixture teste le composant d’équipe et son résumé séparément. Les règles WCAG automatisées ne constituent pas une certification exhaustive d’accessibilité.

## Limites et suivi

Le catalogue local vide ne permet pas de vérifier les routes sportives avec des données réelles, la synchronisation fournisseur ou les profils en production. Les objets structurés sont vérifiés sur des données contrôlées ; les parcours éditoriaux et contrats globaux sont testés contre l’application locale compilée.

Une date de match ou un nom de stade ne suffit pas à garantir l’éligibilité aux résultats enrichis événement Google. Aucun lieu ou horaire manquant n’est inventé pour obtenir cette éligibilité. Cette passe améliore la cohérence et la fiabilité des informations publiées, sans prétendre augmenter le classement ou les citations IA avant observation.

Références vérifiées : [SportsEvent](https://schema.org/SportsEvent), [SportsTeam](https://schema.org/SportsTeam), [documentation événements Google](https://developers.google.com/search/docs/appearance/structured-data/event). Les procédures de publication et de mesure restent dans `docs/seo-geo-operations.md`.
