import type { Dataset, EvaluatedPrediction } from '@/types/football';
import { metrics } from '@/prediction-engine/evaluation';
import { TrendChart } from '@/components/charts';
import { number, percent } from '@/lib/format';
export function Breakdowns({ rows, data }: { rows: EvaluatedPrediction[]; data: Dataset }) {
  const groups = [
    {
      title: 'Par compétition',
      key: (r: EvaluatedPrediction) =>
        data.competitions.find((c) => c.id === r.competitionId)?.name ?? r.competitionId,
    },
    { title: 'Par mois', key: (r: EvaluatedPrediction) => r.kickoff.slice(0, 7) },
    {
      title: 'Par qualité des informations',
      key: (r: EvaluatedPrediction) =>
        r.prediction.confidence >= 70 ? '70–100' : r.prediction.confidence >= 50 ? '50–69' : '0–49',
    },
  ];
  const months = [...new Set(rows.map((r) => r.kickoff.slice(0, 7)))].sort();
  return (
    <>
      <section className="card padded space-top">
        <h2>Exactitude mensuelle</h2>
        <TrendChart
          label="Part des issues correctement classées en premier (%)"
          values={months.map((month) => ({
            label: month,
            value: 100 * (metrics(rows.filter((r) => r.kickoff.startsWith(month)))?.accuracy ?? 0),
          }))}
        />
        <p className="data-note">
          Chaque point couvre les prédictions de sa période. Les petits échantillons restent
          instables.
        </p>
      </section>
      <div className="insights-grid space-top">
        {groups.map((group) => (
          <section className="card padded" key={group.title}>
            <h3>{group.title}</h3>
            <div className="data-table" role="region" tabIndex={0} aria-label={group.title}>
              <table>
                <thead>
                  <tr>
                    <th>Groupe</th>
                    <th>N</th>
                    <th>Exactitude</th>
                    <th>Brier</th>
                  </tr>
                </thead>
                <tbody>
                  {[...new Set(rows.map(group.key))].sort().map((key) => {
                    const m = metrics(rows.filter((r) => group.key(r) === key))!;
                    return (
                      <tr key={key}>
                        <th>{key}</th>
                        <td>{m.sample}</td>
                        <td>{percent(m.accuracy)}</td>
                        <td>{number(m.brier, 3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
