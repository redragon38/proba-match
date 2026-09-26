import Link from 'next/link';
import type { Dataset, Match } from '@/types/football';
import { playerPerformance } from '@/prediction-engine/player';
import { Empty, SectionTitle } from '@/components/ui';
import { number } from '@/lib/format';
export function PlayerPerformances({ match, data }: { match: Match; data: Dataset }) {
  const rows = (match.performances ?? [])
    .map((p) => ({ ...p, score: playerPerformance(p.stats, p.position) }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return (
    <>
      <SectionTitle
        title="Les performances individuelles"
        eyebrow={
          match.status === 'finished' ? 'APRÈS LE COUP DE SIFFLET' : 'STATISTIQUES OBSERVÉES'
        }
      />
      <p className="data-note">
        Indice descriptif calculé sur ce match, adapté au poste. La v1 demande 90 minutes et les
        métriques essentielles ; les joueurs moins présents restent visibles sans indice. Ce
        classement statistique n’est pas une distinction officielle.
      </p>
      {rows.length ? (
        <div
          className="card data-table"
          tabIndex={0}
          role="region"
          aria-label="Tableau de statistiques"
        >
          <table>
            <thead>
              <tr>
                <th>Joueur</th>
                <th>Poste</th>
                <th>Min.</th>
                <th>Buts</th>
                <th>Passes D.</th>
                <th>Note source</th>
                <th>Indice /100</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const profile = data.players.find((x) => x.id === p.playerId);
                return (
                  <tr key={p.playerId}>
                    <th>
                      {profile ? <Link href={`/joueur/${profile.slug}`}>{p.name}</Link> : p.name}
                    </th>
                    <td>{p.position}</td>
                    <td>{number(p.stats.minutes)}</td>
                    <td>{number(p.stats.goals)}</td>
                    <td>{number(p.stats.assists)}</td>
                    <td>{number(p.stats.rating, 2)}</td>
                    <td>{p.score ?? 'Données insuffisantes'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card">
          <Empty text="Le fournisseur n’a pas transmis les statistiques individuelles de cette rencontre." />
        </div>
      )}
    </>
  );
}
