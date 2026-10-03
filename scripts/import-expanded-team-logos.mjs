import { PrismaClient } from '@prisma/client';
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const db = new PrismaClient();
const normalize = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
try {
  const snapshot = await db.cacheEntry.findUnique({ where: { key: 'football:dataset' } });
  const teams =
    snapshot?.payload?.teams?.filter((t) =>
      t.logo?.startsWith('https://a.espncdn.com/i/teamlogos/soccer/'),
    ) ?? [];
  const registry = JSON.parse(await readFile('src/lib/team-logos.json', 'utf8'));
  const sources = [];
  for (const team of teams) {
    const file = `espn-${team.id}.webp`;
    const response = await fetch(team.logo, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error(`Club image HTTP ${response.status}`);
    const input = Buffer.from(await response.arrayBuffer());
    if (input.length > 2_000_000) throw Error('Oversized club image');
    await writeFile(
      `public/team-logos/${file}`,
      await sharp(input)
        .resize(160, 160, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 88 })
        .toBuffer(),
    );
    registry[`${team.country}:${normalize(team.name)}`] = `/team-logos/${file}`;
    sources.push({
      teamId: team.id,
      name: team.name,
      country: team.country,
      file,
      url: team.logo,
      retrieved: new Date().toISOString().slice(0, 10),
    });
  }
  await writeFile('src/lib/team-logos.json', JSON.stringify(registry, null, 2) + '\n');
  await writeFile(
    'public/team-logos/expanded-sources.json',
    JSON.stringify(
      {
        provider: 'ESPN',
        rights: 'Club trademarks belong to their owners; ESPN terms apply.',
        teams: sources,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Downloaded ${sources.length} actual club crests.`);
} finally {
  await db.$disconnect();
}
