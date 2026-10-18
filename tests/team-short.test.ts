import { describe, expect, it } from 'vitest';
import { identifiableTeamShort } from '@/lib/team-short';

describe('identifiable team abbreviations', () => {
  it('replaces generic prefixes while preserving meaningful provider abbreviations', () => {
    expect(identifiableTeamShort('FC Internazionale Milano', 'FC ')).toBe('INT');
    expect(identifiableTeamShort('1. FC Köln', '1. ')).toBe('KOL');
    expect(identifiableTeamShort('RC Celta de Vigo', 'RC ')).toBe('CEL');
    expect(identifiableTeamShort('Manchester United', 'MUN')).toBe('MUN');
  });
});
