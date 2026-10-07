export type QueryValue = string | string[] | undefined;
/** Next.js represents repeated parameters as arrays. Select one value deterministically. */
export function firstQueryValue(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value;
}
export function catalogueQuery(query: { page?: QueryValue; q?: QueryValue }) {
  return { page: firstQueryValue(query.page), q: (firstQueryValue(query.q) ?? '').slice(0, 100) };
}
export function competitionQuery(query: { saison?: QueryValue; statut?: QueryValue }) {
  return { saison: firstQueryValue(query.saison), statut: firstQueryValue(query.statut) };
}
export function competitionAliasTarget(slug: string, query: { saison?: string; statut?: string }) {
  const parameters = new URLSearchParams();
  if (query.saison) parameters.set('saison', query.saison);
  if (query.statut) parameters.set('statut', query.statut);
  return `/competition/${slug}${parameters.size ? `?${parameters}` : ''}`;
}
