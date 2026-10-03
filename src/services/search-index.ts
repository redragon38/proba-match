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
type IndexedRow = { row: SearchResult; normalized: string };
/** One insertion/deletion/substitution/transposition on a whole word, linear time. */
export function oneEditApart(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length > b.length) return oneEditApart(b, a);
  let i = 0,
    j = 0,
    edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length === b.length && a[i] === b[j + 1] && a[i + 1] === b[j]) {
      i += 2;
      j += 2;
    } else if (a.length === b.length) {
      i++;
      j++;
    } else j++;
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
export function tolerantNameMatch(name: string, query: string) {
  if (name.includes(query)) return true;
  return (
    query.length >= 4 &&
    query.length <= 30 &&
    !query.includes(' ') &&
    name.split(/[\s-]+/).some((word) => oneEditApart(query, word))
  );
}
type IndexEntry = {
  teams: Dataset['teams'];
  players: Dataset['players'];
  competitions: Dataset['competitions'];
  rows: IndexedRow[];
};
const indexes = new WeakMap<Dataset['matches'], IndexEntry>();
function searchEntries(data: Dataset): IndexedRow[] {
  const cached = indexes.get(data.matches);
  if (
    data.source !== 'demo' &&
    cached &&
    cached.teams === data.teams &&
    cached.players === data.players &&
    cached.competitions === data.competitions
  )
    return cached.rows;
  const teams = new Map(data.teams.map((t) => [t.id, t]));
  const rows = [
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
  ].map((row) => ({ row, normalized: normalizeSearch(row.name) }));
  if (data.source !== 'demo')
    indexes.set(data.matches, {
      teams: data.teams,
      players: data.players,
      competitions: data.competitions,
      rows,
    });
  return rows;
}
export function searchIndex(data: Dataset): SearchResult[] {
  return searchEntries(data).map(({ row }) => row);
}
/** Prefix matches first, retaining catalogue order and stopping at ten results. */
export function searchAutocomplete(data: Dataset, query: string): SearchResult[] {
  const prefix: SearchResult[] = [];
  const others: SearchResult[] = [];
  for (const { row, normalized } of searchEntries(data)) {
    if (!normalized.includes(query)) continue;
    if (normalized.startsWith(query)) prefix.push(row);
    else if (others.length < 10) others.push(row);
  }
  const exact = prefix.slice(0, 10).concat(others.slice(0, Math.max(0, 10 - prefix.length)));
  if (exact.length || query.length < 4 || query.length > 30 || query.includes(' ')) return exact;
  return searchEntries(data)
    .filter(({ row, normalized }) => row.kind !== 'Match' && tolerantNameMatch(normalized, query))
    .slice(0, 10)
    .map(({ row }) => row);
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
  const results = searchEntries(data).filter(
    ({ row, normalized }) =>
      (!selected || selected.has(row.id)) &&
      (category === 'all' || row.kind === category) &&
      (normalized.includes(query) ||
        (row.kind !== 'Match' && tolerantNameMatch(normalized, query))),
  );
  const start = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
  return { results: results.slice(start, start + 25).map(({ row }) => row), total: results.length };
}

export function searchSource(data: Dataset): SearchSource {
  return { source: data.source, warning: data.warning, updatedAt: data.updatedAt };
}
