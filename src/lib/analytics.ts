export type AnalyticsEvent =
  'match_opened' | 'team_opened' | 'player_opened' | 'search' | 'favorite_added';
/** Local integration boundary: no network, identifier, query text or storage. */
export function emitAnalytics(name: AnalyticsEvent) {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent('matchscore:analytics', { detail: { name } }));
}
