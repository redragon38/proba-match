import { db } from '../src/database/client';
import { readLocalDataset } from '../src/services/football/local-store';
import { syncExpandedFootball, syncExpandedPlayers } from '../src/services/football/espn-sync';
import { expandedScopes, EXPANDED_LEAGUES } from '../src/services/football/providers/espn';
import { bootstrapExpandedProduction } from '../src/services/football/production-bootstrap';
import { log } from '../src/lib/logger';

try {
  const outcome = await bootstrapExpandedProduction(
    {
      // Explicit maintenance command; never run implicitly during a deployment/build.
      production: process.argv.includes('--manual'),
      databaseConfigured: !!process.env.DATABASE_URL,
    },
    {
      state: async () => {
        const [data, sources] = await Promise.all([
          readLocalDataset(),
          db.dataSource.findMany({
            where: { id: { startsWith: 'espn:' }, lastSyncedAt: { not: null } },
            select: { id: true },
          }),
        ]);
        const ids = new Set(sources.map((s) => s.id));
        const scopes = expandedScopes();
        const seasons = expandedScopes(true).every((s) => ids.has(`espn:${s.league}:${s.season}`));
        const rosters = scopes.every(({ league, season }) => {
          const competition = data.competitions.find(
            (c) => c.name === EXPANDED_LEAGUES[league].name && c.season === season,
          );
          if (!competition) return false;
          const teams = new Set(
            data.matches
              .filter((m) => m.competitionId === competition.id && m.season === season)
              .flatMap((m) => [m.homeId, m.awayId]),
          );
          return (
            teams.size > 0 &&
            [...teams].every(
              (id) =>
                ids.has(`espn:roster:${id}:${season}`) &&
                data.players.some((p) => p.teamId === id && p.source === 'espn'),
            )
          );
        });
        return { seasons, rosters };
      },
      seasons: () => syncExpandedFootball({ history: true }),
      players: () => syncExpandedPlayers(30),
    },
  );
  log('PRODUCTION_EXPANDED_BOOTSTRAP', { code: outcome.toUpperCase() });
} catch (error) {
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]{1,63}$/.test(error.message)
    ? error.message : 'INITIALIZATION_FAILED';
  log('PRODUCTION_EXPANDED_BOOTSTRAP_FAILED', { code });
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
