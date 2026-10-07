import type { Dataset, Team } from '@/types/football';
import { validResult } from '@/prediction-engine/availability';
export function teamFactSummary(team: Team, data: Pick<Dataset, 'matches' | 'competitions'>) {
  const competition = data.competitions.find((c) => c.id === team.competitionId);
  const results = data.matches.filter(
    (m) => (m.homeId === team.id || m.awayId === team.id) && validResult(m),
  ).length;
  const identity = `${team.name}${team.country ? ` (${team.country})` : ''}${competition ? ` figure dans le catalogue ${competition.name}` : ' figure dans le catalogue Proba Match'}.`;
  return `${identity} ${results ? `${results} résultat${results > 1 ? 's' : ''} terminé${results > 1 ? 's' : ''} avec un score confirmé ${results > 1 ? 'sont disponibles' : 'est disponible'} dans l’historique du site.` : 'Aucun résultat terminé avec un score confirmé n’est disponible dans l’historique du site.'} Cette couverture peut regrouper plusieurs saisons et ne garantit pas un historique complet du club.`;
}
