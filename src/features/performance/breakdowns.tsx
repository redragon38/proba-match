import type { Dataset, EvaluatedPrediction } from '@/types/football';
import { reportBreakdowns, type ReportSummary } from './report-view';
import { TrendChart } from '@/components/charts';
import { number, percent } from '@/lib/format';
export function Breakdowns({
  rows,
  data,
  summary,
}: {
  rows: EvaluatedPrediction[];
  data: Dataset;
  summary?: ReportSummary['breakdowns'];
}) {
  const groups = summary ?? reportBreakdowns(rows, data);
  const monthly = groups.find((group) => group.title === 'Par mois')?.entries ?? [];
  return (
    <>
      <section className="card padded space-top">
        <h2>Exactitude mensuelle</h2>
        <TrendChart
          label="Part des issues correctement classées en premier (%)"
          values={monthly.map(({ key, stats }) => ({ label: key, value: 100 * stats.accuracy }))}
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
                    <th>Log-loss</th>
                  </tr>
                </thead>
                <tbody>
                  {group.entries.map(({ key, stats: m }) => {
                    return (
                      <tr key={key}>
                        <th>{key}</th>
                        <td>{m.sample}</td>
                        <td>{m.sample >= 30 ? percent(m.accuracy) : 'Échantillon faible'}</td>
                        <td>{m.sample >= 30 ? number(m.brier, 3) : '—'}</td>
                        <td>{m.sample >= 30 ? number(m.logLoss, 3) : '—'}</td>
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
