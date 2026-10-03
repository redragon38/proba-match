import { timed } from '@/services/telemetry';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { slugify } from '@/lib/format';
import type { MatchStatus } from '@/types/football';
import type { HistoricalFootballProvider } from '../provider';

export const OPEN_LEAGUES = {
  'fr.1': { name: 'Ligue 1', country: 'France', zone: 'Europe/Paris', secondaryId: '61' },
  'en.1': { name: 'Premier League', country: 'England', zone: 'Europe/London', secondaryId: '39' },
  'de.1': { name: 'Bundesliga', country: 'Germany', zone: 'Europe/Berlin', secondaryId: '78' },
  'es.1': { name: 'La Liga', country: 'Spain', zone: 'Europe/Madrid', secondaryId: '140' },
  'it.1': { name: 'Serie A', country: 'Italy', zone: 'Europe/Rome', secondaryId: '135' },
} as const;
export type OpenLeague = keyof typeof OPEN_LEAGUES;
const pair = z.tuple([z.number().int().min(0).max(99), z.number().int().min(0).max(99)]);
const fixture = z.object({
  team1: z.string().trim().min(1),
  team2: z.string().trim().min(1),
  date: z.string(),
  time: z.string().nullish(),
  round: z.string().optional(),
  score: z.union([pair, z.object({ ft: pair.optional(), ht: pair.optional() })]).nullish(),
  status: z.string().optional(),
});
export function canonicalTeam(name: string) {
  const aliases: Record<string, string> = {
    psg: 'paris-saint-germain',
    'paris-sg': 'paris-saint-germain',
    'paris-saint-germain-fc': 'paris-saint-germain',
  };
  const key = slugify(name);
  return aliases[key] ?? key;
}
/** JSON times are league-local civil times. Date-only rows use UTC noon as a sorting
 * anchor, explicitly marked unknown and excluded from pre-match publication. */
export function openKickoff(date: string, time: string | null | undefined, zone: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new Error('INVALID_DATE');
  if (!time) return { kickoff: `${date}T12:00:00.000Z`, kickoffKnown: false, sourceDate: date };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('INVALID_TIME');
  const target = Date.parse(`${date}T${time}:00Z`);
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  let utc = target;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(fmt.formatToParts(utc).map((p) => [p.type, p.value]));
    const represented = Date.parse(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`,
    );
    if (represented === target)
      return { kickoff: new Date(utc).toISOString(), kickoffKnown: true, sourceDate: date };
    utc += target - represented;
  }
  throw new Error('INVALID_LOCAL_TIME');
}
export function openStatus(status: string | undefined, scored: boolean): MatchStatus {
  const value = status?.toLowerCase();
  if (value === 'postponed' || value === 'cancelled' || value === 'abandoned') return value;
  // A static file cannot establish that a match is currently live.
  return scored ? 'finished' : 'scheduled';
}
export function parseOpenFootball(json: unknown, league: OpenLeague, season: number) {
  const config = OPEN_LEAGUES[league];
  if (!config || !Number.isInteger(season) || season < 2000 || season > 2100)
    throw new Error('INVALID_SCOPE');
  const root = z
    .object({ name: z.string(), matches: z.array(z.unknown()).min(1).max(2000) })
    .parse(json);
  const keys = new Set<string>();
  const matches = root.matches.map((row) => {
    const m = fixture.parse(row);
    const homeKey = canonicalTeam(m.team1),
      awayKey = canonicalTeam(m.team2);
    if (!homeKey || homeKey === awayKey) throw new Error('INVALID_TEAMS');
    // Supported leagues are double round-robin: ordered pair identifies one match
    // per season, independently of date/round corrections and postponements.
    const externalId = `${league}:${season}:${homeKey}:${awayKey}`;
    if (keys.has(externalId)) throw new Error('DUPLICATE_FIXTURE');
    keys.add(externalId);
    const score = Array.isArray(m.score) ? m.score : m.score?.ft;
    return {
      externalId,
      homeName: m.team1,
      awayName: m.team2,
      homeKey,
      awayKey,
      ...openKickoff(m.date, m.time, config.zone),
      round: m.round ?? 'Journée non précisée',
      status: openStatus(m.status, !!score),
      homeScore: score?.[0] ?? null,
      awayScore: score?.[1] ?? null,
    };
  });
  return { league, season, config, matches };
}
export class OpenFootballProvider implements HistoricalFootballProvider {
  readonly name = 'openfootball';
  readonly capabilities = ['competitions', 'seasons', 'teams', 'fixtures', 'results'] as const;
  constructor(private transport: typeof fetch = fetch) {}
  async season(league: OpenLeague, year: number, etag?: string | null) {
    if (!OPEN_LEAGUES[league] || !Number.isInteger(year) || year < 2000 || year > 2100)
      throw new Error('INVALID_SCOPE');
    const url = `https://raw.githubusercontent.com/openfootball/football.json/master/${year}-${String(year + 1).slice(-2)}/${league}.json`;
    const response = await timed('provider:openfootball_transport', () =>
      this.transport(url, {
        headers: etag ? { 'If-None-Match': etag } : {},
        signal: AbortSignal.timeout(30000),
      }),
    );
    if (response.status === 304) return { unchanged: true as const, url };
    if (!response.ok) throw new Error(`OPENFOOTBALL_HTTP_${response.status}`);
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error('OPENFOOTBALL_FILE_TOO_LARGE');
    return {
      unchanged: false as const,
      url,
      etag: response.headers.get('etag'),
      hash: createHash('sha256').update(text).digest('hex'),
      data: parseOpenFootball(JSON.parse(text), league, year),
    };
  }
}
