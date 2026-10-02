'use client';
import Link from 'next/link';
import type { Match, Team, Competition, Prediction } from '@/types/football';
import { TeamBadge, ProbabilityCompact } from '@/components/ui';
import { LocalTime } from '@/components/local-time';
import { FavoriteButton } from '@/features/favorites';
export function MatchCard({
  match: m,
  teams,
  competition,
  prediction,
  compact = false,
  changed = false,
}: {
  match: Match;
  teams: Team[];
  competition?: Competition;
  prediction?: Prediction;
  compact?: boolean;
  changed?: boolean;
}) {
  const home = teams.find((t) => t.id === m.homeId),
    away = teams.find((t) => t.id === m.awayId);
  if (!home || !away) return null;
  const live = m.status === 'live';
  return (
    <article
      className={`sport-match-card ${compact ? 'compact' : ''} ${live ? 'live-card' : ''} ${changed ? 'score-changed' : ''}`}
    >
      <div className="sport-card-meta">
        <span>
          {competition?.flag} {competition?.name ?? 'Compétition non disponible'}
        </span>
        <FavoriteButton id={`match:${m.id}`} label={`${home.short} – ${away.short}`} />
      </div>
      <Link href={`/match/${m.slug}`} className="sport-card-body">
        <span className={`match-state ${live ? 'is-live' : ''}`}>
          {live ? (
            <>
              <i className="live-dot" aria-hidden="true" />
              {m.phase === 'halftime'
                ? 'Mi-temps'
                : `${m.minute ?? 'Direct'}${m.minute != null ? '′' : ''}`}
            </>
          ) : m.status === 'finished' ? (
            'Terminé'
          ) : m.status === 'postponed' ? (
            'Reporté'
          ) : m.status === 'cancelled' || m.status === 'abandoned' ? (
            m.status === 'abandoned' ? (
              'Abandonné'
            ) : (
              'Annulé'
            )
          ) : (
            <span>
              <LocalTime iso={m.kickoff} date known={m.kickoffKnown} sourceDate={m.sourceDate} /> ·{' '}
              <LocalTime iso={m.kickoff} known={m.kickoffKnown} />
            </span>
          )}
        </span>
        {[home, away].map((t, i) => (
          <div className="sport-team" key={t.id}>
            <TeamBadge team={t} size={30} />
            <strong>{t.name}</strong>
            {m.events.some((e) => e.teamId === t.id && e.type === 'red') && (
              <span className="red-card" aria-label="Carton rouge" />
            )}
            <b>{(i === 0 ? m.homeScore : m.awayScore) ?? '–'}</b>
          </div>
        ))}
      </Link>
      {!compact && prediction && m.status === 'scheduled' && (
        <div className="sport-card-projection">
          <span>Probabilités du match · 1 domicile, N nul, 2 extérieur</span>
          <ProbabilityCompact {...prediction} homeName={home.name} awayName={away.name} />
        </div>
      )}
      {live &&
        m.statistics.some(
          (s) => s.label === 'Tirs cadrés' && s.home !== null && s.away !== null,
        ) && (
          <p className="sport-card-foot">
            Tirs cadrés {m.statistics.find((s) => s.label === 'Tirs cadrés')?.home} –{' '}
            {m.statistics.find((s) => s.label === 'Tirs cadrés')?.away}
          </p>
        )}
      {m.status === 'finished' && m.events.some((e) => e.type === 'goal') && (
        <p className="sport-card-foot">
          ⚽{' '}
          {m.events
            .filter((e) => e.type === 'goal')
            .map((e) => `${e.player} ${e.minute}′`)
            .join(' · ')}
        </p>
      )}
    </article>
  );
}
