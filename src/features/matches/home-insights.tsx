import Link from 'next/link';
import type { Dataset, Prediction } from '@/types/football';
import { SectionTitle, TeamBadge, Form, Metric } from '@/components/ui';
import { teamSummary } from '@/services/statistics';
import { getEvaluations } from '@/services/predictions';
import { metrics } from '@/prediction-engine/evaluation';
import { walkForwardBacktest } from '@/prediction-engine/backtest';
import { cache } from '@/services/cache';
import { MatchCard } from './match-card';
import { percent, number } from '@/lib/format';
import { MODEL_VERSION } from '@/prediction-engine';
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
  const featured = data.matches
    .filter((m) => m.status === 'scheduled' && predictions[m.id])
    .sort((a, b) => predictions[b.id].confidence - predictions[a.id].confidence)
    .slice(0, 3);
  const evaluations =
    data.source === 'demo'
      ? await cache.get(
          `backtest:${MODEL_VERSION}:${data.updatedAt.slice(0, 10)}`,
          async () => walkForwardBacktest(data.matches),
          3600000,
        )
      : await getEvaluations();
  const stats = metrics(evaluations);
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
      <SectionTitle
        title="Le modèle rend des comptes"
        href="/performance-modele"
        action="Voir les résultats"
      />
      {data.source === 'demo' && (
        <p className="data-note">
          Simulation sur données fictives, sans valeur de performance réelle.
        </p>
      )}
      {stats ? (
        <div className="metrics">
          <Metric label="Prédictions évaluées" value={stats.sample} />
          <Metric label="Exactitude 1 · N · 2" value={percent(stats.accuracy)} />
          <Metric
            label="Brier Score"
            value={number(stats.brier, 3)}
            note="Plus faible = meilleur"
          />
          <Metric label="Log Loss" value={number(stats.logLoss, 3)} />
        </div>
      ) : (
        <p className="data-note">
          Aucune prédiction publiée n’a encore été évaluée après résultat.
        </p>
      )}
    </div>
  );
}
