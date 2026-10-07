import { isoDate, isoDateTime } from './factual-dates';
import type { Match } from '@/types/football';
import { validResult } from '@/prediction-engine/availability';

export function matchDateLabel(
  match: Pick<Match, 'kickoff' | 'kickoffKnown' | 'sourceDate'>,
  long = true,
) {
  const rawDate = match.kickoffKnown === false ? match.sourceDate : match.kickoff;
  const confirmed =
    match.kickoffKnown === false ? isoDate(rawDate) : (isoDateTime(rawDate) ?? isoDate(rawDate));
  if (!confirmed) return null;
  return new Date(confirmed).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: long ? 'numeric' : '2-digit',
    month: long ? 'long' : '2-digit',
    year: 'numeric',
  });
}
export function matchFactSummary(match: Match, home: string, away: string, competition: string) {
  const date = matchDateLabel(match);
  const subject = `${home} – ${away}, ${competition}${date ? `, le ${date}` : ', date à confirmer'}.`;
  if (validResult(match))
    return `${subject} Score enregistré : ${match.homeScore}–${match.awayScore}. Match terminé.`;
  const status =
    match.status === 'finished'
      ? 'Rencontre signalée terminée ; score confirmé indisponible.'
      : match.status === 'postponed'
        ? 'Match reporté ; nouvelle date à confirmer.'
        : match.status === 'cancelled'
          ? 'Match annulé.'
          : match.status === 'abandoned'
            ? 'Match abandonné ; résultat définitif non confirmé.'
            : match.status === 'live'
              ? 'Rencontre en cours ; les données peuvent être retardées.'
              : match.kickoffKnown === false
                ? 'Heure du coup d’envoi non confirmée.'
                : 'Rencontre programmée.';
  return `${subject} ${status}`;
}
