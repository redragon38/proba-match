import type { Prediction, Team } from '@/types/football';
import type { informationQuality, predictionInsights } from '@/prediction-engine/insights';
import { ProbabilityBar, TeamBadge } from '@/components/ui';
import { number, time } from '@/lib/format';
import { plainFactor } from '@/lib/prediction-explanations';
import {
  formatProbability,
  probabilityPercentages,
  probabilityReading,
  roundedPercentages,
} from '@/lib/probability-format';

type Analysis = ReturnType<typeof predictionInsights>;
type Quality = ReturnType<typeof informationQuality>;

function Help({ label, text }: { label: string; text: string }) {
  return (
    <details className="prob-help">
      <summary aria-label={`Comprendre ${label}`}>ⓘ</summary>
      <p>{text}</p>
    </details>
  );
}

function Distribution({
  title,
  labels,
  values,
}: {
  title: string;
  labels: string[];
  values: number[];
}) {
  const rounded = roundedPercentages(values);
  return (
    <section className="prob-distribution">
      <h5>{title}</h5>
      {labels.map((label, index) => (
        <div className="prob-distribution-row" key={label}>
          <span>{label}</span>
          <span className="prob-distribution-track" aria-hidden="true">
            <span style={{ width: `${rounded[index]}%` }} />
          </span>
          <strong>
            {rounded[index] === 0 && values[index] > 0
              ? '< 1 %'
              : rounded[index] === 100 && values[index] < 1
                ? '> 99 %'
                : `${rounded[index]} %`}
          </strong>
        </div>
      ))}
    </section>
  );
}

export function ProbabilitySummary({
  prediction,
  home,
  away,
  analysis,
  quality,
  demo,
}: {
  prediction: Prediction;
  home: Team;
  away: Team;
  analysis?: Analysis;
  quality?: Quality;
  demo: boolean;
}) {
  const reading = probabilityReading(prediction.home, prediction.draw, prediction.away);
  if (!reading)
    return <div className="card padded">Probabilités non disponibles pour cette rencontre.</div>;
  const values = probabilityPercentages(prediction.home, prediction.draw, prediction.away);
  const names = [home.name, 'Match nul', away.name];
  const sides = [home, null, away];
  const topScore = prediction.scores[0];
  const relevantFactors = prediction.factors.filter((factor) =>
    reading.leader === 1
      ? factor.side === 'neutral' || !factor.side
      : factor.side === (reading.leader === 0 ? 'home' : 'away'),
  );
  const plainReasons = relevantFactors.slice(0, 3).flatMap((factor) => {
    const explanation = plainFactor(factor, home.name, away.name);
    return explanation ? [explanation] : [];
  });
  const reason = relevantFactors
    .slice(0, 2)
    .map((factor) => factor.label.toLowerCase())
    .join(' et ');
  const outcomeSummary =
    reading.label === 'Très équilibré'
      ? 'Match très équilibré selon le modèle.'
      : reading.leader === 1
        ? 'Le nul est l’issue individuelle la plus probable selon le modèle.'
        : `${reading.label} pour ${names[reading.leader]} selon le modèle.`;

  return (
    <section className="card prediction-summary" aria-label="Probabilités du match">
      <div className="prediction-heading">
        <div>
          <span className="eyebrow">ESTIMATION AVANT-MATCH</span>
          <h3>Probabilités du match</h3>
        </div>
        <Help
          label="les probabilités"
          text="Estimation statistique de la fréquence à laquelle chaque issue pourrait se produire."
        />
      </div>
      <div className="prediction-primary">
        <div className="prediction-outcomes">
          {names.map((name, index) => (
            <div
              className={`prediction-outcome ${reading.emphasize && reading.leader === index ? 'is-leading' : ''}`}
              key={index}
            >
              <span className="prediction-outcome-name">
                {sides[index] && <TeamBadge team={sides[index]} size={30} />}
                <span>{name}</span>
              </span>
              <strong>{values[index]} %</strong>
              <small>{index === 0 ? 'Domicile' : index === 1 ? 'Nul' : 'Extérieur'}</small>
            </div>
          ))}
        </div>
        <ProbabilityBar
          home={prediction.home}
          draw={prediction.draw}
          away={prediction.away}
          labels={false}
        />
        <p className="prediction-reading">
          <strong>{reading.label}</strong> ·{' '}
          {reading.emphasize
            ? `Probabilité la plus élevée : ${names[reading.leader]}.`
            : 'Aucune issue ne se détache nettement.'}
        </p>
        <p className="prediction-caution">
          Les probabilités sont des estimations, pas une garantie de résultat. Sur 100 rencontres
          comparables selon le modèle, environ {values[reading.leader]} auraient l’issue «{' '}
          {names[reading.leader]} ». Cela ne décrit pas les 100 prochains matchs de cette équipe.
        </p>
      </div>
      <div className="prediction-essentials">
        <div className="prediction-essential score">
          <div className="prediction-essential-title">
            Score le plus probable{' '}
            <Help
              label="le score le plus probable"
              text="Score individuel auquel le modèle attribue la probabilité la plus élevée. Il reste incertain."
            />
          </div>
          <strong>{topScore ? prediction.likelyScore : 'Non disponible'}</strong>
          <span>{formatProbability(topScore?.probability)} pour ce score précis</span>
        </div>
        <div className="prediction-essential goals">
          <div className="prediction-essential-title">
            Buts attendus{' '}
            <Help
              label="les buts attendus"
              text="Nombre moyen de buts estimé par le modèle ; ce n’est pas un score prévu."
            />
          </div>
          <div className="expected-teams">
            <span>
              {home.short}
              <b>{number(prediction.expectedHome, 1)}</b>
            </span>
            <span>
              {away.short}
              <b>{number(prediction.expectedAway, 1)}</b>
            </span>
          </div>
          {analysis && <span>Total avant arrondi ≈ {number(analysis.expectedTotal, 1)} buts</span>}
        </div>
        <div className="prediction-essential confidence">
          <div className="prediction-essential-title">
            Qualité des données{' '}
            <Help
              label="la confiance du modèle"
              text="Indique la qualité des données utilisées, pas la probabilité qu’une équipe gagne."
            />
          </div>
          <strong>{quality?.level ?? 'Non évaluée'}</strong>
          <span>Qualité des informations, distincte de la probabilité du résultat.</span>
          {quality?.level === 'Faible' && (
            <small>
              {quality.reasons[0] ?? 'Les données disponibles limitent cette estimation.'}
            </small>
          )}
        </div>
      </div>
      {prediction.scores.length >= 3 && (
        <section className="prediction-top-three">
          <h4>Trois scores les plus probables</h4>
          <div className="alternative-scores">
            {prediction.scores.slice(0, 3).map((score) => (
              <div key={`${score.home}-${score.away}`}>
                <strong>
                  {score.home}–{score.away}
                </strong>
                <span>{formatProbability(score.probability)}</span>
              </div>
            ))}
          </div>
          <p className="data-note">
            Chaque pourcentage concerne un score précis. D’autres scores restent possibles.
          </p>
        </section>
      )}
      <div className="prediction-why">
        <h4>Pourquoi cette estimation ?</h4>
        {plainReasons.length > 0 && (
          <ul>
            {plainReasons.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        )}
        <p className="data-note">
          Ces éléments sont combinés pour estimer les buts de chaque équipe, puis les scénarios de
          score. On ne peut pas attribuer un nombre exact de points de probabilité à chacun de ces
          facteurs.
        </p>
        <p>
          {outcomeSummary}{' '}
          {reason
            ? `Facteurs observés : ${reason}.`
            : 'Les facteurs détaillés ne sont pas disponibles pour cette estimation.'}
        </p>
      </div>
      <details className="prediction-more">
        <summary>Voir l’analyse détaillée</summary>
        <div className="prediction-more-content">
          {prediction.scores.length > 1 && (
            <section>
              <h4>Autres scénarios probables</h4>
              <div className="alternative-scores">
                {prediction.scores.slice(1, 4).map((score) => (
                  <div key={`${score.home}-${score.away}`}>
                    <strong>
                      {score.home}–{score.away}
                    </strong>
                    <span>{formatProbability(score.probability)}</span>
                  </div>
                ))}
              </div>
              {prediction.scores.length > 4 && (
                <details className="more-scores">
                  <summary>Voir plus de scores</summary>
                  <div className="alternative-scores">
                    {prediction.scores.slice(4).map((score) => (
                      <div key={`${score.home}-${score.away}`}>
                        <strong>
                          {score.home}–{score.away}
                        </strong>
                        <span>{formatProbability(score.probability)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </section>
          )}
          {analysis && (
            <>
              <section className="prediction-derived">
                <h4>Un éventail de buts possibles</h4>
                <p>
                  Entre{' '}
                  <strong>
                    {analysis.totalRange.from} et {analysis.totalRange.to} buts au total
                  </strong>{' '}
                  : cette plage regroupe {formatProbability(analysis.totalRange.probability)} de la
                  distribution calculée.
                </p>
                <p className="data-note">
                  C’est la plage entière la plus courte regroupant au moins 80 % des scénarios du
                  modèle. Les autres totaux restent possibles. Ce chiffre n’est pas un indice de
                  confiance ni une garantie.
                </p>
                {analysis.totalAtLeast.map((event) => (
                  <div key={event.goals}>
                    <span>Au moins {event.goals} buts au total</span>
                    <strong>{formatProbability(event.probability)}</strong>
                  </div>
                ))}
              </section>
              <Distribution
                title={`Buts de ${home.short}`}
                labels={['0 but', '1 but', '2 buts', '3 ou plus']}
                values={analysis.homeGoals}
              />
              <Distribution
                title={`Buts de ${away.short}`}
                labels={['0 but', '1 but', '2 buts', '3 ou plus']}
                values={analysis.awayGoals}
              />
              <section className="prediction-score-grid">
                <h4>Explorer les scénarios de score</h4>
                <table>
                  <caption>
                    Buts de {home.short} en lignes ; buts de {away.short} en colonnes.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">1 / 2</th>
                      {['0', '1', '2', '3', '4+'].map((label) => (
                        <th scope="col" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.scoreGrid.map((row, h) => (
                      <tr key={h}>
                        <th scope="row">{h === 4 ? '4+' : h}</th>
                        {row.map((p, a) => (
                          <td key={a}>{formatProbability(p)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="data-note">
                  4+ regroupe quatre buts ou davantage. Les cases forment une seule distribution ;
                  les pourcentages sont arrondis séparément.
                </p>
              </section>
              <section className="prediction-derived">
                <h4>Victoire et écart de buts</h4>
                <p className="data-note">
                  Probabilité de l’événement complet, sur tous les scénarios du match ; ces chiffres
                  ne sont pas conditionnés à une victoire.
                </p>
                {(['home', 'away'] as const).map((side) =>
                  analysis.winningMargins[side].map((p, index) => (
                    <div key={`${side}-${index}`}>
                      <span>
                        {side === 'home' ? home.short : away.short} gagne par{' '}
                        {index === 2 ? '3 buts ou plus' : `${index + 1} but${index ? 's' : ''}`}
                      </span>
                      <strong>{formatProbability(p)}</strong>
                    </div>
                  )),
                )}
              </section>
              <Distribution
                title="Nombre total de buts"
                labels={['0', '1', '2', '3', '4', '5 ou plus']}
                values={analysis.totalGoals}
              />
              <section className="prediction-derived">
                <h4>Probabilités de buts</h4>
                <div>
                  <span>{home.short} marque</span>
                  <strong>{formatProbability(analysis.homeScores)}</strong>
                </div>
                <div>
                  <span>{away.short} marque</span>
                  <strong>{formatProbability(analysis.awayScores)}</strong>
                </div>
                <div>
                  <span>Les deux équipes marquent</span>
                  <strong>{formatProbability(analysis.bothScore)}</strong>
                </div>
                <div>
                  <span>Match sans but</span>
                  <strong>{formatProbability(analysis.totalGoals[0])}</strong>
                </div>
              </section>
              <section className="prediction-derived">
                <h4>Chance de ne pas encaisser</h4>
                <div>
                  <span>{home.short}</span>
                  <strong>{formatProbability(analysis.cleanHome)}</strong>
                </div>
                <div>
                  <span>{away.short}</span>
                  <strong>{formatProbability(analysis.cleanAway)}</strong>
                </div>
              </section>
              <Distribution
                title="Écart final, quelle que soit l’équipe gagnante"
                labels={[
                  'Match nul',
                  'Victoire par 1 but',
                  'Victoire par 2 buts',
                  'Victoire par 3 buts ou plus',
                ]}
                values={analysis.margin}
              />
            </>
          )}
          {prediction.factors.length > 0 && (
            <section className="prediction-factors">
              <h4>Facteurs principaux observés</h4>
              {prediction.factors.map((factor) => (
                <div key={factor.label} className="factor">
                  <strong>
                    {factor.side === 'home'
                      ? `↑ ${home.short} · ↓ ${away.short}`
                      : factor.side === 'away'
                        ? `↑ ${away.short} · ↓ ${home.short}`
                        : '→ Neutre'}{' '}
                    · {factor.label}
                  </strong>
                  <p>{factor.detail}</p>
                </div>
              ))}
              <p className="data-note">
                ↑ facteur comparativement favorable · ↓ moins favorable · → neutre ou non attribué.
              </p>
            </section>
          )}
          <section className="prediction-quality-detail">
            <h4>Qualité des données</h4>
            <p>
              Indice {prediction.confidence}/100 · {quality?.level ?? 'Non évaluée'}. Cet indice
              décrit les données disponibles, pas une chance de gagner.
            </p>
            {quality?.reasons.map((reason) => (
              <p key={reason}>{reason}</p>
            ))}
            <p>
              Échantillon minimal : {prediction.sample} résultats par équipe · Compositions
              officielles {prediction.lineupConfirmed ? 'disponibles' : 'absentes'} lors du calcul.
            </p>
          </section>
          <p className="data-note">
            Lecture de l’équilibre : écart entre les deux issues les plus probables, inférieur à 5
            points = très équilibré ; de 5 à moins de 12 = équilibré ; de 12 à moins de 25 = léger
            avantage ; à partir de 25 = avantage marqué. Ces catégories ne changent pas les
            probabilités.
          </p>
          <p className="data-note">
            {demo
              ? 'Calcul illustratif sur données fictives.'
              : `Prédiction enregistrée le ${new Date(prediction.createdAt).toLocaleDateString('fr-FR')} à ${time(prediction.createdAt)}.`}{' '}
            Version {prediction.version}. Les chiffres avancés dérivent de la même matrice de scores
            ; ils ne prédisent ni la possession, ni les tirs, ni les cartons.
          </p>
        </div>
      </details>
    </section>
  );
}
