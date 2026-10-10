export type MatchStatus =
  'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled' | 'abandoned';
export type FootballSource =
  'demo' | 'api-football' | 'openfootball' | 'espn' | 'fotmob' | 'statsbomb';
export type Position = 'Gardien' | 'Défenseur' | 'Milieu' | 'Attaquant' | 'Non disponible';
export interface MatchPlayerPerformance {
  playerId: string;
  name: string;
  photo?: string;
  teamId: string;
  position: Position;
  number: number | null;
  stats: PlayerStats;
}
export interface Match {
  detailSource?: Partial<
    Record<'events' | 'lineups' | 'statistics' | 'performances', FootballSource>
  >;
  detailPresence?: Partial<Record<'events' | 'lineups' | 'statistics' | 'performances', boolean>>;
  detailObservedAt?: Partial<Record<'events' | 'lineups' | 'statistics' | 'performances', string>>;
  detailFallback?: string[];
  /** Unknown legacy periods are not certified as 90-minute results. */
  resultPeriod?: 'regulation' | 'extra-time' | 'penalties' | 'unknown';
  neutralVenue?: boolean;
  resultRevisions?: ResultRevision[];
  /** Local ingestion time of the current final-score revision; never reconstructed. */
  resultObservedAt?: string;
  countsForStandings?: boolean;
  season?: number;
  kickoffKnown?: boolean;
  sourceDate?: string;
  provenance?: { schedule: FootballSource; details?: FootballSource };
  performances?: MatchPlayerPerformance[];
  phase?: 'halftime' | 'playing';
  detailsUpdatedAt?: string;
  scoreBreakdown?: {
    halftime?: { home?: number | null; away?: number | null };
    fulltime?: { home?: number | null; away?: number | null };
    extratime?: { home?: number | null; away?: number | null };
    penalty?: { home?: number | null; away?: number | null };
  };
}
export interface ResultRevision {
  observedAt: string;
  source: FootballSource;
  homeId: string;
  awayId: string;
  kickoff: string;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  resultPeriod?: Match['resultPeriod'];
  scoreBreakdown?: Match['scoreBreakdown'];
  neutralVenue?: boolean;
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
  statsScope?: {
    competitionId: string;
    season: number;
    teamId: string;
    source: string;
    observedAt: string;
    type: 'season';
    verified: boolean;
  };
  updatedAt?: string;
  source?: 'api-football' | 'thesportsdb' | 'espn';
  id: string;
  slug: string;
  name: string;
  teamId: string;
  position: Position;
  number: number | null;
  nationality?: string;
  birthDate?: string;
  photo?: string;
  photoCredit?: string;
  photoSource?: string;
  photoLicense?: string;
  photoLicenseUrl?: string;
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
  xgot?: number | null;
  xa?: number | null;
  yellow?: number | null;
  red?: number | null;
  duels?: number | null;
  dribbles?: number | null;
  passes?: number | null;
  passesCompleted?: number | null;
  passAccuracy?: number | null;
  blocks?: number | null;
  duelsTotal?: number | null;
  fouls?: number | null;
  penaltiesSaved?: number | null;
}
export interface MatchEvent {
  minute: number;
  extra?: number | null;
  teamId: string;
  type: 'goal' | 'penalty-miss' | 'yellow' | 'red' | 'substitution' | 'var';
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
  verifiedAt?: { results?: string; calendar?: string; details?: string; players?: string };
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
  effectiveSample?: number;
  inputArchive?: {
    schemaVersion: number;
    modelVersion: string;
    parameters: Record<string, number | string>;
    availabilityMode: 'observed' | 'reconstructed';
    cutoff: string;
    resultPeriod: string;
    target: Match;
    matches: Match[];
  };
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
  factors: { label: string; detail: string; side?: 'home' | 'away' | 'neutral' }[];
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
