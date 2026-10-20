import Link from 'next/link';
import { getDataset } from '@/services/football';
import { getPredictions } from '@/services/predictions';
import { publicMetadata } from '@/lib/seo';
import { formatProbability, probabilityPercentages } from '@/lib/probability-format';
import { informationQuality } from '@/prediction-engine/insights';
import { CompetitionBadge, Empty, TeamBadge } from '@/components/ui';
import { LocalTime } from '@/components/local-time';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const data = await getDataset();
  return publicMetadata('/analyses', Boolean(process.env.DATABASE_URL) && data.source !== 'demo');
}

type Query = { date?: string; competition?: string };

async function availableAnalyses(query: Query) {
  const data = await getDataset();
  const now = Date.parse(data.updatedAt) || Date.now();
  const horizon = now + 7 * 86400_000;
  const candidates = data.matches.filter((match) => {
    const kickoff = Date.parse(match.kickoff);
    return (
      match.status === 'scheduled' &&
      kickoff >= now &&
      kickoff <= horizon &&
      (!query.date || match.kickoff.slice(0, 10) === query.date) &&
      (!query.competition || match.competitionId === query.competition)
    );
  });
  const predictions = await getPredictions(
    data,
    new Set(candidates.map((match) => match.id)),
    false,
  );
  return {
    data,
    predictions,
    matches: candidates
      .filter((match) => predictions[match.id])
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
  };
}

export default async function AnalysesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const { data, matches, predictions } = await availableAnalyses(query);
  return (
    <main className="page">
      <span className="eyebrow">ESTIMATIONS PUBLIÉES AVANT LE COUP D’ENVOI</span>
      <h1>Analyses et prédictions disponibles</h1>
      <p className="intro-text">
        Seules les rencontres disposant d’un instantané avant-match exploitable figurent ici. Les
        probabilités expriment une incertitude et ne garantissent aucun résultat.
      </p>
      <form className="filter-panel" method="get">
        <label>
          Date
          <input type="date" name="date" defaultValue={query.date ?? ''} />
        </label>
        <label>
          Compétition
          <select name="competition" defaultValue={query.competition ?? ''}>
            <option value="">Toutes</option>
            {data.competitions.map((competition) => (
              <option key={competition.id} value={competition.id}>
                {competition.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button" type="submit">
          Filtrer
        </button>
        {(query.date || query.competition) && (
          <Link className="button secondary" href="/analyses">
            Effacer
          </Link>
        )}
      </form>
      {matches.length ? (
        <div className="analysis-catalogue">
          {matches.map((match) => {
            const prediction = predictions[match.id];
            const home = data.teams.find((team) => team.id === match.homeId)!;
            const away = data.teams.find((team) => team.id === match.awayId)!;
            const competition = data.competitions.find((item) => item.id === match.competitionId)!;
            const percentages = probabilityPercentages(
              prediction.home,
              prediction.draw,
              prediction.away,
            );
            const score = prediction.scores[0];
            const quality = informationQuality(prediction).level;
            if (!home || !away || !competition) return null;
            return (
              <article className="card padded analysis-card" key={match.id}>
                <p className="data-note">
                  <CompetitionBadge competition={competition} size={20} /> {competition.name} ·{' '}
                  <LocalTime iso={match.kickoff} date />
                </p>
                <h2>
                  <TeamBadge team={home} size={30} /> {home.name} <span>–</span> {away.name}{' '}
                  <TeamBadge team={away} size={30} />
                </h2>
                <div className="metrics three">
                  <div className="metric">
                    <span>{home.short}</span>
                    <strong>{percentages[0]} %</strong>
                  </div>
                  <div className="metric">
                    <span>Match nul</span>
                    <strong>{percentages[1]} %</strong>
                  </div>
                  <div className="metric">
                    <span>{away.short}</span>
                    <strong>{percentages[2]} %</strong>
                  </div>
                </div>
                <p>
                  Score précis individuel le plus probable :{' '}
                  <strong>
                    {score
                      ? `${score.home}–${score.away} (${formatProbability(score.probability)})`
                      : 'non disponible'}
                  </strong>{' '}
                  · Qualité des informations : <strong>{quality}</strong>.
                </p>
                <Link className="button" href={`/match/${match.slug}?onglet=prediction`}>
                  Voir l’analyse complète
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="card">
          <Empty
            title="Aucune analyse pour cette sélection"
            text="Essayez une autre date ou revenez prochainement. Une analyse apparaît seulement après l’archivage d’une prédiction avant-match."
          />
        </section>
      )}
      <p className="data-note">
        Les filtres servent à la consultation et ne créent pas de pages distinctes dans Google.{' '}
        <Link href="/bilan-predictions">Consulter le bilan des prédictions publiées</Link>.
      </p>
    </main>
  );
}
