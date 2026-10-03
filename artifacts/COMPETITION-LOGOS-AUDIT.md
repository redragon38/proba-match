# Logos des compétitions — SEO POST-MODIFICATION

Vérification locale du 3 octobre 2026. Logos API-Sports copiés dans `public/competition-logos`, optimisés en WebP (sources conservées dans `sources.json`). Ligue 1, Premier League, Bundesliga, La Liga, Serie A et Ligue des champions sont couverts ; seules les compétitions présentes dans les données sont affichées. Les compétitions inconnues conservent leur logo fournisseur ou leur drapeau. Aucun championnat ni résultat ajouté.

Composants concernés : menu latéral, catalogue et fiche compétition, groupes et cartes de matchs, fiche match. Images avec dimensions fixes, texte alternatif, fond blanc pour les thèmes clair/sombre et secours en cas d'échec.

| Contrôle | Résultat |
| --- | --- |
| Build, TypeScript | PASS |
| Lint | WARNING : un avertissement préexistant dans opengraph-image.tsx, aucune erreur |
| Tests unitaires | PASS : 169 tests |
| Indexation, Metadata, URLs, Canonical | PASS en configuration production locale |
| Sitemap, Robots, Maillage | PASS |
| Images, Mobile, Structured Data, Erreurs techniques | PASS |
| Performance | PASS pour les contrôles locaux de poids et d'affichage ; CWV terrain NON TESTÉ |
| Services SEO publics et déploiement | NON VÉRIFIÉ EXTERNEMENT |

Audit SEO : 158 pages, 2 044 contrôles, 10 vues navigateur, aucun échec ni avertissement. 1 170 liens découverts, 1 013 contrôles complémentaires, aucun lien cassé. Audit dédié logos : 30 images visibles chargées sur le catalogue et les cinq fiches, aux largeurs 390 et 1 440 px ; aucune erreur JavaScript ni débordement horizontal. Captures et rapport JSON conservés localement dans `.local/`.

Tests E2E : 36 réussites, 2 échecs préexistants sur les profils de vrais joueurs (desktop et mobile), absents de cette base locale. Cette modification ne touche ni les joueurs ni la base de données. Action manuelle restante : restauration des données joueurs pour ces deux tests et contrôle du déploiement public.
