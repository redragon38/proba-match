import { describe, expect, it } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
import {
  contentModificationIndex,
  entityContentModifiedAt,
  matchContentModifiedAt,
} from '@/lib/sitemap-lastmod';

describe('significant sitemap modification dates', () => {
  it('omits routine sync timestamps and keeps verified content receptions', () => {
    const data = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
    const base = data.matches[0];
    const scheduled = { ...base, updatedAt: '2026-10-18T10:00:00Z' };
    expect(matchContentModifiedAt(scheduled)).toBeUndefined();

    const finished = {
      ...base,
      status: 'finished' as const,
      homeScore: 1,
      awayScore: 0,
      resultObservedAt: '2026-10-18T11:00:00Z',
      statistics: [{ label: 'Tirs', home: 8, away: 4 }],
      detailObservedAt: { statistics: '2026-10-18T11:05:00Z' },
    };
    expect(matchContentModifiedAt(finished)).toBe('2026-10-18T11:05:00Z');

    const changed = { ...data, matches: [finished] };
    expect(entityContentModifiedAt(`/match/${finished.slug}`, changed)).toBe(
      '2026-10-18T11:05:00Z',
    );
    expect(entityContentModifiedAt(`/equipe/${data.teams[0].slug}`, changed)).toBe(
      '2026-10-18T11:05:00Z',
    );
    const index = contentModificationIndex(changed);
    for (const path of [
      ...changed.matches.map((m) => `/match/${m.slug}`),
      ...changed.teams.map((t) => `/equipe/${t.slug}`),
      ...changed.competitions.map((c) => `/competition/${c.slug}`),
    ])
      expect(index.get(path)).toBe(entityContentModifiedAt(path, changed));
  });
});
