import Link from 'next/link';
import type { Dataset, Match, MatchPlayerPerformance, Player, PlayerStats } from '@/types/football';
import { ProviderImage } from '@/components/provider-image';
import { SectionTitle } from '@/components/ui';
import { number } from '@/lib/format';

type Entry = {
  id: string;
  name: string;
  number: number | null;
  performance?: MatchPlayerPerformance;
};

export const playerStatGroups: {
  title: string;
  fields: { key: keyof PlayerStats; label: string; digits?: number }[];
}[] = [
  {
    title: 'Général',
    fields: [
      { key: 'minutes', label: 'Minutes' },
      { key: 'goals', label: 'Buts' },
      { key: 'assists', label: 'Passes décisives' },
      { key: 'rating', label: 'Note du fournisseur', digits: 2 },
    ],
  },
  {
    title: 'Tirs et passes',
    fields: [
      { key: 'shots', label: 'Tirs' },
      { key: 'shotsOnTarget', label: 'Tirs cadrés' },
      { key: 'xg', label: 'xG', digits: 2 },
      { key: 'passes', label: 'Passes' },
      { key: 'passesCompleted', label: 'Passes réussies' },
      { key: 'keyPasses', label: 'Passes clés' },
      { key: 'passAccuracy', label: 'Précision passes (%)', digits: 1 },
      { key: 'xa', label: 'xA', digits: 2 },
    ],
  },
  {
    title: 'Défense et gardien',
    fields: [
      { key: 'tackles', label: 'Tacles' },
      { key: 'interceptions', label: 'Interceptions' },
      { key: 'blocks', label: 'Tirs bloqués' },
      { key: 'duelsTotal', label: 'Duels' },
      { key: 'duels', label: 'Duels gagnés' },
      { key: 'saves', label: 'Arrêts' },
      { key: 'conceded', label: 'Buts encaissés' },
      { key: 'penaltiesSaved', label: 'Penalties arrêtés' },
    ],
  },
  {
    title: 'Discipline',
    fields: [
      { key: 'fouls', label: 'Fautes' },
      { key: 'yellow', label: 'Cartons jaunes' },
      { key: 'red', label: 'Cartons rouges' },
    ],
  },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function PlayerRow({
  entry,
  profile,
  matchSlug,
}: {
  entry: Entry;
  profile?: Player;
  matchSlug: string;
}) {
  const stats = entry.performance?.stats;
  const facts = playerStatGroups
    .flatMap((group) => group.fields)
    .filter(({ key }) => key !== 'minutes' && stats?.[key] != null)
    .slice(0, 3);
  const avatar = (
    <span className="match-player-avatar" aria-hidden="true">
      {initials(entry.name)}
    </span>
  );
  return (
    <li className="match-player-row">
      {profile?.photo ? (
        <ProviderImage
          src={profile.photo}
          alt={`Portrait de ${entry.name}`}
          size={38}
          fallback={avatar}
        />
      ) : (
        avatar
      )}
      <div className="match-player-identity">
        {profile ? (
          <Link href={`/joueur/${profile.slug}?match=${encodeURIComponent(matchSlug)}`}>
            {entry.name}
          </Link>
        ) : (
          <strong>{entry.name}</strong>
        )}
        <small>
          {entry.number != null ? `N° ${entry.number} · ` : ''}
          {entry.performance?.position ?? profile?.position ?? 'Poste non disponible'}
          {stats?.minutes != null ? ` · ${stats.minutes} min` : ''}
        </small>
      </div>
      {facts.length > 0 && (
        <div className="match-player-facts">
          {facts.map(({ key, label, digits }) => (
            <span key={key} title={label}>
              {label} <b>{number(stats?.[key], digits)}</b>
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

function PlayerGroup({
  title,
  entries,
  profiles,
  matchSlug,
}: {
  title: string;
  entries: Entry[];
  profiles: Map<string, Player>;
  matchSlug: string;
}) {
  if (!entries.length) return null;
  return (
    <div className="match-player-group">
      <h4>
        {title} <small>({entries.length})</small>
      </h4>
      <ul>
        {entries.map((entry) => (
          <PlayerRow
            key={entry.id}
            entry={entry}
            profile={profiles.get(entry.id)}
            matchSlug={matchSlug}
          />
        ))}
      </ul>
    </div>
  );
}

export function PlayerPerformances({ match, data }: { match: Match; data: Dataset }) {
  const profiles = new Map(data.players.map((player) => [player.id, player]));
  const performances = new Map(
    (match.performances ?? []).map((performance) => [performance.playerId, performance]),
  );
  const teams = [match.homeId, match.awayId].map((id) =>
    data.teams.find((team) => team.id === id)!,
  );
  const hasMatchPlayers =
    match.lineups.some((lineup) => lineup.starters.length || lineup.substitutes.length) ||
    performances.size > 0;
  const contributors = [...performances.values()].filter(
    (row) => (row.stats.goals ?? 0) > 0 || (row.stats.assists ?? 0) > 0,
  );
  return (
    <>
      <SectionTitle title="Joueurs" eyebrow="ÉQUIPES ET DONNÉES DU MATCH" />
      <p className="data-note">
        {hasMatchPlayers
          ? 'Les titulaires et remplaçants proviennent des compositions transmises. Les statistiques individuelles apparaissent uniquement lorsqu’elles sont fournies pour cette rencontre.'
          : 'Profils rattachés au club par la source, liste partielle. Leur présence sur cette page ne confirme pas leur participation à la rencontre.'}
      </p>
      {contributors.length > 0 && (
        <section className="card padded match-contributors">
          <h3>Joueurs décisifs</h3>
          <p className="data-note">
            Uniquement les buts et passes décisives transmis pour ce match.
          </p>
          <ul>
            {contributors.map((row) => {
              const profile = profiles.get(row.playerId);
              return (
                <li key={row.playerId}>
                  {profile ? (
                    <Link href={`/joueur/${profile.slug}?match=${encodeURIComponent(match.slug)}`}>
                      {row.name}
                    </Link>
                  ) : (
                    row.name
                  )}{' '}
                  ·{' '}
                  {[
                    (row.stats.goals ?? 0) > 0 &&
                      `${row.stats.goals} but${row.stats.goals! > 1 ? 's' : ''}`,
                    (row.stats.assists ?? 0) > 0 &&
                      `${row.stats.assists} passe${row.stats.assists! > 1 ? 's' : ''} décisive${row.stats.assists! > 1 ? 's' : ''}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <div className="match-player-teams">
        {teams.map((team) => {
          const lineup = match.lineups.find((row) => row.teamId === team.id);
          const ids = new Set<string>();
          const mapLineup = (rows: { id: string; name: string; number: number | null }[]) =>
            rows.map((row) => {
              ids.add(row.id);
              return { ...row, performance: performances.get(row.id) };
            });
          const starters = mapLineup(lineup?.starters ?? []);
          const substitutes = mapLineup(lineup?.substitutes ?? []);
          const observed = [...performances.values()]
            .filter((row) => row.teamId === team.id && !ids.has(row.playerId))
            .map((row) => ({
              id: row.playerId,
              name: row.name,
              number: row.number,
              performance: row,
            }));
          const roster =
            !starters.length && !substitutes.length && !observed.length
              ? data.players
                  .filter((player) => player.teamId === team.id)
                  .map((player) => ({ id: player.id, name: player.name, number: player.number }))
              : [];
          const absences = data.injuries.filter((injury) => injury.teamId === team.id);
          return (
            <section className="card match-player-team" key={team.id}>
              <h3>
                <Link href={`/equipe/${team.slug}`}>{team.name}</Link>
              </h3>
              {lineup && (
                <p className="data-note">
                  {lineup.formation !== 'Non disponible' ? `${lineup.formation} · ` : ''}
                  {lineup.confirmed
                    ? 'Composition officielle transmise'
                    : 'Composition transmise, statut ou contenu incomplet'}
                </p>
              )}
              {!lineup && (
                <p className="data-note">Aucune composition transmise pour cette équipe.</p>
              )}
              <PlayerGroup
                title="Titulaires"
                entries={starters}
                profiles={profiles}
                matchSlug={match.slug}
              />
              <PlayerGroup
                title="Remplaçants"
                entries={substitutes}
                profiles={profiles}
                matchSlug={match.slug}
              />
              <PlayerGroup
                title="Joueurs avec données de match"
                entries={observed}
                profiles={profiles}
                matchSlug={match.slug}
              />
              <PlayerGroup
                title="Profils référencés · participation non confirmée"
                entries={roster}
                profiles={profiles}
                matchSlug={match.slug}
              />
              {absences.length > 0 && (
                <div className="match-player-group">
                  <h4>Absences signalées</h4>
                  <ul>
                    {absences.map((injury) => {
                      const player = profiles.get(injury.playerId);
                      return (
                        <li key={injury.id} className="match-player-absence">
                          {player ? (
                            <Link
                              href={`/joueur/${player.slug}?match=${encodeURIComponent(match.slug)}`}
                            >
                              {player.name}
                            </Link>
                          ) : (
                            'Joueur non relié'
                          )}{' '}
                          · {injury.reason} ({injury.status})
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {!starters.length && !substitutes.length && !observed.length && !roster.length && (
                <p className="data-note">
                  Aucune donnée joueur fiable disponible pour cette équipe.
                </p>
              )}
            </section>
          );
        })}
      </div>
      {performances.size > 0 && (
        <details className="card padded match-player-details">
          <summary>Voir toutes les statistiques individuelles</summary>
          <div className="match-player-stat-grid">
            {[...performances.values()].map((row) => {
              const profile = profiles.get(row.playerId);
              return (
                <section key={row.playerId}>
                  <h4>
                    {profile ? (
                      <Link
                        href={`/joueur/${profile.slug}?match=${encodeURIComponent(match.slug)}`}
                      >
                        {row.name}
                      </Link>
                    ) : (
                      row.name
                    )}
                  </h4>
                  {playerStatGroups.map((group) => {
                    const fields = group.fields.filter(({ key }) => row.stats[key] != null);
                    return fields.length ? (
                      <div key={group.title}>
                        <h5>{group.title}</h5>
                        <dl>
                          {fields.map(({ key, label, digits }) => (
                            <div key={key}>
                              <dt>{label}</dt>
                              <dd>{number(row.stats[key], digits)}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ) : null;
                  })}
                </section>
              );
            })}
          </div>
        </details>
      )}
    </>
  );
}
