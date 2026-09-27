'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Dataset } from '@/types/football';
import { SourceBanner } from '@/components/source-banner';
import { Empty, TeamBadge } from '@/components/ui';
import { FavoriteButton } from '@/features/favorites';
import { normalizeSearch } from '@/services/search-index';
export function Catalog({
  data,
  kind,
  initialPage = 1,
}: {
  data: Dataset;
  kind: 'players' | 'competitions' | 'teams';
  initialPage?: number;
}) {
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(initialPage);
  const path = kind === 'players' ? '/joueurs' : kind === 'teams' ? '/equipes' : '/competitions';
  const rows = (
    kind === 'players' ? data.players : kind === 'teams' ? data.teams : data.competitions
  ).filter((r) => normalizeSearch(r.name).includes(normalizeSearch(search)));
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
      {(kind !== 'players' || data.players.length > 0) && (
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
        {rows.slice((page - 1) * 24, page * 24).map((r) => {
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
                ) : (
                  <span className="competition-icon">{'flag' in r ? r.flag : '⚽'}</span>
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
              kind === 'players' && !data.players.length
                ? 'Les données des joueurs ne sont pas disponibles pour le moment.'
                : 'Aucun résultat'
            }
            text={
              kind === 'players' && !data.players.length
                ? 'La source actuelle fournit les matchs et résultats, mais pas les effectifs. Les joueurs apparaîtront après l’ajout d’une source complémentaire.'
                : undefined
            }
          />
          {kind === 'players' && !data.players.length && (
            <p className="data-note">
              Explorez les <Link href="/equipes">équipes</Link> et les{' '}
              <Link href="/matchs">matchs disponibles</Link>.
            </p>
          )}
        </>
      )}
      {rows.length > 24 && (
        <div className="pagination">
          {!search && page > 1 ? (
            <Link
              className="button secondary"
              href={page === 2 ? path : `${path}?page=${page - 1}`}
            >
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
            Page {page} / {Math.ceil(rows.length / 24)}
          </span>
          {!search && page * 24 < rows.length ? (
            <Link className="button secondary" href={`${path}?page=${page + 1}`}>
              Suivant
            </Link>
          ) : (
            <button
              className="button secondary"
              disabled={page * 24 >= rows.length}
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
