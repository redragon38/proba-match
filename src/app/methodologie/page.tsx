import { Breadcrumbs } from '@/components/breadcrumbs';
import { JsonLd } from '@/components/json-ld';
import { editorialPageData } from '@/lib/editorial';
import { EditorialContext, EditorialLinks } from '@/components/editorial-context';
import { publicMetadata } from '@/lib/seo';
import Link from 'next/link';
export const metadata = publicMetadata('/methodologie');
export default function Page() {
  return (
    <article className="page prose">
      <JsonLd value={editorialPageData('/methodologie')} />
      <Breadcrumbs items={[{ name: 'Méthodologie', href: '/methodologie' }]} real />
      <span className="eyebrow">COMPRENDRE AVANT DE CONCLURE</span>
      <h1>
        Méthodologie des probabilités football
        <br />
        Aucune certitude.
      </h1>
      <EditorialContext path="/methodologie" />
      <p className="intro-text">
        Proba Match estime les probabilités football avec un moteur Elo–Poisson. Voici les sources,
        les paramètres utilisés et les limites de la version actuelle.
      </p>
      <div className="reading-answer">
        <h2>Comment Proba Match calcule-t-il une probabilité ?</h2>
        <p>
          Les résultats antérieurs servent à estimer la force des équipes et leurs buts attendus.
          Une distribution de scores donne ensuite les probabilités de victoire, de nul et de buts.
          Les informations doivent être connues avant le calcul ; aucune statistique du match cible
          n’est utilisée.
        </p>
        <p>
          <Link href="/comprendre-probabilites">
            Lire le guide simple des probabilités football →
          </Link>
        </p>
      </div>
      <p>
        Proba Match calcule automatiquement ses probabilités avec un modèle statistique Elo–Poisson.
        Les explications sont assemblées selon des règles à partir des données et des facteurs
        calculés, sans IA générative. Elles décrivent une estimation du modèle, pas une certitude
        sur le déroulement du match.
      </p>
      <section>
        <h2>01 — Des sources clairement identifiées</h2>
        <p>
          Les calendriers et résultats proviennent d’
          <a href="https://github.com/openfootball/football.json">OpenFootball</a> et d’
          <a href="https://www.espn.com/soccer/">ESPN</a>, importés dans notre base PostgreSQL.
          OpenFootball n’exige aucune clé API. Sa mise à jour dépend des contributions : elle ne
          garantit pas un suivi en direct. Les classements Proba Match sont calculés sur les
          résultats disponibles. ESPN fournit les cinq championnats supplémentaires, leurs effectifs
          et leurs statistiques disponibles. Les synchronisations périodiques ne garantissent pas un
          suivi en direct. Les playoffs sont exclus des classements de ligue calculés.
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
          résultat, l’adversaire et l’écart de buts. Le moteur utilise K = 24 et un avantage
          domicile de 60 points, paramétrables dans le moteur. L’écart de buts est amorti par un
          logarithme. Les historiques de rating sont conservés.
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
          Le modèle retient jusqu’à 20 matchs terminés par équipe et exige au moins cinq
          observations de chaque côté. Le poids diminue de moitié tous les 60 jours. Un match joué
          dans le contexte domicile/extérieur opposé reçoit un poids de 0,65. La force adverse
          ajuste les buts observés par un facteur borné de 0,75 à 1,30.
        </p>
        <p>
          Depuis la version 1.3, le calcul est refusé si le dernier résultat disponible de l’une des
          équipes date de plus de 180 jours. Les coefficients sportifs de la version 1.2 sont
          conservés : cette mesure réduit les estimations sur des historiques périmés sans prétendre
          améliorer leur exactitude.
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
          sa valeur logarithmique, sans modifier leur moyenne géométrique. Ce paramètre conservé est
          étudié par comparaisons temporelles. Les évaluations reconstruites sans timestamps réels
          de disponibilité restent exploratoires et ne certifient pas la précision en production.
          Les probabilités « les deux marquent », buts totaux, marges et scores possibles
          proviennent de cette même matrice, sans modèle supplémentaire. La probabilité d’un score
          précis reste faible.
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
        <p>
          La qualité est affichée comme faible ou moyenne. Le niveau élevé est suspendu tant que le
          mapping des équipes et la couverture avancée ne sont pas validés. L’indice technique
          interne ne constitue pas une probabilité de réussite.
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
          Depuis la version 1.4, les révisions reçues et les entrées des nouvelles prédictions sont
          archivées. Les références Elo historiques respectent la réception des résultats avant
          chaque rencontre. Les probabilités 1N2 et leur évaluation utilisent le score à 90 minutes
          confirmé, sans les prolongations ni les tirs au but. Une période inconnue ne devient pas
          un score réglementaire.
        </p>
        <p>
          Le minimum de cinq résultats s’applique aussi à leur quantité effective après pondération
          : quatre matchs très anciens et un seul récent peuvent conduire à une abstention. Un
          terrain neutre confirmé annule l’avantage domicile. Ces corrections ne démontrent pas à
          elles seules une meilleure exactitude ; les coefficients sportifs restent inchangés.
        </p>
        <p>
          Les prédictions réelles sont créées lors des synchronisations avant le coup d’envoi. La
          première version et la version tenant compte de la disponibilité des compositions sont
          stockées séparément, sans mise à jour rétroactive. Des contraintes et un déclencheur
          PostgreSQL empêchent une écriture initiale tardive et les modifications de prédictions.
        </p>
        <p>
          Le backtest parcourt les matchs dans l’ordre. Depuis la version 1.3, son mode strict exige
          l’horodatage local de réception de chaque résultat utilisé. Une correction de score reçoit
          une nouvelle date de disponibilité. Les anciens imports sans cet horodatage ne servent pas
          à fabriquer des performances historiques. Le mode exploratoire de reconstruction reste
          explicite et distinct ; son délai théorique ne prouve pas l’absence de fuite de données.
        </p>
        <p>
          Les compositions connues plus tard, statistiques du match cible, blessures actuelles et
          classements recalculés sont exclus du replay. Les métriques comprennent Brier Score, Log
          Loss, accuracy du résultat le plus probable, calibration, MAE des buts
          domicile/extérieur/total et exactitude du score le plus probable. Elles sont comparées sur
          les mêmes matchs et une période séparée des choix de paramètres. La calibration moyenne
          des trois issues ne remplace pas leur analyse individuelle.
        </p>
      </section>
      <section>
        <h2>08 — Limites à garder en tête</h2>
        <p>
          Le football est peu prévisible. Les cartons rouges, rotations, changements tactiques et
          petits échantillons peuvent rendre ces estimations fragiles. L’indépendance des deux
          distributions ignore certaines corrélations entre scores. La validation chronologique
          permet de comparer les erreurs sur le passé disponible, sans prouver une amélioration
          future sur toutes les compétitions. Le nombre de prédictions publiées puis évaluées reste
          insuffisant pour mesurer la performance réelle en production.
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
      <EditorialLinks />
    </article>
  );
}
