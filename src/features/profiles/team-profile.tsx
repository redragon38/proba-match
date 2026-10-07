'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Dataset, Team } from '@/types/football';
import { SourceBanner } from '@/components/source-banner';
import { Empty, Form, Metric, SectionTitle, TeamBadge } from '@/components/ui';
import { FavoriteButton } from '@/features/favorites';
import { MatchList } from '@/features/matches/match-list';
import { teamSummary, teamMetricSummary } from '@/services/statistics';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { TrendChart } from '@/components/charts';
import { number } from '@/lib/format';
import { MatchCard } from '@/features/matches/match-card';
const documentedMatches = (sample: number) =>
  sample === 0
    ? 'Aucun match documenté'
    : `${sample} match${sample > 1 ? 's' : ''} documenté${sample > 1 ? 's' : ''}`;
export function TeamProfile({
  data,
  team,
  summary,
}: {
  data: Dataset;
  team: Team;
  summary?: string;
}) {
  const [count, setCount] = useState(5);
  const [venue, setVenue] = useState<'all' | 'home' | 'away'>('all');
  const stats = teamSummary(data, team.id, undefined, venue),
    players = data.players.filter((p) => p.teamId === team.id),
    comp = data.competitions.find((c) => c.id === team.competitionId);
  const standing = data.standings[team.competitionId]?.find((r) => r.teamId === team.id);
  const metrics = ['Possession', 'Tirs', 'Tirs cadrés'].map((label) =>
    teamMetricSummary(data, team.id, label, venue),
  );
  const nextMatch = data.matches
    .filter((m) => m.status === 'scheduled' && (m.homeId === team.id || m.awayId === team.id))
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))[0];
  const lastMatch = teamSummary(data, team.id).matches[0];
  return (
    <div className="page">
      <SourceBanner data={data} />
      <Breadcrumbs
        items={[
          { name: 'Équipes', href: '/equipes' },
          { name: team.name, href: `/equipe/${team.slug}` },
        ]}
        real={data.source !== 'demo'}
      />
      <div className="profile-header card">
        <TeamBadge team={team} size={86} />
        <div>
          <span className="eyebrow">
            {team.country} · {comp?.name}
          </span>
          <h1>{team.name}</h1>
          <p>
            {team.venue ?? 'Stade non disponible'} · Coach : {team.coach ?? 'Non disponible'}
          </p>
          <Form values={stats.form} />
        </div>
        <FavoriteButton id={`team:${team.id}`} label={team.name} />
      </div>
      {summary && <p className="match-fact-summary">{summary}</p>}
      <nav className="profile-tabs" aria-label="Rubriques de l’équipe">
        {[
          ['forme', 'Forme'],
          ['resultats', 'Matchs'],
          ['effectif', 'Effectif'],
          ['infirmerie', 'Blessures'],
        ].map(([id, label]) => (
          <a className="button secondary" key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>
      <div className="profile-shortcuts">
        {[
          ['Prochain match', nextMatch],
          ['Dernier résultat', lastMatch],
        ].map(([title, match]) => (
          <section key={String(title)}>
            <h2>{String(title)}</h2>
            {match && typeof match !== 'string' ? (
              <MatchCard match={match} teams={data.teams} competition={comp} compact />
            ) : (
              <div className="card padded">
                <p className="data-note">Aucun match disponible.</p>
              </div>
            )}
          </section>
        ))}
      </div>
      <div className="metrics">
        <Metric
          label="Position au classement"
          value={standing ? `${standing.position}e` : 'Non disponible'}
        />
        <Metric
          label="Buts marqués"
          value={stats.played ? stats.scored : 'Non disponible'}
          note={`${stats.played} matchs disponibles`}
        />
        <Metric label="Buts encaissés" value={stats.played ? stats.conceded : 'Non disponible'} />
        <Metric
          label="Matchs sans but encaissé"
          value={stats.played ? stats.cleanSheets : 'Non disponible'}
        />
      </div>
      <div className="detail-columns">
        <div>
          <div id="forme">
            <SectionTitle title="Dynamique récente" />
          </div>
          <div className="card padded">
            <div className="segmented" role="group" aria-label="Lieu des rencontres">
              {[
                ['all', 'Tous'],
                ['home', 'Domicile'],
                ['away', 'Extérieur'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={venue === id}
                  className={venue === id ? 'active' : ''}
                  onClick={() => setVenue(id as typeof venue)}
                >
                  {label}
                </button>
              ))}
            </div>
            <TrendChart
              values={[...stats.lastTen]
                .reverse()
                .map((m, i) => ({ label: `M${i + 1}`, value: m.gf }))}
              label="Buts marqués · 10 dernières rencontres disponibles"
            />
            <p className="data-note">
              Les agrégats portent sur le catalogue disponible, pas nécessairement sur une saison
              complète. Moyenne : {number(stats.goalsPerGame, 2)} but(s) par match.
            </p>
          </div>
          <div className="metrics three team-statistics-grid">
            <Metric
              label="Possession moyenne"
              value={
                metrics[0].average === null
                  ? 'Non disponible'
                  : `${number(metrics[0].average, 1)} %`
              }
              note={documentedMatches(metrics[0].sample)}
            />
            <Metric
              label="Tirs moyens"
              value={number(metrics[1].average, 1)}
              note={documentedMatches(metrics[1].sample)}
            />
            <Metric
              label="Tirs cadrés moyens"
              value={number(metrics[2].average, 1)}
              note={documentedMatches(metrics[2].sample)}
            />
          </div>
          <div id="resultats">
            <SectionTitle title="Derniers résultats" />
          </div>
          <div className="segmented">
            <button
              aria-pressed={count === 5}
              className={count === 5 ? 'active' : ''}
              onClick={() => setCount(5)}
            >
              5 matchs
            </button>
            <button
              aria-pressed={count === 10}
              className={count === 10 ? 'active' : ''}
              onClick={() => setCount(10)}
            >
              10 matchs
            </button>
          </div>
          <MatchList
            matches={stats.matches.slice(0, count)}
            teams={data.teams}
            competitions={data.competitions}
            predictions={{}}
          />
          <SectionTitle title="Prochaines rencontres" />
          <MatchList
            matches={data.matches
              .filter(
                (m) => m.status === 'scheduled' && (m.homeId === team.id || m.awayId === team.id),
              )
              .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))
              .slice(0, 10)}
            teams={data.teams}
            competitions={data.competitions}
            predictions={{}}
          />
        </div>
        <aside>
          <div id="effectif">
            <SectionTitle title="L’effectif" />
          </div>
          <section className="card padded">
            {players.length ? (
              players.map((p) => (
                <Link className="squad-row" href={`/joueur/${p.slug}`} key={p.id}>
                  <span>{p.number ?? '–'}</span>
                  <div>
                    <b>{p.name}</b>
                    <small>{p.position}</small>
                  </div>
                  <span>
                    {p.stats.goals ?? '–'} <small>but(s)</small>
                  </span>
                </Link>
              ))
            ) : (
              <Empty />
            )}
          </section>
          <div id="infirmerie">
            <SectionTitle title="Infirmerie" />
          </div>
          <div className="card padded">
            {data.injuries.filter((i) => i.teamId === team.id).length ? (
              data.injuries
                .filter((i) => i.teamId === team.id)
                .map((i) => (
                  <div className="factor" key={i.id}>
                    <strong>
                      {players.find((p) => p.id === i.playerId)?.name ?? 'Joueur non disponible'}
                    </strong>
                    <p>
                      {i.reason} · {i.status}
                    </p>
                  </div>
                ))
            ) : (
              <p className="data-note">Non disponible</p>
            )}
          </div>
          <Link className="button secondary full-width" href={`/comparateur/equipes?a=${team.id}`}>
            Comparer cette équipe
          </Link>
        </aside>
      </div>
    </div>
  );
}
