import type { Dataset, Team } from '@/types/football';
import { validResult } from '@/prediction-engine/availability';
import { isUpcoming } from '@/services/football/match-selection';

const commonNames: Record<string, string> = {
  'Olympique Lyonnais': 'OL',
  'Olympique de Marseille': 'OM',
  'Paris Saint-Germain FC': 'PSG',
  'Paris Saint-Germain': 'PSG',
};

export function teamCommonName(team: Team) {
  return commonNames[team.name] ?? team.name;
}

export function teamSeoTitle(team: Team, data: Pick<Dataset, 'matches'>) {
  const hasUpcoming = data.matches.some(
    (match) => (match.homeId === team.id || match.awayId === team.id) && isUpcoming(match),
  );
  return `${teamCommonName(team)} : ${hasUpcoming ? 'prochain match, ' : ''}résultats et statistiques`;
}

export function teamFactSummary(team: Team, data: Pick<Dataset, 'matches' | 'competitions'>) {
  const competition = data.competitions.find((c) => c.id === team.competitionId);
  const results = data.matches.filter(
    (m) => (m.homeId === team.id || m.awayId === team.id) && validResult(m),
  ).length;
  const next = data.matches
    .filter((match) => (match.homeId === team.id || match.awayId === team.id) && isUpcoming(match))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
  const scope = competition ? ` en ${competition.name}` : '';
  const history = results
    ? `${results} résultat${results > 1 ? 's' : ''} terminé${results > 1 ? 's' : ''} avec un score confirmé`
    : 'Aucun résultat terminé avec un score confirmé';
  const calendar = next ? ' et le prochain match disponible' : '';
  return `${team.name}${scope} : ${history}${calendar}. Statistiques calculées uniquement à partir des données documentées ; cette couverture peut être partielle et ne garantit pas un historique complet.`;
}
