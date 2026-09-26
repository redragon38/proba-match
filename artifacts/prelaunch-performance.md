# MatchScore — performance pré-lancement

## Correction vérifiée dans le code

Les pages recherche et favoris sérialisaient tout le dataset football, puis reconstruisaient l’index dans le navigateur. Les fiches compétition transmettaient toutes les rencontres de toutes les saisons pour afficher au plus 20 matchs.

- Recherche : index complet conservé sur le serveur ; HTML initial avec 25 résultats, puis pagination et filtres via l’API interne. Compteurs et recherche portent sur tout le catalogue.
- Favoris : seuls les identifiants stockés localement sont envoyés à un endpoint de lecture ; résultats paginés, cache privé désactivé. Aucun compte nécessaire ; aucun appel au fournisseur football dans le navigateur.
- Compétition : agrégats et classement historique calculés avec l’intégralité de la saison côté serveur ; transmission des seules 20 rencontres visibles, des équipes concernées et des meilleurs joueurs. Autres saisons et filtres restent disponibles par navigation.
- La recherche annule les requêtes devenues obsolètes et conserve un bouton de nouvelle tentative. Les logos, compteurs, étoiles et listes restent disponibles.


## Mesures sur le catalogue réel

Mesure du 20 septembre 2026 : 129 équipes, 7 008 rencontres et 5 compétitions. Taille UTF-8 du JSON des props serveur/client, avant/après à données identiques. Ce sont des octets non compressés de props, pas le poids HTML total ni le transfert réseau.

| Page | Avant (octets) | Après (octets) | Réduction |
|---|---:|---:|---:|
| /recherche | 3948737 | 7268 | 99.82 % |
| /favoris | 3948737 | 251 | 99.99 % |
| /competition/ligue-1 | 717506 | 17507 | 97.56 % |
| /competition/premier-league | 882383 | 18444 | 97.91 % |
| /competition/bundesliga | 717503 | 17533 | 97.56 % |
| /competition/la-liga | 882689 | 18529 | 97.90 % |
| /competition/serie-a | 882700 | 18206 | 97.94 % |

Preuve : artifacts/performance-payloads.json. Les favoris chargent ensuite uniquement les pages de la sélection de l’utilisateur. Une compétition envoie les données de la saison affichée ; changer de saison demande une nouvelle projection serveur.

## Vérifications

| Contrôle | État | Preuve |
|---|---|---|
| Projection bornée recherche/favoris | PASS | Tests parcourant toutes les pages et retrouvant un favori en fin de catalogue ; détails des matchs absents des résultats. |
| Saison complète / classement | PASS | 80 résultats contrôlés ; les métriques et points utilisent les 80 matchs, alors que seuls les 20 affichés sont transmis. |
| Live dans la liste compétition | PASS | Minute, phase, temps additionnel et cartons rouges préservés par test unitaire. |
| Tests unitaires ciblés | PASS | `npx vitest run tests/payload-projection.test.ts` : 4/4. |
| Lint ciblé | PASS | Fichiers modifiés et nouveaux tests validés par ESLint. |
| Compilation / TypeScript | PASS | Build final commun et typecheck confirmés par la validation du projet. |
| Parcours navigateur après build | NON TESTÉ | Trois nouveaux scénarios desktop/mobile prêts dans `tests/e2e/payload-performance.spec.ts` ; validation par l’audit final. |
| HTML servi après build | NON TESTÉ | À mesurer sur le nouveau serveur de production local. |
| Core Web Vitals terrain / PSI | NON TESTÉ | NON VÉRIFIÉ EXTERNEMENT. Les tailles de payload ne constituent pas une mesure LCP, INP ou CLS. |

Les mesures détaillées des props ont été produites par `.local/measure-projections.ts` dans `artifacts/performance-payloads.json`. Les tailles HTML finales et l’audit SEO restent à compléter après le build final commun. Aucune dépendance ajoutée, aucun changement de framework ou de design.


## Complément final — 21 septembre 2026

26 E2E PASS, dont les six nouveaux scénarios performance desktop/mobile. HTML final mesuré : recherche 73 518 octets, favoris 31 493, Ligue 1 130 484, Premier League 136 100, La Liga 138 221. Audit responsive : 210 vues et 14 interactions PASS. Aucun avertissement de poids HTML dans l’audit SEO final. Ces preuves remplacent les mentions NON TESTÉ des parcours/HTML dans le tableau intermédiaire ci-dessus. CWV terrain et PageSpeed restent NON VÉRIFIÉ EXTERNEMENT.
