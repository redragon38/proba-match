import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  sportsDbPosition,
  sportsDbSearchName,
  sportsDbTeamMatches,
} from '../src/services/football/providers/thesportsdb';
import type { Team } from '../src/types/football';
import {
  licensedCommonsPhoto,
  wikimediaPhotos,
} from '../src/services/football/providers/wikimedia-photo';

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
  afterEach(() => vi.unstubAllGlobals());
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

  it('accepts only a Commons portrait with a concrete reusable licence and attribution', () => {
    const image = {
      thumburl:
        'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/player.jpg/180px-player.jpg',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:player.jpg',
      extmetadata: {
        Artist: { value: '<a href="/wiki/User:Example">Example Artist</a>' },
        LicenseShortName: { value: 'CC BY-SA 4.0' },
        LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' },
      },
    };
    expect(licensedCommonsPhoto(image)).toMatchObject({
      photoCredit: 'Example Artist',
      photoLicense: 'CC BY-SA 4.0',
    });
    expect(
      licensedCommonsPhoto({
        ...image,
        extmetadata: { ...image.extmetadata, LicenseShortName: { value: 'Unknown' } },
      }),
    ).toBeNull();
    expect(
      licensedCommonsPhoto({
        ...image,
        extmetadata: { ...image.extmetadata, Artist: { value: '' } },
      }),
    ).toBeNull();
    expect(
      licensedCommonsPhoto({ ...image, thumburl: 'https://example.com/player.jpg' }),
    ).toBeNull();
  });

  it('resolves a Wikidata-linked photo in two bounded requests', async () => {
    const responses = [
      {
        entities: {
          Q59306386: { claims: { P18: [{ mainsnak: { datavalue: { value: 'Player.jpg' } } }] } },
        },
      },
      {
        query: {
          pages: {
            '1': {
              title: 'File:Player.jpg',
              imageinfo: [
                {
                  thumburl:
                    'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/Player.jpg/180px-Player.jpg',
                  descriptionurl: 'https://commons.wikimedia.org/wiki/File:Player.jpg',
                  extmetadata: {
                    Artist: { value: 'Example Artist' },
                    LicenseShortName: { value: 'CC BY 4.0' },
                    LicenseUrl: { value: 'https://creativecommons.org/licenses/by/4.0/' },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => responses.shift() }));
    vi.stubGlobal('fetch', fetchMock);
    const photos = await wikimediaPhotos(['bad-id', 'Q59306386']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(photos.get('Q59306386')?.photoCredit).toBe('Example Artist');
  });
});
