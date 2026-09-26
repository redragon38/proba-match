import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { teamLogo } from '@/lib/team-logo';
import logos from '@/lib/team-logos.json';
describe('Team logos', () => {
  it('keeps provider logos and uses an exact, country-scoped fallback', () => {
    expect(teamLogo({ name: 'OGC Nice', country: 'France', logo: '/provided.webp' })).toBe(
      '/provided.webp',
    );
    expect(teamLogo({ name: 'OGC Nice', country: 'France' })).toBe('/team-logos/ogc-nice.webp');
    expect(teamLogo({ name: 'OGC Nice', country: 'Spain' })).toBeUndefined();
    expect(teamLogo({ name: 'Unknown club', country: 'France' })).toBeUndefined();
  });
  it('ships small valid WebP files for every registered crest', () => {
    expect(Object.keys(logos)).toHaveLength(129);
    for (const file of Object.values(logos)) {
      const bytes = readFileSync(`public${file}`);
      expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
      expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
      expect(bytes.length).toBeLessThan(30000);
    }
  });
});
