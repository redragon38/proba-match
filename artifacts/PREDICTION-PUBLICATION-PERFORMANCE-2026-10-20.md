# Prédictions toujours absentes après import — correctif de calcul

## Constat externe

Le 20 octobre 2026, Brest–Nice du 23 octobre affiche le nouveau message d'absence
et 39 résultats par équipe : le code précédent et l'import historique sont donc
visibles. Aucune prédiction n'est encore affichée lors de cette vérification.
Sans les journaux du VPS, la cause exacte d'un échec ou d'un retard de publication
reste NON VÉRIFIÉE EXTERNEMENT.

Le corpus public Ligue 1 comprend 353 résultats et 3 704 révisions de résultats.
Plusieurs révisions ont les mêmes champs métier mais des dates de réception
différentes. Le moteur calcule une prédiction Brest–Nice sur ce corpus : il ne
manque donc plus l'échantillon nécessaire.

## Défauts reproduits dans le code

- La comparaison JSON des révisions dépend de l'ordre des clés. PostgreSQL jsonb
  réordonne ces clés, provoquant des ajouts inutiles au journal à chaque import.
  Les sous-objets des scores peuvent aussi redater inutilement la réception.
- Le replay Elo replie tout l'historique à chaque révision identique d'un résultat.
- Le traitement recalcule le même contexte temporel et Elo pour chaque prévision.
  Ce travail peut retarder le traitement et le renouvellement de son bail.
  Aucun dépassement du bail du VPS n'est affirmé sans son journal.

## Correction

- Comparaison des valeurs en ordre fixe, indépendamment des clés JSONB imbriquées.
- Les révisions existantes restent intactes ; seules les recalculs Elo sans effet
  sont évités. Corrections, retraits, rétablissements et terrain neutre restent traités.
- Un contexte par corpus, mode de disponibilité et cutoff pour le traitement.
  Aucun cache global ; les anciens instantanés ne sont ni réécrits ni recalculés.
- Le contexte reconstruit n'est préparé que si nécessaire et reste distinct du
  contexte strict. Les cibles historiques sont toujours exclues de leurs entrées.
- Le traitement rend la main à l'event loop entre calcul et publication pour
  permettre l'exécution des timers de renouvellement du bail.
- Aucun coefficient, seuil de qualité ou numéro de modèle n'est modifié.

## Mesure locale et parité

Même corpus public de 353 matchs, même cutoff fixé à 2026-10-20T17:10:00Z :
- calcul individuel avant : 6 011,91 ms ; après : 535,70 ms ;
- 20 appels successifs au contexte préparé sur la même cible : 601,97 ms au total ;
- objet public de prédiction et hash d'entrée identiques, comparaison profonde ;
- ratings et historique Elo (y compris timestamps et ordre) identiques au replay
  enregistré avant modification sur ce corpus.

Ces mesures sont locales, sur un sous-corpus Ligue 1 et une cible répétée. Elles
ne mesurent ni le débit global ni le temps réel de publication sur le VPS Ubuntu.

## Validation

- PASS : 388 tests dans 69 fichiers, deux workers, suite complète.
- PASS : TypeScript, build de production, lint sans erreur (deux avertissements
  img préexistants dans les images Open Graph).
- PASS : 299 contrôles SEO sur 24 routes locales sans base, 14 vues navigateur,
  aucun échec, avertissement ni lien cassé découvert.
- PASS : 8 tests Playwright desktop/mobile des guides et de leur navigation.
- PASS : 18 contrôles HTTP de sécurité.
- PASS : patch incrémental depuis b938676, application et détection d'idempotence.
- PASS : syntaxe Node du script et reconnaissance d'une page avec/sans prédiction
  sur deux fiches publiques. Le script Bash/Docker complet sous Ubuntu reste NON TESTÉ.

Tests dédiés : JSONB avec ordre de clés inversé, conservation de la première
réception, corrections réelles, parité individuelle/lot avec et sans archive,
séparation strict/reconstruit, exclusion de cible historique, révisions redondantes,
retraits et rétablissements, préparation unique pour plusieurs publications.

Le script de déploiement applique cette seconde phase par rapport au commit
b938676, dont les fichiers applicatifs ont été déployés lors de la première phase.
La branche Git du VPS peut toujours pointer vers fc9214f : seuls les fichiers
déployés servent de contexte au patch. Aucun reset ni écrasement forcé n'est utilisé.
La présence du nouveau message et des 39 résultats a été vérifiée publiquement.

L'exécution PostgreSQL/Docker réelle, les logs de publication et les compteurs
created/unavailable du VPS restent à vérifier après le déploiement.
Le script contrôle ensuite Brest–Nice directement sur app:3000, sans le cache
Nginx. Il exige un HTTP valide et les éléments des probabilités rendus côté serveur,
affiche predictionVisible et termine en erreur si la prédiction est encore absente.

## SEO POST-MODIFICATION

Build : PASS. Metadata, URLs, Canonical, Sitemap, Robots, Maillage, Images,
Mobile, Structured Data et Erreurs techniques : PASS sur le périmètre local sans
base audité. Indexation Google : NON VÉRIFIÉE EXTERNEMENT. Performance : PASS
pour la mesure locale décrite, NON TESTÉ pour la charge du VPS et les CWV terrain.
Les fiches sportives avec PostgreSQL de production ne sont pas validées par
l'audit local sans base. Aucun résultat de Search Console ou de CrUX n'est déduit.
