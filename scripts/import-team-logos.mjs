import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const manifest = JSON.parse(await readFile('public/team-logos/sources.json', 'utf8'));
let cursor = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (cursor < manifest.teams.length) {
      const team = manifest.teams[cursor++];
      const url = `https://raw.githubusercontent.com/luukhopman/football-logos/${manifest.commit}/${team.sourcePath.split('/').map(encodeURIComponent).join('/')}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Logo unavailable: ${team.name} (${response.status})`);
      const input = Buffer.from(await response.arrayBuffer());
      if (input.length > 2_000_000) throw new Error(`Oversized logo: ${team.name}`);
      const image = await sharp(input)
        .trim()
        .resize(160, 160, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 88 })
        .toBuffer();
      await writeFile(`public/team-logos/${team.file}`, image);
    }
  }),
);
const normalize = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const logos = Object.fromEntries(
  manifest.teams.map((t) => [`${t.country}:${normalize(t.name)}`, `/team-logos/${t.file}`]),
);
await writeFile('src/lib/team-logos.json', JSON.stringify(logos, null, 2) + '\n');
console.log(`Imported ${manifest.teams.length} verified mappings as local WebP files.`);
