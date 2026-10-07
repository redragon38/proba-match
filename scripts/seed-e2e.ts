/** Synthetic fixtures are permitted ONLY in an explicitly named disposable test database. */
import { db } from '../src/database/client';
import { createDemoDataset } from '../src/services/football/providers/mock';
import { persistDataset } from '../src/services/football/persistence';
import { persistPredictions } from '../src/services/predictions';
try {
  const name = new URL(process.env.DATABASE_URL ?? '').pathname;
  if (!/^\/proba_match_ci_[a-z0-9_]+$/.test(name) || process.env.VERCEL)
    throw new Error('TEST_DATABASE_REQUIRED');
  const data = createDemoDataset();
  // Fixture payloads emulate a provider response; this is not the public corpus.
  data.source = 'api-football';
  data.warning = 'Fixtures synthétiques de tests — base isolée';
  for (const m of data.matches) {
    m.source = 'api-football';
    m.kickoffKnown = true;
    // Synthetic fixture scores are explicitly regulation-time scores. Production
    // ingestion still requires actual provider confirmation of this period.
    if (m.status === 'finished') m.resultPeriod = 'regulation';
    if (m.status === 'finished' && Date.parse(m.kickoff) > Date.now())
      m.kickoff = new Date(Date.now() - 14400000).toISOString();
  }
  for (const p of data.players) p.source = 'api-football';
  // Local fixture assets eliminate reliance on third-party image availability in CI.
  for (const team of data.teams) team.logo = '/icon.png';
  await persistDataset(data, new Set(data.matches.map((m) => m.id)));
  await persistPredictions(data);
  console.info(
    JSON.stringify({
      status: 'PASS',
      fixtures: data.matches.length,
      players: data.players.length,
      scope: 'isolated_test_database',
    }),
  );
} finally {
  await db.$disconnect();
}
