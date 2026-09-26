'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { emitAnalytics } from '@/lib/analytics';
import { TeamBadge } from './ui';
import type { Team } from '@/types/football';
type Result = {
  id: string;
  name: string;
  kind: string;
  href: string;
  detail: string;
  team?: Pick<Team, 'name' | 'short' | 'country' | 'color' | 'logo'>;
};
export function QuickSearch() {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(''),
    [results, setResults] = useState<Result[]>([]),
    [state, setState] = useState('idle');
  function open() {
    dialog.current?.showModal();
    input.current?.focus();
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState('loading');
      emitAnalytics('search');
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!r.ok) throw new Error();
        const json = await r.json();
        if (controller.signal.aborted) return;
        setResults([...json.results].sort((a: Result, b: Result) => a.kind.localeCompare(b.kind)));
        setActive(0);
        setState('ready');
      } catch {
        if (!controller.signal.aborted) setState('error');
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, retry]);
  useEffect(() => {
    document.getElementById(`quick-result-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  return (
    <>
      <button
        className="search-trigger"
        aria-label="Rechercher une équipe ou un joueur"
        onClick={open}
      >
        <Search size={17} />
        <span>Équipe, joueur, match…</span>
        <kbd>Ctrl K</kbd>
      </button>
      <dialog
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            dialog.current?.close();
          }
        }}
        className="quick-search"
        ref={dialog}
        aria-label="Recherche globale"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="quick-search-top">
          <Search size={20} />
          <input
            ref={input}
            aria-label="Rechercher partout"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={results.length > 0}
            aria-controls="quick-search-results"
            aria-activedescendant={results.length ? `quick-result-${active}` : undefined}
            onKeyDown={(event) => {
              if (!results.length) return;
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setActive(
                  (index) =>
                    (index + (event.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length,
                );
              } else if (event.key === 'Enter') {
                event.preventDefault();
                router.push(results[active].href);
                dialog.current?.close();
              }
            }}
            maxLength={100}
            value={q}
            placeholder="Une équipe, un joueur, un match…"
            onChange={(e) => {
              setQ(e.target.value);
              setState('idle');
              setResults([]);
              setActive(0);
            }}
          />
          <button
            className="icon-button"
            aria-label="Fermer la recherche"
            onClick={() => dialog.current?.close()}
          >
            <X />
          </button>
        </div>
        <div className="quick-results" aria-live="polite">
          {q.trim().length < 2 ? (
            <>
              <p className="data-note">
                Saisissez au moins deux caractères. Résultats issus du catalogue synchronisé.
              </p>
              {[
                ['Équipes', '/equipes'],
                ['Joueurs', '/joueurs'],
                ['Compétitions', '/competitions'],
              ].map(([name, href]) => (
                <Link key={href} href={href} onClick={() => dialog.current?.close()}>
                  {name} →
                </Link>
              ))}
            </>
          ) : state === 'error' ? (
            <div>
              <p>La recherche est momentanément indisponible.</p>
              <button className="button secondary" onClick={() => setRetry((value) => value + 1)}>
                Réessayer
              </button>
            </div>
          ) : state === 'loading' || state === 'idle' ? (
            <p>Recherche en cours…</p>
          ) : results.length ? (
            <div id="quick-search-results" role="listbox" aria-label="Résultats de recherche">
              {results.map((r, index) => (
                <Link
                  role="option"
                  aria-selected={index === active}
                  id={`quick-result-${index}`}
                  key={r.id}
                  href={r.href}
                  onClick={() => dialog.current?.close()}
                >
                  <span className="tag">{r.kind}</span>
                  {r.team && <TeamBadge team={r.team} size={24} />}
                  <strong>{r.name}</strong>
                  <small>{r.detail}</small>
                </Link>
              ))}
            </div>
          ) : (
            <p>Aucun résultat. Essayez un nom plus court.</p>
          )}
        </div>
        <p className="search-hint">↑ ↓ Parcourir · Entrée Ouvrir · Échap Fermer</p>
      </dialog>
    </>
  );
}
