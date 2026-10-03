import { publicMetadata } from '@/lib/seo';
export const metadata = publicMetadata('/methodologie');
export default function Page() {
  return (
    <article className="page prose">
      <span className="eyebrow">COMPRENDRE AVANT DE CONCLURE</span>
      <h1>
        Des chiffres. Une méthode.
        <br />
        Aucune certitude.
      </h1>
      <p className="intro-text">
        Notre rôle est de rendre le football plus lisible. Voici exactement ce que notre première
        version calcule, et ce qu’elle ne sait pas encore.
      </p>
      <p>
        Proba Match calcule automatiquement ses probabilités avec un modèle statistique
        Elo–Poisson. Les explications sont assemblées selon des règles à partir des données et
        des facteurs calculés, sans IA générative. Elles décrivent une estimation du modèle,
        pas une certitude sur le déroulement du match.
      </p>
      <section>
        <h2>01 — Des sources clairement identifiées</h2>
        <p>
          Les calendriers et résultats proviennent d’OpenFootball, importés dans notre base
          PostgreSQL. Cette source gratuite n’exige aucune clé API. Sa mise à jour dépend des
          contributions : elle ne garantit pas un suivi en direct. Les classements Proba Match sont
          calculés sur les résultats disponibles.
        </p>
        <p>
          Les données avancées peuvent être enrichies par{' '}
          <a href="https://www.api-football.com/documentation-v3">API-Football / API-Sports</a>.
          Elles sont normalisées, synchronisées par le serveur et conservées en base. Les visiteurs
          ne déclenchent pas de requête fournisseur. Une information absente est indiquée comme non
          disponible.
        </p>
      </section>
      <section>
        <h2>02 — Elo : le niveau relatif</h2>
        <p>
          Chaque équipe commence à 1 500 points. Après une rencontre, son rating évolue selon le
          résultat, l’adversaire et l’écart de buts. Le moteur utilise K = 24 et un avantage domicile de
          60 points, paramétrables dans le moteur. L’écart de buts est amorti par un logarithme. Les
          historiques de rating sont conservés.
        </p>
        <code>E(domicile) = 1 / (1 + 10 ^ ((Elo extérieur − Elo domicile − 60) / 400))</code>
      </section>
      <section>
        <h2>03 — Forme, adversaires et récence</h2>
        <p>
          Depuis la version 1.1, la force de chaque adversaire est celle connue avant la rencontre
          historique. L’indice de forme compare le résultat à l’attente Elo, sur dix matchs au
          maximum et avec une demi-vie de 30 jours. L’écart de forme multiplie l’ajustement de buts
          par exp(0,12 × écart / 100). Ce paramètre conservateur reste à valider sur données réelles
          ; il ne constitue pas une preuve d’amélioration.
        </p>
        <p>
          Le modèle retient jusqu’à 20 matchs terminés par équipe et exige au moins cinq observations de
          chaque côté. Le poids diminue de moitié tous les 60 jours. Un match joué dans le contexte
          domicile/extérieur opposé reçoit un poids de 0,65. La force adverse ajuste les buts
          observés par un facteur borné de 0,75 à 1,30.
        </p>
        <p>
          Le modèle combine 60 % de la production offensive d’une équipe et 40 % des buts encaissés
          par son adversaire. Un ajustement Elo modéré et borné répartit ensuite la force entre les
          deux équipes. Les espérances de buts sont bornées entre 0,15 et 4,5.
        </p>
      </section>
      <section>
        <h2>04 — Poisson : des buts aux probabilités</h2>
        <p>
          Deux distributions de Poisson indépendantes donnent une probabilité à chaque score. La
          matrice couvre 0 à 30 buts par équipe, puis est normalisée. La somme des cases où le
          domicile gagne donne la probabilité « 1 » ; la diagonale donne « N » ; les autres cases
          donnent « 2 ». Les trois pourcentages affichés totalisent 100 % grâce à un arrondi par
          plus grands restes.
        </p>
        <code>P(buts = k) = exp(−λ) × λ^k / k!</code>
        <p>
          Les buts attendus ici sont les espérances du modèle ; ils ne sont pas des xG de tirs. Le
          score le plus plausible reste une possibilité dont la probabilité peut être faible. Les
          probabilités de clean sheet suivent exp(−λ adverse).
        </p>
        <p>
          Depuis la version 1.2, le rapport entre les deux espérances de buts est réduit à 80 % de
          sa valeur logarithmique, sans modifier leur moyenne géométrique. Ce paramètre a été choisi
          sur les matchs antérieurs à 2025, puis vérifié sur 2025 et 2026 séparément. Les probabilités
          « les deux marquent », buts totaux, marges et scores possibles proviennent de cette même
          matrice, sans modèle supplémentaire. La probabilité d’un score précis reste faible.
        </p>
      </section>
      <section>
        <h2>05 — La confiance décrit les informations</h2>
        <p>
          Le score de confiance est une heuristique de qualité des données : volume historique (35
          points), récence (20), compositions (10), blessures (5), stabilité (15), couverture
          statistique (15). Il ne mesure ni la certitude d’un résultat ni une performance validée du
          modèle.
        </p>
        <p>
          Le modèle utilise les résultats, les lieux, les dates et l’Elo. Il ne transforme pas les
          absences, la fatigue, la météo, les compositions, les xG/xA ou les confrontations directes
          en ajustements de force sans un modèle validé. Les compositions disponibles améliorent
          seulement la qualité des informations. Possession, tirs, corners et cartons projetés
          restent « Données insuffisantes ».
        </p>
      </section>
      <section>
        <h2>06 — Les joueurs : une évaluation adaptée au poste</h2>
        <p>
          L’indice descriptif sur 100 combine la note du fournisseur et des métriques par 90
          minutes. Les attaquants et milieux utilisent buts, passes et tirs ; les défenseurs, tacles
          et interceptions ; les gardiens, arrêts et buts encaissés. Le calcul exige au moins 90
          minutes et les métriques essentielles du poste. Une métrique manquante bloque le calcul au
          lieu de devenir zéro.
        </p>
        <p>
          La liste « Joueurs à suivre » pondère cet indice par la part de titularisations. Il s’agit
          d’un classement heuristique exploratoire, pas d’une probabilité d’être homme du match. La
          v1 ne prétend pas ajuster cet indice à la fatigue ou à la composition adverse.
        </p>
      </section>
      <section>
        <h2>07 — Un historique qui ne réécrit pas le passé</h2>
        <p>
          Les prédictions réelles sont créées lors des synchronisations avant le coup d’envoi. La
          première version et la version tenant compte de la disponibilité des compositions sont
          stockées séparément, sans mise à jour rétroactive. Des contraintes et un déclencheur
          PostgreSQL empêchent une écriture initiale tardive et les modifications de prédictions.
        </p>
        <p>
          Le backtest parcourt les matchs dans l’ordre. Seules les rencontres terminées dont le coup
          d’envoi précède la cible d’au moins trois heures dans le test historique initial, puis de
          24 heures dans le test de validation renforcé. Les statistiques
          saisonnières actuelles, blessures actuelles et compositions connues plus tard sont
          exclues. Ce délai conservateur ne remplace pas un journal historique de disponibilité
          exacte des données ; les imports doivent être audités. Les métriques de ce test
          rétrospectif ne sont pas celles de prédictions réellement publiées avant-match.
        </p>
      </section>
      <section>
        <h2>08 — Limites à garder en tête</h2>
        <p>
          Le football est peu prévisible. Les cartons rouges, rotations, changements tactiques et
          petits échantillons peuvent rendre ces estimations fragiles. L’indépendance des deux
          distributions ignore certaines corrélations entre scores. La validation chronologique
          réduit certaines erreurs observées, mais ne prouve pas une amélioration future sur toutes
          les compétitions. Le nombre de prédictions publiées puis évaluées reste insuffisant pour
          mesurer la performance réelle en production.
        </p>
        <p>
          Les données réelles peuvent être retardées ou incomplètes. Une rencontre annulée ou
          reportée n’est pas présentée comme un résultat normal. Le site ne propose aucune
          transaction de jeu d’argent.
        </p>
        <blockquote>
          Les projections présentées sont des estimations statistiques et ne garantissent aucun
          résultat sportif.
        </blockquote>
      </section>
    </article>
  );
}
