import Link from 'next/link';
import type { Standing, Team } from '@/types/football';
import { Empty, Form, TeamBadge } from '@/components/ui';
export function StandingTable({ rows, teams }: { rows: Standing[]; teams: Team[] }) {
  if (!rows.length)
    return <Empty text="Le classement n’est pas disponible pour cette compétition ou ce format." />;
  return (
    <>
      <div
        className="card data-table standing-table standings-desktop"
        tabIndex={0}
        role="region"
        aria-label="Tableau de statistiques"
      >
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Équipe</th>
              <th>MJ</th>
              <th>G</th>
              <th>N</th>
              <th>P</th>
              <th>BP</th>
              <th>BC</th>
              <th>Diff.</th>
              <th>Pts</th>
              <th>Forme</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const team = teams.find((t) => t.id === r.teamId);
              return (
                <tr key={r.teamId}>
                  <td>
                    <span className={r.position <= 3 ? 'table-rank top' : 'table-rank'}>
                      {r.position}
                    </span>
                  </td>
                  <th>
                    {team ? (
                      <Link href={`/equipe/${team.slug}`} className="table-team">
                        <TeamBadge team={team} size={25} />
                        {team.name}
                      </Link>
                    ) : (
                      `Équipe ${r.teamId}`
                    )}
                  </th>
                  <td>{r.played}</td>
                  <td>{r.won}</td>
                  <td>{r.drawn}</td>
                  <td>{r.lost}</td>
                  <td>{r.scored}</td>
                  <td>{r.conceded}</td>
                  <td>
                    {r.scored - r.conceded > 0 ? '+' : ''}
                    {r.scored - r.conceded}
                  </td>
                  <td>
                    <b>{r.points}</b>
                  </td>
                  <td>
                    <Form values={r.form} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="standings-mobile card" aria-label="Classement simplifié">
        <div className="standings-mobile-head">
          <span>#</span>
          <span>Équipe</span>
          <span>MJ</span>
          <span>Pts</span>
        </div>
        {rows.map((r) => {
          const team = teams.find((t) => t.id === r.teamId);
          return (
            <details className="standing-disclosure" key={r.teamId}>
              <summary aria-label={'Détails du classement de ' + (team?.name ?? r.teamId)}>
                <span className="table-rank">{r.position}</span>
                <span className="table-team">
                  {team && <TeamBadge team={team} size={24} />}
                  <strong>{team?.name ?? 'Équipe non disponible'}</strong>
                </span>
                <span>{r.played}</span>
                <b>{r.points}</b>
              </summary>
              <div className="standing-details">
                <dl>
                  {[
                    ['Gagnés', r.won],
                    ['Nuls', r.drawn],
                    ['Perdus', r.lost],
                    ['Buts pour', r.scored],
                    ['Buts contre', r.conceded],
                    ['Différence', r.scored - r.conceded],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <Form values={r.form} />
                {team && (
                  <Link className="text-link" href={'/equipe/' + team.slug}>
                    Voir l’équipe →
                  </Link>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
