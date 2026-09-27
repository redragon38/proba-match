import { z } from 'zod';
import { slugify } from '@/lib/format';
import type { Position, Team } from '@/types/football';

const base = 'https://www.thesportsdb.com/api/v1/json/123';
const teamSchema = z.object({
  idTeam: z.string().regex(/^\d{1,12}$/),
  strTeam: z.string().trim().min(1).max(120),
  strSport: z.string().nullish(),
  strCountry: z.string().nullish(),
});
const playerSchema = z.object({
  idPlayer: z.string().regex(/^\d{1,12}$/),
  idTeam: z.string().nullish(),
  strPlayer: z.string().trim().min(1).max(120),
  strPosition: z.string().nullish(),
  strNumber: z.string().nullish(),
  strNationality: z.string().nullish(),
  dateBorn: z.string().nullish(),
  strHeight: z.string().nullish(),
  strSide: z.string().nullish(),
  idWikidata: z.string().nullish(),
});

export type SportsDbTeam = z.infer<typeof teamSchema>;
export type SportsDbPlayer = z.infer<typeof playerSchema>;

/** Only explicit aliases and exact normalized names can bind a community record to a club. */
const aliases: Record<string, string> = {
  'Paris Saint-Germain FC': 'Paris Saint Germain',
  'Olympique Lyonnais': 'Lyon',
  'Olympique de Marseille': 'Marseille',
  'OGC Nice': 'Nice',
  'Lille OSC': 'Lille',
  'Stade Brestois 29': 'Brest',
  'Racing Club de Lens': 'Lens',
  'Stade Rennais FC 1901': 'Rennes',
  'FC Bayern München': 'Bayern Munich',
  'Bayer 04 Leverkusen': 'Bayer Leverkusen',
  'SV Werder Bremen': 'Werder Bremen',
  'Borussia Mönchengladbach': 'Borussia Monchengladbach',
  'Genoa CFC': 'Genoa',
  'AFC Bournemouth': 'Bournemouth',
  'Real Sociedad de Fútbol': 'Real Sociedad',
  'ACF Fiorentina': 'Fiorentina',
  'TSG 1899 Hoffenheim': 'Hoffenheim',
  'Athletic Club': 'Athletic Bilbao',
  'FC Internazionale Milano': 'Inter Milan',
  'SC Freiburg': 'Freiburg',
  'Rayo Vallecano de Madrid': 'Rayo Vallecano',
  'Frosinone Calcio': 'Frosinone',
  'SSC Napoli': 'Napoli',
  'RC Celta de Vigo': 'Celta Vigo',
  'Brighton & Hove Albion FC': 'Brighton and Hove Albion',
  'Nottingham Forest FC': 'Nottingham Forest',
  'AS Monaco FC': 'Monaco',
  'VfB Stuttgart': 'Stuttgart',
  'CA Osasuna': 'Osasuna',
  'RC Strasbourg Alsace': 'Strasbourg',
  '1. FC Köln': 'Köln',
  'US Sassuolo Calcio': 'Sassuolo',
  '1. FC Union Berlin': 'Union Berlin',
  'Real Betis Balompié': 'Real Betis',
  'Atalanta BC': 'Atalanta',
  'AJ Auxerre': 'Auxerre',
  '1. FSV Mainz 05': 'Mainz',
  'US Lecce': 'Lecce',
  'Angers SCO': 'Angers',
  'SS Lazio': 'Lazio',
  'Paris FC': 'Paris FC',
  'Hamburger SV': 'Hamburg',
  'Udinese Calcio': 'Udinese',
  'SC Paderborn 07': 'Paderborn',
  'Club Atlético de Madrid': 'Atletico Madrid',
  'ES Troyes AC': 'Troyes',
  'SV 07 Elversberg': 'Elversberg',
  'RCD Espanyol de Barcelona': 'Espanyol',
  'Cagliari Calcio': 'Cagliari',
  'Sunderland AFC': 'Sunderland',
  'Levante UD': 'Levante',
  'Bologna FC 1909': 'Bologna',
  'AC Milan': 'AC Milan',
  'Real Racing Club de Santander': 'Racing de Santander',
  'Parma Calcio 1913': 'Parma',
  'Hull City AFC': 'Hull City',
  'RC Deportivo La Coruña': 'Deportivo de A Coruña',
  'Como 1907': 'Como',
};
// Search's free one-result cap returns unrelated sports for these names.
const verifiedTeamIds: Record<string, string> = {
  'Brighton & Hove Albion FC': '133619',
  'Lille OSC': '133711',
  'Nottingham Forest FC': '133720',
  '1. FC Köln': '133654',
  'RC Deportivo La Coruña': '133816',
};

export function sportsDbSearchName(name: string) {
  return aliases[name] ?? name.replace(/^(FC|AC|AS|RC)\s+/i, '').replace(/\s+(FC|CF|AC|SC)$/i, '');
}

export function sportsDbTeamMatches(local: Team, external: SportsDbTeam) {
  const countryMatches =
    slugify(external.strCountry ?? '') === slugify(local.country) ||
    (local.name === 'AS Monaco FC' && external.strCountry === 'Monaco');
  return (
    external.strSport === 'Soccer' &&
    countryMatches &&
    slugify(external.strTeam) === slugify(sportsDbSearchName(local.name))
  );
}

export function sportsDbPosition(value: string | null | undefined): Position | null {
  const name = value?.toLowerCase() ?? '';
  if (/goalkeeper|keeper/.test(name)) return 'Gardien';
  if (/back|defen|sweeper/.test(name)) return 'Défenseur';
  if (/midfield/.test(name)) return 'Milieu';
  if (/wing|forward|striker|attacker/.test(name)) return 'Attaquant';
  return null; // Coaches and staff are not player profiles.
}

export class SportsDbProvider {
  private lastRequest = 0;
  requests = 0;

  private async get(path: string, params: Record<string, string>) {
    // Free tier: 30 requests/minute. The server importer is the only caller.
    const wait = Math.max(0, 2100 - (Date.now() - this.lastRequest));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequest = Date.now();
    const url = new URL(`${base}/${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    this.requests++;
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    if (response.status === 429) throw new Error('SPORTSDB_RATE_LIMIT');
    if (!response.ok) throw new Error('SPORTSDB_UNAVAILABLE');
    return response.json() as Promise<unknown>;
  }

  async team(name: string): Promise<SportsDbTeam | null> {
    const verifiedId = verifiedTeamIds[name];
    const payload = z
      .object({ teams: z.array(teamSchema).nullish() })
      .parse(
        verifiedId
          ? await this.get('lookupteam.php', { id: verifiedId })
          : await this.get('searchteams.php', { t: sportsDbSearchName(name) }),
      );
    return payload.teams?.[0] ?? null;
  }

  async players(teamId: string): Promise<SportsDbPlayer[]> {
    const payload = z
      .object({ player: z.array(z.unknown()).max(100).nullish() })
      .parse(await this.get('lookup_all_players.php', { id: teamId }));
    return (payload.player ?? []).flatMap((row) => {
      const parsed = playerSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    });
  }
}
