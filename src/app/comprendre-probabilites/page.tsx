import { probabilityQuestions, probabilityFaqData } from '@/lib/editorial';
import { JsonLd } from '@/components/json-ld';
import { editorialPageData } from '@/lib/editorial';
import { EditorialContext, EditorialLinks } from '@/components/editorial-context';
import Link from 'next/link';
import { publicMetadata } from '@/lib/seo';
import { Breadcrumbs } from '@/components/breadcrumbs';

export const metadata = publicMetadata('/comprendre-probabilites');

const definitions = [
  [
    '1N2',
    'Les trois issues du match : victoire domicile (1), nul (N), victoire extérieur (2). Leurs probabilités totalisent 100 % après arrondi.',
  ],
  [
    'Buts attendus',
    'La moyenne de buts estimée par le modèle pour chaque équipe. Une valeur de 1,4 ne signifie pas que l’équipe marquera exactement un ou deux buts.',
  ],
  [
    'xG',
    'Une mesure de la qualité des occasions de tir, construite à partir de données de tirs. Les buts attendus de notre modèle ne sont pas ces xG.',
  ],
  [
    'Clean sheet',
    'Une équipe termine sans encaisser. Sa probabilité dépend des buts estimés pour son adversaire.',
  ],
  [
    'Les deux équipes marquent',
    'Les deux équipes inscrivent chacune au moins un but. Cette probabilité regroupe tous les scores où les deux nombres sont supérieurs à zéro.',
  ],
  [
    'Calibration',
    'Sur beaucoup de matchs comparables estimés à 60 %, l’événement devrait se produire environ six fois sur dix. Cela se vérifie sur des prédictions archivées, pas sur un seul match.',
  ],
];

export default function Page() {
  return (
    <article className="page prose reading-guide">
      <JsonLd value={editorialPageData('/comprendre-probabilites')} />
      <Breadcrumbs
        items={[{ name: 'Comprendre les probabilités', href: '/comprendre-probabilites' }]}
        real
      />
      <span className="eyebrow">LES CHIFFRES, EN CLAIR</span>
      <h1>Comprendre les probabilités football</h1>
      <EditorialContext path="/comprendre-probabilites" />
      <p className="intro-text">
        Une estimation décrit plusieurs scénarios possibles. Ce guide vous aide à lire les
        probabilités, les buts attendus et les limites du modèle Proba Match.
      </p>
      <div className="reading-answer">
        <h2>Que signifie une probabilité de victoire de 60 % ?</h2>
        <p>
          Le modèle attribue environ six chances sur dix à cette victoire. Il reste quatre chances
          sur dix pour un nul ou une défaite. Ce n’est ni une garantie, ni un taux de réussite
          mesuré du modèle.
        </p>
        <p className="data-note">
          Tous les chiffres des exemples de ce guide sont illustratifs ; ils ne décrivent aucun
          match réel.
        </p>
      </div>
      <nav className="reading-toc" aria-label="Sommaire du guide">
        <a href="#resultat">Lire le résultat</a>
        <a href="#scores">Lire les scores</a>
        <a href="#qualite">Évaluer les informations</a>
        <a href="#lexique">Lexique</a>
        <a href="#evaluation">Vérifier un modèle</a>
        <a href="#sources">Sources</a>
      </nav>
      <section id="resultat">
        <h2>Lire les trois probabilités du résultat</h2>
        <p>
          Par exemple, 50 % domicile, 28 % nul et 22 % extérieur couvrent toutes les issues. La
          victoire domicile est l’issue individuelle la plus probable, mais les deux autres
          possibilités représentent ensemble la moitié de la distribution.
        </p>
        <p>
          L’arrondi des trois valeurs est coordonné pour conserver un total de 100 %. Les catégories
          de buts et de marges utilisent la même règle. Les scores affichés ne sont qu’une sélection
          : leurs probabilités ne doivent pas totaliser 100 %.
        </p>
        <Link href="/matchs">Consulter les matchs et leurs estimations disponibles →</Link>
      </section>
      <section id="scores">
        <h2>Le score le plus probable reste incertain</h2>
        <p>
          Si le score 1–1 est estimé à 13 %, il est le scénario individuel le plus probable, mais
          tous les autres scores réunis représentent 87 %. Plusieurs scores peuvent donc être
          plausibles, même quand une équipe est favorite.
        </p>
        <p>
          Les buts attendus sont des moyennes, pas des scores arrondis. Ils servent à construire la
          distribution des scores, puis à calculer les probabilités de victoire, de nul, de marquer
          et de terminer sans encaisser.
        </p>
      </section>
      <section id="qualite">
        <h2>Probabilité et qualité des données : deux lectures différentes</h2>
        <div className="reading-grid">
          <div className="reading-answer">
            <h3>Probabilité de l’événement</h3>
            <p>
              Elle répond à « quelles issues le modèle estime-t-il possibles ? ». Elle vient de la
              distribution de scores.
            </p>
          </div>
          <div className="reading-answer">
            <h3>Qualité des informations</h3>
            <p>
              Elle décrit l’historique disponible, sa récence et les informations connues au calcul.
              Elle ne mesure pas la probabilité que le modèle ait raison.
            </p>
          </div>
        </div>
        <p>
          Les niveaux affichés sont une heuristique documentée. Le niveau élevé est suspendu tant
          que les données avancées et leur correspondance aux équipes ne sont pas validées. La
          présence d’une composition ne suffit pas à rendre une prédiction fiable.
        </p>
        <p>
          Une donnée absente reste indisponible. Le moteur exige au moins cinq résultats antérieurs
          par équipe et refuse une estimation si le dernier résultat de l’une des équipes a plus de
          180 jours.
        </p>
      </section>
      <section id="lexique">
        <h2>Lexique des statistiques football</h2>
        <dl className="reading-definitions">
          {definitions.map(([term, meaning]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{meaning}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section id="evaluation">
        <h2>Comment vérifier l’exactitude d’un modèle ?</h2>
        <p>
          Il faut enregistrer les prédictions avant les matchs, puis les comparer aux résultats. En
          test temporel, seules les données réellement disponibles avant chaque estimation sont
          autorisées. Un résultat corrigé après le match ne peut pas être réutilisé comme s’il était
          connu avant.
        </p>
        <p>
          Le Brier Score mesure l’écart entre probabilités et résultats ; la Log Loss pénalise les
          erreurs très assurées. Plus ces scores sont faibles, mieux c’est sur le même échantillon.
          L’accuracy mesure la fréquence où l’issue la plus probable est correcte. La MAE mesure
          l’erreur moyenne absolue sur les buts.
        </p>
        <p>
          Un meilleur taux de bons résultats ne suffit pas à prouver une meilleure calibration. Les
          périodes, les compétitions, le nombre de matchs et les données exclues doivent être
          indiqués. Un test reconstruit sans dates de publication reste exploratoire.
        </p>
        <Link href="/methodologie">
          Voir les coefficients, les sources et les limites du moteur →
        </Link>
      </section>
      <section id="sources">
        <h2>D’où viennent les données et les calculs ?</h2>
        <p>
          Les résultats et calendriers proviennent d’
          <a href="https://github.com/openfootball/football.json">OpenFootball</a> et d’
          <a href="https://www.espn.com/soccer/">ESPN</a>. Les données avancées peuvent être
          enrichies par <a href="https://www.api-football.com/documentation-v3">API-Football</a>. La
          couverture et la fréquence de mise à jour varient. La source de chaque match et sa
          fraîcheur sont indiquées sur le site.
        </p>
        <p>
          Les probabilités sont calculées par le moteur statistique Proba Match. Les explications
          suivent des règles, sans texte généré par une IA. Le site ne garantit aucun résultat
          sportif.
        </p>
        <div className="reading-links">
          <Link href="/a-propos">À propos</Link>
          <Link href="/competitions">Compétitions suivies</Link>
          <Link href="/contact">Signaler une donnée incorrecte</Link>
        </div>
      </section>
      <section id="questions">
        <h2>Questions fréquentes sur les probabilités football</h2>
        <JsonLd value={probabilityFaqData()} />
        {probabilityQuestions.map(({ question, answer }) => (
          <div key={question} className="reading-answer">
            <h3>{question}</h3>
            <p>{answer}</p>
          </div>
        ))}
      </section>
      <EditorialLinks />
    </article>
  );
}
