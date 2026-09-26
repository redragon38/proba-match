import Link from 'next/link';
import type { Dataset, Match } from '@/types/football';
import { Form, SectionTitle } from '@/components/ui';
import { teamSummary } from '@/services/statistics';
import { number } from '@/lib/format';
export function MatchOverview({ data, match }: { data: Dataset; match: Match }) {
  const teams = [match.homeId, match.awayId].map((id) => data.teams.find((t) => t.id === id)!);
  const stats = match.statistics.filter((s) =>
    ['Possession', 'Tirs', 'Tirs cadrés', 'Corners'].includes(s.label),
  );
  return (
    <section className="match-overview">
      <SectionTitle
        title="L’essentiel du match"
        href={`/match/${match.slug}?onglet=statistiques`}
        action="Toutes les statistiques"
      />
      <div className="profile-shortcuts">
        <div className="card padded">
          <h3>Forme avant le match</h3>
          {teams.map((team) => (
            <div className="settings-row" key={team.id}>
              <Link href={`/equipe/${team.slug}`}>{team.name}</Link>
              <Form values={teamSummary(data, team.id, match.kickoff).form} />
            </div>
          ))}
        </div>
        <div className="card padded">
          <h3>Derniers événements</h3>
          {match.events.length ? (
            [...match.events]
              .sort((a, b) => b.minute - a.minute)
              .slice(0, 3)
              .map((event, index) => (
                <p key={index}>
                  <b>{event.minute}′</b> ·{' '}
                  {event.type === 'goal'
                    ? 'But'
                    : event.type === 'yellow'
                      ? 'Carton jaune'
                      : event.type === 'red'
                        ? 'Carton rouge'
                        : event.type === 'substitution'
                          ? 'Remplacement'
                          : 'Vérification vidéo'}{' '}
                  · {event.player}
                </p>
              ))
          ) : (
            <p className="data-note">Aucun événement transmis pour ce match.</p>
          )}
          <Link className="text-link" href={`/match/${match.slug}?onglet=evenements`}>
            Voir le fil du match →
          </Link>
        </div>
      </div>
      {stats.some((s) => s.home != null || s.away != null) && (
        <div className="card stat-comparison">
          <div className="settings-row">
            <strong>{teams[0].short}</strong>
            <span>Données du match</span>
            <strong>{teams[1].short}</strong>
          </div>
          {stats.map((stat) => (
            <div className="stat-compare-row" key={stat.label}>
              <div>
                <b>
                  {number(stat.home, 0)}
                  {stat.home != null ? stat.unit : ''}
                </b>
                <span>{stat.label}</span>
                <b>
                  {number(stat.away, 0)}
                  {stat.away != null ? stat.unit : ''}
                </b>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
