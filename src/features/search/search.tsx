'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Search as SearchIcon, ArrowUpRight } from 'lucide-react';
import type { SearchResults, SearchSource } from '@/services/search-index';
import { SourceBanner } from '@/components/source-banner';
import { Empty, SectionTitle, TeamBadge } from '@/components/ui';
import { FavoriteButton, useFavorites } from '@/features/favorites';
import { NotificationSettings } from '@/features/notifications';
export function SearchPage({
  data,
  initialResults,
  favorites = false,
  initialQ = '',
}: {
  data: SearchSource;
  initialResults: SearchResults;
  favorites?: boolean;
  initialQ?: string;
}) {
  const [q, setQ] = useState(initialQ);
  const [category, setCategory] = useState('all');
  const { values } = useFavorites();
  const ids = favorites ? JSON.stringify(values) : '';
  const queryKey = JSON.stringify({ q, category, ids });
  const [retry, setRetry] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);
  const [page, setPage] = useState({
    ...initialResults,
    key: queryKey,
    loading: false,
    error: false,
  });
  const pending = page.key !== queryKey || page.loading;
  const results = page.key === queryKey ? page.results : [];
  useEffect(() => {
    const controller = new AbortController();
    activeRequest.current = controller;
    const timer = setTimeout(async () => {
      try {
        const next = await fetchResults(
          { q, category, ids, favorites, offset: 0 },
          controller.signal,
        );
        if (!controller.signal.aborted)
          setPage({ ...next, key: queryKey, loading: false, error: false });
      } catch {
        if (!controller.signal.aborted)
          setPage((previous) => ({
            ...(previous.key === queryKey ? previous : { results: [], total: 0 }),
            key: queryKey,
            loading: false,
            error: true,
          }));
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      activeRequest.current?.abort();
    };
  }, [q, category, ids, favorites, queryKey, retry, data.updatedAt]);
  async function loadMore() {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setPage((previous) => ({ ...previous, loading: true, error: false }));
    try {
      const next = await fetchResults(
        { q, category, ids, favorites, offset: results.length },
        controller.signal,
      );
      if (!controller.signal.aborted)
        setPage((previous) => ({
          ...next,
          key: queryKey,
          loading: false,
          error: false,
          results: [
            ...previous.results,
            ...next.results.filter((row) => !previous.results.some((old) => old.id === row.id)),
          ],
        }));
    } catch {
      if (!controller.signal.aborted)
        setPage((previous) => ({ ...previous, loading: false, error: true }));
    }
  }
  return (
    <div className="page">
      <SourceBanner data={data} />
      <span className="eyebrow">
        {favorites ? 'VOTRE FOOTBALL, AU MÊME ENDROIT' : 'UNE ÉQUIPE, UN JOUEUR, UNE RENCONTRE'}
      </span>
      <h1>{favorites ? 'Mes favoris' : 'Rechercher une équipe, un joueur ou un match'}</h1>
      <div className="global-search card">
        <SearchIcon size={21} />
        <label className="sr-only" htmlFor="global-search">
          Rechercher équipes, joueurs, compétitions et matchs
        </label>
        <input
          id="global-search"
          type="search"
          value={q}
          maxLength={100}
          autoComplete="off"
          placeholder="Rechercher une équipe, un joueur, une compétition…"
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="suggestions" role="group" aria-label="Catégories de recherche">
        {['all', 'Équipe', 'Joueur', 'Compétition', 'Match'].map((c) => (
          <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>
            {c === 'all' ? 'Tout' : c}
          </button>
        ))}
      </div>
      <p className="data-note" role="status" aria-live="polite">
        {pending
          ? 'Recherche en cours…'
          : `${page.total} résultat(s)${favorites ? ' enregistré(s) sur cet appareil' : ''}`}
      </p>
      {page.key === queryKey && page.error && (
        <div className="warning" role="alert">
          La recherche est momentanément indisponible. Vos favoris restent enregistrés.
          <button className="button secondary" onClick={() => setRetry((value) => value + 1)}>
            Réessayer
          </button>
        </div>
      )}
      <div className="card search-results" aria-busy={pending}>
        {results.map((r) => (
          <div className="search-result" key={r.id}>
            <Link href={r.href}>
              {r.team && <TeamBadge team={r.team} size={28} />}
              <span className="tag">{r.kind}</span>
              <div>
                <h2>{r.name}</h2>
                <p>{r.detail}</p>
              </div>
              <ArrowUpRight size={16} />
            </Link>
            <FavoriteButton id={r.id} label={r.name} />
          </div>
        ))}
        {!pending && !page.error && !results.length && (
          <Empty
            title={favorites ? 'Votre sélection commence ici' : 'Aucun résultat'}
            text={
              favorites
                ? 'Ajoutez des favoris avec les étoiles présentes sur les pages. Aucun compte nécessaire.'
                : 'Essayez un autre nom ou une orthographe plus courte.'
            }
          />
        )}
      </div>
      {page.key === queryKey && page.total > results.length && (
        <button
          className="button secondary space-top"
          disabled={pending || page.error}
          onClick={loadMore}
        >
          Afficher 25 résultats de plus
        </button>
      )}
      {favorites && (
        <>
          <SectionTitle title="Notifications de vos matchs" />
          <NotificationSettings />
        </>
      )}
    </div>
  );
}

async function fetchResults(
  {
    q,
    category,
    ids,
    favorites,
    offset,
  }: { q: string; category: string; ids: string; favorites: boolean; offset: number },
  signal: AbortSignal,
): Promise<SearchResults> {
  const params = new URLSearchParams({ scope: 'catalogue', q, category, offset: String(offset) });
  const response = await fetch(favorites ? '/api/search' : `/api/search?${params}`, {
    signal,
    ...(favorites
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q, category, offset, ids: JSON.parse(ids) }),
        }
      : {}),
  });
  if (!response.ok) throw new Error('Search unavailable');
  return response.json();
}
