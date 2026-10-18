export type AnalyticsEvent =
  | 'match_opened'
  | 'team_opened'
  | 'player_opened'
  | 'analysis_opened'
  | 'prediction_report_viewed'
  | 'search'
  | 'favorite_added'
  | 'shared';
/** Local integration boundary: no network, identifier, query text or storage. */
export function emitAnalytics(name: AnalyticsEvent) {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent('matchscore:analytics', { detail: { name } }));
}
