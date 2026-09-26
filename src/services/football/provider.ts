import type { Competition, Match, Player, Standing, Team } from '@/types/football';
export interface FixtureBatch {
  matches: Match[];
  teams: Team[];
  competitions: Competition[];
}
export interface BaseFootballProvider {
  readonly name: string;
}
export interface HistoricalFootballProvider extends BaseFootballProvider {
  season(
    league: import('./providers/openfootball').OpenLeague,
    year: number,
    etag?: string | null,
  ): Promise<unknown>;
}
export interface FootballDataProvider extends BaseFootballProvider {
  fixtures(date: string): Promise<FixtureBatch>;
  details(ids: string[]): Promise<FixtureBatch>;
  standings(competitionId: string, season: number): Promise<Standing[]>;
  players(teamId: string, season: number, competitionId?: string): Promise<Player[]>;
}
