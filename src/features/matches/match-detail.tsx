'use client';
import Link from 'next/link';
import { CompetitionBadge } from '@/components/ui';
import { ArrowLeft, MapPin, UserRound } from 'lucide-react';
import type { Dataset, Match, Prediction } from '@/types/football';
import { Empty, Form, Metric, ProbabilityBar, SectionTitle, TeamBadge } from '@/components/ui';
import { SourceBanner } from '@/components/source-banner';
import { FavoriteButton } from '@/features/favorites';
import { dayLabel, number, time } from '@/lib/format';
import { playerWatch } from '@/prediction-engine/player';
import { MatchList } from './match-list';
import { PlayerPerformances } from './player-performances';
import { recordedGoals, teamSummary } from '@/services/statistics';
import { useLive } from './use-live';
import { LocalTime } from '@/components/local-time';
import { ShareButton } from '@/components/share-button';
import type { predictionInsights, informationQuality } from '@/prediction-engine/insights';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { MatchOverview } from './match-overview';
import { ProbabilitySummary } from './probability-summary';
import { MatchStatistics } from './match-statistics';
import { matchFactSummary } from '@/lib/match-facts';
const tabs = [
  ['apercu', 'Aperçu'],
  ['prediction', 'Prédiction'],
  ['statistiques', 'Statistiques'],
  ['compositions', 'Compositions'],
  ['evenements', 'Événements'],
  ['h2h', 'Face-à-face'],
  ['joueurs', 'Joueurs'],
];
export function MatchDetail({
  data,
  match: initialMatch,
  prediction,
  predictionArchived = false,
  tab,
  history = [],
  analysis,
  quality,
}: {
  data: Dataset;
  match: Match;
  prediction?: Prediction;
  predictionArchived?: boolean;
  tab: string;
  history?: Prediction[];
  analysis?: ReturnType<typeof predictionInsights>;
  quality?: ReturnType<typeof informationQuality>;
}) {
  const live = useLive([initialMatch], true);
  const match = live.matches[0];
  const home = data.teams.find((t) => t.id === match.homeId)!,
    away = data.teams.find((t) => t.id === match.awayId)!,
    comp = data.competitions.find((c) => c.id === match.competitionId)!;
  const homeSummary = teamSummary(data, home.id, match.kickoff);
  const awaySummary = teamSummary(data, away.id, match.kickoff);
  const h2h = data.matches
    .filter(
      (m) =>
        m.id !== match.id &&
        m.status === 'finished' &&
        new Date(m.kickoff) < new Date(match.kickoff) &&
        ((m.homeId === home.id && m.awayId === away.id) ||
          (m.homeId === away.id && m.awayId === home.id)),
    )
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .slice(0, 10);
  const h2hGoals = recordedGoals(h2h);
  const watched = data.players
    .filter((p) => [home.id, away.id].includes(p.teamId))
    .map((p) => ({ player: p, score: playerWatch(p) }))
    .filter((p) => p.score !== null)
    .sort((a, b) => b.score! - a.score!)
    .slice(0, 5);
  const reportedInjuries = data.injuries.filter((injury) =>
    [home.id, away.id].includes(injury.teamId),
  );
  const hasObservedMatchStats = match.statistics.some((s) => s.home != null || s.away != null);
  return (
    <div className="page">
      <SourceBanner data={data} />
      <Breadcrumbs
        items={[
          { name: 'Matchs', href: '/matchs' },
          { name: `${home.short} – ${away.short}`, href: `/match/${match.slug}` },
        ]}
        real={data.source !== 'demo'}
      />
      <Link href="/matchs" className="text-link">
        <ArrowLeft size={14} /> Tous les matchs
      </Link>
      <section className="card match-hero">
        <div className="match-meta">
          <Link href={`/competition/${comp.slug}`}>
            <CompetitionBadge competition={comp} size={20} /> {comp.name}
          </Link>{' '}
          · {match.round} · {dayLabel(match.kickoff)}
        </div>
        <div className="match-headline">
          <Link href={`/equipe/${home.slug}`}>
            <TeamBadge team={home} size={75} />
            <h1 className="sr-only">
              {home.name} – {away.name}
            </h1>
            <h2>{home.name}</h2>
            <Form values={homeSummary.form} />
          </Link>
          <div className="score-block">
            <span className={match.status === 'live' ? 'live-label' : 'muted'}>
              {match.status === 'live' ? (
                `${match.phase === 'halftime' ? 'Mi-temps' : `${match.minute ?? ''}′`} · ${data.source === 'demo' ? 'Direct simulé' : 'En direct'}`
              ) : match.status === 'finished' ? (
                'Terminé'
              ) : match.status === 'postponed' ? (
                'Reporté'
              ) : match.status === 'cancelled' || match.status === 'abandoned' ? (
                match.status === 'abandoned' ? (
                  'Abandonné'
                ) : (
                  'Annulé'
                )
              ) : (
                <LocalTime iso={match.kickoff} known={match.kickoffKnown} />
              )}
            </span>
            <strong>
              {match.homeScore ?? '–'} <span>:</span> {match.awayScore ?? '–'}
            </strong>
            <FavoriteButton id={`match:${match.id}`} label={`${home.short} – ${away.short}`} />
          </div>
          <Link href={`/equipe/${away.slug}`}>
            <TeamBadge team={away} size={75} />
            <h2>{away.name}</h2>
            <Form values={awaySummary.form} />
          </Link>
        </div>
        <div className="venue-meta">
          <span>
            <MapPin size={13} />
            {match.venue ?? 'Stade non disponible'}
          </span>
          <span>
            <UserRound size={13} />
            {match.referee ?? 'Arbitre non disponible'}
          </span>
        </div>
        <nav className="detail-tabs" aria-label="Rubriques du match">
          {tabs.map(([id, label]) => (
            <Link
              key={id}
              href={`/match/${match.slug}?onglet=${id}`}
              className={tab === id ? 'active' : ''}
              aria-current={tab === id ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      </section>
      <ShareButton path={`/match/${match.slug}`} title={`${home.name} – ${away.name}`} />
      <p className="match-fact-summary">
        {matchFactSummary(match, home.name, away.name, comp.name)}{' '}
        {prediction
          ? data.source === 'demo'
            ? 'Les probabilités illustrent un scénario fictif de démonstration.'
            : predictionArchived
              ? 'Les probabilités ci-dessous sont une estimation archivée avant le coup d’envoi.'
              : 'Les probabilités ci-dessous sont calculées maintenant avec les données disponibles ; ce n’est pas un instantané historique archivé.'
          : 'Aucune probabilité pré-match archivée n’est affichée sans données suffisantes.'}{' '}
        <Link href="/comprendre-probabilites">Comprendre les statistiques et leurs limites</Link>.
      </p>
      {match.source !== 'demo' && (
        <p className="data-note">
          Calendrier / résultats :{' '}
          {match.provenance?.schedule === 'espn' || match.source === 'espn'
            ? 'ESPN'
            : match.provenance?.schedule === 'openfootball' || match.source === 'openfootball'
              ? 'OpenFootball'
              : 'API-Football'}
          .{' '}
          {match.detailSource?.statistics || match.provenance?.details
            ? `Statistiques : ${(match.detailSource?.statistics ?? match.provenance?.details) === 'espn' ? 'ESPN' : (match.detailSource?.statistics ?? match.provenance?.details) === 'fotmob' ? 'FotMob' : 'API-Football'}.`
            : 'Statistiques avancées indisponibles sans enrichissement.'}
        </p>
      )}
      {live.error && (
        <p className="warning" role="status">
          Actualisation indisponible : les dernières données reçues sont conservées.
        </p>
      )}
      {tab === 'apercu' && (match.status !== 'scheduled' || !prediction) && (
        <MatchOverview data={data} match={match} />
      )}
      {(tab === 'prediction' || tab === 'apercu') && (
        <div
          className={`detail-columns ${watched.length || reportedInjuries.length ? '' : 'single-column'}`}
        >
          <div>
            <SectionTitle title="La lecture du modèle" eyebrow="PROJECTIONS STATISTIQUES" />
            {prediction ? (
              <>
                <ProbabilitySummary
                  prediction={prediction}
                  home={home}
                  away={away}
                  analysis={analysis}
                  quality={quality}
                  demo={data.source === 'demo'}
                />
                <Link href="/methodologie" className="text-link">
                  Lire la méthodologie et les limites →
                </Link>
              </>
            ) : (
              <div className="card">
                <Empty
                  text={
                    homeSummary.played < 5 || awaySummary.played < 5
                      ? 'Une projection exige au moins cinq résultats antérieurs pour chaque équipe.'
                      : match.status === 'scheduled'
                        ? 'Aucune projection pré-match archivée pour cette rencontre. Les calculs sont publiés automatiquement dans les 21 jours avant le match.'
                        : 'Aucune projection enregistrée avant cette rencontre.'
                  }
                />
              </div>
            )}
          </div>
          {(watched.length > 0 || reportedInjuries.length > 0) && (
            <aside>
              {watched.length > 0 && (
                <>
                  <SectionTitle title="Joueurs à suivre" />
                  <section className="card padded">
                    <p className="data-note">
                      Indice heuristique sur les statistiques disponibles et la part de
                      titularisations. Ce classement n’est pas une probabilité de devenir homme du
                      match.
                    </p>
                    {watched.map(({ player: p, score }, i) => (
                      <Link href={`/joueur/${p.slug}`} className="player-ranking" key={p.id}>
                        <span className="rank-index">{i + 1}</span>
                        <span>
                          <strong>{p.name}</strong>
                          <small>{p.position}</small>
                        </span>
                        <b>
                          {score}
                          <small>/100</small>
                        </b>
                      </Link>
                    ))}
                  </section>
                </>
              )}
              {reportedInjuries.length > 0 && (
                <>
                  <SectionTitle title="Absences signalées" />
                  <section className="card padded">
                    {reportedInjuries.map((i) => (
                      <div className="factor" key={i.id}>
                        <strong>
                          {data.players.find((p) => p.id === i.playerId)?.name ??
                            'Joueur non disponible'}
                        </strong>
                        <p>
                          {i.reason} · {i.status}
                        </p>
                      </div>
                    ))}
                  </section>
                </>
              )}
            </aside>
          )}
        </div>
      )}
      {tab === 'apercu' && match.status === 'scheduled' && prediction && (
        <MatchOverview data={data} match={match} />
      )}
      {tab === 'prediction' && (
        <details className="card advanced-panel prediction-history">
          <summary>Historique des probabilités</summary>
          <p className="data-note">
            Affichage des 100 snapshots les plus récents au maximum ; les plus anciens peuvent ne
            pas figurer dans cette liste.
          </p>
          {history.length ? (
            <ol>
              {history.map((p) => (
                <li key={p.id}>
                  <span>
                    {dayLabel(p.createdAt)} · {time(p.createdAt)} ·{' '}
                    {p.lineupConfirmed ? 'Compositions disponibles' : 'Avant-match'} · {p.version}
                  </span>
                  <ProbabilityBar {...p} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="data-note">
              Aucun historique de prédictions publiées disponible. Une courbe ne sera affichée qu’à
              partir de véritables instantanés enregistrés avant le match.
            </p>
          )}
        </details>
      )}
      {tab === 'statistiques' && (
        <>
          <SectionTitle title="Le match en chiffres" />
          <MatchStatistics match={match} home={home} away={away} />
          {!hasObservedMatchStats && (
            <>
              <SectionTitle title="Historique disponible avant cette rencontre" />
              <p className="data-note">
                Ces chiffres viennent uniquement des matchs déjà joués avant ce coup d’envoi. Ils
                remplacent les statistiques observées du match lorsque la source ne les fournit pas
                encore.
              </p>
              <div className="metrics three">
                <Metric label={`Matchs · ${home.short}`} value={homeSummary.played} />
                <Metric label={`Buts marqués · ${home.short}`} value={homeSummary.scored} />
                <Metric label={`Buts encaissés · ${home.short}`} value={homeSummary.conceded} />
                <Metric label={`Matchs · ${away.short}`} value={awaySummary.played} />
                <Metric label={`Buts marqués · ${away.short}`} value={awaySummary.scored} />
                <Metric label={`Buts encaissés · ${away.short}`} value={awaySummary.conceded} />
              </div>
            </>
          )}
        </>
      )}
      {tab === 'compositions' && (
        <>
          <SectionTitle title="Les forces en présence" />
          {match.lineups.length ? (
            <div className="lineup-grid">
              {match.lineups.map((l) => (
                <section key={l.teamId} className="card lineup-card">
                  <div className="section-title">
                    <h2>{data.teams.find((t) => t.id === l.teamId)?.name}</h2>
                    <span className="tag">
                      {l.formation} · {l.confirmed ? 'Officielle' : 'Données incomplètes'}
                    </span>
                  </div>
                  <p className="data-note">
                    {data.source === 'demo' ? 'Composition fictive · ' : ''}Coach :{' '}
                    {l.coach ?? 'Non disponible'}
                  </p>
                  <div className="pitch">
                    <div className="pitch-circle" />
                    {[...new Set(l.starters.map((p) => p.row))]
                      .sort((a, b) => b - a)
                      .map((row) => (
                        <div className="pitch-row" key={row}>
                          {l.starters
                            .filter((p) => p.row === row)
                            .sort((a, b) => a.column - b.column)
                            .map((p) => (
                              <div key={p.id}>
                                {data.players.find((player) => player.id === p.id) ? (
                                  <Link
                                    href={`/joueur/${data.players.find((player) => player.id === p.id)!.slug}`}
                                  >
                                    <span>{p.number ?? '–'}</span>
                                    <small>{p.name}</small>
                                  </Link>
                                ) : (
                                  <>
                                    <span>{p.number ?? '–'}</span>
                                    <small>{p.name}</small>
                                  </>
                                )}
                              </div>
                            ))}
                        </div>
                      ))}
                  </div>
                  <h3>Remplaçants</h3>
                  {l.substitutes.map((p) => (
                    <div className="bench-player" key={p.id}>
                      <span>{p.number ?? '–'}</span>
                      {data.players.find((player) => player.id === p.id) ? (
                        <Link
                          href={`/joueur/${data.players.find((player) => player.id === p.id)!.slug}`}
                        >
                          {p.name}
                        </Link>
                      ) : (
                        p.name
                      )}
                    </div>
                  ))}
                </section>
              ))}
            </div>
          ) : (
            <div className="card">
              <Empty
                text={
                  match.status === 'scheduled'
                    ? 'Aucune composition publiée par la source pour le moment.'
                    : 'Aucune composition transmise par la source pour cette rencontre.'
                }
              />
            </div>
          )}
        </>
      )}
      {tab === 'evenements' && (
        <>
          <SectionTitle title="Le fil de la rencontre" />
          {match.events.length ? (
            <section className="card timeline">
              {[...match.events].reverse().map((e, i) => (
                <div key={i} className="timeline-event">
                  <strong>
                    {e.minute}
                    {e.extra ? `+${e.extra}` : ''}′
                  </strong>
                  <span className={`event-symbol event-${e.type}`}>
                    {e.type === 'goal'
                      ? '⚽'
                      : e.type === 'penalty-miss'
                        ? '×'
                        : e.type === 'yellow'
                          ? '🟨'
                          : e.type === 'red'
                            ? '🟥'
                            : e.type === 'substitution'
                              ? '↔'
                              : 'VAR'}
                  </span>
                  <div>
                    <small>
                      {e.type === 'goal'
                        ? e.detail?.toLowerCase().includes('penalty')
                          ? 'But sur penalty'
                          : 'But'
                        : e.type === 'penalty-miss'
                          ? 'Penalty manqué'
                          : e.type === 'yellow'
                            ? 'Carton jaune'
                            : e.type === 'red'
                              ? e.detail?.toLowerCase().includes('second yellow')
                                ? 'Deuxième jaune'
                                : 'Carton rouge'
                              : e.type === 'substitution'
                                ? 'Remplacement'
                                : 'VAR'}
                    </small>
                    <b>{e.player}</b>
                    <small>
                      {data.teams.find((t) => t.id === e.teamId)?.name}
                      {e.assist
                        ? ` · ${e.type === 'substitution' ? 'Remplacé par' : 'Passe'} : ${e.assist}`
                        : ''}
                    </small>
                    {e.detail && <small>{e.detail}</small>}
                  </div>
                </div>
              ))}
            </section>
          ) : (
            <div className="card">
              <Empty text="Aucun événement disponible pour cette rencontre." />
            </div>
          )}
        </>
      )}
      {tab === 'joueurs' && <PlayerPerformances match={match} data={data} />}{' '}
      {tab === 'h2h' && (
        <>
          <SectionTitle title="Confrontations directes" eyebrow="LES 10 DERNIÈRES DISPONIBLES" />
          <p className="data-note">
            Uniquement les rencontres antérieures à ce match. Le modèle n’ajoute pas de poids
            spécifique aux confrontations directes.
          </p>
          {h2h.length ? (
            <>
              <div className="metrics three">
                <Metric label="Confrontations" value={h2h.length} />
                <Metric
                  label="Total de buts"
                  value={h2hGoals.goals ?? 'Non disponible'}
                  note={`${h2hGoals.matches} score(s) disponible(s) sur ${h2h.length} rencontres`}
                />
                <Metric label="Buts par rencontre" value={number(h2hGoals.average, 2)} />
              </div>
              <MatchList
                matches={h2h}
                teams={data.teams}
                competitions={data.competitions}
                predictions={{}}
              />
            </>
          ) : (
            <Empty />
          )}
        </>
      )}
    </div>
  );
}
