import { describe, expect, it } from 'vitest';

import { stableEntityId } from '@/services/football/stable-identity';

describe('stableEntityId', () => {
  it('returns a deterministic UUID for an external provider identity', () => {
    const first = stableEntityId('espn', 'match', '401764477');
    const second = stableEntityId('espn', 'match', '401764477');

    expect(second).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('separates providers, kinds and invalid empty inputs', () => {
    expect(stableEntityId('espn', 'match', '42')).not.toBe(
      stableEntityId('openfootball', 'match', '42'),
    );
    expect(stableEntityId('espn', 'match', '42')).not.toBe(stableEntityId('espn', 'team', '42'));
    expect(() => stableEntityId('espn', 'match', '')).toThrow('INVALID_STABLE_ID');
  });
});
