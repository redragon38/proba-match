import Link from 'next/link';
import { eventMinute, compareEventTime } from '@/lib/event-time';
import type { Dataset, Match } from '@/types/football';
import { Form, SectionTitle } from '@/components/ui';
import { teamSummary } from '@/services/statistics';
import { matchStatsSummary, StatComparisonRow } from './match-statistics';
export function MatchOverview({ data, match }: { data: Dataset; match: Match }) {
  const teams = [match.homeId, match.awayId].map((id) => data.teams.find((t) => t.id === id)!);
  const stats = match.statistics.filter((s) =>
    ['Possession', 'Tirs', 'Tirs cadrés', 'Corners'].includes(s.label),
  );
  const summary = matchStatsSummary(stats, teams[0], teams[1]);
  return (
    <section className="match-overview">
      <SectionTitle
        title="L’essentiel du match"
        href={`/match/${match.slug}?onglet=statistiques`}
        action="Toutes les statistiques"
      />
      <div className="profile-shortcuts">
        <div className="card padded">
          <h3>Résultats des matchs précédents</h3>
          <p className="data-note">
            Forme recalculée sur les résultats actuellement connus des matchs antérieurs à cette
            rencontre.
          </p>
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
              .sort((a, b) => compareEventTime(b, a))
              .slice(0, 3)
              .map((event, index) => (
                <p key={index}>
                  <b>{eventMinute(event)}′</b> ·{' '}
                  {event.type === 'goal'
                    ? 'But'
                    : event.type === 'penalty-miss'
                      ? 'Penalty manqué'
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
        <div>
          {summary && <p className="card padded match-stats-summary">{summary}</p>}
          <div className="card match-stats-card">
            <div className="match-stat-header">
              <strong>{teams[0].short}</strong>
              <span>Données du match</span>
              <strong>{teams[1].short}</strong>
            </div>
            {stats.map((stat) => (
              <StatComparisonRow stat={stat} key={stat.label} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
