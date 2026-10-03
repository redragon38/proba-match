type State = { seasons: boolean; rosters: boolean };
type Outcome = { status: string; failures?: number };

/** Only initializes missing production data; it never deletes or replaces the existing corpus. */
export async function bootstrapExpandedProduction(
  environment: { production: boolean; databaseConfigured: boolean },
  dependencies: {
    state: () => Promise<State>;
    seasons: () => Promise<Outcome>;
    players: () => Promise<Outcome>;
  },
) {
  if (!environment.production) return 'skipped';
  if (!environment.databaseConfigured) throw new Error('PRODUCTION_DATABASE_NOT_CONFIGURED');
  let state = await dependencies.state();
  if (state.seasons && state.rosters) return 'ready';
  if (!state.seasons) {
    const result = await dependencies.seasons();
    if (result.status !== 'success' || result.failures)
      throw new Error('PRODUCTION_LEAGUE_IMPORT_INCOMPLETE');
  }
  // Thirty clubs per batch: bounded, with room for promotion and league expansion.
  for (let batch = 0; batch < 8; batch++) {
    state = await dependencies.state();
    if (state.seasons && state.rosters) return 'initialized';
    if (!state.seasons) throw new Error('PRODUCTION_LEAGUE_IMPORT_INCOMPLETE');
    const result = await dependencies.players();
    if (result.status !== 'success' || result.failures)
      throw new Error('PRODUCTION_PLAYER_IMPORT_INCOMPLETE');
  }
  state = await dependencies.state();
  if (!state.seasons || !state.rosters) throw new Error('PRODUCTION_BOOTSTRAP_INCOMPLETE');
  return 'initialized';
}
