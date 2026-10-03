type State = { seasons: boolean; rosters: boolean };
type Outcome = { status: string; failures?: number };

/** Only initializes missing production data; it never deletes or replaces the existing corpus. */
export async function bootstrapExpandedProduction(
  environment: { production: boolean; databaseConfigured: boolean },
  dependencies: {
    state: () => Promise<State>;
    seasons: () => Promise<Outcome>;
    players: () => Promise<Outcome>;
    wait?: () => Promise<void>;
  },
) {
  if (!environment.production) return 'skipped';
  if (!environment.databaseConfigured) throw new Error('PRODUCTION_DATABASE_NOT_CONFIGURED');
  let state = await dependencies.state();
  if (state.seasons && state.rosters) return 'ready';
  const wait =
    dependencies.wait ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 5000)));
  for (let attempt = 0; !state.seasons && attempt < 3; attempt++) {
    try {
      await dependencies.seasons();
    } catch {
      // Successful scopes remain persisted; the next attempt only requests missing scopes.
    }
    state = await dependencies.state();
    if (!state.seasons && attempt < 2) await wait();
  }
  if (!state.seasons) throw new Error('PRODUCTION_LEAGUE_IMPORT_INCOMPLETE');
  let playerFailure = false;
  // Thirty clubs per batch: bounded, with room for promotion and league expansion.
  for (let batch = 0; batch < 8; batch++) {
    state = await dependencies.state();
    if (state.seasons && state.rosters) return 'initialized';
    if (!state.seasons) throw new Error('PRODUCTION_LEAGUE_IMPORT_INCOMPLETE');
    try {
      const result = await dependencies.players();
      playerFailure = result.status !== 'success' || !!result.failures;
    } catch {
      playerFailure = true;
    }
    if (playerFailure && batch < 7) await wait();
  }
  state = await dependencies.state();
  if (!state.seasons || !state.rosters)
    throw new Error(
      playerFailure ? 'PRODUCTION_PLAYER_IMPORT_INCOMPLETE' : 'PRODUCTION_BOOTSTRAP_INCOMPLETE',
    );
  return 'initialized';
}
