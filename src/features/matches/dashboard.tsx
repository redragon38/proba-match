'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { Dataset, Match, Prediction } from '@/types/football';
import { dateKey } from '@/lib/format';
import { formatProbability } from '@/lib/probability-format';
import { AdSlot, Empty, ProbabilityBar, SectionTitle, TeamBadge } from '@/components/ui';
import { SourceBanner } from '@/components/source-banner';
import { MatchList } from './match-list';
import { useFavorites } from '@/features/favorites';
import { playerWatch } from '@/prediction-engine/player';
import { useLive } from './use-live';
import { MatchCard } from './match-card';
import { useTimeZone } from '@/components/local-time';

export function Dashboard({
  data,
  predictions,
  initialDate,
  initialStatus = 'all',
  full = false,
  automaticDate = false,
  pagination,
  upcomingMatches,
}: {
  data: Dataset;
  predictions: Record<string, Prediction>;
  initialDate: string;
  initialStatus?: string;
  full?: boolean;
  automaticDate?: boolean;
  pagination?: { total: number; page: number; pages: number };
  upcomingMatches?: Match[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const params = useSearchParams();
  const status = params.get('statut') ?? initialStatus;
  const country = params.get('pays') ?? 'all';
  const competition = params.get('competition') ?? 'all';
  function changeFilters(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    next.delete('page');
    next.set('timezone', zone);
    for (const [key, value] of Object.entries(changes)) {
      if (value === 'all') next.delete(key);
      else next.set(key, value);
    }
    startTransition(() => router.replace(`${full ? '/matchs' : '/'}?${next}`, { scroll: false }));
  }
  const setStatus = (value: string) => {
    if (full && value === 'favorites') {
      router.push('/favoris');
      return;
    }
    changeFilters({ statut: value });
  };
  const setCountry = (value: string) => changeFilters({ pays: value });
  const setCompetition = (value: string) => changeFilters({ competition: value });
  const [filters, setFilters] = useState(false);
  const { values } = useFavorites();
  const zone = useTimeZone();
  const today = dateKey(new Date(), zone);
  const hasMatchesToday =
    automaticDate &&
    data.matches.some(
      (match) =>
        (match.kickoffKnown === false && match.sourceDate
          ? match.sourceDate
          : dateKey(new Date(match.kickoff), zone)) === today &&
        (status === 'all' || status === 'favorites' || match.status === status),
    );
  const activeDate = hasMatchesToday ? today : initialDate;
  const live = useLive(data.matches);
  const dayMatches = full
    ? live.matches
    : live.matches.filter(
        (m) =>
          (m.kickoffKnown === false && m.sourceDate
            ? m.sourceDate
            : dateKey(new Date(m.kickoff), zone)) === activeDate,
      );
  const selected = dayMatches.filter(
    (m) =>
      (status === 'all' ||
        status === m.status ||
        (status === 'favorites' &&
          [
            `match:${m.id}`,
            `team:${m.homeId}`,
            `team:${m.awayId}`,
            `competition:${m.competitionId}`,
          ].some((id) => values.includes(id)))) &&
      (competition === 'all' || competition === m.competitionId) &&
      (country === 'all' ||
        data.competitions.find((c) => c.id === m.competitionId)?.country === country),
  );
  function setDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const next = new URLSearchParams(params.toString());
    next.delete('page');
    next.set('timezone', zone);
    next.set('date', value);
    startTransition(() => router.push(`${full ? '/matchs' : '/'}?${next}`, { scroll: false }));
  }
  function moveDate(delta: number) {
    const d = new Date(`${activeDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  }
  const featured =
    dayMatches.find((m) => m.status === 'scheduled' && predictions[m.id]) ??
    dayMatches.find((m) => predictions[m.id]);
  const home = data.teams.find((t) => t.id === featured?.homeId),
    away = data.teams.find((t) => t.id === featured?.awayId);
  const starPlayers = data.players
    .map((p) => ({ ...p, score: playerWatch(p) }))
    .filter((p) => p.score !== null)
    .sort((a, b) => b.score! - a.score!)
    .slice(0, 4);
  const upcoming =
    upcomingMatches ??
    data.matches
      .filter(
        (m) =>
          m.status === 'scheduled' && new Date(m.kickoff) >= new Date(`${activeDate}T00:00:00Z`),
      )
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
      .slice(0, 4);
  const tabs = [
    { id: 'all', label: 'Tous les matchs' },
    { id: 'live', label: 'En direct' },
    { id: 'scheduled', label: 'À venir' },
    { id: 'finished', label: 'Terminés' },
    { id: 'favorites', label: 'Favoris' },
  ];
  return (
    <div className="page">
      <SourceBanner data={data} />
      <div className="page-heading">
        <div>
          <span className="eyebrow">LE FOOTBALL, ÉCLAIRÉ PAR LES DONNÉES</span>
          <h1>{full ? 'Tous les matchs' : 'Le football, aujourd’hui.'}</h1>
          <p>Les matchs, les scores et les analyses. Tout simplement.</p>
        </div>
        <span className="date-heading">
          <CalendarDays size={15} />
          {new Date(`${activeDate}T12:00:00Z`).toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'UTC',
          })}
        </span>
      </div>
      <div className="match-section-heading">
        <div>
          <h2>
            {full && !params.has('date')
              ? 'Le calendrier et les résultats'
              : automaticDate && activeDate !== today
                ? activeDate < today
                  ? 'Les derniers résultats'
                  : 'Les prochains matchs'
                : `Les matchs ${activeDate === today ? 'du jour' : 'à l’affiche'}`}
          </h2>
          <span>
            {pagination?.total ?? dayMatches.length} rencontres{' '}
            <span className="divider-dot">·</span>{' '}
            {
              data.competitions.filter((c) => dayMatches.some((m) => m.competitionId === c.id))
                .length
            }{' '}
            compétitions
          </span>
        </div>
        <div className="date-controls">
          {full && (
            <button
              aria-pressed={!params.has('date')}
              onClick={() => changeFilters({ date: 'all' })}
            >
              Toutes les dates
            </button>
          )}
          <button aria-label="Jour précédent" onClick={() => moveDate(-1)}>
            <ChevronLeft size={17} />
          </button>
          <button
            onClick={() => {
              const d = new Date(`${today}T12:00:00Z`);
              d.setUTCDate(d.getUTCDate() - 1);
              setDate(d.toISOString().slice(0, 10));
            }}
          >
            Hier
          </button>
          <button
            aria-pressed={(!full || params.has('date')) && activeDate === today}
            onClick={() => setDate(today)}
          >
            Aujourd’hui
          </button>
          <button
            onClick={() => {
              const d = new Date(`${today}T12:00:00Z`);
              d.setUTCDate(d.getUTCDate() + 1);
              setDate(d.toISOString().slice(0, 10));
            }}
          >
            Demain
          </button>
          <button aria-label="Jour suivant" onClick={() => moveDate(1)}>
            <ChevronRight size={17} />
          </button>
          <label className="calendar-picker" title="Choisir une date">
            <CalendarDays size={16} />
            <input
              aria-label="Choisir une date"
              type="date"
              value={activeDate}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
      </div>
      {!full && automaticDate && activeDate !== today && (
        <p className="data-note" role="status">
          Aucune rencontre correspondant à ce filtre aujourd’hui dans les compétitions suivies.
          Voici une journée disponible. <Link href="/matchs">Voir tout le calendrier</Link>
        </p>
      )}

      {!full && live.matches.some((m) => m.status === 'live') && (
        <section className="live-strip" aria-label="Rencontres en direct">
          <SectionTitle
            title="En direct"
            eyebrow="LE MATCH SE JOUE MAINTENANT"
            href="/live"
            action="Tout le direct"
          />
          <div className="sport-card-grid">
            {live.matches
              .filter((m) => m.status === 'live')
              .slice(0, 4)
              .map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  teams={data.teams}
                  competition={data.competitions.find((c) => c.id === m.competitionId)}
                  changed={live.changed.includes(m.id)}
                />
              ))}
          </div>
          {!live.matches.some((m) => m.status === 'live') && (
            <p className="data-note">
              Aucun match en cours dans les compétitions synchronisées. Retrouvez le calendrier
              ci-dessous.
            </p>
          )}
          {live.error && (
            <p className="warning" role="status">
              Actualisation interrompue. Les derniers scores reçus restent affichés.
            </p>
          )}
        </section>
      )}
      <div className="dashboard-grid">
        <div className="dashboard-main" aria-busy={pending}>
          {pending && <p role="status">Chargement des matchs…</p>}
          <div className="match-filters" role="group" aria-label="Filtrer les matchs">
            {tabs.map((t) => (
              <button
                key={t.id}
                aria-pressed={status === t.id}
                className={status === t.id ? 'selected' : ''}
                onClick={() => setStatus(t.id)}
              >
                {t.id === 'live' && <span className="live-dot" />}
                {t.id === 'favorites' && <Star size={12} />} {t.label}
                {t.id === 'live' && (
                  <span className="count-pill">
                    {dayMatches.filter((m) => m.status === 'live').length}
                  </span>
                )}
              </button>
            ))}
            <button
              className="filter-toggle"
              aria-label="Afficher les filtres pays et compétition"
              aria-expanded={filters}
              onClick={() => setFilters(!filters)}
            >
              <SlidersHorizontal size={15} />
            </button>
          </div>
          {filters && (
            <div className="filter-panel">
              <label>
                Pays
                <select
                  aria-label="Pays"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="all">Tous les pays</option>
                  {[...new Set(data.competitions.map((c) => c.country))].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Compétition
                <select
                  aria-label="Compétition"
                  value={competition}
                  onChange={(e) => setCompetition(e.target.value)}
                >
                  <option value="all">Toutes les compétitions</option>
                  {data.competitions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="text-link"
                onClick={() => {
                  changeFilters({ pays: 'all', competition: 'all', statut: 'all' });
                }}
              >
                Réinitialiser
              </button>
            </div>
          )}
          {!filters && (country !== 'all' || competition !== 'all') && (
            <div className="filter-summary" aria-label="Filtres actifs">
              {country !== 'all' && <span>{country}</span>}
              {competition !== 'all' && (
                <span>
                  {data.competitions.find((c) => c.id === competition)?.name ?? competition}
                </span>
              )}
              <button onClick={() => changeFilters({ pays: 'all', competition: 'all' })}>
                Effacer les filtres
              </button>
            </div>
          )}
          {selected.length ? (
            <MatchList
              matches={selected}
              teams={data.teams}
              competitions={data.competitions}
              predictions={predictions}
              showDate={full}
            />
          ) : (
            <div className="card">
              <Empty
                title={
                  status === 'favorites'
                    ? 'Votre sélection commence ici'
                    : 'Aucune rencontre pour cette sélection'
                }
                text={
                  status === 'favorites'
                    ? 'Touchez l’étoile d’une rencontre, d’une équipe ou d’une compétition pour la retrouver ici.'
                    : 'Essayez une autre date ou modifiez les filtres.'
                }
              />
            </div>
          )}
          {pagination && pagination.pages > 1 && (
            <nav className="pagination" aria-label="Pagination des matchs">
              {pagination.page > 1 && (
                <Link
                  href={`?${new URLSearchParams({ ...Object.fromEntries(params), page: String(pagination.page - 1) })}`}
                >
                  Précédent
                </Link>
              )}
              <span>
                Page {pagination.page} sur {pagination.pages}
              </span>
              {pagination.page < pagination.pages && (
                <Link
                  href={`?${new URLSearchParams({ ...Object.fromEntries(params), page: String(pagination.page + 1) })}`}
                >
                  Suivant
                </Link>
              )}
            </nav>
          )}
          <p className="list-note">
            <span aria-hidden="true">↻</span>{' '}
            {data.source === 'demo'
              ? 'Direct simulé · Les scores de démonstration ne suivent pas un match réel.'
              : 'Actualisation toutes les 30 secondes · Selon la dernière synchronisation.'}
            <Link href="/methodologie">Comment lire les probabilités ?</Link>
          </p>
          <SectionTitle
            title="À ne pas manquer"
            eyebrow="PROCHAINEMENT"
            href="/matchs?statut=scheduled"
          />
          {!upcoming.length && <Empty text="Aucun prochain match disponible pour le moment." />}
          <div className="upcoming-grid">
            {upcoming.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                teams={data.teams}
                competition={data.competitions.find((c) => c.id === m.competitionId)}
                compact
              />
            ))}
          </div>
          <SectionTitle
            title="Les équipes à explorer"
            href="/comparateur/equipes"
            action="Comparer"
          />
          <div className="popular-teams">
            {data.teams.slice(0, 6).map((t) => (
              <Link className="card" key={t.id} href={`/equipe/${t.slug}`}>
                <TeamBadge team={t} size={36} />
                <strong>{t.short}</strong>
                <small>{t.country}</small>
              </Link>
            ))}
          </div>
        </div>
        <aside className="right-rail">
          <section className="card insight-card">
            <div className="rail-heading">
              <span className="icon-tile">
                <TrendingUp size={16} />
              </span>
              <h2>Le regard du modèle</h2>
              <span className="beta">V1</span>
            </div>
            <p>
              La lecture statistique {activeDate === today ? 'du jour' : 'de cette journée'},
              <br />
              en toute transparence.
            </p>
            {featured && home && away ? (
              <>
                <div className="insight-teams">
                  <span>
                    <TeamBadge team={home} size={20} />
                    {home.short}
                  </span>
                  <span className="muted">vs</span>
                  <span>
                    <TeamBadge team={away} size={20} />
                    {away.short}
                  </span>
                </div>
                <div className="insight-main">
                  <span>Score individuel le plus probable</span>
                  <strong>
                    {predictions[featured.id].scores[0]
                      ? predictions[featured.id].likelyScore
                      : 'Non disponible'}
                  </strong>
                  <small>
                    {formatProbability(predictions[featured.id].scores[0]?.probability)} pour ce
                    score précis
                  </small>
                </div>
                <ProbabilityBar {...predictions[featured.id]} />
                <div className="quality-row">
                  <span>Qualité des informations</span>
                  <b>{predictions[featured.id].confidence}/100</b>
                </div>
                <Link className="outline-link" href={`/match/${featured.slug}?onglet=prediction`}>
                  Comprendre la projection <ArrowRight size={13} />
                </Link>
              </>
            ) : (
              <Empty text="Les projections apparaîtront après collecte de l’historique." />
            )}
            <div className="rail-disclaimer">Une estimation statistique, jamais une garantie.</div>
          </section>
          <section className="card players-card">
            <div className="rail-heading">
              <span className="icon-tile amber">
                <Zap size={16} />
              </span>
              <h2>Joueurs à suivre</h2>
            </div>
            <p>Les profils qui ressortent des données.</p>
            {!starPlayers.length && (
              <Empty text="Les données des joueurs ne sont pas disponibles pour le moment." />
            )}
            {starPlayers.map((p, i) => {
              const t = data.teams.find((t) => t.id === p.teamId)!;
              return (
                <Link key={p.id} href={`/joueur/${p.slug}`} className="player-ranking">
                  <span className="rank-index">0{i + 1}</span>
                  <span
                    className="player-avatar"
                    style={{ '--team-color': t.color } as React.CSSProperties}
                  >
                    {p.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {t.short} <span>·</span> {p.position}
                    </small>
                  </span>
                  <b>
                    {p.score}
                    <small>/100</small>
                  </b>
                </Link>
              );
            })}
            <Link className="text-link player-see-all" href="/joueurs">
              Explorer les joueurs <ArrowRight size={13} />
            </Link>
          </section>
          <AdSlot />
        </aside>
      </div>
    </div>
  );
}
