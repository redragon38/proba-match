'use client';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { Competition, Match, Prediction, Team } from '@/types/football';
import { TeamBadge, Empty } from '@/components/ui';
import { FavoriteButton, useFavorites } from '@/features/favorites';
import { LocalTime } from '@/components/local-time';
import { probabilityPercentages } from '@/lib/probability-format';
export function MatchList({
  matches,
  teams,
  competitions,
  predictions,
  showDate = false,
}: {
  matches: Match[];
  teams: Team[];
  competitions: Competition[];
  predictions: Record<string, Prediction>;
  showDate?: boolean;
}) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const { values } = useFavorites();
  if (!matches.length)
    return (
      <div className="card">
        <Empty
          title="Aucune rencontre disponible"
          text="Aucun match ne correspond à cette sélection dans le catalogue synchronisé."
        />
      </div>
    );
  return (
    <div className="match-groups">
      {[...competitions]
        .sort(
          (a, b) =>
            Number(values.includes(`competition:${b.id}`)) -
            Number(values.includes(`competition:${a.id}`)),
        )
        .map((comp) => {
          const rows = matches.filter((m) => m.competitionId === comp.id);
          if (!rows.length) return null;
          return (
            <section className="card match-group" key={comp.id}>
              <div className="competition-heading">
                <span className="competition-flag">{comp.flag}</span>
                <Link href={`/competition/${comp.slug}`}>
                  <strong>{comp.name}</strong>
                  <span>
                    {comp.country} <span className="divider-dot">·</span> {rows[0].round}
                  </span>
                </Link>
                <FavoriteButton id={`competition:${comp.id}`} label={comp.name} />
                <button
                  className="icon-button collapse-competition"
                  aria-label={`${collapsed.includes(comp.id) ? 'Déplier' : 'Replier'} ${comp.name}`}
                  aria-expanded={!collapsed.includes(comp.id)}
                  onClick={() =>
                    setCollapsed((c) =>
                      c.includes(comp.id) ? c.filter((id) => id !== comp.id) : [...c, comp.id],
                    )
                  }
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              {!collapsed.includes(comp.id) && (
                <>
                  <div className="match-column-labels">
                    <span>RENCONTRE</span>
                    <span>PROBABILITÉS 1 · N · 2</span>
                  </div>
                  {rows.map((m) => {
                    const home = teams.find((t) => t.id === m.homeId)!,
                      away = teams.find((t) => t.id === m.awayId)!,
                      p = predictions[m.id];
                    if (!home || !away) return null;
                    return (
                      <div className="match-row" key={m.id}>
                        <div className={`match-clock ${m.status === 'live' ? 'is-live' : ''}`}>
                          {showDate && (
                            <small>
                              <LocalTime
                                iso={m.kickoff}
                                date
                                known={m.kickoffKnown}
                                sourceDate={m.sourceDate}
                              />
                            </small>
                          )}
                          {m.status === 'live' ? (
                            <>
                              <span className="live-dot" />
                              {m.phase === 'halftime'
                                ? 'Mi-temps'
                                : `${m.minute ?? 'Live'}′${m.extra ? `+${m.extra}` : ''}`}
                            </>
                          ) : m.status === 'finished' ? (
                            <>
                              <span>TER.</span>
                              <small>
                                <LocalTime iso={m.kickoff} known={m.kickoffKnown} />
                              </small>
                            </>
                          ) : m.status === 'postponed' ? (
                            'Reporté'
                          ) : m.status === 'cancelled' || m.status === 'abandoned' ? (
                            m.status === 'abandoned' ? (
                              'Abandonné'
                            ) : (
                              'Annulé'
                            )
                          ) : (
                            <LocalTime iso={m.kickoff} known={m.kickoffKnown} />
                          )}
                        </div>
                        <Link href={`/match/${m.slug}`} className="match-teams">
                          <span>
                            <TeamBadge team={home} size={23} />
                            {home.name}
                            {m.events.some((e) => e.teamId === home.id && e.type === 'red') && (
                              <i className="red-card" />
                            )}
                          </span>
                          <span>
                            <TeamBadge team={away} size={23} />
                            {away.name}
                            {m.events.some((e) => e.teamId === away.id && e.type === 'red') && (
                              <i className="red-card" />
                            )}
                          </span>
                        </Link>
                        <Link
                          href={`/match/${m.slug}`}
                          className={`match-score ${m.status === 'live' ? 'is-live' : ''}`}
                          aria-label={`Score ${home.short} ${m.homeScore ?? 'à venir'} ${away.short} ${m.awayScore ?? ''}`}
                        >
                          <b>{m.homeScore ?? '–'}</b>
                          <b>{m.awayScore ?? '–'}</b>
                        </Link>
                        <div className="row-prediction">
                          {p ? (
                            <>
                              <div className="prob-chips">
                                {[p.home, p.draw, p.away].map((v, i) => (
                                  <span
                                    key={i}
                                    className={
                                      v === Math.max(p.home, p.draw, p.away) ? 'highest' : ''
                                    }
                                  >
                                    {probabilityPercentages(p.home, p.draw, p.away)[i]}
                                    <small>%</small>
                                  </span>
                                ))}
                              </div>
                              <span
                                className="confidence-caption"
                                title="La confiance mesure la qualité des informations, pas la chance de victoire."
                              >
                                <i /> Qualité des données : {p.confidence}/100
                              </span>
                            </>
                          ) : (
                            <span className="muted tiny">Données insuffisantes</span>
                          )}
                        </div>
                        <FavoriteButton
                          id={`match:${m.id}`}
                          label={`${home.short} – ${away.short}`}
                        />
                        <Link
                          href={`/match/${m.slug}`}
                          className="row-arrow"
                          aria-label={`Voir ${home.short} – ${away.short}`}
                        >
                          <ChevronRight size={17} />
                        </Link>
                      </div>
                    );
                  })}
                </>
              )}
            </section>
          );
        })}
    </div>
  );
}
