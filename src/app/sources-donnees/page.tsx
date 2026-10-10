import Link from 'next/link';
import { publicMetadata } from '@/lib/seo';
import { editorialPageData } from '@/lib/editorial';
import { JsonLd } from '@/components/json-ld';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { EditorialContext, EditorialLinks } from '@/components/editorial-context';
export const metadata = publicMetadata('/sources-donnees');
export default function Page() {
  return (
    <article className="page prose reading-guide">
      <Breadcrumbs items={[{ name: 'Sources des données', href: '/sources-donnees' }]} real />
      <JsonLd value={editorialPageData('/sources-donnees')} />
      <span className="eyebrow">ORIGINE, COUVERTURE ET LIMITES</span>
      <h1>D’où viennent les données football de Proba Match ?</h1>
      <p className="intro-text">
        Proba Match rassemble des données de fournisseurs, calcule ses propres indicateurs et peut
        proposer un mode de démonstration fictif. Ces trois catégories ont des usages différents.
      </p>
      <EditorialContext path="/sources-donnees" />
      <p className="data-note">
        La publication d’un catalogue ne confirme pas la fraîcheur de chaque score. Les réceptions
        de résultats, effectifs et détails sont distinctes. Un relevé joueur sans saison,
        compétition et équipe confirmées ne sert pas à établir un classement de compétition.
      </p>
      <div className="reading-answer">
        <h2>Quelle différence entre une statistique et une prédiction ?</h2>
        <p>
          Une statistique observée décrit des événements déjà enregistrés. Une probabilité pré-match
          est une estimation du modèle à partir d’informations antérieures. Une démonstration
          utilise des données fictives pour explorer l’interface.
        </p>
      </div>
      <nav className="reading-toc" aria-label="Sommaire des sources">
        <a href="#fournisseurs">Fournisseurs</a>
        <a href="#calculs">Calculs du site</a>
        <a href="#fraicheur">Dates et fraîcheur</a>
        <a href="#manquantes">Données absentes</a>
        <a href="#corrections">Corrections</a>
      </nav>
      <section id="fournisseurs">
        <h2>Les fournisseurs intégrés</h2>
        <div className="reading-answer">
          <h3>OpenFootball : calendriers et résultats</h3>
          <p>
            Le projet{' '}
            <a href="https://github.com/openfootball/football.json">OpenFootball / football.json</a>{' '}
            fournit des calendriers et résultats importés dans la base du site. Les mises à jour
            dépendent des contributions. Cette source ne garantit pas les scores en direct et ne
            fournit pas les statistiques avancées utilisées ailleurs dans l’interface.
          </p>
        </div>
        <div className="reading-answer">
          <h3>ESPN : compétitions, effectifs et statistiques disponibles</h3>
          <p>
            L’intégration <a href="https://www.espn.com/soccer/">ESPN football</a> complète le
            catalogue avec d’autres compétitions, des effectifs et les statistiques disponibles. La
            couverture varie selon la compétition et la saison. Une synchronisation périodique ne
            garantit pas un suivi en direct.
          </p>
        </div>
        <div className="reading-answer">
          <h3>API-Football : enrichissement optionnel</h3>
          <p>
            <a href="https://www.api-football.com/documentation-v3">API-Football / API-Sports</a>{' '}
            peut enrichir les événements, compositions et statistiques selon la configuration et la
            couverture fournisseur. Une donnée possible chez le fournisseur n’est pas nécessairement
            disponible sur Proba Match.
          </p>
        </div>
        <div className="reading-answer">
          <h3>StatsBomb Open Data : événements avancés</h3>
          <p>
            <a href="https://github.com/statsbomb/open-data">StatsBomb Open Data</a> fournit des
            événements détaillés pour les compétitions et saisons publiées dans son catalogue. Proba
            Match calcule PPDA, field tilt et xT uniquement pour un match identifié par sa date, ses
            deux équipes et son score. StatsBomb est cité comme source conformément aux conditions
            du jeu de données ouvert ; la couverture reste partielle.
          </p>
        </div>
        <div className="reading-answer">
          <h3>TheSportsDB et Wikimedia : profils et images</h3>
          <p>
            Le complément communautaire{' '}
            <a href="https://www.thesportsdb.com/api.php">TheSportsDB</a> peut fournir des profils
            et un échantillon partiel d’effectif. Ces profils ne disposent pas de statistiques
            individuelles vérifiées et ne doivent pas être présentés comme une liste complète.
            Certaines photos peuvent venir de{' '}
            <a href="https://commons.wikimedia.org/">Wikimedia Commons</a> ; leur attribution et
            leur licence sont indiquées lorsqu’elles sont disponibles.
          </p>
        </div>
        <p>
          Les liens ci-dessus identifient les sources intégrées. Ils ne signifient pas que Proba
          Match est un service officiel de ces organismes. Les droits et conditions d’utilisation
          des données restent ceux de chaque source ; cette page ne délivre aucune licence de
          redistribution.
        </p>
      </section>
      <section id="calculs">
        <h2>Ce que Proba Match calcule lui-même</h2>
        <ul>
          <li>
            Classements construits sur les résultats disponibles : ils peuvent différer d’un
            classement officiel en cas de matchs manquants ou de sanctions non représentées.
          </li>
          <li>Force Elo, forme pondérée et buts attendus du modèle pré-match.</li>
          <li>
            Probabilités de scores, de résultat et de buts dérivées de la même matrice Poisson.
          </li>
          <li>
            Ratios descriptifs à partir de compteurs observés cohérents, par exemple les tirs cadrés
            rapportés aux tirs.
          </li>
          <li>
            PPDA à partir des passes adverses et actions défensives, field tilt à partir des passes
            réussies dans le dernier tiers, et xT des progressions réussies avec la grille ouverte
            12 × 8 de Karun Singh. Ces métriques ne sont publiées que lorsque les événements
            StatsBomb correspondants existent.
          </li>
        </ul>
        <p>
          Les projections n’utilisent pas d’ajustement validé pour les blessures, la météo, les
          joueurs ou les xG. Les compositions peuvent renseigner la qualité des informations sans
          modifier la force estimée.{' '}
          <Link href="/methodologie">Consulter les règles exactes du moteur</Link>.
        </p>
      </section>
      <section id="fraicheur">
        <h2>Lire les dates sans confondre leurs sens</h2>
        <dl className="reading-definitions">
          <div>
            <dt>Synchronisé le</dt>
            <dd>
              Date de mise à jour locale affichée dans le contexte des données. Elle ne garantit pas
              que tous les champs ont été actualisés ni que le fournisseur couvre le direct.
            </dd>
          </div>
          <div>
            <dt>Date du match</dt>
            <dd>
              Date ou heure de coup d’envoi fournie. Une heure inconnue reste inconnue ; elle bloque
              les calculs exigeant une heure pré-match vérifiable.
            </dd>
          </div>
          <div>
            <dt>Date de la prédiction</dt>
            <dd>
              Moment auquel l’estimation a été enregistrée. Les informations arrivées plus tard ne
              doivent pas réécrire cette estimation.
            </dd>
          </div>
          <div>
            <dt>Date de révision d’un guide</dt>
            <dd>
              Date du changement des explications publiées, indépendante de la synchronisation
              sportive.
            </dd>
          </div>
        </dl>
      </section>
      <section id="manquantes">
        <h2>Pourquoi un chiffre peut être indisponible</h2>
        <p>
          Une statistique peut manquer chez le fournisseur, ne pas être synchronisée, être
          contradictoire ou sortir du domaine attendu. Une valeur absente ne devient pas zéro. Une
          prédiction peut être refusée si l’historique est trop court, périmé ou sans disponibilité
          vérifiable.
        </p>
        <p>
          Les xG de tirs, blessures et suspensions ne sont pas inventés. Des statistiques observées
          après le coup d’envoi ne servent pas à une prédiction antérieure de ce même match.
        </p>
      </section>
      <section id="corrections">
        <h2>Signaler une erreur et conserver son contexte</h2>
        <p>
          Pour signaler une erreur, indiquez la page, les équipes, la compétition, la date du match
          et la valeur concernée, avec un lien vers la source contradictoire si possible.{' '}
          <Link href="/contact">Voir les moyens de contact disponibles</Link>.
        </p>
        <p>
          Les scores corrigés reçoivent une nouvelle date de disponibilité pour l’évaluation
          stricte. Les prédictions archivées ne sont pas recalculées pour donner l’impression
          qu’elles connaissaient la correction.
        </p>
      </section>
      <EditorialLinks />
    </article>
  );
}
