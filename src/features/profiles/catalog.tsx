'use client';
import Link from 'next/link';
import { CompetitionBadge } from '@/components/ui';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Dataset } from '@/types/football';
import { SourceBanner } from '@/components/source-banner';
import { Empty, TeamBadge } from '@/components/ui';
import { FavoriteButton } from '@/features/favorites';
import { normalizeSearch, tolerantNameMatch } from '@/services/search-index';
export function Catalog({
  data,
  kind,
  initialPage = 1,
  initialSearch = '',
  total,
}: {
  data: Dataset;
  kind: 'players' | 'competitions' | 'teams';
  initialPage?: number;
  initialSearch?: string;
  total?: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch),
    [page, setPage] = useState(initialPage);
  const path = kind === 'players' ? '/joueurs' : kind === 'teams' ? '/equipes' : '/competitions';
  useEffect(() => {
    if (total === undefined || search === initialSearch) return;
    const timer = setTimeout(
      () => router.replace(`${path}${search ? `?q=${encodeURIComponent(search)}` : ''}`),
      350,
    );
    return () => clearTimeout(timer);
  }, [search, initialSearch, total, path, router]);
  const rows = (
    kind === 'players' ? data.players : kind === 'teams' ? data.teams : data.competitions
  ).filter((r) => tolerantNameMatch(normalizeSearch(r.name), normalizeSearch(search)));
  const count = total ?? rows.length;
  const pageHref = (n: number) =>
    `${path}${n > 1 || search ? `?${new URLSearchParams({ ...(n > 1 ? { page: String(n) } : {}), ...(search ? { q: search } : {}) })}` : ''}`;
  return (
    <div className="page">
      <SourceBanner data={data} />
      <span className="eyebrow">EXPLORER LE FOOTBALL</span>
      <h1>
        {kind === 'players'
          ? 'Les acteurs du jeu.'
          : kind === 'teams'
            ? 'Les clubs qui font le football.'
            : 'Toutes les compétitions.'}
      </h1>
      {kind === 'players' && data.players.some((player) => player.source === 'espn') && (
        <p className="data-note">
          Catalogue ESPN : effectifs et statistiques de saison disponibles. Les données absentes
          sont signalées sur les profils.
        </p>
      )}
      {kind === 'players' && data.players.some((player) => player.source === 'thesportsdb') && (
        <p className="data-note">
          Catalogue partiel fourni par{' '}
          <a href="https://www.thesportsdb.com/" target="_blank" rel="noopener noreferrer">
            TheSportsDB
          </a>{' '}
          : l’API gratuite ne renvoie qu’une sélection de joueurs par club. Effectifs et
          statistiques non vérifiés en temps réel.
        </p>
      )}
      {(kind !== 'players' || data.players.length > 0 || !!initialSearch) && (
        <div className="catalog-search">
          <label htmlFor="catalog-search">
            Rechercher{' '}
            {kind === 'players' ? 'un joueur' : kind === 'teams' ? 'une équipe' : 'une compétition'}
          </label>
          <input
            id="catalog-search"
            type="search"
            placeholder="Saisissez un nom…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      )}
      <div className="catalog-grid">
        {rows
          .slice(total === undefined ? (page - 1) * 24 : 0, total === undefined ? page * 24 : 24)
          .map((r) => {
            const player = 'teamId' in r ? r : null;
            const team = player
              ? data.teams.find((t) => t.id === player.teamId)
              : kind === 'teams'
                ? data.teams.find((t) => t.id === r.id)
                : null;
            return (
              <div className="card catalog-item" key={r.id}>
                <Link
                  href={`/${kind === 'players' ? 'joueur' : kind === 'teams' ? 'equipe' : 'competition'}/${r.slug}`}
                >
                  {team ? (
                    <TeamBadge team={team} size={40} />
                  ) : 'flag' in r ? (
                    <CompetitionBadge competition={r} size={40} />
                  ) : (
                    <span className="competition-icon">⚽</span>
                  )}
                  <div>
                    <h2>{r.name}</h2>
                    <p>
                      {player
                        ? `${team?.short} · ${player.position}`
                        : 'country' in r
                          ? r.country
                          : ''}
                    </p>
                  </div>
                </Link>
                <FavoriteButton
                  id={`${kind === 'players' ? 'player' : kind === 'teams' ? 'team' : 'competition'}:${r.id}`}
                  label={r.name}
                />
              </div>
            );
          })}
      </div>
      {!rows.length && (
        <>
          <Empty
            title={
              kind === 'players' && !data.players.length && !initialSearch
                ? 'Les données des joueurs ne sont pas disponibles pour le moment.'
                : 'Aucun résultat'
            }
            text={
              kind === 'players' && !data.players.length && !initialSearch
                ? 'La source actuelle fournit les matchs et résultats, mais pas les effectifs. Les joueurs apparaîtront après l’ajout d’une source complémentaire.'
                : undefined
            }
          />
          {kind === 'players' && !data.players.length && !initialSearch && (
            <p className="data-note">
              Explorez les <Link href="/equipes">équipes</Link> et les{' '}
              <Link href="/matchs">matchs disponibles</Link>.
            </p>
          )}
        </>
      )}
      {count > 24 && (
        <div className="pagination">
          {(total !== undefined || !search) && page > 1 ? (
            <Link className="button secondary" href={pageHref(page - 1)}>
              Précédent
            </Link>
          ) : (
            <button
              className="button secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Précédent
            </button>
          )}
          <span>
            Page {page} / {Math.ceil(count / 24)}
          </span>
          {(total !== undefined || !search) && page * 24 < count ? (
            <Link className="button secondary" href={pageHref(page + 1)}>
              Suivant
            </Link>
          ) : (
            <button
              className="button secondary"
              disabled={page * 24 >= count}
              onClick={() => setPage(page + 1)}
            >
              Suivant
            </button>
          )}
        </div>
      )}
    </div>
  );
}
