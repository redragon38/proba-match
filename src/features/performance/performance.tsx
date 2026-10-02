'use client';
import { useMemo, useState } from 'react';
import type { Dataset, EvaluatedPrediction } from '@/types/football';
import { metrics } from '@/prediction-engine/evaluation';
import { Metric, Empty, SectionTitle } from '@/components/ui';
import { SourceBanner } from '@/components/source-banner';
import { number, percent } from '@/lib/format';
import { probabilityPercentages } from '@/lib/probability-format';
import { Breakdowns } from './breakdowns';
export function Performance({
  data,
  rows,
  demo,
}: {
  data: Dataset;
  rows: EvaluatedPrediction[];
  demo: boolean;
}) {
  const [comp, setComp] = useState('all'),
    [month, setMonth] = useState('all'),
    [confidence, setConfidence] = useState('all');
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState('all'),
    [version, setVersion] = useState('all');
  const reference = Date.parse(data.updatedAt) || 0;
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (version === 'all' || r.prediction.version === version) &&
          (period === 'all' ||
            (period === 'season'
              ? r.kickoff >=
                `${new Date(reference).getUTCFullYear() - (new Date(reference).getUTCMonth() < 6 ? 1 : 0)}-07-01`
              : Date.parse(r.kickoff) >= reference - Number(period) * 86400000)) &&
          (comp === 'all' || r.competitionId === comp) &&
          (month === 'all' || r.kickoff.slice(0, 7) === month) &&
          (confidence === 'all' ||
            (confidence === 'high' && r.prediction.confidence >= 70) ||
            (confidence === 'low' && r.prediction.confidence < 70)),
      ),
    [rows, comp, month, confidence, period, version, reference],
  );
  const stats = metrics(filtered);
  return (
    <div className="page">
      <SourceBanner data={data} />
      <span className="eyebrow">LA TRANSPARENCE EST UNE STATISTIQUE AUSSI</span>
      <h1>Notre modèle, à livre ouvert.</h1>
      <p className="intro-text">
        Les bonnes lectures. Les erreurs. Et tout ce qu’on apprend entre les deux.
      </p>
      {demo && (
        <p className="warning">
          Simulation pédagogique sur des rencontres fictives. Ces résultats ne mesurent aucune
          performance réelle et ne constituent pas un historique de prédictions publiées.
        </p>
      )}
      <div className="filter-panel">
        <label>
          Période
          <select
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tout l’historique</option>
            <option value="7">7 jours</option>
            <option value="30">30 jours</option>
            <option value="90">90 jours</option>
            <option value="season">Saison (depuis juillet)</option>
          </select>
        </label>
        <label>
          Version du modèle
          <select
            value={version}
            onChange={(e) => {
              setVersion(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Toutes les versions</option>
            {[...new Set(rows.map((r) => r.prediction.version))].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Compétition
          <select
            value={comp}
            onChange={(e) => {
              setComp(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Toutes</option>
            {data.competitions.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mois
          <select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tous les mois</option>
            {[...new Set(rows.map((r) => r.kickoff.slice(0, 7)))]
              .sort()
              .reverse()
              .map((m) => (
                <option key={m}>{m}</option>
              ))}
          </select>
        </label>
        <label>
          Qualité des informations
          <select
            value={confidence}
            onChange={(e) => {
              setConfidence(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tous les niveaux</option>
            <option value="high">70/100 et plus</option>
            <option value="low">Moins de 70/100</option>
          </select>
        </label>
      </div>
      {stats ? (
        <>
          <div className="metrics">
            <Metric label="Matchs évalués" value={stats.sample} />
            <Metric label="Résultat le plus probable correct" value={percent(stats.accuracy)} />
            <Metric
              label="Brier Score"
              value={number(stats.brier, 3)}
              note="De 0 à 2 · plus faible = meilleur"
            />
            <Metric
              label="Log Loss"
              value={number(stats.logLoss, 3)}
              note="Plus faible = meilleur"
            />
          </div>
          <div className="detail-columns">
            <section className="card padded">
              <SectionTitle
                title="Les probabilités tiennent-elles leurs promesses ?"
                eyebrow="CALIBRATION MULTICLASSE"
              />
              <p className="data-note">
                Probabilités annoncées avant les matchs, comparées aux résultats observés. Une
                estimation proche de 70 % devrait se réaliser environ 7 fois sur 10 sur un grand
                nombre de cas comparables ; une petite tranche reste incertaine.
              </p>
              <figure className="calibration-chart">
                <svg
                  viewBox="0 0 500 320"
                  role="img"
                  aria-label="Calibration : probabilité annoncée et fréquence observée"
                >
                  <title>Calibration des trois issues, par tranches de 10 %</title>
                  {[0, 20, 40, 60, 80, 100].map((v) => (
                    <g key={v}>
                      <line
                        x1="50"
                        x2="460"
                        y1={270 - v * 2.3}
                        y2={270 - v * 2.3}
                        stroke="var(--line)"
                      />
                      <text x="15" y={274 - v * 2.3} fontSize="10" fill="var(--muted)">
                        {v}%
                      </text>
                      <text
                        x={50 + v * 4.1}
                        y="290"
                        fontSize="10"
                        textAnchor="middle"
                        fill="var(--muted)"
                      >
                        {v}%
                      </text>
                    </g>
                  ))}
                  <line
                    x1="50"
                    x2="460"
                    y1="270"
                    y2="40"
                    stroke="var(--muted)"
                    strokeDasharray="5 5"
                  />
                  {stats.calibration.map((c) => (
                    <circle
                      key={c.bin}
                      cx={50 + c.predicted * 410}
                      cy={270 - c.actual * 230}
                      r={Math.min(13, 4 + Math.sqrt(c.count) / 3)}
                      fill="var(--green)"
                      opacity=".8"
                    >
                      <title>
                        {`${Math.round(c.predicted * 100)} % annoncés ; ${Math.round(c.actual * 100)} % observés ; n = ${c.count}`}
                      </title>
                    </circle>
                  ))}
                </svg>
                <figcaption>
                  Axe horizontal : probabilité annoncée · Axe vertical : fréquence réelle. La
                  diagonale représente une calibration parfaite.
                </figcaption>
              </figure>
              <div
                className="data-table"
                tabIndex={0}
                role="region"
                aria-label="Tableau de statistiques"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Tranche</th>
                      <th>Probabilité annoncée</th>
                      <th>Fréquence observée</th>
                      <th>Observations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.calibration.map((c) => (
                      <tr key={c.bin}>
                        <th>
                          {c.bin * 10}–{(c.bin + 1) * 10} %
                        </th>
                        <td>{percent(c.predicted)}</td>
                        <td>{percent(c.actual)}</td>
                        <td>{c.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="card padded">
              <h2>Comment lire ces résultats</h2>
              <div className="factor">
                <strong>Précision</strong>
                <p>
                  Part des matchs où l’issue ayant la plus forte probabilité s’est produite. Elle ne
                  suffit pas à évaluer les probabilités.
                </p>
              </div>
              <div className="factor">
                <strong>Brier Score</strong>
                <p>
                  Somme des trois erreurs quadratiques, puis moyenne par match. Convention non
                  divisée par trois ; étendue 0–2.
                </p>
              </div>
              <div className="factor">
                <strong>Log Loss</strong>
                <p>
                  Moins le modèle attribue de probabilité au résultat observé, plus la pénalité est
                  forte.
                </p>
              </div>
              <div className="factor">
                <strong>Calibration</strong>
                <p>
                  Les trois issues de chaque rencontre sont regroupées par tranches de 10 %. Chaque
                  point affiche le nombre d’observations ; de petits échantillons sont instables.
                </p>
              </div>
              <p className="data-note">
                {version === 'all' ? 'Versions regroupées' : `Version ${version}`} · {stats.sample}{' '}
                matchs évalués dans cette sélection. Les prédictions initiales sont conservées avant
                le résultat ; les mises à jour de composition restent séparées.
              </p>
            </section>
          </div>
          <SectionTitle title="Historique complet de la sélection" />
          <Breakdowns rows={filtered} data={data} />
          <div
            className="card data-table"
            tabIndex={0}
            role="region"
            aria-label="Tableau de statistiques"
          >
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Match</th>
                  <th>1 / N / 2</th>
                  <th>Résultat</th>
                  <th>Qualité</th>
                  <th>Version</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice((page - 1) * 20, page * 20).map((r) => {
                  const m = data.matches.find((m) => m.id === r.prediction.matchId);
                  return (
                    <tr key={r.prediction.id}>
                      <td>{new Date(r.kickoff).toLocaleDateString('fr-FR')}</td>
                      <th>
                        {data.teams.find((t) => t.id === m?.homeId)?.short ?? 'Domicile'} –{' '}
                        {data.teams.find((t) => t.id === m?.awayId)?.short ?? 'Extérieur'}
                      </th>
                      <td>
                        {probabilityPercentages(
                          r.prediction.home,
                          r.prediction.draw,
                          r.prediction.away,
                        )
                          .map((value) => `${value} %`)
                          .join(' / ')}
                      </td>
                      <td>
                        {r.homeScore}–{r.awayScore}
                      </td>
                      <td>{r.prediction.confidence}/100</td>
                      <td>{r.prediction.version}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button
              className="button secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Précédent
            </button>
            <span>
              {page} / {Math.ceil(filtered.length / 20)}
            </span>
            <button
              className="button secondary"
              disabled={page * 20 >= filtered.length}
              onClick={() => setPage(page + 1)}
            >
              Suivant
            </button>
          </div>
        </>
      ) : (
        <div className="card">
          <Empty
            title="L’historique se construit sur le terrain"
            text="Aucune prédiction initiale évaluée pour cette sélection. Les résultats apparaissent après des rencontres réellement précédées d’une prédiction sauvegardée."
          />
        </div>
      )}
    </div>
  );
}
