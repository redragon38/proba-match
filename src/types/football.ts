export type MatchStatus =
  'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled' | 'abandoned';
export type FootballSource = 'demo' | 'api-football' | 'openfootball';
export type Position = 'Gardien' | 'Défenseur' | 'Milieu' | 'Attaquant' | 'Non disponible';
export interface MatchPlayerPerformance {
  playerId: string;
  name: string;
  teamId: string;
  position: Position;
  number: number | null;
  stats: PlayerStats;
}
export interface Match {
  season?: number;
  kickoffKnown?: boolean;
  sourceDate?: string;
  provenance?: { schedule: FootballSource; details?: FootballSource };
  performances?: MatchPlayerPerformance[];
  phase?: 'halftime' | 'playing';
  detailsUpdatedAt?: string;
}
export interface Competition {
  id: string;
  slug: string;
  name: string;
  country: string;
  flag: string;
  season: number;
  logo?: string;
}
export interface Team {
  id: string;
  slug: string;
  name: string;
  short: string;
  color: string;
  country: string;
  competitionId: string;
  logo?: string;
  venue?: string;
  coach?: string;
}
export interface Player {
  updatedAt?: string;
  source?: 'api-football' | 'thesportsdb';
  id: string;
  slug: string;
  name: string;
  teamId: string;
  position: Position;
  number: number | null;
  nationality?: string;
  birthDate?: string;
  photo?: string;
  height?: string;
  foot?: string;
  stats: PlayerStats;
}
export interface PlayerStats {
  appearances: number | null;
  starts: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  rating: number | null;
  shots?: number | null;
  shotsOnTarget?: number | null;
  keyPasses?: number | null;
  tackles?: number | null;
  interceptions?: number | null;
  saves?: number | null;
  conceded?: number | null;
  cleanSheets?: number | null;
  errors?: number | null;
  xg?: number | null;
  xa?: number | null;
  yellow?: number | null;
  red?: number | null;
  duels?: number | null;
  dribbles?: number | null;
  passes?: number | null;
}
export interface MatchEvent {
  minute: number;
  extra?: number | null;
  teamId: string;
  type: 'goal' | 'yellow' | 'red' | 'substitution' | 'var';
  player: string;
  assist?: string | null;
  detail?: string;
}
export interface Lineup {
  teamId: string;
  formation: string;
  coach?: string;
  confirmed: boolean;
  starters: { id: string; name: string; number: number | null; row: number; column: number }[];
  substitutes: { id: string; name: string; number: number | null }[];
}
export interface MatchStat {
  label: string;
  home: number | null;
  away: number | null;
  unit?: string;
}
export interface Match {
  id: string;
  slug: string;
  homeId: string;
  awayId: string;
  competitionId: string;
  kickoff: string;
  status: MatchStatus;
  minute?: number | null;
  extra?: number | null;
  homeScore: number | null;
  awayScore: number | null;
  round: string;
  venue?: string;
  referee?: string;
  events: MatchEvent[];
  lineups: Lineup[];
  statistics: MatchStat[];
  updatedAt: string;
  source: FootballSource;
}
export interface Injury {
  id: string;
  playerId: string;
  teamId: string;
  reason: string;
  status: string;
}
export interface Standing {
  teamId: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scored: number;
  conceded: number;
  points: number;
  form: string[];
}
export interface Dataset {
  revision?: string;
  degraded?: boolean;
  source: FootballSource;
  updatedAt: string;
  competitions: Competition[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  injuries: Injury[];
  standings: Record<string, Standing[]>;
  warning?: string;
}
export interface Prediction {
  id: string;
  matchId: string;
  version: string;
  createdAt: string;
  cutoff: string;
  home: number;
  draw: number;
  away: number;
  expectedHome: number;
  expectedAway: number;
  likelyScore: string;
  scores: { home: number; away: number; probability: number }[];
  cleanHome: number;
  cleanAway: number;
  confidence: number;
  sample: number;
  factors: { label: string; detail: string }[];
  inputHash: string;
  lineupConfirmed: boolean;
}
export interface EvaluatedPrediction {
  prediction: Prediction;
  homeScore: number;
  awayScore: number;
  competitionId: string;
  kickoff: string;
}
