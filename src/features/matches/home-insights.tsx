import { upcomingSelection } from '@/services/football/match-selection';
import Link from 'next/link';
import type { Dataset, Prediction } from '@/types/football';
import { SectionTitle, TeamBadge, Form } from '@/components/ui';
import { teamSummary } from '@/services/statistics';
import { MatchCard } from './match-card';
export async function HomeInsights({
  data,
  predictions,
}: {
  data: Dataset;
  predictions: Record<string, Prediction>;
}) {
  const forms = data.teams
    .map((team) => ({ team, summary: teamSummary(data, team.id) }))
    .filter((r) => r.summary.lastTen.length >= 5)
    .map((r) => ({
      ...r,
      points: r.summary.lastTen
        .slice(0, 5)
        .reduce((s, m) => s + (m.gf > m.ga ? 3 : m.gf === m.ga ? 1 : 0), 0),
      goals: r.summary.lastTen.slice(0, 5).reduce((s, m) => s + m.gf, 0),
    }))
    .sort((a, b) => b.points - a.points || b.goals - a.goals)
    .slice(0, 6);
  const featured = upcomingSelection(data, undefined, data.matches.length)
    .filter((m) => predictions[m.id])
    .sort((a, b) => predictions[b.id].confidence - predictions[a.id].confidence)
    .slice(0, 3);
  return (
    <div className="page home-insights">
      <SectionTitle
        title="Les équipes en forme"
        eyebrow="LES CINQ DERNIERS MATCHS DISPONIBLES"
        href="/equipes"
      />
      <div className="insights-grid">
        {forms.map(({ team, summary, points, goals }) => (
          <Link key={team.id} href={`/equipe/${team.slug}`} className="card form-club">
            <TeamBadge team={team} size={42} />
            <div>
              <h3>{team.name}</h3>
              <p>
                {goals} buts · {points} points / 15
              </p>
              <Form values={summary.form} />
            </div>
            <b>{points}</b>
          </Link>
        ))}
      </div>
      {!forms.length && (
        <p className="data-note">
          Au moins cinq résultats par équipe sont nécessaires pour comparer leur forme.
        </p>
      )}
      <SectionTitle
        title="L’analyse avant le coup d’envoi"
        eyebrow="RENCONTRES AVEC HISTORIQUE SUFFISANT"
      />
      <div className="sport-card-grid">
        {featured.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            teams={data.teams}
            competition={data.competitions.find((c) => c.id === m.competitionId)}
            prediction={predictions[m.id]}
          />
        ))}
      </div>
    </div>
  );
}
