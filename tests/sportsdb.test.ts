import { describe, expect, it } from 'vitest';
import {
  sportsDbPosition,
  sportsDbSearchName,
  sportsDbTeamMatches,
} from '../src/services/football/providers/thesportsdb';
import type { Team } from '../src/types/football';

const team: Team = {
  id: 'arsenal',
  slug: 'arsenal',
  name: 'Arsenal FC',
  short: 'ARS',
  color: '#fff',
  country: 'England',
  competitionId: 'premier-league',
};

describe('TheSportsDB roster fallback', () => {
  it('uses explicit aliases and rejects a different club or sport', () => {
    expect(sportsDbSearchName('Paris Saint-Germain FC')).toBe('Paris Saint Germain');
    expect(
      sportsDbTeamMatches(team, {
        idTeam: '133604',
        strTeam: 'Arsenal',
        strSport: 'Soccer',
        strCountry: 'England',
      }),
    ).toBe(true);
    expect(
      sportsDbTeamMatches(team, {
        idTeam: '1',
        strTeam: 'Arsenal Women',
        strSport: 'Soccer',
        strCountry: 'England',
      }),
    ).toBe(false);
    expect(
      sportsDbTeamMatches(
        { ...team, name: 'AS Monaco FC', country: 'France' },
        { idTeam: '133823', strTeam: 'Monaco', strSport: 'Soccer', strCountry: 'Monaco' },
      ),
    ).toBe(true);
    expect(
      sportsDbTeamMatches(team, {
        idTeam: '2',
        strTeam: 'Arsenal',
        strSport: 'Basketball',
        strCountry: 'England',
      }),
    ).toBe(false);
  });

  it('excludes staff and maps player positions without inventing statistics', () => {
    expect(sportsDbPosition('Goalkeeper')).toBe('Gardien');
    expect(sportsDbPosition('Right-Back')).toBe('Défenseur');
    expect(sportsDbPosition('Central Midfield')).toBe('Milieu');
    expect(sportsDbPosition('Left Winger')).toBe('Attaquant');
    expect(sportsDbPosition('Assistant Coach')).toBeNull();
  });
});
