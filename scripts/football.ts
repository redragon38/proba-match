// Node's --env-file-if-exists loads credentials before the Prisma singleton is imported.
import { syncOpenFootball, openScopes } from '../src/services/football/openfootball-sync';
import { rebuildElo } from '../src/services/football/rebuild-elo';
import { footballJob } from '../src/services/football/jobs';
import { db } from '../src/database/client';
import { OpenFootballProvider } from '../src/services/football/providers/openfootball';
import { syncSportsDbPlayers } from '../src/services/football/sportsdb-sync';
import { syncExpandedFootball, syncExpandedPlayers } from '../src/services/football/espn-sync';
const command = process.argv[2];
try {
  if (command === 'expanded' || command === 'expanded-import')
    console.log(
      await syncExpandedFootball({
        history: command === 'expanded-import',
        force: process.argv.includes('--force'),
      }),
    );
  else if (command === 'expanded-players')
    console.log(
      await syncExpandedPlayers(
        Number(process.argv.find((a) => a.startsWith('--limit='))?.slice(8) ?? 30),
      ),
    );
  else if (command === 'validate') {
    const scope = openScopes()[0];
    const response = await new OpenFootballProvider().season(scope.league, scope.season);
    if (!response.unchanged)
      console.log({ source: response.url, matches: response.data.matches.length });
  } else if (command === 'elo') console.log(await footballJob('elo', () => rebuildElo()));
  else if (command === 'players') {
    const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
    const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : 30;
    console.log(await syncSportsDbPlayers(limit));
  } else if (command === 'import' || command === 'sync') {
    console.log(
      await syncOpenFootball({
        history: command === 'import',
        force: process.argv.includes('--force'),
      }),
    );
  } else
    throw new Error(
      'Use import, sync, players, expanded-players, expanded-import, elo or validate',
    );
} catch (error) {
  console.error(
    error instanceof Error && /^[A-Z_0-9 ]+$/.test(error.message)
      ? error.message
      : 'FOOTBALL_COMMAND_FAILED',
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
