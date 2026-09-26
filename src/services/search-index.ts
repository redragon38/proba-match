import type { Dataset, Team } from '@/types/football';
export type SearchResult = {
  id: string;
  name: string;
  kind: string;
  href: string;
  detail: string;
  team?: Pick<Team, 'name' | 'short' | 'country' | 'color' | 'logo'>;
};
export type SearchResults = { results: SearchResult[]; total: number };
export type SearchSource = Pick<Dataset, 'source' | 'warning' | 'updatedAt'>;
export const normalizeSearch = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
export function searchIndex(data: Dataset): SearchResult[] {
  const teams = new Map(data.teams.map((t) => [t.id, t]));
  return [
    ...data.teams.map((t) => ({
      id: `team:${t.id}`,
      name: t.name,
      kind: 'Équipe',
      href: `/equipe/${t.slug}`,
      detail: t.country,
      team: { name: t.name, short: t.short, country: t.country, color: t.color, logo: t.logo },
    })),
    ...data.players.map((p) => ({
      id: `player:${p.id}`,
      name: p.name,
      kind: 'Joueur',
      href: `/joueur/${p.slug}`,
      detail: p.position,
    })),
    ...data.competitions.map((c) => ({
      id: `competition:${c.id}`,
      name: c.name,
      kind: 'Compétition',
      href: `/competition/${c.slug}`,
      detail: c.country,
    })),
    ...data.matches
      .filter((m) => !m.id.startsWith('history'))
      .map((m) => ({
        id: `match:${m.id}`,
        name: `${teams.get(m.homeId)?.name ?? 'Équipe'} – ${teams.get(m.awayId)?.name ?? 'Équipe'}`,
        kind: 'Match',
        href: `/match/${m.slug}`,
        detail: m.kickoff.slice(0, 10),
      })),
  ];
}

/** Search the complete server catalogue; only serialize the requested result page. */
export function searchResults(
  data: Dataset,
  {
    q = '',
    category = 'all',
    ids,
    offset = 0,
  }: {
    q?: string;
    category?: string;
    ids?: string[];
    offset?: number;
  } = {},
): SearchResults {
  const query = normalizeSearch(q.slice(0, 100));
  const selected = ids ? new Set(ids) : undefined;
  const results = searchIndex(data).filter(
    (row) =>
      (!selected || selected.has(row.id)) &&
      (category === 'all' || row.kind === category) &&
      normalizeSearch(row.name).includes(query),
  );
  const start = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
  return { results: results.slice(start, start + 25), total: results.length };
}

export function searchSource(data: Dataset): SearchSource {
  return { source: data.source, warning: data.warning, updatedAt: data.updatedAt };
}
